#!/bin/bash

# Test All Services Script
# This script runs tests for all microservices

set -e

echo "🧪 Running Tests for Find Dining Microservices..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test a service
test_service() {
    local service_name=$1
    local service_path=$2
    
    echo -e "${YELLOW}Testing ${service_name}...${NC}"
    
    if [ -d "$service_path" ]; then
        cd "$service_path"
        
        # Install dependencies if node_modules doesn't exist
        if [ ! -d "node_modules" ]; then
            echo "Installing dependencies for ${service_name}..."
            npm ci
        fi
        
        # Run tests
        npm test
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ ${service_name} tests passed${NC}"
        else
            echo -e "${RED}❌ ${service_name} tests failed${NC}"
            exit 1
        fi
        
        cd - > /dev/null
    else
        echo -e "${RED}❌ Directory ${service_path} not found${NC}"
        exit 1
    fi
}

# Test shared library first
echo -e "${YELLOW}Testing shared library...${NC}"
if [ -d "shared" ]; then
    cd shared
    if [ -f "package.json" ] && grep -q '"test"' package.json; then
        npm ci
        npm test
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Shared library tests passed${NC}"
        else
            echo -e "${RED}❌ Shared library tests failed${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠️  No tests found for shared library${NC}"
    fi
    cd - > /dev/null
fi

# Test all services
test_service "API Gateway" "api-gateway"
test_service "User Service" "user-service"
test_service "Restaurant Service" "restaurant-service"
test_service "Recommendation Engine" "recommendation-engine"
test_service "Review Service" "review-service"
test_service "Emotion Service" "emotion-service"
test_service "Data Integration Service" "data-integration-service"

# Test mobile app if it exists
if [ -d "mobile-app" ]; then
    test_service "Mobile App" "mobile-app"
fi

echo -e "${GREEN}🎉 All tests passed successfully!${NC}"