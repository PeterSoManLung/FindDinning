#!/bin/bash

# CodePush Deployment Script for Find Dining Mobile App
set -e

# Configuration
APP_NAME="FindDining"
PLATFORM=${1:-both}  # android, ios, or both
ENVIRONMENT=${2:-staging}  # development, staging, production
MANDATORY=${3:-false}  # true or false

echo "🚀 Starting CodePush deployment..."
echo "📱 Platform: $PLATFORM"
echo "🌍 Environment: $ENVIRONMENT"
echo "⚠️  Mandatory: $MANDATORY"

# Check if required tools are installed
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed. Aborting." >&2; exit 1; }
command -v code-push >/dev/null 2>&1 || { echo "❌ CodePush CLI is required but not installed. Run: npm install -g code-push-cli" >&2; exit 1; }

# Navigate to mobile app directory
cd "$(dirname "$0")/.."

# Validate environment
case $ENVIRONMENT in
  "development"|"staging"|"production")
    ;;
  *)
    echo "❌ Invalid environment: $ENVIRONMENT. Must be development, staging, or production."
    exit 1
    ;;
esac

# Validate platform
case $PLATFORM in
  "android"|"ios"|"both")
    ;;
  *)
    echo "❌ Invalid platform: $PLATFORM. Must be android, ios, or both."
    exit 1
    ;;
esac

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Run tests
echo "🧪 Running tests..."
npm test -- --watchAll=false

# Run linting
echo "🔍 Running linter..."
npm run lint

# Get current version and build number
PACKAGE_VERSION=$(node -p "require('./package.json').version")
BUILD_NUMBER=$(date +%Y%m%d%H%M%S)

# Generate release notes
RELEASE_NOTES="Automated CodePush deployment
Version: $PACKAGE_VERSION
Build: $BUILD_NUMBER
Environment: $ENVIRONMENT
Timestamp: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

Changes:
- Bug fixes and performance improvements
- Updated restaurant data
- Enhanced user experience"

echo "📝 Release notes:"
echo "$RELEASE_NOTES"

# Function to deploy to a specific platform
deploy_platform() {
    local platform=$1
    local app_suffix=""
    
    case $platform in
        "android")
            app_suffix="-Android"
            ;;
        "ios")
            app_suffix="-iOS"
            ;;
    esac
    
    local full_app_name="$APP_NAME$app_suffix"
    
    echo "🚀 Deploying to $full_app_name ($ENVIRONMENT)..."
    
    # Check if app exists
    if ! code-push app list | grep -q "$full_app_name"; then
        echo "❌ App $full_app_name not found in CodePush. Please create it first."
        return 1
    fi
    
    # Deploy to CodePush
    code-push release-react "$full_app_name" "$platform" \
        --deploymentName "$ENVIRONMENT" \
        --description "$RELEASE_NOTES" \
        --mandatory "$MANDATORY" \
        --rollout 100 \
        --disable-duplicate-release-error
    
    echo "✅ Successfully deployed to $full_app_name ($ENVIRONMENT)"
    
    # Get deployment info
    echo "📊 Deployment information:"
    code-push deployment list "$full_app_name" --displayKeys
}

# Deploy to specified platform(s)
if [ "$PLATFORM" = "both" ]; then
    deploy_platform "android"
    deploy_platform "ios"
elif [ "$PLATFORM" = "android" ]; then
    deploy_platform "android"
elif [ "$PLATFORM" = "ios" ]; then
    deploy_platform "ios"
fi

# Generate deployment report
echo "📊 Generating deployment report..."
cat > "codepush-deployment-report-$ENVIRONMENT.json" << EOF
{
  "deploymentType": "codepush",
  "platform": "$PLATFORM",
  "environment": "$ENVIRONMENT",
  "mandatory": $MANDATORY,
  "version": "$PACKAGE_VERSION",
  "buildNumber": "$BUILD_NUMBER",
  "deploymentTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "releaseNotes": $(echo "$RELEASE_NOTES" | jq -R -s .),
  "rolloutPercentage": 100
}
EOF

echo "✅ CodePush deployment completed successfully!"
echo "📄 Deployment report: codepush-deployment-report-$ENVIRONMENT.json"

# Show next steps
echo ""
echo "📋 Next steps:"
echo "1. Monitor the deployment in CodePush portal"
echo "2. Check app analytics for update adoption rates"
echo "3. Monitor crash reports for any issues"
echo "4. Be ready to rollback if necessary:"
echo "   code-push rollback $APP_NAME-Android $ENVIRONMENT"
echo "   code-push rollback $APP_NAME-iOS $ENVIRONMENT"

# Show rollback command for easy access
echo ""
echo "🔄 Quick rollback commands:"
if [ "$PLATFORM" = "both" ] || [ "$PLATFORM" = "android" ]; then
    echo "Android: code-push rollback $APP_NAME-Android $ENVIRONMENT"
fi
if [ "$PLATFORM" = "both" ] || [ "$PLATFORM" = "ios" ]; then
    echo "iOS: code-push rollback $APP_NAME-iOS $ENVIRONMENT"
fi