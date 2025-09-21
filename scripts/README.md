# Find Dining - Deployment Scripts

This directory contains scripts for building, testing, and deploying the Find Dining application.

## 📁 Script Overview

### Build Scripts
- **`build-all.sh`** / **`build-all.bat`** - Build all microservices
- **`docker-build-all.sh`** - Build all Docker images

### Development Scripts
- **`start-dev.sh`** / **`start-dev.bat`** - Start development environment
- **`stop-dev.sh`** / **`stop-dev.bat`** - Stop development environment

### Testing Scripts
- **`test-all.sh`** / **`test-all.bat`** - Run all service tests
- **`test-deployment.sh`** - Test complete deployment setup
- **`health-check.sh`** / **`health-check.bat`** - Check service health

### Database Scripts
- **`init-user-db.sql`** - Initialize user database schema
- **`init-restaurant-db.sql`** - Initialize restaurant database schema

## 🚀 Quick Start

### Linux/Mac
```bash
# Make scripts executable
chmod +x scripts/*.sh

# Start development environment
./scripts/start-dev.sh

# Check service health
./scripts/health-check.sh

# Run all tests
./scripts/test-all.sh

# Stop environment
./scripts/stop-dev.sh
```

### Windows
```cmd
# Start development environment
scripts\start-dev.bat

# Check service health
scripts\health-check.bat

# Run all tests
scripts\test-all.bat

# Stop environment
scripts\stop-dev.bat
```

## 📋 Script Details

### build-all.sh / build-all.bat
Builds all microservices by:
1. Installing dependencies (if needed)
2. Running TypeScript compilation
3. Validating build success

**Usage:**
```bash
./scripts/build-all.sh
```

### docker-build-all.sh
Builds Docker images for all services:
1. Validates Docker is running
2. Builds each service image
3. Tags images appropriately

**Usage:**
```bash
./scripts/docker-build-all.sh
```

### start-dev.sh / start-dev.bat
Starts the complete development environment:
1. Validates Docker is running
2. Checks for .env file
3. Starts all services with docker-compose
4. Waits for services to be healthy
5. Displays service URLs

**Usage:**
```bash
./scripts/start-dev.sh
```

### health-check.sh / health-check.bat
Checks the health of all running services:
1. Tests each service health endpoint
2. Reports overall system health
3. Returns appropriate exit codes

**Usage:**
```bash
./scripts/health-check.sh
```

**Exit Codes:**
- `0` - All services healthy
- `1` - Some services unhealthy
- `2` - All services down

### test-all.sh / test-all.bat
Runs unit tests for all services:
1. Installs dependencies if needed
2. Runs Jest tests for each service
3. Reports test results

**Usage:**
```bash
./scripts/test-all.sh
```

### test-deployment.sh
Comprehensive deployment testing:
1. Tests Docker availability
2. Tests Docker builds
3. Tests service startup
4. Tests health endpoints
5. Tests database connectivity
6. Tests API Gateway routing

**Usage:**
```bash
./scripts/test-deployment.sh
```

## 🗄️ Database Scripts

### init-user-db.sql
Initializes the user database with:
- Users table with preferences and history
- User preferences normalized table
- Dining history table
- Indexes for performance
- Sample data for development

### init-restaurant-db.sql
Initializes the restaurant database with:
- Restaurants table with comprehensive metadata
- Reviews table with sentiment analysis
- Menu items table
- Data sync logs table
- Indexes for performance
- Sample data for development

## 🔧 Environment Setup

Before running scripts, ensure you have:

1. **Environment file**: Copy `.env.example` to `.env` and configure
2. **Docker**: Docker Desktop or Docker Engine running
3. **Node.js**: Version 18+ for local development
4. **Permissions**: Execute permissions on shell scripts (Linux/Mac)

## 🐛 Troubleshooting

### Common Issues

1. **Permission Denied (Linux/Mac)**
   ```bash
   chmod +x scripts/*.sh
   ```

2. **Docker Not Running**
   ```bash
   # Start Docker Desktop or Docker service
   sudo systemctl start docker  # Linux
   ```

3. **Port Conflicts**
   ```bash
   # Check what's using ports
   netstat -an | grep :3000
   
   # Stop conflicting services
   docker-compose down
   ```

4. **Environment Variables**
   ```bash
   # Ensure .env file exists and is configured
   cp .env.example .env
   # Edit .env with your values
   ```

### Script Debugging

Enable debug mode for shell scripts:
```bash
# Run with debug output
bash -x ./scripts/start-dev.sh
```

View detailed Docker logs:
```bash
# View all service logs
docker-compose logs -f

# View specific service
docker-compose logs -f api-gateway
```

## 📊 Monitoring

### Health Monitoring
```bash
# Continuous health monitoring
watch -n 5 './scripts/health-check.sh'

# Check specific service
curl http://localhost:3000/health/user
```

### Log Monitoring
```bash
# Follow all logs
docker-compose logs -f

# Follow specific service
docker-compose logs -f data-integration-service

# View last 100 lines
docker-compose logs --tail=100
```

## 🔄 Development Workflow

1. **Start Environment**
   ```bash
   ./scripts/start-dev.sh
   ```

2. **Make Code Changes**
   - Edit source code in your IDE
   - Changes are reflected immediately for development

3. **Test Changes**
   ```bash
   # Run specific service tests
   cd user-service && npm test
   
   # Run all tests
   ./scripts/test-all.sh
   ```

4. **Rebuild if Needed**
   ```bash
   # Rebuild specific service
   docker-compose build user-service
   docker-compose up -d user-service
   ```

5. **Check Health**
   ```bash
   ./scripts/health-check.sh
   ```

## 🚀 Production Deployment

For production deployment:

1. **Build Production Images**
   ```bash
   ./scripts/docker-build-all.sh
   ```

2. **Test Deployment**
   ```bash
   ./scripts/test-deployment.sh
   ```

3. **Deploy to Production**
   - Use production docker-compose file
   - Configure production environment variables
   - Set up monitoring and logging
   - Configure SSL/TLS certificates

## 📝 Adding New Scripts

When adding new scripts:

1. **Follow naming convention**: `action-target.sh` / `action-target.bat`
2. **Add error handling**: Use `set -e` for bash scripts
3. **Add colored output**: Use color variables for better UX
4. **Add help text**: Include usage instructions
5. **Update this README**: Document the new script

Example script template:
```bash
#!/bin/bash
set -e

# Script Description
# This script does something useful

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting script...${NC}"

# Script logic here

echo -e "${GREEN}✅ Script completed successfully!${NC}"
```