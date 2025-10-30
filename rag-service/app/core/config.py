from dataclasses import field
"""Configuration settings for RAG service."""

from pydantic_settings import BaseSettings
from typing import Optional, List
import os


class Settings(BaseSettings):
    """Application settings."""
    
    # API Configuration
    app_name: str = "CF Travel Instructions RAG Service"
    app_version: str = "1.4.1"
    api_prefix: str = "/api/v1"
    debug: bool = False
    
    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 2  # Optimized for 2-core system
    
    # CORS
    cors_origins: List[str] = ["http://localhost:3000", "http://localhost:3001"]
    
    # OpenAI Configuration
    openai_api_key: Optional[str] = None
    openai_embedding_model: str = "text-embedding-3-large"
    openai_embedding_dimensions: int = 3072  # Maximum dimensions for text-embedding-3-large
    openai_chat_model: str = "gpt-4.1-mini"  # Updated to gpt-4.1-mini
    openai_smart_model: str = "gpt-5-mini"  # Preferred GPT-5 model for Smart mode
    
    # Google Configuration
    google_api_key: Optional[str] = None
    google_embedding_model: str = "models/embedding-001"
    google_chat_model: str = "gemini-pro"
    
    # Anthropic Configuration
    anthropic_api_key: Optional[str] = None
    anthropic_chat_model: str = "claude-3-opus-20240229"
    
    # Vector Store Configuration
    vector_store_type: str = "chroma"  # chroma or qdrant
    chroma_persist_directory: str = "./chroma_db"
    chroma_collection_name: str = "travel_instructions"
    
    # Document Processing
    chunk_size: int = 1024
    chunk_overlap: int = 250  # Increased from 200 for better context
    min_chunk_size: int = 200  # Minimum chunk size for quality
    max_chunk_size: int = 1500  # Maximum chunk size to prevent too large chunks
    max_chunks_per_query: int = 15  # Increased to provide more context
    source_preview_max_length: int = 5000  # Max characters for source preview (0 = no limit)
    use_sentence_aware_splitting: bool = True  # Enable sentence boundary respect
    use_dynamic_chunk_sizing: bool = True  # Enable adaptive chunk sizing
    enable_table_multivector: bool = True  # Enable table multi-vector retriever
    enable_metadata_extraction: bool = True  # Enable automatic metadata extraction
    enable_quality_validation: bool = True  # Enable chunk quality validation
    strict_quality_validation: bool = False  # If True, reject low-quality chunks
    min_quality_score: float = 60.0  # Minimum quality score (0-100)
    
    # Parallel Processing Configuration - Optimized for 2-core VPS
    parallel_chunk_workers: int = 4  # Reduced from 8 (2x CPU cores)
    parallel_embedding_workers: int = 6  # Reduced from 16 (3x CPU cores)
    embedding_batch_size: int = 30  # Reduced from 50 for memory efficiency
    max_concurrent_embeddings: int = 20  # Reduced from 50 to prevent memory pressure
    vector_store_batch_size: int = 200  # Reduced from 500 to prevent memory spikes
    parallel_retrieval_limit: int = 5  # Reduced from 10 to match available resources
    retriever_timeout: float = 10.0  # Timeout for each retriever in seconds
    
    # Retrieval Configuration
    retrieval_search_type: str = "similarity"  # Changed from mmr to similarity
    retrieval_k: int = 20  # Increased from 5
    retrieval_fetch_k: int = 40  # Increased from 10
    retrieval_lambda_mult: float = 0.7  # Only used for MMR

    # Smart mode tuning
    smart_mode_max_chunks: int = 4  # Limit GPT-5 Mini to a handful of context chunks for speed
    smart_mode_context_char_limit: int = 4000  # Trim Smart mode context of overly long prompts
    smart_mode_short_answer_max_tokens: int = 600  # Cap max tokens when users request short answers
    
    # Caching Configuration
    redis_url: Optional[str] = "redis://localhost:6379"
    cache_ttl: int = 3600  # 1 hour
    embedding_cache_ttl: int = 604800  # 1 week
    enable_embedding_cache: bool = True  # Enable embedding caching for faster ingestion
    
    # Canada.ca Scraping
    canada_ca_base_url: str = "https://www.canada.ca"
    travel_instructions_url: str = "https://www.canada.ca/en/department-national-defence/services/benefits-military/pay-pension-benefits/benefits/canadian-forces-temporary-duty-travel-instructions.html"
    scraping_timeout: int = 30
    scraping_retry_count: int = 3
    
    # Rate Limiting
    rate_limit_enabled: bool = True
    rate_limit_requests: int = 60
    rate_limit_period: int = 60  # seconds
    
    # Streaming Configuration
    enable_streaming: bool = True
    sse_timeout: int = 300  # 5 minutes
    sse_buffer_size: int = 1024  # 1KB per chunk
    max_streaming_connections: int = 150  # Support 100+ concurrent users with buffer
    streaming_chunk_delay: float = 0.001  # 1ms delay between chunks for backpressure
    streaming_first_token_target_ms: int = 500  # Target for first token latency
    
    # Unified Retrieval Configuration
    enable_unified_retrieval: bool = True  # Opt-in feature
    unified_retrieval_mode: str = "balanced"  # simple, balanced, or advanced
    unified_retrieval_cache_ttl: int = 3600  # 1 hour
    unified_retrieval_fallback: bool = True  # Use fallback retriever if unified fails
    
    # Gated Retrieval Optimization Configuration
    enable_gated_retrieval: bool = True  # Feature flag for new optimized pipeline
    gated_retrieval_rollout_percentage: float = 1.0  # A/B testing rollout (0.0-1.0)
    
    # Per-Retriever Timeouts (in seconds)
    vector_retriever_timeout: float = 0.15  # 150ms for vector search
    bm25_retriever_timeout: float = 0.20   # 200ms for BM25 search
    multiquery_retriever_timeout: float = 0.30  # 300ms for multi-query
    
    # RRF (Reciprocal Rank Fusion) Configuration
    rrf_k: int = 60  # RRF constant for recall preservation (60-120 range)
    rrf_normalize_scores: bool = True  # Normalize RRF scores to [0,1]
    rrf_score_threshold: float = 0.15  # Minimum normalized score to keep documents after fusion
    
    # Deduplication Configuration
    enable_deduplication: bool = True  # Enable near-duplicate detection
    dedup_jaccard_threshold: float = 0.82  # Conservative threshold for MinHash
    dedup_hamming_threshold: int = 4  # Conservative threshold for SimHash
    dedup_exact_id_matching: bool = True  # Enable exact ID matching stage
    
    # L2 Retrieval Cache Configuration (merged results cache)
    enable_l2_retrieval_cache: bool = True  # Cache merged/deduplicated results
    l2_cache_ttl_days: int = 7  # TTL for L2 cache entries
    l2_cache_max_entries: int = 10000  # Maximum cached queries
    
    # Uncertainty Scoring Configuration
    uncertainty_gate_threshold: float = 0.5  # p(hard_query) threshold for gating
    uncertainty_features_enabled: List[str] = [
        "ambiguity", "specificity", "coverage", "coherence", "complexity"
    ]
    
    # BM25 Smart Gating Configuration
    bm25_always_patterns: List[str] = [
        r"\d",  # Contains digits
        r":\d+",  # Contains :number:
        r"\b[A-Z]{2,}\b",  # 2+ ALL-CAPS tokens
        r"[A-Z]{2,}-\d+",  # Policy IDs (CBI-10, DAOD-5516-2)
    ]
    bm25_quick_peek_timeout: float = 0.08  # 80ms quick peek for other queries
    bm25_max_query_length_always: int = 3  # Always enable for queries ≤3 words
    
    # Adaptive K Selection Configuration
    adaptive_k_min: int = 10  # Minimum documents to retrieve
    adaptive_k_max: int = 25  # Maximum documents to retrieve
    adaptive_k_coverage_threshold: float = 0.85  # RRF mass coverage target
    
    # Conditional Reranking Configuration
    reranker_skip_similarity_threshold: float = 0.62  # Skip if top result > threshold
    reranker_skip_redundancy_threshold: int = 2  # Skip if redundancy >= threshold
    reranker_batch_size: int = 28  # Optimal batch size for cross-encoder
    reranker_fallback_to_biencoder: bool = True  # Use bi-encoder if cross-encoder fails
    
    # Delayed Head Streaming Configuration
    delayed_streaming_enabled: bool = True  # Enable delayed head streaming
    delayed_streaming_phase1_timeout: float = 0.15  # Quick retrieval timeout
    delayed_streaming_phase1_k: int = 8  # Quick retrieval document count
    delayed_streaming_uncertainty_threshold: float = 0.8  # Threshold for delayed start
    
    # Streaming Retrieval Configuration
    enable_streaming_retrieval: bool = False  # Enable streaming retrieval for faster TTFT
    streaming_initial_k: int = 5  # Number of docs for initial quick retrieval
    streaming_retrieval_timeout: float = 0.5  # Max time for initial retrieval (seconds)
    
    # LLM Pool Configuration
    enable_llm_pool: bool = True  # Master switch for LLM connection pool
    llm_pool_health_checks: bool = False  # Enable periodic health check pings
    llm_pool_warmup: bool = True  # Enable connection warming on creation
    llm_pool_min_connections: int = 2  # Minimum connections per provider (0 = disabled)
    llm_pool_max_connections: int = 10  # Maximum total connections
    llm_pool_health_check_interval: int = 60  # Health check interval in seconds
    
    # LangGraph Stateful Retrieval Configuration
    enable_stateful_retrieval: bool = True  # Enable LangGraph persistence and cycles
    max_retrieval_iterations: int = 2  # Maximum refinement iterations before giving up
    relevance_threshold: float = 0.4  # Minimum avg relevance to proceed (0-1 scale)
    checkpoint_critical_nodes_only: bool = True  # Only checkpoint key nodes to reduce latency
    stateful_retrieval_session_ttl: int = 3600  # Session TTL in seconds (1 hour)
    
    # Logging
    log_level: str = "INFO"
    log_format: str = "json"

    # Default Query Context
    # If set, this string is appended to location-agnostic queries
    # to bias retrieval toward a specific location (e.g., "Ontario, Canada").
    default_location: Optional[str] = None
    
    # Query Logging & Encryption Configuration
    enable_query_logging: bool = True
    query_retention_days: int = 90
    anonymize_query_logs: bool = False
    encrypt_query_logs: bool = True
    encryption_key_path: Optional[str] = None  # Path to encryption key file
    use_env_encryption_key: bool = True  # Check RAG_ENCRYPTION_KEY env var
    
    class Config:
        env_file = ".env"
        env_prefix = "RAG_"
        case_sensitive = False
        extra = "ignore"  # Allow extra fields in .env file


# Create settings instance
settings = Settings()

# Override with environment variables
if os.getenv("OPENAI_API_KEY"):
    settings.openai_api_key = os.getenv("OPENAI_API_KEY").strip()
    
gemini_env_key = None
if os.getenv("GEMINI_API_KEY"):
    gemini_env_key = os.getenv("GEMINI_API_KEY").strip()
elif os.getenv("VITE_GEMINI_API_KEY"):
    gemini_env_key = os.getenv("VITE_GEMINI_API_KEY").strip()
    print("[warning] VITE_GEMINI_API_KEY is deprecated. Please migrate to GEMINI_API_KEY.")

if gemini_env_key:
    settings.google_api_key = gemini_env_key
    
if os.getenv("ANTHROPIC_API_KEY"):
    settings.anthropic_api_key = os.getenv("ANTHROPIC_API_KEY").strip()
    
if os.getenv("REDIS_URL"):
    settings.redis_url = os.getenv("REDIS_URL")
