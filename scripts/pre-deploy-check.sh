#!/bin/bash

# Pre-Deployment Check Script (Simple Output Version)
# Validates deployment readiness without color codes

set -euo pipefail

# Configuration
VPS_HOST="${VPS_HOST:-46.202.177.230}"
VPS_USER="${VPS_USER:-root}"
DOMAIN="${DOMAIN:-32cbgg8.com}"
DEPLOYMENT_METHOD="${DEPLOYMENT_METHOD:-}"

# Simple output functions
print_status() {
    echo "[OK] $1"
}

print_error() {
    echo "[ERROR] $1"
}

print_warning() {
    echo "[WARNING] $1"
}

print_info() {
    echo "[INFO] $1"
}

# Track errors
ERROR_COUNT=0
WARNING_COUNT=0

echo "================================================"
echo "   Pre-Deployment Validation"
echo "================================================"
echo "Target: $VPS_HOST"
echo "Domain: $DOMAIN"
echo "Date: $(date)"
echo "================================================"
echo ""

# Check local dependencies
echo "1. Checking Local Dependencies..."
echo ""

# Node.js
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    print_status "Node.js installed: $NODE_VERSION"
else
    print_error "Node.js not installed"
    ((ERROR_COUNT++))
fi

# npm
if command -v npm >/dev/null 2>&1; then
    NPM_VERSION=$(npm --version)
    print_status "npm installed: $NPM_VERSION"
else
    print_error "npm not installed"
    ((ERROR_COUNT++))
fi

# Python
if command -v python3 >/dev/null 2>&1; then
    PYTHON_VERSION=$(python3 --version)
    print_status "Python installed: $PYTHON_VERSION"
else
    print_error "Python 3 not installed"
    ((ERROR_COUNT++))
fi

echo ""

# Check project structure
echo "2. Checking Project Structure..."
echo ""

REQUIRED_FILES=(
    "package.json"
    "server/main.js"
    "rag-service/app/main.py"
    ".env.production.template"
    "ecosystem.config.cjs"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        print_status "Found: $file"
    else
        print_error "Missing: $file"
        ((ERROR_COUNT++))
    fi
done

echo ""

# Check VPS connectivity
echo "3. Checking VPS Connectivity..."
echo ""

# Test SSH connection
if ssh -o ConnectTimeout=15 -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" "echo 'SSH connection successful'" >/dev/null 2>&1; then
    print_status "SSH connection to VPS successful"
    
    # Check VPS resources
    echo ""
    echo "VPS Resources:"
    ssh "$VPS_USER@$VPS_HOST" "
        echo -n 'CPU Cores: '; nproc
        echo -n 'Total Memory: '; free -h | grep Mem | awk '{print \$2}'
        echo -n 'Available Memory: '; free -h | grep Mem | awk '{print \$7}'
        echo -n 'Disk Space: '; df -h / | tail -1 | awk '{print \"Used: \" \$3 \" / \" \$2 \" (\" \$5 \")\"}'
    " 2>/dev/null || print_warning "Failed to get VPS resources"
else
    print_error "Cannot connect to VPS via SSH"
    ((ERROR_COUNT++))
fi

echo ""

# Check environment configuration
echo "4. Checking Environment Configuration..."
echo ""

if [[ -f ".env.production" ]]; then
    print_status "Found .env.production"
    
    # Check for placeholder API keys
    if grep -q "your_.*_api_key_here" .env.production; then
        print_error "Found placeholder API keys in .env.production"
        ((ERROR_COUNT++))
    fi
    
    # Check critical variables
    CRITICAL_VARS=(
        "VITE_API_BASE_URL"
        "GEMINI_API_KEY"
        "NODE_ENV"
        "PORT"
    )
    
    for var in "${CRITICAL_VARS[@]}"; do
        if grep -q "^$var=" .env.production; then
            print_status "Found variable: $var"
        else
            print_error "Missing variable: $var"
            ((ERROR_COUNT++))
        fi
    done
else
    print_warning ".env.production not found (will use template)"
    ((WARNING_COUNT++))
fi

echo ""

# Check DNS
echo "5. Checking DNS Configuration..."
echo ""

if command -v dig >/dev/null 2>&1; then
    DNS_IP=$(dig +short "$DOMAIN" 2>/dev/null | head -1)
    if [[ "$DNS_IP" == "$VPS_HOST" ]]; then
        print_status "DNS configured correctly: $DOMAIN -> $VPS_HOST"
    else
        print_warning "DNS mismatch: $DOMAIN -> $DNS_IP (expected $VPS_HOST)"
        ((WARNING_COUNT++))
    fi
else
    print_info "dig command not available, skipping DNS check"
fi

echo ""

# Check build artifacts
echo "6. Checking Build Artifacts..."
echo ""

if [[ -d "dist" && -f "dist/index.html" ]]; then
    BUILD_TIME=$(stat -f "%Sm" dist/index.html 2>/dev/null || stat -c "%y" dist/index.html 2>/dev/null || echo "unknown")
    print_status "Found production build (created: $BUILD_TIME)"
else
    print_warning "No production build found (run 'npm run build')"
    ((WARNING_COUNT++))
fi

echo ""

# Summary
echo "================================================"
echo "   Validation Summary"
echo "================================================"
echo "Errors: $ERROR_COUNT"
echo "Warnings: $WARNING_COUNT"
echo ""

if [[ $ERROR_COUNT -eq 0 ]]; then
    echo "Status: READY FOR DEPLOYMENT"
    echo ""
    echo "Next steps:"
    echo "1. Build the application: npm run build"
    echo "2. Deploy via PM2 scripts or GitHub Actions"
else
    echo "Status: NOT READY - Fix errors before deployment"
    exit 1
fi

echo "================================================"
