#!/usr/bin/env python3
"""
Chunking Configuration Comparison Test

Compares retrieval quality between different chunk size/overlap configurations.
Runs the same test queries against both configurations and reports metrics.

Usage:
    python scripts/chunking_comparison.py [--rag-url URL] [--skip-ingestion]
"""

import argparse
import asyncio
import json
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
import httpx

# Default RAG service URL
DEFAULT_RAG_URL = "http://localhost:8000"
DEFAULT_ADMIN_TOKEN = "changeme-admin-token"

# Test configurations to compare
CONFIGS = {
    "A": {"chunk_size": 1024, "chunk_overlap": 250, "label": "1024/250 (current)"},
    "B": {"chunk_size": 512, "chunk_overlap": 100, "label": "512/100 (tighter)"},
}

# Test queries covering different types of CFTDI content
TEST_QUERIES = [
    # Specific rate lookups
    "What is the meal rate for breakfast in Canada?",
    "What is the kilometric rate for a privately owned vehicle?",
    "What is the incidental expense allowance rate?",

    # Entitlement questions
    "Am I entitled to meal expenses on a day trip?",
    "When can I claim accommodation expenses?",
    "What are the conditions for claiming travel time?",

    # Process/procedure questions
    "How do I submit a travel claim?",
    "What documentation is required for travel expenses?",
    "How are travel advances processed?",

    # Definition/explanation questions
    "What is considered temporary duty travel?",
    "What is the definition of a traveller's headquarters?",
    "What does dependant relocation cover?",

    # Complex scenario questions
    "Can I claim meals if I return home the same day?",
    "What expenses are covered for a 3-day conference?",
    "How are weekend travel expenses handled?",
]


@dataclass
class IngestionMetrics:
    """Metrics from document ingestion."""
    chunks_created: int = 0
    ingestion_time_seconds: float = 0.0
    avg_chunk_size: float = 0.0
    documents_processed: int = 0


@dataclass
class QueryResult:
    """Result from a single query."""
    query: str
    top_scores: List[float] = field(default_factory=list)
    avg_score: float = 0.0
    num_sources: int = 0
    latency_ms: float = 0.0
    error: Optional[str] = None


@dataclass
class ConfigResults:
    """Results for a single configuration."""
    config_name: str
    config_label: str
    chunk_size: int
    chunk_overlap: int
    ingestion: IngestionMetrics = field(default_factory=IngestionMetrics)
    query_results: List[QueryResult] = field(default_factory=list)

    @property
    def avg_relevance_score(self) -> float:
        scores = [r.avg_score for r in self.query_results if r.avg_score > 0]
        return sum(scores) / len(scores) if scores else 0.0

    @property
    def avg_query_latency_ms(self) -> float:
        latencies = [r.latency_ms for r in self.query_results if r.latency_ms > 0]
        return sum(latencies) / len(latencies) if latencies else 0.0


class ChunkingComparison:
    """Main comparison test runner."""

    def __init__(self, rag_url: str, admin_token: str):
        self.rag_url = rag_url.rstrip("/")
        self.admin_token = admin_token
        self.client = httpx.AsyncClient(timeout=120.0)

    async def close(self):
        await self.client.aclose()

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.admin_token}",
            "Content-Type": "application/json",
        }

    async def update_chunk_config(self, chunk_size: int, chunk_overlap: int) -> bool:
        """Update chunking configuration via admin API."""
        print(f"  Setting chunk_size={chunk_size}, chunk_overlap={chunk_overlap}")

        try:
            response = await self.client.post(
                f"{self.rag_url}/api/v1/admin/config/update",
                headers=self._headers(),
                json={
                    "config_updates": {
                        "chunk_size": chunk_size,
                        "chunk_overlap": chunk_overlap,
                    }
                },
            )
            response.raise_for_status()
            result = response.json()
            print(f"  Config updated: {result.get('updated', [])}")
            return True
        except Exception as e:
            print(f"  Error updating config: {e}")
            return False

    async def purge_database(self) -> bool:
        """Purge all documents from vector database."""
        print("  Purging database...")

        try:
            response = await self.client.post(
                f"{self.rag_url}/api/v1/database/purge",
                headers=self._headers(),
            )
            response.raise_for_status()
            result = response.json()
            print(f"  Database purged: {result.get('message', 'success')}")
            return True
        except Exception as e:
            print(f"  Error purging database: {e}")
            return False

    async def ingest_documents(self, url: str) -> IngestionMetrics:
        """Ingest documents and return metrics."""
        print(f"  Ingesting from: {url}")
        metrics = IngestionMetrics()

        start_time = time.time()
        try:
            response = await self.client.post(
                f"{self.rag_url}/api/v1/ingest",
                headers=self._headers(),
                json={
                    "url": url,
                    "force_refresh": True,
                },
            )
            response.raise_for_status()
            result = response.json()

            metrics.ingestion_time_seconds = time.time() - start_time
            metrics.chunks_created = result.get("chunks_created", 0)
            metrics.documents_processed = 1

            print(f"  Ingested: {metrics.chunks_created} chunks in {metrics.ingestion_time_seconds:.1f}s")

        except Exception as e:
            print(f"  Error ingesting: {e}")
            metrics.ingestion_time_seconds = time.time() - start_time

        return metrics

    async def get_database_stats(self) -> Dict[str, Any]:
        """Get current database statistics."""
        try:
            response = await self.client.get(
                f"{self.rag_url}/api/v1/sources/stats",
                headers=self._headers(),
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"  Error getting stats: {e}")
            return {}

    async def run_query(self, query: str) -> QueryResult:
        """Run a single retrieval query and collect metrics."""
        result = QueryResult(query=query)

        start_time = time.time()
        try:
            # Use sources/search for direct retrieval scores
            response = await self.client.post(
                f"{self.rag_url}/api/v1/sources/search",
                headers=self._headers(),
                json={
                    "query": query,
                    "k": 5,  # Top 5 results
                },
            )
            response.raise_for_status()
            data = response.json()

            result.latency_ms = (time.time() - start_time) * 1000

            # Extract scores from results
            if isinstance(data, list):
                scores = [item.get("score", 0) for item in data if item.get("score")]
                result.top_scores = scores[:5]
                result.avg_score = sum(scores) / len(scores) if scores else 0
                result.num_sources = len(data)

        except Exception as e:
            result.error = str(e)
            result.latency_ms = (time.time() - start_time) * 1000

        return result

    async def run_all_queries(self, queries: List[str]) -> List[QueryResult]:
        """Run all test queries sequentially."""
        results = []
        for i, query in enumerate(queries, 1):
            print(f"  Query {i}/{len(queries)}: {query[:50]}...")
            result = await self.run_query(query)
            if result.error:
                print(f"    Error: {result.error}")
            else:
                print(f"    Avg score: {result.avg_score:.3f}, Sources: {result.num_sources}, Latency: {result.latency_ms:.0f}ms")
            results.append(result)
            await asyncio.sleep(0.5)  # Rate limiting
        return results

    async def run_config_test(
        self,
        config_name: str,
        config: Dict[str, Any],
        ingest_url: Optional[str],
        queries: List[str],
    ) -> ConfigResults:
        """Run complete test for a single configuration."""
        results = ConfigResults(
            config_name=config_name,
            config_label=config["label"],
            chunk_size=config["chunk_size"],
            chunk_overlap=config["chunk_overlap"],
        )

        print(f"\n{'='*60}")
        print(f"Testing Config {config_name}: {config['label']}")
        print(f"{'='*60}")

        # Update configuration
        print("\n[1/4] Updating chunk configuration...")
        await self.update_chunk_config(config["chunk_size"], config["chunk_overlap"])

        # Purge existing data
        print("\n[2/4] Purging database...")
        await self.purge_database()
        await asyncio.sleep(2)  # Wait for purge to complete

        # Ingest documents
        if ingest_url:
            print("\n[3/4] Ingesting documents...")
            results.ingestion = await self.ingest_documents(ingest_url)
            await asyncio.sleep(2)  # Wait for indexing
        else:
            print("\n[3/4] Skipping ingestion (--skip-ingestion)")

        # Get database stats
        stats = await self.get_database_stats()
        if stats:
            results.ingestion.chunks_created = stats.get("total_chunks", results.ingestion.chunks_created)

        # Run queries
        print("\n[4/4] Running test queries...")
        results.query_results = await self.run_all_queries(queries)

        return results


def print_comparison_report(results_a: ConfigResults, results_b: ConfigResults):
    """Print formatted comparison report."""
    print("\n")
    print("=" * 70)
    print("           CHUNKING COMPARISON RESULTS")
    print("=" * 70)

    # Configuration summary
    print(f"\n{'Configuration Summary':^70}")
    print("-" * 70)
    print(f"{'Metric':<30} {'Config A':<20} {'Config B':<20}")
    print("-" * 70)
    print(f"{'Label':<30} {results_a.config_label:<20} {results_b.config_label:<20}")
    print(f"{'Chunk Size':<30} {results_a.chunk_size:<20} {results_b.chunk_size:<20}")
    print(f"{'Chunk Overlap':<30} {results_a.chunk_overlap:<20} {results_b.chunk_overlap:<20}")
    print(f"{'Chunks Created':<30} {results_a.ingestion.chunks_created:<20} {results_b.ingestion.chunks_created:<20}")
    print(f"{'Ingestion Time (s)':<30} {results_a.ingestion.ingestion_time_seconds:<20.1f} {results_b.ingestion.ingestion_time_seconds:<20.1f}")

    # Query results comparison
    print(f"\n{'Query Results':^70}")
    print("-" * 70)
    print(f"{'Query':<40} {'A Score':<15} {'B Score':<15}")
    print("-" * 70)

    for ra, rb in zip(results_a.query_results, results_b.query_results):
        query_short = ra.query[:37] + "..." if len(ra.query) > 40 else ra.query
        score_a = f"{ra.avg_score:.3f}" if ra.avg_score > 0 else "N/A"
        score_b = f"{rb.avg_score:.3f}" if rb.avg_score > 0 else "N/A"

        # Highlight winner
        if ra.avg_score > rb.avg_score and ra.avg_score > 0:
            score_a = f"{score_a} *"
        elif rb.avg_score > ra.avg_score and rb.avg_score > 0:
            score_b = f"{score_b} *"

        print(f"{query_short:<40} {score_a:<15} {score_b:<15}")

    # Summary statistics
    print("-" * 70)
    avg_a = results_a.avg_relevance_score
    avg_b = results_b.avg_relevance_score
    lat_a = results_a.avg_query_latency_ms
    lat_b = results_b.avg_query_latency_ms

    print(f"{'AVERAGE RELEVANCE SCORE':<40} {avg_a:<15.3f} {avg_b:<15.3f}")
    print(f"{'AVERAGE QUERY LATENCY (ms)':<40} {lat_a:<15.0f} {lat_b:<15.0f}")

    # Winner determination
    print("\n" + "=" * 70)

    score_diff = abs(avg_a - avg_b)
    if score_diff < 0.01:
        print("RESULT: Tie - No significant difference in relevance scores")
    elif avg_a > avg_b:
        improvement = ((avg_a - avg_b) / avg_b * 100) if avg_b > 0 else 0
        print(f"WINNER: Config A ({results_a.config_label})")
        print(f"  - {improvement:.1f}% higher average relevance score")
    else:
        improvement = ((avg_b - avg_a) / avg_a * 100) if avg_a > 0 else 0
        print(f"WINNER: Config B ({results_b.config_label})")
        print(f"  - {improvement:.1f}% higher average relevance score")

    # Storage comparison
    if results_a.ingestion.chunks_created > 0 and results_b.ingestion.chunks_created > 0:
        chunk_ratio = results_b.ingestion.chunks_created / results_a.ingestion.chunks_created
        print(f"\nStorage Impact: Config B creates {chunk_ratio:.1f}x {'more' if chunk_ratio > 1 else 'fewer'} chunks")

    print("=" * 70)


async def main():
    parser = argparse.ArgumentParser(description="Compare chunking configurations")
    parser.add_argument(
        "--rag-url",
        default=DEFAULT_RAG_URL,
        help=f"RAG service URL (default: {DEFAULT_RAG_URL})",
    )
    parser.add_argument(
        "--admin-token",
        default=DEFAULT_ADMIN_TOKEN,
        help="Admin API token",
    )
    parser.add_argument(
        "--ingest-url",
        default="https://www.canada.ca/en/department-national-defence/services/benefits-military/pay-pension-benefits/benefits/canadian-forces-temporary-duty-travel-instructions.html",
        help="URL to ingest for testing",
    )
    parser.add_argument(
        "--skip-ingestion",
        action="store_true",
        help="Skip ingestion (use existing data)",
    )
    parser.add_argument(
        "--queries-file",
        help="JSON file with custom test queries",
    )

    args = parser.parse_args()

    # Load custom queries if provided
    queries = TEST_QUERIES
    if args.queries_file:
        with open(args.queries_file) as f:
            queries = json.load(f)
        print(f"Loaded {len(queries)} queries from {args.queries_file}")

    print(f"\nChunking Comparison Test")
    print(f"RAG Service: {args.rag_url}")
    print(f"Ingest URL: {args.ingest_url}")
    print(f"Test Queries: {len(queries)}")
    print(f"Configs: {list(CONFIGS.keys())}")

    comparison = ChunkingComparison(args.rag_url, args.admin_token)

    try:
        # Run Config A
        results_a = await comparison.run_config_test(
            "A",
            CONFIGS["A"],
            args.ingest_url if not args.skip_ingestion else None,
            queries,
        )

        # Run Config B
        results_b = await comparison.run_config_test(
            "B",
            CONFIGS["B"],
            args.ingest_url if not args.skip_ingestion else None,
            queries,
        )

        # Print comparison report
        print_comparison_report(results_a, results_b)

        # Save results to JSON
        output_file = f"chunking_comparison_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(output_file, "w") as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "config_a": {
                    "label": results_a.config_label,
                    "chunks": results_a.ingestion.chunks_created,
                    "avg_score": results_a.avg_relevance_score,
                    "avg_latency_ms": results_a.avg_query_latency_ms,
                },
                "config_b": {
                    "label": results_b.config_label,
                    "chunks": results_b.ingestion.chunks_created,
                    "avg_score": results_b.avg_relevance_score,
                    "avg_latency_ms": results_b.avg_query_latency_ms,
                },
            }, f, indent=2)
        print(f"\nResults saved to: {output_file}")

    finally:
        await comparison.close()


if __name__ == "__main__":
    asyncio.run(main())
