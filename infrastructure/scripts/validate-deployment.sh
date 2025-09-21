#!/bin/bash

# Validate Find Dining deployment
# This script validates that all components are deployed and working correctly

set -e

# Configuration
ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-ap-southeast-1}
NAMESPACE="find-dining"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if kubectl is available
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    log_success "kubectl is available and connected to cluster"
}

# Check namespace
check_namespace() {
    log_info "Checking namespace..."
    
    if kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_success "Namespace '$NAMESPACE' exists"
    else
        log_error "Namespace '$NAMESPACE' does not exist"
        return 1
    fi
}

# Check deployments
check_deployments() {
    log_info "Checking deployments..."
    
    local deployments=("api-gateway" "user-service" "restaurant-service" "recommendation-engine" "review-service" "emotion-service" "data-integration-service")
    local failed_deployments=()
    
    for deployment in "${deployments[@]}"; do
        if kubectl get deployment "$deployment" -n "$NAMESPACE" &> /dev/null; then
            local ready=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')
            local desired=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
            
            if [ "$ready" = "$desired" ] && [ "$ready" -gt 0 ]; then
                log_success "✓ $deployment: $ready/$desired replicas ready"
            else
                log_warning "⚠ $deployment: $ready/$desired replicas ready"
                failed_deployments+=("$deployment")
            fi
        else
            log_error "✗ $deployment: deployment not found"
            failed_deployments+=("$deployment")
        fi
    done
    
    if [ ${#failed_deployments[@]} -eq 0 ]; then
        log_success "All deployments are healthy"
        return 0
    else
        log_error "Some deployments have issues: ${failed_deployments[*]}"
        return 1
    fi
}

# Check services
check_services() {
    log_info "Checking services..."
    
    local services=("api-gateway" "user-service" "restaurant-service" "recommendation-engine" "review-service" "emotion-service" "data-integration-service")
    local failed_services=()
    
    for service in "${services[@]}"; do
        if kubectl get service "$service" -n "$NAMESPACE" &> /dev/null; then
            local cluster_ip=$(kubectl get service "$service" -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}')
            if [ "$cluster_ip" != "None" ] && [ -n "$cluster_ip" ]; then
                log_success "✓ $service: ClusterIP $cluster_ip"
            else
                log_warning "⚠ $service: No ClusterIP assigned"
                failed_services+=("$service")
            fi
        else
            log_error "✗ $service: service not found"
            failed_services+=("$service")
        fi
    done
    
    if [ ${#failed_services[@]} -eq 0 ]; then
        log_success "All services are available"
        return 0
    else
        log_error "Some services have issues: ${failed_services[*]}"
        return 1
    fi
}

# Check pods
check_pods() {
    log_info "Checking pods..."
    
    local total_pods=$(kubectl get pods -n "$NAMESPACE" --no-headers | wc -l)
    local running_pods=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Running --no-headers | wc -l)
    local pending_pods=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending --no-headers | wc -l)
    local failed_pods=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Failed --no-headers | wc -l)
    
    log_info "Pod status: $running_pods running, $pending_pods pending, $failed_pods failed (total: $total_pods)"
    
    if [ "$failed_pods" -gt 0 ]; then
        log_error "Some pods are in failed state:"
        kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Failed
        return 1
    fi
    
    if [ "$pending_pods" -gt 0 ]; then
        log_warning "Some pods are still pending:"
        kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Pending
    fi
    
    if [ "$running_pods" -eq "$total_pods" ]; then
        log_success "All pods are running"
        return 0
    else
        return 1
    fi
}

# Check ingress
check_ingress() {
    log_info "Checking ingress..."
    
    if kubectl get ingress find-dining-ingress -n "$NAMESPACE" &> /dev/null; then
        local ingress_address=$(kubectl get ingress find-dining-ingress -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
        
        if [ -n "$ingress_address" ]; then
            log_success "✓ Ingress has address: $ingress_address"
            
            # Test if the ingress is responding
            if curl -s --max-time 10 "http://$ingress_address/health" &> /dev/null; then
                log_success "✓ Ingress is responding to health checks"
            else
                log_warning "⚠ Ingress is not responding to health checks yet"
            fi
        else
            log_warning "⚠ Ingress does not have an address yet"
        fi
    else
        log_error "✗ Ingress not found"
        return 1
    fi
}

# Check secrets and configmaps
check_config() {
    log_info "Checking configuration..."
    
    # Check ConfigMap
    if kubectl get configmap find-dining-config -n "$NAMESPACE" &> /dev/null; then
        log_success "✓ ConfigMap exists"
    else
        log_error "✗ ConfigMap not found"
        return 1
    fi
    
    # Check Secrets
    if kubectl get secret find-dining-secrets -n "$NAMESPACE" &> /dev/null; then
        log_success "✓ Application secrets exist"
    else
        log_error "✗ Application secrets not found"
        return 1
    fi
    
    if kubectl get secret ecr-registry-secret -n "$NAMESPACE" &> /dev/null; then
        log_success "✓ ECR registry secret exists"
    else
        log_warning "⚠ ECR registry secret not found"
    fi
}

# Test health endpoints
test_health_endpoints() {
    log_info "Testing health endpoints..."
    
    local ingress_address=$(kubectl get ingress find-dining-ingress -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
    
    if [ -z "$ingress_address" ]; then
        log_warning "Cannot test health endpoints - ingress address not available"
        return 1
    fi
    
    local endpoints=(
        "/health"
        "/api/users/health"
        "/api/restaurants/health"
        "/api/recommendations/health"
        "/api/reviews/health"
        "/api/emotion/health"
        "/api/data/health"
    )
    
    local failed_endpoints=()
    
    for endpoint in "${endpoints[@]}"; do
        local url="http://$ingress_address$endpoint"
        if curl -s --max-time 10 "$url" &> /dev/null; then
            log_success "✓ $endpoint is responding"
        else
            log_error "✗ $endpoint is not responding"
            failed_endpoints+=("$endpoint")
        fi
    done
    
    if [ ${#failed_endpoints[@]} -eq 0 ]; then
        log_success "All health endpoints are responding"
        return 0
    else
        log_error "Some health endpoints are not responding: ${failed_endpoints[*]}"
        return 1
    fi
}

# Check resource usage
check_resource_usage() {
    log_info "Checking resource usage..."
    
    if kubectl top nodes &> /dev/null; then
        log_info "Node resource usage:"
        kubectl top nodes
        echo
        
        log_info "Pod resource usage:"
        kubectl top pods -n "$NAMESPACE"
        echo
        
        log_success "Resource usage information retrieved"
    else
        log_warning "Cannot retrieve resource usage - metrics server may not be available"
    fi
}

# Show deployment summary
show_summary() {
    log_info "Deployment Summary:"
    echo
    
    log_info "Pods:"
    kubectl get pods -n "$NAMESPACE" -o wide
    echo
    
    log_info "Services:"
    kubectl get services -n "$NAMESPACE"
    echo
    
    log_info "Ingress:"
    kubectl get ingress -n "$NAMESPACE"
    echo
    
    local ingress_address=$(kubectl get ingress find-dining-ingress -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
    if [ -n "$ingress_address" ]; then
        log_info "Application URL: http://$ingress_address"
        log_info "API Documentation: http://$ingress_address/api/docs"
    fi
}

# Main validation function
main() {
    log_info "Starting Find Dining deployment validation..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Namespace: $NAMESPACE"
    echo
    
    local validation_results=()
    
    # Run all validation checks
    check_kubectl || validation_results+=("kubectl")
    check_namespace || validation_results+=("namespace")
    check_config || validation_results+=("config")
    check_deployments || validation_results+=("deployments")
    check_services || validation_results+=("services")
    check_pods || validation_results+=("pods")
    check_ingress || validation_results+=("ingress")
    
    echo
    log_info "Running additional checks..."
    test_health_endpoints || validation_results+=("health-endpoints")
    check_resource_usage
    
    echo
    show_summary
    
    # Report final results
    echo
    if [ ${#validation_results[@]} -eq 0 ]; then
        log_success "🎉 All validation checks passed! Deployment is healthy."
        exit 0
    else
        log_error "❌ Some validation checks failed: ${validation_results[*]}"
        log_info "Check the logs above for details on failed components."
        exit 1
    fi
}

# Show usage information
show_usage() {
    echo "Usage: $0 [ENVIRONMENT] [AWS_REGION]"
    echo
    echo "Arguments:"
    echo "  ENVIRONMENT  Environment to validate (dev, staging, prod). Default: dev"
    echo "  AWS_REGION   AWS region. Default: ap-southeast-1"
    echo
    echo "Examples:"
    echo "  $0           # Validate dev environment"
    echo "  $0 prod      # Validate prod environment"
}

# Handle command line arguments
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_usage
    exit 0
fi

# Run main function
main