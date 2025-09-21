#!/bin/bash

# CI/CD Setup Validation Script
# Usage: ./validate-cicd-setup.sh

set -e

echo "🔍 Validating CI/CD Pipeline Setup"
echo "=================================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check AWS CLI configuration
check_aws_config() {
    echo "Checking AWS CLI configuration..."
    
    if ! command_exists aws; then
        echo "❌ AWS CLI not installed"
        return 1
    fi
    
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        echo "❌ AWS CLI not configured or invalid credentials"
        return 1
    fi
    
    local account_id=$(aws sts get-caller-identity --query Account --output text)
    local region=$(aws configure get region)
    
    echo "✅ AWS CLI configured"
    echo "   Account ID: $account_id"
    echo "   Region: $region"
    
    return 0
}

# Function to check Terraform setup
check_terraform() {
    echo "Checking Terraform setup..."
    
    if ! command_exists terraform; then
        echo "❌ Terraform not installed"
        return 1
    fi
    
    local tf_version=$(terraform version -json | jq -r '.terraform_version')
    echo "✅ Terraform installed (version: $tf_version)"
    
    # Check if Terraform is initialized
    if [ -d "infrastructure/terraform/.terraform" ]; then
        echo "✅ Terraform initialized"
    else
        echo "⚠️  Terraform not initialized. Run 'terraform init' in infrastructure/terraform/"
    fi
    
    return 0
}

# Function to check kubectl setup
check_kubectl() {
    echo "Checking kubectl setup..."
    
    if ! command_exists kubectl; then
        echo "❌ kubectl not installed"
        return 1
    fi
    
    local kubectl_version=$(kubectl version --client --output=json | jq -r '.clientVersion.gitVersion')
    echo "✅ kubectl installed (version: $kubectl_version)"
    
    # Check if kubectl can connect to cluster
    if kubectl cluster-info >/dev/null 2>&1; then
        local cluster_name=$(kubectl config current-context)
        echo "✅ kubectl connected to cluster: $cluster_name"
    else
        echo "⚠️  kubectl not connected to any cluster"
    fi
    
    return 0
}

# Function to check Docker setup
check_docker() {
    echo "Checking Docker setup..."
    
    if ! command_exists docker; then
        echo "❌ Docker not installed"
        return 1
    fi
    
    if ! docker info >/dev/null 2>&1; then
        echo "❌ Docker daemon not running"
        return 1
    fi
    
    local docker_version=$(docker version --format '{{.Server.Version}}')
    echo "✅ Docker running (version: $docker_version)"
    
    return 0
}

# Function to check required files
check_required_files() {
    echo "Checking required CI/CD files..."
    
    local required_files=(
        "infrastructure/terraform/codepipeline.tf"
        "infrastructure/buildspecs/buildspec-build-test.yml"
        "infrastructure/buildspecs/buildspec-security.yml"
        "infrastructure/buildspecs/buildspec-deploy.yml"
        "infrastructure/scripts/blue-green-deploy.sh"
        "infrastructure/scripts/health-check.sh"
        "infrastructure/scripts/smoke-tests.sh"
        "infrastructure/scripts/rollback-deployment.sh"
        ".github/workflows/ci-cd.yml"
    )
    
    local missing_files=0
    
    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            echo "✅ $file exists"
        else
            echo "❌ $file missing"
            ((missing_files++))
        fi
    done
    
    if [ $missing_files -eq 0 ]; then
        echo "✅ All required CI/CD files present"
        return 0
    else
        echo "❌ $missing_files required files missing"
        return 1
    fi
}

# Function to check environment variables
check_environment_variables() {
    echo "Checking environment variables..."
    
    local required_vars=(
        "AWS_DEFAULT_REGION"
        "AWS_ACCOUNT_ID"
    )
    
    local optional_vars=(
        "TF_VAR_github_owner"
        "TF_VAR_github_repo"
        "TF_VAR_github_token"
    )
    
    local missing_vars=0
    
    for var in "${required_vars[@]}"; do
        if [ -n "${!var}" ]; then
            echo "✅ $var is set"
        else
            echo "❌ $var is not set"
            ((missing_vars++))
        fi
    done
    
    for var in "${optional_vars[@]}"; do
        if [ -n "${!var}" ]; then
            echo "✅ $var is set"
        else
            echo "⚠️  $var is not set (required for CodePipeline)"
        fi
    done
    
    if [ $missing_vars -eq 0 ]; then
        echo "✅ All required environment variables set"
        return 0
    else
        echo "❌ $missing_vars required environment variables missing"
        return 1
    fi
}

# Function to validate buildspec files
validate_buildspecs() {
    echo "Validating buildspec files..."
    
    local buildspecs=(
        "infrastructure/buildspecs/buildspec-build-test.yml"
        "infrastructure/buildspecs/buildspec-security.yml"
        "infrastructure/buildspecs/buildspec-deploy.yml"
    )
    
    for buildspec in "${buildspecs[@]}"; do
        if [ -f "$buildspec" ]; then
            # Basic YAML validation
            if python3 -c "import yaml; yaml.safe_load(open('$buildspec'))" 2>/dev/null; then
                echo "✅ $buildspec is valid YAML"
            else
                echo "❌ $buildspec has invalid YAML syntax"
                return 1
            fi
        fi
    done
    
    return 0
}

# Function to check GitHub Actions workflow
check_github_actions() {
    echo "Checking GitHub Actions workflow..."
    
    if [ -f ".github/workflows/ci-cd.yml" ]; then
        echo "✅ GitHub Actions workflow file exists"
        
        # Basic YAML validation
        if python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci-cd.yml'))" 2>/dev/null; then
            echo "✅ GitHub Actions workflow is valid YAML"
        else
            echo "❌ GitHub Actions workflow has invalid YAML syntax"
            return 1
        fi
    else
        echo "❌ GitHub Actions workflow file missing"
        return 1
    fi
    
    return 0
}

# Function to check ECR repositories
check_ecr_repositories() {
    echo "Checking ECR repositories..."
    
    local services=(
        "api-gateway"
        "user-service"
        "restaurant-service"
        "recommendation-engine"
        "review-service"
        "emotion-service"
        "data-integration-service"
    )
    
    local missing_repos=0
    
    for service in "${services[@]}"; do
        local repo_name="find-dining-$service"
        if aws ecr describe-repositories --repository-names "$repo_name" >/dev/null 2>&1; then
            echo "✅ ECR repository $repo_name exists"
        else
            echo "⚠️  ECR repository $repo_name does not exist (will be created by Terraform)"
            ((missing_repos++))
        fi
    done
    
    if [ $missing_repos -eq 0 ]; then
        echo "✅ All ECR repositories exist"
    else
        echo "⚠️  $missing_repos ECR repositories need to be created"
    fi
    
    return 0
}

# Function to check EKS cluster
check_eks_cluster() {
    echo "Checking EKS cluster..."
    
    local cluster_name="find-dining-cluster"
    
    if aws eks describe-cluster --name "$cluster_name" >/dev/null 2>&1; then
        local cluster_status=$(aws eks describe-cluster --name "$cluster_name" --query 'cluster.status' --output text)
        echo "✅ EKS cluster $cluster_name exists (status: $cluster_status)"
        
        if [ "$cluster_status" = "ACTIVE" ]; then
            echo "✅ EKS cluster is active"
        else
            echo "⚠️  EKS cluster is not active"
        fi
    else
        echo "⚠️  EKS cluster $cluster_name does not exist (will be created by Terraform)"
    fi
    
    return 0
}

# Function to provide setup recommendations
provide_recommendations() {
    echo ""
    echo "📋 Setup Recommendations"
    echo "========================"
    
    echo "1. Install required tools:"
    echo "   - AWS CLI: https://aws.amazon.com/cli/"
    echo "   - Terraform: https://www.terraform.io/downloads.html"
    echo "   - kubectl: https://kubernetes.io/docs/tasks/tools/"
    echo "   - Docker: https://docs.docker.com/get-docker/"
    
    echo ""
    echo "2. Configure AWS credentials:"
    echo "   aws configure"
    
    echo ""
    echo "3. Set environment variables:"
    echo "   export AWS_DEFAULT_REGION=ap-southeast-1"
    echo "   export AWS_ACCOUNT_ID=\$(aws sts get-caller-identity --query Account --output text)"
    echo "   export TF_VAR_github_owner=your-github-username"
    echo "   export TF_VAR_github_repo=your-repo-name"
    echo "   export TF_VAR_github_token=your-github-token"
    
    echo ""
    echo "4. Initialize and apply Terraform:"
    echo "   cd infrastructure/terraform"
    echo "   terraform init"
    echo "   terraform plan"
    echo "   terraform apply"
    
    echo ""
    echo "5. Configure GitHub repository secrets:"
    echo "   - AWS_ACCESS_KEY_ID"
    echo "   - AWS_SECRET_ACCESS_KEY"
    echo "   - AWS_ACCOUNT_ID"
    echo "   - Database connection strings"
    echo "   - API keys"
    
    echo ""
    echo "6. Test the pipeline:"
    echo "   git push origin main"
}

# Main execution
echo "Starting CI/CD setup validation..."
echo ""

total_checks=0
passed_checks=0

# Run all checks
checks=(
    "check_aws_config"
    "check_terraform"
    "check_kubectl"
    "check_docker"
    "check_required_files"
    "check_environment_variables"
    "validate_buildspecs"
    "check_github_actions"
    "check_ecr_repositories"
    "check_eks_cluster"
)

for check in "${checks[@]}"; do
    echo ""
    ((total_checks++))
    if $check; then
        ((passed_checks++))
    fi
done

echo ""
echo "🏁 Validation Summary"
echo "===================="
echo "Total checks: $total_checks"
echo "Passed: $passed_checks"
echo "Failed: $((total_checks - passed_checks))"

if [ $passed_checks -eq $total_checks ]; then
    echo ""
    echo "🎉 All checks passed! Your CI/CD setup is ready."
    exit 0
else
    echo ""
    echo "⚠️  Some checks failed. Please review the issues above."
    provide_recommendations
    exit 1
fi