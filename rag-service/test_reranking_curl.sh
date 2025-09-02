#!/bin/bash

# Test script for reranking using curl
# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}RAG Service Reranking Test - Using curl${NC}"
echo "Testing endpoint: http://localhost:8000/api/v1/streaming_chat"
echo "Date: $(date)"
echo "========================================"

# Function to test a query
test_query() {
    local query="$1"
    local description="$2"
    
    echo -e "\n${YELLOW}Test: ${description}${NC}"
    echo -e "${BLUE}Query: ${query}${NC}"
    echo "----------------------------------------"
    
    # Create JSON payload
    payload=$(cat <<EOF
{
    "message": "${query}",
    "llm_choice": "gemini",
    "conversationId": "test-$(date +%s)",
    "stream": true
}
EOF
)
    
    # Make the request and save response
    echo -e "${GREEN}Sending request...${NC}"
    
    # Use curl with SSE support
    response=$(curl -s -N -X POST http://localhost:8000/api/v1/streaming_chat \
        -H "Content-Type: application/json" \
        -H "Accept: text/event-stream" \
        -d "$payload" 2>&1)
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Failed to connect to service${NC}"
        return
    fi
    
    # Process the response to extract sources
    echo -e "\n${GREEN}Processing response...${NC}"
    
    # Extract sources event
    sources=$(echo "$response" | grep -A1 "event: sources" | grep "^data: " | head -1 | sed 's/^data: //')
    
    if [ ! -z "$sources" ] && [ "$sources" != "[DONE]" ]; then
        # Count sources
        source_count=$(echo "$sources" | jq 'length' 2>/dev/null || echo "0")
        echo -e "${GREEN}Found ${source_count} sources${NC}"
        
        # Show top 3 sources with details
        if [ "$source_count" -gt 0 ]; then
            echo -e "\n${YELLOW}Top sources:${NC}"
            echo "$sources" | jq -r '.[:3] | to_entries | .[] | 
                "\(.key + 1). \(.value.metadata.title // "Unknown") (score: \(.value.relevance_score // 0))\n   Content: \(.value.page_content[:100])..."' 2>/dev/null || echo "Error parsing sources"
        fi
    else
        echo -e "${RED}No sources found in response${NC}"
    fi
    
    # Count citations
    citation_count=$(echo "$response" | grep -c "event: citation")
    echo -e "\n${GREEN}Citations used: ${citation_count}${NC}"
    
    # Extract some content
    content=$(echo "$response" | grep -A1 "event: content" | grep "^data: " | head -5 | sed 's/^data: //' | jq -r '.content' 2>/dev/null | tr '\n' ' ')
    
    if [ ! -z "$content" ]; then
        echo -e "\n${YELLOW}Response preview:${NC}"
        echo "$content" | head -c 200
        echo "..."
    fi
}

# Test various queries
echo -e "\n${BLUE}Running test queries...${NC}\n"

test_query "What is the meal allowance for Yukon?" "Testing specific regional meal allowance"
sleep 2

test_query "Ontario kilometric rate" "Testing provincial kilometric rate"
sleep 2

test_query "What are the travel allowances for British Columbia?" "Testing comprehensive provincial allowances"
sleep 2

test_query "hotel rates in Alberta" "Testing accommodation-specific query"
sleep 2

test_query "incidental expenses Northwest Territories" "Testing territory-specific incidental expenses"

echo -e "\n\n${BLUE}========================================"
echo -e "Test Summary${NC}"
echo "========================================"
echo -e "${GREEN}✓ All queries executed${NC}"
echo -e "\nTo manually test a query, use:"
echo 'curl -N -X POST http://localhost:8000/api/v1/streaming_chat \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '"'"'{"message": "your query here", "llm_choice": "gemini", "conversationId": "test-123", "stream": true}'"'"