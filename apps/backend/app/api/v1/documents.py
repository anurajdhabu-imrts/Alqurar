import os

import anthropic
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.api.v1.deps import get_current_user
from app.schemas.document import DocumentAnalysisOut
from app.services.ai_service import ANALYSIS_MODEL, analyze_document
from app.services.document_extract import extract_text

_NOT_CONFIGURED = (
    "AI analysis is not configured — set ANTHROPIC_API_KEY in apps/backend/.env "
    "and restart the backend."
)

router = APIRouter()

# Guard against pathological uploads (15 MB).
MAX_UPLOAD_BYTES = 15 * 1024 * 1024


@router.post("/analyze", response_model=DocumentAnalysisOut)
async def analyze_uploaded_document(
    file: UploadFile = File(...),
    claim_ref: str | None = Form(None),
    claim_title: str | None = Form(None),
    standard: str | None = Form(None),
    _=Depends(get_current_user),
):
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 15 MB limit.")

    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail=_NOT_CONFIGURED)

    filename = file.filename or "document"
    text, truncated = extract_text(filename, raw)

    try:
        analysis = await analyze_document(
            text=text,
            filename=filename,
            truncated=truncated,
            claim_ref=claim_ref,
            claim_title=claim_title,
            standard=standard,
        )
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=503, detail=_NOT_CONFIGURED)
    except anthropic.APIStatusError as e:
        raise HTTPException(status_code=502, detail=f"AI provider error ({e.status_code}).")
    except anthropic.APIConnectionError:
        raise HTTPException(status_code=502, detail="Could not reach the AI provider.")
    except Exception as e:
        # Includes the SDK's "Could not resolve authentication method" at client init.
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {e}")

    return DocumentAnalysisOut(
        **analysis.model_dump(),
        filename=filename,
        extracted_chars=len(text),
        truncated=truncated,
        model=ANALYSIS_MODEL,
    )
