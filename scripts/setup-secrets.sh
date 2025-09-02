#!/bin/bash

# Setup script for secure environment variables
# This script helps set up or update the secure environment files

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running with appropriate permissions
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}Please don't run this script as root${NC}"
   echo "Run as a regular user with sudo access"
   exit 1
fi

echo -e "${GREEN}=== CBTHIS Secure Environment Setup ===${NC}"
echo ""

# Create secure directory if it doesn't exist
if [ ! -d /etc/cbthis ]; then
    echo -e "${YELLOW}Creating secure directory /etc/cbthis...${NC}"
    sudo mkdir -p /etc/cbthis
    sudo chmod 700 /etc/cbthis
fi

# Function to prompt for a secret
prompt_secret() {
    local var_name=$1
    local var_desc=$2
    local current_value=$3
    
    echo -e "${YELLOW}$var_desc${NC}"
    if [ ! -z "$current_value" ]; then
        echo "Current value: ${current_value:0:8}..."
        read -p "Keep current value? (y/n): " keep_current
        if [ "$keep_current" = "y" ]; then
            echo "$current_value"
            return
        fi
    fi
    
    read -sp "Enter new value: " new_value
    echo ""
    echo "$new_value"
}

# Check if env file exists and load current values if present
if [ -f /etc/cbthis/env ]; then
    echo -e "${YELLOW}Found existing secure environment file${NC}"
    read -p "Do you want to update it? (y/n): " update_existing
    if [ "$update_existing" != "y" ]; then
        echo "Exiting without changes"
        exit 0
    fi
    
    # Load existing values (carefully)
    if sudo test -r /etc/cbthis/env; then
        eval $(sudo grep -E '^[A-Z_]+=' /etc/cbthis/env | sed 's/^/OLD_/')
    fi
fi

echo ""
echo -e "${GREEN}Enter your API keys and secrets:${NC}"
echo "(Press Enter to keep existing values where shown)"
echo ""

# Prompt for each secret
OPENAI_KEY=$(prompt_secret "OPENAI_API_KEY" "OpenAI API Key:" "$OLD_OPENAI_API_KEY")
ANTHROPIC_KEY=$(prompt_secret "ANTHROPIC_API_KEY" "Anthropic API Key:" "$OLD_ANTHROPIC_API_KEY")
GEMINI_KEY=$(prompt_secret "VITE_GEMINI_API_KEY" "Google Gemini API Key:" "$OLD_VITE_GEMINI_API_KEY")
MAPS_KEY=$(prompt_secret "GOOGLE_MAPS_API_KEY" "Google Maps API Key:" "$OLD_GOOGLE_MAPS_API_KEY")
VITE_MAPS_KEY=$(prompt_secret "VITE_GOOGLE_MAPS_API_KEY" "Vite Google Maps API Key:" "$OLD_VITE_GOOGLE_MAPS_API_KEY")
REDIS_PASS=$(prompt_secret "REDIS_PASSWORD" "Redis Password:" "$OLD_REDIS_PASSWORD")

# Create the secure environment file
echo ""
echo -e "${YELLOW}Creating secure environment file...${NC}"

sudo tee /etc/cbthis/env > /dev/null << EOF
# Secure Environment Variables for CBTHIS Application
# Generated on $(date)
# This file contains sensitive credentials and should NEVER be committed to version control

# API Keys - SENSITIVE
OPENAI_API_KEY=$OPENAI_KEY
ANTHROPIC_API_KEY=$ANTHROPIC_KEY
VITE_GEMINI_API_KEY=$GEMINI_KEY
GOOGLE_MAPS_API_KEY=$MAPS_KEY
VITE_GOOGLE_MAPS_API_KEY=$VITE_MAPS_KEY

# Database Passwords - SENSITIVE
REDIS_PASSWORD=$REDIS_PASS
EOF

# Set proper permissions
sudo chmod 600 /etc/cbthis/env
echo -e "${GREEN}Created /etc/cbthis/env with secure permissions${NC}"

# Create RAG service env file
echo ""
echo -e "${YELLOW}Creating RAG service environment file...${NC}"

sudo tee /etc/cbthis/rag-env > /dev/null << EOF
# Secure Environment Variables for RAG Service
# Generated on $(date)

# API Keys - SENSITIVE
OPENAI_API_KEY=$OPENAI_KEY
ANTHROPIC_API_KEY=$ANTHROPIC_KEY
VITE_GEMINI_API_KEY=$GEMINI_KEY

# Redis Password - SENSITIVE
REDIS_PASSWORD=$REDIS_PASS
EOF

sudo chmod 600 /etc/cbthis/rag-env
echo -e "${GREEN}Created /etc/cbthis/rag-env with secure permissions${NC}"

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Restart the application: pm2 restart all"
echo "2. Restart RAG service: cd rag-service && ./start-secure.sh"
echo "3. Verify everything works: curl http://localhost:3000/health"
echo ""
echo -e "${YELLOW}IMPORTANT:${NC}"
echo "- Never commit /etc/cbthis/* files to version control"
echo "- Keep backups of your API keys in a secure password manager"
echo "- Rotate API keys regularly (every 90 days recommended)"
echo ""