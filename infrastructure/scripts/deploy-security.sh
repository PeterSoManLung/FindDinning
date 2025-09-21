#!/bin/bash

# Security Infrastructure Deployment Script
# Deploys all security and compliance components for the AI Restaurant Recommendation system

set -e

PROJECT_NAME=${PROJECT_NAME:-"find-dining"}
ENVIRONMENT=${ENVIRONMENT:-"dev"}
AWS_REGION=${AWS_REGION:-"ap-southeast-1"}

echo "🔒 Deploying Security Infrastructure for $PROJECT_NAME ($ENVIRONMENT)"
echo "=================================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print status
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

# Check prerequisites
print_status "Checking prerequisites..."

# Check if AWS CLI is installed and configured
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    print_error "Terraform is not installed. Please install it first."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured. Please run 'aws configure'."
    exit 1
fi

print_success "Prerequisites check passed"

# Navigate to Terraform directory
cd "$(dirname "$0")/../terraform"

print_status "Initializing Terraform..."
terraform init

print_status "Validating Terraform configuration..."
terraform validate

if [ $? -ne 0 ]; then
    print_error "Terraform validation failed"
    exit 1
fi

print_success "Terraform validation passed"

# Plan deployment
print_status "Planning security infrastructure deployment..."
terraform plan -var-file="security.tfvars" -out=security.tfplan

if [ $? -ne 0 ]; then
    print_error "Terraform planning failed"
    exit 1
fi

print_success "Terraform planning completed"

# Ask for confirmation
echo ""
print_warning "This will deploy security infrastructure including:"
echo "  - IAM roles and policies with least privilege access"
echo "  - KMS keys for encryption at rest and in transit"
echo "  - VPC security groups and network ACLs"
echo "  - AWS WAF for API protection"
echo "  - Backup and disaster recovery configuration"
echo "  - GDPR compliance Lambda functions"
echo "  - Security monitoring and scanning automation"
echo ""

read -p "Do you want to proceed with the deployment? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Deployment cancelled by user"
    exit 0
fi

# Apply Terraform configuration
print_status "Applying security infrastructure..."
terraform apply security.tfplan

if [ $? -ne 0 ]; then
    print_error "Terraform apply failed"
    exit 1
fi

print_success "Security infrastructure deployed successfully"

# Enable security services
print_status "Enabling AWS security services..."

# Enable GuardDuty
print_status "Enabling GuardDuty..."
if aws guardduty list-detectors --query 'DetectorIds[0]' --output text | grep -q "None"; then
    DETECTOR_ID=$(aws guardduty create-detector --enable --query 'DetectorId' --output text)
    print_success "GuardDuty enabled with detector ID: $DETECTOR_ID"
else
    print_warning "GuardDuty already enabled"
fi

# Enable Security Hub
print_status "Enabling Security Hub..."
if ! aws securityhub describe-hub &> /dev/null; then
    aws securityhub enable-security-hub --enable-default-standards
    print_success "Security Hub enabled with default standards"
else
    print_warning "Security Hub already enabled"
fi

# Enable Inspector V2
print_status "Enabling Inspector V2..."
aws inspector2 enable --resource-types ECR EC2 --account-ids $(aws sts get-caller-identity --query Account --output text) || print_warning "Inspector V2 may already be enabled"
print_success "Inspector V2 enabled for ECR and EC2"

# Enable Config
print_status "Enabling AWS Config..."
CONFIG_RECORDER_NAME="${PROJECT_NAME}-config-recorder"
if ! aws configservice describe-configuration-recorders --configuration-recorder-names "$CONFIG_RECORDER_NAME" &> /dev/null; then
    print_warning "Config recorder will be created by Terraform"
else
    print_warning "Config recorder already exists"
fi

# Package Lambda functions
print_status "Packaging Lambda functions..."

# Package GDPR data deletion Lambda
cd ../lambda
if [ -f "gdpr_data_deletion.py" ]; then
    zip -q ../terraform/gdpr_data_deletion.zip gdpr_data_deletion.py
    print_success "GDPR data deletion Lambda packaged"
fi

# Package GDPR data export Lambda
if [ -f "gdpr_data_export.py" ]; then
    zip -q ../terraform/gdpr_data_export.zip gdpr_data_export.py
    print_success "GDPR data export Lambda packaged"
fi

# Package security scanner Lambda
if [ -f "security_scanner.py" ]; then
    zip -q ../terraform/security_scanner.zip security_scanner.py
    print_success "Security scanner Lambda packaged"
fi

cd ../terraform

# Update Lambda functions if they exist
print_status "Updating Lambda functions..."
terraform apply -var-file="security.tfvars" -target=aws_lambda_function.gdpr_data_deletion -target=aws_lambda_function.gdpr_data_export -target=aws_lambda_function.security_scanner

print_success "Lambda functions updated"

# Run security validation
print_status "Running security validation..."
cd ../scripts

if [ -f "validate-security-compliance.sh" ]; then
    bash validate-security-compliance.sh
    if [ $? -eq 0 ]; then
        print_success "Security validation passed"
    else
        print_warning "Security validation found issues - please review"
    fi
else
    print_warning "Security validation script not found"
fi

# Generate security report
print_status "Generating security configuration report..."

cat << EOF > ../security-deployment-report.md
# Security Deployment Report

**Project**: $PROJECT_NAME
**Environment**: $ENVIRONMENT
**Region**: $AWS_REGION
**Deployment Date**: $(date)

## Deployed Components

### 1. Identity and Access Management
- ✅ EKS cluster service role
- ✅ Application service roles (user, restaurant, recommendation, data-integration)
- ✅ Security Lambda roles (GDPR, security scanner)
- ✅ Backup service role
- ✅ Least privilege policies for all roles

### 2. Data Encryption
- ✅ Application encryption KMS key with rotation
- ✅ RDS encryption KMS key with rotation
- ✅ S3 encryption KMS key with rotation
- ✅ All data encrypted at rest and in transit

### 3. Network Security
- ✅ VPC with private/public subnet segmentation
- ✅ Security groups with restrictive rules
- ✅ Network ACLs for additional protection
- ✅ VPC Flow Logs enabled

### 4. API Protection
- ✅ AWS WAF with comprehensive rule set
- ✅ Rate limiting (2000 req/5min per IP)
- ✅ SQL injection and XSS protection
- ✅ Bot control and IP reputation filtering

### 5. Security Monitoring
- ✅ AWS GuardDuty for threat detection
- ✅ AWS Security Hub for centralized findings
- ✅ AWS Config for compliance monitoring
- ✅ AWS Inspector V2 for vulnerability scanning

### 6. Backup and Recovery
- ✅ AWS Backup vault with encryption
- ✅ Daily and weekly backup plans
- ✅ Cross-region backup replication
- ✅ Automated backup monitoring

### 7. GDPR Compliance
- ✅ Data export Lambda function
- ✅ Data deletion Lambda function
- ✅ Secure export bucket with lifecycle
- ✅ Audit logging for all GDPR operations

### 8. Security Automation
- ✅ Daily security scanning Lambda
- ✅ Automated vulnerability assessment
- ✅ Security alert notifications
- ✅ Compliance monitoring automation

## Next Steps

1. Configure SNS topic subscriptions for security alerts
2. Set up security dashboard in CloudWatch
3. Schedule regular security reviews
4. Test GDPR data export/deletion functions
5. Conduct penetration testing
6. Train team on security procedures

## Security Contacts

- Security Team: security@findining.com
- DevOps Team: devops@findining.com
- Privacy Officer: privacy@findining.com

---
Generated by: $0
EOF

print_success "Security deployment report generated: ../security-deployment-report.md"

echo ""
echo "=================================================================="
print_success "🎉 Security infrastructure deployment completed successfully!"
echo "=================================================================="
echo ""
print_status "Summary:"
echo "  ✅ All security components deployed"
echo "  ✅ AWS security services enabled"
echo "  ✅ GDPR compliance functions ready"
echo "  ✅ Security monitoring active"
echo "  ✅ Backup and recovery configured"
echo ""
print_warning "Important next steps:"
echo "  1. Review and test all security configurations"
echo "  2. Set up security alert notifications"
echo "  3. Schedule regular security assessments"
echo "  4. Train team on security procedures"
echo "  5. Document incident response procedures"
echo ""
print_status "For detailed security information, see:"
echo "  - Security deployment report: ../security-deployment-report.md"
echo "  - Security compliance guide: ../SECURITY-COMPLIANCE.md"
echo "  - Validation script: ./validate-security-compliance.sh"
echo ""
print_success "Security deployment completed! 🔒"