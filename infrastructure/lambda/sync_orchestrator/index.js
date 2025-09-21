const AWS = require('aws-sdk');
const https = require('https');

const sns = new AWS.SNS();
const cloudwatch = new AWS.CloudWatch();
const s3 = new AWS.S3();
const ssm = new AWS.SSM();

const ENVIRONMENT = process.env.ENVIRONMENT;
const DATA_INTEGRATION_SERVICE_URL = process.env.DATA_INTEGRATION_SERVICE_URL;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;
const S3_BACKUP_BUCKET = process.env.S3_BACKUP_BUCKET;
const CLOUDWATCH_LOG_GROUP = process.env.CLOUDWATCH_LOG_GROUP;

/**
 * Lambda handler for data sync orchestration
 */
exports.handler = async (event, context) => {
    console.log('Sync orchestrator started', { event, context: context.awsRequestId });
    
    const startTime = new Date();
    let syncResult = {
        jobType: event.jobType || 'unknown',
        sources: event.sources || [],
        status: 'started',
        startTime: startTime.toISOString(),
        recordsProcessed: 0,
        recordsUpdated: 0,
        recordsCreated: 0,
        errors: [],
        warnings: []
    };

    try {
        // Get sync configuration from Parameter Store
        const config = await getSyncConfiguration();
        
        // Create backup before sync
        await createPreSyncBackup(syncResult.jobType);
        
        // Execute sync job
        syncResult = await executeSyncJob(event, config);
        
        // Record data lineage
        await recordDataLineage(syncResult);
        
        // Send success metrics
        await sendMetrics(syncResult, 'success');
        
        // Check data quality and send alerts if needed
        await checkDataQualityAndAlert(syncResult);
        
        console.log('Sync orchestrator completed successfully', syncResult);
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                result: syncResult
            })
        };
        
    } catch (error) {
        console.error('Sync orchestrator failed', error);
        
        syncResult.status = 'failed';
        syncResult.endTime = new Date().toISOString();
        syncResult.errors.push(error.message);
        
        // Send failure metrics and alerts
        await sendMetrics(syncResult, 'failure');
        await sendAlert('critical', `Data sync failed: ${error.message}`, syncResult);
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message,
                result: syncResult
            })
        };
    }
};

/**
 * Get sync configuration from Parameter Store
 */
async function getSyncConfiguration() {
    try {
        const response = await ssm.getParameter({
            Name: `/data-sync/${ENVIRONMENT}/config`,
            WithDecryption: true
        }).promise();
        
        return JSON.parse(response.Parameter.Value);
    } catch (error) {
        console.warn('Failed to get sync configuration, using defaults', error);
        return {
            retryAttempts: 3,
            timeout: 7200000,
            batchSize: 100,
            maxConcurrentJobs: 5,
            alertThresholds: {
                errorRate: 0.1,
                staleness: 0.7,
                performance: 300000
            }
        };
    }
}

/**
 * Create backup before sync operation
 */
async function createPreSyncBackup(jobType) {
    const backupKey = `backups/${jobType}/${new Date().toISOString()}/pre-sync-backup.json`;
    
    try {
        // Get current data state from data integration service
        const currentData = await makeServiceRequest('/api/data/export', 'GET');
        
        // Upload to S3
        await s3.putObject({
            Bucket: S3_BACKUP_BUCKET,
            Key: backupKey,
            Body: JSON.stringify(currentData),
            ContentType: 'application/json',
            Metadata: {
                jobType: jobType,
                timestamp: new Date().toISOString(),
                environment: ENVIRONMENT
            }
        }).promise();
        
        console.log('Pre-sync backup created', { backupKey });
        
    } catch (error) {
        console.error('Failed to create pre-sync backup', error);
        throw new Error(`Backup creation failed: ${error.message}`);
    }
}

/**
 * Execute the sync job
 */
async function executeSyncJob(event, config) {
    const { jobType, sources } = event;
    const syncResult = {
        jobType,
        sources,
        status: 'running',
        startTime: new Date().toISOString(),
        recordsProcessed: 0,
        recordsUpdated: 0,
        recordsCreated: 0,
        errors: [],
        warnings: []
    };
    
    try {
        // Trigger sync job in data integration service
        const syncResponse = await makeServiceRequest('/api/sync/trigger', 'POST', {
            jobType,
            sources,
            config
        });
        
        // Poll for completion with timeout
        const jobId = syncResponse.jobId;
        const result = await pollSyncCompletion(jobId, config.timeout);
        
        syncResult.status = result.status;
        syncResult.endTime = new Date().toISOString();
        syncResult.recordsProcessed = result.recordsProcessed || 0;
        syncResult.recordsUpdated = result.recordsUpdated || 0;
        syncResult.recordsCreated = result.recordsCreated || 0;
        syncResult.errors = result.errors || [];
        syncResult.warnings = result.warnings || [];
        
        return syncResult;
        
    } catch (error) {
        syncResult.status = 'failed';
        syncResult.endTime = new Date().toISOString();
        syncResult.errors.push(error.message);
        throw error;
    }
}

/**
 * Poll sync job completion
 */
async function pollSyncCompletion(jobId, timeout) {
    const startTime = Date.now();
    const pollInterval = 30000; // 30 seconds
    
    while (Date.now() - startTime < timeout) {
        try {
            const status = await makeServiceRequest(`/api/sync/status/${jobId}`, 'GET');
            
            if (status.status === 'completed' || status.status === 'failed') {
                return status;
            }
            
            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            
        } catch (error) {
            console.error('Error polling sync status', error);
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
    }
    
    throw new Error(`Sync job ${jobId} timed out after ${timeout}ms`);
}

/**
 * Record data lineage information
 */
async function recordDataLineage(syncResult) {
    const dynamodb = new AWS.DynamoDB.DocumentClient();
    
    try {
        const lineageRecord = {
            record_id: `sync-${syncResult.jobType}-${Date.now()}`,
            timestamp: syncResult.startTime,
            source: 'sync-orchestrator',
            job_type: syncResult.jobType,
            sources: syncResult.sources,
            status: syncResult.status,
            records_processed: syncResult.recordsProcessed,
            records_updated: syncResult.recordsUpdated,
            records_created: syncResult.recordsCreated,
            errors: syncResult.errors,
            warnings: syncResult.warnings,
            environment: ENVIRONMENT,
            duration_ms: syncResult.endTime ? 
                new Date(syncResult.endTime).getTime() - new Date(syncResult.startTime).getTime() : null
        };
        
        await dynamodb.put({
            TableName: `data-lineage-${ENVIRONMENT}`,
            Item: lineageRecord
        }).promise();
        
        console.log('Data lineage recorded', { recordId: lineageRecord.record_id });
        
    } catch (error) {
        console.error('Failed to record data lineage', error);
        // Don't fail the entire sync for lineage recording issues
    }
}

/**
 * Send CloudWatch metrics
 */
async function sendMetrics(syncResult, outcome) {
    const metrics = [
        {
            MetricName: 'SyncJobsExecuted',
            Value: 1,
            Unit: 'Count',
            Dimensions: [
                { Name: 'Environment', Value: ENVIRONMENT },
                { Name: 'JobType', Value: syncResult.jobType },
                { Name: 'Outcome', Value: outcome }
            ]
        },
        {
            MetricName: 'RecordsProcessed',
            Value: syncResult.recordsProcessed,
            Unit: 'Count',
            Dimensions: [
                { Name: 'Environment', Value: ENVIRONMENT },
                { Name: 'JobType', Value: syncResult.jobType }
            ]
        },
        {
            MetricName: 'RecordsUpdated',
            Value: syncResult.recordsUpdated,
            Unit: 'Count',
            Dimensions: [
                { Name: 'Environment', Value: ENVIRONMENT },
                { Name: 'JobType', Value: syncResult.jobType }
            ]
        },
        {
            MetricName: 'RecordsCreated',
            Value: syncResult.recordsCreated,
            Unit: 'Count',
            Dimensions: [
                { Name: 'Environment', Value: ENVIRONMENT },
                { Name: 'JobType', Value: syncResult.jobType }
            ]
        }
    ];
    
    if (outcome === 'failure') {
        metrics.push({
            MetricName: 'SyncFailures',
            Value: 1,
            Unit: 'Count',
            Dimensions: [
                { Name: 'Environment', Value: ENVIRONMENT },
                { Name: 'JobType', Value: syncResult.jobType }
            ]
        });
    }
    
    if (syncResult.endTime && syncResult.startTime) {
        const duration = new Date(syncResult.endTime).getTime() - new Date(syncResult.startTime).getTime();
        metrics.push({
            MetricName: 'SyncDuration',
            Value: duration,
            Unit: 'Milliseconds',
            Dimensions: [
                { Name: 'Environment', Value: ENVIRONMENT },
                { Name: 'JobType', Value: syncResult.jobType }
            ]
        });
    }
    
    try {
        await cloudwatch.putMetricData({
            Namespace: 'DataIntegration',
            MetricData: metrics
        }).promise();
        
        console.log('Metrics sent to CloudWatch', { metricsCount: metrics.length });
        
    } catch (error) {
        console.error('Failed to send metrics', error);
    }
}

/**
 * Check data quality and send alerts if needed
 */
async function checkDataQualityAndAlert(syncResult) {
    const config = await getSyncConfiguration();
    const { alertThresholds, dataQualityThresholds } = config;
    
    // Check error rate
    if (syncResult.recordsProcessed > 0) {
        const errorRate = syncResult.errors.length / syncResult.recordsProcessed;
        if (errorRate > alertThresholds.errorRate) {
            await sendAlert('high', 
                `High error rate detected: ${(errorRate * 100).toFixed(1)}% (${syncResult.errors.length} errors out of ${syncResult.recordsProcessed} records)`,
                syncResult
            );
        }
    }
    
    // Check performance
    if (syncResult.endTime && syncResult.startTime) {
        const duration = new Date(syncResult.endTime).getTime() - new Date(syncResult.startTime).getTime();
        if (duration > alertThresholds.performance) {
            await sendAlert('medium',
                `Sync job took ${(duration / 1000).toFixed(1)} seconds, exceeding threshold of ${alertThresholds.performance / 1000} seconds`,
                syncResult
            );
        }
    }
    
    // Check data quality metrics
    if (syncResult.dataQuality) {
        const { validationScore, completenessScore, accuracyScore, consistencyScore } = syncResult.dataQuality;
        
        if (validationScore < dataQualityThresholds.validationScore) {
            await sendAlert('high',
                `Data validation score below threshold: ${(validationScore * 100).toFixed(1)}% (threshold: ${(dataQualityThresholds.validationScore * 100).toFixed(1)}%)`,
                syncResult
            );
        }
        
        if (completenessScore < dataQualityThresholds.completenessScore) {
            await sendAlert('high',
                `Data completeness score below threshold: ${(completenessScore * 100).toFixed(1)}% (threshold: ${(dataQualityThresholds.completenessScore * 100).toFixed(1)}%)`,
                syncResult
            );
        }
        
        if (accuracyScore < dataQualityThresholds.accuracyScore) {
            await sendAlert('high',
                `Data accuracy score below threshold: ${(accuracyScore * 100).toFixed(1)}% (threshold: ${(dataQualityThresholds.accuracyScore * 100).toFixed(1)}%)`,
                syncResult
            );
        }
        
        if (consistencyScore < dataQualityThresholds.consistencyScore) {
            await sendAlert('high',
                `Data consistency score below threshold: ${(consistencyScore * 100).toFixed(1)}% (threshold: ${(dataQualityThresholds.consistencyScore * 100).toFixed(1)}%)`,
                syncResult
            );
        }
    }
    
    // Check for specific error patterns
    const criticalErrors = syncResult.errors.filter(error => 
        error.includes('authentication') || 
        error.includes('authorization') || 
        error.includes('network') ||
        error.includes('timeout') ||
        error.includes('compliance') ||
        error.includes('gdpr')
    );
    
    if (criticalErrors.length > 0) {
        await sendAlert('critical',
            `Critical errors detected in sync job: ${criticalErrors.join(', ')}`,
            syncResult
        );
    }
    
    // Check compliance status
    if (syncResult.complianceRate && syncResult.complianceRate < 0.95) {
        await sendAlert('critical',
            `GDPR compliance rate below acceptable threshold: ${(syncResult.complianceRate * 100).toFixed(1)}% (minimum: 95%)`,
            syncResult
        );
    }
    
    // Send data quality metrics to CloudWatch
    await sendDataQualityMetrics(syncResult);
}

/**
 * Send alert notification
 */
async function sendAlert(severity, message, syncResult) {
    try {
        const alertMessage = {
            severity,
            message,
            timestamp: new Date().toISOString(),
            environment: ENVIRONMENT,
            jobType: syncResult.jobType,
            sources: syncResult.sources,
            recordsProcessed: syncResult.recordsProcessed,
            errors: syncResult.errors.slice(0, 5), // Limit to first 5 errors
            requestId: context.awsRequestId
        };
        
        await sns.publish({
            TopicArn: SNS_TOPIC_ARN,
            Subject: `[${severity.toUpperCase()}] Data Sync Alert - ${ENVIRONMENT}`,
            Message: JSON.stringify(alertMessage, null, 2)
        }).promise();
        
        console.log('Alert sent', { severity, message });
        
    } catch (error) {
        console.error('Failed to send alert', error);
    }
}

/**
 * Make HTTP request to data integration service
 */
async function makeServiceRequest(path, method, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, DATA_INTEGRATION_SERVICE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port || 3000,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'sync-orchestrator-lambda'
            },
            timeout: 30000 // 30 seconds
        };
        
        if (body) {
            const bodyString = JSON.stringify(body);
            options.headers['Content-Length'] = Buffer.byteLength(bodyString);
        }
        
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(response.data || response);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${response.error || data}`));
                    }
                } catch (error) {
                    reject(new Error(`Invalid JSON response: ${data}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(new Error(`Request failed: ${error.message}`));
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        
        if (body) {
            req.write(JSON.stringify(body));
        }
        
        req.end();
    });
}

/**
 * Send data quality metrics to CloudWatch
 */
async function sendDataQualityMetrics(syncResult) {
    if (!syncResult.dataQuality) return;
    
    const metrics = [
        {
            MetricName: 'DataQualityScore',
            Value: (
                syncResult.dataQuality.validationScore +
                syncResult.dataQuality.completenessScore +
                syncResult.dataQuality.accuracyScore +
                syncResult.dataQuality.consistencyScore
            ) / 4 * 100,
            Unit: 'Percent',
            Dimensions: [
                { Name: 'Environment', Value: ENVIRONMENT },
                { Name: 'JobType', Value: syncResult.jobType }
            ]
        },
        {
            MetricName: 'ValidationScore',
            Value: syncResult.dataQuality.validationScore * 100,
            Unit: 'Percent',
            Dimensions: [
                { Name: 'Environment', Value: ENVIRONMENT },
                { Name: 'JobType', Value: syncResult.jobType }
            ]
        },
        {
            MetricName: 'CompletenessScore',
            Value: syncResult.dataQuality.completenessScore * 100,
            Unit: 'Percent',
            Dimensions: [
                { Name: 'Environment', Value: ENVIRONMENT },
                { Name: 'JobType', Value: syncResult.jobType }
            ]
        },
        {
            MetricName: 'AccuracyScore',
            Value: syncResult.dataQuality.accuracyScore * 100,
            Unit: 'Percent',
            Dimensions: [
                { Name: 'Environment', Value: ENVIRONMENT },
                { Name: 'JobType', Value: syncResult.jobType }
            ]
        },
        {
            MetricName: 'ConsistencyScore',
            Value: syncResult.dataQuality.consistencyScore * 100,
            Unit: 'Percent',
            Dimensions: [
                { Name: 'Environment', Value: ENVIRONMENT },
                { Name: 'JobType', Value: syncResult.jobType }
            ]
        }
    ];
    
    if (syncResult.complianceRate !== undefined) {
        metrics.push({
            MetricName: 'ComplianceRate',
            Value: syncResult.complianceRate * 100,
            Unit: 'Percent',
            Dimensions: [
                { Name: 'Environment', Value: ENVIRONMENT },
                { Name: 'JobType', Value: syncResult.jobType }
            ]
        });
    }
    
    try {
        await cloudwatch.putMetricData({
            Namespace: 'DataIntegration',
            MetricData: metrics
        }).promise();
        
        console.log('Data quality metrics sent to CloudWatch', { metricsCount: metrics.length });
        
    } catch (error) {
        console.error('Failed to send data quality metrics', error);
    }
}