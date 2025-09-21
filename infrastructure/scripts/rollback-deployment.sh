#!/bin/bash

# Rollback Deployment Script for AI Restaurant Recommendation System
# Usage: ./rollback-deployment.sh <environment> [service] [target_version]

set -e

ENVIRONMENT=$1
SERVICE=$2
TARGET_VERSION=$3
NAMESPACE=$ENVIRONMENT

if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 <environment> [service] [target_version]"
    echo "Examples:"
    echo "  $0 production                    # Rollback all services to previous version"
    echo "  $0 production user-service       # Rollback specific service to previous version"
    echo "  $0 production user-service v1.2.3 # Rollback specific service to specific version"
    exit 1
fi

echo "Starting rollback process for environment: $ENVIRONMENT"

# Define services
ALL_SERVICES=("api-gateway" "user-service" "restaurant-service" "recommendation-engine" "review-service" "emotion-service" "data-integration-service")

# Function to get deployment history
get_deployment_history() {
    local service=$1
    echo "Getting deployment history for $service..."
    kubectl rollout history deployment/$service -n $NAMESPACE
}

# Function to get previous version
get_previous_version() {
    local service=$1
    
    # Get the current revision number
    local current_revision=$(kubectl get deployment $service -n $NAMESPACE -o jsonpath='{.metadata.annotations.deployment\.kubernetes\.io/revision}')
    local previous_revision=$((current_revision - 1))
    
    if [ $previous_revision -lt 1 ]; then
        echo "No previous version available for $service"
        return 1
    fi
    
    echo $previous_revision
}

# Function to rollback service
rollback_service() {
    local service=$1
    local target_revision=$2
    
    echo "Rolling back $service to revision $target_revision..."
    
    # Perform rollback
    if [ -n "$target_revision" ]; then
        kubectl rollout undo deployment/$service --to-revision=$target_revision -n $NAMESPACE
    else
        kubectl rollout undo deployment/$service -n $NAMESPACE
    fi
    
    # Wait for rollback to complete
    echo "Waiting for rollback to complete..."
    kubectl rollout status deployment/$service -n $NAMESPACE --timeout=300s
    
    # Verify rollback
    local new_revision=$(kubectl get deployment $service -n $NAMESPACE -o jsonpath='{.metadata.annotations.deployment\.kubernetes\.io/revision}')
    echo "Rollback completed. New revision: $new_revision"
    
    return 0
}

# Function to rollback by image tag
rollback_by_image_tag() {
    local service=$1
    local target_version=$2
    
    echo "Rolling back $service to image version $target_version..."
    
    # Update deployment with target image
    local image_name="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com/${IMAGE_REPO_NAME}-${service}:${target_version}"
    
    kubectl set image deployment/$service $service=$image_name -n $NAMESPACE
    
    # Wait for rollout to complete
    kubectl rollout status deployment/$service -n $NAMESPACE --timeout=300s
    
    echo "Rollback to version $target_version completed for $service"
    return 0
}

# Function to verify rollback
verify_rollback() {
    local service=$1
    
    echo "Verifying rollback for $service..."
    
    # Check if deployment is ready
    local ready_replicas=$(kubectl get deployment $service -n $NAMESPACE -o jsonpath='{.status.readyReplicas}')
    local desired_replicas=$(kubectl get deployment $service -n $NAMESPACE -o jsonpath='{.spec.replicas}')
    
    if [ "$ready_replicas" != "$desired_replicas" ]; then
        echo "❌ Rollback verification failed for $service: $ready_replicas/$desired_replicas pods ready"
        return 1
    fi
    
    # Test health endpoint
    echo "Testing health endpoint for $service..."
    local pod_name=$(kubectl get pods -n $NAMESPACE -l app=$service -o jsonpath='{.items[0].metadata.name}')
    
    if [ -n "$pod_name" ]; then
        local health_check=$(kubectl exec $pod_name -n $NAMESPACE -- curl -f http://localhost:3000/health 2>/dev/null || echo "FAILED")
        
        if [[ "$health_check" == *"FAILED"* ]]; then
            echo "❌ Health check failed for $service after rollback"
            return 1
        fi
    fi
    
    echo "✅ Rollback verification passed for $service"
    return 0
}

# Function to create rollback report
create_rollback_report() {
    local services_array=("$@")
    
    cat > /tmp/rollback-report.json << EOF
{
    "rollback_type": "$([ -n "$SERVICE" ] && echo "single_service" || echo "full_system")",
    "environment": "$ENVIRONMENT",
    "timestamp": "$(date -Iseconds)",
    "target_version": "${TARGET_VERSION:-previous}",
    "services": [
EOF

    for i in "${!services_array[@]}"; do
        local service=${services_array[$i]}
        local current_image=$(kubectl get deployment $service -n $NAMESPACE -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "unknown")
        local current_revision=$(kubectl get deployment $service -n $NAMESPACE -o jsonpath='{.metadata.annotations.deployment\.kubernetes\.io/revision}' 2>/dev/null || echo "unknown")
        
        echo "        {" >> /tmp/rollback-report.json
        echo "            \"service\": \"$service\"," >> /tmp/rollback-report.json
        echo "            \"current_image\": \"$current_image\"," >> /tmp/rollback-report.json
        echo "            \"current_revision\": \"$current_revision\"," >> /tmp/rollback-report.json
        echo "            \"status\": \"rolled_back\"" >> /tmp/rollback-report.json
        
        if [ $i -eq $((${#services_array[@]} - 1)) ]; then
            echo "        }" >> /tmp/rollback-report.json
        else
            echo "        }," >> /tmp/rollback-report.json
        fi
    done

    cat >> /tmp/rollback-report.json << EOF
    ],
    "status": "completed"
}
EOF
}

# Function to send rollback notification
send_rollback_notification() {
    local status=$1
    
    echo "Sending rollback notification..."
    
    # Create notification message
    local message="Rollback $status for environment: $ENVIRONMENT"
    if [ -n "$SERVICE" ]; then
        message="$message (Service: $SERVICE)"
    fi
    if [ -n "$TARGET_VERSION" ]; then
        message="$message (Target Version: $TARGET_VERSION)"
    fi
    
    # Send to SNS topic if configured
    if [ -n "$SNS_TOPIC_ARN" ]; then
        aws sns publish \
            --topic-arn "$SNS_TOPIC_ARN" \
            --message "$message" \
            --subject "Deployment Rollback Notification" \
            2>/dev/null || echo "Failed to send SNS notification"
    fi
    
    # Log to CloudWatch if configured
    if [ -n "$CLOUDWATCH_LOG_GROUP" ]; then
        aws logs put-log-events \
            --log-group-name "$CLOUDWATCH_LOG_GROUP" \
            --log-stream-name "rollback-$(date +%Y-%m-%d)" \
            --log-events timestamp=$(date +%s000),message="$message" \
            2>/dev/null || echo "Failed to log to CloudWatch"
    fi
}

# Main rollback logic
echo "Starting rollback process..."

# Determine which services to rollback
if [ -n "$SERVICE" ]; then
    # Rollback specific service
    if [[ " ${ALL_SERVICES[@]} " =~ " ${SERVICE} " ]]; then
        SERVICES_TO_ROLLBACK=("$SERVICE")
    else
        echo "Error: Invalid service name '$SERVICE'"
        echo "Available services: ${ALL_SERVICES[*]}"
        exit 1
    fi
else
    # Rollback all services
    SERVICES_TO_ROLLBACK=("${ALL_SERVICES[@]}")
fi

echo "Services to rollback: ${SERVICES_TO_ROLLBACK[*]}"

# Confirm rollback
echo ""
echo "⚠️  WARNING: This will rollback the following services in $ENVIRONMENT:"
for service in "${SERVICES_TO_ROLLBACK[@]}"; do
    echo "   - $service"
    get_deployment_history $service
done

echo ""
read -p "Are you sure you want to proceed with the rollback? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Rollback cancelled."
    exit 0
fi

# Perform rollback
rollback_failed=false

for service in "${SERVICES_TO_ROLLBACK[@]}"; do
    echo ""
    echo "Processing rollback for $service..."
    
    if [ -n "$TARGET_VERSION" ]; then
        # Rollback to specific version
        if rollback_by_image_tag $service $TARGET_VERSION; then
            if verify_rollback $service; then
                echo "✅ Successfully rolled back $service to version $TARGET_VERSION"
            else
                echo "❌ Rollback verification failed for $service"
                rollback_failed=true
            fi
        else
            echo "❌ Failed to rollback $service to version $TARGET_VERSION"
            rollback_failed=true
        fi
    else
        # Rollback to previous version
        previous_revision=$(get_previous_version $service)
        if [ $? -eq 0 ]; then
            if rollback_service $service $previous_revision; then
                if verify_rollback $service; then
                    echo "✅ Successfully rolled back $service to previous version"
                else
                    echo "❌ Rollback verification failed for $service"
                    rollback_failed=true
                fi
            else
                echo "❌ Failed to rollback $service"
                rollback_failed=true
            fi
        else
            echo "❌ Cannot rollback $service: $previous_revision"
            rollback_failed=true
        fi
    fi
done

# Generate rollback report
create_rollback_report "${SERVICES_TO_ROLLBACK[@]}"

echo ""
echo "Rollback Summary:"
echo "================="
cat /tmp/rollback-report.json

# Send notification
if [ "$rollback_failed" = true ]; then
    send_rollback_notification "FAILED"
    echo ""
    echo "💥 Rollback completed with failures. Please check the logs above."
    exit 1
else
    send_rollback_notification "SUCCESSFUL"
    echo ""
    echo "🎉 Rollback completed successfully!"
    
    # Run smoke tests to verify system health
    echo ""
    echo "Running smoke tests to verify system health..."
    if ./infrastructure/scripts/smoke-tests.sh $ENVIRONMENT; then
        echo "✅ Post-rollback smoke tests passed"
    else
        echo "⚠️  Post-rollback smoke tests failed. Please investigate."
    fi
    
    exit 0
fi