import crashlytics from '@react-native-firebase/crashlytics';
import { analyticsService } from './analyticsService';

export interface CrashContext {
  userId?: string;
  screen?: string;
  action?: string;
  additionalData?: Record<string, any>;
}

class CrashReportingService {
  private isInitialized = false;

  async initialize(): Promise<void> {
    try {
      // Check if crashlytics is available
      await crashlytics().checkForUnsentReports();
      this.isInitialized = true;
      console.log('Crash reporting service initialized');
    } catch (error) {
      console.error('Failed to initialize crash reporting:', error);
    }
  }

  setUserId(userId: string): void {
    if (!this.isInitialized) return;
    
    try {
      crashlytics().setUserId(userId);
      console.log('Crash reporting user ID set:', userId);
    } catch (error) {
      console.error('Failed to set crash reporting user ID:', error);
    }
  }

  setUserAttributes(attributes: Record<string, string>): void {
    if (!this.isInitialized) return;
    
    try {
      Object.entries(attributes).forEach(([key, value]) => {
        crashlytics().setAttribute(key, value);
      });
      console.log('Crash reporting user attributes set');
    } catch (error) {
      console.error('Failed to set crash reporting attributes:', error);
    }
  }

  recordError(error: Error, context?: CrashContext): void {
    if (!this.isInitialized) {
      console.error('Crash reporting not initialized, logging error locally:', error);
      return;
    }

    try {
      // Set context attributes
      if (context) {
        if (context.userId) {
          crashlytics().setUserId(context.userId);
        }
        if (context.screen) {
          crashlytics().setAttribute('current_screen', context.screen);
        }
        if (context.action) {
          crashlytics().setAttribute('last_action', context.action);
        }
        if (context.additionalData) {
          Object.entries(context.additionalData).forEach(([key, value]) => {
            crashlytics().setAttribute(key, String(value));
          });
        }
      }

      // Record the error
      crashlytics().recordError(error);
      
      // Also record in analytics for additional tracking
      analyticsService.recordError(error, context?.screen);
      
      console.log('Error recorded in crash reporting:', error.message);
    } catch (reportingError) {
      console.error('Failed to record error in crash reporting:', reportingError);
    }
  }

  log(message: string): void {
    if (!this.isInitialized) return;
    
    try {
      crashlytics().log(message);
    } catch (error) {
      console.error('Failed to log message to crash reporting:', error);
    }
  }

  crash(): void {
    if (!this.isInitialized) return;
    
    // Only use for testing - this will crash the app
    crashlytics().crash();
  }

  // Custom error boundary integration
  recordJSException(error: Error, isFatal: boolean = false): void {
    if (!this.isInitialized) return;
    
    try {
      if (isFatal) {
        crashlytics().recordError(error);
      } else {
        crashlytics().log(`Non-fatal JS error: ${error.message}`);
        crashlytics().recordError(error);
      }
    } catch (reportingError) {
      console.error('Failed to record JS exception:', reportingError);
    }
  }

  // Performance monitoring integration
  recordPerformanceIssue(issue: string, duration: number, additionalData?: Record<string, any>): void {
    if (!this.isInitialized) return;
    
    try {
      crashlytics().setAttribute('performance_issue', issue);
      crashlytics().setAttribute('duration_ms', duration.toString());
      
      if (additionalData) {
        Object.entries(additionalData).forEach(([key, value]) => {
          crashlytics().setAttribute(`perf_${key}`, String(value));
        });
      }
      
      const performanceError = new Error(`Performance issue: ${issue} took ${duration}ms`);
      crashlytics().recordError(performanceError);
      
    } catch (error) {
      console.error('Failed to record performance issue:', error);
    }
  }

  // Network error tracking
  recordNetworkError(url: string, method: string, statusCode: number, error: Error): void {
    if (!this.isInitialized) return;
    
    try {
      crashlytics().setAttribute('network_url', url);
      crashlytics().setAttribute('network_method', method);
      crashlytics().setAttribute('network_status', statusCode.toString());
      
      const networkError = new Error(`Network error: ${method} ${url} - ${statusCode} - ${error.message}`);
      crashlytics().recordError(networkError);
      
    } catch (reportingError) {
      console.error('Failed to record network error:', reportingError);
    }
  }

  // Recommendation system error tracking
  recordRecommendationError(error: Error, context: {
    userId?: string;
    emotionalState?: string;
    preferences?: Record<string, any>;
  }): void {
    if (!this.isInitialized) return;
    
    try {
      if (context.userId) {
        crashlytics().setUserId(context.userId);
      }
      if (context.emotionalState) {
        crashlytics().setAttribute('emotional_state', context.emotionalState);
      }
      if (context.preferences) {
        crashlytics().setAttribute('user_preferences', JSON.stringify(context.preferences));
      }
      
      crashlytics().setAttribute('error_type', 'recommendation_system');
      crashlytics().recordError(error);
      
    } catch (reportingError) {
      console.error('Failed to record recommendation error:', reportingError);
    }
  }
}

export const crashReportingService = new CrashReportingService();
export default crashReportingService;