# ML/AI Infrastructure Deployment Guide

This guide covers the deployment of AI/ML models and services for the 搵食 (Find Dining) restaurant recommendation system.

## Overview

The ML infrastructure includes:
- **Amazon SageMaker** for model hosting and inference
- **Amazon Bedrock** for natural language processing
- **Model versioning and A/B testing** infrastructure
- **Automated monitoring and retraining** pipelines
- **Performance optimization** and caching

## Prerequisites

1. AWS CLI configured with appropriate permissions
2. Terraform >= 1.0
3. Python 3.9+ (for Lambda functions)
4. Docker (for containerized deployments)

## Required AWS Permissions

The deployment requires the following AWS services and permissions:
- SageMaker (full access for model deployment)
- Bedrock (model invocation permissions)
- Lambda (function creation and execution)
- DynamoDB (table creation and data access)
- S3 (bucket creation and object access)
- CloudWatch (metrics and logging)
- SNS (notifications)
- IAM (role and policy management)

## Deployment Steps

### 1. Prepare Lambda Functions

```bash
# Navigate to infrastructure directory
cd infrastructure

# Package Lambda functions
./scripts/deploy-ml-lambdas.sh
```

This script will:
- Create Python virtual environments for each Lambda function
- Install required dependencies
- Package functions into ZIP files
- Copy packages to the Terraform directory

### 2. Deploy Infrastructure

```bash
# Navigate to Terraform directory
cd terraform

# Initialize Terraform
terraform init

# Plan the deployment
terraform plan -var-file="environments/production.tfvars"

# Apply the infrastructure
terraform apply -var-file="environments/production.tfvars"
```

### 3. Upload Model Artifacts

After infrastructure deployment, upload your trained models:

```bash
# Upload recommendation model
aws s3 cp recommendation-model-1.0.0.tar.gz s3://your-ml-models-bucket/models/recommendation/1.0.0/model.tar.gz

# Upload sentiment analysis model
aws s3 cp sentiment-model-1.0.0.tar.gz s3://your-ml-models-bucket/models/sentiment/1.0.0/model.tar.gz
```

### 4. Validate Deployment

```bash
# Run validation script
./scripts/validate-ml-deployment.sh
```

## Model Deployment Process

### Automatic Deployment

Models are automatically deployed when uploaded to S3 with the following structure:
```
s3://ml-models-bucket/
├── models/
│   ├── recommendation/
│   │   ├── 1.0.0/
│   │   │   └── model.tar.gz
│   │   └── 1.1.0/
│   │       └── model.tar.gz
│   └── sentiment/
│       ├── 1.0.0/
│       │   └── model.tar.gz
│       └── 1.1.0/
│           └── model.tar.gz
```

### Manual Deployment

You can also trigger manual deployment using the model version manager:

```bash
# Deploy specific model version
aws lambda invoke \
  --function-name ai-restaurant-recommendation-model-version-manager \
  --payload '{"action": "deploy_model", "model_name": "recommendation", "version": "1.1.0"}' \
  response.json
```

## A/B Testing

### Creating A/B Tests

```bash
# Create new A/B test
aws lambda invoke \
  --function-name ai-restaurant-recommendation-ab-test-manager \
  --payload '{
    "action": "create_test",
    "test_name": "recommendation_v1_vs_v2",
    "model_name": "recommendation",
    "control_version": "1.0.0",
    "treatment_version": "1.1.0",
    "traffic_split": 50,
    "duration_days": 14,
    "success_metrics": ["recommendation_accuracy", "user_satisfaction"]
  }' \
  response.json
```

### Analyzing Test Results

```bash
# Analyze A/B test results
aws lambda invoke \
  --function-name ai-restaurant-recommendation-ab-test-manager \
  --payload '{"action": "analyze_test", "test_id": "your-test-id"}' \
  response.json
```

## Monitoring and Alerts

### CloudWatch Dashboard

Access the ML monitoring dashboard:
1. Go to CloudWatch Console
2. Navigate to Dashboards
3. Open "ai-restaurant-recommendation-ml-monitoring"

### Setting Up Alerts

The infrastructure automatically creates alerts for:
- High model latency (>5 seconds)
- High error rates (>5%)
- High CPU/Memory utilization
- Endpoint failures

### Custom Metrics

Add custom metrics to your applications:

```typescript
import { mlService } from '../shared/src/services/mlService';

// Record custom metric
await mlService.recordABTestResult(userId, 'recommendation', {
  metric_name: 'user_satisfaction',
  metric_value: 4.5,
  context: { restaurant_id: 'rest123' }
});
```

## Model Retraining

### Automatic Retraining

The system automatically checks for retraining needs daily based on:
- Performance degradation
- Data drift detection
- Model age policies

### Manual Retraining

Trigger manual retraining:

```bash
# Trigger model retraining
aws lambda invoke \
  --function-name ai-restaurant-recommendation-model-retraining-trigger \
  --payload '{
    "action": "trigger_retraining",
    "model_name": "recommendation",
    "reason": "Performance degradation detected"
  }' \
  response.json
```

## Integration with Microservices

### Using the ML Service

```typescript
import { mlService } from '../shared/src/services/mlService';

// Get recommendations
const recommendations = await mlService.getRecommendations(
  userId,
  userPreferences,
  emotionalState
);

// Analyze review sentiment
const sentiment = await mlService.analyzeReview(reviewText);

// Analyze negative feedback
const feedbackAnalysis = await mlService.analyzeNegativeFeedback(feedbackText);
```

### Environment Variables

Set these environment variables in your microservices:

```bash
# SageMaker endpoints
RECOMMENDATION_ENDPOINT_NAME=ai-restaurant-recommendation-recommendation-endpoint
SENTIMENT_ENDPOINT_NAME=ai-restaurant-recommendation-sentiment-endpoint

# Lambda functions
BEDROCK_NLP_FUNCTION_NAME=ai-restaurant-recommendation-bedrock-nlp-processor
AB_TEST_MANAGER_FUNCTION_NAME=ai-restaurant-recommendation-ab-test-manager
MODEL_PERFORMANCE_MONITOR_FUNCTION_NAME=ai-restaurant-recommendation-model-performance-monitor
MODEL_RETRAINING_TRIGGER_FUNCTION_NAME=ai-restaurant-recommendation-model-retraining-trigger

# AWS Region
AWS_REGION=us-east-1
```

## Security Considerations

### IAM Roles and Policies

The deployment creates least-privilege IAM roles:
- `sagemaker-execution-role`: For SageMaker model execution
- `bedrock-access-role`: For Bedrock API access
- `ml-management-role`: For Lambda function execution
- `ml-monitoring-role`: For monitoring and alerting

### Data Encryption

All data is encrypted:
- **At rest**: S3 buckets and DynamoDB tables use KMS encryption
- **In transit**: All API calls use HTTPS/TLS
- **Model artifacts**: Encrypted in S3

### Network Security

- SageMaker endpoints are deployed in private subnets
- Lambda functions have VPC configuration
- Security groups restrict access to necessary ports only

## Troubleshooting

### Common Issues

1. **Lambda function timeout**
   - Increase timeout in Terraform configuration
   - Optimize function code for better performance

2. **SageMaker endpoint not responding**
   - Check endpoint status in SageMaker console
   - Verify model artifacts are correctly uploaded
   - Check CloudWatch logs for errors

3. **Bedrock access denied**
   - Verify IAM permissions for Bedrock
   - Check if Bedrock is available in your region
   - Ensure model access is granted

### Debugging

Enable debug logging:

```bash
# Set log level for Lambda functions
aws lambda update-function-configuration \
  --function-name ai-restaurant-recommendation-bedrock-nlp-processor \
  --environment Variables='{LOG_LEVEL=DEBUG}'
```

### Health Checks

Monitor system health:

```typescript
// Check ML service health
const health = await mlService.healthCheck();
console.log('ML Service Health:', health);
```

## Cost Optimization

### SageMaker Costs

- Use `ml.t2.medium` instances for development
- Enable auto-scaling to handle traffic spikes
- Consider using Serverless Inference for low-traffic models

### Lambda Costs

- Optimize function memory allocation
- Use provisioned concurrency for high-traffic functions
- Monitor execution duration and optimize code

### Storage Costs

- Set lifecycle policies for S3 buckets
- Use DynamoDB TTL for temporary data
- Archive old model versions

## Maintenance

### Regular Tasks

1. **Weekly**: Review CloudWatch metrics and alerts
2. **Monthly**: Analyze A/B test results and deploy winning models
3. **Quarterly**: Review and update model training data
4. **Annually**: Review and optimize infrastructure costs

### Updates and Upgrades

1. Update Lambda function code by re-running deployment script
2. Update SageMaker models by uploading new versions to S3
3. Update Terraform configuration for infrastructure changes

## Support and Documentation

- **AWS Documentation**: [SageMaker](https://docs.aws.amazon.com/sagemaker/), [Bedrock](https://docs.aws.amazon.com/bedrock/)
- **Terraform AWS Provider**: [Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- **Internal Documentation**: See `shared/src/services/mlService.ts` for API reference

For issues and questions, check CloudWatch logs and contact the development team.