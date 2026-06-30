"""Extract plain text from uploaded construction documents.

Supports PDF (PyMuPDF, falling back to pypdf), Word (.docx, python-docx),
PowerPoint (.pptx, python-pptx), Excel (.xlsx, openpyxl) and plain-text formats.
Image files and image-only ("scanned") PDFs yield no embedded text here — those
are handled by OCR (see app.services.ai_service.ocr_document). Anything else falls
back to the filename only, so the AI can still classify from the name.
"""

import io

# Keep extracted text bounded so a huge file can't blow up the token bill.
MAX_CHARS = 60_000
# Cap pages parsed from a PDF — a large or scanned PDF can otherwise take a long
# time for little useful text. MAX_CHARS is reached long before this for text PDFs.
MAX_PDF_PAGES = 200

_TEXT_EXTS = {"txt", "md", "csv", "log", "xml", "json", "rtf"}
_IMAGE_EXTS = {"png", "jpg", "jpeg", "tif", "tiff", "webp", "gif", "bmp"}


def _ext(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def is_ocr_candidate(filename: str) -> bool:
    """True for formats whose text may need OCR (PDF or image)."""
    ext = _ext(filename)
    return ext == "pdf" or ext in _IMAGE_EXTS


def _extract_pdf(raw: bytes) -> str:
    """Fast PDF text extraction via PyMuPDF, with a pypdf fallback."""
    try:
        import fitz  # PyMuPDF

        parts, total = [], 0
        with fitz.open(stream=raw, filetype="pdf") as doc:
            for page in doc[:MAX_PDF_PAGES] if len(doc) > MAX_PDF_PAGES else doc:
                page_text = page.get_text("text") or ""
                parts.append(page_text)
                total += len(page_text)
                if total >= MAX_CHARS:
                    break
        return "\n".join(parts)
    except Exception:
        # Fallback to pypdf if PyMuPDF isn't available or chokes on the file.
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(raw))
        parts, total = [], 0
        for page in reader.pages[:MAX_PDF_PAGES]:
            page_text = page.extract_text() or ""
            parts.append(page_text)
            total += len(page_text)
            if total >= MAX_CHARS:
                break
        return "\n".join(parts)


def extract_text(filename: str, raw: bytes) -> tuple[str, bool]:
    """Return (text, truncated). `text` is "" when the format isn't extractable
    (e.g. an image, or a scanned PDF with no embedded text → handled by OCR)."""
    ext = _ext(filename)
    text = ""

    try:
        if ext == "pdf":
            text = _extract_pdf(raw)
        elif ext in ("docx", "doc"):
            import docx

            document = docx.Document(io.BytesIO(raw))
            text = "\n".join(p.text for p in document.paragraphs)
        elif ext == "pptx":
            from pptx import Presentation

            prs = Presentation(io.BytesIO(raw))
            chunks = []
            for slide in prs.slides:
                for shape in slide.shapes:
                    if shape.has_text_frame:
                        chunks.append(shape.text_frame.text)
                    if shape.has_table:
                        for row in shape.table.rows:
                            chunks.append(" | ".join(c.text for c in row.cells))
            text = "\n".join(c for c in chunks if c)
        elif ext in ("xlsx", "xlsm"):
            from openpyxl import load_workbook

            wb = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
            rows = []
            for ws in wb.worksheets:
                rows.append(f"# Sheet: {ws.title}")
                for row in ws.iter_rows(values_only=True):
                    cells = [str(c) for c in row if c is not None]
                    if cells:
                        rows.append(" | ".join(cells))
            text = "\n".join(rows)
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
