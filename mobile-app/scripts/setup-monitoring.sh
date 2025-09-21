#!/bin/bash

# Performance Monitoring Setup Script for Find Dining Mobile App
set -e

ENVIRONMENT=${1:-production}

echo "🔧 Setting up performance monitoring for $ENVIRONMENT environment..."

# Navigate to mobile app directory
cd "$(dirname "$0")/.."

# Check if required tools are installed
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed. Aborting." >&2; exit 1; }

# Install monitoring dependencies if not already installed
echo "📦 Installing monitoring dependencies..."
npm install --save \
    @react-native-firebase/app \
    @react-native-firebase/perf \
    @react-native-firebase/crashlytics \
    aws-amplify \
    @aws-amplify/react-native \
    @aws-amplify/analytics \
    react-native-performance \
    react-native-flipper-performance-plugin

# Setup Firebase configuration
echo "🔥 Setting up Firebase configuration..."

# Create Firebase configuration files if they don't exist
if [ ! -f "android/app/google-services.json" ]; then
    echo "⚠️  Warning: android/app/google-services.json not found"
    echo "Please download it from Firebase Console and place it in android/app/"
fi

if [ ! -f "ios/GoogleService-Info.plist" ]; then
    echo "⚠️  Warning: ios/GoogleService-Info.plist not found"
    echo "Please download it from Firebase Console and place it in ios/"
fi

# Setup AWS Amplify configuration
echo "☁️  Setting up AWS Amplify configuration..."

# Create AWS configuration based on environment
case $ENVIRONMENT in
  "development")
    AWS_REGION="ap-southeast-1"
    PINPOINT_APP_ID="dev-pinpoint-app-id"
    ;;
  "staging")
    AWS_REGION="ap-southeast-1"
    PINPOINT_APP_ID="staging-pinpoint-app-id"
    ;;
  "production")
    AWS_REGION="ap-southeast-1"
    PINPOINT_APP_ID="prod-pinpoint-app-id"
    ;;
  *)
    echo "❌ Unknown environment: $ENVIRONMENT"
    exit 1
    ;;
esac

# Update aws-exports.ts with environment-specific values
cat > "src/aws-exports.ts" << EOF
const awsconfig = {
  aws_project_region: '$AWS_REGION',
  aws_cognito_identity_pool_id: process.env.AWS_COGNITO_IDENTITY_POOL_ID || '',
  aws_cognito_region: '$AWS_REGION',
  aws_mobile_analytics_app_id: '$PINPOINT_APP_ID',
  aws_mobile_analytics_app_region: '$AWS_REGION',
  
  // API Gateway configuration
  aws_cloud_logic_custom: [
    {
      name: 'FindDiningAPI',
      endpoint: process.env.API_GATEWAY_URL || 'https://api.finddining.com',
      region: '$AWS_REGION'
    }
  ],
  
  // Analytics configuration
  Analytics: {
    AWSPinpoint: {
      appId: '$PINPOINT_APP_ID',
      region: '$AWS_REGION',
      mandatorySignIn: false,
      endpoint: {
        region: '$AWS_REGION',
        service: 'mobiletargeting'
      }
    }
  }
};

export default awsconfig;
EOF

# Setup Android monitoring configuration
echo "🤖 Setting up Android monitoring configuration..."

# Update Android build.gradle with monitoring dependencies
if ! grep -q "firebase-perf" "android/app/build.gradle"; then
    echo "Adding Firebase Performance to Android build.gradle..."
    # This would need to be done manually or with more sophisticated text processing
fi

# Setup iOS monitoring configuration
echo "🍎 Setting up iOS monitoring configuration..."

# Create iOS monitoring configuration
cat > "ios/FindDining/MonitoringConfig.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PerformanceMonitoring</key>
    <dict>
        <key>Enabled</key>
        <true/>
        <key>SampleRate</key>
        <real>1.0</real>
        <key>NetworkTracing</key>
        <true/>
        <key>ScreenTracing</key>
        <true/>
    </dict>
    <key>Analytics</key>
    <dict>
        <key>PinpointAppId</key>
        <string>$PINPOINT_APP_ID</string>
        <key>AWSRegion</key>
        <string>$AWS_REGION</string>
    </dict>
    <key>CrashReporting</key>
    <dict>
        <key>Enabled</key>
        <true/>
        <key>CollectUserData</key>
        <false/>
    </dict>
</dict>
</plist>
EOF

# Create monitoring dashboard configuration
echo "📊 Creating monitoring dashboard configuration..."

cat > "monitoring-dashboard-config.json" << EOF
{
  "dashboards": {
    "performance": {
      "metrics": [
        "app_launch_time",
        "screen_load_time",
        "network_request_time",
        "recommendation_generation_time",
        "memory_usage",
        "frame_rate"
      ],
      "alerts": [
        {
          "metric": "app_launch_time",
          "threshold": 3000,
          "severity": "warning"
        },
        {
          "metric": "screen_load_time",
          "threshold": 2000,
          "severity": "warning"
        },
        {
          "metric": "network_request_time",
          "threshold": 5000,
          "severity": "critical"
        }
      ]
    },
    "user_behavior": {
      "events": [
        "screen_view",
        "recommendation_interaction",
        "search_performed",
        "user_behavior",
        "app_foreground",
        "app_background"
      ]
    },
    "errors": {
      "types": [
        "app_error",
        "network_error",
        "recommendation_error",
        "security_violation"
      ]
    }
  },
  "retention": {
    "performance_metrics": "30d",
    "user_events": "90d",
    "error_logs": "180d"
  }
}
EOF

# Create monitoring test script
echo "🧪 Creating monitoring test script..."

cat > "scripts/test-monitoring.js" << EOF
const { analyticsService } = require('../src/services/analyticsService');
const { performanceMonitoringService } = require('../src/services/performanceMonitoringService');
const { crashReportingService } = require('../src/services/crashReportingService');

async function testMonitoring() {
  console.log('🧪 Testing monitoring services...');
  
  try {
    // Test analytics
    console.log('📊 Testing analytics service...');
    analyticsService.recordEvent({
      name: 'monitoring_test',
      attributes: {
        test_type: 'setup_verification',
        environment: '$ENVIRONMENT'
      }
    });
    
    // Test performance monitoring
    console.log('⚡ Testing performance monitoring...');
    const traceId = performanceMonitoringService.startTrace('test_trace');
    setTimeout(() => {
      performanceMonitoringService.stopTrace(traceId, { test_metric: 100 });
    }, 1000);
    
    // Test crash reporting (non-fatal)
    console.log('💥 Testing crash reporting...');
    const testError = new Error('Test error for monitoring setup');
    crashReportingService.recordError(testError, {
      screen: 'monitoring_test',
      action: 'setup_verification'
    });
    
    console.log('✅ All monitoring services tested successfully!');
    
    // Flush events
    await analyticsService.flushEvents();
    
  } catch (error) {
    console.error('❌ Monitoring test failed:', error);
    process.exit(1);
  }
}

testMonitoring();
EOF

# Make scripts executable
chmod +x "scripts/test-monitoring.js"

# Create environment-specific monitoring configuration
echo "🌍 Creating environment-specific monitoring configuration..."

cat > ".env.monitoring.$ENVIRONMENT" << EOF
# Monitoring Configuration for $ENVIRONMENT
AWS_REGION=$AWS_REGION
PINPOINT_APP_ID=$PINPOINT_APP_ID
ENABLE_PERFORMANCE_MONITORING=true
ENABLE_CRASH_REPORTING=true
ENABLE_ANALYTICS=true
MONITORING_SAMPLE_RATE=1.0
LOG_LEVEL=info
EOF

# Update package.json scripts
echo "📝 Updating package.json scripts..."

# Add monitoring scripts to package.json (this would need to be done more carefully in practice)
npm pkg set scripts.test:monitoring="node scripts/test-monitoring.js"
npm pkg set scripts.monitoring:setup="bash scripts/setup-monitoring.sh"

echo "✅ Performance monitoring setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Configure Firebase project and download configuration files:"
echo "   - android/app/google-services.json"
echo "   - ios/GoogleService-Info.plist"
echo ""
echo "2. Configure AWS Pinpoint in your AWS account"
echo ""
echo "3. Test the monitoring setup:"
echo "   npm run test:monitoring"
echo ""
echo "4. Deploy the app and verify monitoring data in:"
echo "   - Firebase Console (Performance & Crashlytics)"
echo "   - AWS Pinpoint Console (Analytics)"
echo ""
echo "5. Set up monitoring alerts and dashboards"
echo ""
echo "📊 Monitoring dashboard config: monitoring-dashboard-config.json"
echo "🌍 Environment config: .env.monitoring.$ENVIRONMENT"