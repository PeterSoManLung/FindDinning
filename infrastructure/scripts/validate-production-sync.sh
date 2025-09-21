#!/bin/bash

# Validate Production Data Synchronization System
# This script validates all components of the production sync infrastructure

set -e

ENVIRONMENT=${1:-staging}
AWS_REGION=${2:-ap-southeast-1}

echo "Validating production data synchronization system for environment: $ENVIRONMENT"

# Set AWS region
export AWS_DEFAULT_REGION=$AWS_REGION

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Validation results
VALIDATION_RESULTS=()

# Function to add validation result
add_result() {
    local status=$1
    local message=$2
    VALIDATION_RESULTS+=("$status:$message")
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} $message"
    elif [ "$status" = "FAIL" ]; then
        echo -e "${RED}✗${NC} $message"
    else
        echo -e "${YELLOW}⚠${NC} $message"
    fi
}

# Function to test AWS resource
test_aws_resource() {
    local resource_type=$1
    local resource_name=$2
    local test_command=$3
    
    echo "Testing $resource_type: $resource_name"
    
    if eval "$test_command" > /dev/null 2>&1; then
        add_result "PASS" "$resource_type $resource_name is accessible"
        return 0
    else
        add_result "FAIL" "$resource_type $resource_name is not accessible"
        return 1
    fi
}

echo "Starting validation..."

# 1. Validate Lambda Function
echo "=== Lambda Function Validation ==="
LAMBDA_FUNCTION_NAME="data-sync-orchestrator-$ENVIRONMENT"

if test_aws_resource "Lambda Function" "$LAMBDA_FUNCTION_NAME" "aws lambda get-function --function-name $LAMBDA_FUNCTION_NAME"; then
    # Test Lambda invocation
    echo "Testing Lambda function invocation..."
    LAMBDA_RESULT=$(aws lambda invoke \
        --function-name "$LAMBDA_FUNCTION_NAME" \
        --payload '{"jobType":"validation-test","sources":["hk_gov"]}' \
        --cli-read-timeout 30 \
        /tmp/lambda-validation-output.json 2>&1)
    
    if [ $? -eq 0 ]; then
        add_result "PASS" "Lambda function invocation successful"
        
        # Check response
        if grep -q '"success":true' /tmp/lambda-validation-output.json 2>/dev/null; then
            add_result "PASS" "Lambda function returned success response"
        else
            add_result "WARN" "Lambda function returned non-success response"
        fi
    else
        add_result "FAIL" "Lambda function invocation failed: $LAMBDA_RESULT"
    fi
    
    rm -f /tmp/lambda-validation-output.json
fi

# 2. Validate S3 Backup Bucket
echo "=== S3 Backup Bucket Validation ==="
BACKUP_BUCKET_NAME=$(aws ssm get-parameter --name "/data-sync/$ENVIRONMENT/backup-bucket" --query 'Parameter.Value' --output text 2>/dev/null || echo "")

if [ -z "$BACKUP_BUCKET_NAME" ]; then
    # Try to get from Terraform output
    cd infrastructure/terraform 2>/dev/null || true
    BACKUP_BUCKET_NAME=$(terraform output -raw data_backup_bucket 2>/dev/null || echo "")
    cd - > /dev/null 2>&1 || true
fi

if [ ! -z "$BACKUP_BUCKET_NAME" ]; then
    if test_aws_resource "S3 Bucket" "$BACKUP_BUCKET_NAME" "aws s3 ls s3://$BACKUP_BUCKET_NAME"; then
        # Test bucket write permissions
        echo "Testing S3 bucket write permissions..."
        TEST_KEY="validation/test-$(date +%s).json"
        echo '{"validation": "test", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"}' > /tmp/s3-test.json
        
        if aws s3 cp /tmp/s3-test.json "s3://$BACKUP_BUCKET_NAME/$TEST_KEY" > /dev/null 2>&1; then
            add_result "PASS" "S3 bucket write permissions working"
            
            # Test bucket read permissions
            if aws s3 cp "s3://$BACKUP_BUCKET_NAME/$TEST_KEY" /tmp/s3-read-test.json > /dev/null 2>&1; then
                add_result "PASS" "S3 bucket read permissions working"
            else
                add_result "FAIL" "S3 bucket read permissions not working"
            fi
            
            # Clean up test files
            aws s3 rm "s3://$BACKUP_BUCKET_NAME/$TEST_KEY" > /dev/null 2>&1
            rm -f /tmp/s3-read-test.json
        else
            add_result "FAIL" "S3 bucket write permissions not working"
        fi
        
        rm -f /tmp/s3-test.json
        
        # Check bucket lifecycle configuration
        if aws s3api get-bucket-lifecycle-configuration --bucket "$BACKUP_BUCKET_NAME" > /dev/null 2>&1; then
            add_result "PASS" "S3 bucket lifecycle configuration exists"
        else
            add_result "WARN" "S3 bucket lifecycle configuration not found"
        fi
        
        # Check bucket encryption
        if aws s3api get-bucket-encryption --bucket "$BACKUP_BUCKET_NAME" > /dev/null 2>&1; then
            add_result "PASS" "S3 bucket encryption enabled"
        else
            add_result "WARN" "S3 bucket encryption not enabled"
        fi
    fi
else
    add_result "FAIL" "S3 backup bucket name not found"
fi

# 3. Validate DynamoDB Lineage Table
echo "=== DynamoDB Lineage Table Validation ==="
LINEAGE_TABLE_NAME="data-lineage-$ENVIRONMENT"

if test_aws_resource "DynamoDB Table" "$LINEAGE_TABLE_NAME" "aws dynamodb describe-table --table-name $LINEAGE_TABLE_NAME"; then
    # Test table write permissions
    echo "Testing DynamoDB table write permissions..."
    TEST_RECORD_ID="validation-test-$(date +%s)"
    
    cat > /tmp/dynamodb-test.json << EOF
{
    "record_id": {"S": "$TEST_RECORD_ID"},
    "timestamp": {"S": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)"},
    "source": {"S": "validation"},
    "operation": {"S": "test"},
    "entityType": {"S": "validation"},
    "entityId": {"S": "test-entity"},
    "dataQuality": {
        "M": {
            "validationScore": {"N": "1.0"},
            "completenessScore": {"N": "1.0"},
            "accuracyScore": {"N": "1.0"},
            "consistencyScore": {"N": "1.0"}
        }
    },
    "compliance": {
        "M": {
            "gdprCompliant": {"BOOL": true},
            "dataRetentionDays": {"N": "365"},
            "sensitiveDataFields": {"L": []}
        }
    }
}
EOF
    
    if aws dynamodb put-item --table-name "$LINEAGE_TABLE_NAME" --item file:///tmp/dynamodb-test.json > /dev/null 2>&1; then
        add_result "PASS" "DynamoDB table write permissions working"
        
        # Test table read permissions
        if aws dynamodb get-item --table-name "$LINEAGE_TABLE_NAME" --key '{"record_id":{"S":"'$TEST_RECORD_ID'"},"timestamp":{"S":"'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"}}' > /dev/null 2>&1; then
            add_result "PASS" "DynamoDB table read permissions working"
        else
            add_result "WARN" "DynamoDB table read permissions may not be working"
        fi
        
        # Clean up test record
        aws dynamodb delete-item --table-name "$LINEAGE_TABLE_NAME" --key '{"record_id":{"S":"'$TEST_RECORD_ID'"},"timestamp":{"S":"'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"}}' > /dev/null 2>&1
    else
        add_result "FAIL" "DynamoDB table write permissions not working"
    fi
    
    rm -f /tmp/dynamodb-test.json
    
    # Check table backup settings
    if aws dynamodb describe-continuous-backups --table-name "$LINEAGE_TABLE_NAME" | grep -q '"PointInTimeRecoveryStatus": "ENABLED"' 2>/dev/null; then
        add_result "PASS" "DynamoDB point-in-time recovery enabled"
    else
        add_result "WARN" "DynamoDB point-in-time recovery not enabled"
    fi
fi

# 4. Validate SNS Topic
echo "=== SNS Topic Validation ==="
SNS_TOPIC_NAME="data-sync-alerts-$ENVIRONMENT"
SNS_TOPIC_ARN=$(aws sns list-topics --query "Topics[?contains(TopicArn, '$SNS_TOPIC_NAME')].TopicArn" --output text 2>/dev/null)

if [ ! -z "$SNS_TOPIC_ARN" ]; then
    if test_aws_resource "SNS Topic" "$SNS_TOPIC_ARN" "aws sns get-topic-attributes --topic-arn $SNS_TOPIC_ARN"; then
        # Test SNS publish permissions
        echo "Testing SNS publish permissions..."
        if aws sns publish --topic-arn "$SNS_TOPIC_ARN" --subject "Validation Test" --message "This is a validation test message from production sync validation script." > /dev/null 2>&1; then
            add_result "PASS" "SNS publish permissions working"
        else
            add_result "FAIL" "SNS publish permissions not working"
        fi
        
        # Check subscriptions
        SUBSCRIPTION_COUNT=$(aws sns list-subscriptions-by-topic --topic-arn "$SNS_TOPIC_ARN" --query 'length(Subscriptions)' --output text 2>/dev/null || echo "0")
        if [ "$SUBSCRIPTION_COUNT" -gt 0 ]; then
            add_result "PASS" "SNS topic has $SUBSCRIPTION_COUNT subscription(s)"
        else
            add_result "WARN" "SNS topic has no subscriptions - alerts will not be delivered"
        fi
    fi
else
    add_result "FAIL" "SNS topic not found"
fi

# 5. Validate CloudWatch Alarms
echo "=== CloudWatch Alarms Validation ==="
ALARM_NAMES=(
    "data-sync-failures-$ENVIRONMENT"
    "data-staleness-$ENVIRONMENT"
    "data-quality-degradation-$ENVIRONMENT"
    "compliance-rate-low-$ENVIRONMENT"
)

for alarm_name in "${ALARM_NAMES[@]}"; do
    if aws cloudwatch describe-alarms --alarm-names "$alarm_name" --query 'MetricAlarms[0].AlarmName' --output text 2>/dev/null | grep -q "$alarm_name"; then
        add_result "PASS" "CloudWatch alarm '$alarm_name' exists"
    else
        add_result "FAIL" "CloudWatch alarm '$alarm_name' not found"
    fi
done

# 6. Validate CloudWatch Dashboard
echo "=== CloudWatch Dashboard Validation ==="
DASHBOARD_NAME="DataSync-$ENVIRONMENT"

if aws cloudwatch get-dashboard --dashboard-name "$DASHBOARD_NAME" > /dev/null 2>&1; then
    add_result "PASS" "CloudWatch dashboard '$DASHBOARD_NAME' exists"
else
    add_result "FAIL" "CloudWatch dashboard '$DASHBOARD_NAME' not found"
fi

# 7. Validate EventBridge Rules
echo "=== EventBridge Rules Validation ==="
RULE_NAMES=(
    "monthly-hk-platforms-sync"
    "weekly-gov-data-sync"
)

for rule_name in "${RULE_NAMES[@]}"; do
    if aws events describe-rule --name "$rule_name" > /dev/null 2>&1; then
        add_result "PASS" "EventBridge rule '$rule_name' exists"
        
        # Check if rule has targets
        TARGET_COUNT=$(aws events list-targets-by-rule --rule "$rule_name" --query 'length(Targets)' --output text 2>/dev/null || echo "0")
        if [ "$TARGET_COUNT" -gt 0 ]; then
            add_result "PASS" "EventBridge rule '$rule_name' has $TARGET_COUNT target(s)"
        else
            add_result "WARN" "EventBridge rule '$rule_name' has no targets"
        fi
    else
        add_result "FAIL" "EventBridge rule '$rule_name' not found"
    fi
done

# 8. Validate IAM Permissions
echo "=== IAM Permissions Validation ==="
LAMBDA_ROLE_NAME="sync-orchestrator-role-$ENVIRONMENT"

if aws iam get-role --role-name "$LAMBDA_ROLE_NAME" > /dev/null 2>&1; then
    add_result "PASS" "Lambda execution role '$LAMBDA_ROLE_NAME' exists"
    
    # Check attached policies
    POLICY_COUNT=$(aws iam list-attached-role-policies --role-name "$LAMBDA_ROLE_NAME" --query 'length(AttachedPolicies)' --output text 2>/dev/null || echo "0")
    INLINE_POLICY_COUNT=$(aws iam list-role-policies --role-name "$LAMBDA_ROLE_NAME" --query 'length(PolicyNames)' --output text 2>/dev/null || echo "0")
    
    if [ "$POLICY_COUNT" -gt 0 ] || [ "$INLINE_POLICY_COUNT" -gt 0 ]; then
        add_result "PASS" "Lambda execution role has policies attached ($POLICY_COUNT managed, $INLINE_POLICY_COUNT inline)"
    else
        add_result "FAIL" "Lambda execution role has no policies attached"
    fi
else
    add_result "FAIL" "Lambda execution role '$LAMBDA_ROLE_NAME' not found"
fi

# 9. Validate System Parameters
echo "=== System Parameters Validation ==="
PARAM_NAME="/data-sync/$ENVIRONMENT/config"

if aws ssm get-parameter --name "$PARAM_NAME" > /dev/null 2>&1; then
    add_result "PASS" "System parameter '$PARAM_NAME' exists"
    
    # Validate parameter content
    PARAM_VALUE=$(aws ssm get-parameter --name "$PARAM_NAME" --query 'Parameter.Value' --output text 2>/dev/null)
    if echo "$PARAM_VALUE" | jq . > /dev/null 2>&1; then
        add_result "PASS" "System parameter contains valid JSON"
        
        # Check required fields
        if echo "$PARAM_VALUE" | jq -e '.retryAttempts' > /dev/null 2>&1; then
            add_result "PASS" "System parameter contains retryAttempts"
        else
            add_result "WARN" "System parameter missing retryAttempts"
        fi
        
        if echo "$PARAM_VALUE" | jq -e '.alertThresholds' > /dev/null 2>&1; then
            add_result "PASS" "System parameter contains alertThresholds"
        else
            add_result "WARN" "System parameter missing alertThresholds"
        fi
    else
        add_result "FAIL" "System parameter contains invalid JSON"
    fi
else
    add_result "FAIL" "System parameter '$PARAM_NAME' not found"
fi

# 10. Validate Data Integration Service Connectivity
echo "=== Data Integration Service Validation ==="
# This would typically test the actual service endpoint
# For now, we'll check if the service configuration exists

if [ -f "data-integration-service/.env.production-sync" ]; then
    add_result "PASS" "Data integration service configuration file exists"
    
    # Check required environment variables
    if grep -q "S3_BACKUP_BUCKET" data-integration-service/.env.production-sync; then
        add_result "PASS" "Data integration service has S3_BACKUP_BUCKET configured"
    else
        add_result "WARN" "Data integration service missing S3_BACKUP_BUCKET configuration"
    fi
    
    if grep -q "LINEAGE_TABLE_NAME" data-integration-service/.env.production-sync; then
        add_result "PASS" "Data integration service has LINEAGE_TABLE_NAME configured"
    else
        add_result "WARN" "Data integration service missing LINEAGE_TABLE_NAME configuration"
    fi
else
    add_result "WARN" "Data integration service configuration file not found"
fi

# Summary
echo ""
echo "=== Validation Summary ==="

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

for result in "${VALIDATION_RESULTS[@]}"; do
    status=$(echo "$result" | cut -d':' -f1)
    case "$status" in
        "PASS") ((PASS_COUNT++)) ;;
        "FAIL") ((FAIL_COUNT++)) ;;
        "WARN") ((WARN_COUNT++)) ;;
    esac
done

echo -e "${GREEN}Passed: $PASS_COUNT${NC}"
echo -e "${RED}Failed: $FAIL_COUNT${NC}"
echo -e "${YELLOW}Warnings: $WARN_COUNT${NC}"

if [ $FAIL_COUNT -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Production data synchronization system validation completed successfully!${NC}"
    
    if [ $WARN_COUNT -gt 0 ]; then
        echo -e "${YELLOW}⚠ There are $WARN_COUNT warnings that should be addressed.${NC}"
    fi
    
    exit 0
else
    echo ""
    echo -e "${RED}✗ Production data synchronization system validation failed with $FAIL_COUNT errors.${NC}"
    echo "Please address the failed validations before proceeding to production."
    exit 1
fi