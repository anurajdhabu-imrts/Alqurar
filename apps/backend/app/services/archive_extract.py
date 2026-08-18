"""Unpack an uploaded bundle into the documents it contains.

Bundles routinely arrive as one archive — a whole correspondence folder, a set of
site records, a contract pack. Stored as a single row that archive is a dead end:
it has no extractable text, so AI analysis sees nothing but the filename, and the
files inside can't be viewed, downloaded, commented on or tied to a delay event.
Uploads are therefore unpacked here and every member is stored as a document in
its own right.

The format is decided by the file's own magic bytes, NOT its extension: bundles
are frequently mislabelled (a RAR saved as ".zip" is common, and Windows' own
"Compressed folder" naming encourages it), and an extension-only check rejects
those with a confusing "not a readable ZIP" error. Office formats (.docx/.xlsx/
.pptx) are zip containers underneath, so those ARE matched by extension — they
are documents, not bundles.

ZIP and TAR are handled in-process by the standard library. RAR and 7z need an
external unpacker (bsdtar — bundled with Windows 10+ and packaged as
libarchive-tools on Linux — or unrar/7z/unar if installed); where none is present
the upload is kept as-is and the row says what was missing.
"""

import io
import mimetypes
import os
import shutil
import subprocess
import tarfile
import tempfile
import zipfile
from functools import lru_cache
from pathlib import Path
from typing import Iterator, List, NamedTuple, Optional, Tuple

# Bounds. A malicious or simply careless archive ("zip bomb") must not be able to
# exhaust the server's memory or the database. Members are read and stored one at
# a time, so peak memory is one file — these cap what lands in the database.
MAX_MEMBERS = 1000
MAX_MEMBER_BYTES = 200 * 1024 * 1024  # 200 MB for any single file
MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024  # 2 GB unpacked across the whole archive
# Archives nested inside archives are expanded too, but only so far.
MAX_DEPTH = 3
# An external unpacker is given this long before it is abandoned.
TOOL_TIMEOUT_SECONDS = 900

# Word/Excel/PowerPoint/OpenDocument files are zips — they are documents, not bundles.
_OFFICE_ZIP_EXTS = {"docx", "docm", "xlsx", "xlsm", "pptx", "pptm", "odt", "ods", "odp"}

# Packaging noise no one wants as a claim document.
_NOISE_NAMES = {".ds_store", "thumbs.db", "desktop.ini"}

# Formats that need an external unpacker, and the tools that can read each, in
# preference order.
_TOOL_FORMATS = {
    "rar": ("unrar", "bsdtar", "7z", "unar"),
    "7z": ("7z", "bsdtar", "unar"),
}

# Where to look for an unpacker beyond PATH. Windows ships bsdtar as tar.exe, and
# 7-Zip/WinRAR install outside PATH.
_TOOL_FALLBACK_PATHS = {
    "bsdtar": (os.path.join(os.environ.get("SystemRoot", r"C:\Windows"), "System32", "tar.exe"),),
    "7z": (r"C:\Program Files\7-Zip\7z.exe", r"C:\Program Files (x86)\7-Zip\7z.exe"),
    "unrar": (r"C:\Program Files\WinRAR\UnRAR.exe", r"C:\Program Files (x86)\WinRAR\UnRAR.exe"),
}

_FORMAT_LABEL = {
    "zip": "ZIP",
    "rar": "RAR",
    "7z": "7z",
    "tar": "TAR",
}


class ArchiveError(Exception):
    """The archive could not be unpacked (corrupt, encrypted, unsupported, or over the limits)."""


class Member(NamedTuple):
    """One file taken out of an archive, ready to be stored as a document."""

    name: str
    data: bytes
    mime: str


def _ext(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def sniff(raw: bytes) -> str:
    """The archive format of these bytes — "zip"/"rar"/"7z"/"tar" — or "" if not one.

    Reads the file's signature rather than its name, so a mislabelled bundle is
    still recognised for what it is.
    """
    if raw[:4] in (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"):
        return "zip"
    if raw[:6] == b"Rar!\x1a\x07":  # covers RAR4 (…\x07\x00) and RAR5 (…\x07\x01\x00)
        return "rar"
    if raw[:6] == b"7z\xbc\xaf\x27\x1c":
        return "7z"
    # Compressed tarballs; the compression header is all we can see up front, so
    # the tar itself is confirmed when tarfile opens it.
    if raw[:2] == b"\x1f\x8b" or raw[:3] == b"BZh" or raw[:6] == b"\xfd7zXZ\x00":
        return "tar"
    if raw[257:262] == b"ustar":
        return "tar"
    return ""


def is_archive(filename: str, raw: bytes) -> bool:
    """True when an upload is a bundle that should be unpacked into documents."""
    fmt = sniff(raw)
    if not fmt:
        return False
    # A .docx/.xlsx/.pptx is a zip container holding one document — never unpack it.
    if fmt == "zip" and _ext(filename) in _OFFICE_ZIP_EXTS:
        return False
    return True


def format_label(raw: bytes) -> str:
    """Human name of the detected format ("RAR", "ZIP", …) for messages and rows."""
    return _FORMAT_LABEL.get(sniff(raw), "Archive")


def _display_name(member_path: str) -> str:
    """Flatten a member's path into a single safe filename.

    The folders inside a bundle carry meaning ("1. GIC/GIC002-SSH-0027.pdf"), so
    they are kept in the name rather than thrown away — joined with underscores
    because the value is used as a stored filename and in a download header, where
    a path separator has no business being.
    """
    parts = [p for p in member_path.replace("\\", "/").split("/") if p not in ("", ".", "..")]
    return "_".join(parts) if parts else "file"


def _is_noise(member_path: str) -> bool:
    """Archive/OS bookkeeping entries that aren't documents."""
    parts = member_path.replace("\\", "/").split("/")
    if "__MACOSX" in parts:
        return True
    base = parts[-1]
    return base.startswith(".") or base.lower() in _NOISE_NAMES


def _mime_for(name: str) -> str:
    return mimetypes.guess_type(name)[0] or "application/octet-stream"


class _Budget:
    """Enforces the member-count and size limits across an archive and its nested ones."""

    def __init__(self) -> None:
        self.count = 0
        self.total = 0

    def check(self, name: str, size: int) -> None:
        if size > MAX_MEMBER_BYTES:
            raise ArchiveError(
                f"{name} is larger than the {MAX_MEMBER_BYTES // (1024 * 1024)} MB per-file limit"
            )
        if self.total + size > MAX_TOTAL_BYTES:
            raise ArchiveError(
                f"the archive unpacks to more than {MAX_TOTAL_BYTES // (1024 * 1024 * 1024)} GB"
            )
        if self.count >= MAX_MEMBERS:
            raise ArchiveError(f"the archive holds more than {MAX_MEMBERS} files")

    def spend(self, size: int) -> None:
        self.count += 1
        self.total += size


# ── External unpackers (RAR, 7z) ──────────────────────────────────────────────

def _is_bsdtar(path: str) -> bool:
    """True if this tar is bsdtar/libarchive — GNU tar cannot read RAR or 7z.

    Matters on Windows, where `tar` on PATH may be Git's GNU tar while the bsdtar
    that can read these formats sits in System32.
    """
    try:
        out = subprocess.run([path, "--version"], capture_output=True, timeout=20, text=True)
    except (OSError, subprocess.SubprocessError):
        return False
    blurb = f"{out.stdout} {out.stderr}".lower()
    return "bsdtar" in blurb or "libarchive" in blurb


@lru_cache(maxsize=None)
def _find_tool(tool: str) -> Optional[str]:
    """Locate one unpacker (PATH first, then the usual install locations), or None.

    Cached: the answer can't change while the process runs, and probing a tool's
    version on every upload would be wasteful.
    """
    override = os.getenv(f"{tool.upper().replace('-', '_')}_PATH")
    candidates = [override] if override else []
    candidates.append(shutil.which(tool))
    candidates.extend(_TOOL_FALLBACK_PATHS.get(tool, ()))
    for candidate in candidates:
        if not candidate or not os.path.isfile(candidate):
            continue
        if tool == "bsdtar" and not _is_bsdtar(candidate):
            continue
        return candidate
    return None


def _extract_argv(tool: str, exe: str, src: str, dest: str) -> List[str]:
    if tool == "bsdtar":
        return [exe, "-x", "-f", src, "-C", dest]
    if tool == "7z":
        return [exe, "x", "-y", "-bso0", "-bsp0", f"-o{dest}", src]
    if tool == "unrar":
        return [exe, "x", "-y", "-idq", "-scul", src, dest + os.sep]
    return [exe, "-quiet", "-force-overwrite", "-output-directory", dest, src]  # unar


def _list_argv(tool: str, exe: str, src: str) -> Optional[List[str]]:
    """Bare listing of an archive's entries, for checking nothing was dropped."""
    if tool == "bsdtar":
        return [exe, "-t", "-f", src]
    if tool == "unrar":
        return [exe, "lb", "-scul", src]  # -scul: names as UTF-8, not the OEM codepage
    return None  # 7z/unar listings need parsing — skip the check rather than guess


def _short_workdir() -> str:
    """A working directory with a SHORT path.

    Windows still enforces a 260-character path limit in the unpackers, and a
    bundle's own folder names eat most of that: with the default temp directory
    (~50 characters before we start) unrar silently skipped three of this project's
    RFI letters — exit code 0, files simply absent. Keeping our own prefix tiny
    buys back that headroom. POSIX temp paths are short already.
    """
    if os.name == "nt":
        drive = os.path.splitdrive(tempfile.gettempdir())[0] or "C:"
        root = os.path.join(drive + os.sep, "alq-tmp")
        try:
            os.makedirs(root, exist_ok=True)
            return tempfile.mkdtemp(prefix="", dir=root)
        except OSError:
            pass  # locked-down root — fall back to the standard temp directory
    return tempfile.mkdtemp(prefix="alqrar-")


def _expected_file_count(tool: str, exe: str, src: str, dest: str) -> Optional[int]:
    """How many files the archive says it holds, or None if it can't be established.

    Used to catch an unpacker that quietly drops entries. Directory entries are
    excluded: an entry is a directory if it ends in a separator, is the parent of
    another entry, or came out on disk as a directory (which is how an empty folder
    in the archive is told apart from a file).
    """
    argv = _list_argv(tool, exe, src)
    if not argv:
        return None
    try:
        done = subprocess.run(argv, capture_output=True, timeout=TOOL_TIMEOUT_SECONDS)
    except (OSError, subprocess.SubprocessError):
        return None
    if done.returncode != 0:
        return None
    entries = [
        line.replace("\\", "/").rstrip("/")
        for line in done.stdout.decode("utf-8", "replace").splitlines()
        if line.strip()
    ]
    if not entries:
        return None
    parents = {e.rsplit("/", 1)[0] for e in entries if "/" in e}
    files = [
        e for e in entries
        if e not in parents and not os.path.isdir(os.path.join(dest, e.replace("/", os.sep)))
    ]
    return len(files)


def _extract_with_tool(fmt: str, name: str, src: str, dest: str) -> None:
    """Unpack a RAR/7z bundle already written to `src`, into `dest`.

    Tries each installed unpacker until one produces the whole archive. A tool that
    drops files (see _short_workdir) is treated as a failure rather than accepted:
    in a claim data room, three letters missing without a word is worse than an
    upload that says it couldn't be unpacked.
    """
    tried, shortfall = [], None
    for tool in _TOOL_FORMATS[fmt]:
        exe = _find_tool(tool)
        if not exe:
            continue
        tried.append(tool)
        try:
            subprocess.run(
                _extract_argv(tool, exe, src, dest),
                capture_output=True,
                timeout=TOOL_TIMEOUT_SECONDS,
                cwd=dest,
            )
        except subprocess.TimeoutExpired as exc:
            raise ArchiveError(f"unpacking {name} took longer than {TOOL_TIMEOUT_SECONDS}s") from exc
        except OSError as exc:
            raise ArchiveError(f"could not run {tool} to unpack {name}: {exc}") from exc

        # Exit codes can't be trusted here (unrar reports success while skipping
        # files), so judge by what actually landed against what the archive holds.
        landed = sum(1 for p in Path(dest).rglob("*") if p.is_file())
        if not landed:
            _empty_dir(dest)
            continue
        expected = _expected_file_count(tool, exe, src, dest)
        if expected is None or landed >= expected:
            return
        shortfall = (expected - landed, expected)
        _empty_dir(dest)  # a partial unpack is not usable — let the next tool try

    if shortfall:
        missing, expected = shortfall
        raise ArchiveError(
            f"{missing} of {expected} files in {name} could not be unpacked "
            "(their names are too long for the unpacker) — re-save the bundle as a ZIP, "
            "or shorten the folder names inside it"
        )
    if tried:
        raise ArchiveError(f"{name} could not be unpacked (it may be corrupt or password-protected)")

    label = _FORMAT_LABEL.get(fmt, fmt.upper())
    raise ArchiveError(
        f"{name} is a {label} archive and this server has no {label} unpacker installed "
        f"(install bsdtar/libarchive-tools, 7-Zip or unrar) — re-saving the bundle as a ZIP "
        "will upload it as-is"
    )


def _empty_dir(path: str) -> None:
    """Clear a directory's contents, keeping the directory itself."""
    for child in Path(path).iterdir():
        if child.is_dir():
            shutil.rmtree(child, ignore_errors=True)
        else:
            child.unlink(missing_ok=True)


# ── Per-format member iteration ───────────────────────────────────────────────

def _iter_zip(name: str, raw: bytes, budget: _Budget, depth: int) -> Iterator[Member]:
    try:
        zf = zipfile.ZipFile(_reader(raw))
    except (zipfile.BadZipFile, OSError) as exc:
        raise ArchiveError(f"{name} is not a readable ZIP archive") from exc
    with zf:
        entries = [i for i in zf.infolist() if not i.is_dir()]
        prefix = _common_root([i.filename.replace("\\", "/") for i in entries])
        for info in entries:
            if _is_noise(info.filename):
                continue
            # Encrypted member — there is no password to offer, so it can't be read.
            if info.flag_bits & 0x1:
                continue
            member_name = _display_name(info.filename.replace("\\", "/")[len(prefix):])
            budget.check(member_name, info.file_size)
            try:
                data = zf.read(info)
            except (RuntimeError, zipfile.BadZipFile, OSError):
                continue  # unsupported compression or a damaged entry — skip that file
            yield from _emit(member_name, data, budget, depth)


def _iter_tar(name: str, raw: bytes, budget: _Budget, depth: int) -> Iterator[Member]:
    try:
        tf = tarfile.open(fileobj=_reader(raw), mode="r:*")
    except (tarfile.TarError, OSError) as exc:
        raise ArchiveError(f"{name} is not a readable TAR archive") from exc
    with tf:
        # Iterated as a stream, so — unlike ZIP and the tool path — the member list
        # isn't known up front and a shared root folder can't be trimmed from the
        # names. Deliberate: indexing a tarball first means decompressing it twice.
        for info in tf:
            if not info.isfile() or _is_noise(info.name):
                continue
            member_name = _display_name(info.name)
            budget.check(member_name, info.size)
            handle = tf.extractfile(info)
            if handle is None:
                continue
            with handle:
                data = handle.read()
            yield from _emit(member_name, data, budget, depth)


def _iter_with_tool(fmt: str, name: str, raw: bytes, budget: _Budget, depth: int) -> Iterator[Member]:
    """Unpack to a temporary directory with an external tool, then walk what landed."""
    work = _short_workdir()
    try:
        src = os.path.join(work, f"b.{fmt}")
        with open(src, "wb") as fh:
            fh.write(raw)
        dest = os.path.join(work, "x")
        os.makedirs(dest, exist_ok=True)
        _extract_with_tool(fmt, name, src, dest)

        root = Path(dest)
        files = sorted(p for p in root.rglob("*") if p.is_file())
        rels = [p.relative_to(root).as_posix() for p in files]
        prefix = _common_root(rels)
        for path, rel in zip(files, rels):
            if _is_noise(rel):
                continue
            member_name = _display_name(rel[len(prefix):])
            budget.check(member_name, path.stat().st_size)
            yield from _emit(member_name, path.read_bytes(), budget, depth)
    finally:
        shutil.rmtree(work, ignore_errors=True)


def _common_root(paths: List[str]) -> str:
    """The single top-level folder every member sits under, as a prefix to drop.

    Bundles are nearly always one folder deep ("07. RFI Responses/1. GIC/x.pdf"),
    and that folder repeats the archive's own name — which the row already records
    as its origin. Dropping it keeps the document names readable.
    """
    roots = {p.split("/", 1)[0] for p in paths}
    if len(roots) != 1:
        return ""
    root = next(iter(roots))
    return f"{root}/" if all(p.startswith(f"{root}/") for p in paths) else ""


def _reader(raw: bytes) -> io.BytesIO:
    """A seekable file object over the bytes (zipfile/tarfile both need to seek)."""
    return io.BytesIO(raw)


def _emit(name: str, data: bytes, budget: _Budget, depth: int) -> Iterator[Member]:
    """Yield one member — or, when the member is itself a bundle, the files inside it."""
    if not data:
        return

    nested = sniff(data) and _ext(name) not in _OFFICE_ZIP_EXTS and depth < MAX_DEPTH
    if nested:
        try:
            yield from _iter_archive(name, data, budget, depth + 1)
            return
        except ArchiveError:
            # A nested bundle that can't be read (no unpacker for it, corrupt, or
            # too deep) is stored as the file it is rather than failing the upload
            # around it — the rest of the documents still land.
            pass

    budget.spend(len(data))
    yield Member(name=name, data=data, mime=_mime_for(name))


def _iter_archive(name: str, raw: bytes, budget: _Budget, depth: int) -> Iterator[Member]:
    fmt = sniff(raw)
    if fmt == "zip":
        yield from _iter_zip(name, raw, budget, depth)
    elif fmt == "tar":
        yield from _iter_tar(name, raw, budget, depth)
    elif fmt in _TOOL_FORMATS:
        yield from _iter_with_tool(fmt, name, raw, budget, depth)
    else:
        raise ArchiveError(f"{name} is not an archive this server can unpack")


def iter_members(filename: str, raw: bytes) -> Iterator[Member]:
    """Yield every file inside an uploaded bundle, one at a time.

    Lazy on purpose: the caller stores each document as it arrives, so a 500-file
    bundle never has more than one member in memory at once.

    Raises ArchiveError when the archive can't be read — corrupt, encrypted, an
    unsupported format, or past the limits above. Callers are expected to fall back
    to storing the upload itself so nothing is ever silently lost.
    """
    budget = _Budget()
    produced = False
    for member in _iter_archive(filename, raw, budget, depth=1):
        produced = True
        yield member
    if not produced:
        raise ArchiveError(
            f"{filename} contains no readable files (it may be empty or password-protected)"
        )


def unpack_status() -> List[Tuple[str, Optional[str]]]:
    """Which external unpackers this server can see — for diagnostics/startup logs."""
    return [(tool, _find_tool(tool)) for tool in ("bsdtar", "7z", "unrar", "unar")]
