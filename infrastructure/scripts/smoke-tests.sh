#!/bin/bash

# Smoke Tests Script for AI Restaurant Recommendation System
# Usage: ./smoke-tests.sh <environment> [service]

set -e

ENVIRONMENT=$1
SERVICE=$2
NAMESPACE=$ENVIRONMENT

if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 <environment> [service]"
    exit 1
fi

echo "Running smoke tests for environment: $ENVIRONMENT"

# Get API Gateway URL
API_GATEWAY_URL=$(kubectl get service api-gateway -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "localhost")
if [ "$API_GATEWAY_URL" = "localhost" ]; then
    # Fallback to port-forward for testing
    kubectl port-forward service/api-gateway 8080:3000 -n $NAMESPACE &
    PORT_FORWARD_PID=$!
    API_GATEWAY_URL="localhost:8080"
    sleep 5
fi

BASE_URL="http://$API_GATEWAY_URL"

# Function to test HTTP endpoint
test_endpoint() {
    local endpoint=$1
    local expected_status=$2
    local description=$3
    
    echo "Testing: $description"
    echo "Endpoint: $BASE_URL$endpoint"
    
    response=$(curl -s -w "%{http_code}" -o /tmp/response.json "$BASE_URL$endpoint" || echo "000")
    
    if [ "$response" = "$expected_status" ]; then
        echo "✅ PASS: $description (Status: $response)"
        return 0
    else
        echo "❌ FAIL: $description (Expected: $expected_status, Got: $response)"
        if [ -f /tmp/response.json ]; then
            echo "Response body:"
            cat /tmp/response.json
        fi
        return 1
    fi
}

# Function to test service health
test_service_health() {
    local service=$1
    
    echo "Testing health endpoint for $service..."
    
    # Get service URL
    local service_url
    if [ "$service" = "api-gateway" ]; then
        service_url="$BASE_URL"
    else
        # For internal services, use port-forward
        kubectl port-forward service/$service 8081:3000 -n $NAMESPACE &
        local pf_pid=$!
        sleep 3
        service_url="http://localhost:8081"
    fi
    
    # Test health endpoint
    local health_response=$(curl -s -w "%{http_code}" -o /tmp/health.json "$service_url/health" || echo "000")
    
    if [ "$health_response" = "200" ]; then
        echo "✅ Health check passed for $service"
        local health_status=$(cat /tmp/health.json | jq -r '.status' 2>/dev/null || echo "unknown")
        echo "   Status: $health_status"
        
        # Kill port-forward if we started it
        if [ "$service" != "api-gateway" ] && [ -n "$pf_pid" ]; then
            kill $pf_pid 2>/dev/null || true
        fi
        return 0
    else
        echo "❌ Health check failed for $service (Status: $health_response)"
        
        # Kill port-forward if we started it
        if [ "$service" != "api-gateway" ] && [ -n "$pf_pid" ]; then
            kill $pf_pid 2>/dev/null || true
        fi
        return 1
    fi
}

# Function to run comprehensive API tests
run_api_tests() {
    echo "Running comprehensive API smoke tests..."
    
    local failed_tests=0
    
    # Test API Gateway health
    test_endpoint "/health" "200" "API Gateway Health Check" || ((failed_tests++))
    
    # Test user service endpoints
    test_endpoint "/api/users/health" "200" "User Service Health" || ((failed_tests++))
    
    # Test restaurant service endpoints
    test_endpoint "/api/restaurants/health" "200" "Restaurant Service Health" || ((failed_tests++))
    
    # Test recommendation engine endpoints
    test_endpoint "/api/recommendations/health" "200" "Recommendation Engine Health" || ((failed_tests++))
    
    # Test review service endpoints
    test_endpoint "/api/reviews/health" "200" "Review Service Health" || ((failed_tests++))
    
    # Test emotion service endpoints
    test_endpoint "/api/emotion/health" "200" "Emotion Service Health" || ((failed_tests++))
    
    # Test data integration service endpoints
    test_endpoint "/api/data/health" "200" "Data Integration Service Health" || ((failed_tests++))
    
    # Test basic functionality endpoints
    echo "Testing basic functionality..."
    
    # Test restaurant search (should return 401 without auth, but service should be up)
    test_endpoint "/api/restaurants/search?location=Hong Kong" "401" "Restaurant Search Endpoint" || ((failed_tests++))
    
    # Test recommendation generation (should return 401 without auth)
    test_endpoint "/api/recommendations/generate" "401" "Recommendation Generation Endpoint" || ((failed_tests++))
    
    return $failed_tests
}

# Function to run database connectivity tests
run_database_tests() {
    echo "Running database connectivity tests..."
    
    local failed_tests=0
    
    # Test user database connectivity
    echo "Testing user database connectivity..."
    local user_db_test=$(kubectl exec -n $NAMESPACE deployment/user-service -- node -e "
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.USER_DB_URL });
        pool.query('SELECT 1').then(() => {
            console.log('USER_DB_OK');
            process.exit(0);
        }).catch(err => {
            console.log('USER_DB_ERROR:', err.message);
            process.exit(1);
        });
    " 2>/dev/null || echo "USER_DB_ERROR")
    
    if [[ "$user_db_test" == *"USER_DB_OK"* ]]; then
        echo "✅ User database connectivity test passed"
    else
        echo "❌ User database connectivity test failed"
        ((failed_tests++))
    fi
    
    # Test restaurant database connectivity
    echo "Testing restaurant database connectivity..."
    local restaurant_db_test=$(kubectl exec -n $NAMESPACE deployment/restaurant-service -- node -e "
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.RESTAURANT_DB_URL });
        pool.query('SELECT 1').then(() => {
            console.log('RESTAURANT_DB_OK');
            process.exit(0);
        }).catch(err => {
            console.log('RESTAURANT_DB_ERROR:', err.message);
            process.exit(1);
        });
    " 2>/dev/null || echo "RESTAURANT_DB_ERROR")
    
    if [[ "$restaurant_db_test" == *"RESTAURANT_DB_OK"* ]]; then
        echo "✅ Restaurant database connectivity test passed"
    else
        echo "❌ Restaurant database connectivity test failed"
        ((failed_tests++))
    fi
    
    # Test Redis connectivity
    echo "Testing Redis connectivity..."
    local redis_test=$(kubectl exec -n $NAMESPACE deployment/recommendation-engine -- node -e "
        const redis = require('redis');
        const client = redis.createClient({ url: process.env.REDIS_URL });
        client.connect().then(() => {
            return client.ping();
        }).then(() => {
            console.log('REDIS_OK');
            client.disconnect();
            process.exit(0);
        }).catch(err => {
            console.log('REDIS_ERROR:', err.message);
            process.exit(1);
        });
    " 2>/dev/null || echo "REDIS_ERROR")
    
    if [[ "$redis_test" == *"REDIS_OK"* ]]; then
        echo "✅ Redis connectivity test passed"
    else
        echo "❌ Redis connectivity test failed"
        ((failed_tests++))
    fi
    
    return $failed_tests
}

# Function to run performance tests
run_performance_tests() {
    echo "Running basic performance tests..."
    
    local failed_tests=0
    
    # Test API response times
    echo "Testing API response times..."
    
    local start_time=$(date +%s%N)
    curl -s "$BASE_URL/health" > /dev/null
    local end_time=$(date +%s%N)
    local response_time=$(( (end_time - start_time) / 1000000 ))  # Convert to milliseconds
    
    echo "API Gateway response time: ${response_time}ms"
    
    if [ $response_time -lt 5000 ]; then  # Less than 5 seconds
        echo "✅ API response time test passed"
    else
        echo "❌ API response time test failed (${response_time}ms > 5000ms)"
        ((failed_tests++))
    fi
    
    # Test concurrent requests
    echo "Testing concurrent request handling..."
    
    local concurrent_test_result=0
    for i in {1..5}; do
        curl -s "$BASE_URL/health" > /dev/null &
    done
    wait
    
    echo "✅ Concurrent request test completed"
    
    return $failed_tests
}

# Main execution
echo "Starting smoke tests for environment: $ENVIRONMENT"

total_failed=0

# If specific service is provided, test only that service
if [ -n "$SERVICE" ]; then
    echo "Testing specific service: $SERVICE"
    test_service_health $SERVICE || ((total_failed++))
else
    echo "Testing all services..."
    
    # Test individual service health
    services=("api-gateway" "user-service" "restaurant-service" "recommendation-engine" "review-service" "emotion-service" "data-integration-service")
    
    for service in "${services[@]}"; do
        test_service_health $service || ((total_failed++))
    done
    
    # Run comprehensive tests
    run_api_tests || total_failed=$((total_failed + $?))
    run_database_tests || total_failed=$((total_failed + $?))
    run_performance_tests || total_failed=$((total_failed + $?))
fi

# Cleanup
if [ -n "$PORT_FORWARD_PID" ]; then
    kill $PORT_FORWARD_PID 2>/dev/null || true
fi

# Generate test report
cat > /tmp/smoke-test-report.json << EOF
{
    "environment": "$ENVIRONMENT",
    "service": "${SERVICE:-all}",
    "timestamp": "$(date -Iseconds)",
    "total_tests": "$(( total_failed > 0 ? total_failed + 10 : 10 ))",
    "failed_tests": $total_failed,
    "success_rate": "$(( total_failed == 0 ? 100 : (10 - total_failed) * 10 ))%",
    "status": "$([ $total_failed -eq 0 ] && echo "passed" || echo "failed")"
}
EOF

echo ""
echo "Smoke test summary:"
echo "==================="
cat /tmp/smoke-test-report.json

if [ $total_failed -eq 0 ]; then
    echo ""
    echo "🎉 All smoke tests passed!"
    exit 0
else
    echo ""
    echo "💥 $total_failed smoke tests failed!"
    exit 1
fi