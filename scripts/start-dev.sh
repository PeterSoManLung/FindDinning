#!/bin/bash

# Start Development Environment Script
# This script starts all services in development mode

set -e

echo "🚀 Starting Find Dining Development Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Copying from .env.example...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}📝 Please update .env file with your configuration before running again.${NC}"
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Start services with Docker Compose
echo -e "${BLUE}🐳 Starting services with Docker Compose...${NC}"
docker-compose up -d

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 10

# Check service health
check_service_health() {
    local service_name=$1
    local port=$2
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "http://localhost:${port}/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ ${service_name} is healthy${NC}"
            return 0
        fi
        
        echo -e "${YELLOW}⏳ Waiting for ${service_name} (attempt ${attempt}/${max_attempts})...${NC}"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ ${service_name} failed to start${NC}"
    return 1
}

# Check all services
echo -e "${BLUE}🔍 Checking service health...${NC}"
check_service_health "API Gateway" 3000
check_service_health "User Service" 3001
check_service_health "Restaurant Service" 3002
check_service_health "Recommendation Engine" 3003
check_service_health "Review Service" 3004
check_service_health "Emotion Service" 3005
check_service_health "Data Integration Service" 3006

echo -e "${GREEN}🎉 All services are running!${NC}"
echo ""
echo -e "${BLUE}📋 Service URLs:${NC}"
echo "  🌐 API Gateway:              http://localhost:3000"
echo "  👤 User Service:             http://localhost:3001"
echo "  🏪 Restaurant Service:       http://localhost:3002"
echo "  🤖 Recommendation Engine:    http://localhost:3003"
echo "  ⭐ Review Service:           http://localhost:3004"
echo "  😊 Emotion Service:          http://localhost:3005"
echo "  🔄 Data Integration Service: http://localhost:3006"
echo ""
echo -e "${BLUE}📊 Infrastructure:${NC}"
echo "  🐘 PostgreSQL (User DB):     localhost:5432"
echo "  🐘 PostgreSQL (Restaurant):  localhost:5433"
echo "  🔴 Redis:                    localhost:6379"
echo ""
echo -e "${YELLOW}💡 Use 'docker-compose logs -f [service-name]' to view logs${NC}"
echo -e "${YELLOW}💡 Use 'docker-compose down' to stop all services${NC}"