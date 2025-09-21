#!/bin/bash

# Android Deployment Script for Find Dining Mobile App
set -e

# Configuration
APP_NAME="FindDining"
PACKAGE_NAME="com.finddining.app"
BUILD_TYPE="release"
ENVIRONMENT=${1:-production}

echo "🚀 Starting Android deployment for $ENVIRONMENT environment..."

# Check if required tools are installed
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed. Aborting." >&2; exit 1; }

# Navigate to mobile app directory
cd "$(dirname "$0")/.."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Set environment variables based on deployment environment
case $ENVIRONMENT in
  "development")
    export API_BASE_URL="http://localhost:3000"
    export PINPOINT_APP_ID="dev-pinpoint-app-id"
    export CODEPUSH_DEPLOYMENT_KEY="dev-codepush-key"
    ;;
  "staging")
    export API_BASE_URL="https://staging-api.finddining.com"
    export PINPOINT_APP_ID="staging-pinpoint-app-id"
    export CODEPUSH_DEPLOYMENT_KEY="staging-codepush-key"
    ;;
  "production")
    export API_BASE_URL="https://api.finddining.com"
    export PINPOINT_APP_ID="prod-pinpoint-app-id"
    export CODEPUSH_DEPLOYMENT_KEY="prod-codepush-key"
    ;;
  *)
    echo "❌ Unknown environment: $ENVIRONMENT"
    exit 1
    ;;
esac

# Run tests
echo "🧪 Running tests..."
npm test -- --watchAll=false --coverage

# Run linting
echo "🔍 Running linter..."
npm run lint

# Clean previous builds
echo "🧹 Cleaning previous builds..."
cd android
./gradlew clean
cd ..

# Build Android APK
echo "🔨 Building Android APK..."
cd android
./gradlew assembleRelease
cd ..

# Build Android App Bundle (AAB) for Play Store
echo "📦 Building Android App Bundle..."
cd android
./gradlew bundleRelease
cd ..

# Verify build outputs
APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
AAB_PATH="android/app/build/outputs/bundle/release/app-release.aab"

if [ ! -f "$APK_PATH" ]; then
    echo "❌ APK build failed - file not found: $APK_PATH"
    exit 1
fi

if [ ! -f "$AAB_PATH" ]; then
    echo "❌ AAB build failed - file not found: $AAB_PATH"
    exit 1
fi

echo "✅ Android builds completed successfully!"
echo "📱 APK: $APK_PATH"
echo "📦 AAB: $AAB_PATH"

# Upload to CodePush if not production
if [ "$ENVIRONMENT" != "production" ]; then
    echo "🚀 Deploying to CodePush ($ENVIRONMENT)..."
    npx code-push release-react $APP_NAME-Android android \
        --deploymentName $ENVIRONMENT \
        --description "Automated deployment from CI/CD" \
        --mandatory false
fi

# Generate deployment report
echo "📊 Generating deployment report..."
cat > "deployment-report-android-$ENVIRONMENT.json" << EOF
{
  "platform": "android",
  "environment": "$ENVIRONMENT",
  "buildTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "packageName": "$PACKAGE_NAME",
  "buildType": "$BUILD_TYPE",
  "outputs": {
    "apk": "$APK_PATH",
    "aab": "$AAB_PATH"
  },
  "environment_variables": {
    "API_BASE_URL": "$API_BASE_URL",
    "PINPOINT_APP_ID": "$PINPOINT_APP_ID"
  }
}
EOF

echo "✅ Android deployment completed successfully!"
echo "📄 Deployment report: deployment-report-android-$ENVIRONMENT.json"

# If production, provide instructions for manual Play Store upload
if [ "$ENVIRONMENT" = "production" ]; then
    echo ""
    echo "🏪 Production deployment instructions:"
    echo "1. Upload $AAB_PATH to Google Play Console"
    echo "2. Create a new release in the Production track"
    echo "3. Add release notes and submit for review"
    echo "4. Monitor the rollout and user feedback"
fi