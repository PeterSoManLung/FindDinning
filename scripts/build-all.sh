#!/bin/bash

# Build All Services Script
# This script builds all microservices for the Find Dining application

set -e

echo "🏗️  Building Find Dining Microservices..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to build a service
build_service() {
    local service_name=$1
    local service_path=$2
    
    echo -e "${YELLOW}Building ${service_name}...${NC}"
    
    if [ -d "$service_path" ]; then
        cd "$service_path"
        
        # Install dependencies if node_modules doesn't exist
        if [ ! -d "node_modules" ]; then
            echo "Installing dependencies for ${service_name}..."
            npm ci
        fi
        
        # Build the service
        npm run build
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ ${service_name} built successfully${NC}"
        else
            echo -e "${RED}❌ Failed to build ${service_name}${NC}"
            exit 1
        fi
        
        cd - > /dev/null
    else
        echo -e "${RED}❌ Directory ${service_path} not found${NC}"
        exit 1
    fi
}

# Build shared library first
echo -e "${YELLOW}Building shared library...${NC}"
if [ -d "shared" ]; then
    cd shared
    npm ci
    npm run build
    cd - > /dev/null
    echo -e "${GREEN}✅ Shared library built successfully${NC}"
fi

# Build all services
build_service "API Gateway" "api-gateway"
build_service "User Service" "user-service"
build_service "Restaurant Service" "restaurant-service"
build_service "Recommendation Engine" "recommendation-engine"
build_service "Review Service" "review-service"
build_service "Emotion Service" "emotion-service"
build_service "Data Integration Service" "data-integration-service"

echo -e "${GREEN}🎉 All services built successfully!${NC}"