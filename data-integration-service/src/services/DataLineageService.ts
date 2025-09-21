import { DynamoDB } from 'aws-sdk';
import { DataSourceEnum } from '../types/dataSource.types';

export interface LineageRecord {
  recordId: string;
  timestamp: string;
  source: DataSourceEnum;
  operation: 'create' | 'update' | 'delete' | 'sync';
  entityType: 'restaurant' | 'review' | 'user' | 'metadata';
  entityId: string;
  changes?: Record<string, any>;
  metadata: {
    jobId?: string;
    batchId?: string;
    userId?: string;
    apiVersion?: string;
    userAgent?: string;
    ipAddress?: string;
  };
  dataQuality: {
    validationScore: number;
    completenessScore: number;
    accuracyScore: number;
    consistencyScore: number;
  };
  compliance: {
    gdprCompliant: boolean;
    dataRetentionDays: number;
    sensitiveDataFields: string[];
  };
}

export interface LineageQuery {
  entityId?: string;
  entityType?: string;
  source?: DataSourceEnum;
  operation?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  lastEvaluatedKey?: any;
}

export interface LineageReport {
  entityId: string;
  entityType: string;
  createdAt: Date;
  lastModified: Date;
  totalChanges: number;
  sources: DataSourceEnum[];
  operations: string[];
  dataQualityTrend: {
    date: string;
    score: number;
  }[];
  complianceStatus: {
    gdprCompliant: boolean;
    retentionExpiry: Date;
    sensitiveFields: string[];
  };
}

export class DataLineageService {
  private dynamodb: DynamoDB.DocumentClient;
  private tableName: string;

  constructor() {
    this.dynamodb = new DynamoDB.DocumentClient({
      region: process.env.AWS_REGION || 'ap-southeast-1'
    });
    this.tableName = `data-lineage-${process.env.ENVIRONMENT || 'development'}`;
  }

  /**
   * Record a data lineage event
   */
  public async recordLineage(record: Omit<LineageRecord, 'recordId' | 'timestamp'>): Promise<string> {
    const recordId = this.generateRecordId(record.entityType, record.entityId, record.operation);
    const timestamp = new Date().toISOString();

    const lineageRecord: LineageRecord = {
      recordId,
      timestamp,
      ...record
    };

    try {
      await this.dynamodb.put({
        TableName: this.tableName,
        Item: lineageRecord,
        ConditionExpression: 'attribute_not_exists(record_id)'
      }).promise();

      console.log('Data lineage recorded', { recordId, entityId: record.entityId });
      return recordId;

    } catch (error) {
      if (error.code === 'ConditionalCheckFailedException') {
        // Record already exists, update with new timestamp
        const updatedRecordId = `${recordId}-${Date.now()}`;
        await this.dynamodb.put({
          TableName: this.tableName,
          Item: { ...lineageRecord, recordId: updatedRecordId }
        }).promise();
        return updatedRecordId;
      }
      throw error;
    }
  }

  /**
   * Query lineage records
   */
  public async queryLineage(query: LineageQuery): Promise<{
    records: LineageRecord[];
    lastEvaluatedKey?: any;
  }> {
    let params: any = {
      TableName: this.tableName,
      Limit: query.limit || 100
    };

    if (query.lastEvaluatedKey) {
      params.ExclusiveStartKey = query.lastEvaluatedKey;
    }

    // Build filter expression
    const filterExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    if (query.entityId) {
      filterExpressions.push('entityId = :entityId');
      expressionAttributeValues[':entityId'] = query.entityId;
    }

    if (query.entityType) {
      filterExpressions.push('entityType = :entityType');
      expressionAttributeValues[':entityType'] = query.entityType;
    }

    if (query.source) {
      filterExpressions.push('#source = :source');
      expressionAttributeNames['#source'] = 'source';
      expressionAttributeValues[':source'] = query.source;
    }

    if (query.operation) {
      filterExpressions.push('operation = :operation');
      expressionAttributeValues[':operation'] = query.operation;
    }

    if (query.startDate) {
      filterExpressions.push('#timestamp >= :startDate');
      expressionAttributeNames['#timestamp'] = 'timestamp';
      expressionAttributeValues[':startDate'] = query.startDate.toISOString();
    }

    if (query.endDate) {
      filterExpressions.push('#timestamp <= :endDate');
      expressionAttributeNames['#timestamp'] = 'timestamp';
      expressionAttributeValues[':endDate'] = query.endDate.toISOString();
    }

    if (filterExpressions.length > 0) {
      params.FilterExpression = filterExpressions.join(' AND ');
    }

    if (Object.keys(expressionAttributeNames).length > 0) {
      params.ExpressionAttributeNames = expressionAttributeNames;
    }

    if (Object.keys(expressionAttributeValues).length > 0) {
      params.ExpressionAttributeValues = expressionAttributeValues;
    }

    try {
      const result = await this.dynamodb.scan(params).promise();
      
      return {
        records: result.Items as LineageRecord[],
        lastEvaluatedKey: result.LastEvaluatedKey
      };

    } catch (error) {
      console.error('Failed to query lineage records', error);
      throw new Error(`Lineage query failed: ${error.message}`);
    }
  }

  /**
   * Get lineage report for a specific entity
   */
  public async getLineageReport(entityId: string, entityType: string): Promise<LineageReport> {
    const query: LineageQuery = {
      entityId,
      entityType,
      limit: 1000
    };

    const { records } = await this.queryLineage(query);

    if (records.length === 0) {
      throw new Error(`No lineage records found for ${entityType} ${entityId}`);
    }

    // Sort records by timestamp
    records.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const createdAt = new Date(records[0].timestamp);
    const lastModified = new Date(records[records.length - 1].timestamp);
    const sources = Array.from(new Set(records.map(r => r.source)));
    const operations = Array.from(new Set(records.map(r => r.operation)));

    // Calculate data quality trend (monthly averages)
    const qualityTrend = this.calculateQualityTrend(records);

    // Get compliance status from latest record
    const latestRecord = records[records.length - 1];
    const complianceStatus = {
      gdprCompliant: latestRecord.compliance.gdprCompliant,
      retentionExpiry: new Date(
        new Date(latestRecord.timestamp).getTime() + 
        (latestRecord.compliance.dataRetentionDays * 24 * 60 * 60 * 1000)
      ),
      sensitiveFields: latestRecord.compliance.sensitiveDataFields
    };

    return {
      entityId,
      entityType,
      createdAt,
      lastModified,
      totalChanges: records.length,
      sources,
      operations,
      dataQualityTrend: qualityTrend,
      complianceStatus
    };
  }

  /**
   * Get lineage statistics
   */
  public async getLineageStatistics(startDate?: Date, endDate?: Date): Promise<{
    totalRecords: number;
    recordsBySource: Record<DataSourceEnum, number>;
    recordsByOperation: Record<string, number>;
    recordsByEntityType: Record<string, number>;
    averageDataQuality: number;
    complianceRate: number;
  }> {
    const query: LineageQuery = {
      startDate,
      endDate,
      limit: 10000 // Adjust based on expected volume
    };

    const { records } = await this.queryLineage(query);

    const stats = {
      totalRecords: records.length,
      recordsBySource: {} as Record<DataSourceEnum, number>,
      recordsByOperation: {} as Record<string, number>,
      recordsByEntityType: {} as Record<string, number>,
      averageDataQuality: 0,
      complianceRate: 0
    };

    let totalQualityScore = 0;
    let compliantRecords = 0;

    for (const record of records) {
      // Count by source
      stats.recordsBySource[record.source] = (stats.recordsBySource[record.source] || 0) + 1;

      // Count by operation
      stats.recordsByOperation[record.operation] = (stats.recordsByOperation[record.operation] || 0) + 1;

      // Count by entity type
      stats.recordsByEntityType[record.entityType] = (stats.recordsByEntityType[record.entityType] || 0) + 1;

      // Calculate average data quality
      const overallQuality = (
        record.dataQuality.validationScore +
        record.dataQuality.completenessScore +
        record.dataQuality.accuracyScore +
        record.dataQuality.consistencyScore
      ) / 4;
      totalQualityScore += overallQuality;

      // Count compliant records
      if (record.compliance.gdprCompliant) {
        compliantRecords++;
      }
    }

    if (records.length > 0) {
      stats.averageDataQuality = totalQualityScore / records.length;
      stats.complianceRate = compliantRecords / records.length;
    }

    return stats;
  }

  /**
   * Clean up expired lineage records
   */
  public async cleanupExpiredRecords(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 7); // Keep 7 years of lineage data

    const query: LineageQuery = {
      endDate: cutoffDate,
      limit: 1000
    };

    let deletedCount = 0;
    let hasMore = true;

    while (hasMore) {
      const { records, lastEvaluatedKey } = await this.queryLineage(query);
      
      if (records.length === 0) {
        break;
      }

      // Delete records in batches
      const deleteRequests = records.map(record => ({
        DeleteRequest: {
          Key: {
            record_id: record.recordId,
            timestamp: record.timestamp
          }
        }
      }));

      // Process in batches of 25 (DynamoDB limit)
      for (let i = 0; i < deleteRequests.length; i += 25) {
        const batch = deleteRequests.slice(i, i + 25);
        
        await this.dynamodb.batchWrite({
          RequestItems: {
            [this.tableName]: batch
          }
        }).promise();

        deletedCount += batch.length;
      }

      query.lastEvaluatedKey = lastEvaluatedKey;
      hasMore = !!lastEvaluatedKey;
    }

    console.log(`Cleaned up ${deletedCount} expired lineage records`);
    return deletedCount;
  }

  /**
   * Export lineage data for compliance
   */
  public async exportLineageData(entityId: string, format: 'json' | 'csv' = 'json'): Promise<string> {
    const query: LineageQuery = {
      entityId,
      limit: 10000
    };

    const { records } = await this.queryLineage(query);

    if (format === 'csv') {
      return this.convertToCSV(records);
    }

    return JSON.stringify(records, null, 2);
  }

  private generateRecordId(entityType: string, entityId: string, operation: string): string {
    const timestamp = Date.now();
    return `${entityType}-${entityId}-${operation}-${timestamp}`;
  }

  private calculateQualityTrend(records: LineageRecord[]): { date: string; score: number; }[] {
    const monthlyData = new Map<string, { total: number; count: number }>();

    for (const record of records) {
      const date = new Date(record.timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      const overallQuality = (
        record.dataQuality.validationScore +
        record.dataQuality.completenessScore +
        record.dataQuality.accuracyScore +
        record.dataQuality.consistencyScore
      ) / 4;

      const existing = monthlyData.get(monthKey) || { total: 0, count: 0 };
      monthlyData.set(monthKey, {
        total: existing.total + overallQuality,
        count: existing.count + 1
      });
    }

    return Array.from(monthlyData.entries())
      .map(([date, data]) => ({
        date,
        score: data.total / data.count
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private convertToCSV(records: LineageRecord[]): string {
    if (records.length === 0) {
      return '';
    }

    const headers = [
      'recordId', 'timestamp', 'source', 'operation', 'entityType', 'entityId',
      'validationScore', 'completenessScore', 'accuracyScore', 'consistencyScore',
      'gdprCompliant', 'dataRetentionDays'
    ];

    const rows = records.map(record => [
      record.recordId,
      record.timestamp,
      record.source,
      record.operation,
      record.entityType,
      record.entityId,
      record.dataQuality.validationScore,
      record.dataQuality.completenessScore,
      record.dataQuality.accuracyScore,
      record.dataQuality.consistencyScore,
      record.compliance.gdprCompliant,
      record.compliance.dataRetentionDays
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }
}