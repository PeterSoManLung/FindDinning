#!/bin/bash

# Build and push Docker images to ECR for Find Dining application
# This script builds all microservice Docker images and pushes them to ECR

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/../.."
ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-ap-southeast-1}
IMAGE_TAG=${3:-latest}

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
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install AWS CLI first."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Get AWS account ID
get_aws_account_id() {
    log_info "Getting AWS account ID..."
    
    export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    export ECR_REGISTRY="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
    
    log_info "AWS Account ID: $AWS_ACCOUNT_ID"
    log_info "ECR Registry: $ECR_REGISTRY"
    
    log_success "AWS account information retrieved"
}

# Login to ECR
ecr_login() {
    log_info "Logging in to ECR..."
    
    aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"
    
    log_success "ECR login successful"
}

# Build and push a single service
build_and_push_service() {
    local service_name=$1
    local service_dir=$2
    
    log_info "Building and pushing $service_name..."
    
    # Check if service directory exists
    if [ ! -d "$PROJECT_ROOT/$service_dir" ]; then
        log_error "Service directory $service_dir does not exist"
        return 1
    fi
    
    # Check if Dockerfile exists
    if [ ! -f "$PROJECT_ROOT/$service_dir/Dockerfile" ]; then
        log_error "Dockerfile not found in $service_dir"
        return 1
    fi
    
    local image_name="find-dining/$service_name"
    local full_image_name="$ECR_REGISTRY/$image_name:$IMAGE_TAG"
    
    # Build the Docker image
    log_info "Building Docker image for $service_name..."
    docker build -t "$image_name:$IMAGE_TAG" "$PROJECT_ROOT/$service_dir"
    
    # Tag the image for ECR
    docker tag "$image_name:$IMAGE_TAG" "$full_image_name"
    
    # Push the image to ECR
    log_info "Pushing $service_name to ECR..."
    docker push "$full_image_name"
    
    # Also tag and push as latest if not already latest
    if [ "$IMAGE_TAG" != "latest" ]; then
        local latest_image_name="$ECR_REGISTRY/$image_name:latest"
        docker tag "$image_name:$IMAGE_TAG" "$latest_image_name"
        docker push "$latest_image_name"
    fi
    
    log_success "$service_name built and pushed successfully"
    
    # Clean up local images to save space
    docker rmi "$image_name:$IMAGE_TAG" "$full_image_name" 2>/dev/null || true
    if [ "$IMAGE_TAG" != "latest" ]; then
        docker rmi "$ECR_REGISTRY/$image_name:latest" 2>/dev/null || true
    fi
}

# Build and push all services
build_and_push_all_services() {
    log_info "Building and pushing all microservices..."
    
    # Define services and their directories
    declare -A services=(
        ["api-gateway"]="api-gateway"
        ["user-service"]="user-service"
        ["restaurant-service"]="restaurant-service"
        ["recommendation-engine"]="recommendation-engine"
        ["review-service"]="review-service"
        ["emotion-service"]="emotion-service"
        ["data-integration-service"]="data-integration-service"
    )
    
    local failed_services=()
    
    # Build and push each service
    for service_name in "${!services[@]}"; do
        local service_dir="${services[$service_name]}"
        
        if build_and_push_service "$service_name" "$service_dir"; then
            log_success "✓ $service_name completed"
        else
            log_error "✗ $service_name failed"
            failed_services+=("$service_name")
        fi
        
        echo # Add spacing between services
    done
    
    # Report results
    if [ ${#failed_services[@]} -eq 0 ]; then
        log_success "All services built and pushed successfully!"
    else
        log_error "The following services failed:"
        for service in "${failed_services[@]}"; do
            log_error "  - $service"
        done
        exit 1
    fi
}

# Update Kubernetes deployment manifests with new image tags
update_k8s_manifests() {
    log_info "Updating Kubernetes manifests with new image tags..."
    
    local k8s_dir="$SCRIPT_DIR/../k8s"
    
    # Update API Gateway deployment
    if [ -f "$k8s_dir/api-gateway-deployment.yaml" ]; then
        sed -i.bak "s|image: \${AWS_ACCOUNT_ID}\.dkr\.ecr\.\${AWS_REGION}\.amazonaws\.com/find-dining/api-gateway:.*|image: $ECR_REGISTRY/find-dining/api-gateway:$IMAGE_TAG|g" "$k8s_dir/api-gateway-deployment.yaml"
    fi
    
    # Update microservices deployments
    if [ -f "$k8s_dir/microservices-deployments.yaml" ]; then
        sed -i.bak "s|image: \${AWS_ACCOUNT_ID}\.dkr\.ecr\.\${AWS_REGION}\.amazonaws\.com/find-dining/user-service:.*|image: $ECR_REGISTRY/find-dining/user-service:$IMAGE_TAG|g" "$k8s_dir/microservices-deployments.yaml"
        sed -i.bak "s|image: \${AWS_ACCOUNT_ID}\.dkr\.ecr\.\${AWS_REGION}\.amazonaws\.com/find-dining/restaurant-service:.*|image: $ECR_REGISTRY/find-dining/restaurant-service:$IMAGE_TAG|g" "$k8s_dir/microservices-deployments.yaml"
        sed -i.bak "s|image: \${AWS_ACCOUNT_ID}\.dkr\.ecr\.\${AWS_REGION}\.amazonaws\.com/find-dining/recommendation-engine:.*|image: $ECR_REGISTRY/find-dining/recommendation-engine:$IMAGE_TAG|g" "$k8s_dir/microservices-deployments.yaml"
        sed -i.bak "s|image: \${AWS_ACCOUNT_ID}\.dkr\.ecr\.\${AWS_REGION}\.amazonaws\.com/find-dining/review-service:.*|image: $ECR_REGISTRY/find-dining/review-service:$IMAGE_TAG|g" "$k8s_dir/microservices-deployments.yaml"
        sed -i.bak "s|image: \${AWS_ACCOUNT_ID}\.dkr\.ecr\.\${AWS_REGION}\.amazonaws\.com/find-dining/emotion-service:.*|image: $ECR_REGISTRY/find-dining/emotion-service:$IMAGE_TAG|g" "$k8s_dir/microservices-deployments.yaml"
        sed -i.bak "s|image: \${AWS_ACCOUNT_ID}\.dkr\.ecr\.\${AWS_REGION}\.amazonaws\.com/find-dining/data-integration-service:.*|image: $ECR_REGISTRY/find-dining/data-integration-service:$IMAGE_TAG|g" "$k8s_dir/microservices-deployments.yaml"
    fi
    
    # Remove backup files
    find "$k8s_dir" -name "*.bak" -delete 2>/dev/null || true
    
    log_success "Kubernetes manifests updated with image tag: $IMAGE_TAG"
}

# Show image information
show_image_info() {
    log_info "Docker images built and pushed:"
    echo
    
    local services=("api-gateway" "user-service" "restaurant-service" "recommendation-engine" "review-service" "emotion-service" "data-integration-service")
    
    for service in "${services[@]}"; do
        local image_name="$ECR_REGISTRY/find-dining/$service:$IMAGE_TAG"
        echo "  $service: $image_name"
    done
    
    echo
    log_info "To deploy these images, run:"
    log_info "  kubectl set image deployment/api-gateway api-gateway=$ECR_REGISTRY/find-dining/api-gateway:$IMAGE_TAG -n find-dining"
    log_info "  kubectl set image deployment/user-service user-service=$ECR_REGISTRY/find-dining/user-service:$IMAGE_TAG -n find-dining"
    log_info "  # ... and so on for other services"
    echo
    log_info "Or redeploy using the updated manifests:"
    log_info "  kubectl apply -f infrastructure/k8s/"
}

# Main function
main() {
    log_info "Starting Docker image build and push process..."
    log_info "Environment: $ENVIRONMENT"
    log_info "AWS Region: $AWS_REGION"
    log_info "Image Tag: $IMAGE_TAG"
    
    check_prerequisites
    get_aws_account_id
    ecr_login
    build_and_push_all_services
    update_k8s_manifests
    show_image_info
    
    log_success "Docker image build and push process completed successfully!"
}

# Show usage information
show_usage() {
    echo "Usage: $0 [ENVIRONMENT] [AWS_REGION] [IMAGE_TAG]"
    echo
    echo "Arguments:"
    echo "  ENVIRONMENT  Environment (dev, staging, prod). Default: dev"
    echo "  AWS_REGION   AWS region. Default: ap-southeast-1"
    echo "  IMAGE_TAG    Docker image tag. Default: latest"
    echo
    echo "Examples:"
    echo "  $0                           # Build with latest tag for dev"
    echo "  $0 prod                      # Build with latest tag for prod"
    echo "  $0 dev ap-southeast-1 v1.0.0 # Build with v1.0.0 tag"
}

# Handle command line arguments
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_usage
    exit 0
fi

# Run main function
main