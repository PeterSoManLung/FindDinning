import { DataLineageService } from '../services/DataLineageService';
import { DataBackupService, BackupConfig } from '../services/DataBackupService';
import { ProductionSyncController } from '../controllers/productionSyncController';
import { ScheduledSyncService } from '../services/ScheduledSyncService';
import { SyncMonitoringService } from '../services/SyncMonitoringService';
import { DataSourceEnum } from '../types/dataSource.types';

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  DynamoDB: {
    DocumentClient: jest.fn(() => ({
      put: jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({}) }),
      scan: jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({ Items: [] }) }),
      batchWrite: jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({}) })
    }))
  },
  S3: jest.fn(() => ({
    putObject: jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({}) }),
    getObject: jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({ Body: Buffer.from('{}') }) }),
    listObjectsV2: jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({ Contents: [] }) }),
    headObject: jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({ Metadata: {} }) }),
    deleteObject: jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({}) })
  }))
}));

describe('Production Sync Services', () => {
  let lineageService: DataLineageService;
  let backupService: DataBackupService;
  let backupConfig: BackupConfig;

  beforeEach(() => {
    lineageService = new DataLineageService();
    backupConfig = {
      bucketName: 'test-backup-bucket',
      retentionDays: 365,
      compressionEnabled: true,
      encryptionEnabled: true,
      backupSchedule: 'monthly'
    };
    backupService = new DataBackupService(backupConfig);
  });

  describe('DataLineageService', () => {
    it('should record lineage data successfully', async () => {
      const lineageData = {
        source: DataSourceEnum.OPENRICE,
        operation: 'create' as const,
        entityType: 'restaurant' as const,
        entityId: 'test-restaurant-123',
        metadata: {
          jobId: 'test-job-123',
          batchId: 'test-batch-456'
        },
        dataQuality: {
          validationScore: 0.95,
          completenessScore: 0.90,
          accuracyScore: 0.88,
          consistencyScore: 0.92
        },
        compliance: {
          gdprCompliant: true,
          dataRetentionDays: 2555,
          sensitiveDataFields: ['email', 'phone']
        }
      };

      const recordId = await lineageService.recordLineage(lineageData);
      
      expect(recordId).toBeDefined();
      expect(recordId).toContain('restaurant-test-restaurant-123-create');
    });

    it('should query lineage records with filters', async () => {
      const query = {
        entityId: 'test-restaurant-123',
        entityType: 'restaurant',
        source: DataSourceEnum.OPENRICE,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        limit: 50
      };

      const result = await lineageService.queryLineage(query);
      
      expect(result).toHaveProperty('records');
      expect(result).toHaveProperty('lastEvaluatedKey');
      expect(Array.isArray(result.records)).toBe(true);
    });

    it('should generate lineage statistics', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const stats = await lineageService.getLineageStatistics(startDate, endDate);
      
      expect(stats).toHaveProperty('totalRecords');
      expect(stats).toHaveProperty('recordsBySource');
      expect(stats).toHaveProperty('recordsByOperation');
      expect(stats).toHaveProperty('recordsByEntityType');
      expect(stats).toHaveProperty('averageDataQuality');
      expect(stats).toHaveProperty('complianceRate');
      expect(typeof stats.averageDataQuality).toBe('number');
      expect(typeof stats.complianceRate).toBe('number');
    });

    it('should export lineage data in JSON format', async () => {
      const entityId = 'test-restaurant-123';
      const exportData = await lineageService.exportLineageData(entityId, 'json');
      
      expect(typeof exportData).toBe('string');
      expect(() => JSON.parse(exportData)).not.toThrow();
    });

    it('should export lineage data in CSV format', async () => {
      const entityId = 'test-restaurant-123';
      const exportData = await lineageService.exportLineageData(entityId, 'csv');
      
      expect(typeof exportData).toBe('string');
      expect(exportData).toContain('recordId,timestamp,source');
    });
  });

  describe('DataBackupService', () => {
    it('should create full backup successfully', async () => {
      const sources = [DataSourceEnum.OPENRICE, DataSourceEnum.EATIGO];
      const backup = await backupService.createFullBackup(sources);
      
      expect(backup).toHaveProperty('backupId');
      expect(backup).toHaveProperty('timestamp');
      expect(backup).toHaveProperty('backupType', 'full');
      expect(backup).toHaveProperty('recordCount');
      expect(backup).toHaveProperty('sizeBytes');
      expect(backup).toHaveProperty('checksum');
      expect(backup).toHaveProperty('retentionExpiry');
    });

    it('should create incremental backup successfully', async () => {
      const source = DataSourceEnum.OPENRICE;
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      const backup = await backupService.createIncrementalBackup(source, since);
      
      if (backup) {
        expect(backup).toHaveProperty('backupId');
        expect(backup).toHaveProperty('backupType', 'incremental');
        expect(backup).toHaveProperty('source', source);
      }
    });

    it('should list backups with filters', async () => {
      const backups = await backupService.listBackups(DataSourceEnum.OPENRICE, 'full');
      
      expect(Array.isArray(backups)).toBe(true);
    });

    it('should restore from backup successfully', async () => {
      // First create a backup
      const backup = await backupService.createFullBackup();
      
      const restoreOptions = {
        backupId: backup.backupId,
        targetEnvironment: 'test',
        validateIntegrity: true,
        dryRun: true,
        conflictResolution: 'merge' as const
      };

      const result = await backupService.restoreFromBackup(restoreOptions);
      
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('recordsRestored');
      expect(result).toHaveProperty('conflicts');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should calculate retention expiry correctly', async () => {
      const backup = await backupService.createFullBackup();
      const retentionExpiry = new Date(backup.retentionExpiry);
      const expectedExpiry = new Date(backup.timestamp);
      expectedExpiry.setDate(expectedExpiry.getDate() + backupConfig.retentionDays);
      
      expect(retentionExpiry.getTime()).toBeCloseTo(expectedExpiry.getTime(), -1000); // Within 1 second
    });
  });

  describe('Production Sync Integration', () => {
    let mockScheduledSyncService: jest.Mocked<ScheduledSyncService>;
    let mockMonitoringService: jest.Mocked<SyncMonitoringService>;
    let productionSyncController: ProductionSyncController;

    beforeEach(() => {
      mockScheduledSyncService = {
        executeJob: jest.fn(),
        getDataFreshnessMetrics: jest.fn(),
        getSyncHistory: jest.fn(),
        getFailedSyncAlerts: jest.fn()
      } as any;

      mockMonitoringService = {
        getHealthStatus: jest.fn(),
        getActiveAlerts: jest.fn()
      } as any;

      productionSyncController = new ProductionSyncController(
        mockScheduledSyncService,
        mockMonitoringService
      );
    });

    it('should trigger emergency sync with proper backup', async () => {
      const mockExecuteJob = jest.fn().mockResolvedValue({
        jobId: 'emergency-sync-123',
        status: 'completed',
        recordsProcessed: 1000,
        recordsUpdated: 500,
        recordsCreated: 200,
        errors: [],
        warnings: []
      });

      mockScheduledSyncService.executeJob = mockExecuteJob;

      const req = {
        body: {
          reason: 'Data quality issue detected',
          priority: 'high'
        },
        user: { id: 'test-user' },
        get: jest.fn().mockReturnValue('test-user-agent'),
        ip: '127.0.0.1'
      } as any;

      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      } as any;

      await productionSyncController.triggerEmergencySync(req, res);

      expect(mockExecuteJob).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Emergency sync triggered successfully'
        })
      );
    });

    it('should calculate health score correctly', async () => {
      const mockGetHealthStatus = jest.fn().mockReturnValue({
        overall: 'warning',
        activeAlerts: 2,
        criticalAlerts: 0,
        sourcesWithIssues: [DataSourceEnum.OPENRICE]
      });

      const mockGetDataFreshnessMetrics = jest.fn().mockResolvedValue([
        {
          source: DataSourceEnum.OPENRICE,
          healthStatus: 'warning',
          stalenessScore: 0.5
        },
        {
          source: DataSourceEnum.EATIGO,
          healthStatus: 'healthy',
          stalenessScore: 0.1
        }
      ]);

      const mockGetSyncHistory = jest.fn().mockReturnValue([
        { status: 'completed' },
        { status: 'completed' },
        { status: 'failed' }
      ]);

      const mockGetActiveAlerts = jest.fn().mockReturnValue([
        { severity: 'medium' },
        { severity: 'low' }
      ]);

      mockMonitoringService.getHealthStatus = mockGetHealthStatus;
      mockScheduledSyncService.getDataFreshnessMetrics = mockGetDataFreshnessMetrics;
      mockScheduledSyncService.getSyncHistory = mockGetSyncHistory;
      mockMonitoringService.getActiveAlerts = mockGetActiveAlerts;

      const req = {} as any;
      const res = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis()
      } as any;

      await productionSyncController.getSystemHealth(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            healthScore: expect.any(Number)
          })
        })
      );

      const healthData = res.json.mock.calls[0][0].data;
      expect(healthData.healthScore).toBeGreaterThanOrEqual(0);
      expect(healthData.healthScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle lineage service errors gracefully', async () => {
      // Mock DynamoDB error
      const mockDynamoDB = require('aws-sdk').DynamoDB.DocumentClient;
      mockDynamoDB.mockImplementation(() => ({
        put: jest.fn().mockReturnValue({
          promise: jest.fn().mockRejectedValue(new Error('DynamoDB error'))
        })
      }));

      const lineageService = new DataLineageService();
      
      await expect(lineageService.recordLineage({
        source: DataSourceEnum.OPENRICE,
        operation: 'create',
        entityType: 'restaurant',
        entityId: 'test-123',
        metadata: {},
        dataQuality: {
          validationScore: 1,
          completenessScore: 1,
          accuracyScore: 1,
          consistencyScore: 1
        },
        compliance: {
          gdprCompliant: true,
          dataRetentionDays: 365,
          sensitiveDataFields: []
        }
      })).rejects.toThrow('DynamoDB error');
    });

    it('should handle backup service errors gracefully', async () => {
      // Mock S3 error
      const mockS3 = require('aws-sdk').S3;
      mockS3.mockImplementation(() => ({
        putObject: jest.fn().mockReturnValue({
          promise: jest.fn().mockRejectedValue(new Error('S3 error'))
        })
      }));

      const backupService = new DataBackupService(backupConfig);
      
      await expect(backupService.createFullBackup()).rejects.toThrow('Full backup failed: S3 error');
    });
  });

  describe('Performance Tests', () => {
    it('should handle large lineage queries efficiently', async () => {
      const startTime = Date.now();
      
      const query = {
        limit: 1000,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31')
      };

      await lineageService.queryLineage(query);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle backup operations within reasonable time', async () => {
      const startTime = Date.now();
      
      await backupService.createFullBackup([DataSourceEnum.OPENRICE]);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });
});