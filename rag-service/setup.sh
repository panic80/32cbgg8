#!/bin/bash

# Setup script for RAG service

echo "🚀 Setting up Canadian Forces Travel Instructions RAG Service..."

# Check if Python 3.11+ is installed
python_version=$(python3 --version 2>&1 | awk '{print $2}')
if [[ -z "$python_version" ]]; then
    echo "❌ Python 3 is not installed. Please install Python 3.11 or higher."
    exit 1
fi

echo "✅ Python $python_version detected"

# Create virtual environment
echo "📦 Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "📚 Installing dependencies..."
pip install -r requirements.txt

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p chroma_db logs

# Check for environment variables
echo "🔍 Checking environment configuration..."
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from example..."
    cat > .env << EOF
# API Keys
OPENAI_API_KEY=your_openai_key_here
VITE_GEMINI_API_KEY=your_gemini_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here

# Redis Configuration
REDIS_URL=redis://localhost:6379

# RAG Configuration
RAG_CHUNK_SIZE=1000
RAG_CHUNK_OVERLAP=200
RAG_RETRIEVAL_K=5
EOF
    echo "⚠️  Please edit .env file and add your API keys"
else
    echo "✅ .env file found"
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file and add your API keys"
echo "2. Start Redis (e.g., systemctl start redis-server)"
echo "3. Activate venv: source venv/bin/activate"
echo "4. Run the service: uvicorn app.main:app --reload --port 8000"
echo "5. Review DEPLOYMENT_GUIDE.md for systemd setup"
echo ""
echo "📖 API docs will be available at: http://localhost:8000/api/v1/docs"
