#!/bin/bash

# Script to check for exposed secrets in the codebase
# Run this before committing code

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== Checking for exposed secrets ===${NC}"
echo ""

FOUND_SECRETS=0

# Patterns to search for
PATTERNS=(
    "sk-proj-"          # OpenAI
    "sk-ant-"           # Anthropic
    "AIzaSy[A-Za-z0-9]"  # Google API keys (actual keys, not format checks)
    "rzrv94"            # Known Redis password
    "Bearer [A-Za-z0-9\-_]+"  # Bearer tokens (actual tokens, not examples)
    "-----BEGIN"        # Private keys
)

# Files to check (excluding test files and node_modules)
FILES_TO_CHECK=$(find . -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.env*" -o -name "*.yml" -o -name "*.yaml" -o -name "*.config.*" \) -not -path "./node_modules/*" -not -path "./dist/*" -not -path "./.git/*" -not -path "./rag-service/venv/*" -not -path "*/__tests__/*" -not -name "*.test.*" -not -name "*.spec.*" 2>/dev/null)

for pattern in "${PATTERNS[@]}"; do
    echo -n "Checking for $pattern... "
    
    matches=$(echo "$FILES_TO_CHECK" | xargs grep -l "$pattern" 2>/dev/null || true)
    
    if [ ! -z "$matches" ]; then
        echo -e "${RED}FOUND!${NC}"
        echo "$matches" | while read file; do
            echo -e "  ${RED}→ $file${NC}"
        done
        FOUND_SECRETS=1
    else
        echo -e "${GREEN}OK${NC}"
    fi
done

echo ""

# Check for .env files that shouldn't exist
echo -n "Checking for .env files with secrets... "
ENV_FILES=$(find . -name ".env*" -not -name ".env.template" -not -name ".env.example" -not -path "./node_modules/*" -not -path "./.git/*" 2>/dev/null)

if [ ! -z "$ENV_FILES" ]; then
    for file in $ENV_FILES; do
        if grep -q -E "(sk-proj-|sk-ant-|AIza)" "$file" 2>/dev/null; then
            echo -e "${RED}FOUND!${NC}"
            echo -e "  ${RED}→ $file contains secrets${NC}"
            FOUND_SECRETS=1
        fi
    done
fi

if [ $FOUND_SECRETS -eq 0 ]; then
    echo -e "${GREEN}OK${NC}"
fi

echo ""

# Final result
if [ $FOUND_SECRETS -eq 1 ]; then
    echo -e "${RED}⚠️  WARNING: Secrets found in codebase!${NC}"
    echo ""
    echo "Actions to take:"
    echo "1. Remove secrets from the files listed above"
    echo "2. Move secrets to /etc/cbthis/env"
    echo "3. Rotate the exposed API keys immediately"
    echo "4. Run this script again to verify"
    exit 1
else
    echo -e "${GREEN}✓ No secrets found in codebase${NC}"
    echo ""
    echo "Safe to commit!"
fi