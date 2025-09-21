import { Request, Response } from 'express';
import { ScheduledSyncService, SyncJobConfig } from '../services/ScheduledSyncService';
import { IncrementalUpdateService } from '../services/IncrementalUpdateService';
import { SyncMonitoringService } from '../services/SyncMonitoringService';
import { DataIntegrationFramework } from '../services/DataIntegrationFramework';
import { DataValidationService } from '../services/DataValidationService';
import { DeduplicationService } from '../services/DeduplicationService';
import { DataSourceEnum } from '../types/dataSource.types';

export class SyncController {
  private scheduledSyncService: ScheduledSyncService;
  private incrementalUpdateService: IncrementalUpdateService;
  private monitoringService: SyncMonitoringService;

  constructor() {
    const dataIntegration = new DataIntegrationFramework();
    const validation = new DataValidationService();
    const deduplication = new DeduplicationService();

    this.scheduledSyncService = new ScheduledSyncService(dataIntegration, validation, deduplication);
    this.incrementalUpdateService = new IncrementalUpdateService();
    this.monitoringService = new SyncMonitoringService();

    // Set up monitoring for sync results
    this.setupMonitoring();
  }

  private setupMonitoring(): void {
    // In a real implementation, this would set up event listeners
    // For now, we'll manually record sync results in the monitoring service
  }

  /**
   * Get all scheduled sync jobs
   */
  public async getJobs(req: Request, res: Response): Promise<void> {
    try {
      const jobs = this.scheduledSyncService.getAllJobs();
      res.json({
        success: true,
        data: jobs
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get specific job status
   */
  public async getJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const job = this.scheduledSyncService.getJobStatus(jobId);
      
      if (!job) {
        res.status(404).json({
          success: false,
          error: 'Job not found'
        });
        return;
      }

      res.json({
        success: true,
        data: job
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Create a new sync job
   */
  public async createJob(req: Request, res: Response): Promise<void> {
    try {
      const jobConfig: SyncJobConfig = req.body;
      
      // Validate job configuration
      if (!jobConfig.id || !jobConfig.name || !jobConfig.sources || !jobConfig.schedule) {
        res.status(400).json({
          success: false,
          error: 'Missing required job configuration fields'
        });
        return;
      }

      this.scheduledSyncService.addJob(jobConfig);
      
      res.status(201).json({
        success: true,
        message: 'Sync job created successfully',
        data: jobConfig
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update an existing sync job
   */
  public async updateJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const updates = req.body;

      const existingJob = this.scheduledSyncService.getJobStatus(jobId);
      if (!existingJob) {
        res.status(404).json({
          success: false,
          error: 'Job not found'
        });
        return;
      }

      const updatedJob = { ...existingJob, ...updates };
      this.scheduledSyncService.removeJob(jobId);
      this.scheduledSyncService.addJob(updatedJob);

      res.json({
        success: true,
        message: 'Sync job updated successfully',
        data: updatedJob
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Delete a sync job
   */
  public async deleteJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const success = this.scheduledSyncService.removeJob(jobId);
      
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Job not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Sync job deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Enable a sync job
   */
  public async enableJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const success = this.scheduledSyncService.enableJob(jobId);
      
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Job not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Sync job enabled successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Disable a sync job
   */
  public async disableJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const success = this.scheduledSyncService.disableJob(jobId);
      
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Job not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Sync job disabled successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Trigger manual sync for a specific job
   */
  public async triggerManualSync(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const result = await this.scheduledSyncService.triggerManualSync(jobId);
      
      // Record result in monitoring service
      this.monitoringService.recordSyncResult(result);

      res.json({
        success: true,
        message: 'Manual sync triggered successfully',
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get sync history
   */
  public async getSyncHistory(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const history = this.scheduledSyncService.getSyncHistory(limit);
      
      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get data freshness metrics
   */
  public async getDataFreshness(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.scheduledSyncService.getDataFreshnessMetrics();
      
      // Check for freshness alerts
      this.monitoringService.checkDataFreshness(metrics);

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get incremental changes for a data source
   */
  public async getIncrementalChanges(req: Request, res: Response): Promise<void> {
    try {
      const { source } = req.params;
      const since = req.query.since ? new Date(req.query.since as string) : new Date(Date.now() - 24 * 60 * 60 * 1000);
      const batchSize = parseInt(req.query.batchSize as string) || 100;

      if (!Object.values(DataSourceEnum).includes(source as DataSourceEnum)) {
        res.status(400).json({
          success: false,
          error: 'Invalid data source'
        });
        return;
      }

      const changes = await this.incrementalUpdateService.detectChanges(source as DataSourceEnum, since, batchSize);
      
      res.json({
        success: true,
        data: {
          source,
          since: since.toISOString(),
          changes,
          totalChanges: changes.length
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get change statistics for a data source
   */
  public async getChangeStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { source } = req.params;

      if (!Object.values(DataSourceEnum).includes(source as DataSourceEnum)) {
        res.status(400).json({
          success: false,
          error: 'Invalid data source'
        });
        return;
      }

      const stats = this.incrementalUpdateService.getChangeStatistics(source as DataSourceEnum);
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get monitoring alerts
   */
  public async getAlerts(req: Request, res: Response): Promise<void> {
    try {
      const activeOnly = req.query.active === 'true';
      const alerts = activeOnly ? 
        this.monitoringService.getActiveAlerts() : 
        this.monitoringService.getAllAlerts();
      
      res.json({
        success: true,
        data: alerts
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Acknowledge an alert
   */
  public async acknowledgeAlert(req: Request, res: Response): Promise<void> {
    try {
      const { alertId } = req.params;
      const success = this.monitoringService.acknowledgeAlert(alertId);
      
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Alert not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Alert acknowledged successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Resolve an alert
   */
  public async resolveAlert(req: Request, res: Response): Promise<void> {
    try {
      const { alertId } = req.params;
      const success = this.monitoringService.resolveAlert(alertId);
      
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Alert not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Alert resolved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get sync metrics
   */
  public async getSyncMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { source } = req.query;
      const metrics = this.monitoringService.getSyncMetrics(source as DataSourceEnum);
      
      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get system health status
   */
  public async getHealthStatus(req: Request, res: Response): Promise<void> {
    try {
      const health = this.monitoringService.getHealthStatus();
      const failedSyncAlerts = await this.scheduledSyncService.getFailedSyncAlerts();
      
      res.json({
        success: true,
        data: {
          ...health,
          failedSyncAlerts
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}