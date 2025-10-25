# LangChain/LangGraph Upgrade Test Suite

Comprehensive test suite to validate the upgrade from LangGraph 0.2.38 to 1.0.20+ and LangChain to 0.3.14+.

## Quick Start

```bash
# Run all essential tests (recommended)
python run_upgrade_tests.py --quick

# Run full test suite
python run_upgrade_tests.py --full

# Skip live API tests (no API keys needed)
python run_upgrade_tests.py --no-live-api
```

## Test Structure

### Test Files

| Test File | Purpose | Essential |
|-----------|---------|-----------|
| `test_upgrade_validation.py` | Version validation, dependency checks | ✅ Yes |
| `test_langgraph_integration.py` | LangGraph 1.0 StateGraph functionality | ✅ Yes |
| `test_redis_checkpoint.py` | Redis checkpoint integration | ✅ Yes |
| `test_openai_llm.py` | OpenAI LLM integration (OpenAI only) | ✅ Yes |
| `test_stateful_retrieval_upgrade.py` | Stateful retrieval pipeline | ✅ Yes |
| `test_ingestion_pipeline.py` | Document ingestion (existing) | No |
| `test_metrics_api.py` | Metrics API (existing) | No |

### Test Categories

**1. Version Validation** (`test_upgrade_validation.py`)
- ✅ LangGraph version 1.0.20+
- ✅ LangChain version 0.3.14+
- ✅ All ecosystem packages updated
- ✅ No deprecated imports (pydantic_v1)
- ✅ Redis checkpoint package available
- ✅ Critical dependencies updated

**2. LangGraph Integration** (`test_langgraph_integration.py`)
- ✅ StateGraph creation and compilation
- ✅ Node execution and state management
- ✅ Conditional edge routing
- ✅ Checkpoint integration (MemorySaver)
- ✅ Async operations
- ✅ Graph streaming

**3. Redis Checkpoint** (`test_redis_checkpoint.py`)
- ✅ AsyncRedisSaver availability
- ✅ MemorySaver fallback
- ✅ Checkpoint operations
- ✅ Multi-thread state isolation
- ✅ Integration with StateGraph
- ✅ Performance characteristics

**4. OpenAI LLM** (`test_openai_llm.py`)
- ✅ OpenAI SDK version 1.60+
- ✅ ChatOpenAI functionality
- ✅ OpenAIEmbeddings
- ✅ Streaming interface
- ✅ Error handling
- ✅ LangChain caching integration
- ✅ Multiple model configurations

**5. Stateful Retrieval** (`test_stateful_retrieval_upgrade.py`)
- ✅ Import and instantiation
- ✅ Workflow compilation
- ✅ State management
- ✅ Checkpoint integration
- ✅ Query refinement cycle
- ✅ Error handling
- ✅ Upgrade compatibility

---

## Running Tests

### Method 1: Using Test Runner (Recommended)

```bash
cd rag-service

# Quick validation (essential tests only)
python run_upgrade_tests.py --quick

# Full test suite
python run_upgrade_tests.py --full

# Verbose output
python run_upgrade_tests.py --quick --verbose

# Generate coverage report
python run_upgrade_tests.py --full --report

# Skip live API tests (no API keys needed)
python run_upgrade_tests.py --no-live-api
```

### Method 2: Using pytest Directly

```bash
cd rag-service

# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_upgrade_validation.py -v

# Run specific test class
pytest tests/test_langgraph_integration.py::TestStateGraphBasics -v

# Run specific test
pytest tests/test_openai_llm.py::TestOpenAISDK::test_openai_version -v

# Run with coverage
pytest tests/ --cov=app --cov-report=html

# Run with markers
pytest tests/ -v -m "not live_api"
```

### Method 3: Individual Test Files

```bash
cd rag-service

# Run individual test files directly
python tests/test_upgrade_validation.py
python tests/test_langgraph_integration.py
python tests/test_redis_checkpoint.py
```

---

## Test Requirements

### Required Dependencies

```bash
# Install test dependencies
pip install pytest>=8.3.4 pytest-asyncio>=0.25.2 packaging
```

### Optional Dependencies

```bash
# For coverage reports
pip install pytest-cov

# For Redis checkpoint support
pip install langgraph-checkpoint-redis>=0.1.1
```

### Environment Variables

Some tests require API keys (but can be skipped):

```bash
# Optional - for live API tests
export OPENAI_API_KEY="your-openai-key"

# Optional - for Redis tests
export REDIS_URL="redis://localhost:6379"
```

**Note:** Tests will automatically skip live API tests if keys are not set.

---

## Understanding Test Results

### Success Output

```
╔══════════════════════════════════════════════════════════════════╗
║           LangChain/LangGraph Upgrade Validation Summary         ║
╚══════════════════════════════════════════════════════════════════╝

📦 Core Packages:
   • LangGraph:                  1.0.20
   • LangChain:                  0.3.14
   ...

✅ All version requirements met!
```

### Test Markers

- ✅ **Green checkmark**: Test passed
- ⚠️ **Warning**: Test skipped (e.g., API key not set)
- ❌ **Red X**: Test failed

### Common Skipped Tests

Tests that may be skipped (not failures):

- **Live API tests**: Require `OPENAI_API_KEY` environment variable
- **Redis tests**: Require Redis server running
- **Integration tests**: Require full service stack

---

## Test Coverage

### What's Tested

✅ **Package Versions**
- All LangChain ecosystem packages
- Core dependencies (FastAPI, Pydantic, Redis)
- LLM provider SDKs

✅ **LangGraph 1.0 API**
- StateGraph creation and compilation
- Node and edge management
- Checkpoint integration
- Async operations

✅ **Migration Validation**
- No custom RedisCheckpointer class
- AsyncRedisSaver integration
- Automatic checkpoint handling
- No manual checkpoint calls

✅ **OpenAI Integration**
- ChatOpenAI functionality
- Embeddings generation
- Error handling
- Caching

✅ **Stateful Retrieval**
- Pipeline instantiation
- Workflow execution
- Query refinement
- Error fallback

### Coverage Report

Generate detailed coverage report:

```bash
pytest tests/ --cov=app --cov-report=html
open htmlcov/index.html  # View in browser
```

---

## Troubleshooting

### Common Issues

**1. Import Errors**

```
ImportError: cannot import name 'AsyncRedisSaver'
```

**Solution:**
```bash
pip install langgraph-checkpoint-redis>=0.1.1
```

**2. Version Mismatch**

```
AssertionError: LangGraph version 0.2.38 is below required 1.0.0
```

**Solution:**
```bash
pip install --upgrade langgraph>=1.0.20
```

**3. Tests Skipped**

```
⚠️  OPENAI_API_KEY not set - skipping live API test
```

**Solution:** This is expected. Set API key to run live tests:
```bash
export OPENAI_API_KEY="your-key"
pytest tests/test_openai_llm.py -v
```

**4. pytest Not Found**

```
python: No module named pytest
```

**Solution:**
```bash
pip install pytest pytest-asyncio
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Upgrade Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          cd rag-service
          pip install -r requirements.txt
      - name: Run upgrade validation tests
        run: |
          cd rag-service
          python run_upgrade_tests.py --quick --no-live-api
```

### Pre-commit Hook

```bash
# .git/hooks/pre-commit
#!/bin/bash
cd rag-service
python run_upgrade_tests.py --quick --no-live-api
```

---

## Writing New Tests

### Test Template

```python
"""Test module description."""

import pytest
from unittest.mock import Mock


class TestYourFeature:
    """Test class description."""

    def test_basic_functionality(self):
        """Test basic functionality."""
        # Arrange
        expected = "result"

        # Act
        actual = some_function()

        # Assert
        assert actual == expected
        print("✅ Test passed")

    @pytest.mark.asyncio
    async def test_async_functionality(self):
        """Test async functionality."""
        result = await async_function()
        assert result is not None
        print("✅ Async test passed")

    @pytest.mark.skipif(
        not os.getenv("API_KEY"),
        reason="API_KEY not set"
    )
    def test_with_api_key(self):
        """Test requiring API key."""
        # Only runs if API_KEY is set
        pass
```

### Best Practices

1. **Clear test names**: Use descriptive names that explain what's being tested
2. **Print confirmations**: Use `print("✅ ...")` for visibility
3. **Skip gracefully**: Use `pytest.skip()` for optional tests
4. **Mock external calls**: Use `unittest.mock` for external dependencies
5. **Test one thing**: Each test should validate one specific behavior
6. **Add docstrings**: Explain what the test validates

---

## Test Maintenance

### After Upgrade

✅ **Run full test suite**
```bash
python run_upgrade_tests.py --full
```

✅ **Check coverage**
```bash
pytest tests/ --cov=app --cov-report=term-missing
```

✅ **Review deprecation warnings**
```bash
pytest tests/ -W default::DeprecationWarning
```

### Regular Testing

- Run quick tests before commits
- Run full tests before pull requests
- Run with coverage weekly
- Update tests when adding features

---

## Test Results Interpretation

### Expected Results (Success)

```
test_upgrade_validation.py::TestVersionValidation::test_langgraph_version PASSED
test_upgrade_validation.py::TestVersionValidation::test_langchain_version PASSED
test_langgraph_integration.py::TestStateGraphBasics::test_create_stategraph PASSED
...

======================== XX passed, Y skipped in Z.ZZs =========================
```

### Acceptable Skips

- Tests requiring API keys (when not set)
- Tests requiring Redis (when not running)
- Tests requiring full service stack

### Failures to Investigate

- ❌ Version validation failures → Reinstall dependencies
- ❌ Import errors → Missing packages
- ❌ StateGraph compilation failures → API incompatibility
- ❌ Checkpoint tests failing → Migration issue

---

## Support

**Documentation:**
- Upgrade Guide: `rag-service/LANGCHAIN_UPGRADE_GUIDE.md`
- Rollback Guide: `/ROLLBACK.md`
- Project Guide: `/CLAUDE.md`

**Quick Commands:**
```bash
# Validate versions
python -c "import langgraph; print(langgraph.__version__)"
python -c "import langchain; print(langchain.__version__)"

# Run quick test
python run_upgrade_tests.py --quick

# Check what failed
pytest tests/test_upgrade_validation.py -v --tb=short
```

---

## Summary

This test suite ensures:
- ✅ Correct package versions installed
- ✅ LangGraph 1.0 API working correctly
- ✅ Redis checkpoint integration functional
- ✅ OpenAI LLM integration operational
- ✅ Stateful retrieval upgraded successfully
- ✅ No regressions in existing functionality

**Run tests regularly to maintain upgrade compatibility!**
