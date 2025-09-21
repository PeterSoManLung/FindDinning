#!/bin/bash

# Security and Compliance Validation Script
# Validates all security configurations for the AI Restaurant Recommendation system

set -e

PROJECT_NAME=${PROJECT_NAME:-"find-dining"}
ENVIRONMENT=${ENVIRONMENT:-"dev"}
AWS_REGION=${AWS_REGION:-"ap-southeast-1"}

echo "🔒 Starting Security and Compliance Validation for $PROJECT_NAME ($ENVIRONMENT)"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Initialize counters
PASSED=0
FAILED=0
WARNINGS=0

echo "1. Validating IAM Roles and Policies..."
echo "----------------------------------------"

# Check if IAM roles exist
ROLES=("${PROJECT_NAME}-eks-cluster-role" "${PROJECT_NAME}-user-service-role" "${PROJECT_NAME}-restaurant-service-role" "${PROJECT_NAME}-recommendation-service-role" "${PROJECT_NAME}-data-integration-service-role" "${PROJECT_NAME}-security-lambda-role" "${PROJECT_NAME}-gdpr-lambda-role" "${PROJECT_NAME}-backup-role")

for role in "${ROLES[@]}"; do
    if aws iam get-role --role-name "$role" >/dev/null 2>&1; then
        print_status 0 "IAM Role exists: $role"
        ((PASSED++))
    else
        print_status 1 "IAM Role missing: $role"
        ((FAILED++))
    fi
done

echo ""
echo "2. Validating KMS Encryption Keys..."
echo "------------------------------------"

# Check KMS keys
KMS_ALIASES=("alias/${PROJECT_NAME}-encryption-key" "alias/${PROJECT_NAME}-rds-encryption-key" "alias/${PROJECT_NAME}-s3-encryption-key")

for alias in "${KMS_ALIASES[@]}"; do
    if aws kms describe-key --key-id "$alias" >/dev/null 2>&1; then
        print_status 0 "KMS Key exists: $alias"
        
        # Check if key rotation is enabled
        KEY_ID=$(aws kms describe-key --key-id "$alias" --query 'KeyMetadata.KeyId' --output text)
        if aws kms get-key-rotation-status --key-id "$KEY_ID" --query 'KeyRotationEnabled' --output text | grep -q "True"; then
            print_status 0 "Key rotation enabled for: $alias"
            ((PASSED++))
        else
            print_status 1 "Key rotation disabled for: $alias"
            ((FAILED++))
        fi
        ((PASSED++))
    else
        print_status 1 "KMS Key missing: $alias"
        ((FAILED++))
    fi
done

echo ""
echo "3. Validating VPC Security Configuration..."
echo "------------------------------------------"

# Check VPC exists
VPC_ID=$(aws ec2 describe-vpcs --filters "Name=tag:Name,Values=${PROJECT_NAME}-${ENVIRONMENT}-vpc" --query 'Vpcs[0].VpcId' --output text 2>/dev/null || echo "None")

if [ "$VPC_ID" != "None" ] && [ "$VPC_ID" != "null" ]; then
    print_status 0 "VPC exists: $VPC_ID"
    ((PASSED++))
    
    # Check security groups
    SECURITY_GROUPS=$(aws ec2 describe-security-groups --filters "Name=vpc-id,Values=$VPC_ID" --query 'SecurityGroups[].GroupName' --output text)
    if echo "$SECURITY_GROUPS" | grep -q "${PROJECT_NAME}"; then
        print_status 0 "Security groups configured for VPC"
        ((PASSED++))
    else
        print_status 1 "Security groups not found for VPC"
        ((FAILED++))
    fi
else
    print_status 1 "VPC not found"
    ((FAILED++))
fi

echo ""
echo "4. Validating RDS Encryption..."
echo "------------------------------"

# Check RDS instances
RDS_INSTANCES=("${PROJECT_NAME}-${ENVIRONMENT}-user-db" "${PROJECT_NAME}-${ENVIRONMENT}-restaurant-db")

for instance in "${RDS_INSTANCES[@]}"; do
    if aws rds describe-db-instances --db-instance-identifier "$instance" >/dev/null 2>&1; then
        print_status 0 "RDS Instance exists: $instance"
        
        # Check encryption
        ENCRYPTED=$(aws rds describe-db-instances --db-instance-identifier "$instance" --query 'DBInstances[0].StorageEncrypted' --output text)
        if [ "$ENCRYPTED" = "True" ]; then
            print_status 0 "RDS encryption enabled for: $instance"
            ((PASSED++))
        else
            print_status 1 "RDS encryption disabled for: $instance"
            ((FAILED++))
        fi
        ((PASSED++))
    else
        print_status 1 "RDS Instance missing: $instance"
        ((FAILED++))
    fi
done

echo ""
echo "5. Validating S3 Bucket Security..."
echo "----------------------------------"

# Check S3 buckets
S3_BUCKETS=$(aws s3api list-buckets --query "Buckets[?contains(Name, '${PROJECT_NAME}')].Name" --output text)

if [ -n "$S3_BUCKETS" ]; then
    for bucket in $S3_BUCKETS; do
        print_status 0 "S3 Bucket exists: $bucket"
        
        # Check encryption
        if aws s3api get-bucket-encryption --bucket "$bucket" >/dev/null 2>&1; then
            print_status 0 "S3 encryption enabled for: $bucket"
            ((PASSED++))
        else
            print_status 1 "S3 encryption not configured for: $bucket"
            ((FAILED++))
        fi
        
        # Check public access block
        PUBLIC_ACCESS=$(aws s3api get-public-access-block --bucket "$bucket" --query 'PublicAccessBlockConfiguration.BlockPublicAcls' --output text 2>/dev/null || echo "false")
        if [ "$PUBLIC_ACCESS" = "True" ]; then
            print_status 0 "Public access blocked for: $bucket"
            ((PASSED++))
        else
            print_status 1 "Public access not blocked for: $bucket"
            ((FAILED++))
        fi
        ((PASSED++))
    done
else
    print_status 1 "No S3 buckets found for project"
    ((FAILED++))
fi

echo ""
echo "6. Validating WAF Configuration..."
echo "---------------------------------"

# Check WAF Web ACL
WAF_ACL_NAME="${PROJECT_NAME}-api-protection"
if aws wafv2 get-web-acl --scope REGIONAL --id "$(aws wafv2 list-web-acls --scope REGIONAL --query "WebACLs[?Name=='$WAF_ACL_NAME'].Id" --output text 2>/dev/null)" >/dev/null 2>&1; then
    print_status 0 "WAF Web ACL exists: $WAF_ACL_NAME"
    ((PASSED++))
else
    print_status 1 "WAF Web ACL missing: $WAF_ACL_NAME"
    ((FAILED++))
fi

echo ""
echo "7. Validating Backup Configuration..."
echo "------------------------------------"

# Check AWS Backup vault
BACKUP_VAULT_NAME="${PROJECT_NAME}-backup-vault"
if aws backup describe-backup-vault --backup-vault-name "$BACKUP_VAULT_NAME" >/dev/null 2>&1; then
    print_status 0 "Backup vault exists: $BACKUP_VAULT_NAME"
    ((PASSED++))
    
    # Check backup plan
    BACKUP_PLAN_NAME="${PROJECT_NAME}-backup-plan"
    BACKUP_PLAN_ID=$(aws backup list-backup-plans --query "BackupPlansList[?BackupPlanName=='$BACKUP_PLAN_NAME'].BackupPlanId" --output text)
    if [ -n "$BACKUP_PLAN_ID" ] && [ "$BACKUP_PLAN_ID" != "None" ]; then
        print_status 0 "Backup plan exists: $BACKUP_PLAN_NAME"
        ((PASSED++))
    else
        print_status 1 "Backup plan missing: $BACKUP_PLAN_NAME"
        ((FAILED++))
    fi
else
    print_status 1 "Backup vault missing: $BACKUP_VAULT_NAME"
    ((FAILED++))
fi

echo ""
echo "8. Validating Security Monitoring..."
echo "-----------------------------------"

# Check GuardDuty
if aws guardduty list-detectors --query 'DetectorIds[0]' --output text | grep -v "None" >/dev/null 2>&1; then
    print_status 0 "GuardDuty detector enabled"
    ((PASSED++))
else
    print_status 1 "GuardDuty detector not enabled"
    ((FAILED++))
fi

# Check Security Hub
if aws securityhub describe-hub >/dev/null 2>&1; then
    print_status 0 "Security Hub enabled"
    ((PASSED++))
else
    print_status 1 "Security Hub not enabled"
    ((FAILED++))
fi

# Check Config
if aws configservice describe-configuration-recorders --query 'ConfigurationRecorders[0].name' --output text | grep -v "None" >/dev/null 2>&1; then
    print_status 0 "AWS Config enabled"
    ((PASSED++))
else
    print_status 1 "AWS Config not enabled"
    ((FAILED++))
fi

echo ""
echo "9. Validating GDPR Compliance Functions..."
echo "-----------------------------------------"

# Check GDPR Lambda functions
GDPR_FUNCTIONS=("${PROJECT_NAME}-gdpr-data-deletion" "${PROJECT_NAME}-gdpr-data-export")

for function in "${GDPR_FUNCTIONS[@]}"; do
    if aws lambda get-function --function-name "$function" >/dev/null 2>&1; then
        print_status 0 "GDPR Lambda function exists: $function"
        ((PASSED++))
    else
        print_status 1 "GDPR Lambda function missing: $function"
        ((FAILED++))
    fi
done

# Check GDPR export bucket
GDPR_BUCKET=$(aws s3api list-buckets --query "Buckets[?contains(Name, 'gdpr-exports')].Name" --output text | head -1)
if [ -n "$GDPR_BUCKET" ] && [ "$GDPR_BUCKET" != "None" ]; then
    print_status 0 "GDPR export bucket exists: $GDPR_BUCKET"
    ((PASSED++))
else
    print_status 1 "GDPR export bucket missing"
    ((FAILED++))
fi

echo ""
echo "10. Validating Security Scanning Automation..."
echo "---------------------------------------------"

# Check security scanner Lambda
SECURITY_SCANNER="${PROJECT_NAME}-security-scanner"
if aws lambda get-function --function-name "$SECURITY_SCANNER" >/dev/null 2>&1; then
    print_status 0 "Security scanner Lambda exists: $SECURITY_SCANNER"
    ((PASSED++))
    
    # Check EventBridge rule
    SCAN_RULE="${PROJECT_NAME}-security-scan-schedule"
    if aws events describe-rule --name "$SCAN_RULE" >/dev/null 2>&1; then
        print_status 0 "Security scan schedule exists: $SCAN_RULE"
        ((PASSED++))
    else
        print_status 1 "Security scan schedule missing: $SCAN_RULE"
        ((FAILED++))
    fi
else
    print_status 1 "Security scanner Lambda missing: $SECURITY_SCANNER"
    ((FAILED++))
fi

echo ""
echo "=================================================="
echo "Security and Compliance Validation Summary"
echo "=================================================="
echo -e "✅ Passed: ${GREEN}$PASSED${NC}"
echo -e "❌ Failed: ${RED}$FAILED${NC}"
echo -e "⚠️  Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All security validations passed!${NC}"
    echo "Your infrastructure meets security and compliance requirements."
    exit 0
else
    echo -e "${RED}🚨 Security validation failed!${NC}"
    echo "Please address the failed checks before proceeding to production."
    exit 1
fi