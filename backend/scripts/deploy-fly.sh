#!/bin/bash

# Fly.io Deployment Script for Matcha Backend
# Usage: ./scripts/deploy-fly.sh [staging|production]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if flyctl is installed
check_flyctl() {
    if ! command -v flyctl &> /dev/null; then
        print_error "flyctl is not installed. Please install it first:"
        echo "curl -L https://fly.io/install.sh | sh"
        exit 1
    fi
}

# Check if user is logged in to Fly.io
check_auth() {
    if ! flyctl auth whoami &> /dev/null; then
        print_error "Not logged in to Fly.io. Please run: flyctl auth login"
        exit 1
    fi
}

# Set environment based on argument
set_environment() {
    if [ "$1" = "production" ]; then
        ENVIRONMENT="production"
        APP_NAME="matcha-backend"
        REGION="iad"
    elif [ "$1" = "staging" ]; then
        ENVIRONMENT="staging"
        APP_NAME="matcha-backend-staging"
        REGION="iad"
    else
        print_error "Usage: $0 [staging|production]"
        exit 1
    fi
    
    print_status "Deploying to $ENVIRONMENT environment: $APP_NAME"
}

# Create app if it doesn't exist
create_app() {
    if ! flyctl apps list | grep -q "$APP_NAME"; then
        print_status "Creating new Fly.io app: $APP_NAME"
        flyctl apps create "$APP_NAME" --org personal
        print_success "App created: $APP_NAME"
    else
        print_status "App already exists: $APP_NAME"
    fi
}

# Set secrets for the app
set_secrets() {
    print_status "Setting secrets for $APP_NAME..."
    
    # Check if .env file exists
    if [ ! -f ".env.$ENVIRONMENT" ]; then
        print_warning "No .env.$ENVIRONMENT file found. You'll need to set secrets manually."
        print_status "Run: flyctl secrets set --app $APP_NAME KEY=value"
        return
    fi
    
    # Load environment variables and set as secrets
    while IFS= read -r line; do
        # Skip comments and empty lines
        if [[ $line =~ ^[[:space:]]*# ]] || [[ -z $line ]]; then
            continue
        fi
        
        # Extract key and value
        if [[ $line =~ ^([^=]+)=(.*)$ ]]; then
            KEY="${BASH_REMATCH[1]}"
            VALUE="${BASH_REMATCH[2]}"
            
            # Skip if value is empty or contains placeholder
            if [[ -n "$VALUE" && ! "$VALUE" =~ your-.* ]]; then
                print_status "Setting secret: $KEY"
                flyctl secrets set --app "$APP_NAME" "$KEY=$VALUE"
            fi
        fi
    done < ".env.$ENVIRONMENT"
    
    print_success "Secrets configured"
}

# Deploy the application
deploy_app() {
    print_status "Deploying $APP_NAME to Fly.io..."
    
    # Build and deploy
    flyctl deploy --app "$APP_NAME" --region "$REGION"
    
    print_success "Deployment completed!"
}

# Show deployment status
show_status() {
    print_status "Deployment status:"
    flyctl status --app "$APP_NAME"
    
    print_status "Recent logs:"
    flyctl logs --app "$APP_NAME" --limit 10
}

# Main deployment function
main() {
    print_status "Starting Fly.io deployment..."
    
    # Check prerequisites
    check_flyctl
    check_auth
    
    # Set environment
    set_environment "$1"
    
    # Deploy
    create_app
    set_secrets
    deploy_app
    show_status
    
    print_success "Deployment to $ENVIRONMENT completed successfully!"
    print_status "Your app is available at: https://$APP_NAME.fly.dev"
}

# Run main function with arguments
main "$@"

