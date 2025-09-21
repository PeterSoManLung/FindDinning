#!/bin/bash

# Setup monitoring and logging for AI Restaurant Recommendation system
set -e

echo "Setting up monitoring and logging infrastructure..."

# Variables
AWS_REGION=${AWS_REGION:-"ap-southeast-1"}
ENVIRONMENT=${ENVIRONMENT:-"production"}
ALERT_EMAIL=${ALERT_EMAIL:-"admin@example.com"}

# Create CloudWatch Log Groups
echo "Creating CloudWatch Log Groups..."

log_groups=(
    "/aws/apigateway/ai-restaurant-recommendation"
    "/aws/ecs/user-service"
    "/aws/ecs/restaurant-service"
    "/aws/ecs/recommendation-engine"
    "/aws/ecs/review-service"
    "/aws/ecs/emotion-service"
    "/aws/ecs/data-integration-service"
    "/aws/lambda/model-retraining-trigger"
    "/aws/lambda/model-performance-monitor"
    "/aws/lambda/ab-test-manager"
)

for log_group in "${log_groups[@]}"; do
    echo "Creating log group: $log_group"
    aws logs create-log-group \
        --log-group-name "$log_group" \
        --region "$AWS_REGION" \
        --tags "Environment=$ENVIRONMENT,Service=ai-restaurant-recommendation" \
        2>/dev/null || echo "Log group $log_group already exists"
    
    # Set retention policy
    aws logs put-retention-policy \
        --log-group-name "$log_group" \
        --retention-in-days 30 \
        --region "$AWS_REGION"
done

# Create SNS topic for alerts
echo "Creating SNS topic for alerts..."
TOPIC_ARN=$(aws sns create-topic \
    --name "ai-restaurant-recommendation-alerts" \
    --region "$AWS_REGION" \
    --output text --query 'TopicArn')

echo "Created SNS topic: $TOPIC_ARN"

# Subscribe email to SNS topic
if [ ! -z "$ALERT_EMAIL" ]; then
    echo "Subscribing $ALERT_EMAIL to alerts..."
    aws sns subscribe \
        --topic-arn "$TOPIC_ARN" \
        --protocol email \
        --notification-endpoint "$ALERT_EMAIL" \
        --region "$AWS_REGION"
fi

# Create custom CloudWatch alarms
echo "Creating CloudWatch alarms..."

# Recommendation accuracy alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "recommendation-accuracy-low" \
    --alarm-description "Alert when recommendation accuracy drops below 70%" \
    --metric-name "RecommendationAccuracy" \
    --namespace "AI-Restaurant-Recommendation" \
    --statistic "Average" \
    --period 300 \
    --threshold 0.7 \
    --comparison-operator "LessThanThreshold" \
    --evaluation-periods 2 \
    --alarm-actions "$TOPIC_ARN" \
    --dimensions Name=Service,Value=recommendation-engine \
    --region "$AWS_REGION"

# Negative feedback analysis errors alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "negative-feedback-analysis-errors" \
    --alarm-description "Alert when negative feedback analysis errors exceed threshold" \
    --metric-name "NegativeFeedbackAnalysisErrors" \
    --namespace "AI-Restaurant-Recommendation" \
    --statistic "Sum" \
    --period 300 \
    --threshold 10 \
    --comparison-operator "GreaterThanThreshold" \
    --evaluation-periods 2 \
    --alarm-actions "$TOPIC_ARN" \
    --dimensions Name=Service,Value=review-service \
    --region "$AWS_REGION"

# User engagement alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "user-engagement-low" \
    --alarm-description "Alert when user engagement drops below 30%" \
    --metric-name "UserEngagement" \
    --namespace "AI-Restaurant-Recommendation" \
    --statistic "Average" \
    --period 900 \
    --threshold 0.3 \
    --comparison-operator "LessThanThreshold" \
    --evaluation-periods 3 \
    --alarm-actions "$TOPIC_ARN" \
    --dimensions Name=Service,Value=mobile-app \
    --region "$AWS_REGION"

# Data sync failures alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "data-sync-failures" \
    --alarm-description "Alert when data sync failures exceed threshold" \
    --metric-name "DataSyncFailures" \
    --namespace "AI-Restaurant-Recommendation" \
    --statistic "Sum" \
    --period 3600 \
    --threshold 3 \
    --comparison-operator "GreaterThanThreshold" \
    --evaluation-periods 1 \
    --alarm-actions "$TOPIC_ARN" \
    --dimensions Name=Service,Value=data-integration-service \
    --region "$AWS_REGION"

# Set up X-Ray sampling rules
echo "Setting up X-Ray sampling rules..."

# High priority sampling for authentication endpoints
aws xray put-sampling-rule \
    --sampling-rule '{
        "rule_name": "HighPrioritySampling",
        "priority": 5000,
        "fixed_rate": 0.5,
        "reservoir_size": 2,
        "service_name": "*",
        "service_type": "*",
        "host": "*",
        "url_path": "/api/auth/*",
        "http_method": "*",
        "version": 1
    }' \
    --region "$AWS_REGION"

# Recommendation sampling
aws xray put-sampling-rule \
    --sampling-rule '{
        "rule_name": "RecommendationSampling",
        "priority": 9000,
        "fixed_rate": 0.1,
        "reservoir_size": 1,
        "service_name": "*",
        "service_type": "*",
        "host": "*",
        "url_path": "/api/recommendations/*",
        "http_method": "*",
        "version": 1
    }' \
    --region "$AWS_REGION"

echo "Monitoring and logging setup completed successfully!"
echo "SNS Topic ARN: $TOPIC_ARN"
echo "Please check your email to confirm the subscription to alerts."