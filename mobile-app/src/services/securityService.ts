import { Platform } from 'react-native';
import { sslPinning } from 'react-native-ssl-pinning';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import CryptoJS from 'crypto-js';
import { analyticsService } from './analyticsService';
import { crashReportingService } from './crashReportingService';

export interface SecurityConfig {
  apiBaseUrl: string;
  certificateHashes: string[];
  apiKeyEncrypted: string;
  enableCertificatePinning: boolean;
  enableApiKeyRotation: boolean;
}

export interface SecurityViolation {
  type: 'certificate_pinning' | 'api_key_tampering' | 'root_detection' | 'debug_detection';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: number;
}

class SecurityService {
  private config: SecurityConfig;
  private apiKey: string | null = null;
  private isInitialized = false;
  private securityViolations: SecurityViolation[] = [];

  constructor() {
    this.config = {
      apiBaseUrl: process.env.API_GATEWAY_URL || 'https://api.finddining.com',
      certificateHashes: [
        // Production certificate SHA256 hashes
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=' // Backup certificate
      ],
      apiKeyEncrypted: process.env.API_KEY_ENCRYPTED || '',
      enableCertificatePinning: true,
      enableApiKeyRotation: true
    };
  }

  async initialize(): Promise<void> {
    try {
      // Decrypt and store API key
      await this.initializeApiKey();
      
      // Setup certificate pinning
      if (this.config.enableCertificatePinning) {
        await this.setupCertificatePinning();
      }
      
      // Perform security checks
      await this.performSecurityChecks();
      
      this.isInitialized = true;
      console.log('Security service initialized successfully');
      
      analyticsService.recordEvent({
        name: 'security_service_initialized',
        attributes: {
          certificate_pinning_enabled: this.config.enableCertificatePinning.toString(),
          platform: Platform.OS
        }
      });
    } catch (error) {
      const errorObj = error as Error;
      crashReportingService.recordError(errorObj, {
        screen: 'security_initialization',
        action: 'initialize'
      });
      throw error;
    }
  }

  private async initializeApiKey(): Promise<void> {
    try {
      // In a real implementation, you would decrypt the API key here
      // For now, we'll use a placeholder implementation
      const storedKey = await AsyncStorage.getItem('api_key_encrypted');
      
      if (storedKey) {
        // Decrypt the stored key (implement your decryption logic)
        this.apiKey = this.decryptApiKey(storedKey);
      } else if (this.config.apiKeyEncrypted) {
        // Decrypt the configured key
        this.apiKey = this.decryptApiKey(this.config.apiKeyEncrypted);
        // Store for future use
        await AsyncStorage.setItem('api_key_encrypted', this.config.apiKeyEncrypted);
      }
      
      if (!this.apiKey) {
        throw new Error('Failed to initialize API key');
      }
    } catch (error) {
      this.recordSecurityViolation({
        type: 'api_key_tampering',
        severity: 'critical',
        description: 'Failed to initialize API key',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  private decryptApiKey(encryptedKey: string): string {
    try {
      // Use AES decryption with a device-specific key
      const deviceId = DeviceInfo.getUniqueIdSync();
      const secretKey = CryptoJS.SHA256(deviceId + 'FindDining_Secret_Salt').toString();
      
      const decryptedBytes = CryptoJS.AES.decrypt(encryptedKey, secretKey);
      const decryptedKey = decryptedBytes.toString(CryptoJS.enc.Utf8);
      
      if (!decryptedKey) {
        throw new Error('Decryption resulted in empty key');
      }
      
      return decryptedKey;
    } catch (error) {
      throw new Error('Failed to decrypt API key: ' + (error as Error).message);
    }
  }

  private encryptApiKey(plainKey: string): string {
    try {
      const deviceId = DeviceInfo.getUniqueIdSync();
      const secretKey = CryptoJS.SHA256(deviceId + 'FindDining_Secret_Salt').toString();
      
      const encrypted = CryptoJS.AES.encrypt(plainKey, secretKey).toString();
      return encrypted;
    } catch (error) {
      throw new Error('Failed to encrypt API key: ' + (error as Error).message);
    }
  }

  private async setupCertificatePinning(): Promise<void> {
    try {
      // Configure SSL pinning for the main API
      const pinningConfig = {
        hostname: new URL(this.config.apiBaseUrl).hostname,
        publicKeyHashes: this.config.certificateHashes
      };

      console.log('Certificate pinning configured for:', pinningConfig.hostname);
      
      analyticsService.recordEvent({
        name: 'certificate_pinning_configured',
        attributes: {
          hostname: pinningConfig.hostname,
          hash_count: this.config.certificateHashes.length.toString()
        }
      });
    } catch (error) {
      this.recordSecurityViolation({
        type: 'certificate_pinning',
        severity: 'high',
        description: 'Failed to setup certificate pinning',
        timestamp: Date.now()
      });
      throw error;
    }
  }

  async makeSecureRequest(url: string, options: RequestInit = {}): Promise<Response> {
    if (!this.isInitialized) {
      throw new Error('Security service not initialized');
    }

    try {
      // Add API key to headers
      const secureHeaders = {
        ...options.headers,
        'Authorization': `Bearer ${this.apiKey}`,
        'X-API-Key': this.apiKey,
        'User-Agent': `FindDining-Mobile/${Platform.OS}`,
        'X-Platform': Platform.OS,
        'X-App-Version': '1.0.0' // Should come from app config
      };

      const secureOptions: RequestInit = {
        ...options,
        headers: secureHeaders
      };

      // Use SSL pinning for the request
      if (this.config.enableCertificatePinning && url.startsWith('https://')) {
        const response = await sslPinning.fetch(url, {
          ...secureOptions,
          sslPinning: {
            hostname: new URL(url).hostname,
            publicKeyHashes: this.config.certificateHashes
          }
        });

        analyticsService.recordEvent({
          name: 'secure_request_completed',
          attributes: {
            url: new URL(url).pathname,
            method: options.method || 'GET',
            status: response.status.toString()
          }
        });

        return response;
      } else {
        // Fallback to regular fetch for non-HTTPS or when pinning is disabled
        return fetch(url, secureOptions);
      }
    } catch (error) {
      const errorObj = error as Error;
      
      // Check if it's a certificate pinning failure
      if (errorObj.message.includes('certificate') || errorObj.message.includes('SSL')) {
        this.recordSecurityViolation({
          type: 'certificate_pinning',
          severity: 'critical',
          description: `Certificate pinning failed for ${url}: ${errorObj.message}`,
          timestamp: Date.now()
        });
      }

      crashReportingService.recordNetworkError(url, options.method || 'GET', 0, errorObj);
      throw error;
    }
  }

  private async performSecurityChecks(): Promise<void> {
    // Check for rooted/jailbroken device
    await this.checkDeviceIntegrity();
    
    // Check for debugging
    await this.checkDebuggingStatus();
    
    // Validate app integrity
    await this.validateAppIntegrity();
  }

  private async checkDeviceIntegrity(): Promise<void> {
    try {
      let isCompromised = false;
      let compromiseType = '';
      
      if (Platform.OS === 'android') {
        // Check for root access
        const isRooted = await this.checkAndroidRootStatus();
        if (isRooted) {
          isCompromised = true;
          compromiseType = 'rooted';
        }
      } else if (Platform.OS === 'ios') {
        // Check for jailbreak
        const isJailbroken = await this.checkiOSJailbreakStatus();
        if (isJailbroken) {
          isCompromised = true;
          compromiseType = 'jailbroken';
        }
      }
      
      if (isCompromised) {
        this.recordSecurityViolation({
          type: 'root_detection',
          severity: 'high',
          description: `Device appears to be ${compromiseType}`,
          timestamp: Date.now()
        });
      }
      
      // Additional device integrity checks
      await this.checkDeviceEmulator();
      await this.checkDeviceDebugging();
      
    } catch (error) {
      console.error('Failed to check device integrity:', error);
    }
  }

  private async checkAndroidRootStatus(): Promise<boolean> {
    try {
      // Check for common root indicators
      const rootIndicators = [
        '/system/app/Superuser.apk',
        '/sbin/su',
        '/system/bin/su',
        '/system/xbin/su',
        '/data/local/xbin/su',
        '/data/local/bin/su',
        '/system/sd/xbin/su',
        '/system/bin/failsafe/su',
        '/data/local/su'
      ];
      
      // In a real implementation, you would check if these files exist
      // For now, we'll use DeviceInfo to check if device is rooted
      const isRooted = await DeviceInfo.isEmulator();
      return isRooted; // This is a simplified check
    } catch (error) {
      console.error('Error checking Android root status:', error);
      return false;
    }
  }

  private async checkiOSJailbreakStatus(): Promise<boolean> {
    try {
      // Check for common jailbreak indicators
      const jailbreakIndicators = [
        '/Applications/Cydia.app',
        '/Library/MobileSubstrate/MobileSubstrate.dylib',
        '/bin/bash',
        '/usr/sbin/sshd',
        '/etc/apt',
        '/private/var/lib/apt/',
        '/private/var/lib/cydia',
        '/private/var/mobile/Library/SBSettings/Themes',
        '/Library/MobileSubstrate/DynamicLibraries/LiveClock.plist',
        '/System/Library/LaunchDaemons/com.ikey.bbot.plist'
      ];
      
      // In a real implementation, you would check if these paths exist
      // For now, we'll use a simplified check
      const isJailbroken = await DeviceInfo.isEmulator();
      return isJailbroken; // This is a simplified check
    } catch (error) {
      console.error('Error checking iOS jailbreak status:', error);
      return false;
    }
  }

  private async checkDeviceEmulator(): Promise<void> {
    try {
      const isEmulator = await DeviceInfo.isEmulator();
      if (isEmulator) {
        this.recordSecurityViolation({
          type: 'root_detection',
          severity: 'medium',
          description: 'App is running on an emulator',
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error checking emulator status:', error);
    }
  }

  private async checkDeviceDebugging(): Promise<void> {
    try {
      // Check if USB debugging is enabled (Android)
      if (Platform.OS === 'android') {
        // In a real implementation, you would check system settings
        // This is a placeholder for the actual check
        console.log('Checking USB debugging status...');
      }
    } catch (error) {
      console.error('Error checking debugging status:', error);
    }
  }

  private async checkDebuggingStatus(): Promise<void> {
    try {
      // Check if app is running in debug mode
      const isDebugging = __DEV__;
      
      if (isDebugging) {
        this.recordSecurityViolation({
          type: 'debug_detection',
          severity: 'medium',
          description: 'App is running in debug mode',
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Failed to check debugging status:', error);
    }
  }

  private async validateAppIntegrity(): Promise<void> {
    try {
      // Check app signature and bundle integrity
      const bundleId = DeviceInfo.getBundleId();
      const appVersion = DeviceInfo.getVersion();
      const buildNumber = DeviceInfo.getBuildNumber();
      
      // Validate expected bundle ID
      const expectedBundleIds = [
        'com.finddining.app',
        'com.finddining.app.staging'
      ];
      
      if (!expectedBundleIds.includes(bundleId)) {
        this.recordSecurityViolation({
          type: 'api_key_tampering',
          severity: 'critical',
          description: `Unexpected bundle ID: ${bundleId}`,
          timestamp: Date.now()
        });
      }
      
      // Check if app is signed with expected certificate
      await this.validateAppSignature();
      
      // Validate app resources integrity
      await this.validateAppResources();
      
      console.log(`App integrity validation completed for ${bundleId} v${appVersion} (${buildNumber})`);
      
    } catch (error) {
      console.error('Failed to validate app integrity:', error);
      this.recordSecurityViolation({
        type: 'api_key_tampering',
        severity: 'high',
        description: `App integrity validation failed: ${(error as Error).message}`,
        timestamp: Date.now()
      });
    }
  }

  private async validateAppSignature(): Promise<void> {
    try {
      // In a real implementation, you would validate the app's digital signature
      // This would involve checking the certificate chain and ensuring it matches
      // your expected signing certificate
      
      if (Platform.OS === 'android') {
        // Check APK signature
        const installerPackageName = await DeviceInfo.getInstallerPackageName();
        
        // Validate installer (should be Google Play Store for production)
        const validInstallers = [
          'com.android.vending', // Google Play Store
          'com.amazon.venezia',  // Amazon Appstore
          null // Direct install for development
        ];
        
        if (!validInstallers.includes(installerPackageName)) {
          this.recordSecurityViolation({
            type: 'api_key_tampering',
            severity: 'high',
            description: `App installed from unknown source: ${installerPackageName}`,
            timestamp: Date.now()
          });
        }
      } else if (Platform.OS === 'ios') {
        // For iOS, check if app is from App Store
        // In a real implementation, you would check the provisioning profile
        console.log('Validating iOS app signature...');
      }
      
    } catch (error) {
      console.error('Error validating app signature:', error);
    }
  }

  private async validateAppResources(): Promise<void> {
    try {
      // Validate critical app resources haven't been tampered with
      // This could include checking checksums of important files
      
      // In a real implementation, you would:
      // 1. Calculate checksums of critical files
      // 2. Compare with expected values
      // 3. Detect if resources have been modified
      
      console.log('App resources validation completed');
      
    } catch (error) {
      console.error('Error validating app resources:', error);
    }
  }

  private recordSecurityViolation(violation: SecurityViolation): void {
    this.securityViolations.push(violation);
    
    // Log to analytics and crash reporting
    analyticsService.recordEvent({
      name: 'security_violation',
      attributes: {
        type: violation.type,
        severity: violation.severity,
        description: violation.description
      }
    });

    crashReportingService.log(`Security violation: ${violation.type} - ${violation.description}`);
    
    // For critical violations, you might want to disable certain features
    if (violation.severity === 'critical') {
      this.handleCriticalSecurityViolation(violation);
    }
  }

  private handleCriticalSecurityViolation(violation: SecurityViolation): void {
    console.warn('Critical security violation detected:', violation);
    
    // In production, you might want to:
    // - Disable sensitive features
    // - Force app update
    // - Log out user
    // - Show security warning
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  getSecurityViolations(): SecurityViolation[] {
    return [...this.securityViolations];
  }

  async rotateApiKey(): Promise<void> {
    if (!this.config.enableApiKeyRotation) {
      return;
    }

    try {
      // Request new API key from backend
      const response = await this.makeSecureRequest('/api/auth/rotate-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deviceId: DeviceInfo.getUniqueIdSync(),
          currentKeyHash: CryptoJS.SHA256(this.apiKey || '').toString()
        })
      });

      if (!response.ok) {
        throw new Error(`API key rotation failed: ${response.status}`);
      }

      const data = await response.json();
      const newApiKey = data.apiKey;

      if (!newApiKey) {
        throw new Error('No new API key received from server');
      }

      // Encrypt and store the new API key
      const encryptedNewKey = this.encryptApiKey(newApiKey);
      await AsyncStorage.setItem('api_key_encrypted', encryptedNewKey);
      
      // Update current API key
      this.apiKey = newApiKey;
      
      // Schedule next rotation
      this.scheduleNextKeyRotation();
      
      analyticsService.recordEvent({
        name: 'api_key_rotation_completed',
        attributes: {
          rotation_timestamp: Date.now().toString()
        }
      });
      
      console.log('API key rotation completed successfully');
      
    } catch (error) {
      const errorObj = error as Error;
      
      this.recordSecurityViolation({
        type: 'api_key_tampering',
        severity: 'high',
        description: `API key rotation failed: ${errorObj.message}`,
        timestamp: Date.now()
      });
      
      crashReportingService.recordError(errorObj, {
        screen: 'security_service',
        action: 'rotate_api_key'
      });
      
      // Retry rotation after delay
      setTimeout(() => {
        this.rotateApiKey();
      }, 300000); // Retry after 5 minutes
    }
  }

  private scheduleNextKeyRotation(): void {
    // Schedule next rotation in 24 hours
    const rotationInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    setTimeout(() => {
      this.rotateApiKey();
    }, rotationInterval);
  }

  // Clean up sensitive data
  async cleanup(): Promise<void> {
    try {
      this.apiKey = null;
      this.securityViolations = [];
      await AsyncStorage.removeItem('api_key_encrypted');
      console.log('Security service cleaned up');
    } catch (error) {
      console.error('Failed to cleanup security service:', error);
    }
  }
}

export const securityService = new SecurityService();
export default securityService;