#!/bin/bash

# Test Deployment Script
# This script tests the complete deployment setup

set -e

echo "🧪 Testing Find Dining Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -e "${BLUE}🔍 Testing: ${test_name}${NC}"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASS: ${test_name}${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAIL: ${test_name}${NC}"
        ((TESTS_FAILED++))
    fi
    echo ""
}

# Test Docker availability
run_test "Docker availability" "docker --version > /dev/null 2>&1"
run_test "Docker Compose availability" "docker-compose --version > /dev/null 2>&1"

# Test environment setup
run_test "Environment file exists" "[ -f .env ]"
run_test "Docker Compose file exists" "[ -f docker-compose.yml ]"

# Test Docker images can be built
echo -e "${YELLOW}🏗️  Testing Docker builds...${NC}"
run_test "API Gateway Docker build" "cd api-gateway && docker build -t test-api-gateway . > /dev/null 2>&1 && cd .."
run_test "User Service Docker build" "cd user-service && docker build -t test-user-service . > /dev/null 2>&1 && cd .."

# Clean up test images
docker rmi test-api-gateway test-user-service > /dev/null 2>&1 || true

# Test service startup (if not already running)
if ! docker-compose ps | grep -q "Up"; then
    echo -e "${YELLOW}🚀 Starting services for testing...${NC}"
    docker-compose up -d
    sleep 30
    STARTED_SERVICES=true
else
    echo -e "${BLUE}ℹ️  Services already running${NC}"
    STARTED_SERVICES=false
fi

# Test service health endpoints
run_test "API Gateway health" "curl -s -f http://localhost:3000/health > /dev/null"
run_test "User Service health" "curl -s -f http://localhost:3001/health > /dev/null"
run_test "Restaurant Service health" "curl -s -f http://localhost:3002/health > /dev/null"
run_test "Recommendation Engine health" "curl -s -f http://localhost:3003/health > /dev/null"
run_test "Review Service health" "curl -s -f http://localhost:3004/health > /dev/null"
run_test "Emotion Service health" "curl -s -f http://localhost:3005/health > /dev/null"
run_test "Data Integration Service health" "curl -s -f http://localhost:3006/health > /dev/null"

# Test database connectivity
run_test "PostgreSQL User DB connectivity" "docker-compose exec -T postgres-user pg_isready -U postgres > /dev/null 2>&1"
run_test "PostgreSQL Restaurant DB connectivity" "docker-compose exec -T postgres-restaurant pg_isready -U postgres > /dev/null 2>&1"
run_test "Redis connectivity" "docker-compose exec -T redis redis-cli ping | grep -q PONG"

# Test API Gateway routing
run_test "API Gateway routing to User Service" "curl -s -f http://localhost:3000/health/user > /dev/null"
run_test "API Gateway routing to Restaurant Service" "curl -s -f http://localhost:3000/health/restaurant > /dev/null"

# Test basic API functionality (if endpoints exist)
run_test "API Gateway root endpoint" "curl -s http://localhost:3000/ | grep -q 'Find Dining' || curl -s -f http://localhost:3000/health > /dev/null"

# Clean up if we started services
if [ "$STARTED_SERVICES" = true ]; then
    echo -e "${YELLOW}🛑 Stopping test services...${NC}"
    docker-compose down > /dev/null 2>&1
fi

# Test results summary
echo "================================"
echo -e "${BLUE}📊 Test Results Summary${NC}"
echo "================================"
echo -e "Tests Passed: ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Tests Failed: ${RED}${TESTS_FAILED}${NC}"
echo -e "Total Tests: $((TESTS_PASSED + TESTS_FAILED))"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All deployment tests passed!${NC}"
    exit 0
else
    echo -e "${RED}💥 Some deployment tests failed!${NC}"
    exit 1
fi