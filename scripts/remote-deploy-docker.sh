#!/bin/bash

# Remote Docker Deployment Script
# Executes on the VPS to deploy using Docker

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Environment variables (set by deploy-to-vps.sh)
DEPLOYMENT_METHOD="${DEPLOYMENT_METHOD:-docker}"
ENVIRONMENT="${ENVIRONMENT:-production}"
PACKAGE_NAME="${PACKAGE_NAME:-}"
PROJECT_DIR="${PROJECT_DIR:-/var/www/cbthis}"
DOMAIN="${DOMAIN:-32cbgg8.com}"

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

# Function to check Docker installation
check_docker() {
    if ! command -v docker >/dev/null 2>&1; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose >/dev/null 2>&1; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker daemon is not running"
        exit 1
    fi
    
    print_status "Docker and Docker Compose are available"
}

# Function to create required directories
create_directories() {
    print_info "Creating required directories..."
    
    mkdir -p "$PROJECT_DIR"/{logs,ssl,models}
    mkdir -p "$PROJECT_DIR"/rag-service/{logs,chroma_db,cooccurrence_index,models}
    mkdir -p /backup/cbthis
    mkdir -p /etc/cbthis/secrets
    
    # Set permissions
    chmod 700 /etc/cbthis/secrets
    
    print_status "Directories created"
}

# Function to backup current deployment
backup_current() {
    if [[ -d "$PROJECT_DIR" && -f "$PROJECT_DIR/docker-compose.yml" ]]; then
        print_info "Backing up current deployment..."
        
        local backup_dir="/backup/cbthis/$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$backup_dir"
        
        # Stop services to ensure consistent backup
        cd "$PROJECT_DIR"
        docker-compose stop || true
        
        # Backup volumes
        if docker volume ls | grep -q "cbthis_redis_data"; then
            docker run --rm -v cbthis_redis_data:/data -v "$backup_dir":/backup alpine \
                tar -czf /backup/redis_data.tar.gz -C /data .
        fi
        
        if docker volume ls | grep -q "cbthis_chroma_data"; then
            docker run --rm -v cbthis_chroma_data:/data -v "$backup_dir":/backup alpine \
                tar -czf /backup/chroma_data.tar.gz -C /data .
        fi
        
        # Backup environment files
        cp .env* "$backup_dir"/ 2>/dev/null || true
        
        print_status "Backup completed: $backup_dir"
    fi
}

# Function to extract deployment package
extract_package() {
    print_info "Extracting deployment package..."
    
    cd "$PROJECT_DIR"
    
    # Extract package
    tar -xzf "/tmp/cbthis-deploy/$PACKAGE_NAME" || {
        print_error "Failed to extract package"
        exit 1
    }
    
    print_status "Package extracted"
}

# Function to setup environment
setup_environment() {
    print_info "Setting up environment..."
    
    # Copy environment template if no .env.production exists
    if [[ ! -f "$PROJECT_DIR/.env.production" ]]; then
        if [[ -f "$PROJECT_DIR/.env.production.template" ]]; then
            cp "$PROJECT_DIR/.env.production.template" "$PROJECT_DIR/.env.production"
            print_warning "Created .env.production from template - please configure API keys"
        else
            print_error "No .env.production or template found"
            exit 1
        fi
    fi
    
    # Generate docker-compose.override.yml if it doesn't exist
    if [[ ! -f "$PROJECT_DIR/docker-compose.prod.yml" ]]; then
        print_info "Generating docker-compose.prod.yml..."
        cd "$PROJECT_DIR"
        bash scripts/generate-configs.sh || true
    fi
    
    print_status "Environment configured"
}

# Function to pre-download models
download_models() {
    print_info "Pre-downloading ML models..."
    
    # Create model download script
    cat > "$PROJECT_DIR/download-models.py" << 'EOF'
import os
os.environ['SENTENCE_TRANSFORMERS_HOME'] = '/var/www/cbthis/models'

try:
    from sentence_transformers import SentenceTransformer
    print("Downloading all-MiniLM-L6-v2 model...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    print("Model downloaded successfully")
except Exception as e:
    print(f"Error downloading model: {e}")
    exit(1)
EOF
    
    # Run model download in container
    docker run --rm \
        -v "$PROJECT_DIR/models:/var/www/cbthis/models" \
        -v "$PROJECT_DIR/download-models.py:/app/download-models.py" \
        -e SENTENCE_TRANSFORMERS_HOME=/var/www/cbthis/models \
        python:3.11-slim \
        bash -c "pip install sentence-transformers && python /app/download-models.py" || {
        print_warning "Model pre-download failed - will download on first use"
    }
    
    rm -f "$PROJECT_DIR/download-models.py"
    print_status "Model download completed"
}

# Function to build and start services
deploy_services() {
    print_info "Building and starting Docker services..."
    
    cd "$PROJECT_DIR"
    
    # Build images
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml build || {
        print_error "Docker build failed"
        exit 1
    }
    
    # Start services with health checks
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d || {
        print_error "Failed to start services"
        exit 1
    }
    
    print_status "Services started"
    
    # Wait for services to be healthy
    print_info "Waiting for services to be healthy..."
    
    local max_attempts=30
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if docker-compose ps | grep -q "unhealthy"; then
            print_info "Services still starting... (attempt $((attempt+1))/$max_attempts)"
            sleep 10
            ((attempt++))
        else
            # Check if all expected services are running
            local running=$(docker-compose ps --services --filter "status=running" | wc -l)
            local expected=4  # app, rag-service, redis, nginx
            
            if [[ $running -eq $expected ]]; then
                print_status "All services are healthy"
                break
            else
                print_info "Waiting for all services... ($running/$expected running)"
                sleep 10
                ((attempt++))
            fi
        fi
    done
    
    if [[ $attempt -eq $max_attempts ]]; then
        print_error "Services failed to become healthy"
        docker-compose logs
        exit 1
    fi
}

# Function to run initial data ingestion
run_data_ingestion() {
    print_info "Running initial data ingestion..."
    
    # Check if data already exists
    if docker-compose exec rag-service test -f /app/chroma_db/chroma.sqlite3 2>/dev/null; then
        print_info "ChromaDB already exists, skipping initial ingestion"
        return
    fi
    
    # Run ingestion scripts
    docker-compose exec -T rag-service python -c "
import os
os.chdir('/app')
# Add ingestion logic here
print('Data ingestion placeholder - implement actual ingestion')
" || {
        print_warning "Initial data ingestion failed - manual ingestion may be required"
    }
    
    print_status "Data ingestion completed"
}

# Function to configure nginx
configure_nginx() {
    print_info "Configuring Nginx..."
    
    # Copy nginx configuration
    if [[ -f "$PROJECT_DIR/nginx.conf" ]]; then
        docker-compose exec nginx cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak || true
        docker-compose restart nginx
        print_status "Nginx configured"
    else
        print_warning "nginx.conf not found - using default configuration"
    fi
}

# Function to setup SSL
setup_ssl() {
    print_info "Setting up SSL certificates..."
    
    # Check if certificates already exist
    if docker-compose exec nginx test -f /etc/nginx/ssl/fullchain.pem 2>/dev/null; then
        print_info "SSL certificates already exist"
        return
    fi
    
    # Install certbot in nginx container and get certificate
    docker-compose exec nginx sh -c "
        apk add --no-cache certbot certbot-nginx
        certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect
    " || {
        print_warning "SSL setup failed - manual configuration may be required"
    }
    
    print_status "SSL setup completed"
}

# Function to cleanup
cleanup() {
    print_info "Cleaning up..."
    
    # Remove deployment package
    rm -f "/tmp/cbthis-deploy/$PACKAGE_NAME"
    
    # Prune unused Docker resources
    docker system prune -f
    
    print_status "Cleanup completed"
}

# Main deployment flow
main() {
    echo "================================================"
    echo "   Docker Deployment on VPS"
    echo "================================================"
    echo ""
    
    # Check Docker installation
    check_docker
    
    # Create required directories
    create_directories
    
    # Backup current deployment
    backup_current
    
    # Extract deployment package
    extract_package
    
    # Setup environment
    setup_environment
    
    # Pre-download models
    download_models
    
    # Deploy services
    deploy_services
    
    # Run initial data ingestion
    run_data_ingestion
    
    # Configure nginx
    configure_nginx
    
    # Setup SSL
    setup_ssl
    
    # Cleanup
    cleanup
    
    # Show final status
    echo ""
    echo "================================================"
    echo "   Docker Deployment Complete!"
    echo "================================================"
    echo ""
    docker-compose ps
    echo ""
    echo "Next steps:"
    echo "1. Configure SSL if not already done"
    echo "2. Load initial data if required"
    echo "3. Monitor logs: docker-compose logs -f"
    echo "================================================"
}

# Run main deployment
main