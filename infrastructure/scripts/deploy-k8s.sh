#!/bin/bash

# Deploy Kubernetes manifests for Find Dining application
# This script deploys the Kubernetes resources to the EKS cluster

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$SCRIPT_DIR/../k8s"
TERRAFORM_DIR="$SCRIPT_DIR/../terraform"
ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-ap-southeast-1}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed. Please install kubectl first."
        exit 1
    fi
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install AWS CLI first."
        exit 1
    fi
    
    # Check if cluster is accessible
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Get AWS account ID and other variables
get_aws_info() {
    log_info "Getting AWS information..."
    
    export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    
    # Get Terraform outputs if available
    if [ -d "$TERRAFORM_DIR" ]; then
        cd "$TERRAFORM_DIR"
        if [ -f "terraform.tfstate" ]; then
            export CLUSTER_NAME=$(terraform output -raw cluster_id 2>/dev/null || echo "")
            export VPC_ID=$(terraform output -raw vpc_id 2>/dev/null || echo "")
            export DB_CREDENTIALS_SECRET_ARN=$(terraform output -raw db_credentials_secret_arn 2>/dev/null || echo "")
            export REDIS_CREDENTIALS_SECRET_ARN=$(terraform output -raw redis_credentials_secret_arn 2>/dev/null || echo "")
            export API_KEYS_SECRET_ARN=$(terraform output -raw api_keys_secret_arn 2>/dev/null || echo "")
            export REVIEWS_BUCKET=$(terraform output -raw reviews_media_bucket_name 2>/dev/null || echo "")
            export PLATFORM_DATA_BUCKET=$(terraform output -raw platform_data_bucket_name 2>/dev/null || echo "")
        fi
    fi
    
    log_info "AWS Account ID: $AWS_ACCOUNT_ID"
    log_info "Environment: $ENVIRONMENT"
    log_info "AWS Region: $AWS_REGION"
    
    log_success "AWS information retrieved"
}

# Create ECR login token
create_ecr_login() {
    log_info "Creating ECR login token..."
    
    # Get ECR login token
    aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
    
    # Create Kubernetes secret for ECR
    kubectl create secret docker-registry ecr-registry-secret \
        --namespace=find-dining \
        --docker-server="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com" \
        --docker-username=AWS \
        --docker-password="$(aws ecr get-login-password --region $AWS_REGION)" \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log_success "ECR login token created"
}

# Process Kubernetes manifests with environment variables
process_manifests() {
    log_info "Processing Kubernetes manifests..."
    
    local temp_dir=$(mktemp -d)
    
    # Copy all manifests to temp directory and substitute variables
    for file in "$K8S_DIR"/*.yaml; do
        if [ -f "$file" ]; then
            local filename=$(basename "$file")
            log_info "Processing $filename..."
            
            # Substitute environment variables in the manifest
            envsubst < "$file" > "$temp_dir/$filename"
        fi
    done
    
    echo "$temp_dir"
}

# Deploy namespace and RBAC
deploy_namespace_and_rbac() {
    log_info "Deploying namespace and RBAC..."
    
    local temp_dir=$1
    
    # Deploy namespace first
    kubectl apply -f "$temp_dir/namespace.yaml"
    
    # Deploy RBAC
    kubectl apply -f "$temp_dir/rbac.yaml"
    
    log_success "Namespace and RBAC deployed"
}

# Deploy secrets and configmaps
deploy_secrets_and_config() {
    log_info "Deploying secrets and configmaps..."
    
    local temp_dir=$1
    
    # Deploy configmap
    kubectl apply -f "$temp_dir/configmap.yaml"
    
    # Create secrets from AWS Secrets Manager if available
    if [ -n "$DB_CREDENTIALS_SECRET_ARN" ]; then
        log_info "Creating database secrets from AWS Secrets Manager..."
        
        # Get database credentials from Secrets Manager
        DB_SECRET=$(aws secretsmanager get-secret-value --secret-id "$DB_CREDENTIALS_SECRET_ARN" --query SecretString --output text)
        DB_USER=$(echo "$DB_SECRET" | jq -r .username)
        DB_PASSWORD=$(echo "$DB_SECRET" | jq -r .password)
        USER_DB_HOST=$(echo "$DB_SECRET" | jq -r .user_db_endpoint)
        RESTAURANT_DB_HOST=$(echo "$DB_SECRET" | jq -r .restaurant_db_endpoint)
        
        # Update secrets manifest with actual values
        sed -i "s|DB_USER: \"\"|DB_USER: \"$DB_USER\"|g" "$temp_dir/secrets.yaml"
        sed -i "s|DB_PASSWORD: \"\"|DB_PASSWORD: \"$DB_PASSWORD\"|g" "$temp_dir/secrets.yaml"
        sed -i "s|USER_DB_HOST: \"\"|USER_DB_HOST: \"$USER_DB_HOST\"|g" "$temp_dir/secrets.yaml"
        sed -i "s|RESTAURANT_DB_HOST: \"\"|RESTAURANT_DB_HOST: \"$RESTAURANT_DB_HOST\"|g" "$temp_dir/secrets.yaml"
    fi
    
    if [ -n "$REDIS_CREDENTIALS_SECRET_ARN" ]; then
        log_info "Creating Redis secrets from AWS Secrets Manager..."
        
        # Get Redis credentials from Secrets Manager
        REDIS_SECRET=$(aws secretsmanager get-secret-value --secret-id "$REDIS_CREDENTIALS_SECRET_ARN" --query SecretString --output text)
        REDIS_HOST=$(echo "$REDIS_SECRET" | jq -r .endpoint)
        REDIS_AUTH_TOKEN=$(echo "$REDIS_SECRET" | jq -r .auth_token)
        
        # Update secrets manifest with actual values
        sed -i "s|REDIS_HOST: \"\"|REDIS_HOST: \"$REDIS_HOST\"|g" "$temp_dir/secrets.yaml"
        sed -i "s|REDIS_AUTH_TOKEN: \"\"|REDIS_AUTH_TOKEN: \"$REDIS_AUTH_TOKEN\"|g" "$temp_dir/secrets.yaml"
    fi
    
    if [ -n "$API_KEYS_SECRET_ARN" ]; then
        log_info "Creating API keys secrets from AWS Secrets Manager..."
        
        # Get API keys from Secrets Manager
        API_SECRET=$(aws secretsmanager get-secret-value --secret-id "$API_KEYS_SECRET_ARN" --query SecretString --output text)
        API_GATEWAY_KEY=$(echo "$API_SECRET" | jq -r .api_gateway_key)
        
        # Update secrets manifest with actual values
        sed -i "s|API_GATEWAY_KEY: \"\"|API_GATEWAY_KEY: \"$API_GATEWAY_KEY\"|g" "$temp_dir/secrets.yaml"
    fi
    
    # Update S3 bucket names
    if [ -n "$REVIEWS_BUCKET" ]; then
        sed -i "s|AWS_S3_REVIEWS_BUCKET: \"\"|AWS_S3_REVIEWS_BUCKET: \"$REVIEWS_BUCKET\"|g" "$temp_dir/secrets.yaml"
    fi
    
    if [ -n "$PLATFORM_DATA_BUCKET" ]; then
        sed -i "s|AWS_S3_PLATFORM_DATA_BUCKET: \"\"|AWS_S3_PLATFORM_DATA_BUCKET: \"$PLATFORM_DATA_BUCKET\"|g" "$temp_dir/secrets.yaml"
    fi
    
    # Generate JWT secret if not provided
    JWT_SECRET=$(openssl rand -base64 32)
    sed -i "s|JWT_SECRET: \"\"|JWT_SECRET: \"$JWT_SECRET\"|g" "$temp_dir/secrets.yaml"
    
    # Generate encryption key if not provided
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    sed -i "s|ENCRYPTION_KEY: \"\"|ENCRYPTION_KEY: \"$ENCRYPTION_KEY\"|g" "$temp_dir/secrets.yaml"
    
    # Deploy secrets
    kubectl apply -f "$temp_dir/secrets.yaml"
    
    log_success "Secrets and configmaps deployed"
}

# Deploy microservices
deploy_microservices() {
    log_info "Deploying microservices..."
    
    local temp_dir=$1
    
    # Deploy API Gateway first
    kubectl apply -f "$temp_dir/api-gateway-deployment.yaml"
    
    # Deploy other microservices
    kubectl apply -f "$temp_dir/microservices-deployments.yaml"
    
    # Wait for deployments to be ready
    log_info "Waiting for deployments to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/api-gateway -n find-dining
    kubectl wait --for=condition=available --timeout=300s deployment/user-service -n find-dining
    kubectl wait --for=condition=available --timeout=300s deployment/restaurant-service -n find-dining
    kubectl wait --for=condition=available --timeout=300s deployment/recommendation-engine -n find-dining
    kubectl wait --for=condition=available --timeout=300s deployment/review-service -n find-dining
    kubectl wait --for=condition=available --timeout=300s deployment/emotion-service -n find-dining
    kubectl wait --for=condition=available --timeout=300s deployment/data-integration-service -n find-dining
    
    log_success "Microservices deployed"
}

# Deploy ingress
deploy_ingress() {
    log_info "Deploying ingress..."
    
    local temp_dir=$1
    
    # Deploy ingress
    kubectl apply -f "$temp_dir/ingress.yaml"
    
    # Wait for ingress to get an address
    log_info "Waiting for ingress to get an address..."
    timeout=300
    while [ $timeout -gt 0 ]; do
        INGRESS_ADDRESS=$(kubectl get ingress find-dining-ingress -n find-dining -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
        if [ -n "$INGRESS_ADDRESS" ]; then
            log_success "Ingress address: $INGRESS_ADDRESS"
            break
        fi
        sleep 10
        timeout=$((timeout - 10))
    done
    
    if [ -z "$INGRESS_ADDRESS" ]; then
        log_warning "Ingress address not available yet. Check later with: kubectl get ingress -n find-dining"
    fi
    
    log_success "Ingress deployed"
}

# Check deployment status
check_deployment_status() {
    log_info "Checking deployment status..."
    
    echo
    log_info "Pods status:"
    kubectl get pods -n find-dining
    
    echo
    log_info "Services status:"
    kubectl get services -n find-dining
    
    echo
    log_info "Ingress status:"
    kubectl get ingress -n find-dining
    
    echo
    log_info "Deployment status:"
    kubectl get deployments -n find-dining
    
    log_success "Deployment status check completed"
}

# Cleanup temporary files
cleanup() {
    if [ -n "$1" ] && [ -d "$1" ]; then
        rm -rf "$1"
        log_info "Temporary files cleaned up"
    fi
}

# Main deployment function
main() {
    log_info "Starting Kubernetes deployment for Find Dining application..."
    
    check_prerequisites
    get_aws_info
    
    # Process manifests
    local temp_dir=$(process_manifests)
    
    # Set trap to cleanup on exit
    trap "cleanup $temp_dir" EXIT
    
    # Deploy components in order
    deploy_namespace_and_rbac "$temp_dir"
    create_ecr_login
    deploy_secrets_and_config "$temp_dir"
    deploy_microservices "$temp_dir"
    deploy_ingress "$temp_dir"
    
    # Check deployment status
    check_deployment_status
    
    log_success "Kubernetes deployment completed successfully!"
    
    echo
    log_info "Next steps:"
    log_info "1. Build and push Docker images to ECR repositories"
    log_info "2. Update image tags in deployment manifests"
    log_info "3. Configure DNS to point to the load balancer"
    log_info "4. Set up SSL certificates"
    log_info "5. Configure monitoring and logging"
}

# Show usage information
show_usage() {
    echo "Usage: $0 [ENVIRONMENT] [AWS_REGION]"
    echo
    echo "Arguments:"
    echo "  ENVIRONMENT  Environment to deploy (dev, staging, prod). Default: dev"
    echo "  AWS_REGION   AWS region. Default: ap-southeast-1"
    echo
    echo "Examples:"
    echo "  $0                    # Deploy to dev environment"
    echo "  $0 prod               # Deploy to prod environment"
    echo "  $0 staging us-west-2  # Deploy to staging environment in us-west-2"
}

# Handle command line arguments
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_usage
    exit 0
fi

# Run main function
main