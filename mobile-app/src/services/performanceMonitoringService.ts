import perf from '@react-native-firebase/perf';
import { Platform } from 'react-native';
import { analyticsService } from './analyticsService';
import { crashReportingService } from './crashReportingService';

export interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  attributes?: Record<string, string>;
  metrics?: Record<string, number>;
}

export interface NetworkPerformanceMetric {
  url: string;
  method: string;
  startTime: number;
  endTime: number;
  responseTime: number;
  statusCode: number;
  requestSize?: number;
  responseSize?: number;
}

export interface ScreenPerformanceMetric {
  screenName: string;
  loadStartTime: number;
  loadEndTime: number;
  renderTime: number;
  interactionTime?: number;
}

class PerformanceMonitoringService {
  private activeTraces: Map<string, any> = new Map();
  private performanceMetrics: PerformanceMetric[] = new Map();
  private networkMetrics: NetworkPerformanceMetric[] = [];
  private screenMetrics: ScreenPerformanceMetric[] = [];
  private isInitialized = false;

  async initialize(): Promise<void> {
    try {
      // Initialize Firebase Performance Monitoring
      await perf().setPerformanceCollectionEnabled(true);
      this.isInitialized = true;
      
      console.log('Performance monitoring service initialized');
      
      analyticsService.recordEvent({
        name: 'performance_monitoring_initialized',
        attributes: {
          platform: Platform.OS
        }
      });
    } catch (error) {
      console.error('Failed to initialize performance monitoring:', error);
      crashReportingService.recordError(error as Error, {
        screen: 'performance_initialization',
        action: 'initialize'
      });
    }
  }

  // Generic performance trace
  startTrace(traceName: string, attributes?: Record<string, string>): string {
    const traceId = `${traceName}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    try {
      if (this.isInitialized) {
        const trace = perf().newTrace(traceName);
        
        if (attributes) {
          Object.entries(attributes).forEach(([key, value]) => {
            trace.putAttribute(key, value);
          });
        }
        
        trace.start();
        this.activeTraces.set(traceId, trace);
      }
      
      // Also track locally
      this.performanceMetrics.set(traceId, {
        name: traceName,
        startTime: Date.now(),
        attributes
      });
      
      return traceId;
    } catch (error) {
      console.error('Failed to start performance trace:', error);
      return traceId;
    }
  }

  stopTrace(traceId: string, metrics?: Record<string, number>): void {
    try {
      const trace = this.activeTraces.get(traceId);
      const localMetric = this.performanceMetrics.get(traceId);
      
      if (trace && this.isInitialized) {
        if (metrics) {
          Object.entries(metrics).forEach(([key, value]) => {
            trace.putMetric(key, value);
          });
        }
        
        trace.stop();
        this.activeTraces.delete(traceId);
      }
      
      if (localMetric) {
        const endTime = Date.now();
        const duration = endTime - localMetric.startTime;
        
        const completedMetric: PerformanceMetric = {
          ...localMetric,
          endTime,
          duration,
          metrics
        };
        
        this.performanceMetrics.set(traceId, completedMetric);
        
        // Record in analytics
        analyticsService.recordPerformanceMetric({
          name: localMetric.name,
          value: duration,
          unit: 'milliseconds',
          additionalData: {
            ...localMetric.attributes,
            ...metrics
          }
        });
        
        // Check for performance issues
        this.checkPerformanceThresholds(completedMetric);
      }
    } catch (error) {
      console.error('Failed to stop performance trace:', error);
    }
  }

  // App launch performance
  recordAppLaunch(launchTime: number): void {
    try {
      if (this.isInitialized) {
        const trace = perf().newTrace('app_launch');
        trace.putMetric('launch_time_ms', launchTime);
        trace.putAttribute('platform', Platform.OS);
        trace.start();
        trace.stop();
      }
      
      analyticsService.recordAppLaunch(launchTime);
      
      // Check if launch time is acceptable
      if (launchTime > 3000) { // 3 seconds threshold
        crashReportingService.recordPerformanceIssue('slow_app_launch', launchTime, {
          platform: Platform.OS
        });
      }
    } catch (error) {
      console.error('Failed to record app launch performance:', error);
    }
  }

  // Screen performance tracking
  startScreenLoad(screenName: string): string {
    const traceId = this.startTrace('screen_load', {
      screen_name: screenName,
      platform: Platform.OS
    });
    
    return traceId;
  }

  recordScreenLoad(screenName: string, loadTime: number, renderTime: number): void {
    try {
      const metric: ScreenPerformanceMetric = {
        screenName,
        loadStartTime: Date.now() - loadTime,
        loadEndTime: Date.now(),
        renderTime
      };
      
      this.screenMetrics.push(metric);
      
      if (this.isInitialized) {
        const trace = perf().newTrace('screen_render');
        trace.putAttribute('screen_name', screenName);
        trace.putMetric('load_time_ms', loadTime);
        trace.putMetric('render_time_ms', renderTime);
        trace.start();
        trace.stop();
      }
      
      analyticsService.recordEvent({
        name: 'screen_performance',
        attributes: {
          screen_name: screenName
        },
        metrics: {
          load_time_ms: loadTime,
          render_time_ms: renderTime
        }
      });
      
      // Check for slow screen loads
      if (loadTime > 2000) { // 2 seconds threshold
        crashReportingService.recordPerformanceIssue('slow_screen_load', loadTime, {
          screen_name: screenName,
          render_time: renderTime
        });
      }
    } catch (error) {
      console.error('Failed to record screen performance:', error);
    }
  }

  // Network request performance
  startNetworkTrace(url: string, method: string): string {
    const traceId = `network_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    try {
      if (this.isInitialized) {
        const trace = perf().newHttpTrace(url, method.toUpperCase() as any);
        trace.start();
        this.activeTraces.set(traceId, trace);
      }
      
      return traceId;
    } catch (error) {
      console.error('Failed to start network trace:', error);
      return traceId;
    }
  }

  stopNetworkTrace(
    traceId: string,
    url: string,
    method: string,
    statusCode: number,
    requestSize?: number,
    responseSize?: number
  ): void {
    try {
      const trace = this.activeTraces.get(traceId);
      
      if (trace && this.isInitialized) {
        trace.setHttpResponseCode(statusCode);
        if (requestSize) trace.setRequestPayloadSize(requestSize);
        if (responseSize) trace.setResponsePayloadSize(responseSize);
        trace.stop();
        this.activeTraces.delete(traceId);
      }
      
      const metric: NetworkPerformanceMetric = {
        url,
        method,
        startTime: Date.now(), // This should be stored from start
        endTime: Date.now(),
        responseTime: 0, // This should be calculated
        statusCode,
        requestSize,
        responseSize
      };
      
      this.networkMetrics.push(metric);
      
      analyticsService.recordEvent({
        name: 'network_request_performance',
        attributes: {
          url: new URL(url).pathname,
          method,
          status_code: statusCode.toString()
        },
        metrics: {
          response_time_ms: metric.responseTime,
          request_size_bytes: requestSize || 0,
          response_size_bytes: responseSize || 0
        }
      });
      
      // Check for slow network requests
      if (metric.responseTime > 5000) { // 5 seconds threshold
        crashReportingService.recordPerformanceIssue('slow_network_request', metric.responseTime, {
          url: new URL(url).pathname,
          method,
          status_code: statusCode
        });
      }
    } catch (error) {
      console.error('Failed to stop network trace:', error);
    }
  }

  // Recommendation generation performance
  recordRecommendationGeneration(duration: number, count: number, emotionalContext?: string): void {
    try {
      if (this.isInitialized) {
        const trace = perf().newTrace('recommendation_generation');
        trace.putMetric('generation_time_ms', duration);
        trace.putMetric('recommendation_count', count);
        if (emotionalContext) {
          trace.putAttribute('emotional_context', emotionalContext);
        }
        trace.start();
        trace.stop();
      }
      
      analyticsService.recordRecommendationGeneration(duration, count, emotionalContext);
      
      // Check for slow recommendation generation
      if (duration > 3000) { // 3 seconds threshold
        crashReportingService.recordPerformanceIssue('slow_recommendation_generation', duration, {
          recommendation_count: count,
          emotional_context: emotionalContext || 'none'
        });
      }
    } catch (error) {
      console.error('Failed to record recommendation generation performance:', error);
    }
  }

  // Memory usage monitoring
  recordMemoryUsage(usageInMB: number, context?: string): void {
    try {
      analyticsService.recordEvent({
        name: 'memory_usage',
        attributes: {
          context: context || 'general',
          platform: Platform.OS
        },
        metrics: {
          memory_usage_mb: usageInMB
        }
      });
      
      // Check for high memory usage
      if (usageInMB > 200) { // 200MB threshold
        crashReportingService.recordPerformanceIssue('high_memory_usage', usageInMB, {
          context: context || 'general'
        });
      }
    } catch (error) {
      console.error('Failed to record memory usage:', error);
    }
  }

  // Frame rate monitoring
  recordFrameRate(fps: number, screenName?: string): void {
    try {
      analyticsService.recordEvent({
        name: 'frame_rate',
        attributes: {
          screen_name: screenName || 'unknown',
          platform: Platform.OS
        },
        metrics: {
          fps: fps
        }
      });
      
      // Check for low frame rate
      if (fps < 30) { // 30 FPS threshold
        crashReportingService.recordPerformanceIssue('low_frame_rate', fps, {
          screen_name: screenName || 'unknown'
        });
      }
    } catch (error) {
      console.error('Failed to record frame rate:', error);
    }
  }

  private checkPerformanceThresholds(metric: PerformanceMetric): void {
    if (!metric.duration) return;
    
    const thresholds: Record<string, number> = {
      'screen_load': 2000,
      'recommendation_generation': 3000,
      'api_request': 5000,
      'image_load': 3000,
      'search_query': 1000
    };
    
    const threshold = thresholds[metric.name];
    if (threshold && metric.duration > threshold) {
      crashReportingService.recordPerformanceIssue(
        `slow_${metric.name}`,
        metric.duration,
        metric.attributes
      );
    }
  }

  // Get performance summary
  getPerformanceSummary(): {
    averageScreenLoadTime: number;
    averageNetworkResponseTime: number;
    totalPerformanceIssues: number;
    recentMetrics: PerformanceMetric[];
  } {
    const recentMetrics = Array.from(this.performanceMetrics.values())
      .filter(m => m.endTime && (Date.now() - m.endTime) < 300000) // Last 5 minutes
      .slice(-20); // Last 20 metrics
    
    const screenLoadTimes = this.screenMetrics
      .filter(m => (Date.now() - m.loadEndTime) < 300000)
      .map(m => m.loadEndTime - m.loadStartTime);
    
    const networkResponseTimes = this.networkMetrics
      .filter(m => (Date.now() - m.endTime) < 300000)
      .map(m => m.responseTime);
    
    return {
      averageScreenLoadTime: screenLoadTimes.length > 0 
        ? screenLoadTimes.reduce((a, b) => a + b, 0) / screenLoadTimes.length 
        : 0,
      averageNetworkResponseTime: networkResponseTimes.length > 0
        ? networkResponseTimes.reduce((a, b) => a + b, 0) / networkResponseTimes.length
        : 0,
      totalPerformanceIssues: recentMetrics.filter(m => 
        m.duration && m.duration > 2000
      ).length,
      recentMetrics
    };
  }

  // Clean up old metrics
  cleanup(): void {
    const cutoffTime = Date.now() - 3600000; // 1 hour ago
    
    // Clean up old metrics
    for (const [key, metric] of this.performanceMetrics.entries()) {
      if (metric.endTime && metric.endTime < cutoffTime) {
        this.performanceMetrics.delete(key);
      }
    }
    
    // Clean up old network metrics
    this.networkMetrics = this.networkMetrics.filter(m => m.endTime > cutoffTime);
    
    // Clean up old screen metrics
    this.screenMetrics = this.screenMetrics.filter(m => m.loadEndTime > cutoffTime);
  }
}

export const performanceMonitoringService = new PerformanceMonitoringService();
export default performanceMonitoringService;