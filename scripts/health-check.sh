#!/bin/bash

# Health Check Script
# This script checks the health of all Find Dining services

echo "🔍 Checking Find Dining Services Health..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check service health
check_service() {
    local service_name=$1
    local port=$2
    local endpoint=${3:-/health}
    
    echo -n "Checking ${service_name}... "
    
    if curl -s -f "http://localhost:${port}${endpoint}" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ Unhealthy${NC}"
        return 1
    fi
}

# Check all services
echo -e "${BLUE}🏥 Service Health Check${NC}"
echo "================================"

healthy_count=0
total_count=7

check_service "API Gateway" 3000 && ((healthy_count++))
check_service "User Service" 3001 && ((healthy_count++))
check_service "Restaurant Service" 3002 && ((healthy_count++))
check_service "Recommendation Engine" 3003 && ((healthy_count++))
check_service "Review Service" 3004 && ((healthy_count++))
check_service "Emotion Service" 3005 && ((healthy_count++))
check_service "Data Integration Service" 3006 && ((healthy_count++))

echo "================================"

if [ $healthy_count -eq $total_count ]; then
    echo -e "${GREEN}🎉 All services are healthy! (${healthy_count}/${total_count})${NC}"
    exit 0
elif [ $healthy_count -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Some services are unhealthy (${healthy_count}/${total_count})${NC}"
    exit 1
else
    echo -e "${RED}💥 All services are down!${NC}"
    exit 2
fi