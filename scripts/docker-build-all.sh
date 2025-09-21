#!/bin/bash

# Docker Build All Services Script
# This script builds Docker images for all microservices

set -e

echo "🐳 Building Docker Images for Find Dining Microservices..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to build Docker image for a service
build_docker_image() {
    local service_name=$1
    local service_path=$2
    local image_tag="find-dining-${service_name,,}"
    
    echo -e "${YELLOW}Building Docker image for ${service_name}...${NC}"
    
    if [ -d "$service_path" ]; then
        cd "$service_path"
        
        # Build Docker image
        docker build -t "$image_tag:latest" .
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ ${service_name} Docker image built successfully${NC}"
        else
            echo -e "${RED}❌ Failed to build Docker image for ${service_name}${NC}"
            exit 1
        fi
        
        cd - > /dev/null
    else
        echo -e "${RED}❌ Directory ${service_path} not found${NC}"
        exit 1
    fi
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Build Docker images for all services
build_docker_image "api-gateway" "api-gateway"
build_docker_image "user-service" "user-service"
build_docker_image "restaurant-service" "restaurant-service"
build_docker_image "recommendation-engine" "recommendation-engine"
build_docker_image "review-service" "review-service"
build_docker_image "emotion-service" "emotion-service"
build_docker_image "data-integration-service" "data-integration-service"

echo -e "${GREEN}🎉 All Docker images built successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Built Images:${NC}"
docker images | grep "find-dining-" | head -7

echo ""
echo -e "${YELLOW}💡 Use 'docker-compose up' to start all services${NC}"
echo -e "${YELLOW}💡 Use 'docker images' to see all built images${NC}"