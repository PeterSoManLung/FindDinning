import winston from 'winston';
import AWS from 'aws-sdk';

// Configure AWS CloudWatch Logs
const cloudWatchLogs = new AWS.CloudWatchLogs({
  region: process.env.AWS_REGION || 'ap-southeast-1'
});

// Custom CloudWatch transport
class CloudWatchTransport extends winston.Transport {
  private logGroupName: string;
  private logStreamName: string;
  private sequenceToken?: string;

  constructor(options: { logGroupName: string; logStreamName: string }) {
    super();
    this.logGroupName = options.logGroupName;
    this.logStreamName = options.logStreamName;
    this.initializeLogStream();
  }

  private async initializeLogStream() {
    try {
      await cloudWatchLogs.createLogStream({
        logGroupName: this.logGroupName,
        logStreamName: this.logStreamName
      }).promise();
    } catch (error: any) {
      if (error.code !== 'ResourceAlreadyExistsException') {
        console.error('Failed to create log stream:', error);
      }
    }
  }

  async log(info: any, callback: () => void) {
    const logEvent = {
      message: JSON.stringify({
        timestamp: new Date().toISOString(),
        level: info.level,
        message: info.message,
        service: process.env.SERVICE_NAME || 'unknown',
        traceId: info.traceId,
        userId: info.userId,
        requestId: info.requestId,
        ...info.meta
      }),
      timestamp: Date.now()
    };

    try {
      const params: AWS.CloudWatchLogs.PutLogEventsRequest = {
        logGroupName: this.logGroupName,
        logStreamName: this.logStreamName,
        logEvents: [logEvent]
      };

      if (this.sequenceToken) {
        params.sequenceToken = this.sequenceToken;
      }

      const result = await cloudWatchLogs.putLogEvents(params).promise();
      this.sequenceToken = result.nextSequenceToken;
    } catch (error) {
      console.error('Failed to send log to CloudWatch:', error);
    }

    callback();
  }
}

// Create logger instance
export const createLogger = (serviceName: string) => {
  const logGroupName = `/aws/ecs/${serviceName}`;
  const logStreamName = `${serviceName}-${new Date().toISOString().split('T')[0]}-${Math.random().toString(36).substring(2, 11)}`;

  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: {
      service: serviceName,
      environment: process.env.NODE_ENV || 'development'
    },
    transports: [
      // Console transport for local development
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ]
  });

  // Add CloudWatch transport in production
  if (process.env.NODE_ENV === 'production') {
    logger.add(new CloudWatchTransport({
      logGroupName,
      logStreamName
    }));
  }

  return logger;
};

// Custom metrics utility
export class MetricsLogger {
  private cloudWatch: AWS.CloudWatch;
  private namespace: string;

  constructor(namespace: string = 'AI-Restaurant-Recommendation') {
    this.cloudWatch = new AWS.CloudWatch({
      region: process.env.AWS_REGION || 'ap-southeast-1'
    });
    this.namespace = namespace;
  }

  async putMetric(metricName: string, value: number, unit: string = 'Count', dimensions: AWS.CloudWatch.Dimension[] = []) {
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

    try {
      await this.cloudWatch.putMetricData(params).promise();
    } catch (error) {
      console.error('Failed to put metric:', error);
    }
  }

  async putRecommendationAccuracy(accuracy: number, serviceName: string) {
    await this.putMetric('RecommendationAccuracy', accuracy, 'None', [
      { Name: 'Service', Value: serviceName }
    ]);
  }

  async putNegativeFeedbackAnalysisAccuracy(accuracy: number, serviceName: string) {
    await this.putMetric('NegativeFeedbackAnalysisAccuracy', accuracy, 'None', [
      { Name: 'Service', Value: serviceName }
    ]);
  }

  async putUserEngagement(engagementRate: number, serviceName: string) {
    await this.putMetric('UserEngagement', engagementRate, 'None', [
      { Name: 'Service', Value: serviceName }
    ]);
  }

  async putDataSyncFailure(serviceName: string) {
    await this.putMetric('DataSyncFailures', 1, 'Count', [
      { Name: 'Service', Value: serviceName }
    ]);
  }

  async putDataSyncSuccess(serviceName: string) {
    await this.putMetric('DataSyncSuccess', 1, 'Count', [
      { Name: 'Service', Value: serviceName }
    ]);
  }

  async putResponseTime(responseTime: number, endpoint: string, serviceName: string) {
    await this.putMetric('ResponseTime', responseTime, 'Milliseconds', [
      { Name: 'Service', Value: serviceName },
      { Name: 'Endpoint', Value: endpoint }
    ]);
  }

  async putErrorCount(errorType: string, serviceName: string) {
    await this.putMetric('ErrorCount', 1, 'Count', [
      { Name: 'Service', Value: serviceName },
      { Name: 'ErrorType', Value: errorType }
    ]);
  }
}

// X-Ray tracing utility
export class TracingUtil {
  static getTraceId(): string | undefined {
    const traceHeader = process.env._X_AMZN_TRACE_ID;
    if (traceHeader) {
      const parts = traceHeader.split(';');
      const rootPart = parts.find(part => part.startsWith('Root='));
      return rootPart ? rootPart.substring(5) : undefined;
    }
    return undefined;
  }

  static createSubsegment(name: string, callback: (subsegment: any) => Promise<any>) {
    const AWSXRay = require('aws-xray-sdk-core');
    const subsegment = AWSXRay.getSegment()?.addNewSubsegment(name);
    
    return new Promise(async (resolve, reject) => {
      try {
        const result = await callback(subsegment);
        subsegment?.close();
        resolve(result);
      } catch (error) {
        subsegment?.addError(error);
        subsegment?.close();
        reject(error);
      }
    });
  }
}

export default createLogger;