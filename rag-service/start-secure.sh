#!/bin/bash
# Secure startup script for RAG service

# Load secure environment variables
if [ -f /etc/cbthis/rag-env ]; then
    echo "Loading secure environment variables..."
    set -a  # Export all variables
    source /etc/cbthis/rag-env
    set +a
else
    echo "Warning: Secure environment file not found at /etc/cbthis/rag-env"
fi

# Activate virtual environment
source venv/bin/activate

# Start the RAG service
echo "Starting RAG service..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload