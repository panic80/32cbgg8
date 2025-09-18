"""Compare source catalog stats against the vector store to highlight drift."""

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from datetime import datetime

from app.core.config import settings
from app.core.vectorstore import VectorStoreManager
from app.services.source_repository import SourceRepository
from app.core.logging import setup_logging, get_logger

setup_logging(settings.log_level, settings.log_format)
logger = get_logger(__name__)


async def gather_health_report() -> None:
    logger.info("Starting source catalog health check")

    vector_store_manager = VectorStoreManager()
    await vector_store_manager.initialize()

    repo = SourceRepository()
    await repo.initialize()

    catalog_stats = await repo.get_statistics()
    vector_docs = await asyncio.to_thread(vector_store_manager.get_all_documents, False)
    vector_doc_count = len(vector_docs)

    catalog_count = catalog_stats.get("total_chunks", 0)
    doc_delta = vector_doc_count - catalog_count

    logger.info("Vector store chunks: %s", vector_doc_count)
    logger.info("Catalog chunks: %s", catalog_count)
    if doc_delta == 0:
        logger.info("Catalog and vector store are in sync.")
    else:
        logger.warning("Chunk count delta detected: %s", doc_delta)

    logger.info("Catalog sources: %s", catalog_stats.get("total_sources", 0))
    logger.info("Catalog documents: %s", catalog_stats.get("total_documents", 0))
    logger.info("Last ingestion: %s", catalog_stats.get("last_ingested_at"))


if __name__ == "__main__":
    asyncio.run(gather_health_report())
