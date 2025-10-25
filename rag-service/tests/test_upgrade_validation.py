"""Test suite to validate LangChain and LangGraph upgrade.

This test module validates that:
1. Correct versions are installed
2. No deprecated imports are in use
3. Critical API changes are compatible
4. All dependencies are properly installed
"""

import sys
import importlib
import pytest
from packaging import version


class TestVersionValidation:
    """Test that correct versions of LangChain and LangGraph are installed."""

    def test_langgraph_version(self):
        """Verify LangGraph is upgraded to 1.0+."""
        import langgraph

        installed_version = version.parse(langgraph.__version__)
        min_required = version.parse("1.0.0")

        assert installed_version >= min_required, (
            f"LangGraph version {langgraph.__version__} is below required 1.0.0. "
            "Please run: pip install 'langgraph>=1.0.20'"
        )
        print(f"✅ LangGraph version: {langgraph.__version__}")

    def test_langchain_version(self):
        """Verify LangChain is at 0.3.14+."""
        import langchain

        installed_version = version.parse(langchain.__version__)
        min_required = version.parse("0.3.14")

        assert installed_version >= min_required, (
            f"LangChain version {langchain.__version__} is below required 0.3.14. "
            "Please run: pip install 'langchain>=0.3.14'"
        )
        print(f"✅ LangChain version: {langchain.__version__}")

    def test_langchain_core_version(self):
        """Verify langchain-core is at 0.3.30+."""
        import langchain_core

        installed_version = version.parse(langchain_core.__version__)
        min_required = version.parse("0.3.30")

        assert installed_version >= min_required, (
            f"langchain-core version {langchain_core.__version__} is below required 0.3.30"
        )
        print(f"✅ langchain-core version: {langchain_core.__version__}")

    def test_langchain_community_version(self):
        """Verify langchain-community is at 0.3.14+."""
        import langchain_community

        installed_version = version.parse(langchain_community.__version__)
        min_required = version.parse("0.3.14")

        assert installed_version >= min_required, (
            f"langchain-community version {langchain_community.__version__} is below required 0.3.14"
        )
        print(f"✅ langchain-community version: {langchain_community.__version__}")

    def test_langchain_openai_version(self):
        """Verify langchain-openai is at 0.2.14+."""
        import langchain_openai

        installed_version = version.parse(langchain_openai.__version__)
        min_required = version.parse("0.2.14")

        assert installed_version >= min_required, (
            f"langchain-openai version {langchain_openai.__version__} is below required 0.2.14"
        )
        print(f"✅ langchain-openai version: {langchain_openai.__version__}")

    def test_langchain_google_genai_version(self):
        """Verify langchain-google-genai is at 2.0+."""
        import langchain_google_genai

        installed_version = version.parse(langchain_google_genai.__version__)
        min_required = version.parse("2.0.0")

        assert installed_version >= min_required, (
            f"langchain-google-genai version {langchain_google_genai.__version__} "
            f"is below required 2.0.0 (major version upgrade)"
        )
        print(f"✅ langchain-google-genai version: {langchain_google_genai.__version__}")

    def test_langchain_anthropic_version(self):
        """Verify langchain-anthropic is at 0.3.7+."""
        import langchain_anthropic

        installed_version = version.parse(langchain_anthropic.__version__)
        min_required = version.parse("0.3.7")

        assert installed_version >= min_required, (
            f"langchain-anthropic version {langchain_anthropic.__version__} is below required 0.3.7"
        )
        print(f"✅ langchain-anthropic version: {langchain_anthropic.__version__}")

    def test_pydantic_version(self):
        """Verify Pydantic is at v2.10+."""
        import pydantic

        installed_version = version.parse(pydantic.__version__)
        min_required = version.parse("2.10.0")
        max_version = version.parse("3.0.0")

        assert installed_version >= min_required, (
            f"Pydantic version {pydantic.__version__} is below required 2.10.0"
        )
        assert installed_version < max_version, (
            f"Pydantic version {pydantic.__version__} is 3.x, but 2.x is required"
        )
        print(f"✅ Pydantic version: {pydantic.__version__}")


class TestRedisCheckpointPackage:
    """Test that langgraph-checkpoint-redis is properly installed."""

    def test_redis_checkpoint_package_installed(self):
        """Verify langgraph-checkpoint-redis package is installed."""
        try:
            import langgraph.checkpoint.redis
            print("✅ langgraph-checkpoint-redis package is installed")
        except ImportError as e:
            pytest.fail(
                f"langgraph-checkpoint-redis not installed: {e}\n"
                "Please run: pip install 'langgraph-checkpoint-redis>=0.1.1'"
            )

    def test_async_redis_saver_available(self):
        """Verify AsyncRedisSaver is available."""
        try:
            from langgraph.checkpoint.redis.aio import AsyncRedisSaver

            # Check it has expected methods
            assert hasattr(AsyncRedisSaver, 'from_conn_string'), (
                "AsyncRedisSaver missing from_conn_string method"
            )
            print("✅ AsyncRedisSaver is available with correct API")
        except ImportError as e:
            pytest.fail(
                f"Cannot import AsyncRedisSaver: {e}\n"
                "Please run: pip install 'langgraph-checkpoint-redis>=0.1.1'"
            )


class TestDeprecatedImports:
    """Test that no deprecated imports are in use."""

    def test_no_pydantic_v1_imports(self):
        """Verify no code uses deprecated pydantic_v1 imports."""
        import subprocess
        import os

        # Search for pydantic_v1 imports in app directory
        result = subprocess.run(
            ["grep", "-r", "pydantic_v1", "app/"],
            cwd="/home/user/32cbgg8/rag-service",
            capture_output=True,
            text=True
        )

        # Should return non-zero (not found) or empty output
        if result.returncode == 0 and result.stdout.strip():
            pytest.fail(
                f"Found deprecated pydantic_v1 imports:\n{result.stdout}\n"
                "These must be migrated to pydantic v2"
            )

        print("✅ No deprecated pydantic_v1 imports found")

    def test_langchain_globals_available(self):
        """Verify langchain.globals still available (used for caching)."""
        try:
            from langchain.globals import set_llm_cache
            print("✅ langchain.globals.set_llm_cache is available")
        except ImportError as e:
            pytest.fail(f"langchain.globals not available: {e}")


class TestCriticalDependencies:
    """Test critical dependencies are at correct versions."""

    def test_fastapi_version(self):
        """Verify FastAPI is updated to 0.115+."""
        import fastapi

        installed_version = version.parse(fastapi.__version__)
        min_required = version.parse("0.115.0")

        assert installed_version >= min_required, (
            f"FastAPI version {fastapi.__version__} is below required 0.115.0"
        )
        print(f"✅ FastAPI version: {fastapi.__version__}")

    def test_redis_version(self):
        """Verify redis-py is at 5.2+."""
        import redis

        installed_version = version.parse(redis.__version__)
        min_required = version.parse("5.2.0")

        assert installed_version >= min_required, (
            f"redis version {redis.__version__} is below required 5.2.0"
        )
        print(f"✅ redis version: {redis.__version__}")

    def test_chromadb_version(self):
        """Verify ChromaDB is at 0.5+."""
        import chromadb

        installed_version = version.parse(chromadb.__version__)
        min_required = version.parse("0.5.0")

        assert installed_version >= min_required, (
            f"chromadb version {chromadb.__version__} is below required 0.5.0"
        )
        print(f"✅ chromadb version: {chromadb.__version__}")

    def test_openai_version(self):
        """Verify OpenAI SDK is at 1.60+."""
        import openai

        installed_version = version.parse(openai.__version__)
        min_required = version.parse("1.60.0")

        assert installed_version >= min_required, (
            f"openai version {openai.__version__} is below required 1.60.0"
        )
        print(f"✅ openai version: {openai.__version__}")

    def test_sentence_transformers_version(self):
        """Verify sentence-transformers is at 3.3+."""
        import sentence_transformers

        installed_version = version.parse(sentence_transformers.__version__)
        min_required = version.parse("3.3.0")

        assert installed_version >= min_required, (
            f"sentence-transformers version {sentence_transformers.__version__} "
            f"is below required 3.3.0"
        )
        print(f"✅ sentence-transformers version: {sentence_transformers.__version__}")


class TestLangGraphAPI:
    """Test LangGraph 1.0 API compatibility."""

    def test_stategraph_import(self):
        """Verify StateGraph can be imported."""
        try:
            from langgraph.graph import StateGraph, END
            print("✅ StateGraph and END imported successfully")
        except ImportError as e:
            pytest.fail(f"Cannot import StateGraph: {e}")

    def test_checkpoint_memory_saver(self):
        """Verify MemorySaver fallback is available."""
        try:
            from langgraph.checkpoint.memory import MemorySaver

            # Test instantiation
            saver = MemorySaver()
            assert saver is not None
            print("✅ MemorySaver is available and can be instantiated")
        except Exception as e:
            pytest.fail(f"MemorySaver error: {e}")

    def test_stategraph_compile(self):
        """Test that StateGraph can be compiled."""
        from langgraph.graph import StateGraph, END
        from typing import TypedDict

        class TestState(TypedDict):
            value: int

        def test_node(state: TestState) -> TestState:
            state["value"] += 1
            return state

        # Build simple graph
        workflow = StateGraph(TestState)
        workflow.add_node("test", test_node)
        workflow.set_entry_point("test")
        workflow.add_edge("test", END)

        # Compile should work
        try:
            compiled = workflow.compile()
            assert compiled is not None
            print("✅ StateGraph compiles successfully")
        except Exception as e:
            pytest.fail(f"StateGraph compile failed: {e}")


class TestStatefulRetrievalMigration:
    """Test that stateful_retrieval.py uses new LangGraph 1.0 API."""

    def test_no_custom_redis_checkpointer(self):
        """Verify custom RedisCheckpointer class is removed."""
        with open("/home/user/32cbgg8/rag-service/app/pipelines/stateful_retrieval.py") as f:
            content = f.read()

        assert "class RedisCheckpointer:" not in content, (
            "Found custom RedisCheckpointer class - should be removed in favor of AsyncRedisSaver"
        )
        print("✅ Custom RedisCheckpointer class removed")

    def test_async_redis_saver_import(self):
        """Verify AsyncRedisSaver is imported."""
        with open("/home/user/32cbgg8/rag-service/app/pipelines/stateful_retrieval.py") as f:
            content = f.read()

        assert "AsyncRedisSaver" in content, (
            "AsyncRedisSaver not found - should be imported for LangGraph 1.0"
        )
        print("✅ AsyncRedisSaver import found in stateful_retrieval.py")

    def test_from_conn_string_usage(self):
        """Verify from_conn_string method is used."""
        with open("/home/user/32cbgg8/rag-service/app/pipelines/stateful_retrieval.py") as f:
            content = f.read()

        assert "from_conn_string" in content, (
            "from_conn_string not found - should be used to create AsyncRedisSaver"
        )
        print("✅ from_conn_string method usage found")

    def test_upgrade_comment_present(self):
        """Verify upgrade comment is present in file."""
        with open("/home/user/32cbgg8/rag-service/app/pipelines/stateful_retrieval.py") as f:
            content = f.read()

        assert "LangGraph 1.0" in content, (
            "Missing upgrade documentation comment in stateful_retrieval.py"
        )
        print("✅ LangGraph 1.0 upgrade documentation present")


def test_print_summary(capsys):
    """Print summary of all installed versions."""
    import langgraph
    import langchain
    import langchain_core
    import langchain_community
    import langchain_openai
    import langchain_google_genai
    import langchain_anthropic
    import pydantic
    import fastapi
    import redis

    summary = f"""

╔══════════════════════════════════════════════════════════════════╗
║           LangChain/LangGraph Upgrade Validation Summary         ║
╚══════════════════════════════════════════════════════════════════╝

📦 Core Packages:
   • LangGraph:                  {langgraph.__version__}
   • LangChain:                  {langchain.__version__}
   • langchain-core:             {langchain_core.__version__}
   • langchain-community:        {langchain_community.__version__}

🤖 LLM Provider Packages:
   • langchain-openai:           {langchain_openai.__version__}
   • langchain-google-genai:     {langchain_google_genai.__version__}
   • langchain-anthropic:        {langchain_anthropic.__version__}

🔧 Supporting Packages:
   • Pydantic:                   {pydantic.__version__}
   • FastAPI:                    {fastapi.__version__}
   • Redis:                      {redis.__version__}

✅ All version requirements met!

    """
    print(summary)


if __name__ == "__main__":
    # Run tests with verbose output
    pytest.main([__file__, "-v", "--tb=short"])
