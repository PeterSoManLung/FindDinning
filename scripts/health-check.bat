@echo off
REM Health Check Script for Windows
REM This script checks the health of all Find Dining services

echo 🔍 Checking Find Dining Services Health...

set healthy_count=0
set total_count=7

echo 🏥 Service Health Check
echo ================================

REM Function to check service health
:check_service
set service_name=%1
set port=%2
echo Checking %service_name%...

curl -s -f "http://localhost:%port%/health" >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo ✅ %service_name% - Healthy
    set /a healthy_count+=1
) else (
    echo ❌ %service_name% - Unhealthy
)
goto :eof

REM Check all services
call :check_service "API Gateway" 3000
call :check_service "User Service" 3001
call :check_service "Restaurant Service" 3002
call :check_service "Recommendation Engine" 3003
call :check_service "Review Service" 3004
call :check_service "Emotion Service" 3005
call :check_service "Data Integration Service" 3006

echo ================================

if %healthy_count% equ %total_count% (
    echo 🎉 All services are healthy! (%healthy_count%/%total_count%)
    exit /b 0
) else if %healthy_count% gtr 0 (
    echo ⚠️  Some services are unhealthy (%healthy_count%/%total_count%)
    exit /b 1
) else (
    echo 💥 All services are down!
    exit /b 2
)

pause