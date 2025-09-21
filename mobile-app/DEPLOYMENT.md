# Mobile App Deployment Guide

This guide covers the complete deployment process for the Find Dining mobile application, including build pipeline setup, app store deployment, analytics, over-the-air updates, security, and performance monitoring.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Build Pipeline](#build-pipeline)
4. [App Store Deployment](#app-store-deployment)
5. [Analytics & Crash Reporting](#analytics--crash-reporting)
6. [Over-the-Air Updates](#over-the-air-updates)
7. [Security Configuration](#security-configuration)
8. [Performance Monitoring](#performance-monitoring)
9. [Deployment Scripts](#deployment-scripts)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

### Development Environment
- Node.js 18+
- npm or yarn
- React Native CLI
- Android Studio (for Android builds)
- Xcode (for iOS builds, macOS only)
- CocoaPods (for iOS dependencies)

### External Services
- AWS Account with Pinpoint, AppSync, and S3 access
- Firebase project for performance monitoring and crashlytics
- CodePush account for OTA updates
- Google Play Console account (Android)
- Apple Developer account (iOS)

## Environment Setup

### 1. Install Dependencies

```bash
cd mobile-app
npm install
```

### 2. Configure Environment Variables

Create environment-specific configuration files:

```bash
# Development
cp .env.example .env.development

# Staging
cp .env.example .env.staging

# Production
cp .env.example .env.production
```

Update each file with appropriate values:

```env
API_GATEWAY_URL=https://api.finddining.com
AWS_REGION=ap-southeast-1
PINPOINT_APP_ID=your-pinpoint-app-id
CODEPUSH_DEPLOYMENT_KEY=your-codepush-key
API_KEY_ENCRYPTED=your-encrypted-api-key
```

### 3. Firebase Configuration

1. Create a Firebase project
2. Download configuration files:
   - `android/app/google-services.json` (Android)
   - `ios/GoogleService-Info.plist` (iOS)
3. Enable Performance Monitoring and Crashlytics

### 4. AWS Pinpoint Setup

1. Create a Pinpoint project in AWS Console
2. Note the Application ID and Region
3. Configure IAM roles for mobile access

## Build Pipeline

### GitHub Actions Workflow

The build pipeline is configured in `.github/workflows/build-and-deploy.yml` and includes:

1. **Test Stage**: Unit tests, accessibility tests, performance tests
2. **Build Stage**: Platform-specific builds (Android APK/AAB, iOS IPA)
3. **Deploy Stage**: Automated deployment to app stores

### Required Secrets

Configure these secrets in your GitHub repository:

#### Android
- `ANDROID_KEYSTORE_BASE64`: Base64 encoded keystore file
- `ANDROID_KEYSTORE_PASSWORD`: Keystore password
- `ANDROID_KEY_ALIAS`: Key alias
- `ANDROID_KEY_PASSWORD`: Key password
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`: Service account JSON for Play Store

#### iOS
- `IOS_CERTIFICATES_P12`: Base64 encoded certificates
- `IOS_CERTIFICATES_PASSWORD`: Certificate password
- `APPSTORE_ISSUER_ID`: App Store Connect issuer ID
- `APPSTORE_KEY_ID`: App Store Connect key ID
- `APPSTORE_PRIVATE_KEY`: App Store Connect private key

## App Store Deployment

### Android (Google Play Store)

1. **Build AAB**: `npm run build:android:bundle`
2. **Upload to Play Console**: Use the GitHub Actions workflow or manual upload
3. **Create Release**: Configure release notes and rollout percentage
4. **Submit for Review**: Monitor the review process

### iOS (Apple App Store)

1. **Build IPA**: `npm run build:ios`
2. **Upload to App Store Connect**: Use Transporter or Xcode
3. **Create Version**: Configure app information and screenshots
4. **Submit for Review**: Monitor the review process

## Analytics & Crash Reporting

### AWS Pinpoint Integration

The app uses AWS Pinpoint for analytics:

```typescript
import { analyticsService } from './services/analyticsService';

// Record custom events
analyticsService.recordEvent({
  name: 'recommendation_interaction',
  attributes: {
    restaurant_id: 'rest123',
    action: 'view_details'
  }
});

// Record screen views
analyticsService.recordScreenView('HomeScreen');
```

### Firebase Crashlytics

Crash reporting is handled automatically:

```typescript
import { crashReportingService } from './services/crashReportingService';

// Record non-fatal errors
crashReportingService.recordError(error, {
  screen: 'RecommendationScreen',
  userId: 'user123'
});
```

## Over-the-Air Updates

### CodePush Setup

1. **Install CodePush CLI**: `npm install -g code-push-cli`
2. **Create Apps**:
   ```bash
   code-push app add FindDining-Android android react-native
   code-push app add FindDining-iOS ios react-native
   ```
3. **Get Deployment Keys**:
   ```bash
   code-push deployment list FindDining-Android --displayKeys
   code-push deployment list FindDining-iOS --displayKeys
   ```

### Deployment

```bash
# Deploy to staging
./scripts/deploy-codepush.sh both staging false

# Deploy to production (mandatory)
./scripts/deploy-codepush.sh both production true
```

## Security Configuration

### Certificate Pinning

Configure certificate hashes in `src/services/securityService.ts`:

```typescript
certificateHashes: [
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // Primary cert
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB='  // Backup cert
]
```

### API Key Protection

API keys are encrypted and stored securely:

```typescript
// Keys are automatically decrypted at runtime
const apiKey = securityService.getApiKey();
```

## Performance Monitoring

### Firebase Performance

Automatic monitoring for:
- App launch time
- Screen rendering time
- Network requests
- Custom traces

### Custom Performance Tracking

```typescript
import { performanceMonitoringService } from './services/performanceMonitoringService';

// Track custom operations
const traceId = performanceMonitoringService.startTrace('recommendation_generation');
// ... perform operation
performanceMonitoringService.stopTrace(traceId, { recommendation_count: 5 });
```

## Deployment Scripts

### Android Deployment

```bash
# Development build
./scripts/deploy-android.sh development

# Production build
./scripts/deploy-android.sh production
```

### iOS Deployment

```bash
# Staging build
./scripts/deploy-ios.sh staging

# Production build
./scripts/deploy-ios.sh production
```

### CodePush Deployment

```bash
# Deploy to both platforms
./scripts/deploy-codepush.sh both staging false

# Deploy to Android only
./scripts/deploy-codepush.sh android production true
```

### Monitoring Setup

```bash
# Setup monitoring for production
./scripts/setup-monitoring.sh production
```

## Monitoring & Analytics

### Key Metrics to Monitor

1. **Performance Metrics**:
   - App launch time (< 3 seconds)
   - Screen load time (< 2 seconds)
   - Network request time (< 5 seconds)
   - Recommendation generation time (< 3 seconds)

2. **User Behavior**:
   - Screen views and navigation patterns
   - Recommendation interactions
   - Search queries and results
   - Feature usage statistics

3. **Error Tracking**:
   - Crash rates and stack traces
   - Network errors and API failures
   - Performance issues and bottlenecks
   - Security violations

### Dashboards

Monitor your app through:
- **Firebase Console**: Performance and Crashlytics
- **AWS Pinpoint Console**: User analytics and engagement
- **CodePush Portal**: Update adoption and rollback status

## Troubleshooting

### Common Issues

1. **Build Failures**:
   - Check certificate validity
   - Verify environment variables
   - Update dependencies

2. **CodePush Issues**:
   - Verify deployment keys
   - Check bundle compatibility
   - Monitor rollout percentage

3. **Analytics Not Working**:
   - Verify AWS/Firebase configuration
   - Check network connectivity
   - Validate event formatting

4. **Performance Issues**:
   - Monitor memory usage
   - Check network request optimization
   - Verify image loading strategies

### Support

For deployment issues:
1. Check the deployment logs
2. Verify all configuration files
3. Test in staging environment first
4. Monitor analytics and crash reports
5. Have rollback plan ready

## Security Considerations

1. **Certificate Pinning**: Always enabled in production
2. **API Key Rotation**: Automated rotation every 24 hours
3. **Data Encryption**: All sensitive data encrypted at rest and in transit
4. **Security Monitoring**: Real-time security violation detection
5. **Compliance**: GDPR-compliant data handling and user privacy

## Maintenance

### Regular Tasks

1. **Weekly**:
   - Review crash reports and fix critical issues
   - Monitor performance metrics and optimize bottlenecks
   - Update dependencies and security patches

2. **Monthly**:
   - Rotate API keys and certificates
   - Review analytics data and user feedback
   - Update app store metadata and screenshots

3. **Quarterly**:
   - Security audit and penetration testing
   - Performance benchmarking and optimization
   - User experience analysis and improvements

This deployment guide ensures a robust, secure, and monitored mobile application deployment process that meets enterprise standards while providing excellent user experience.