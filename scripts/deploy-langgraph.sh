#!/bin/bash
# Deployment script for LangGraph Stateful Retrieval to VPS 46.202.177.230
set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() { echo -e "${GREEN}[?]${NC} $1"; }
print_error() { echo -e "${RED}[?]${NC} $1"; }
print_info() { echo -e "${BLUE}[i]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }

VPS_IP="46.202.177.230"
VPS_USER="root"  # Change to "deploy" if using non-root user
APP_DIR="/var/www/cbthis"

echo ""
echo "========================================"
echo "  LangGraph Deployment to VPS"
echo "========================================"
echo ""

# Check if we can reach the VPS
print_info "Checking VPS connectivity..."
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes ${VPS_USER}@${VPS_IP} exit 2>/dev/null; then
    print_error "Cannot connect to VPS ${VPS_IP}"
    print_info "Make sure SSH keys are set up: ssh-copy-id ${VPS_USER}@${VPS_IP}"
    exit 1
fi
print_status "VPS is reachable"

# Deploy function
deploy() {
    print_info "Deploying to ${VPS_IP}..."
    
    ssh ${VPS_USER}@${VPS_IP} bash <<'ENDSSH'
set -e

echo "[i] Pulling latest code..."
cd /var/www/cbthis
git pull origin main

echo "[i] Updating Python dependencies..."
cd rag-service
source venv/bin/activate
pip install langgraph==0.2.38 --quiet

echo "[?] Dependencies installed"

# Check if environment file exists
if [ ! -f /etc/cbthis/rag-env ]; then
    echo "[!] Warning: /etc/cbthis/rag-env not found, creating..."
    sudo mkdir -p /etc/cbthis
    sudo touch /etc/cbthis/rag-env
fi

# Check if stateful retrieval config exists
if ! grep -q "RAG_ENABLE_STATEFUL_RETRIEVAL" /etc/cbthis/rag-env; then
    echo "[i] Adding LangGraph configuration to environment..."
    sudo tee -a /etc/cbthis/rag-env > /dev/null <<'EOF'

# LangGraph Stateful Retrieval Configuration
RAG_ENABLE_STATEFUL_RETRIEVAL=true
RAG_MAX_RETRIEVAL_ITERATIONS=2
RAG_RELEVANCE_THRESHOLD=0.4
RAG_REDIS_URL=redis://localhost:6379
EOF
    echo "[?] Configuration added"
else
    echo "[?] Configuration already exists"
fi

# Verify Redis is running
echo "[i] Checking Redis..."
if ! systemctl is-active --quiet redis-server; then
    echo "[!] Redis not running, starting..."
    sudo systemctl start redis-server
    sudo systemctl enable redis-server
fi

if redis-cli ping > /dev/null 2>&1; then
    echo "[?] Redis is running"
else
    echo "[?] Redis connection failed"
    exit 1
fi

# Restart RAG service
echo "[i] Restarting RAG service..."
sudo systemctl restart rag-service.service

# Wait for service to start
sleep 3

# Check service status
if systemctl is-active --quiet rag-service.service; then
    echo "[?] RAG service is running"
else
    echo "[?] RAG service failed to start"
    echo "Checking logs..."
    sudo journalctl -u rag-service.service -n 20 --no-pager
    exit 1
fi

# Test health endpoint
echo "[i] Testing health endpoint..."
if curl -f -s http://localhost:8000/health > /dev/null; then
    echo "[?] Health check passed"
else
    echo "[?] Health check failed"
    exit 1
fi

# Rebuild frontend
echo "[i] Rebuilding frontend..."
cd /var/www/cbthis
npm run build --silent

# Reload PM2
echo "[i] Reloading PM2..."
pm2 reload cf-travel-bot --update-env

echo ""
echo "========================================"
echo "  ? Deployment Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Check logs: sudo journalctl -u rag-service.service -f"
echo "2. Monitor Redis: redis-cli MONITOR"
echo "3. Test queries on your website"
echo ""

ENDSSH
}

# Run deployment
deploy

if [ $? -eq 0 ]; then
    print_status "Deployment successful!"
    echo ""
    print_info "Verification steps:"
    echo "  1. SSH to VPS: ssh ${VPS_USER}@${VPS_IP}"
    echo "  2. Check logs: sudo journalctl -u rag-service.service -f"
    echo "  3. Check Redis: redis-cli KEYS 'langgraph:checkpoint:*'"
    echo "  4. Test on your website with queries like:"
    echo "     - 'What meal rate?' (should trigger refinement)"
    echo "     - 'What is the meal allowance rate for Toronto?' (should not)"
    echo ""
else
    print_error "Deployment failed!"
    exit 1
fi

