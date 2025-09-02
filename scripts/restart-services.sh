#!/bin/bash

# Script to restart all services with secure environment variables

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== Restarting CBTHIS Services ===${NC}"
echo ""

# Restart PM2 services (Express backend)
echo -e "${YELLOW}Restarting Express backend via PM2...${NC}"
pm2 restart all --update-env
sleep 2
pm2 status

echo ""

# Restart RAG service
echo -e "${YELLOW}Restarting RAG service...${NC}"

# Kill existing RAG processes
pkill -f "uvicorn app.main:app" 2>/dev/null || true
sleep 2

# Start RAG service with secure environment
cd /var/www/cbthis/rag-service
source /etc/cbthis/rag-env
source venv/bin/activate
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > /var/log/cbthis/rag.log 2>&1 &
echo "RAG service started with PID $!"

echo ""
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 5

# Verify services are healthy
echo ""
echo -e "${YELLOW}Checking service health...${NC}"

EXPRESS_HEALTH=$(curl -s http://localhost:3000/health | jq -r '.status' 2>/dev/null || echo "error")
RAG_HEALTH=$(curl -s http://localhost:8000/api/v1/health | jq -r '.status' 2>/dev/null || echo "error")

if [ "$EXPRESS_HEALTH" = "healthy" ]; then
    echo -e "Express backend: ${GREEN}✓ Healthy${NC}"
else
    echo -e "Express backend: ${RED}✗ Not responding${NC}"
fi

if [ "$RAG_HEALTH" = "healthy" ]; then
    echo -e "RAG service: ${GREEN}✓ Healthy${NC}"
else
    echo -e "RAG service: ${RED}✗ Not responding${NC}"
fi

echo ""
echo -e "${GREEN}=== Services Restarted ===${NC}"
echo ""
echo "Logs:"
echo "  Express: pm2 logs cf-travel-bot"
echo "  RAG: tail -f /var/log/cbthis/rag.log"