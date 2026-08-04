"""Fill in the interpretation of PCC amendments for clauses that predate it.

A PCC comparison (and a full-contract extraction) now writes an `interpretation`
alongside each modification — what the amendment means in practice for a claim.
Clauses amended before that field existed have the base wording, the amendment
note and the amended wording stored but no interpretation; this module writes it
for them without re-running the whole comparison, since no document is needed.

Clauses are sent in small batches so one oversized request can't be cut off, and
batches run concurrently under the same modest cap as the other AI jobs.
"""
import asyncio
import logging
import os
from typing import Dict, List

from app.services import project_clause_service, project_service
from app.services.ai_service import interpret_modifications

logger = logging.getLogger(__name__)

# Clauses per model call. Small enough that a batch always fits the output
# budget, large enough that a 139-clause project is a handful of calls.
_BATCH = 20
_CONCURRENCY = int(os.getenv("CLAUSE_EXTRACTION_CONCURRENCY", "2"))


def _chunks(items: List[Dict], size: int) -> List[List[Dict]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


async def run_backfill(project_id: str) -> int:
    """Write interpretations for this project's modified clauses missing one.

    Returns how many clauses were filled. A batch that fails is logged and
    skipped so the rest still land.
    """
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise RuntimeError(
            "AI analysis is not configured — set ANTHROPIC_API_KEY in apps/backend/.env."
        )

    pending = await asyncio.to_thread(
        project_clause_service.list_modified_without_interpretation, project_id
    )
    if not pending:
        return 0
    project = await asyncio.to_thread(project_service.get_project, project_id)
    standard = (project or {}).get("standard")

    sem = asyncio.Semaphore(_CONCURRENCY)

    async def one(batch: List[Dict]) -> Dict[str, str]:
        async with sem:
            try:
                return await interpret_modifications(clauses=batch, standard=standard)
            except Exception as e:  # noqa: BLE001 — one bad batch must not sink the rest
                logger.warning(
                    "Interpretation backfill: batch of %d failed for project=%s: %s",
                    len(batch), project_id, e,
                )
                return {}

    results = await asyncio.gather(*(one(b) for b in _chunks(pending, _BATCH)))
    merged: Dict[str, str] = {}
    for r in results:
        merged.update(r)

    filled = await asyncio.to_thread(
        project_clause_service.set_interpretations, project_id, merged
    )
    logger.info(
        "Interpretation backfill: project=%s pending=%d filled=%d",
        project_id, len(pending), filled,
    )
    return filled
