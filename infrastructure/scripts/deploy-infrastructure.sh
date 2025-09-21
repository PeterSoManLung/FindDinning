#!/bin/bash

# Deploy Find Dining Infrastructure Script
# This script deploys the AWS infrastructure using Terraform

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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
    
    # Check if Terraform is installed
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform is not installed. Please install Terraform first."
        exit 1
    fi
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install AWS CLI first."
        exit 1
    fi
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed. Please install kubectl first."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Generate SSH key pair if it doesn't exist
generate_ssh_key() {
    log_info "Checking SSH key pair..."
    
    if [ ! -f ~/.ssh/id_rsa ]; then
        log_info "Generating SSH key pair..."
        ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""
        log_success "SSH key pair generated"
    else
        log_info "SSH key pair already exists"
    fi
}

# Initialize Terraform
init_terraform() {
    log_info "Initializing Terraform..."
    
    cd "$TERRAFORM_DIR"
    
    # Initialize Terraform
    terraform init
    
    log_success "Terraform initialized"
}

# Plan Terraform deployment
plan_terraform() {
    log_info "Planning Terraform deployment for environment: $ENVIRONMENT"
    
    cd "$TERRAFORM_DIR"
    
    # Create terraform plan
    terraform plan \
        -var-file="${ENVIRONMENT}.tfvars" \
        -var="db_password=$(openssl rand -base64 32)" \
        -out="tfplan-${ENVIRONMENT}"
    
    log_success "Terraform plan created"
}

# Apply Terraform deployment
apply_terraform() {
    log_info "Applying Terraform deployment..."
    
    cd "$TERRAFORM_DIR"
    
    # Apply terraform plan
    terraform apply "tfplan-${ENVIRONMENT}"
    
    log_success "Terraform deployment completed"
}

# Get Terraform outputs
get_terraform_outputs() {
    log_info "Getting Terraform outputs..."
    
    cd "$TERRAFORM_DIR"
    
    # Export important outputs as environment variables
    export CLUSTER_NAME=$(terraform output -raw cluster_id)
    export CLUSTER_ENDPOINT=$(terraform output -raw cluster_endpoint)
    export VPC_ID=$(terraform output -raw vpc_id)
    export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    
    log_info "Cluster Name: $CLUSTER_NAME"
    log_info "Cluster Endpoint: $CLUSTER_ENDPOINT"
    log_info "VPC ID: $VPC_ID"
    log_info "AWS Account ID: $AWS_ACCOUNT_ID"
    
    log_success "Terraform outputs retrieved"
}

# Update kubeconfig
update_kubeconfig() {
    log_info "Updating kubeconfig..."
    
    aws eks update-kubeconfig \
        --region "$AWS_REGION" \
        --name "$CLUSTER_NAME"
    
    log_success "Kubeconfig updated"
}

# Install AWS Load Balancer Controller
install_alb_controller() {
    log_info "Installing AWS Load Balancer Controller..."
    
    # Create IAM role for AWS Load Balancer Controller
    eksctl create iamserviceaccount \
        --cluster="$CLUSTER_NAME" \
        --namespace=kube-system \
        --name=aws-load-balancer-controller \
        --role-name "AmazonEKSLoadBalancerControllerRole" \
        --attach-policy-arn=arn:aws:iam::aws:policy/ElasticLoadBalancingFullAccess \
        --approve \
        --override-existing-serviceaccounts
    
    # Install AWS Load Balancer Controller using Helm
    helm repo add eks https://aws.github.io/eks-charts
    helm repo update
    
    helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
        -n kube-system \
        --set clusterName="$CLUSTER_NAME" \
        --set serviceAccount.create=false \
        --set serviceAccount.name=aws-load-balancer-controller \
        --set region="$AWS_REGION" \
        --set vpcId="$VPC_ID"
    
    log_success "AWS Load Balancer Controller installed"
}

# Install Secrets Store CSI Driver
install_secrets_csi_driver() {
    log_info "Installing Secrets Store CSI Driver..."
    
    # Install Secrets Store CSI Driver
    helm repo add secrets-store-csi-driver https://kubernetes-sigs.github.io/secrets-store-csi-driver/charts
    helm repo update
    
    helm install csi-secrets-store secrets-store-csi-driver/secrets-store-csi-driver \
        --namespace kube-system \
        --set syncSecret.enabled=true
    
    # Install AWS Provider for Secrets Store CSI Driver
    kubectl apply -f https://raw.githubusercontent.com/aws/secrets-store-csi-driver-provider-aws/main/deployment/aws-provider-installer.yaml
    
    log_success "Secrets Store CSI Driver installed"
}

# Create ECR repositories
create_ecr_repositories() {
    log_info "Creating ECR repositories..."
    
    local services=("api-gateway" "user-service" "restaurant-service" "recommendation-engine" "review-service" "emotion-service" "data-integration-service")
    
    for service in "${services[@]}"; do
        log_info "Creating ECR repository for $service..."
        
        aws ecr create-repository \
            --repository-name "find-dining/$service" \
            --region "$AWS_REGION" \
            --image-scanning-configuration scanOnPush=true \
            --encryption-configuration encryptionType=AES256 \
            2>/dev/null || log_warning "Repository find-dining/$service already exists"
    done
    
    log_success "ECR repositories created"
}

# Main deployment function
main() {
    log_info "Starting Find Dining infrastructure deployment..."
    log_info "Environment: $ENVIRONMENT"
    log_info "AWS Region: $AWS_REGION"
    
    check_prerequisites
    generate_ssh_key
    init_terraform
    plan_terraform
    
    # Ask for confirmation before applying
    echo
    log_warning "This will create AWS resources that may incur costs."
    read -p "Do you want to continue with the deployment? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        apply_terraform
        get_terraform_outputs
        update_kubeconfig
        create_ecr_repositories
        
        # Wait for cluster to be ready
        log_info "Waiting for EKS cluster to be ready..."
        kubectl wait --for=condition=Ready nodes --all --timeout=300s
        
        install_alb_controller
        install_secrets_csi_driver
        
        log_success "Infrastructure deployment completed successfully!"
        log_info "Next steps:"
        log_info "1. Build and push Docker images to ECR"
        log_info "2. Deploy Kubernetes manifests"
        log_info "3. Configure DNS and SSL certificates"
        
    else
        log_info "Deployment cancelled"
        exit 0
    fi
}

# Show usage information
show_usage() {
    echo "Usage: $0 [ENVIRONMENT] [AWS_REGION]"
    echo
    echo "Arguments:"
    echo "  ENVIRONMENT  Environment to deploy (dev, staging, prod). Default: dev"
    echo "  AWS_REGION   AWS region to deploy to. Default: ap-southeast-1"
    echo
    echo "Examples:"
    echo "  $0                    # Deploy to dev environment in ap-southeast-1"
    echo "  $0 prod               # Deploy to prod environment in ap-southeast-1"
    echo "  $0 staging us-west-2  # Deploy to staging environment in us-west-2"
}

# Handle command line arguments
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_usage
    exit 0
fi

# Run main function
main