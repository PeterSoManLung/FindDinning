#!/bin/bash

# iOS Deployment Script for Find Dining Mobile App
set -e

# Configuration
APP_NAME="FindDining"
BUNDLE_ID="com.finddining.app"
SCHEME="FindDining"
WORKSPACE="ios/FindDining.xcworkspace"
ENVIRONMENT=${1:-production}

echo "🚀 Starting iOS deployment for $ENVIRONMENT environment..."

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ iOS deployment requires macOS. Current OS: $OSTYPE"
    exit 1
fi

# Check if required tools are installed
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed. Aborting." >&2; exit 1; }
command -v xcodebuild >/dev/null 2>&1 || { echo "❌ Xcode is required but not installed. Aborting." >&2; exit 1; }
command -v pod >/dev/null 2>&1 || { echo "❌ CocoaPods is required but not installed. Aborting." >&2; exit 1; }

# Navigate to mobile app directory
cd "$(dirname "$0")/.."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Install CocoaPods dependencies
echo "🍫 Installing CocoaPods dependencies..."
cd ios
pod install --repo-update
cd ..

# Set environment variables based on deployment environment
case $ENVIRONMENT in
  "development")
    export API_BASE_URL="http://localhost:3000"
    export PINPOINT_APP_ID="dev-pinpoint-app-id"
    export CODEPUSH_DEPLOYMENT_KEY="dev-codepush-key"
    CONFIGURATION="Debug"
    ;;
  "staging")
    export API_BASE_URL="https://staging-api.finddining.com"
    export PINPOINT_APP_ID="staging-pinpoint-app-id"
    export CODEPUSH_DEPLOYMENT_KEY="staging-codepush-key"
    CONFIGURATION="Release"
    ;;
  "production")
    export API_BASE_URL="https://api.finddining.com"
    export PINPOINT_APP_ID="prod-pinpoint-app-id"
    export CODEPUSH_DEPLOYMENT_KEY="prod-codepush-key"
    CONFIGURATION="Release"
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
xcodebuild clean -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration "$CONFIGURATION"

# Create build directory
BUILD_DIR="ios/build"
ARCHIVE_PATH="$BUILD_DIR/$SCHEME.xcarchive"
EXPORT_PATH="$BUILD_DIR/export"

mkdir -p "$BUILD_DIR"
mkdir -p "$EXPORT_PATH"

# Build and archive
echo "🔨 Building and archiving iOS app..."
xcodebuild archive \
    -workspace "$WORKSPACE" \
    -scheme "$SCHEME" \
    -configuration "$CONFIGURATION" \
    -destination "generic/platform=iOS" \
    -archivePath "$ARCHIVE_PATH" \
    -allowProvisioningUpdates \
    CODE_SIGN_STYLE=Automatic \
    DEVELOPMENT_TEAM="$IOS_TEAM_ID"

# Verify archive was created
if [ ! -d "$ARCHIVE_PATH" ]; then
    echo "❌ Archive build failed - directory not found: $ARCHIVE_PATH"
    exit 1
fi

# Export IPA
echo "📦 Exporting IPA..."
xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportPath "$EXPORT_PATH" \
    -exportOptionsPlist "ios/ExportOptions.plist" \
    -allowProvisioningUpdates

# Find the exported IPA
IPA_PATH=$(find "$EXPORT_PATH" -name "*.ipa" | head -n 1)

if [ ! -f "$IPA_PATH" ]; then
    echo "❌ IPA export failed - file not found in: $EXPORT_PATH"
    exit 1
fi

echo "✅ iOS build completed successfully!"
echo "📱 IPA: $IPA_PATH"

# Upload to CodePush if not production
if [ "$ENVIRONMENT" != "production" ]; then
    echo "🚀 Deploying to CodePush ($ENVIRONMENT)..."
    npx code-push release-react $APP_NAME-iOS ios \
        --deploymentName $ENVIRONMENT \
        --description "Automated deployment from CI/CD" \
        --mandatory false
fi

# Generate deployment report
echo "📊 Generating deployment report..."
cat > "deployment-report-ios-$ENVIRONMENT.json" << EOF
{
  "platform": "ios",
  "environment": "$ENVIRONMENT",
  "buildTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "bundleId": "$BUNDLE_ID",
  "configuration": "$CONFIGURATION",
  "outputs": {
    "archive": "$ARCHIVE_PATH",
    "ipa": "$IPA_PATH"
  },
  "environment_variables": {
    "API_BASE_URL": "$API_BASE_URL",
    "PINPOINT_APP_ID": "$PINPOINT_APP_ID"
  }
}
EOF

echo "✅ iOS deployment completed successfully!"
echo "📄 Deployment report: deployment-report-ios-$ENVIRONMENT.json"

# If production, provide instructions for manual App Store upload
if [ "$ENVIRONMENT" = "production" ]; then
    echo ""
    echo "🏪 Production deployment instructions:"
    echo "1. Upload $IPA_PATH to App Store Connect using Transporter or Xcode"
    echo "2. Create a new version in App Store Connect"
    echo "3. Add app information, screenshots, and release notes"
    echo "4. Submit for App Store review"
    echo "5. Monitor the review process and respond to any feedback"
    echo ""
    echo "Alternative: Use altool for command-line upload:"
    echo "xcrun altool --upload-app -f \"$IPA_PATH\" -u \"\$APPLE_ID\" -p \"\$APP_SPECIFIC_PASSWORD\""
fi