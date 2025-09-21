@echo off
REM Build All Services Script for Windows
REM This script builds all microservices for the Find Dining application

echo 🏗️  Building Find Dining Microservices...

REM Function to build a service
:build_service
set service_name=%1
set service_path=%2

echo Building %service_name%...

if exist "%service_path%" (
    cd /d "%service_path%"
    
    REM Install dependencies if node_modules doesn't exist
    if not exist "node_modules" (
        echo Installing dependencies for %service_name%...
        call npm ci
    )
    
    REM Build the service
    call npm run build
    
    if %ERRORLEVEL% equ 0 (
        echo ✅ %service_name% built successfully
    ) else (
        echo ❌ Failed to build %service_name%
        exit /b 1
    )
    
    cd /d "%~dp0.."
) else (
    echo ❌ Directory %service_path% not found
    exit /b 1
)
goto :eof

REM Build shared library first
echo Building shared library...
if exist "shared" (
    cd /d "shared"
    call npm ci
    call npm run build
    cd /d "%~dp0.."
    echo ✅ Shared library built successfully
)

REM Build all services
call :build_service "API Gateway" "api-gateway"
call :build_service "User Service" "user-service"
call :build_service "Restaurant Service" "restaurant-service"
call :build_service "Recommendation Engine" "recommendation-engine"
call :build_service "Review Service" "review-service"
call :build_service "Emotion Service" "emotion-service"
call :build_service "Data Integration Service" "data-integration-service"

echo 🎉 All services built successfully!
pause