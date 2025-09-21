import { Request, Response } from 'express';
import { ScheduledSyncService } from '../services/ScheduledSyncService';
import { SyncMonitoringService } from '../services/SyncMonitoringService';
import { DataLineageService } from '../services/DataLineageService';
import { DataBackupService, BackupConfig } from '../services/DataBackupService';
import { DataSourceEnum } from '../types/dataSource.types';

export class ProductionSyncController {
  private scheduledSyncService: ScheduledSyncService;
  private monitoringService: SyncMonitoringService;
  private lineageService: DataLineageService;
  private backupService: DataBackupService;

  constructor(
    scheduledSyncService: ScheduledSyncService,
    monitoringService: SyncMonitoringService
  ) {
    this.scheduledSyncService = scheduledSyncService;
    this.monitoringService = monitoringService;
    this.lineageService = new DataLineageService();
    
    // Initialize backup service with production configuration
    const backupConfig: BackupConfig = {
      bucketName: process.env.S3_BACKUP_BUCKET || 'find-dining-data-backup',
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '365'),
      compressionEnabled: process.env.BACKUP_COMPRESSION === 'true',
      encryptionEnabled: process.env.BACKUP_ENCRYPTION === 'true',
      backupSchedule: (process.env.BACKUP_SCHEDULE as 'daily' | 'weekly' | 'monthly') || 'monthly'
    };
    
    this.backupService = new DataBackupService(backupConfig);
  }

  /**
   * Trigger emergency manual sync for all platforms
   */
  public async triggerEmergencySync(req: Request, res: Response): Promise<void> {
    try {
      const { reason, priority = 'high' } = req.body;
      
      if (!reason) {
        res.status(400).json({
          success: false,
          error: 'Emergency sync reason is required'
        });
        return;
      }

      console.log('Emergency sync triggered', { reason, priority, user: req.user?.id });

      // Create pre-sync backup
      const backup = await this.backupService.createFullBackup();
      
      // Trigger sync for all Hong Kong platforms
      const emergencyJobId = `emergency-sync-${Date.now()}`;
      const result = await this.scheduledSyncService.executeJob({
        id: emergencyJobId,
        name: `Emergency Sync - ${reason}`,
        sources: [
          DataSourceEnum.OPENRICE,
          DataSourceEnum.EATIGO,
          DataSourceEnum.CHOPE,
          DataSourceEnum.KEETA,
          DataSourceEnum.FOODPANDA,
          DataSourceEnum.BISTROCHAT,
          DataSourceEnum.TRIPADVISOR,
          DataSourceEnum.HK_GOV
        ],
        schedule: '',
        enabled: true,
        retryAttempts: 5, // More retries for emergency sync
        timeout: 10800000 // 3 hours timeout
      });

      // Record emergency sync in lineage
      await this.lineageService.recordLineage({
        source: DataSourceEnum.HK_GOV, // Use gov as primary source for emergency events
        operation: 'sync',
        entityType: 'metadata',
        entityId: emergencyJobId,
        metadata: {
          jobId: emergencyJobId,
          userId: req.user?.id,
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip
        },
        changes: {
          reason,
          priority,
          backupId: backup.backupId,
          sources: result.sources
        },
        dataQuality: {
          validationScore: 1.0,
          completenessScore: 1.0,
          accuracyScore: 1.0,
          consistencyScore: 1.0
        },
        compliance: {
          gdprCompliant: true,
          dataRetentionDays: 2555, // 7 years for audit purposes
          sensitiveDataFields: []
        }
      });

      res.json({
        success: true,
        message: 'Emergency sync triggered successfully',
        data: {
          jobId: emergencyJobId,
          backupId: backup.backupId,
          result
        }
      });

    } catch (error) {
      console.error('Emergency sync failed', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get comprehensive system health status
   */
  public async getSystemHealth(req: Request, res: Response): Promise<void> {
    try {
      // Get basic health status
      const basicHealth = this.monitoringService.getHealthStatus();
      
      // Get data freshness metrics
      const freshnessMetrics = await this.scheduledSyncService.getDataFreshnessMetrics();
      
      // Get recent sync history
      const recentSyncs = this.scheduledSyncService.getSyncHistory(10);
      
      // Get active alerts
      const activeAlerts = this.monitoringService.getActiveAlerts();
      
      // Get backup status
      const recentBackups = await this.backupService.listBackups();
      const lastBackup = recentBackups[0];
      
      // Calculate overall system health score
      const healthScore = this.calculateHealthScore(basicHealth, freshnessMetrics, recentSyncs, activeAlerts);

      const systemHealth = {
        ...basicHealth,
        healthScore,
        dataFreshness: freshnessMetrics,
        recentSyncs: recentSyncs.slice(0, 5),
        activeAlerts: activeAlerts.slice(0, 10),
        backup: {
          lastBackup: lastBackup ? {
            timestamp: lastBackup.timestamp,
            recordCount: lastBackup.recordCount,
            sizeBytes: lastBackup.sizeBytes
          } : null,
          totalBackups: recentBackups.length
        },
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: systemHealth
      });

    } catch (error) {
      console.error('Failed to get system health', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get data lineage report for a specific entity
   */
  public async getDataLineage(req: Request, res: Response): Promise<void> {
    try {
      const { entityId, entityType } = req.params;
      
      if (!entityId || !entityType) {
        res.status(400).json({
          success: false,
          error: 'Entity ID and type are required'
        });
        return;
      }

      const lineageReport = await this.lineageService.getLineageReport(entityId, entityType);
      
      res.json({
        success: true,
        data: lineageReport
      });

    } catch (error) {
      console.error('Failed to get data lineage', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Export data lineage for compliance
   */
  public async exportLineageData(req: Request, res: Response): Promise<void> {
    try {
      const { entityId } = req.params;
      const { format = 'json' } = req.query;
      
      if (!entityId) {
        res.status(400).json({
          success: false,
          error: 'Entity ID is required'
        });
        return;
      }

      const exportData = await this.lineageService.exportLineageData(
        entityId, 
        format as 'json' | 'csv'
      );

      // Set appropriate headers for download
      const filename = `lineage-${entityId}-${new Date().toISOString().split('T')[0]}.${format}`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
      
      res.send(exportData);

    } catch (error) {
      console.error('Failed to export lineage data', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Create manual backup
   */
  public async createBackup(req: Request, res: Response): Promise<void> {
    try {
      const { type = 'full', sources } = req.body;
      
      let backup;
      if (type === 'full') {
        backup = await this.backupService.createFullBackup(sources);
      } else if (type === 'incremental' && sources && sources.length === 1) {
        backup = await this.backupService.createIncrementalBackup(sources[0]);
      } else {
        res.status(400).json({
          success: false,
          error: 'Invalid backup type or sources'
        });
        return;
      }

      if (!backup) {
        res.status(200).json({
          success: true,
          message: 'No changes found for incremental backup'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Backup created successfully',
        data: backup
      });

    } catch (error) {
      console.error('Failed to create backup', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * List available backups
   */
  public async listBackups(req: Request, res: Response): Promise<void> {
    try {
      const { source, type } = req.query;
      
      const backups = await this.backupService.listBackups(
        source as DataSourceEnum,
        type as 'full' | 'incremental'
      );

      res.json({
        success: true,
        data: backups
      });

    } catch (error) {
      console.error('Failed to list backups', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Restore from backup
   */
  public async restoreFromBackup(req: Request, res: Response): Promise<void> {
    try {
      const { backupId, targetEnvironment, validateIntegrity = true, dryRun = false, conflictResolution = 'merge' } = req.body;
      
      if (!backupId || !targetEnvironment) {
        res.status(400).json({
          success: false,
          error: 'Backup ID and target environment are required'
        });
        return;
      }

      const result = await this.backupService.restoreFromBackup({
        backupId,
        targetEnvironment,
        validateIntegrity,
        dryRun,
        conflictResolution
      });

      res.json({
        success: true,
        message: dryRun ? 'Dry run completed successfully' : 'Restore completed successfully',
        data: result
      });

    } catch (error) {
      console.error('Failed to restore from backup', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get lineage statistics
   */
  public async getLineageStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      
      const statistics = await this.lineageService.getLineageStatistics(start, end);
      
      res.json({
        success: true,
        data: statistics
      });

    } catch (error) {
      console.error('Failed to get lineage statistics', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Clean up expired data
   */
  public async cleanupExpiredData(req: Request, res: Response): Promise<void> {
    try {
      const { type = 'all' } = req.body;
      
      const results = {
        backupsDeleted: 0,
        lineageRecordsDeleted: 0
      };

      if (type === 'all' || type === 'backups') {
        results.backupsDeleted = await this.backupService.cleanupExpiredBackups();
      }

      if (type === 'all' || type === 'lineage') {
        results.lineageRecordsDeleted = await this.lineageService.cleanupExpiredRecords();
      }

      res.json({
        success: true,
        message: 'Cleanup completed successfully',
        data: results
      });

    } catch (error) {
      console.error('Failed to cleanup expired data', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private calculateHealthScore(
    basicHealth: any,
    freshnessMetrics: any[],
    recentSyncs: any[],
    activeAlerts: any[]
  ): number {
    let score = 100;

    // Deduct points for critical alerts
    const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');
    score -= criticalAlerts.length * 20;

    // Deduct points for high severity alerts
    const highAlerts = activeAlerts.filter(alert => alert.severity === 'high');
    score -= highAlerts.length * 10;

    // Deduct points for medium severity alerts
    const mediumAlerts = activeAlerts.filter(alert => alert.severity === 'medium');
    score -= mediumAlerts.length * 5;

    // Deduct points for stale data
    const staleData = freshnessMetrics.filter(metric => metric.healthStatus === 'critical');
    score -= staleData.length * 15;

    const warningData = freshnessMetrics.filter(metric => metric.healthStatus === 'warning');
    score -= warningData.length * 5;

    // Deduct points for recent sync failures
    const recentFailures = recentSyncs.filter(sync => sync.status === 'failed');
    score -= recentFailures.length * 10;

    // Ensure score doesn't go below 0
    return Math.max(0, score);
  }
}