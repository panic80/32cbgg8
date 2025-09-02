# Query Logging System

This document describes the query logging system for the RAG service, including encrypted storage of questions and answers for improving retrieval performance.

## Overview

The query logging system captures all user queries and AI responses, storing them securely with encryption for later analysis and RAG improvement. The system features:

- **Automatic encryption** of sensitive Q&A data
- **Comprehensive logging** of query metadata
- **Easy viewing tools** with automatic decryption
- **Export capabilities** for analysis
- **Retention policies** for data management

## Architecture

### Components

1. **Query Logger** (`app/services/query_logger.py`)
   - Handles all query logging operations
   - Integrates with encryption service
   - Manages database operations
   - Singleton pattern for consistent access

2. **Encryption Service** (`app/services/encryption.py`)
   - AES-128 encryption using Fernet
   - Key management and rotation
   - Transparent encryption/decryption
   - SHA256 hashing for searchability

3. **Database Schema**
   - SQLite database: `chroma_db/query_history.db`
   - Encrypted fields for queries and responses
   - Metadata tracking for analysis
   - Indexed for performance

## Viewing Logs

### Basic Usage

```bash
cd /var/www/cbthis/rag-service

# View recent queries
./venv/bin/python -m app.utils.view_logs

# View with responses
./venv/bin/python -m app.utils.view_logs --show-response

# View more entries
./venv/bin/python -m app.utils.view_logs --limit 50
```

### Filtering Options

```bash
# By time period
./venv/bin/python -m app.utils.view_logs --days 7

# By provider
./venv/bin/python -m app.utils.view_logs --provider openai

# By status
./venv/bin/python -m app.utils.view_logs --status success

# Search queries
./venv/bin/python -m app.utils.view_logs --search "meal allowance"

# View specific query
./venv/bin/python -m app.utils.view_logs --id "query-id-here"
```

### Example Output

```
=== Query Logs (Last 7 days, showing 10/10 max) ===

+---------------------+----------------------------------------+----------+---------+-----+-------+---------+
| Timestamp           | Query                                  | Provider | Model   | RAG | Time  | Status  |
+=====================+========================================+==========+=========+=====+=======+=========+
| 2025-07-06 17:15:23 | What is the meal allowance for Ottawa? | openai   | gpt-4   | Yes | 2.34s | success |
| 2025-07-06 17:10:15 | How do I claim travel expenses?        | google   | gemini  | Yes | 1.98s | success |
+---------------------+----------------------------------------+----------+---------+-----+-------+---------+

Total queries shown: 2

=== Statistics (Last 7 days) ===
Total queries: 2
Successful: 2
Failed: 0
Average processing time: 2.16s
Total tokens used: 650
```

## Encryption Details

### How It Works

1. **Automatic Encryption**: When a query is logged, both the user question and AI response are automatically encrypted before storage
2. **Transparent Decryption**: When viewing logs, data is automatically decrypted for display
3. **Database Storage**: The database stores encrypted data with markers like `[ENCRYPTED-v1]`
4. **Key Management**: Encryption keys are stored securely and can be rotated

### Key Management

```bash
# View encryption status
./venv/bin/python app/utils/manage_encryption.py info

# Generate new key
./venv/bin/python app/utils/manage_encryption.py generate

# Test encryption
./venv/bin/python app/utils/manage_encryption.py test

# Verify setup
./venv/bin/python app/utils/manage_encryption.py verify

# Rotate keys
./venv/bin/python app/utils/manage_encryption.py rotate
```

### Encryption Configuration

The system uses these settings from `app/core/config.py`:
- `enable_query_logging: bool = True` - Enable/disable logging
- `encrypt_query_logs: bool = True` - Enable/disable encryption
- `query_retention_days: int = 90` - How long to keep logs
- `anonymize_query_logs: bool = False` - Hash queries for privacy

Environment variables:
- `RAG_ENCRYPTION_KEY` - Base64 encoded encryption key
- `RAG_ENABLE_QUERY_LOGGING` - Enable/disable logging
- `RAG_ENCRYPT_QUERY_LOGS` - Enable/disable encryption

## Database Schema

### query_history Table

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Unique query identifier |
| timestamp | DATETIME | When query was made |
| user_query | TEXT | Query text (shows `[ENCRYPTED-v1]` when encrypted) |
| user_query_hash | TEXT | SHA256 hash for searching |
| user_query_encrypted | TEXT | Encrypted query data |
| user_query_encryption_version | TEXT | Encryption version used |
| provider | TEXT | LLM provider (openai, google, anthropic) |
| model | TEXT | Model name used |
| use_rag | BOOLEAN | Whether RAG was enabled |
| response_preview | TEXT | First 500 chars of response |
| response_encrypted | TEXT | Full encrypted response |
| response_encryption_version | TEXT | Response encryption version |
| sources_count | INTEGER | Number of RAG sources used |
| processing_time | REAL | Total time in seconds |
| tokens_used | INTEGER | Tokens consumed |
| conversation_id | TEXT | Conversation context ID |
| status | TEXT | success, error, timeout, cancelled |
| error_message | TEXT | Error details if failed |
| metadata | TEXT | JSON metadata |
| encryption_metadata | TEXT | Encryption details |
| created_at | DATETIME | Database insertion time |

## Exporting Data

### Export to CSV
```bash
python -c "
from app.services.query_logger import get_query_logger
from app.models.query_history import QueryHistoryFilter, QueryExportRequest
import asyncio

async def export():
    ql = get_query_logger()
    req = QueryExportRequest(
        filters=QueryHistoryFilter(limit=1000),
        format='csv',
        include_responses=True
    )
    data = await ql.export_queries(req)
    with open('queries.csv', 'w') as f:
        f.write(data)
    print('Exported to queries.csv')

asyncio.run(export())
"
```

### Export to JSON
```bash
python -c "
from app.services.query_logger import get_query_logger
from app.models.query_history import QueryHistoryFilter, QueryExportRequest
import asyncio

async def export():
    ql = get_query_logger()
    req = QueryExportRequest(
        filters=QueryHistoryFilter(limit=1000),
        format='json',
        include_responses=True
    )
    data = await ql.export_queries(req)
    with open('queries.json', 'w') as f:
        f.write(data)
    print('Exported to queries.json')

asyncio.run(export())
"
```

## Troubleshooting

### No Queries Showing Up

1. Check if logging is enabled:
   ```bash
   ./venv/bin/python -c "from app.core.config import settings; print(f'Logging enabled: {settings.enable_query_logging}')"
   ```

2. Check database exists:
   ```bash
   ls -la chroma_db/query_history.db
   ```

3. Test logging directly:
   ```bash
   ./venv/bin/python test_query_logging.py
   ```

### Decryption Errors

1. Verify encryption key exists:
   ```bash
   ./venv/bin/python app/utils/manage_encryption.py info
   ```

2. Test encryption functionality:
   ```bash
   ./venv/bin/python app/utils/manage_encryption.py test
   ```

### Known Issues

1. **Streaming Endpoint**: The streaming chat endpoint (`/api/v1/streaming_chat`) has a bug where queries aren't being logged properly during actual usage. The logging code is in place but may not execute due to the async streaming nature.

2. **Time Zone**: Timestamps are stored in UTC. The deprecation warnings about `datetime.utcnow()` can be ignored for now.

## Using Logged Data for RAG Improvement

The logged Q&A pairs can be used to:

1. **Analyze Query Patterns**: Identify common questions and topics
2. **Evaluate Retrieval Quality**: Check which queries had good/poor retrieval
3. **Fine-tune Embeddings**: Use Q&A pairs for embedding model training
4. **Improve Prompts**: Analyze successful responses for prompt engineering
5. **Create Test Sets**: Build evaluation datasets from real usage

### Analysis Example

```python
import sqlite3
import json
from collections import Counter

# Analyze query patterns
conn = sqlite3.connect('chroma_db/query_history.db')
cursor = conn.execute("""
    SELECT user_query_encrypted, user_query_encryption_version, metadata 
    FROM query_history 
    WHERE status = 'success' AND use_rag = 1
""")

# Decrypt and analyze
from app.services.encryption import get_encryption_service
enc = get_encryption_service()

topics = []
for encrypted, version, metadata in cursor:
    if encrypted:
        query = enc.decrypt_text(encrypted, version)
        # Extract topics/keywords
        if 'meal' in query.lower():
            topics.append('meal_allowance')
        elif 'travel' in query.lower():
            topics.append('travel_expenses')
        # etc...

# Show most common topics
topic_counts = Counter(topics)
print("Most common query topics:")
for topic, count in topic_counts.most_common(10):
    print(f"  {topic}: {count}")
```

## Security Considerations

1. **Encryption Keys**: 
   - Store keys securely (use environment variables in production)
   - Rotate keys periodically
   - Never commit keys to version control

2. **Access Control**:
   - Limit who can view query logs
   - Consider role-based access for sensitive data
   - Monitor access to encryption keys

3. **Data Retention**:
   - Configure appropriate retention periods
   - Regularly clean up old data
   - Consider anonymization for long-term storage

4. **Compliance**:
   - Ensure logging complies with privacy regulations
   - Document what data is logged and why
   - Provide data deletion capabilities if required

## Future Enhancements

1. **Real-time Analytics Dashboard**: Web interface for query analysis
2. **Automated RAG Evaluation**: Use logged data to measure retrieval quality
3. **Query Clustering**: Group similar queries for pattern analysis
4. **A/B Testing Support**: Log experiment variations for comparison
5. **Integration with LangSmith**: Export data for advanced tracing