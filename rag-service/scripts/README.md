# RAG Service Development Scripts

This directory contains development, debugging, and data migration scripts. These are **not** part of the production application.

## Script Categories

### Debug Scripts
- `debug_*.py` - Various debugging utilities for troubleshooting

### Monitor Scripts
- `monitor_*.py` - Tools for monitoring ingestion and document counts

### Data Migration/Fix Scripts
- `fix_*.py` - One-time fixes for data issues
- `migrate_*.py` - Migration scripts between versions
- `rebuild_*.py` - Index rebuilding utilities
- `update_*.py` - Data update scripts

### Ingestion Scripts
- `ingest_*.py` - Manual data ingestion tools
- `submit_*.py` - Batch ingestion submission

### Test/Verify Scripts
- `test_*.py` - Manual testing utilities
- `verify_*.py` - Data verification tools
- `diagnose_*.py` - Diagnostic utilities

## Usage

These scripts are meant to be run manually from the rag-service directory:

```bash
cd rag-service
python scripts/debug_full_pipeline.py
```

Most scripts require the virtual environment to be activated and proper environment variables to be set.
