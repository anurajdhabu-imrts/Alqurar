"""Claude-powered document analysis for construction / EOT claims.

Uses the official Anthropic Python SDK. The model classifies an uploaded
document and returns a structured JSON summary (what the document is about and
how it relates to an Extension-of-Time claim).
"""

import base64
import json
import os
from functools import lru_cache
from pathlib import Path

import anthropic
from dotenv import load_dotenv

from app.schemas.document import DocumentAnalysis

# Load apps/backend/.env explicitly (works regardless of the working directory)
# so ANTHROPIC_API_KEY / ANTHROPIC_MODEL are available.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

# Default to the most capable model; override with ANTHROPIC_MODEL if desired
# (e.g. "claude-sonnet-4-6" for lower cost on high volume). Used for the heavier
# delay-event extraction (reasoning over the whole data room).
MODEL = os.getenv("ANTHROPIC_MODEL", "claude-opus-4-8")

# Per-document classification is a simple, high-volume task — default to the fast,
# cheap Haiku tier (no extended thinking) so hundreds of documents process quickly.
# Override with ANTHROPIC_ANALYSIS_MODEL (e.g. "claude-sonnet-4-6") for more depth.
ANALYSIS_MODEL = os.getenv("ANTHROPIC_ANALYSIS_MODEL", "claude-haiku-4-5")

# Delay-event extraction needs reasoning but should still be reasonably fast —
# default to Sonnet 4.6. Override with ANTHROPIC_EXTRACTION_MODEL (e.g.
# "claude-opus-4-8" for maximum depth, "claude-haiku-4-5" for maximum speed).
EXTRACTION_MODEL = os.getenv("ANTHROPIC_EXTRACTION_MODEL", "claude-sonnet-4-6")

# Stable instructions — cached as a prompt prefix so repeated calls are cheaper.
SYSTEM_PROMPT = (
    "You are a construction claims analyst supporting Extension of Time (EOT) and "
    "delay/disruption claims under standards such as FIDIC, NEC4 and CPWD. You are "
    "given the extracted text of a single document uploaded to a claim file. Your job "
    "is to classify the document and explain, in plain professional language, what it "
    "is about and how it may be relevant to an EOT claim.\n\n"
    "Rules:\n"
    "- Be specific and factual. Only use information present in the document text.\n"
    "- Do NOT invent clause numbers, dates, parties or figures that are not in the text.\n"
    "- If the text is empty or insufficient, infer cautiously from the filename and "
    "lower your confidence accordingly.\n"
    "- 'document_type' should be a concise category, e.g. 'Engineer's Instruction', "
    "'Site Access Programme', 'Daily Site Diary', 'Correspondence / Letter', "
    "'Baseline Programme', 'Variation Order', 'Notice of Claim', 'Meeting Minutes', "
    "'Payment Application', 'Drawing / Drawing Register' or 'Other'.\n"
    "- 'relevance_to_claim' should state, in one or two sentences, how this document "
    "supports or undermines an EOT/delay claim (e.g. evidences an employer-caused "
    "delay, establishes a contractual notice, records a critical-path activity).\n"
    "- 'confidence' is an integer 0-100 reflecting how confident you are overall."
)

# JSON schema mirroring app.schemas.document.DocumentAnalysis (structured outputs).
_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "document_type": {"type": "string"},
        "title": {"type": "string"},
        "summary": {"type": "string"},
        "relevance_to_claim": {"type": "string"},
        "supports_eot": {"type": "boolean"},
        "key_points": {"type": "array", "items": {"type": "string"}},
        "parties": {"type": "array", "items": {"type": "string"}},
        "key_dates": {"type": "array", "items": {"type": "string"}},
        "confidence": {"type": "integer"},
    },
    "required": [
        "document_type",
        "title",
        "summary",
        "relevance_to_claim",
        "supports_eot",
        "key_points",
        "parties",
        "key_dates",
        "confidence",
    ],
    "additionalProperties": False,
}


@lru_cache(maxsize=1)
def _client() -> anthropic.AsyncAnthropic:
    # Resolves ANTHROPIC_API_KEY from the environment.
    return anthropic.AsyncAnthropic()


# ── OCR (for scanned PDFs / images) ─────────────────────────────────────────
# Uses Claude's native vision: the file is sent as a document/image block and the
# model transcribes it. No external OCR engine/binary needed. Bounded by the API's
# 32 MB request limit, so very large files are skipped (caller keeps the empty text).
_OCR_MAX_BYTES = 24 * 1024 * 1024  # safe headroom under the 32 MB request limit
MAX_OCR_CHARS = 60_000             # bound transcription length (token budget)
_IMAGE_MEDIA = {
    "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
    "gif": "image/gif", "webp": "image/webp",
}


async def ocr_document(raw: bytes, filename: str, mime: str | None = None) -> str:
    """Transcribe a scanned PDF or image to plain text via Claude vision.

    Returns "" if the file is too large, an unsupported type, or OCR fails — the
    caller then falls back to filename-only classification.
    """
    if not raw or len(raw) > _OCR_MAX_BYTES:
        return ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    b64 = base64.standard_b64encode(raw).decode("ascii")

    if ext == "pdf":
        file_block = {
            "type": "document",
            "source": {"type": "base64", "media_type": "application/pdf", "data": b64},
        }
    elif ext in _IMAGE_MEDIA:
        file_block = {
            "type": "image",
            "source": {"type": "base64", "media_type": _IMAGE_MEDIA[ext], "data": b64},
        }
    else:
        return ""

    instruction = (
        "Transcribe ALL text in this document verbatim as plain text, preserving "
        "reading order and tables as best you can. Output only the transcription, "
        "with no commentary."
    )

    try:
        async with _client().messages.stream(
            model=ANALYSIS_MODEL,
            max_tokens=8000,
            messages=[{"role": "user", "content": [file_block, {"type": "text", "text": instruction}]}],
        ) as stream:
            response = await stream.get_final_message()
    except Exception:
        return ""

    text = "".join(b.text for b in response.content if b.type == "text").strip()
    return text[:MAX_OCR_CHARS]


def _build_user_content(text: str, filename: str, truncated: bool, claim_context: str) -> str:
    parts = [f"Filename: {filename}"]
    if claim_context:
        parts.append(claim_context)
    if text:
        note = " (truncated)" if truncated else ""
        parts.append(f"\n--- Extracted document text{note} ---\n{text}")
    else:
        parts.append(
            "\n(No machine-readable text could be extracted — classify from the "
            "filename and lower your confidence.)"
        )
    return "\n".join(parts)


async def analyze_document(
    *,
    text: str,
    filename: str,
    truncated: bool,
    claim_ref: str | None = None,
    claim_title: str | None = None,
    standard: str | None = None,
) -> DocumentAnalysis:
    """Classify and summarise a document via Claude; returns a validated model."""
    ctx_bits = []
    if claim_ref:
        ctx_bits.append(f"Associated claim: {claim_ref}")
    if claim_title:
        ctx_bits.append(f"Claim subject: {claim_title}")
    if standard:
        ctx_bits.append(f"Contract standard: {standard}")
    claim_context = " | ".join(ctx_bits)

    user_content = _build_user_content(text, filename, truncated, claim_context)

    # Classification is simple — run it on the fast model with no extended thinking
    # and no effort knob (Haiku doesn't take `effort`). Structured output guarantees
    # the JSON shape. This keeps per-document latency and cost low at scale.
    response = await _client().messages.create(
        model=ANALYSIS_MODEL,
        max_tokens=2048,
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_content}],
        output_config={
            "format": {"type": "json_schema", "schema": _OUTPUT_SCHEMA},
        },
    )

    # With output_config.format, the JSON is guaranteed in the text block.
    payload = next((b.text for b in response.content if b.type == "text"), "")
    return DocumentAnalysis(**json.loads(payload))


# ── Delay-event extraction ──────────────────────────────────────────────────
# Reads the project's data-room documents and drafts a register of delay events
# for an EOT claim. Output mirrors app.schemas.delay_event so the events drop
# straight into the same table the analyst reviews.

_EVENTS_SYSTEM_PROMPT = (
    "You are a forensic delay analyst building an Extension of Time (EOT) claim "
    "under standards such as FIDIC, NEC4 and CPWD. You are given the extracted "
    "text of the documents uploaded to a project's data room. Identify discrete "
    "delay events evidenced by these documents.\n\n"
    "Rules:\n"
    "- Only assert events that the document text actually supports. Do NOT invent "
    "events, dates, clause numbers, parties or figures that are not present.\n"
    "- If the documents contain no evidence of any delay event, return an empty list.\n"
    "- 'cause' attributes responsibility: 'Employer' (incl. Engineer), "
    "'Contractor', 'Concurrent', 'Force Majeure', or 'Neutral'.\n"
    "- 'admissibility' is your view of whether the event would succeed as an EOT "
    "claim: 'Likely admissible', 'At risk', 'Inadmissible', or 'Not assessed'.\n"
    "- 'daysImpact' is the integer number of days of delay; 0 if unknown.\n"
    "- 'startDate'/'endDate' use ISO format (YYYY-MM-DD); empty string if unknown.\n"
    "- 'sourceDocuments' lists the exact filenames (from those provided) that "
    "evidence the event.\n"
    "- 'chronology' is the ordered sequence of correspondence/site events; each "
    "actor is 'Contractor', 'Engineer', 'Employer' or 'System'.\n"
    "- 'aiConfidence' is an integer 0-100 for how well the documents support the event."
)

_EVENT_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "category": {"type": "string"},
        "narrative": {"type": "string"},
        "cause": {
            "type": "string",
            "enum": ["Employer", "Contractor", "Concurrent", "Force Majeure", "Neutral"],
        },
        "clause": {"type": "string"},
        "startDate": {"type": "string"},
        "endDate": {"type": "string"},
        "daysImpact": {"type": "integer"},
        "criticalPath": {"type": "boolean"},
        "admissibility": {
            "type": "string",
            "enum": ["Likely admissible", "At risk", "Inadmissible", "Not assessed"],
        },
        "aiConfidence": {"type": "integer"},
        "sourceDocuments": {"type": "array", "items": {"type": "string"}},
        "chronology": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "date": {"type": "string"},
                    "actor": {
                        "type": "string",
                        "enum": ["Contractor", "Engineer", "Employer", "System"],
                    },
                    "title": {"type": "string"},
                    "detail": {"type": "string"},
                },
                "required": ["date", "actor", "title", "detail"],
                "additionalProperties": False,
            },
        },
    },
    "required": [
        "title", "category", "narrative", "cause", "clause", "startDate", "endDate",
        "daysImpact", "criticalPath", "admissibility", "aiConfidence",
        "sourceDocuments", "chronology",
    ],
    "additionalProperties": False,
}

_EVENTS_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {"events": {"type": "array", "items": _EVENT_ITEM_SCHEMA}},
    "required": ["events"],
    "additionalProperties": False,
}


async def extract_delay_events(
    *,
    documents: list[dict],
    standard: str | None = None,
    project_name: str | None = None,
) -> list[dict]:
    """Draft a register of delay events from the project's documents.

    `documents` is a list of {"name", "type", "text", "truncated"} dicts. Returns
    a list of plain dicts (one per event) with the AI's structured fields plus the
    raw `sourceDocuments` filenames — the caller maps those to source records.
    """
    ctx_bits = []
    if project_name:
        ctx_bits.append(f"Project: {project_name}")
    if standard:
        ctx_bits.append(f"Contract standard: {standard}")
    header = " | ".join(ctx_bits)

    blocks = [header] if header else []
    for d in documents:
        name = d.get("name", "document")
        note = " (truncated)" if d.get("truncated") else ""
        body = d.get("text") or "(no machine-readable text — classify from the filename)"
        blocks.append(f"\n===== Document: {name} [{d.get('type', 'Other')}]{note} =====\n{body}")
    user_content = "\n".join(blocks)

    # Stream so a long generation doesn't hit the SDK's non-streaming timeout, and
    # use adaptive thinking at low effort for a good speed/quality balance.
    async with _client().messages.stream(
        model=EXTRACTION_MODEL,
        max_tokens=8192,
        thinking={"type": "adaptive"},
        system=[
            {
                "type": "text",
                "text": _EVENTS_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_content}],
        output_config={
            "effort": "low",
            "format": {"type": "json_schema", "schema": _EVENTS_OUTPUT_SCHEMA},
        },
    ) as stream:
        response = await stream.get_final_message()

    payload = next((b.text for b in response.content if b.type == "text"), "")
    data = json.loads(payload)
    return data.get("events", [])
