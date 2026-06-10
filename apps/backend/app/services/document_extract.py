"""Extract plain text from uploaded construction documents.

Supports PDF (pypdf), Word (.docx, python-docx) and plain-text formats. Other
formats fall back to the filename only — the AI can still classify from the name.
"""

import io

# Keep extracted text bounded so a huge file can't blow up the token bill.
MAX_CHARS = 60_000

_TEXT_EXTS = {"txt", "md", "csv", "log", "xml", "json", "rtf"}


def _ext(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def extract_text(filename: str, raw: bytes) -> tuple[str, bool]:
    """Return (text, truncated). `text` is "" when the format isn't extractable."""
    ext = _ext(filename)
    text = ""

    try:
        if ext == "pdf":
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(raw))
            text = "\n".join((page.extract_text() or "") for page in reader.pages)
        elif ext in ("docx", "doc"):
            import docx

            document = docx.Document(io.BytesIO(raw))
            text = "\n".join(p.text for p in document.paragraphs)
        elif ext in _TEXT_EXTS:
            text = raw.decode("utf-8", errors="replace")
    except Exception:
        # Corrupt/unsupported encoding — fall back to filename-only analysis.
        text = ""

    text = text.strip()
    truncated = len(text) > MAX_CHARS
    if truncated:
        text = text[:MAX_CHARS]
    return text, truncated
