"""Claude-powered document analysis for construction / EOT claims.

Uses the official Anthropic Python SDK. The model classifies an uploaded
document and returns a structured JSON summary (what the document is about and
how it relates to an Extension-of-Time claim).
"""

import base64
import json
import os
from datetime import datetime, timezone
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


# ── Clause extraction (per project's own Clause Library) ────────────────────
# Reads a project's contract and drafts the clauses an EOT claim relies on, in
# the same shape as the project_clauses table. Output mirrors
# app.schemas.project_clause so the rows drop straight into the library.

_CLAUSES_SYSTEM_PROMPT = (
    "You are a construction-contract specialist. You are given the extracted text "
    "of a project's contract (conditions of contract — e.g. a FIDIC Red/Yellow/Silver "
    "Book or NEC4 form, plus any Particular Conditions). Extract the individual "
    "clauses and sub-clauses an Extension of Time (EOT) / delay claim would rely on — "
    "principally those covering time for completion, extension of time, delay damages, "
    "notices, claims procedure, variations, and payment.\n\n"
    "Rules:\n"
    "- Only output clauses that actually appear in the text. Do NOT invent clause "
    "numbers, titles or wording.\n"
    "- PRIORITISE the OPERATIVE clauses that grant rights and set procedures — these "
    "are what an EOT claim is built on. In FIDIC terms these are typically the "
    "Sub-Clauses under Clause 8 (Time/Extension of Time/Delay Damages), Clause 13 "
    "(Variations), Clause 14 (Payment), Clause 4 (Unforeseeable conditions) and "
    "Clause 20 (Claims/Notice procedure). For NEC4, the compensation-event and "
    "early-warning clauses.\n"
    "- Do NOT fill the list with entries from the Definitions section (e.g. FIDIC "
    "Sub-Clause 1.1 'Definition: …'). Include a definition ONLY if it is itself "
    "claim-critical (e.g. the definition of Delay Damages or Time for Completion), "
    "and never at the expense of an operative clause.\n"
    "- 'clause_number' is the exact number as written (e.g. '8.5', '20.2.1').\n"
    "- 'clause_title' is the heading as written (e.g. 'Extension of Time for Completion').\n"
    "- 'clause_description' is a concise one or two sentence plain-language summary of "
    "what the clause provides — grounded only in the text.\n"
    "- 'contract_standard' is the contract/book the clause is from (e.g. 'FIDIC Red 2017'); "
    "use the provided contract standard when given.\n"
    "- 'tags' are 2-4 short topical tags (e.g. 'EOT', 'notice', 'time-bar', 'variation').\n"
    "- Return at most ~40 clauses, ordered by how central they are to an EOT/delay claim.\n"
    "- If the text contains no usable clauses, return an empty list."
)

_CLAUSE_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "contract_standard": {"type": "string"},
        "clause_number": {"type": "string"},
        "clause_title": {"type": "string"},
        "clause_description": {"type": "string"},
        "tags": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "contract_standard", "clause_number", "clause_title",
        "clause_description", "tags",
    ],
    "additionalProperties": False,
}

_CLAUSES_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {"clauses": {"type": "array", "items": _CLAUSE_ITEM_SCHEMA}},
    "required": ["clauses"],
    "additionalProperties": False,
}


async def extract_clauses(
    *,
    text: str,
    filename: str,
    standard: str | None = None,
    project_name: str | None = None,
) -> list[dict]:
    """Draft a project's clause library from its contract text.

    Returns a list of plain dicts, one per clause, in the project_clauses shape.
    """
    ctx_bits = []
    if project_name:
        ctx_bits.append(f"Project: {project_name}")
    if standard:
        ctx_bits.append(f"Contract standard: {standard}")
    header = " | ".join(ctx_bits)

    parts = [f"Filename: {filename}"]
    if header:
        parts.append(header)
    body = text or "(no machine-readable text could be extracted from the contract)"
    parts.append(f"\n--- Contract text ---\n{body}")
    user_content = "\n".join(parts)

    async with _client().messages.stream(
        model=EXTRACTION_MODEL,
        max_tokens=8192,
        thinking={"type": "adaptive"},
        system=[
            {
                "type": "text",
                "text": _CLAUSES_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_content}],
        output_config={
            "effort": "low",
            "format": {"type": "json_schema", "schema": _CLAUSES_OUTPUT_SCHEMA},
        },
    ) as stream:
        response = await stream.get_final_message()

    payload = next((b.text for b in response.content if b.type == "text"), "")
    return json.loads(payload).get("clauses", [])


# ── Knowledge Center: standard contract book clause extraction ──────────────
# Reads a published standard form (FIDIC Red/Yellow/Silver, NEC4, …) and returns
# EVERY clause it finds, with the wording kept verbatim plus a plain-language
# summary. This differs from extract_clauses above in three ways that matter:
# it is exhaustive rather than EOT-focused, it keeps the full clause text, and it
# is called once per CHUNK of the book (a whole book's verbatim clauses do not
# fit in a single response). See services/book_clause_extraction.py.

_BOOK_SYSTEM_PROMPT = (
    "You are a contract librarian digitising a published standard form of "
    "construction contract (e.g. FIDIC Red/Yellow/Silver Book, NEC4, CPWD) into a "
    "structured reference library. You are given ONE EXCERPT of the book, in order. "
    "Extract every numbered clause and sub-clause that appears in this excerpt.\n\n"
    "Rules:\n"
    "- Be EXHAUSTIVE for this excerpt. Extract every numbered provision you see, "
    "including definitions, general conditions and procedural clauses. This is a "
    "reference library, not a claim — do not filter for relevance.\n"
    "- 'clause_number' is the number exactly as printed (e.g. '4.12', '8.5', '20.2.1').\n"
    "- 'clause_title' is the heading exactly as printed (e.g. 'Unforeseeable Physical "
    "Conditions'). If a provision has no heading, write a short descriptive one.\n"
    "- 'clause_text' is the clause's wording copied VERBATIM from the excerpt. Do not "
    "paraphrase, summarise, shorten or 'clean up' this field. Preserve sub-paragraph "
    "lettering and numbering. Omit running headers, page numbers and footers.\n"
    "- 'summary' is YOUR plain-language explanation of what the clause means and does, "
    "in two or three sentences, written for a reader who is not a lawyer. This is the "
    "only field where you paraphrase.\n"
    "- 'tags' are 2-4 short topical tags (e.g. 'EOT', 'notice', 'time-bar', 'payment').\n"
    "- The excerpt may begin or end mid-clause. If a clause's text is cut off at the "
    "START of the excerpt, SKIP it — the previous excerpt already covered it. If it is "
    "cut off at the END, still include it with the text you can see.\n"
    "- Never invent a clause number, heading or wording that is not in the excerpt. If "
    "the excerpt contains no numbered clauses (a title page, table of contents or "
    "index), return an empty list."
)

_BOOK_CLAUSE_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "clause_number": {"type": "string"},
        "clause_title": {"type": "string"},
        "clause_text": {"type": "string"},
        "summary": {"type": "string"},
        "tags": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["clause_number", "clause_title", "clause_text", "summary", "tags"],
    "additionalProperties": False,
}

_BOOK_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {"clauses": {"type": "array", "items": _BOOK_CLAUSE_ITEM_SCHEMA}},
    "required": ["clauses"],
    "additionalProperties": False,
}


async def extract_book_clauses(
    *,
    text: str,
    book_name: str,
    edition: str | None = None,
    part: int = 1,
    of: int = 1,
) -> list[dict]:
    """Extract every clause from ONE excerpt of a standard contract book.

    `part`/`of` tell the model where the excerpt sits in the book so it can judge
    the truncated-clause rule at each edge. Returns a list of plain dicts in the
    book_clauses shape: {clause_number, clause_title, clause_text, summary, tags}.
    """
    header = [f"Book: {book_name}"]
    if edition:
        header.append(f"Edition: {edition}")
    header.append(f"Excerpt {part} of {of}")

    user_content = (
        "\n".join(header)
        + f"\n\n--- Book excerpt ({part}/{of}) ---\n"
        + (text or "(empty excerpt)")
    )

    async with _client().messages.stream(
        model=EXTRACTION_MODEL,
        # Verbatim clause text is far longer than a summary, so this needs a much
        # larger budget than the EOT clause extractor above.
        max_tokens=16000,
        thinking={"type": "adaptive"},
        system=[
            {"type": "text", "text": _BOOK_SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}
        ],
        messages=[{"role": "user", "content": user_content}],
        output_config={
            "effort": "low",
            "format": {"type": "json_schema", "schema": _BOOK_OUTPUT_SCHEMA},
        },
    ) as stream:
        response = await stream.get_final_message()

    payload = next((b.text for b in response.content if b.type == "text"), "")
    return json.loads(payload).get("clauses", [])


# ── EOT claim document generation ───────────────────────────────────────────
# Assembles a full Extension of Time claim document from the project's delay
# events and data-room documents, following the standard claim structure.

_CLAIM_SYSTEM_PROMPT = (
    "You are a senior forensic delay analyst drafting a formal Extension of Time "
    "(EOT) claim document for a construction project under standards such as FIDIC, "
    "NEC4 or CPWD. You are given the project details, the register of identified "
    "delay events (with causes, dates, day impacts, narratives and chronologies), "
    "and the list of supporting documents.\n\n"
    "Write a complete, professional, submission-ready EOT claim in clearly titled "
    "sections. Use formal, factual language and only rely on the information "
    "provided — do NOT invent clause numbers, dates, parties or figures.\n\n"
    "Produce these sections in order:\n"
    "1. Project Description — brief description of the project and contract details.\n"
    "2. Executive Summary of Claim — concise summary and total EOT sought.\n"
    "3. Contractual Basis of the Claim — cite the relevant contract clauses and the "
    "parties' obligations that support entitlement.\n"
    "4. Detailed Claim Description and Background — for each delay event: a narrative, "
    "the chronology of events, the supporting evidence (reference the documents), and "
    "the impact on the works.\n"
    "5. Delay Analysis — schedule impact, critical-path impact, and delay "
    "apportionment (excusable vs culpable) across the parties.\n"
    "6. Conclusion — summary of the claim and the requested relief (the extension of "
    "time sought, and any associated cost where evidenced).\n"
    "7. Attachments — the list of supporting documents referenced.\n\n"
    "Each section's 'body' is plain text; use blank lines between paragraphs and "
    "'- ' for bullet points. If the events register is empty or thin, say so plainly "
    "in the Executive Summary rather than fabricating content."
)

_CLAIM_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "sections": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "heading": {"type": "string"},
                    "body": {"type": "string"},
                },
                "required": ["heading", "body"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["title", "sections"],
    "additionalProperties": False,
}


def _events_brief(events: list[dict]) -> str:
    """Render the delay-event register into compact text for the claim prompt."""
    if not events:
        return "(No delay events have been identified for this project.)"
    lines = []
    for e in events:
        lines.append(
            f"\n### {e.get('ref', '')} — {e.get('title', '')}\n"
            f"Category: {e.get('category', '')} | Cause: {e.get('cause', '')} | "
            f"Clause: {e.get('clause', '')} | Admissibility: {e.get('admissibility', '')}\n"
            f"Period: {e.get('startDate', '')} → {e.get('endDate', '')} | "
            f"Days impact: {e.get('daysImpact', 0)} | "
            f"Critical path: {'yes' if e.get('criticalPath') else 'no'}\n"
            f"Narrative: {e.get('narrative', '')}"
        )
        chron = e.get("chronology") or []
        if chron:
            steps = "; ".join(
                f"{c.get('date', '')} {c.get('actor', '')}: {c.get('title', '')}" for c in chron
            )
            lines.append(f"Chronology: {steps}")
        srcs = e.get("sources") or []
        if srcs:
            lines.append("Sources: " + ", ".join(s.get("name", "") for s in srcs))
    return "\n".join(lines)


async def generate_eot_claim(
    *,
    project: dict,
    events: list[dict],
    document_names: list[str],
) -> dict:
    """Draft the full EOT claim document. Returns {title, sections:[{heading, body}]}."""
    p = project or {}
    header = [
        f"Project: {p.get('name', '')}",
        f"Reference: {p.get('code', '')}",
        f"Contract standard: {p.get('standard', '')}",
        f"Employer: {p.get('employer', '')}",
        f"Engineer: {p.get('engineer', '')}",
        f"Contractor: {p.get('contractor', '')}",
        f"Location: {p.get('location', '')}",
        f"Commencement: {p.get('commencementDate', '')}",
        f"Baseline completion: {p.get('completionDate', '')}",
    ]
    docs = "\n".join(f"- {n}" for n in document_names) or "(none)"
    user_content = (
        "PROJECT DETAILS\n" + "\n".join(header)
        + "\n\nDELAY EVENTS REGISTER\n" + _events_brief(events)
        + "\n\nSUPPORTING DOCUMENTS\n" + docs
        + "\n\nDraft the Extension of Time claim now."
    )

    async with _client().messages.stream(
        model=MODEL,
        max_tokens=16000,
        thinking={"type": "adaptive"},
        system=[
            {"type": "text", "text": _CLAIM_SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}
        ],
        messages=[{"role": "user", "content": user_content}],
        output_config={
            "effort": "high",
            "format": {"type": "json_schema", "schema": _CLAIM_OUTPUT_SCHEMA},
        },
    ) as stream:
        response = await stream.get_final_message()

    payload = next((b.text for b in response.content if b.type == "text"), "")
    return json.loads(payload)


# ── Client proposal generation (costed services proposal) ───────────────────
# Produces a client-facing commercial PROPOSAL to engage the consultancy for the
# EOT / delay-claim work, with a costing breakdown derived from the identified
# delay events. This is NOT the EOT claim itself — it is the offer to the client.

# Al Qarar Management Solutions (AQMS) firm profile — the standing facts that
# every proposal is built on, drawn from AQMS's real "Claims Support Services"
# proposals so generated documents read in the firm's house style. The visual
# template is applied separately; this drives the CONTENT/structure only.
_AQMS_PROFILE = (
    "ABOUT THE FIRM — use these standing facts (do not contradict them):\n"
    "- The firm is Al Qarar Management Solutions (AQMS), a specialist provider of "
    "project-management, commercial and claims-advisory services: Contracts & "
    "Commercial Management, Project Planning, Monitoring & Controls, Forensic Delay "
    "Analysis, and Quantum Assessment, plus arbitration and expert-witness support.\n"
    "- Core values: Respect | Trust | Continual Improvement | Service.\n"
    "- Track record: over the past several years AQMS has supported 60+ clients and "
    "160+ Extension of Time (EOT) and quantum claims across the GCC, India and other "
    "regions, in buildings, infrastructure and mixed-use developments, for government "
    "entities, private developers and international EPC contractors.\n"
    "- Core services (reference list): Extension of Time Claims; Preparation of "
    "Commercial Claims; Independent Technical Evaluation; Tendering Support & "
    "Estimation; Contracts and Commercial Management; Forensic Planning and Delay "
    "Analysis; Quantum Claims (Cost/Damages); Arbitration Support and Expert Witness; "
    "Claims Documentation (Pleadings & Statements); Business Improvement and "
    "Transformation.\n"
    "- Standard team to present in 'Team Handling the Assignment': "
    "Kariyadan Nausher (PMP, ACIArb — Principal Consultant & Technical Expert; 3+ "
    "decades in Oman; Member, Society of Construction Law UK; registered Technical "
    "Expert with the Oman Commercial Arbitration Center); Hemanth Sarvabhotla "
    "(Director; 20+ years delivering large multi-disciplinary Design & Build "
    "contracts); Vamsi Krishna Valluri (MCIArb, RICS Expert Witness — Delay & Quantum, "
    "CPM/windows/time-impact analysis); Mohamed Ismail (PMP — Consultant, Planning & "
    "Controls); Ajmal Aboo (PMP — Consultant, Planning & Controls). Note the team is "
    "supported by other AQMS experts on a need basis.\n"
    "- The cover letter is signed off by 'Hemanth Sarvabhotla, Director'.\n"
    "- Governing law is the Sultanate of Oman; all fees are exclusive of VAT and any "
    "other applicable taxes."
)

_PROPOSAL_SYSTEM_PROMPT = (
    "You are the commercial lead at Al Qarar Management Solutions (AQMS) preparing a "
    "formal, submission-ready 'PROPOSAL FOR CLAIMS SUPPORT SERVICES' to a prospective "
    "CLIENT, offering to prepare and pursue their Extension of Time (EOT) and quantum / "
    "delay-and-disruption claim. You are given the project details, the register of "
    "delay events our AI has IDENTIFIED from the client's uploaded documents, and the "
    "list of those documents.\n\n"
    + _AQMS_PROFILE + "\n\n"
    "GROUND RULES:\n"
    "- The proposal must be built around the SPECIFIC delay events identified — name "
    "them, summarise them, and scope and price the work against them. This is what "
    "makes the proposal bespoke to the client.\n"
    "- Be factual and professional. Only rely on the firm profile above and the "
    "information provided; do NOT invent clause numbers, dates, parties or figures "
    "that are not given.\n"
    "- Address the client by their company name (the Employer/Client provided).\n\n"
    "Produce these narrative sections, in this order, in 'sections' (heading + body):\n"
    "1. Cover Letter — addressed to the client company, with a subject line 'Proposal "
    "for Claims Support Services', a short covering note (pleased to submit our "
    "proposal for the identified matter), and a sign-off 'Yours sincerely, Hemanth "
    "Sarvabhotla, Director'.\n"
    "2. Background & Introduction — the client's need for claims support on this "
    "project, a short AQMS introduction and track record, and the core-services list.\n"
    "3. Our Approach — the systematic claims approach (understanding the contractual "
    "framework; compilation & review of documents; in-depth study of the delay events; "
    "EOT claim preparation; quantification of damages; collaboration with experts/legal "
    "counsel; drafting the Statement of Claim; supporting documentation; final review "
    "and submission).\n"
    "4. Scope of Work & Methodology — our understanding of the scope tied to the "
    "identified delay events (contractual strategy; EOT and quantum claim; dispute-"
    "resolution support), and the methodology (initial data collection & review; delay "
    "analysis using Time Impact Analysis / As-Planned vs As-Built / windows analysis; "
    "quantum analysis; report preparation; collaboration & review; hearing "
    "preparation).\n"
    "5. Team Handling the Assignment — the standard AQMS team above, each with a short "
    "bio.\n"
    "6. Terms & Conditions — the standard headings: Service Assignment; Payment; "
    "Taxation (exclusive of VAT); Conflict of Interest; Liability (limited to fees "
    "paid); Governing Law (Sultanate of Oman); Confidentiality; Indemnification.\n\n"
    "COMMERCIAL PROPOSAL (returned as structured fields, not prose):\n"
    "- 'costing': the line items for the professional services, grouped sensibly by "
    "package/deliverable tied to the identified events (e.g. document review & claim "
    "strategy; EOT claim & quantum report per package). Each line has a short 'item', "
    "a one-line 'description', an 'timeline' (indicative, e.g. 'Week 1-3' — empty "
    "string if not applicable) and an 'amount' (a number in the project currency). "
    "Scale the effort and fees sensibly to the number and complexity of the identified "
    "delay events.\n"
    "- 'currency': the project currency. 'total': the sum of the line-item amounts.\n"
    "- 'paymentTerms': 3-5 short bullet strings for the payment schedule (e.g. advance "
    "on signing, interim on draft submission, balance on final submission), each "
    "payable within 30 days of invoice, exclusive of VAT.\n"
    "- 'reference': an AQMS proposal reference in the form 'AQMS/Proposal/<yy>/<nn>'.\n"
    "- 'date': the proposal date provided.\n\n"
    "ADMIN-PROVIDED FIELDS: the user may supply specific fields (client company, "
    "attention line, client address, subject, reference, date, signatory, a special "
    "discount, a fee basis, and free-form instructions). When provided, USE THEM "
    "EXACTLY — they take precedence over anything you would otherwise draft:\n"
    "- Put the client company, attention line and address at the top of the Cover "
    "Letter and use the given subject, reference and date.\n"
    "- Sign the Cover Letter off with the given signatory.\n"
    "- If a special discount is given, add it to 'costing' as a final line named 'Less "
    "special discount' with a NEGATIVE amount, and make 'total' the net (line items "
    "minus discount).\n"
    "- Follow any additional instructions/fee basis given.\n\n"
    "Each section 'body' is plain text; use blank lines between paragraphs and '- ' for "
    "bullets. If the identified-events register is empty, still produce a credible "
    "scoping proposal for an initial claims assessment and state that the scope and "
    "fees will be refined once the documents are reviewed."
)

_PROPOSAL_OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "reference": {"type": "string"},
        "date": {"type": "string"},
        "sections": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "heading": {"type": "string"},
                    "body": {"type": "string"},
                },
                "required": ["heading", "body"],
                "additionalProperties": False,
            },
        },
        "costing": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "item": {"type": "string"},
                    "description": {"type": "string"},
                    "timeline": {"type": "string"},
                    "amount": {"type": "number"},
                },
                "required": ["item", "description", "timeline", "amount"],
                "additionalProperties": False,
            },
        },
        "currency": {"type": "string"},
        "total": {"type": "number"},
        "paymentTerms": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "title", "reference", "date", "sections", "costing", "currency",
        "total", "paymentTerms",
    ],
    "additionalProperties": False,
}


# Admin-entered fields (key → human label) woven into the proposal prompt.
_INPUT_LABELS = {
    "clientCompany": "Client company (addressee)",
    "attention": "Attention (contact & designation)",
    "clientAddress": "Client address",
    "subject": "Subject line",
    "reference": "Proposal reference",
    "date": "Proposal date",
    "signatory": "Signatory (name & title)",
    "currency": "Currency",
    "discount": "Special discount (amount to deduct)",
    "feeBasis": "Fee basis / commercial notes",
    "notes": "Additional instructions",
}


def _admin_block(inputs: dict) -> str:
    """Render the admin-provided fields for the prompt, skipping blanks."""
    lines = []
    for key, label in _INPUT_LABELS.items():
        val = (inputs or {}).get(key)
        if val is None or str(val).strip() == "":
            continue
        lines.append(f"- {label}: {val}")
    items = (inputs or {}).get("lineItems") or []
    priced = [i for i in items if str(i.get("item", "")).strip() and str(i.get("amount", "")).strip()]
    if priced:
        lines.append(
            "- Commercial line items (USE THESE EXACT items, timelines and amounts in "
            "the Commercial Proposal — do NOT invent your own fees):"
        )
        for it in priced:
            tl = str(it.get("timeline", "")).strip()
            desc = str(it.get("description", "")).strip()
            bits = [f"  • {it['item']} — amount {it['amount']}"]
            if tl:
                bits.append(f"timeline {tl}")
            if desc:
                bits.append(desc)
            lines.append(" — ".join(bits))
    return "\n".join(lines)


async def generate_client_proposal(
    *,
    project: dict,
    events: list[dict],
    document_names: list[str],
    inputs: dict | None = None,
) -> dict:
    """Draft the costed client proposal in AQMS house style. Returns
    {title, reference, date, sections:[{heading, body}],
     costing:[{item, description, timeline, amount}], currency, total,
     paymentTerms:[...]}. `inputs` holds admin-entered fields that override
     the AI's defaults (client address, attention, reference, date, discount, …)."""
    p = project or {}
    inputs = inputs or {}
    currency = inputs.get("currency") or p.get("currency") or "OMR"
    today = str(inputs.get("date") or "").strip() or datetime.now(timezone.utc).strftime("%d %B %Y")
    header = [
        f"Proposal for: {p.get('name', '')}",
        f"Client / Employer: {p.get('employer', '')}",
        f"Reference code: {p.get('code', '')}",
        f"Contract standard: {p.get('standard', '')}",
        f"Engineer: {p.get('engineer', '')}",
        f"Contractor: {p.get('contractor', '')}",
        f"Location: {p.get('location', '')}",
        f"Currency: {currency}",
        f"Proposal date: {today}",
    ]
    docs = "\n".join(f"- {n}" for n in document_names) or "(none)"
    admin = _admin_block(inputs)
    admin_section = (
        "\n\nADMIN-PROVIDED FIELDS (use these exactly; they override your defaults)\n" + admin
        if admin
        else ""
    )
    user_content = (
        "PROPOSAL DETAILS\n" + "\n".join(header)
        + admin_section
        + "\n\nDELAY EVENTS IDENTIFIED BY AI (build the proposal around these)\n"
        + _events_brief(events)
        + "\n\nSUPPORTING DOCUMENTS\n" + docs
        + f"\n\nDraft the AQMS Claims Support Services proposal now. Price all amounts "
        f"in {currency} and date it {today}."
    )

    async with _client().messages.stream(
        model=MODEL,
        max_tokens=16000,
        thinking={"type": "adaptive"},
        system=[
            {"type": "text", "text": _PROPOSAL_SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}
        ],
        messages=[{"role": "user", "content": user_content}],
        output_config={
            "effort": "high",
            "format": {"type": "json_schema", "schema": _PROPOSAL_OUTPUT_SCHEMA},
        },
    ) as stream:
        response = await stream.get_final_message()

    payload = next((b.text for b in response.content if b.type == "text"), "")
    return json.loads(payload)
