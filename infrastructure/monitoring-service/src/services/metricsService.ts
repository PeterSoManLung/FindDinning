import AWS from 'aws-sdk';
import { createLogger } from '../utils/logger';

export interface MetricData {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  dimensions: { [key: string]: string };
}

export interface DashboardData {
  systemHealth: {
    overall: string;
    services: any[];
  };
  businessMetrics: {
    recommendationAccuracy: number;
    userEngagement: number;
    negativeFeedbackAnalysis: number;
    dataSyncSuccess: number;
  };
  performanceMetrics: {
    averageResponseTime: number;
    errorRate: number;
    throughput: number;
  };
  timestamp: string;
}

export class MetricsService {
  private cloudWatch: AWS.CloudWatch;
  private sns: AWS.SNS;
  private logger: any;
  private namespace: string;

  constructor() {
    this.cloudWatch = new AWS.CloudWatch({
      region: process.env.AWS_REGION || 'ap-southeast-1'
    });
    this.sns = new AWS.SNS({
      region: process.env.AWS_REGION || 'ap-southeast-1'
    });
    this.logger = createLogger('metrics-service');
    this.namespace = 'AI-Restaurant-Recommendation';
  }

  async getAllMetrics(): Promise<MetricData[]> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

      const metricNames = [
        'RecommendationAccuracy',
        'NegativeFeedbackAnalysisAccuracy',
        'UserEngagement',
        'DataSyncSuccess',
        'ResponseTime',
        'ErrorCount'
      ];

      const metrics: MetricData[] = [];

      for (const metricName of metricNames) {
        try {
          const params: AWS.CloudWatch.GetMetricStatisticsRequest = {
            Namespace: this.namespace,
            MetricName: metricName,
            StartTime: startTime,
            EndTime: endTime,
            Period: 3600, // 1 hour
            Statistics: ['Average', 'Sum', 'Maximum']
          };

          const result = await this.cloudWatch.getMetricStatistics(params).promise();
          
          if (result.Datapoints && result.Datapoints.length > 0) {
            const latestDatapoint = result.Datapoints.sort((a, b) => 
              new Date(b.Timestamp!).getTime() - new Date(a.Timestamp!).getTime()
            )[0];

            metrics.push({
              name: metricName,
              value: latestDatapoint.Average || latestDatapoint.Sum || latestDatapoint.Maximum || 0,
              unit: result.Datapoints[0].Unit || 'None',
              timestamp: latestDatapoint.Timestamp!.toISOString(),
              dimensions: {}
            });
          }
        } catch (error: any) {
          this.logger.warn(`Failed to get metric ${metricName}:`, error.message);
        }
      }

      return metrics;
    } catch (error: any) {
      this.logger.error('Failed to get all metrics:', error);
      throw error;
    }
  }

  async getDashboardData(): Promise<DashboardData> {
    try {
      const metrics = await this.getAllMetrics();
      
      const getMetricValue = (name: string): number => {
        const metric = metrics.find(m => m.name === name);
        return metric ? metric.value : 0;
      };

      return {
        systemHealth: {
          overall: 'healthy', // This would be determined by health checks
          services: []
        },
        businessMetrics: {
          recommendationAccuracy: getMetricValue('RecommendationAccuracy'),
          userEngagement: getMetricValue('UserEngagement'),
          negativeFeedbackAnalysis: getMetricValue('NegativeFeedbackAnalysisAccuracy'),
          dataSyncSuccess: getMetricValue('DataSyncSuccess')
        },
        performanceMetrics: {
          averageResponseTime: getMetricValue('ResponseTime'),
          errorRate: getMetricValue('ErrorCount'),
          throughput: 0 // Would be calculated from request metrics
        },
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      this.logger.error('Failed to get dashboard data:', error);
      throw error;
    }
  }

  async getRecommendationAccuracyMetrics(): Promise<any> {
    return this.getMetricHistory('RecommendationAccuracy', 'recommendation-engine');
  }

  async getNegativeFeedbackAnalysisMetrics(): Promise<any> {
    return this.getMetricHistory('NegativeFeedbackAnalysisAccuracy', 'review-service');
  }

  async getUserEngagementMetrics(): Promise<any> {
    return this.getMetricHistory('UserEngagement', 'mobile-app');
  }

  async getDataSyncMetrics(): Promise<any> {
    return this.getMetricHistory('DataSyncSuccess', 'data-integration-service');
  }

  private async getMetricHistory(metricName: string, serviceName: string): Promise<any> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

      const params: AWS.CloudWatch.GetMetricStatisticsRequest = {
        Namespace: this.namespace,
        MetricName: metricName,
        StartTime: startTime,
        EndTime: endTime,
        Period: 3600, // 1 hour
        Statistics: ['Average', 'Maximum', 'Minimum'],
        Dimensions: [
          {
            Name: 'Service',
            Value: serviceName
          }
        ]
      };

      const result = await this.cloudWatch.getMetricStatistics(params).promise();
      
      return {
        metricName,
        serviceName,
        datapoints: result.Datapoints?.map(dp => ({
          timestamp: dp.Timestamp,
          average: dp.Average,
          maximum: dp.Maximum,
          minimum: dp.Minimum
        })).sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime()) || []
      };
    } catch (error: any) {
      this.logger.error(`Failed to get metric history for ${metricName}:`, error);
      throw error;
    }
  }

  async putCustomMetric(metricName: string, value: number, unit: string = 'Count', dimensions: AWS.CloudWatch.Dimension[] = []): Promise<void> {
    try {
      const params: AWS.CloudWatch.PutMetricDataRequest = {
        Namespace: this.namespace,
        MetricData: [{
          MetricName: metricName,
          Value: value,
          Unit: unit as AWS.CloudWatch.StandardUnit,
          Dimensions: dimensions,
          Timestamp: new Date()
        }]
      };

      await this.cloudWatch.putMetricData(params).promise();
      this.logger.debug(`Put metric: ${metricName} = ${value}`);
    } catch (error: any) {
      this.logger.error(`Failed to put metric ${metricName}:`, error);
      throw error;
    }
  }

  async sendAlert(severity: 'low' | 'medium' | 'high' | 'critical', message: string, details?: any): Promise<void> {
    try {
      const alertMessage = {
        severity,
        message,
        timestamp: new Date().toISOString(),
        service: 'monitoring-service',
        details
      };

      const params: AWS.SNS.PublishRequest = {
        TopicArn: process.env.ALERT_TOPIC_ARN || 'arn:aws:sns:ap-southeast-1:123456789012:ai-restaurant-recommendation-alerts',
        Message: JSON.stringify(alertMessage, null, 2),
        Subject: `[${severity.toUpperCase()}] AI Restaurant Recommendation Alert: ${message}`
      };

      await this.sns.publish(params).promise();
      this.logger.info('Alert sent:', { severity, message });
    } catch (error: any) {
      this.logger.error('Failed to send alert:', error);
      throw error;
    }
  }

  async sendTestAlert(severity: string, message: string): Promise<void> {
    await this.sendAlert(severity as any, `TEST: ${message}`, { test: true });
  }

  async collectSystemMetrics(): Promise<void> {
    try {
      // Collect system-wide metrics
      const timestamp = new Date();
      
      // Put system uptime metric
      const uptime = process.uptime();
      await this.putCustomMetric('SystemUptime', uptime, 'Seconds', [
        { Name: 'Service', Value: 'monitoring-service' }
      ]);

      // Put memory usage metric
      const memUsage = process.memoryUsage();
      const memoryUsageMB = memUsage.heapUsed / 1024 / 1024;
      await this.putCustomMetric('MemoryUsage', memoryUsageMB, 'None', [
        { Name: 'Service', Value: 'monitoring-service' }
      ]);

      // Put active connections metric (if available)
      // This would be implemented based on actual connection tracking

      this.logger.info('System metrics collected successfully');
    } catch (error: any) {
      this.logger.error('Failed to collect system metrics:', error);
      throw error;
    }
  }

  async createCustomAlarm(alarmName: string, metricName: string, threshold: number, comparisonOperator: string): Promise<void> {
    try {
      const params: AWS.CloudWatch.PutMetricAlarmRequest = {
        AlarmName: alarmName,
        AlarmDescription: `Custom alarm for ${metricName}`,
        MetricName: metricName,
        Namespace: this.namespace,
        Statistic: 'Average',
        Period: 300,
        EvaluationPeriods: 2,
        Threshold: threshold,
        ComparisonOperator: comparisonOperator as AWS.CloudWatch.ComparisonOperator,
        AlarmActions: [
          process.env.ALERT_TOPIC_ARN || 'arn:aws:sns:ap-southeast-1:123456789012:ai-restaurant-recommendation-alerts'
        ]
      };

      await this.cloudWatch.putMetricAlarm(params).promise();
      this.logger.info(`Created custom alarm: ${alarmName}`);
    } catch (error: any) {
      this.logger.error(`Failed to create custom alarm ${alarmName}:`, error);
      throw error;
    }
  }
}