# Encrypted Q&A Logging System

This document describes the encrypted logging system for storing questions and answers securely to improve RAG retrieval.

## Overview

The encrypted logging system provides:

- **Field-level encryption** for user queries and AI responses
- **Secure key management** with rotation support
- **Transparent encryption/decryption** during storage and retrieval
- **Export capabilities** with automatic decryption
- **Migration tools** for existing data

## Architecture

### Components

1. **Encryption Service** (`app/services/encryption.py`)
   - Handles all encryption/decryption operations
   - Uses Fernet symmetric encryption (AES-128)
   - Supports key versioning for rotation
   - Generates SHA256 hashes for searching

2. **Query Logger** (`app/services/query_logger.py`)
   - Modified to encrypt Q&A pairs before storage
   - Automatically decrypts data during retrieval
   - Maintains backward compatibility with unencrypted data

3. **Database Schema**
   - Added encrypted fields: `user_query_encrypted`, `response_encrypted`
   - Version tracking: `user_query_encryption_version`, `response_encryption_version`
   - Metadata field: `encryption_metadata`

## Setup Instructions

### 1. Generate Encryption Key

```bash
cd rag-service
python app/utils/manage_encryption.py generate
```

Or specify a custom path:

```bash
python app/utils/manage_encryption.py generate --output /secure/path/encryption.key
```

### 2. Configure Environment

Set the encryption key via environment variable:

```bash
export RAG_ENCRYPTION_KEY='<your-generated-key>'
```

Or use the key file (default: `rag-service/.keys/encryption.key`)

### 3. Run Database Migration

```bash
# Apply schema changes
python app/migrations/add_encryption_fields.py

# Optionally migrate existing data
python app/migrations/add_encryption_fields.py --migrate-data
```

### 4. Verify Setup

```bash
python app/utils/manage_encryption.py verify
```

## Configuration

Add to your `.env` file:

```env
RAG_ENCRYPT_QUERY_LOGS=true
RAG_ENCRYPTION_KEY=your-base64-encoded-key
RAG_QUERY_RETENTION_DAYS=90
```

Or configure in `app/core/config.py`:

```python
encrypt_query_logs: bool = True
encryption_key_path: Optional[str] = None
use_env_encryption_key: bool = True
```

## Usage

### Automatic Encryption

Once configured, all Q&A pairs are automatically encrypted:

```python
# Queries are encrypted before storage
await query_logger.log_query(
    query_id=query_id,
    user_query="What is the travel rate?",  # Automatically encrypted
    response="The rate is $150/day",        # Automatically encrypted
    # ... other parameters
)
```

### Automatic Decryption

Data is automatically decrypted when retrieved:

```python
# Queries are decrypted during retrieval
entries = await query_logger.get_query_history(filters)
for entry in entries:
    print(entry.user_query)  # Decrypted automatically
```

### Manual Encryption (if needed)

```python
from app.services.encryption import get_encryption_service

encryption_service = get_encryption_service()

# Encrypt
encrypted_text, version = encryption_service.encrypt_text("sensitive data")

# Decrypt
decrypted_text = encryption_service.decrypt_text(encrypted_text, version)
```

## Key Management

### View Key Information

```bash
python app/utils/manage_encryption.py info
```

### Rotate Keys

```bash
python app/utils/manage_encryption.py rotate
```

### Test Encryption

```bash
python app/utils/manage_encryption.py test
```

## Testing

Run the comprehensive test suite:

```bash
cd rag-service
python app/tests/test_encrypted_logging.py
```

This tests:

- Encryption/decryption functionality
- Database storage and retrieval
- Export capabilities
- Search functionality
- Statistics calculation

## Security Considerations

1. **Key Storage**
   - Store encryption keys securely (use environment variables in production)
   - Set appropriate file permissions (600) on key files
   - Never commit keys to version control

2. **Key Rotation**
   - Rotate keys periodically
   - System supports multiple key versions
   - Old data remains accessible after rotation

3. **Access Control**
   - Limit access to encryption keys
   - Use separate keys for different environments
   - Monitor key usage

4. **Data Retention**
   - Encrypted data is automatically cleaned up based on retention policy
   - Default retention: 90 days
   - Configure via `RAG_QUERY_RETENTION_DAYS`

## Troubleshooting

### Common Issues

1. **"No encryption key found"**
   - Generate a key: `python app/utils/manage_encryption.py generate`
   - Check environment variable: `echo $RAG_ENCRYPTION_KEY`

2. **"Decryption failed"**
   - Verify the correct key is being used
   - Check key version compatibility
   - Ensure data was encrypted with current key

3. **Performance Impact**
   - Encryption adds ~1-2ms per operation
   - Use batch operations for better performance
   - Consider caching decrypted data if needed

### Debug Mode

Enable debug logging:

```python
import logging
logging.getLogger('app.services.encryption').setLevel(logging.DEBUG)
logging.getLogger('app.services.query_logger').setLevel(logging.DEBUG)
```

## Migration Guide

### For Existing Systems

1. **Backup your database** before migration
2. Run schema migration to add encrypted fields
3. Optionally encrypt existing data:
   ```bash
   python app/migrations/add_encryption_fields.py --migrate-data --batch-size 1000
   ```
4. Verify migration:
   ```bash
   python app/migrations/add_encryption_fields.py --verify
   ```

### Rollback Plan

If needed, encryption can be disabled:

1. Set `RAG_ENCRYPT_QUERY_LOGS=false`
2. System will read both encrypted and unencrypted data
3. New data will be stored unencrypted

## Future Improvements

1. **Key Management Service (KMS) Integration**
   - Support for AWS KMS, Azure Key Vault, etc.
   - Hardware Security Module (HSM) support

2. **Field-Level Permissions**
   - Role-based decryption access
   - Audit logging for decryption events

3. **Performance Optimizations**
   - Async encryption operations
   - Caching layer for frequently accessed data

4. **Advanced Features**
   - Searchable encryption
   - Homomorphic encryption for analytics
   - Zero-knowledge proofs for verification
