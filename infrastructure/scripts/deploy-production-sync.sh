#!/bin/bash

# Deploy Production Data Synchronization Infrastructure
# This script deploys all components needed for production data sync

set -e

ENVIRONMENT=${1:-staging}
AWS_REGION=${2:-ap-southeast-1}

echo "Deploying production data synchronization infrastructure for environment: $ENVIRONMENT"

# Check if required tools are installed
command -v terraform >/dev/null 2>&1 || { echo "Terraform is required but not installed. Aborting." >&2; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "AWS CLI is required but not installed. Aborting." >&2; exit 1; }
command -v zip >/dev/null 2>&1 || { echo "zip is required but not installed. Aborting." >&2; exit 1; }

# Set AWS region
export AWS_DEFAULT_REGION=$AWS_REGION

# Create Lambda deployment package for sync orchestrator
echo "Creating Lambda deployment package..."
cd infrastructure/lambda/sync_orchestrator
zip -r ../../../sync-orchestrator.zip . -x "*.git*" "node_modules/*" "*.DS_Store*"
cd ../../..

# Initialize Terraform
echo "Initializing Terraform..."
cd infrastructure/terraform
terraform init

# Plan deployment
echo "Planning Terraform deployment..."
terraform plan \
  -var="environment=$ENVIRONMENT" \
  -var="aws_region=$AWS_REGION" \
  -target=aws_cloudwatch_event_rule.monthly_sync \
  -target=aws_cloudwatch_event_rule.weekly_gov_sync \
  -target=aws_lambda_function.sync_orchestrator \
  -target=aws_s3_bucket.data_backup \
  -target=aws_sns_topic.sync_alerts \
  -target=aws_dynamodb_table.data_lineage \
  -target=aws_cloudwatch_log_group.sync_logs \
  -target=aws_cloudwatch_metric_alarm.sync_failure_alarm \
  -target=aws_cloudwatch_metric_alarm.data_staleness_alarm \
  -out=production-sync.tfplan

# Apply deployment
echo "Applying Terraform deployment..."
terraform apply production-sync.tfplan

# Get outputs
echo "Getting deployment outputs..."
SYNC_ORCHESTRATOR_ARN=$(terraform output -raw sync_orchestrator_arn 2>/dev/null || echo "")
DATA_BACKUP_BUCKET=$(terraform output -raw data_backup_bucket 2>/dev/null || echo "")
SNS_TOPIC_ARN=$(terraform output -raw sync_alerts_topic_arn 2>/dev/null || echo "")
LINEAGE_TABLE_NAME=$(terraform output -raw data_lineage_table_name 2>/dev/null || echo "")

cd ../..

# Update environment variables for data integration service
echo "Updating environment variables..."
cat > data-integration-service/.env.production-sync << EOF
# Production Sync Configuration
ENVIRONMENT=$ENVIRONMENT
AWS_REGION=$AWS_REGION
S3_BACKUP_BUCKET=$DATA_BACKUP_BUCKET
SNS_TOPIC_ARN=$SNS_TOPIC_ARN
LINEAGE_TABLE_NAME=$LINEAGE_TABLE_NAME
BACKUP_RETENTION_DAYS=365
BACKUP_COMPRESSION=true
BACKUP_ENCRYPTION=true
BACKUP_SCHEDULE=monthly

# Sync Configuration
SYNC_RETRY_ATTEMPTS=3
SYNC_TIMEOUT=7200000
SYNC_BATCH_SIZE=100
SYNC_MAX_CONCURRENT_JOBS=5

# Alert Thresholds
ALERT_ERROR_RATE_THRESHOLD=0.1
ALERT_STALENESS_THRESHOLD=0.7
ALERT_PERFORMANCE_THRESHOLD=300000
EOF

# Create SNS subscription for alerts (optional - can be configured manually)
if [ ! -z "$SNS_TOPIC_ARN" ]; then
  echo "Setting up SNS alert subscriptions..."
  
  # Add email subscription (replace with actual email)
  # aws sns subscribe \
  #   --topic-arn "$SNS_TOPIC_ARN" \
  #   --protocol email \
  #   --notification-endpoint "alerts@yourdomain.com"
  
  echo "SNS topic created: $SNS_TOPIC_ARN"
  echo "Please manually subscribe to the SNS topic for alert notifications"
fi

# Create CloudWatch dashboard
echo "Creating CloudWatch dashboard..."
cat > /tmp/dashboard-config.json << EOF
{
  "widgets": [
    {
      "type": "metric",
      "x": 0,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "DataIntegration", "SyncJobsExecuted", "Environment", "$ENVIRONMENT" ],
          [ ".", "SyncFailures", ".", "." ],
          [ ".", "RecordsProcessed", ".", "." ]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "$AWS_REGION",
        "title": "Data Sync Metrics"
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "DataIntegration", "SyncDuration", "Environment", "$ENVIRONMENT" ]
        ],
        "period": 300,
        "stat": "Average",
        "region": "$AWS_REGION",
        "title": "Sync Performance"
      }
    },
    {
      "type": "log",
      "x": 0,
      "y": 6,
      "width": 24,
      "height": 6,
      "properties": {
        "query": "SOURCE '/aws/data-sync/$ENVIRONMENT'\n| fields @timestamp, @message\n| filter @message like /ERROR/\n| sort @timestamp desc\n| limit 100",
        "region": "$AWS_REGION",
        "title": "Recent Sync Errors"
      }
    }
  ]
}
EOF

aws cloudwatch put-dashboard \
  --dashboard-name "DataSync-$ENVIRONMENT" \
  --dashboard-body file:///tmp/dashboard-config.json

rm /tmp/dashboard-config.json

# Test the deployment
echo "Testing deployment..."
if [ ! -z "$SYNC_ORCHESTRATOR_ARN" ]; then
  echo "Testing Lambda function..."
  aws lambda invoke \
    --function-name "data-sync-orchestrator-$ENVIRONMENT" \
    --payload '{"jobType":"test","sources":["hk_gov"]}' \
    /tmp/lambda-test-output.json
  
  echo "Lambda test result:"
  cat /tmp/lambda-test-output.json
  rm /tmp/lambda-test-output.json
fi

# Validate infrastructure deployment
echo "Validating infrastructure deployment..."

# Check if S3 bucket is accessible
if [ ! -z "$DATA_BACKUP_BUCKET" ]; then
  echo "Testing S3 bucket access..."
  aws s3 ls "s3://$DATA_BACKUP_BUCKET" > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo "✓ S3 bucket is accessible"
  else
    echo "✗ S3 bucket access failed"
  fi
fi

# Check if DynamoDB table exists
if [ ! -z "$LINEAGE_TABLE_NAME" ]; then
  echo "Testing DynamoDB table access..."
  aws dynamodb describe-table --table-name "$LINEAGE_TABLE_NAME" > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo "✓ DynamoDB table is accessible"
  else
    echo "✗ DynamoDB table access failed"
  fi
fi

# Check if SNS topic exists
if [ ! -z "$SNS_TOPIC_ARN" ]; then
  echo "Testing SNS topic access..."
  aws sns get-topic-attributes --topic-arn "$SNS_TOPIC_ARN" > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo "✓ SNS topic is accessible"
  else
    echo "✗ SNS topic access failed"
  fi
fi

# Test CloudWatch dashboard
echo "Testing CloudWatch dashboard..."
aws cloudwatch get-dashboard --dashboard-name "DataSync-$ENVIRONMENT" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✓ CloudWatch dashboard created successfully"
else
  echo "✗ CloudWatch dashboard creation failed"
fi

# Create test data lineage record
echo "Creating test data lineage record..."
cat > /tmp/test-lineage.json << EOF
{
  "record_id": "test-deployment-$(date +%s)",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "source": "hk_gov",
  "operation": "sync",
  "entityType": "metadata",
  "entityId": "deployment-test",
  "metadata": {
    "jobId": "deployment-test",
    "deploymentValidation": true
  },
  "dataQuality": {
    "validationScore": 1.0,
    "completenessScore": 1.0,
    "accuracyScore": 1.0,
    "consistencyScore": 1.0
  },
  "compliance": {
    "gdprCompliant": true,
    "dataRetentionDays": 365,
    "sensitiveDataFields": []
  }
}
EOF

aws dynamodb put-item \
  --table-name "$LINEAGE_TABLE_NAME" \
  --item file:///tmp/test-lineage.json > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✓ Test data lineage record created successfully"
else
  echo "✗ Failed to create test data lineage record"
fi

rm /tmp/test-lineage.json

# Create test backup
echo "Creating test backup..."
echo '{"test": "deployment-validation", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"}' > /tmp/test-backup.json

aws s3 cp /tmp/test-backup.json "s3://$DATA_BACKUP_BUCKET/test/deployment-validation.json" > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✓ Test backup created successfully"
  # Clean up test backup
  aws s3 rm "s3://$DATA_BACKUP_BUCKET/test/deployment-validation.json" > /dev/null 2>&1
else
  echo "✗ Failed to create test backup"
fi

rm /tmp/test-backup.json

# Clean up
rm -f sync-orchestrator.zip

echo "Production data synchronization deployment completed successfully!"
echo ""
echo "Deployment Summary:"
echo "==================="
echo "Environment: $ENVIRONMENT"
echo "AWS Region: $AWS_REGION"
echo "Sync Orchestrator: $SYNC_ORCHESTRATOR_ARN"
echo "Backup Bucket: $DATA_BACKUP_BUCKET"
echo "SNS Topic: $SNS_TOPIC_ARN"
echo "Lineage Table: $LINEAGE_TABLE_NAME"
echo ""
echo "Next Steps:"
echo "1. Subscribe to SNS topic for alert notifications"
echo "2. Configure data integration service with production sync environment variables"
echo "3. Test emergency sync functionality"
echo "4. Set up monitoring dashboards"
echo "5. Configure backup retention policies"
echo ""
echo "CloudWatch Dashboard: https://console.aws.amazon.com/cloudwatch/home?region=$AWS_REGION#dashboards:name=DataSync-$ENVIRONMENT"