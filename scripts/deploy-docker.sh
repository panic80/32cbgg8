#!/bin/bash

# Simple Docker Deployment Script for CF Travel Bot
# Deploys to VPS at 46.202.177.230 (32cbgg8.com)

set -euo pipefail

# Configuration
VPS_HOST="46.202.177.230"
VPS_USER="root"
DOMAIN="32cbgg8.com"
PROJECT_DIR="/var/www/cbthis"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="cbthis-production-${TIMESTAMP}.tar.gz"

echo "================================================"
echo "   CF Travel Bot Docker Deployment"
echo "================================================"
echo "Target: ${VPS_USER}@${VPS_HOST}"
echo "Domain: ${DOMAIN}"
echo "Package: ${PACKAGE_NAME}"
echo "================================================"
echo ""

# Confirm deployment
read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""
echo "Step 1: Creating deployment package..."

# Create deployment package
tar -czf "${PACKAGE_NAME}" \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=.env.local \
    --exclude=.env.development \
    --exclude=venv \
    --exclude=__pycache__ \
    --exclude='*.pyc' \
    --exclude=logs \
    --exclude=chroma_db \
    --exclude=models \
    --exclude='*.tar.gz' \
    dist \
    server \
    package*.json \
    ecosystem.config.cjs \
    rag-service \
    docker-compose.yml \
    docker-compose.prod.yml \
    Dockerfile \
    nginx.conf \
    nginx.conf.template \
    scripts \
    .dockerignore \
    .env.production \
    .env.production.template

echo "✓ Package created: ${PACKAGE_NAME}"

echo ""
echo "Step 2: Uploading to VPS..."

# Create deployment directory on VPS
ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p /tmp/cbthis-deploy"

# Upload package
scp "${PACKAGE_NAME}" "${VPS_USER}@${VPS_HOST}:/tmp/cbthis-deploy/"
echo "✓ Package uploaded"

# Upload deployment scripts
scp scripts/remote-deploy-docker.sh "${VPS_USER}@${VPS_HOST}:/tmp/cbthis-deploy/"
echo "✓ Scripts uploaded"

echo ""
echo "Step 3: Executing remote deployment..."

# Execute remote deployment
ssh "${VPS_USER}@${VPS_HOST}" << EOF
export DEPLOYMENT_METHOD=docker
export ENVIRONMENT=production
export PACKAGE_NAME="${PACKAGE_NAME}"
export PROJECT_DIR="${PROJECT_DIR}"
export DOMAIN="${DOMAIN}"
cd /tmp/cbthis-deploy
chmod +x remote-deploy-docker.sh
./remote-deploy-docker.sh
EOF

# Cleanup local package
rm -f "${PACKAGE_NAME}"

echo ""
echo "================================================"
echo "   Deployment Complete!"
echo "================================================"
echo "Application URL: https://${DOMAIN}"
echo "Health Check: https://${DOMAIN}/health"
echo ""
echo "To monitor logs:"
echo "ssh ${VPS_USER}@${VPS_HOST} 'cd ${PROJECT_DIR} && docker-compose logs -f'"
echo "================================================"