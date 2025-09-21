#!/bin/bash

# Stop Development Environment Script
# This script stops all services and cleans up containers

set -e

echo "🛑 Stopping Find Dining Development Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Stop and remove containers
echo -e "${BLUE}🐳 Stopping Docker containers...${NC}"
docker-compose down

# Optional: Remove volumes (uncomment if you want to reset data)
# echo -e "${YELLOW}🗑️  Removing volumes...${NC}"
# docker-compose down -v

# Optional: Remove images (uncomment if you want to rebuild from scratch)
# echo -e "${YELLOW}🗑️  Removing images...${NC}"
# docker-compose down --rmi all

echo -e "${GREEN}✅ All services stopped successfully!${NC}"

# Show remaining containers (if any)
remaining_containers=$(docker ps -q --filter "name=find-dining")
if [ ! -z "$remaining_containers" ]; then
    echo -e "${YELLOW}⚠️  Some containers are still running:${NC}"
    docker ps --filter "name=find-dining"
else
    echo -e "${GREEN}🎉 All Find Dining containers have been stopped${NC}"
fi