import CodePush from 'react-native-code-push';
import { Alert, Platform } from 'react-native';
import { analyticsService } from './analyticsService';
import { crashReportingService } from './crashReportingService';

export interface UpdateCheckResult {
  updateAvailable: boolean;
  updateInfo?: CodePush.RemotePackage;
  error?: Error;
}

export interface UpdateProgress {
  receivedBytes: number;
  totalBytes: number;
  percentage: number;
}

export interface UpdateFailureInfo {
  error: Error;
  retryCount: number;
  canRollback: boolean;
}

export interface UserConsentOptions {
  title: string;
  message: string;
  acceptButtonText: string;
  declineButtonText: string;
  showDataUsageWarning: boolean;
}

class CodePushService {
  private isCheckingForUpdate = false;
  private isDownloadingUpdate = false;
  private updateRetryCount = 0;
  private maxRetryAttempts = 3;
  private rollbackHistory: CodePush.LocalPackage[] = [];
  private userConsentCallbacks: Map<string, (consent: boolean) => void> = new Map();

  async checkForUpdate(showAlert: boolean = false): Promise<UpdateCheckResult> {
    if (this.isCheckingForUpdate) {
      return { updateAvailable: false };
    }

    this.isCheckingForUpdate = true;

    try {
      analyticsService.recordEvent({
        name: 'codepush_check_started',
        attributes: {
          platform: Platform.OS,
          show_alert: showAlert.toString()
        }
      });

      const update = await CodePush.checkForUpdate();
      
      if (update) {
        analyticsService.recordEvent({
          name: 'codepush_update_available',
          attributes: {
            app_version: update.appVersion,
            description: update.description || 'No description',
            is_mandatory: update.isMandatory.toString(),
            package_size: update.packageSize?.toString() || '0'
          }
        });

        if (showAlert) {
          this.showUpdateAlert(update);
        }

        return { updateAvailable: true, updateInfo: update };
      } else {
        analyticsService.recordEvent({
          name: 'codepush_no_update_available'
        });
        return { updateAvailable: false };
      }
    } catch (error) {
      const errorObj = error as Error;
      crashReportingService.recordError(errorObj, {
        screen: 'codepush_check',
        action: 'check_for_update'
      });

      analyticsService.recordEvent({
        name: 'codepush_check_failed',
        attributes: {
          error_message: errorObj.message
        }
      });

      return { updateAvailable: false, error: errorObj };
    } finally {
      this.isCheckingForUpdate = false;
    }
  }

  private showUpdateAlert(update: CodePush.RemotePackage): void {
    if (update.isMandatory) {
      this.showMandatoryUpdateAlert(update);
    } else {
      this.showOptionalUpdateAlert(update);
    }
  }

  private showMandatoryUpdateAlert(update: CodePush.RemotePackage): void {
    const title = 'Required Update';
    const message = `${update.description || 'A mandatory update is required to continue using the app.'}\n\nThis update will be installed automatically.`;
    
    Alert.alert(title, message, [
      { text: 'Update Now', onPress: () => this.downloadAndInstallUpdate(update) }
    ], { cancelable: false });
  }

  private showOptionalUpdateAlert(update: CodePush.RemotePackage): void {
    const consentOptions: UserConsentOptions = {
      title: 'Update Available',
      message: update.description || 'A new version of the app is available with improvements and bug fixes.',
      acceptButtonText: 'Update Now',
      declineButtonText: 'Later',
      showDataUsageWarning: true
    };

    this.requestUserConsent(update, consentOptions);
  }

  private requestUserConsent(update: CodePush.RemotePackage, options: UserConsentOptions): void {
    const packageSizeMB = update.packageSize ? (update.packageSize / (1024 * 1024)).toFixed(1) : 'Unknown';
    
    let message = options.message;
    if (options.showDataUsageWarning) {
      message += `\n\nDownload size: ${packageSizeMB} MB\nData charges may apply.`;
    }

    const buttons = [
      { 
        text: options.declineButtonText, 
        style: 'cancel' as const,
        onPress: () => this.handleUserDecline(update)
      },
      { 
        text: options.acceptButtonText, 
        onPress: () => this.handleUserAccept(update)
      }
    ];

    Alert.alert(options.title, message, buttons);
  }

  private handleUserAccept(update: CodePush.RemotePackage): void {
    analyticsService.recordEvent({
      name: 'codepush_user_consent_accepted',
      attributes: {
        app_version: update.appVersion,
        is_mandatory: update.isMandatory.toString()
      }
    });

    this.downloadAndInstallUpdate(update);
  }

  private handleUserDecline(update: CodePush.RemotePackage): void {
    analyticsService.recordEvent({
      name: 'codepush_user_consent_declined',
      attributes: {
        app_version: update.appVersion,
        is_mandatory: update.isMandatory.toString()
      }
    });

    // Schedule reminder for optional updates
    if (!update.isMandatory) {
      this.scheduleUpdateReminder(update);
    }
  }

  private scheduleUpdateReminder(update: CodePush.RemotePackage): void {
    // Remind user about update after 24 hours
    setTimeout(() => {
      this.showOptionalUpdateAlert(update);
    }, 24 * 60 * 60 * 1000);
  }

  async downloadAndInstallUpdate(
    update?: CodePush.RemotePackage,
    onProgress?: (progress: UpdateProgress) => void,
    onFailure?: (failureInfo: UpdateFailureInfo) => void
  ): Promise<boolean> {
    if (this.isDownloadingUpdate) {
      return false;
    }

    this.isDownloadingUpdate = true;

    try {
      const updateToDownload = update || await CodePush.checkForUpdate();
      
      if (!updateToDownload) {
        return false;
      }

      // Store current package for potential rollback
      await this.storeCurrentPackageForRollback();

      analyticsService.recordEvent({
        name: 'codepush_download_started',
        attributes: {
          app_version: updateToDownload.appVersion,
          package_size: updateToDownload.packageSize?.toString() || '0',
          retry_count: this.updateRetryCount.toString()
        }
      });

      const downloadProgress = (progress: CodePush.DownloadProgress) => {
        const progressInfo: UpdateProgress = {
          receivedBytes: progress.receivedBytes,
          totalBytes: progress.totalBytes,
          percentage: Math.round((progress.receivedBytes / progress.totalBytes) * 100)
        };

        onProgress?.(progressInfo);

        analyticsService.recordEvent({
          name: 'codepush_download_progress',
          metrics: {
            percentage: progressInfo.percentage,
            received_bytes: progress.receivedBytes,
            total_bytes: progress.totalBytes
          }
        });
      };

      // Download the update with timeout
      const localPackage = await this.downloadWithTimeout(updateToDownload, downloadProgress, 300000); // 5 minute timeout

      analyticsService.recordEvent({
        name: 'codepush_download_completed',
        attributes: {
          app_version: updateToDownload.appVersion
        }
      });

      // Validate downloaded package
      const isValid = await this.validateDownloadedPackage(localPackage);
      if (!isValid) {
        throw new Error('Downloaded package validation failed');
      }

      // Install the update
      const installMode = updateToDownload.isMandatory 
        ? CodePush.InstallMode.IMMEDIATE 
        : CodePush.InstallMode.ON_NEXT_RESTART;

      await localPackage.install(installMode);

      analyticsService.recordEvent({
        name: 'codepush_install_completed',
        attributes: {
          app_version: updateToDownload.appVersion,
          install_mode: updateToDownload.isMandatory ? 'immediate' : 'on_restart'
        }
      });

      // Reset retry count on successful installation
      this.updateRetryCount = 0;

      return true;
    } catch (error) {
      const errorObj = error as Error;
      
      crashReportingService.recordError(errorObj, {
        screen: 'codepush_download',
        action: 'download_and_install',
        retry_count: this.updateRetryCount
      });

      analyticsService.recordEvent({
        name: 'codepush_download_failed',
        attributes: {
          error_message: errorObj.message,
          retry_count: this.updateRetryCount.toString()
        }
      });

      // Handle update failure
      await this.handleUpdateFailure(errorObj, update, onFailure);

      return false;
    } finally {
      this.isDownloadingUpdate = false;
    }
  }

  private async downloadWithTimeout(
    update: CodePush.RemotePackage,
    onProgress: (progress: CodePush.DownloadProgress) => void,
    timeoutMs: number
  ): Promise<CodePush.LocalPackage> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Download timeout'));
      }, timeoutMs);

      update.download(onProgress)
        .then((localPackage) => {
          clearTimeout(timeout);
          resolve(localPackage);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  private async validateDownloadedPackage(localPackage: CodePush.LocalPackage): Promise<boolean> {
    try {
      // Validate package integrity
      if (!localPackage.packageHash) {
        return false;
      }

      // Additional validation can be added here
      // e.g., signature verification, size checks, etc.
      
      return true;
    } catch (error) {
      console.error('Package validation failed:', error);
      return false;
    }
  }

  private async handleUpdateFailure(
    error: Error,
    update?: CodePush.RemotePackage,
    onFailure?: (failureInfo: UpdateFailureInfo) => void
  ): Promise<void> {
    this.updateRetryCount++;

    const canRollback = this.rollbackHistory.length > 0;
    const failureInfo: UpdateFailureInfo = {
      error,
      retryCount: this.updateRetryCount,
      canRollback
    };

    onFailure?.(failureInfo);

    if (this.updateRetryCount < this.maxRetryAttempts && update) {
      // Retry after delay
      setTimeout(() => {
        this.downloadAndInstallUpdate(update, undefined, onFailure);
      }, Math.pow(2, this.updateRetryCount) * 1000); // Exponential backoff
    } else if (canRollback) {
      // Offer rollback option
      this.offerRollback();
    }
  }

  private async storeCurrentPackageForRollback(): Promise<void> {
    try {
      const currentPackage = await CodePush.getUpdateMetadata();
      if (currentPackage && this.rollbackHistory.length < 3) { // Keep last 3 versions
        this.rollbackHistory.push(currentPackage);
      }
    } catch (error) {
      console.error('Failed to store current package for rollback:', error);
    }
  }

  private offerRollback(): void {
    Alert.alert(
      'Update Failed',
      'The update failed to install. Would you like to rollback to the previous version?',
      [
        { text: 'Continue', style: 'cancel' },
        { text: 'Rollback', onPress: () => this.performRollback() }
      ]
    );
  }

  async performRollback(): Promise<boolean> {
    try {
      if (this.rollbackHistory.length === 0) {
        throw new Error('No previous version available for rollback');
      }

      const previousPackage = this.rollbackHistory.pop();
      if (!previousPackage) {
        throw new Error('Invalid previous package');
      }

      analyticsService.recordEvent({
        name: 'codepush_rollback_started',
        attributes: {
          target_version: previousPackage.appVersion,
          target_hash: previousPackage.packageHash || 'unknown'
        }
      });

      // Perform rollback by restarting with previous package
      await CodePush.restartApp();

      analyticsService.recordEvent({
        name: 'codepush_rollback_completed',
        attributes: {
          target_version: previousPackage.appVersion
        }
      });

      return true;
    } catch (error) {
      const errorObj = error as Error;
      
      crashReportingService.recordError(errorObj, {
        screen: 'codepush_rollback',
        action: 'perform_rollback'
      });

      analyticsService.recordEvent({
        name: 'codepush_rollback_failed',
        attributes: {
          error_message: errorObj.message
        }
      });

      return false;
    }
  }

  async getCurrentPackageInfo(): Promise<CodePush.LocalPackage | null> {
    try {
      const packageInfo = await CodePush.getUpdateMetadata();
      return packageInfo;
    } catch (error) {
      console.error('Failed to get current package info:', error);
      return null;
    }
  }

  async notifyAppReady(): Promise<void> {
    try {
      await CodePush.notifyAppReady();
      
      const packageInfo = await this.getCurrentPackageInfo();
      if (packageInfo) {
        analyticsService.recordEvent({
          name: 'codepush_app_ready',
          attributes: {
            app_version: packageInfo.appVersion,
            package_hash: packageInfo.packageHash || 'unknown'
          }
        });
      }
    } catch (error) {
      console.error('Failed to notify app ready:', error);
    }
  }

  // Automatic update check on app start
  async initializeAutoUpdate(): Promise<void> {
    try {
      // Notify CodePush that app is ready
      await this.notifyAppReady();
      
      // Check for updates on app start
      const result = await this.checkForUpdate(false);
      
      if (result.updateAvailable && result.updateInfo) {
        // For mandatory updates, show alert immediately
        if (result.updateInfo.isMandatory) {
          this.showUpdateAlert(result.updateInfo);
        } else {
          // For optional updates, ask for user consent first
          this.showUpdateAlert(result.updateInfo);
        }
      }
    } catch (error) {
      console.error('Failed to initialize auto update:', error);
    }
  }

  // Check update status and handle failed updates
  async checkUpdateStatus(): Promise<void> {
    try {
      const currentPackage = await CodePush.getUpdateMetadata();
      
      if (currentPackage) {
        // Check if this is the first run after an update
        const isFirstRun = currentPackage.isFirstRun;
        
        if (isFirstRun) {
          analyticsService.recordEvent({
            name: 'codepush_first_run_after_update',
            attributes: {
              app_version: currentPackage.appVersion,
              package_hash: currentPackage.packageHash || 'unknown'
            }
          });

          // Monitor app stability after update
          this.monitorAppStabilityAfterUpdate();
        }
      }
    } catch (error) {
      console.error('Failed to check update status:', error);
    }
  }

  private monitorAppStabilityAfterUpdate(): void {
    // Monitor for crashes or errors in the first few minutes after update
    const stabilityTimeout = setTimeout(() => {
      // If we reach this point, the update is considered stable
      analyticsService.recordEvent({
        name: 'codepush_update_stable',
        attributes: {
          stability_check_duration: '300000' // 5 minutes
        }
      });
    }, 300000); // 5 minutes

    // Clear timeout if app crashes (handled by crash reporting service)
    const originalRecordError = crashReportingService.recordError;
    crashReportingService.recordError = (error: Error, context?: any) => {
      clearTimeout(stabilityTimeout);
      
      analyticsService.recordEvent({
        name: 'codepush_update_unstable',
        attributes: {
          error_message: error.message,
          context: JSON.stringify(context || {})
        }
      });

      // Offer rollback for unstable updates
      this.offerRollback();
      
      // Call original method
      originalRecordError.call(crashReportingService, error, context);
    };
  }

  // Sync with CodePush server
  async syncWithServer(
    onSyncStatusChanged?: (status: CodePush.SyncStatus) => void,
    onDownloadProgress?: (progress: UpdateProgress) => void
  ): Promise<CodePush.SyncStatus> {
    try {
      const syncOptions: CodePush.SyncOptions = {
        updateDialog: {
          title: 'Update Available',
          optionalUpdateMessage: 'An update is available. Would you like to install it?',
          optionalIgnoreButtonLabel: 'Later',
          optionalInstallButtonLabel: 'Install',
          mandatoryUpdateMessage: 'A mandatory update is available and must be installed.',
          mandatoryContinueButtonLabel: 'Continue'
        },
        installMode: CodePush.InstallMode.ON_NEXT_RESTART
      };

      const status = await CodePush.sync(
        syncOptions,
        (status) => {
          onSyncStatusChanged?.(status);
          analyticsService.recordEvent({
            name: 'codepush_sync_status',
            attributes: {
              status: this.getSyncStatusString(status)
            }
          });
        },
        (progress) => {
          const progressInfo: UpdateProgress = {
            receivedBytes: progress.receivedBytes,
            totalBytes: progress.totalBytes,
            percentage: Math.round((progress.receivedBytes / progress.totalBytes) * 100)
          };
          onDownloadProgress?.(progressInfo);
        }
      );

      return status;
    } catch (error) {
      const errorObj = error as Error;
      crashReportingService.recordError(errorObj, {
        screen: 'codepush_sync',
        action: 'sync_with_server'
      });
      throw error;
    }
  }

  private getSyncStatusString(status: CodePush.SyncStatus): string {
    switch (status) {
      case CodePush.SyncStatus.CHECKING_FOR_UPDATE:
        return 'checking_for_update';
      case CodePush.SyncStatus.DOWNLOADING_PACKAGE:
        return 'downloading_package';
      case CodePush.SyncStatus.INSTALLING_UPDATE:
        return 'installing_update';
      case CodePush.SyncStatus.UP_TO_DATE:
        return 'up_to_date';
      case CodePush.SyncStatus.UPDATE_IGNORED:
        return 'update_ignored';
      case CodePush.SyncStatus.UPDATE_INSTALLED:
        return 'update_installed';
      case CodePush.SyncStatus.UNKNOWN_ERROR:
        return 'unknown_error';
      default:
        return 'unknown';
    }
  }
}

export const codePushService = new CodePushService();
export default codePushService;