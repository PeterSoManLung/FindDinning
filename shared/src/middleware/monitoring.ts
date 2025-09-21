import { Request, Response, NextFunction } from 'express';
import { MetricsLogger, TracingUtil } from '../utils/logger';
import AWSXRay from 'aws-xray-sdk-core';

interface MonitoringRequest extends Request {
  startTime?: number;
  traceId?: string;
  requestId?: string;
}

export class MonitoringMiddleware {
  private metricsLogger: MetricsLogger;
  private serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.metricsLogger = new MetricsLogger();
  }

  // Request timing and tracing middleware
  requestMonitoring() {
    return (req: MonitoringRequest, res: Response, next: NextFunction) => {
      req.startTime = Date.now();
      req.traceId = TracingUtil.getTraceId();
      req.requestId = Math.random().toString(36).substring(2, 11);

      // Add X-Ray tracing
      const segment = AWSXRay.getSegment();
      if (segment) {
        segment.addAnnotation('service', this.serviceName);
        segment.addAnnotation('endpoint', req.path);
        segment.addAnnotation('method', req.method);
        segment.addMetadata('request', {
          headers: req.headers,
          query: req.query,
          params: req.params
        });
      }

      // Override res.end to capture response metrics
      const originalEnd = res.end;
      res.end = function(chunk?: any, encoding?: any) {
        const responseTime = Date.now() - (req.startTime || Date.now());
        
        // Log response metrics
        this.metricsLogger.putResponseTime(responseTime, req.path, this.serviceName);
        
        if (res.statusCode >= 400) {
          this.metricsLogger.putErrorCount(`HTTP_${res.statusCode}`, this.serviceName);
        }

        // Add response metadata to X-Ray
        if (segment) {
          segment.addMetadata('response', {
            statusCode: res.statusCode,
            responseTime: responseTime
          });
        }

        originalEnd.call(res, chunk, encoding);
      }.bind(this);

      next();
    };
  }

  // Error monitoring middleware
  errorMonitoring() {
    return (error: Error, req: MonitoringRequest, res: Response, next: NextFunction) => {
      // Log error metrics
      this.metricsLogger.putErrorCount(error.name || 'UnknownError', this.serviceName);

      // Add error to X-Ray trace
      const segment = AWSXRay.getSegment();
      if (segment) {
        segment.addError(error);
      }

      next(error);
    };
  }

  // Health check monitoring
  healthCheckMonitoring() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const healthStatus = await this.performHealthCheck();
        
        // Put health metrics
        await this.metricsLogger.putMetric('HealthCheckStatus', healthStatus.healthy ? 1 : 0, 'None', [
          { Name: 'Service', Value: this.serviceName }
        ]);

        res.json(healthStatus);
      } catch (error) {
        await this.metricsLogger.putErrorCount('HealthCheckError', this.serviceName);
        next(error);
      }
    };
  }

  private async performHealthCheck(): Promise<{ healthy: boolean; checks: any[] }> {
    const checks = [];
    let healthy = true;

    // Database connectivity check
    try {
      // This would be implemented per service based on their database connections
      checks.push({ name: 'database', status: 'healthy' });
    } catch (error) {
      checks.push({ name: 'database', status: 'unhealthy', error: error.message });
      healthy = false;
    }

    // External service connectivity check
    try {
      // This would check external APIs, Redis, etc.
      checks.push({ name: 'external_services', status: 'healthy' });
    } catch (error) {
      checks.push({ name: 'external_services', status: 'unhealthy', error: error.message });
      healthy = false;
    }

    return { healthy, checks };
  }
}

// Business metrics middleware for specific services
export class BusinessMetricsMiddleware {
  private metricsLogger: MetricsLogger;

  constructor() {
    this.metricsLogger = new MetricsLogger();
  }

  // Recommendation engine specific metrics
  recommendationMetrics() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send;
      
      res.send = function(data: any) {
        if (req.path.includes('/recommendations') && res.statusCode === 200) {
          // Track recommendation generation
          this.metricsLogger.putMetric('RecommendationsGenerated', 1, 'Count', [
            { Name: 'Service', Value: 'recommendation-engine' }
          ]);

          // Track recommendation quality if available in response
          if (data && data.confidence) {
            this.metricsLogger.putRecommendationAccuracy(data.confidence, 'recommendation-engine');
          }
        }
        
        return originalSend.call(res, data);
      }.bind(this);

      next();
    };
  }

  // Review service specific metrics
  reviewAnalysisMetrics() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send;
      
      res.send = function(data: any) {
        if (req.path.includes('/reviews/analyze-negative') && res.statusCode === 200) {
          // Track negative feedback analysis
          this.metricsLogger.putMetric('NegativeFeedbackAnalyzed', 1, 'Count', [
            { Name: 'Service', Value: 'review-service' }
          ]);

          // Track analysis accuracy if available
          if (data && data.authenticityScore) {
            this.metricsLogger.putNegativeFeedbackAnalysisAccuracy(data.authenticityScore, 'review-service');
          }
        }
        
        return originalSend.call(res, data);
      }.bind(this);

      next();
    };
  }

  // Data integration metrics
  dataSyncMetrics() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send;
      
      res.send = function(data: any) {
        if (req.path.includes('/data/sync')) {
          if (res.statusCode === 200) {
            this.metricsLogger.putDataSyncSuccess('data-integration-service');
          } else {
            this.metricsLogger.putDataSyncFailure('data-integration-service');
          }

          // Track data quality metrics
          if (data && data.dataQualityScore) {
            this.metricsLogger.putMetric('DataQualityScore', data.dataQualityScore, 'None', [
              { Name: 'Service', Value: 'data-integration-service' }
            ]);
          }
        }
        
        return originalSend.call(res, data);
      }.bind(this);

      next();
    };
  }

  // User engagement metrics
  userEngagementMetrics() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send;
      
      res.send = function(data: any) {
        // Track user actions
        if (req.path.includes('/users/') && req.method === 'POST') {
          this.metricsLogger.putMetric('UserActions', 1, 'Count', [
            { Name: 'Service', Value: 'user-service' },
            { Name: 'Action', Value: req.path.split('/').pop() || 'unknown' }
          ]);
        }

        // Track recommendation interactions
        if (req.path.includes('/recommendations/feedback')) {
          this.metricsLogger.putMetric('RecommendationInteractions', 1, 'Count', [
            { Name: 'Service', Value: 'recommendation-engine' }
          ]);
        }
        
        return originalSend.call(res, data);
      }.bind(this);

      next();
    };
  }
}

export default MonitoringMiddleware;