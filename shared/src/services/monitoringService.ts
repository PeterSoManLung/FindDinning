import AWS from 'aws-sdk';
import { MetricsLogger, createLogger } from '../utils/logger';

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  error?: string;
  details?: any;
}

export interface SystemHealth {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  checks: HealthCheck[];
  uptime: number;
}

export class MonitoringService {
  private metricsLogger: MetricsLogger;
  private logger: any;
  private serviceName: string;
  private startTime: number;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.metricsLogger = new MetricsLogger();
    this.logger = createLogger(serviceName);
    this.startTime = Date.now();
  }

  // Health check methods
  async performHealthCheck(): Promise<SystemHealth> {
    const checks: HealthCheck[] = [];
    
    // Database health check
    const dbCheck = await this.checkDatabase();
    checks.push(dbCheck);

    // External services health check
    const externalCheck = await this.checkExternalServices();
    checks.push(externalCheck);

    // Memory and CPU check
    const resourceCheck = await this.checkResources();
    checks.push(resourceCheck);

    // Cache health check
    const cacheCheck = await this.checkCache();
    checks.push(cacheCheck);

    // Determine overall health
    const unhealthyChecks = checks.filter(check => check.status === 'unhealthy');
    const degradedChecks = checks.filter(check => check.status === 'degraded');
    
    let overall: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (unhealthyChecks.length > 0) {
      overall = 'unhealthy';
    } else if (degradedChecks.length > 0) {
      overall = 'degraded';
    }

    const health: SystemHealth = {
      overall,
      timestamp: new Date().toISOString(),
      checks,
      uptime: Date.now() - this.startTime
    };

    // Log health metrics
    await this.metricsLogger.putMetric('HealthCheckStatus', overall === 'healthy' ? 1 : 0, 'None', [
      { Name: 'Service', Value: this.serviceName }
    ]);

    return health;
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();
    try {
      // This would be implemented per service based on their database type
      // For now, we'll simulate a database check
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const responseTime = Date.now() - startTime;
      return {
        name: 'database',
        status: responseTime < 100 ? 'healthy' : 'degraded',
        responseTime
      };
    } catch (error: any) {
      return {
        name: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  private async checkExternalServices(): Promise<HealthCheck> {
    const startTime = Date.now();
    try {
      // Check external API connectivity
      // This would be implemented per service based on their external dependencies
      await new Promise(resolve => setTimeout(resolve, 20));
      
      const responseTime = Date.now() - startTime;
      return {
        name: 'external_services',
        status: responseTime < 200 ? 'healthy' : 'degraded',
        responseTime
      };
    } catch (error: any) {
      return {
        name: 'external_services',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  private async checkResources(): Promise<HealthCheck> {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Calculate memory usage percentage (assuming 512MB container limit)
      const memoryLimitBytes = 512 * 1024 * 1024;
      const memoryUsagePercent = (memUsage.heapUsed / memoryLimitBytes) * 100;
      
      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
      if (memoryUsagePercent > 90) {
        status = 'unhealthy';
      } else if (memoryUsagePercent > 75) {
        status = 'degraded';
      }

      return {
        name: 'resources',
        status,
        details: {
          memoryUsagePercent: Math.round(memoryUsagePercent),
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024)
        }
      };
    } catch (error: any) {
      return {
        name: 'resources',
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  private async checkCache(): Promise<HealthCheck> {
    const startTime = Date.now();
    try {
      // This would check Redis connectivity
      // For now, we'll simulate a cache check
      await new Promise(resolve => setTimeout(resolve, 5));
      
      const responseTime = Date.now() - startTime;
      return {
        name: 'cache',
        status: responseTime < 50 ? 'healthy' : 'degraded',
        responseTime
      };
    } catch (error: any) {
      return {
        name: 'cache',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  // Business metrics tracking
  async trackRecommendationAccuracy(accuracy: number, modelVersion?: string) {
    await this.metricsLogger.putRecommendationAccuracy(accuracy, this.serviceName);
    
    if (modelVersion) {
      await this.metricsLogger.putMetric('ModelAccuracy', accuracy, 'None', [
        { Name: 'Service', Value: this.serviceName },
        { Name: 'ModelVersion', Value: modelVersion }
      ]);
    }

    this.logger.info('Recommendation accuracy tracked', {
      accuracy,
      modelVersion,
      service: this.serviceName
    });
  }

  async trackNegativeFeedbackAnalysis(accuracy: number, processingTime: number) {
    await this.metricsLogger.putNegativeFeedbackAnalysisAccuracy(accuracy, this.serviceName);
    await this.metricsLogger.putMetric('NegativeFeedbackProcessingTime', processingTime, 'Milliseconds', [
      { Name: 'Service', Value: this.serviceName }
    ]);

    this.logger.info('Negative feedback analysis tracked', {
      accuracy,
      processingTime,
      service: this.serviceName
    });
  }

  async trackUserEngagement(engagementMetrics: {
    sessionDuration: number;
    recommendationClickRate: number;
    userRetentionRate: number;
  }) {
    await this.metricsLogger.putUserEngagement(engagementMetrics.recommendationClickRate, this.serviceName);
    
    await this.metricsLogger.putMetric('SessionDuration', engagementMetrics.sessionDuration, 'Seconds', [
      { Name: 'Service', Value: this.serviceName }
    ]);

    await this.metricsLogger.putMetric('UserRetentionRate', engagementMetrics.userRetentionRate, 'None', [
      { Name: 'Service', Value: this.serviceName }
    ]);

    this.logger.info('User engagement tracked', {
      ...engagementMetrics,
      service: this.serviceName
    });
  }

  async trackDataSyncOperation(operation: 'success' | 'failure', source: string, recordsProcessed?: number) {
    if (operation === 'success') {
      await this.metricsLogger.putDataSyncSuccess(this.serviceName);
      if (recordsProcessed) {
        await this.metricsLogger.putMetric('DataSyncRecordsProcessed', recordsProcessed, 'Count', [
          { Name: 'Service', Value: this.serviceName },
          { Name: 'Source', Value: source }
        ]);
      }
    } else {
      await this.metricsLogger.putDataSyncFailure(this.serviceName);
    }

    this.logger.info('Data sync operation tracked', {
      operation,
      source,
      recordsProcessed,
      service: this.serviceName
    });
  }

  async trackApiPerformance(endpoint: string, responseTime: number, statusCode: number) {
    await this.metricsLogger.putResponseTime(responseTime, endpoint, this.serviceName);
    
    if (statusCode >= 400) {
      await this.metricsLogger.putErrorCount(`HTTP_${statusCode}`, this.serviceName);
    }

    // Track API success rate
    await this.metricsLogger.putMetric('ApiRequests', 1, 'Count', [
      { Name: 'Service', Value: this.serviceName },
      { Name: 'Endpoint', Value: endpoint },
      { Name: 'StatusCode', Value: statusCode.toString() }
    ]);

    this.logger.info('API performance tracked', {
      endpoint,
      responseTime,
      statusCode,
      service: this.serviceName
    });
  }

  // Alert methods
  async sendAlert(severity: 'low' | 'medium' | 'high' | 'critical', message: string, details?: any) {
    const sns = new AWS.SNS({ region: process.env.AWS_REGION || 'ap-southeast-1' });
    
    const alertMessage = {
      service: this.serviceName,
      severity,
      message,
      timestamp: new Date().toISOString(),
      details
    };

    try {
      await sns.publish({
        TopicArn: process.env.ALERT_TOPIC_ARN || 'arn:aws:sns:ap-southeast-1:123456789012:ai-restaurant-recommendation-alerts',
        Message: JSON.stringify(alertMessage),
        Subject: `[${severity.toUpperCase()}] ${this.serviceName}: ${message}`
      }).promise();

      this.logger.warn('Alert sent', alertMessage);
    } catch (error) {
      this.logger.error('Failed to send alert', { error: error.message, alertMessage });
    }
  }

  // Performance monitoring
  async monitorPerformance<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    const operationId = Math.random().toString(36).substring(2, 11);

    this.logger.info('Operation started', { operation, operationId });

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      await this.metricsLogger.putMetric('OperationDuration', duration, 'Milliseconds', [
        { Name: 'Service', Value: this.serviceName },
        { Name: 'Operation', Value: operation }
      ]);

      this.logger.info('Operation completed', { operation, operationId, duration });
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      await this.metricsLogger.putErrorCount(`${operation}_Error`, this.serviceName);
      
      this.logger.error('Operation failed', { 
        operation, 
        operationId, 
        duration, 
        error: error.message 
      });

      throw error;
    }
  }
}

export default MonitoringService;