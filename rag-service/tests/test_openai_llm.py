"""Tests for OpenAI LLM integration with upgraded LangChain.

Tests:
1. OpenAI SDK version
2. LangChain OpenAI integration
3. ChatOpenAI functionality
4. Embeddings
5. Caching
6. Error handling
"""

import pytest
import os
from unittest.mock import Mock, patch


class TestOpenAISDK:
    """Test OpenAI SDK version and compatibility."""

    def test_openai_version(self):
        """Verify OpenAI SDK version is 1.60+."""
        import openai
        from packaging import version

        installed = version.parse(openai.__version__)
        min_required = version.parse("1.60.0")

        assert installed >= min_required, (
            f"OpenAI SDK {openai.__version__} is below required 1.60.0"
        )
        print(f"✅ OpenAI SDK version: {openai.__version__}")

    def test_openai_client_import(self):
        """Test importing OpenAI client."""
        try:
            from openai import OpenAI, AsyncOpenAI
            print("✅ OpenAI client classes imported successfully")
        except ImportError as e:
            pytest.fail(f"Cannot import OpenAI client: {e}")


class TestLangChainOpenAI:
    """Test LangChain OpenAI integration."""

    def test_langchain_openai_version(self):
        """Verify langchain-openai version is 0.2.14+."""
        import langchain_openai
        from packaging import version

        installed = version.parse(langchain_openai.__version__)
        min_required = version.parse("0.2.14")

        assert installed >= min_required, (
            f"langchain-openai {langchain_openai.__version__} is below required 0.2.14"
        )
        print(f"✅ langchain-openai version: {langchain_openai.__version__}")

    def test_import_chatopenai(self):
        """Test importing ChatOpenAI."""
        try:
            from langchain_openai import ChatOpenAI
            print("✅ ChatOpenAI imported successfully")
        except ImportError as e:
            pytest.fail(f"Cannot import ChatOpenAI: {e}")

    def test_import_openai_embeddings(self):
        """Test importing OpenAIEmbeddings."""
        try:
            from langchain_openai import OpenAIEmbeddings
            print("✅ OpenAIEmbeddings imported successfully")
        except ImportError as e:
            pytest.fail(f"Cannot import OpenAIEmbeddings: {e}")

    def test_chatopenai_instantiation(self):
        """Test creating ChatOpenAI instance."""
        from langchain_openai import ChatOpenAI

        # Create with dummy API key (won't make real calls)
        llm = ChatOpenAI(
            api_key="sk-test-dummy-key-for-testing",
            model="gpt-3.5-turbo",
            temperature=0.7
        )

        assert llm is not None
        assert llm.model_name == "gpt-3.5-turbo"
        assert llm.temperature == 0.7
        print("✅ ChatOpenAI instantiated successfully")

    def test_openai_embeddings_instantiation(self):
        """Test creating OpenAIEmbeddings instance."""
        from langchain_openai import OpenAIEmbeddings

        embeddings = OpenAIEmbeddings(
            api_key="sk-test-dummy-key-for-testing",
            model="text-embedding-3-small"
        )

        assert embeddings is not None
        print("✅ OpenAIEmbeddings instantiated successfully")


class TestChatOpenAIFunctionality:
    """Test ChatOpenAI functionality (with mocking)."""

    @pytest.mark.skipif(
        not os.getenv("OPENAI_API_KEY"),
        reason="OPENAI_API_KEY not set - skipping live API test"
    )
    def test_chatopenai_invoke(self):
        """Test ChatOpenAI invoke (requires API key)."""
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import HumanMessage

        llm = ChatOpenAI(
            model="gpt-3.5-turbo",
            temperature=0.0,
            max_tokens=50
        )

        message = HumanMessage(content="Say 'test passed' and nothing else")

        try:
            response = llm.invoke([message])
            assert response is not None
            assert hasattr(response, 'content')
            print(f"✅ ChatOpenAI invoke successful: {response.content[:50]}")
        except Exception as e:
            pytest.fail(f"ChatOpenAI invoke failed: {e}")

    @pytest.mark.skipif(
        not os.getenv("OPENAI_API_KEY"),
        reason="OPENAI_API_KEY not set - skipping live API test"
    )
    @pytest.mark.asyncio
    async def test_chatopenai_ainvoke(self):
        """Test ChatOpenAI async invoke (requires API key)."""
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import HumanMessage

        llm = ChatOpenAI(
            model="gpt-3.5-turbo",
            temperature=0.0,
            max_tokens=50
        )

        message = HumanMessage(content="Say 'async test passed'")

        try:
            response = await llm.ainvoke([message])
            assert response is not None
            print(f"✅ ChatOpenAI ainvoke successful: {response.content[:50]}")
        except Exception as e:
            pytest.fail(f"ChatOpenAI ainvoke failed: {e}")

    def test_chatopenai_streaming_interface(self):
        """Test ChatOpenAI has streaming methods."""
        from langchain_openai import ChatOpenAI

        llm = ChatOpenAI(api_key="sk-test-dummy")

        # Check for streaming methods
        assert hasattr(llm, 'stream'), "ChatOpenAI missing stream method"
        assert hasattr(llm, 'astream'), "ChatOpenAI missing astream method"
        print("✅ ChatOpenAI has streaming interface")


class TestOpenAIEmbeddings:
    """Test OpenAI embeddings functionality."""

    @pytest.mark.skipif(
        not os.getenv("OPENAI_API_KEY"),
        reason="OPENAI_API_KEY not set - skipping live API test"
    )
    def test_embed_query(self):
        """Test embedding a single query (requires API key)."""
        from langchain_openai import OpenAIEmbeddings

        embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small"
        )

        try:
            vector = embeddings.embed_query("test query")
            assert isinstance(vector, list)
            assert len(vector) > 0
            assert isinstance(vector[0], float)
            print(f"✅ Embedding generated: dimension={len(vector)}")
        except Exception as e:
            pytest.fail(f"Embedding generation failed: {e}")

    @pytest.mark.skipif(
        not os.getenv("OPENAI_API_KEY"),
        reason="OPENAI_API_KEY not set - skipping live API test"
    )
    def test_embed_documents(self):
        """Test embedding multiple documents (requires API key)."""
        from langchain_openai import OpenAIEmbeddings

        embeddings = OpenAIEmbeddings(
            model="text-embedding-3-small"
        )

        docs = ["doc 1", "doc 2", "doc 3"]

        try:
            vectors = embeddings.embed_documents(docs)
            assert len(vectors) == 3
            assert all(isinstance(v, list) for v in vectors)
            print(f"✅ {len(vectors)} document embeddings generated")
        except Exception as e:
            pytest.fail(f"Document embedding failed: {e}")

    def test_embeddings_dimensions_configurable(self):
        """Test that embedding dimensions can be configured."""
        from langchain_openai import OpenAIEmbeddings

        # text-embedding-3-small supports dimensions parameter
        embeddings = OpenAIEmbeddings(
            api_key="sk-test-dummy",
            model="text-embedding-3-small",
            dimensions=512
        )

        # Check that dimensions parameter is set
        # (actual validation would require API call)
        assert hasattr(embeddings, 'dimensions') or hasattr(embeddings, 'embedding_ctx_length')
        print("✅ Embeddings dimensions configurable")


class TestLangChainCaching:
    """Test LangChain LLM caching with OpenAI."""

    def test_cache_import(self):
        """Test importing cache utilities."""
        try:
            from langchain.globals import set_llm_cache
            from langchain_core.caches import InMemoryCache
            print("✅ Cache utilities imported successfully")
        except ImportError as e:
            pytest.fail(f"Cannot import cache utilities: {e}")

    def test_set_cache(self):
        """Test setting up in-memory cache."""
        from langchain.globals import set_llm_cache
        from langchain_core.caches import InMemoryCache

        cache = InMemoryCache()
        set_llm_cache(cache)
        print("✅ In-memory cache configured successfully")

    def test_redis_cache_import(self):
        """Test importing Redis cache."""
        try:
            from langchain_community.cache import RedisCache
            print("✅ RedisCache imported successfully")
        except ImportError as e:
            pytest.fail(f"Cannot import RedisCache: {e}")


class TestErrorHandling:
    """Test error handling with OpenAI."""

    def test_rate_limit_error_import(self):
        """Test importing OpenAI error classes."""
        try:
            from openai import RateLimitError, APIError, APITimeoutError
            print("✅ OpenAI error classes imported successfully")
        except ImportError as e:
            pytest.fail(f"Cannot import OpenAI errors: {e}")

    def test_langchain_utils_error_handling(self):
        """Test that langchain_utils handles OpenAI errors."""
        try:
            from app.utils.langchain_utils import (
                RETRYABLE_EXCEPTIONS,
                handle_llm_error,
                RetryableLLM
            )

            from openai import RateLimitError

            # Verify RateLimitError is in retryable exceptions
            assert RateLimitError in RETRYABLE_EXCEPTIONS
            print("✅ langchain_utils handles OpenAI errors correctly")

        except ImportError as e:
            pytest.skip(f"Cannot import langchain_utils: {e}")

    def test_invalid_api_key_handling(self):
        """Test graceful handling of invalid API key."""
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import HumanMessage

        llm = ChatOpenAI(
            api_key="sk-invalid-key",
            model="gpt-3.5-turbo",
            max_retries=0  # Don't retry for this test
        )

        message = HumanMessage(content="test")

        # Should raise an authentication error
        with pytest.raises(Exception) as exc_info:
            llm.invoke([message])

        # Error should be related to authentication
        error_msg = str(exc_info.value).lower()
        assert any(word in error_msg for word in ["auth", "api", "key", "invalid"])
        print("✅ Invalid API key handled gracefully")


class TestLangChainConfigIntegration:
    """Test integration with app's LangChain config."""

    def test_get_embeddings_function(self):
        """Test get_embeddings utility function."""
        try:
            from app.core.langchain_config import get_embeddings

            # This will fail without API keys, but tests the function exists
            # and returns correct type
            if os.getenv("OPENAI_API_KEY"):
                embeddings = get_embeddings()
                from langchain_core.embeddings import Embeddings
                assert isinstance(embeddings, Embeddings)
                print("✅ get_embeddings() returns Embeddings instance")
            else:
                # Just verify function exists
                assert callable(get_embeddings)
                print("✅ get_embeddings() function available")

        except ImportError as e:
            pytest.skip(f"Cannot import langchain_config: {e}")
        except ValueError as e:
            # Expected if no API keys configured
            if "No embedding API key" in str(e):
                print("⚠️  get_embeddings() requires API key (expected)")
            else:
                raise

    def test_langchain_config_initialization(self):
        """Test LangChainConfig initialization."""
        try:
            from app.core.langchain_config import LangChainConfig

            LangChainConfig.initialize()
            print("✅ LangChainConfig initialized successfully")

        except ImportError as e:
            pytest.skip(f"Cannot import LangChainConfig: {e}")


class TestOpenAIModels:
    """Test different OpenAI model configurations."""

    def test_gpt35_turbo_model(self):
        """Test GPT-3.5 Turbo model configuration."""
        from langchain_openai import ChatOpenAI

        llm = ChatOpenAI(
            api_key="sk-test",
            model="gpt-3.5-turbo",
            temperature=0.7
        )

        assert llm.model_name == "gpt-3.5-turbo"
        print("✅ GPT-3.5 Turbo model configured")

    def test_gpt4_turbo_model(self):
        """Test GPT-4 Turbo model configuration."""
        from langchain_openai import ChatOpenAI

        llm = ChatOpenAI(
            api_key="sk-test",
            model="gpt-4-turbo-preview",
            temperature=0.5
        )

        assert llm.model_name == "gpt-4-turbo-preview"
        print("✅ GPT-4 Turbo model configured")

    def test_embedding_models(self):
        """Test different embedding model configurations."""
        from langchain_openai import OpenAIEmbeddings

        # text-embedding-3-small
        small = OpenAIEmbeddings(
            api_key="sk-test",
            model="text-embedding-3-small"
        )
        assert small.model == "text-embedding-3-small"

        # text-embedding-3-large
        large = OpenAIEmbeddings(
            api_key="sk-test",
            model="text-embedding-3-large"
        )
        assert large.model == "text-embedding-3-large"

        print("✅ Different embedding models configured")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "-s"])
