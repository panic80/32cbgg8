#!/bin/bash

# Comprehensive Deployment Script for CF Travel Bot
# Deploys to VPS at 46.202.177.230 (32cbgg8.com)

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VPS_IP="46.202.177.230"
VPS_USER="root"
DOMAIN="32cbgg8.com"
GITHUB_REPO="https://github.com/panic80/cb.git"
PROJECT_DIR="/var/www/cbthis"

# Default values
DEPLOYMENT_METHOD="docker"
ENVIRONMENT="production"
SKIP_CHECKS=false
RESTORE_MODE=false

# Function to print colored output
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

# Usage function
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --method=[docker|pm2]    Deployment method (default: docker)"
    echo "  --env=[staging|production] Environment (default: production)"
    echo "  --skip-checks           Skip pre-deployment checks"
    echo "  --restore              Restore from backup"
    echo "  --help                 Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --method=docker --env=production"
    echo "  $0 --method=pm2 --skip-checks"
    echo "  $0 --restore"
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --method=*)
            DEPLOYMENT_METHOD="${1#*=}"
            if [[ "$DEPLOYMENT_METHOD" != "docker" && "$DEPLOYMENT_METHOD" != "pm2" ]]; then
                print_error "Invalid deployment method: $DEPLOYMENT_METHOD"
                usage
            fi
            ;;
        --env=*)
            ENVIRONMENT="${1#*=}"
            if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
                print_error "Invalid environment: $ENVIRONMENT"
                usage
            fi
            ;;
        --skip-checks)
            SKIP_CHECKS=true
            ;;
        --restore)
            RESTORE_MODE=true
            ;;
        --help)
            usage
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            ;;
    esac
    shift
done

# Print deployment configuration
echo "================================================"
echo "   CF Travel Bot Deployment"
echo "================================================"
echo "Target: $VPS_USER@$VPS_IP ($DOMAIN)"
echo "Method: $DEPLOYMENT_METHOD"
echo "Environment: $ENVIRONMENT"
echo "Skip checks: $SKIP_CHECKS"
echo "Restore mode: $RESTORE_MODE"
echo "================================================"
echo ""

# Confirm deployment
read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Deployment cancelled"
    exit 0
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check SSH connectivity
check_ssh() {
    print_info "Checking SSH connectivity..."
    if ssh -o ConnectTimeout=10 -o BatchMode=yes "$VPS_USER@$VPS_IP" exit 2>/dev/null; then
        print_status "SSH connection successful"
    else
        print_error "Cannot connect to $VPS_USER@$VPS_IP"
        print_error "Please check your SSH configuration"
        exit 1
    fi
}

# Function to run pre-deployment checks
run_pre_checks() {
    if [[ "$SKIP_CHECKS" == "true" ]]; then
        print_warning "Skipping pre-deployment checks"
        return
    fi
    
    print_info "Running pre-deployment checks..."
    
    # Check local dependencies
    local deps=("node" "npm" "git")
    for dep in "${deps[@]}"; do
        if ! command_exists "$dep"; then
            print_error "$dep is not installed"
            exit 1
        fi
    done
    
    # Run pre-deploy-check.sh if it exists
    if [[ -f "scripts/pre-deploy-check.sh" ]]; then
        bash scripts/pre-deploy-check.sh || {
            print_error "Pre-deployment checks failed"
            exit 1
        }
    fi
    
    print_status "Pre-deployment checks passed"
}

# Function to build application
build_application() {
    print_info "Building application..."
    
    # Install dependencies
    print_info "Installing dependencies..."
    npm ci || {
        print_error "Failed to install dependencies"
        exit 1
    }
    
    # Build frontend with production API URL
    print_info "Building frontend..."
    VITE_API_BASE_URL="https://$DOMAIN" npm run build:production || {
        print_error "Frontend build failed"
        exit 1
    }
    
    print_status "Application built successfully"
}

# Function to create deployment package
create_deployment_package() {
    print_info "Creating deployment package..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local package_name="cbthis-$ENVIRONMENT-$timestamp.tar.gz"
    
    # Create package with essential files
    tar -czf "$package_name" \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=.env* \
        --exclude=venv \
        --exclude=__pycache__ \
        --exclude=*.pyc \
        --exclude=logs \
        --exclude=chroma_db \
        --exclude=models \
        --exclude=*.tar.gz \
        dist \
        server \
        package*.json \
        ecosystem.config.cjs \
        rag-service \
        docker-compose.yml \
        docker-compose.prod.yml \
        Dockerfile \
        nginx.conf.template \
        scripts \
        .dockerignore || {
        print_error "Failed to create deployment package"
        exit 1
    }
    
    print_status "Deployment package created: $package_name" >&2
    echo "$package_name"
}

# Function to upload package to VPS
upload_package() {
    local package_name=$1
    
    print_info "Uploading package to VPS..."
    
    # Create temp directory on VPS
    ssh "$VPS_USER@$VPS_IP" "mkdir -p /tmp/cbthis-deploy"
    
    # Upload package
    scp "$package_name" "$VPS_USER@$VPS_IP:/tmp/cbthis-deploy/" || {
        print_error "Failed to upload package"
        exit 1
    }
    
    # Upload deployment scripts
    scp scripts/remote-deploy-*.sh "$VPS_USER@$VPS_IP:/tmp/cbthis-deploy/" || {
        print_error "Failed to upload deployment scripts"
        exit 1
    }
    
    print_status "Package uploaded successfully"
}

# Function to execute remote deployment
execute_remote_deployment() {
    local package_name=$1
    
    print_info "Executing remote deployment..."
    
    # Choose deployment script based on method
    local deploy_script="remote-deploy-${DEPLOYMENT_METHOD}.sh"
    
    # Execute deployment on VPS
    ssh "$VPS_USER@$VPS_IP" << EOF
set -euo pipefail

# Make scripts executable
chmod +x /tmp/cbthis-deploy/*.sh

# Set environment variables
export DEPLOYMENT_METHOD="$DEPLOYMENT_METHOD"
export ENVIRONMENT="$ENVIRONMENT"
export PACKAGE_NAME="$package_name"
export PROJECT_DIR="$PROJECT_DIR"
export DOMAIN="$DOMAIN"

# Execute deployment
cd /tmp/cbthis-deploy
bash ./$deploy_script
EOF
    
    if [[ $? -eq 0 ]]; then
        print_status "Remote deployment completed successfully"
    else
        print_error "Remote deployment failed"
        exit 1
    fi
}

# Function to validate deployment
validate_deployment() {
    print_info "Validating deployment..."
    
    # Run validation script
    if [[ -f "scripts/validate-deployment.sh" ]]; then
        bash scripts/validate-deployment.sh "$DOMAIN" || {
            print_error "Deployment validation failed"
            print_warning "Consider rolling back the deployment"
            exit 1
        }
    fi
    
    print_status "Deployment validated successfully"
}

# Function to cleanup
cleanup() {
    print_info "Cleaning up..."
    
    # Remove local package
    rm -f cbthis-*.tar.gz
    
    # Clean up remote temp files
    ssh "$VPS_USER@$VPS_IP" "rm -rf /tmp/cbthis-deploy"
    
    print_status "Cleanup completed"
}

# Function to handle restore mode
handle_restore() {
    print_info "Running in restore mode..."
    
    # Execute disaster recovery
    if [[ -f "scripts/disaster-recovery.sh" ]]; then
        bash scripts/disaster-recovery.sh "$VPS_USER" "$VPS_IP" || {
            print_error "Restore failed"
            exit 1
        }
    else
        print_error "Disaster recovery script not found"
        exit 1
    fi
    
    print_status "Restore completed successfully"
    exit 0
}

# Main deployment flow
main() {
    # Handle restore mode
    if [[ "$RESTORE_MODE" == "true" ]]; then
        handle_restore
    fi
    
    # Check SSH connectivity
    check_ssh
    
    # Run pre-deployment checks
    run_pre_checks
    
    # Build application
    build_application
    
    # Create deployment package
    local package_name=$(create_deployment_package)
    
    # Upload package to VPS
    upload_package "$package_name"
    
    # Execute remote deployment
    execute_remote_deployment "$package_name"
    
    # Validate deployment
    validate_deployment
    
    # Cleanup
    cleanup
    
    # Print success message
    echo ""
    echo "================================================"
    echo "   Deployment Completed Successfully! 🎉"
    echo "================================================"
    echo "Application URL: https://$DOMAIN"
    echo "Health Check: https://$DOMAIN/health"
    echo ""
    echo "Next steps:"
    echo "1. Monitor application logs"
    echo "2. Check external monitoring"
    echo "3. Verify all features are working"
    echo "================================================"
}

# Trap errors and cleanup
trap 'print_error "Deployment failed!"; cleanup; exit 1' ERR

# Run main deployment
main