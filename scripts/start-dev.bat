@echo off
REM Start Development Environment Script for Windows
REM This script starts all services in development mode

echo 🚀 Starting Find Dining Development Environment...

REM Check if Docker is running
docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ Docker is not running. Please start Docker and try again.
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️  .env file not found. Copying from .env.example...
    copy ".env.example" ".env"
    echo 📝 Please update .env file with your configuration before running again.
    pause
    exit /b 1
)

REM Create logs directory if it doesn't exist
if not exist "logs" mkdir logs

REM Start services with Docker Compose
echo 🐳 Starting services with Docker Compose...
docker-compose up -d

REM Wait for services to be ready
echo ⏳ Waiting for services to be ready...
timeout /t 10 /nobreak >nul

echo 🔍 Checking service health...
timeout /t 5 /nobreak >nul

echo 🎉 Services should be running now!
echo.
echo 📋 Service URLs:
echo   🌐 API Gateway:              http://localhost:3000
echo   👤 User Service:             http://localhost:3001
echo   🏪 Restaurant Service:       http://localhost:3002
echo   🤖 Recommendation Engine:    http://localhost:3003
echo   ⭐ Review Service:           http://localhost:3004
echo   😊 Emotion Service:          http://localhost:3005
echo   🔄 Data Integration Service: http://localhost:3006
echo.
echo 📊 Infrastructure:
echo   🐘 PostgreSQL (User DB):     localhost:5432
echo   🐘 PostgreSQL (Restaurant):  localhost:5433
echo   🔴 Redis:                    localhost:6379
echo.
echo 💡 Use 'docker-compose logs -f [service-name]' to view logs
echo 💡 Use 'docker-compose down' to stop all services
pause