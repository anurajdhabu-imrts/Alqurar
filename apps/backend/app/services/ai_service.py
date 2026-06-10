"""Claude-powered document analysis for construction / EOT claims.

Uses the official Anthropic Python SDK. The model classifies an uploaded
document and returns a structured JSON summary (what the document is about and
how it relates to an Extension-of-Time claim).
"""

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
# (e.g. "claude-sonnet-4-6" for lower cost on high volume).
MODEL = os.getenv("ANTHROPIC_MODEL", "claude-opus-4-8")

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

    response = await _client().messages.create(
        model=MODEL,
        max_tokens=2048,
        thinking={"type": "adaptive"},
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_content}],
        output_config={
            "effort": "low",
            "format": {"type": "json_schema", "schema": _OUTPUT_SCHEMA},
        },
    )

    # With output_config.format, the JSON is guaranteed in the text block.
    payload = next((b.text for b in response.content if b.type == "text"), "")
    return DocumentAnalysis(**json.loads(payload))
