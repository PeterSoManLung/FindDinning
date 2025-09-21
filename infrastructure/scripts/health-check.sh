#!/bin/bash

# Comprehensive Health Check Script for AI Restaurant Recommendation System
# Usage: ./health-check.sh <environment> [service]

set -e

ENVIRONMENT=$1
SERVICE=$2
NAMESPACE=$ENVIRONMENT

if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 <environment> [service]"
    exit 1
fi

echo "Running health checks for environment: $ENVIRONMENT"

# Define services
ALL_SERVICES=("api-gateway" "user-service" "restaurant-service" "recommendation-engine" "review-service" "emotion-service" "data-integration-service")

# Function to check pod status
check_pod_status() {
    local service=$1
    
    echo "Checking pod status for $service..."
    
    # Get pod information
    local pods=$(kubectl get pods -n $NAMESPACE -l app=$service -o json)
    local pod_count=$(echo "$pods" | jq '.items | length')
    
    if [ "$pod_count" -eq 0 ]; then
        echo "❌ No pods found for $service"
        return 1
    fi
    
    local ready_pods=0
    local total_pods=$pod_count
    
    for ((i=0; i<pod_count; i++)); do
        local pod_name=$(echo "$pods" | jq -r ".items[$i].metadata.name")
        local pod_phase=$(echo "$pods" | jq -r ".items[$i].status.phase")
        local ready_condition=$(echo "$pods" | jq -r ".items[$i].status.conditions[] | select(.type==\"Ready\") | .status")
        
        echo "  Pod: $pod_name - Phase: $pod_phase - Ready: $ready_condition"
        
        if [ "$pod_phase" = "Running" ] && [ "$ready_condition" = "True" ]; then
            ((ready_pods++))
        fi
    done
    
    echo "  Ready pods: $ready_pods/$total_pods"
    
    if [ $ready_pods -eq $total_pods ]; then
        echo "✅ All pods are ready for $service"
        return 0
    else
        echo "❌ Not all pods are ready for $service"
        return 1
    fi
}

# Function to check deployment status
check_deployment_status() {
    local service=$1
    
    echo "Checking deployment status for $service..."
    
    # Check if deployment exists
    if ! kubectl get deployment $service -n $NAMESPACE >/dev/null 2>&1; then
        echo "❌ Deployment $service not found"
        return 1
    fi
    
    # Get deployment status
    local deployment_status=$(kubectl get deployment $service -n $NAMESPACE -o json)
    local desired_replicas=$(echo "$deployment_status" | jq -r '.spec.replicas')
    local ready_replicas=$(echo "$deployment_status" | jq -r '.status.readyReplicas // 0')
    local available_replicas=$(echo "$deployment_status" | jq -r '.status.availableReplicas // 0')
    local updated_replicas=$(echo "$deployment_status" | jq -r '.status.updatedReplicas // 0')
    
    echo "  Desired: $desired_replicas, Ready: $ready_replicas, Available: $available_replicas, Updated: $updated_replicas"
    
    # Check deployment conditions
    local conditions=$(echo "$deployment_status" | jq -r '.status.conditions[]')
    local progressing=$(echo "$deployment_status" | jq -r '.status.conditions[] | select(.type=="Progressing") | .status')
    local available=$(echo "$deployment_status" | jq -r '.status.conditions[] | select(.type=="Available") | .status')
    
    echo "  Progressing: $progressing, Available: $available"
    
    if [ "$ready_replicas" = "$desired_replicas" ] && [ "$available" = "True" ]; then
        echo "✅ Deployment $service is healthy"
        return 0
    else
        echo "❌ Deployment $service is not healthy"
        return 1
    fi
}

# Function to check service endpoints
check_service_endpoints() {
    local service=$1
    
    echo "Checking service endpoints for $service..."
    
    # Check if service exists
    if ! kubectl get service $service -n $NAMESPACE >/dev/null 2>&1; then
        echo "❌ Service $service not found"
        return 1
    fi
    
    # Get service information
    local service_info=$(kubectl get service $service -n $NAMESPACE -o json)
    local service_type=$(echo "$service_info" | jq -r '.spec.type')
    local cluster_ip=$(echo "$service_info" | jq -r '.spec.clusterIP')
    local ports=$(echo "$service_info" | jq -r '.spec.ports[].port')
    
    echo "  Type: $service_type, ClusterIP: $cluster_ip, Ports: $ports"
    
    # Check endpoints
    local endpoints=$(kubectl get endpoints $service -n $NAMESPACE -o json 2>/dev/null || echo '{"subsets":[]}')
    local endpoint_count=$(echo "$endpoints" | jq '.subsets | length')
    
    if [ "$endpoint_count" -gt 0 ]; then
        local addresses=$(echo "$endpoints" | jq -r '.subsets[0].addresses | length')
        echo "  Endpoints: $addresses addresses available"
        
        if [ "$addresses" -gt 0 ]; then
            echo "✅ Service $service has healthy endpoints"
            return 0
        fi
    fi
    
    echo "❌ Service $service has no healthy endpoints"
    return 1
}

# Function to check application health endpoint
check_application_health() {
    local service=$1
    
    echo "Checking application health endpoint for $service..."
    
    # Get a pod to test the health endpoint
    local pod_name=$(kubectl get pods -n $NAMESPACE -l app=$service -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    
    if [ -z "$pod_name" ]; then
        echo "❌ No pods available for $service to test health endpoint"
        return 1
    fi
    
    # Test health endpoint
    local health_response=$(kubectl exec $pod_name -n $NAMESPACE -- curl -s -w "%{http_code}" -o /tmp/health.json http://localhost:3000/health 2>/dev/null || echo "000")
    
    if [ "$health_response" = "200" ]; then
        local health_data=$(kubectl exec $pod_name -n $NAMESPACE -- cat /tmp/health.json 2>/dev/null || echo '{}')
        local status=$(echo "$health_data" | jq -r '.status // "unknown"')
        local uptime=$(echo "$health_data" | jq -r '.uptime // "unknown"')
        
        echo "  Status: $status, Uptime: $uptime"
        echo "✅ Application health endpoint is responding for $service"
        return 0
    else
        echo "❌ Application health endpoint is not responding for $service (HTTP: $health_response)"
        return 1
    fi
}

# Function to check resource usage
check_resource_usage() {
    local service=$1
    
    echo "Checking resource usage for $service..."
    
    # Get pod metrics (requires metrics-server)
    local pod_metrics=$(kubectl top pods -n $NAMESPACE -l app=$service --no-headers 2>/dev/null || echo "")
    
    if [ -n "$pod_metrics" ]; then
        echo "  Resource usage:"
        echo "$pod_metrics" | while read -r line; do
            echo "    $line"
        done
        
        # Check if any pod is using excessive resources
        local high_cpu_pods=$(echo "$pod_metrics" | awk '$2 ~ /[0-9]+m/ && $2+0 > 800 {print $1}')
        local high_memory_pods=$(echo "$pod_metrics" | awk '$3 ~ /[0-9]+Mi/ && $3+0 > 400 {print $1}')
        
        if [ -n "$high_cpu_pods" ]; then
            echo "⚠️  High CPU usage detected in pods: $high_cpu_pods"
        fi
        
        if [ -n "$high_memory_pods" ]; then
            echo "⚠️  High memory usage detected in pods: $high_memory_pods"
        fi
        
        echo "✅ Resource usage check completed for $service"
    else
        echo "⚠️  Unable to get resource metrics for $service (metrics-server may not be available)"
    fi
    
    return 0
}

# Function to check logs for errors
check_recent_logs() {
    local service=$1
    
    echo "Checking recent logs for errors in $service..."
    
    local pod_name=$(kubectl get pods -n $NAMESPACE -l app=$service -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    
    if [ -z "$pod_name" ]; then
        echo "❌ No pods available for $service to check logs"
        return 1
    fi
    
    # Get recent logs and check for errors
    local recent_logs=$(kubectl logs $pod_name -n $NAMESPACE --tail=100 --since=5m 2>/dev/null || echo "")
    
    if [ -n "$recent_logs" ]; then
        local error_count=$(echo "$recent_logs" | grep -i "error\|exception\|fatal" | wc -l)
        local warning_count=$(echo "$recent_logs" | grep -i "warn" | wc -l)
        
        echo "  Recent log analysis (last 5 minutes):"
        echo "    Errors: $error_count"
        echo "    Warnings: $warning_count"
        
        if [ "$error_count" -gt 0 ]; then
            echo "  Recent errors:"
            echo "$recent_logs" | grep -i "error\|exception\|fatal" | tail -3 | sed 's/^/    /'
        fi
        
        if [ "$error_count" -gt 10 ]; then
            echo "❌ High error rate detected in $service logs"
            return 1
        elif [ "$error_count" -gt 0 ]; then
            echo "⚠️  Some errors detected in $service logs"
        else
            echo "✅ No recent errors in $service logs"
        fi
    else
        echo "⚠️  Unable to retrieve recent logs for $service"
    fi
    
    return 0
}

# Function to run comprehensive health check for a service
run_service_health_check() {
    local service=$1
    local failed_checks=0
    
    echo ""
    echo "🔍 Running comprehensive health check for $service"
    echo "=================================================="
    
    check_deployment_status $service || ((failed_checks++))
    check_pod_status $service || ((failed_checks++))
    check_service_endpoints $service || ((failed_checks++))
    check_application_health $service || ((failed_checks++))
    check_resource_usage $service
    check_recent_logs $service || ((failed_checks++))
    
    echo ""
    if [ $failed_checks -eq 0 ]; then
        echo "✅ All health checks passed for $service"
    else
        echo "❌ $failed_checks health checks failed for $service"
    fi
    
    return $failed_checks
}

# Function to check cluster-level health
check_cluster_health() {
    echo ""
    echo "🔍 Checking cluster-level health"
    echo "================================"
    
    local failed_checks=0
    
    # Check node status
    echo "Checking node status..."
    local nodes=$(kubectl get nodes --no-headers)
    local ready_nodes=$(echo "$nodes" | grep " Ready " | wc -l)
    local total_nodes=$(echo "$nodes" | wc -l)
    
    echo "  Ready nodes: $ready_nodes/$total_nodes"
    
    if [ $ready_nodes -eq $total_nodes ]; then
        echo "✅ All nodes are ready"
    else
        echo "❌ Not all nodes are ready"
        ((failed_checks++))
    fi
    
    # Check namespace status
    echo "Checking namespace $NAMESPACE..."
    if kubectl get namespace $NAMESPACE >/dev/null 2>&1; then
        echo "✅ Namespace $NAMESPACE exists"
    else
        echo "❌ Namespace $NAMESPACE does not exist"
        ((failed_checks++))
    fi
    
    # Check persistent volumes if any
    echo "Checking persistent volumes..."
    local pv_count=$(kubectl get pv --no-headers 2>/dev/null | wc -l)
    if [ $pv_count -gt 0 ]; then
        local bound_pv=$(kubectl get pv --no-headers | grep "Bound" | wc -l)
        echo "  Persistent volumes: $bound_pv/$pv_count bound"
        
        if [ $bound_pv -lt $pv_count ]; then
            echo "⚠️  Some persistent volumes are not bound"
        fi
    else
        echo "  No persistent volumes found"
    fi
    
    return $failed_checks
}

# Function to generate health report
generate_health_report() {
    local services_array=("$@")
    local total_services=${#services_array[@]}
    local healthy_services=0
    
    # Count healthy services
    for service in "${services_array[@]}"; do
        if run_service_health_check $service >/dev/null 2>&1; then
            ((healthy_services++))
        fi
    done
    
    cat > /tmp/health-check-report.json << EOF
{
    "environment": "$ENVIRONMENT",
    "timestamp": "$(date -Iseconds)",
    "cluster_health": "$(check_cluster_health >/dev/null 2>&1 && echo "healthy" || echo "unhealthy")",
    "total_services": $total_services,
    "healthy_services": $healthy_services,
    "health_percentage": $(( healthy_services * 100 / total_services )),
    "services": [
EOF

    for i in "${!services_array[@]}"; do
        local service=${services_array[$i]}
        local service_health="unhealthy"
        
        if run_service_health_check $service >/dev/null 2>&1; then
            service_health="healthy"
        fi
        
        echo "        {" >> /tmp/health-check-report.json
        echo "            \"service\": \"$service\"," >> /tmp/health-check-report.json
        echo "            \"status\": \"$service_health\"" >> /tmp/health-check-report.json
        
        if [ $i -eq $((${#services_array[@]} - 1)) ]; then
            echo "        }" >> /tmp/health-check-report.json
        else
            echo "        }," >> /tmp/health-check-report.json
        fi
    done

    cat >> /tmp/health-check-report.json << EOF
    ],
    "overall_status": "$([ $healthy_services -eq $total_services ] && echo "healthy" || echo "degraded")"
}
EOF
}

# Main execution
echo "Starting comprehensive health check for environment: $ENVIRONMENT"

total_failed=0

# Check cluster health first
check_cluster_health || total_failed=$((total_failed + $?))

# Determine which services to check
if [ -n "$SERVICE" ]; then
    # Check specific service
    if [[ " ${ALL_SERVICES[@]} " =~ " ${SERVICE} " ]]; then
        SERVICES_TO_CHECK=("$SERVICE")
    else
        echo "Error: Invalid service name '$SERVICE'"
        echo "Available services: ${ALL_SERVICES[*]}"
        exit 1
    fi
else
    # Check all services
    SERVICES_TO_CHECK=("${ALL_SERVICES[@]}")
fi

# Run health checks for each service
for service in "${SERVICES_TO_CHECK[@]}"; do
    run_service_health_check $service || total_failed=$((total_failed + $?))
done

# Generate health report
generate_health_report "${SERVICES_TO_CHECK[@]}"

echo ""
echo "Health Check Summary:"
echo "===================="
cat /tmp/health-check-report.json

if [ $total_failed -eq 0 ]; then
    echo ""
    echo "🎉 All health checks passed!"
    exit 0
else
    echo ""
    echo "💥 $total_failed health checks failed!"
    exit 1
fi