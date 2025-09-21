# Find Dining - Deployment Guide

This guide covers the deployment and infrastructure setup for the Find Dining (搵食) restaurant recommendation application.

## 🏗️ Architecture Overview

The application follows a microservices architecture with the following components:

- **API Gateway** (Port 3000) - Routes requests and handles cross-cutting concerns
- **User Service** (Port 3001) - User authentication and profile management
- **Restaurant Service** (Port 3002) - Restaurant data and metadata management
- **Recommendation Engine** (Port 3003) - AI-powered recommendation generation
- **Review Service** (Port 3004) - Review management with negative feedback analysis
- **Emotion Service** (Port 3005) - Emotion analysis and mood-based recommendations
- **Data Integration Service** (Port 3006) - External data source integration

## 🐳 Docker Setup

### Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- Docker Compose v2.0+
- Node.js 18+ (for local development)
- Git

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd find-dining
   ```

2. **Set up environment variables**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Edit .env file with your configuration
   # Update database passwords, API keys, etc.
   ```

3. **Start the development environment**
   ```bash
   # On Linux/Mac
   ./scripts/start-dev.sh
   
   # On Windows
   scripts\start-dev.bat
   ```

4. **Verify services are running**
   - API Gateway: http://localhost:3000/health
   - All services: Check individual health endpoints

### Manual Docker Commands

```bash
# Build all Docker images
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes (reset data)
docker-compose down -v
```

## 🔧 Environment Configuration

### Main Environment Variables (.env)

```bash
# Application Environment
NODE_ENV=development

# Database Configuration
USER_DB_NAME=user_db
USER_DB_USER=postgres
USER_DB_PASSWORD=your-secure-password
RESTAURANT_DB_NAME=restaurant_db
RESTAURANT_DB_USER=postgres
RESTAURANT_DB_PASSWORD=your-secure-password

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# External API Keys
DATA_GOV_HK_API_KEY=your-api-key
OPENRICE_API_KEY=your-api-key
TRIPADVISOR_API_KEY=your-api-key
# ... other API keys
```

### Service-Specific Configuration

Each service has its own `.env.example` file with service-specific variables:

- `api-gateway/.env.example` - Gateway configuration
- `user-service/.env.example` - User service configuration
- `restaurant-service/.env.example` - Restaurant service configuration
- And so on...

## 🗄️ Database Setup

### PostgreSQL Databases

The application uses two PostgreSQL databases:

1. **User Database** (Port 5432)
   - User accounts, preferences, dining history
   - Initialized with `scripts/init-user-db.sql`

2. **Restaurant Database** (Port 5433)
   - Restaurant data, reviews, menu items
   - Initialized with `scripts/init-restaurant-db.sql`

### Redis Cache

- **Redis** (Port 6379)
  - Caching layer for recommendations and restaurant data
  - Session storage and temporary data

### Database Initialization

Database schemas are automatically created when containers start using the initialization scripts in the `scripts/` directory.

## 🚀 Deployment Scripts

### Build Scripts

```bash
# Build all services (Linux/Mac)
./scripts/build-all.sh

# Build all services (Windows)
scripts\build-all.bat

# Build Docker images
./scripts/docker-build-all.sh
```

### Development Scripts

```bash
# Start development environment
./scripts/start-dev.sh    # Linux/Mac
scripts\start-dev.bat     # Windows

# Stop development environment
./scripts/stop-dev.sh     # Linux/Mac
scripts\stop-dev.bat      # Windows

# Run all tests
./scripts/test-all.sh     # Linux/Mac
scripts\test-all.bat      # Windows
```

## 🔍 Health Checks

All services include health check endpoints:

- **API Gateway**: `GET /health` - Aggregated health of all services
- **Individual Services**: `GET /health` - Service-specific health
- **Service via Gateway**: `GET /health/{service-name}` - Check specific service through gateway

### Health Check Response Format

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "service": "api-gateway",
    "version": "1.0.0",
    "dependencies": [
      {
        "name": "User Service",
        "status": "healthy",
        "lastChecked": "2024-01-01T00:00:00.000Z"
      }
    ],
    "uptime": 3600
  }
}
```

## 📊 Monitoring and Logging

### Docker Compose Logs

```bash
# View all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api-gateway
docker-compose logs -f user-service

# View last 100 lines
docker-compose logs --tail=100 -f
```

### Log Locations

- **Container Logs**: Available via `docker-compose logs`
- **Data Integration Logs**: Mounted volume at `./logs`
- **Application Logs**: Stdout/stderr captured by Docker

## 🔒 Security Considerations

### Development Environment

- Default passwords are used - **CHANGE THESE IN PRODUCTION**
- Services are exposed on localhost only
- CORS is configured for local development

### Production Checklist

- [ ] Change all default passwords
- [ ] Use environment-specific secrets management
- [ ] Configure proper CORS origins
- [ ] Set up SSL/TLS certificates
- [ ] Configure firewall rules
- [ ] Set up monitoring and alerting
- [ ] Configure backup strategies

## 🐛 Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Check if ports are in use
   netstat -an | grep :3000
   
   # Stop conflicting services
   docker-compose down
   ```

2. **Database Connection Issues**
   ```bash
   # Check database containers
   docker-compose ps
   
   # View database logs
   docker-compose logs postgres-user
   docker-compose logs postgres-restaurant
   ```

3. **Service Not Starting**
   ```bash
   # Check service logs
   docker-compose logs [service-name]
   
   # Rebuild specific service
   docker-compose build [service-name]
   docker-compose up -d [service-name]
   ```

4. **Health Check Failures**
   ```bash
   # Test health endpoint directly
   curl http://localhost:3000/health
   
   # Check individual service
   curl http://localhost:3001/health
   ```

### Reset Environment

```bash
# Stop all services and remove data
docker-compose down -v

# Remove all images (force rebuild)
docker-compose down --rmi all

# Start fresh
docker-compose up -d --build
```

## 📝 Development Workflow

1. **Make code changes** in your preferred editor
2. **Rebuild affected services**:
   ```bash
   docker-compose build [service-name]
   docker-compose up -d [service-name]
   ```
3. **Test changes** using health endpoints and API calls
4. **View logs** to debug issues:
   ```bash
   docker-compose logs -f [service-name]
   ```

## 🔄 Data Synchronization

The Data Integration Service handles external data synchronization:

- **Scheduled Sync**: Monthly automatic synchronization
- **Manual Sync**: Trigger via API endpoints
- **Monitoring**: Check sync status and logs

```bash
# Trigger manual sync
curl -X POST http://localhost:3006/api/integration/run

# Check sync status
curl http://localhost:3006/api/integration/stats
```

## 📱 Mobile App Development

For React Native development:

1. **Set up environment variables**:
   ```bash
   # In mobile-app/.env
   EXPO_PUBLIC_API_URL=http://localhost:3000
   ```

2. **Start the backend services** using the deployment scripts

3. **Run the mobile app**:
   ```bash
   cd mobile-app
   npm start
   ```

## 🆘 Support

For deployment issues:

1. Check the troubleshooting section above
2. Review service logs using `docker-compose logs`
3. Verify environment configuration
4. Check health endpoints for service status

---

**Next Steps**: Once the basic deployment is working, proceed to AWS infrastructure setup (Task 13.1) for production deployment.