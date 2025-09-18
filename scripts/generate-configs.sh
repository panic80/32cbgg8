#!/bin/bash

# Configuration Generator Script
# Generates environment-specific configuration files

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
ENVIRONMENT="${ENVIRONMENT:-production}"
DOMAIN="${DOMAIN:-32cbgg8.com}"
PROJECT_DIR="${PROJECT_DIR:-/var/www/cbthis}"

# Functions
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

# Function to generate random string
generate_random_string() {
    local length=${1:-32}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Function to prompt for value with default
prompt_value() {
    local prompt=$1
    local default=$2
    local secret=${3:-false}
    
    if [[ "$secret" == "true" ]]; then
        read -s -p "$prompt [$default]: " value
        echo
    else
        read -p "$prompt [$default]: " value
    fi
    
    echo "${value:-$default}"
}

echo "================================================"
echo "   Configuration Generator"
echo "================================================"
echo "Deployment: PM2/systemd"
echo "Environment: $ENVIRONMENT"
echo "Domain: $DOMAIN"
echo "================================================"
echo ""

# Check if template exists
if [[ ! -f ".env.production.template" ]]; then
    print_error ".env.production.template not found"
    exit 1
fi

# Generate .env.production
print_info "Generating .env.production..."

# Copy template
cp .env.production.template .env.production

# Function to update env file
update_env() {
    local key=$1
    local value=$2
    local file=${3:-.env.production}
    
    if grep -q "^${key}=" "$file"; then
        # Escape special characters for sed
        value=$(echo "$value" | sed 's/[[\.*^$()+?{|]/\\&/g')
        sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    else
        echo "${key}=${value}" >> "$file"
    fi
}

# Set deployment-specific values
update_env "REDIS_URL" "redis://localhost:6379"
update_env "RAG_SERVICE_URL" "http://localhost:8000"

# Set common values
update_env "NODE_ENV" "$ENVIRONMENT"
update_env "APP_URL" "https://$DOMAIN"
update_env "VITE_API_BASE_URL" "https://$DOMAIN"
update_env "CORS_ORIGINS" "https://$DOMAIN,https://www.$DOMAIN"

# Generate session secret if not set
if grep -q "^SESSION_SECRET=change_this" .env.production || ! grep -q "^SESSION_SECRET=" .env.production; then
    SESSION_SECRET=$(generate_random_string 64)
    update_env "SESSION_SECRET" "$SESSION_SECRET"
    print_status "Generated new session secret"
fi

# Prompt for API keys if not set
print_info "Checking API keys..."

# Gemini API Key
if grep -q "^VITE_GEMINI_API_KEY=your_gemini_api_key_here" .env.production || ! grep -q "^VITE_GEMINI_API_KEY=" .env.production; then
    print_warning "Gemini API key not configured"
    GEMINI_KEY=$(prompt_value "Enter Gemini API key" "skip" true)
    if [[ "$GEMINI_KEY" != "skip" ]]; then
        update_env "VITE_GEMINI_API_KEY" "$GEMINI_KEY"
        update_env "GEMINI_API_KEY" "$GEMINI_KEY"  # Also set without VITE_ prefix
    fi
fi

# OpenAI API Key
if grep -q "^OPENAI_API_KEY=your_openai_api_key_here" .env.production || ! grep -q "^OPENAI_API_KEY=" .env.production; then
    print_warning "OpenAI API key not configured"
    OPENAI_KEY=$(prompt_value "Enter OpenAI API key" "skip" true)
    if [[ "$OPENAI_KEY" != "skip" ]]; then
        update_env "OPENAI_API_KEY" "$OPENAI_KEY"
    fi
fi

# Anthropic API Key
if grep -q "^ANTHROPIC_API_KEY=your_anthropic_api_key_here" .env.production || ! grep -q "^ANTHROPIC_API_KEY=" .env.production; then
    print_warning "Anthropic API key not configured"
    ANTHROPIC_KEY=$(prompt_value "Enter Anthropic API key" "skip" true)
    if [[ "$ANTHROPIC_KEY" != "skip" ]]; then
        update_env "ANTHROPIC_API_KEY" "$ANTHROPIC_KEY"
    fi
fi

print_status "Generated .env.production"


# Generate nginx configuration from template
print_info "Generating nginx configuration..."

if [[ -f "nginx.conf.template" ]]; then
    cp nginx.conf.template nginx.conf
    
    # Update domain in nginx.conf if needed
    sed -i "s/32cbgg8.com/$DOMAIN/g" nginx.conf
    
    print_status "Generated nginx.conf"
else
    print_warning "nginx.conf.template not found"
fi

# Generate systemd service for PM2
print_info "Generating systemd service files..."

# RAG service systemd file
cat > cf-rag-service.service << EOF
[Unit]
Description=CF Travel Bot RAG Service
After=network.target redis.service

[Service]
Type=simple
User=deploy
WorkingDirectory=$PROJECT_DIR/rag-service
Environment="PATH=$PROJECT_DIR/rag-service/venv/bin:/usr/local/bin:/usr/bin:/bin"
Environment="PYTHONUNBUFFERED=1"
Environment="SENTENCE_TRANSFORMERS_HOME=$PROJECT_DIR/models"
ExecStart=$PROJECT_DIR/rag-service/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2
Restart=always
RestartSec=10
StandardOutput=append:$PROJECT_DIR/rag-service/logs/rag-service.log
StandardError=append:$PROJECT_DIR/rag-service/logs/rag-service-error.log

[Install]
WantedBy=multi-user.target
EOF

print_status "Generated cf-rag-service.service"

# Generate backup configuration
print_info "Generating backup configuration..."

cat > backup.conf << EOF
# Backup Configuration
BACKUP_DIR="/backup/cbthis"
BACKUP_RETENTION_DAYS=7
BACKUP_SERVER="backup-server.com"
BACKUP_SERVER_PATH="/backups/cbthis"

# What to backup
BACKUP_REDIS=true
BACKUP_CHROMADB=true
BACKUP_COOCCURRENCE=true
BACKUP_ENV_FILES=true
BACKUP_LOGS=false

# Notification
BACKUP_EMAIL="admin@$DOMAIN"
EOF

print_status "Generated backup.conf"

# Summary
echo ""
echo "================================================"
echo "   Configuration Generation Complete"
echo "================================================"
echo ""
echo "Generated files:"
echo "  - .env.production"
echo "  - cf-rag-service.service"
echo "  - nginx.conf"
echo "  - backup.conf"
echo ""
echo "Next steps:"
echo "1. Review generated configurations"
echo "2. Ensure all API keys are properly set"
echo "3. Copy configurations to server"
echo "================================================"
