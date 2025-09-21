#!/bin/bash

# Blue-Green Deployment Script for AI Restaurant Recommendation System
# Usage: ./blue-green-deploy.sh <environment> <image_tag>

set -e

ENVIRONMENT=$1
IMAGE_TAG=$2
NAMESPACE=$ENVIRONMENT

if [ -z "$ENVIRONMENT" ] || [ -z "$IMAGE_TAG" ]; then
    echo "Usage: $0 <environment> <image_tag>"
    exit 1
fi

echo "Starting blue-green deployment for environment: $ENVIRONMENT with image tag: $IMAGE_TAG"

# Define services
SERVICES=("api-gateway" "user-service" "restaurant-service" "recommendation-engine" "review-service" "emotion-service" "data-integration-service")

# Function to check if deployment exists
deployment_exists() {
    kubectl get deployment $1 -n $NAMESPACE >/dev/null 2>&1
}

# Function to get current deployment color
get_current_color() {
    local service=$1
    if deployment_exists "${service}-blue"; then
        if deployment_exists "${service}-green"; then
            # Both exist, check which one is active
            local blue_replicas=$(kubectl get deployment ${service}-blue -n $NAMESPACE -o jsonpath='{.spec.replicas}')
            local green_replicas=$(kubectl get deployment ${service}-green -n $NAMESPACE -o jsonpath='{.spec.replicas}')
            
            if [ "$blue_replicas" -gt 0 ]; then
                echo "blue"
            else
                echo "green"
            fi
        else
            echo "blue"
        fi
    elif deployment_exists "${service}-green"; then
        echo "green"
    else
        echo "none"
    fi
}

# Function to get next deployment color
get_next_color() {
    local current=$1
    if [ "$current" = "blue" ]; then
        echo "green"
    elif [ "$current" = "green" ]; then
        echo "blue"
    else
        echo "blue"  # Default to blue for first deployment
    fi
}

# Function to create deployment manifest
create_deployment_manifest() {
    local service=$1
    local color=$2
    local image_tag=$3
    
    cat > /tmp/${service}-${color}-deployment.yaml << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${service}-${color}
  namespace: ${NAMESPACE}
  labels:
    app: ${service}
    color: ${color}
    version: ${image_tag}
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ${service}
      color: ${color}
  template:
    metadata:
      labels:
        app: ${service}
        color: ${color}
        version: ${image_tag}
    spec:
      containers:
      - name: ${service}
        image: ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com/${IMAGE_REPO_NAME}-${service}:${image_tag}
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "${ENVIRONMENT}"
        - name: PORT
          value: "3000"
        envFrom:
        - secretRef:
            name: db-credentials
        - secretRef:
            name: api-keys
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
EOF
}

# Function to update service selector
update_service_selector() {
    local service=$1
    local color=$2
    
    echo "Updating service selector for $service to $color"
    kubectl patch service $service -n $NAMESPACE -p '{"spec":{"selector":{"color":"'$color'"}}}'
}

# Function to run health checks
run_health_checks() {
    local service=$1
    local color=$2
    
    echo "Running health checks for ${service}-${color}..."
    
    # Wait for deployment to be ready
    kubectl rollout status deployment/${service}-${color} -n $NAMESPACE --timeout=300s
    
    # Check if pods are ready
    local ready_pods=$(kubectl get deployment ${service}-${color} -n $NAMESPACE -o jsonpath='{.status.readyReplicas}')
    local desired_pods=$(kubectl get deployment ${service}-${color} -n $NAMESPACE -o jsonpath='{.spec.replicas}')
    
    if [ "$ready_pods" != "$desired_pods" ]; then
        echo "Health check failed for ${service}-${color}: $ready_pods/$desired_pods pods ready"
        return 1
    fi
    
    # Additional health check via HTTP endpoint
    local pod_name=$(kubectl get pods -n $NAMESPACE -l app=$service,color=$color -o jsonpath='{.items[0].metadata.name}')
    if [ -n "$pod_name" ]; then
        kubectl exec $pod_name -n $NAMESPACE -- curl -f http://localhost:3000/health || {
            echo "HTTP health check failed for ${service}-${color}"
            return 1
        }
    fi
    
    echo "Health checks passed for ${service}-${color}"
    return 0
}

# Function to rollback deployment
rollback_deployment() {
    local service=$1
    local current_color=$2
    local previous_color=$3
    
    echo "Rolling back $service from $current_color to $previous_color"
    
    # Switch service back to previous color
    update_service_selector $service $previous_color
    
    # Scale down the failed deployment
    kubectl scale deployment ${service}-${current_color} -n $NAMESPACE --replicas=0
    
    echo "Rollback completed for $service"
}

# Main deployment logic
echo "Starting blue-green deployment process..."

# Store rollback information
declare -A ROLLBACK_INFO

for service in "${SERVICES[@]}"; do
    echo "Processing service: $service"
    
    # Determine current and next colors
    current_color=$(get_current_color $service)
    next_color=$(get_next_color $current_color)
    
    echo "Current color: $current_color, Next color: $next_color"
    
    # Store rollback info
    ROLLBACK_INFO[$service]=$current_color
    
    # Create deployment manifest for next color
    create_deployment_manifest $service $next_color $IMAGE_TAG
    
    # Deploy to next color
    echo "Deploying ${service}-${next_color}..."
    kubectl apply -f /tmp/${service}-${next_color}-deployment.yaml
    
    # Wait for deployment to be ready and run health checks
    if run_health_checks $service $next_color; then
        echo "Health checks passed for ${service}-${next_color}"
        
        # Switch traffic to new deployment
        update_service_selector $service $next_color
        
        # Wait a bit to ensure traffic is flowing
        sleep 10
        
        # Run additional smoke tests
        echo "Running smoke tests for $service..."
        if ./infrastructure/scripts/smoke-tests.sh $ENVIRONMENT $service; then
            echo "Smoke tests passed for $service"
            
            # Scale down old deployment if it exists
            if [ "$current_color" != "none" ]; then
                echo "Scaling down ${service}-${current_color}..."
                kubectl scale deployment ${service}-${current_color} -n $NAMESPACE --replicas=0
                
                # Optionally delete old deployment after some time
                # kubectl delete deployment ${service}-${current_color} -n $NAMESPACE
            fi
            
            echo "Successfully deployed ${service}-${next_color}"
        else
            echo "Smoke tests failed for $service, rolling back..."
            rollback_deployment $service $next_color $current_color
            exit 1
        fi
    else
        echo "Health checks failed for ${service}-${next_color}, rolling back..."
        rollback_deployment $service $next_color $current_color
        exit 1
    fi
    
    # Clean up temporary files
    rm -f /tmp/${service}-${next_color}-deployment.yaml
done

echo "Blue-green deployment completed successfully!"

# Generate deployment summary
cat > /tmp/blue-green-deployment-summary.json << EOF
{
    "deployment_type": "blue-green",
    "environment": "$ENVIRONMENT",
    "image_tag": "$IMAGE_TAG",
    "timestamp": "$(date -Iseconds)",
    "services": [
EOF

for i in "${!SERVICES[@]}"; do
    service=${SERVICES[$i]}
    current_color=$(get_current_color $service)
    
    echo "        {" >> /tmp/blue-green-deployment-summary.json
    echo "            \"service\": \"$service\"," >> /tmp/blue-green-deployment-summary.json
    echo "            \"active_color\": \"$current_color\"," >> /tmp/blue-green-deployment-summary.json
    echo "            \"status\": \"deployed\"" >> /tmp/blue-green-deployment-summary.json
    
    if [ $i -eq $((${#SERVICES[@]} - 1)) ]; then
        echo "        }" >> /tmp/blue-green-deployment-summary.json
    else
        echo "        }," >> /tmp/blue-green-deployment-summary.json
    fi
done

cat >> /tmp/blue-green-deployment-summary.json << EOF
    ],
    "status": "success"
}
EOF

echo "Deployment summary saved to /tmp/blue-green-deployment-summary.json"
cat /tmp/blue-green-deployment-summary.json