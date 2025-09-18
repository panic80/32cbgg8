"""Utility to backfill the canonical source catalog from the existing vector store."""

import asyncio
import hashlib
from typing import Dict, Any, Optional

from app.core.vectorstore import VectorStoreManager
from app.models.source_catalog import SourceCatalogEntry
from app.services.source_repository import SourceRepository
from app.core.logging import setup_logging, get_logger
from app.core.config import settings

setup_logging(settings.log_level, settings.log_format)
logger = get_logger(__name__)


def _prepare_identifier(metadata: Dict[str, Any]) -> str:
    """Derive a stable source identifier using the same strategy as the ingestion pipeline."""
    source_value = metadata.get("source") or metadata.get("url") or metadata.get("file_path") or "direct_input"
    canonical_url = metadata.get("canonical_url")
    if not canonical_url and isinstance(source_value, str) and source_value.startswith("http"):
        canonical_url = source_value
    reference_path = metadata.get("reference_path") or metadata.get("section") or metadata.get("title")

    identifier_parts = [
        canonical_url or source_value,
        reference_path,
        metadata.get("policy_reference"),
        metadata.get("document_id"),
    ]
    seed = "|".join(str(part) for part in identifier_parts if part).strip()
    if not seed:
        seed = f"{metadata.get('type', 'unknown')}:{source_value}"
    return hashlib.sha1(seed.encode("utf-8")).hexdigest()


async def backfill() -> None:
    logger.info("Initializing vector store manager for backfill")
    vector_store_manager = VectorStoreManager()
    await vector_store_manager.initialize()

    logger.info("Loading all documents from vector store (this may take a while)...")
    documents = await asyncio.to_thread(vector_store_manager.get_all_documents, True)
    logger.info("Loaded %s documents from vector store", len(documents))

    repo = SourceRepository()
    await repo.initialize()

    entries: Dict[str, SourceCatalogEntry] = {}

    def extract_table_metadata(metadata: Dict[str, Any], content: str) -> Optional[Dict[str, Any]]:
        content_type = (metadata.get("content_type", "") or "").lower()
        if "table" not in content_type and "|" not in content:
            return None
        lines = [line for line in content.splitlines() if line.strip()]
        table_lines = [line for line in lines if "|" in line]
        if not table_lines:
            return None
        header_line = table_lines[0]
        headers = [col.strip() for col in header_line.strip("|").split("|") if col.strip()]
        sample_rows = table_lines[: min(len(table_lines), 5)]
        return {
            "headers": headers,
            "sample": "\n".join(sample_rows),
        }

    for doc in documents:
        metadata = doc.metadata or {}
        source_id = metadata.get("source_id") or _prepare_identifier(metadata)

        entry = entries.get(source_id)
        if not entry:
            entry = SourceCatalogEntry(
                source_id=source_id,
                title=metadata.get("title"),
                canonical_url=metadata.get("canonical_url") or metadata.get("source"),
                reference_path=metadata.get("reference_path") or metadata.get("section"),
                document_type=str(metadata.get("type")) if metadata.get("type") else None,
                section=metadata.get("section"),
                metadata={
                    "source": metadata.get("source"),
                    "policy_reference": metadata.get("policy_reference"),
                    "page_number": metadata.get("page_number"),
                    "tags": metadata.get("tags", []),
                },
            )
            entries[source_id] = entry

        chunk_id = metadata.get("id")
        parent_id = metadata.get("parent_id")
        entry.register_chunk(str(chunk_id) if chunk_id else None, str(parent_id) if parent_id else None)
        table_meta = extract_table_metadata(metadata, doc.page_content)
        if table_meta:
            entry.metadata.setdefault("has_table", True)
            tables = entry.metadata.setdefault("tables", [])
            if len(tables) < 5:
                tables.append(table_meta)

    if not entries:
        logger.info("No source entries discovered during backfill. Nothing to update.")
        return

    logger.info("Persisting %s source entries to repository", len(entries))
    await repo.upsert_entries(entries.values())
    stats = await repo.get_statistics()
    logger.info("Backfill complete. Catalog now tracks %s sources and %s chunks.", stats.get("total_sources"), stats.get("total_chunks"))


if __name__ == "__main__":
    asyncio.run(backfill())
