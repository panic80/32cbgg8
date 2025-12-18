"""Script to rebuild BM25 index and save to disk."""

import asyncio
from app.services.bm25 import rebuild_bm25_index
from app.core.logging import get_logger

logger = get_logger(__name__)

if __name__ == "__main__":
    asyncio.run(rebuild_bm25_index())