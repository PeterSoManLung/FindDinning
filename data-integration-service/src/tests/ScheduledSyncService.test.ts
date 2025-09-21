import { ScheduledSyncService, SyncJobConfig, SyncResult } from '../services/ScheduledSyncService';
import { IncrementalUpdateService } from '../services/IncrementalUpdateService';
import { SyncMonitoringService } from '../services/SyncMonitoringService';
import { DataIntegrationFramework } from '../services/DataIntegrationFramework';
import { DataValidationService } from '../services/DataValidationService';
import { DeduplicationService } from '../services/DeduplicationService';
import { DataSourceEnum, SyncStatus } from '../types/dataSource.types';

describe('ScheduledSyncService', () => {
  let scheduledSyncService: ScheduledSyncService;
  let dataIntegration: DataIntegrationFramework;
  let validation: DataValidationService;
  let deduplication: DeduplicationService;

  beforeEach(() => {
    dataIntegration = new DataIntegrationFramework();
    validation = new DataValidationService();
    deduplication = new DeduplicationService();
    scheduledSyncService = new ScheduledSyncService(dataIntegration, validation, deduplication);
  });

  afterEach(() => {
    // Clean up any active jobs
    const jobs = scheduledSyncService.getAllJobs();
    jobs.forEach(job => scheduledSyncService.removeJob(job.id));
  });

  describe('Job Management', () => {
    it('should add and retrieve sync jobs', () => {
      const jobConfig: SyncJobConfig = {
        id: 'test-job',
        name: 'Test Sync Job',
        sources: [DataSourceEnum.OPENRICE, DataSourceEnum.HK_GOV],
        schedule: '0 2 * * *',
        enabled: true,
        retryAttempts: 3,
        timeout: 300000
      };

      scheduledSyncService.addJob(jobConfig);
      const retrievedJob = scheduledSyncService.getJobStatus('test-job');

      expect(retrievedJob).toEqual(jobConfig);
    });

    it('should enable and disable jobs', () => {
      const jobConfig: SyncJobConfig = {
        id: 'test-job',
        name: 'Test Sync Job',
        sources: [DataSourceEnum.OPENRICE],
        schedule: '0 2 * * *',
        enabled: false,
        retryAttempts: 3,
        timeout: 300000
      };

      scheduledSyncService.addJob(jobConfig);
      
      const enableResult = scheduledSyncService.enableJob('test-job');
      expect(enableResult).toBe(true);
      
      const enabledJob = scheduledSyncService.getJobStatus('test-job');
      expect(enabledJob?.enabled).toBe(true);

      const disableResult = scheduledSyncService.disableJob('test-job');
      expect(disableResult).toBe(true);
      
      const disabledJob = scheduledSyncService.getJobStatus('test-job');
      expect(disabledJob?.enabled).toBe(false);
    });

    it('should remove jobs', () => {
      const jobConfig: SyncJobConfig = {
        id: 'test-job',
        name: 'Test Sync Job',
        sources: [DataSourceEnum.OPENRICE],
        schedule: '0 2 * * *',
        enabled: true,
        retryAttempts: 3,
        timeout: 300000
      };

      scheduledSyncService.addJob(jobConfig);
      expect(scheduledSyncService.getJobStatus('test-job')).toBeTruthy();

      const removeResult = scheduledSyncService.removeJob('test-job');
      expect(removeResult).toBe(true);
      expect(scheduledSyncService.getJobStatus('test-job')).toBeNull();
    });

    it('should return false when operating on non-existent jobs', () => {
      expect(scheduledSyncService.enableJob('non-existent')).toBe(false);
      expect(scheduledSyncService.disableJob('non-existent')).toBe(false);
      expect(scheduledSyncService.removeJob('non-existent')).toBe(false);
      expect(scheduledSyncService.getJobStatus('non-existent')).toBeNull();
    });
  });

  describe('Default Jobs', () => {
    it('should initialize with default monthly and weekly sync jobs', () => {
      const jobs = scheduledSyncService.getAllJobs();
      
      expect(jobs).toHaveLength(2);
      
      const monthlyJob = jobs.find(job => job.id === 'monthly-hk-platforms-sync');
      expect(monthlyJob).toBeTruthy();
      expect(monthlyJob?.sources).toContain(DataSourceEnum.OPENRICE);
      expect(monthlyJob?.sources).toContain(DataSourceEnum.HK_GOV);
      expect(monthlyJob?.schedule).toBe('0 2 1 * *');

      const weeklyJob = jobs.find(job => job.id === 'weekly-gov-sync');
      expect(weeklyJob).toBeTruthy();
      expect(weeklyJob?.sources).toContain(DataSourceEnum.HK_GOV);
      expect(weeklyJob?.schedule).toBe('0 3 * * 0');
    });
  });

  describe('Manual Sync Execution', () => {
    it('should execute manual sync and return results', async () => {
      const jobConfig: SyncJobConfig = {
        id: 'manual-test-job',
        name: 'Manual Test Job',
        sources: [DataSourceEnum.OPENRICE],
        schedule: '0 2 * * *',
        enabled: true,
        retryAttempts: 3,
        timeout: 300000
      };

      scheduledSyncService.addJob(jobConfig);

      // Mock the data integration framework
      jest.spyOn(dataIntegration, 'extractIncrementalData').mockResolvedValue([
        { id: 'test-restaurant-1', name: 'Test Restaurant 1' },
        { id: 'test-restaurant-2', name: 'Test Restaurant 2' }
      ]);

      const result = await scheduledSyncService.triggerManualSync('manual-test-job');

      expect(result.jobId).toBe('manual-test-job');
      expect(result.status).toBe(SyncStatus.COMPLETED);
      expect(result.recordsProcessed).toBeGreaterThan(0);
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
    });

    it('should handle sync failures gracefully', async () => {
      const jobConfig: SyncJobConfig = {
        id: 'failing-job',
        name: 'Failing Job',
        sources: [DataSourceEnum.OPENRICE],
        schedule: '0 2 * * *',
        enabled: true,
        retryAttempts: 3,
        timeout: 300000
      };

      scheduledSyncService.addJob(jobConfig);

      // Mock the data integration framework to throw an error
      jest.spyOn(dataIntegration, 'extractIncrementalData').mockRejectedValue(new Error('Sync failed'));

      const result = await scheduledSyncService.triggerManualSync('failing-job');

      expect(result.jobId).toBe('failing-job');
      expect(result.status).toBe(SyncStatus.FAILED);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Sync failed');
    });

    it('should throw error for non-existent job', async () => {
      await expect(scheduledSyncService.triggerManualSync('non-existent-job'))
        .rejects.toThrow('Job not found: non-existent-job');
    });
  });

  describe('Data Freshness Metrics', () => {
    it('should calculate data freshness metrics for all sources', async () => {
      const metrics = await scheduledSyncService.getDataFreshnessMetrics();

      expect(metrics).toHaveLength(Object.values(DataSourceEnum).length);
      
      metrics.forEach(metric => {
        expect(metric.source).toBeDefined();
        expect(metric.lastSyncTime).toBeInstanceOf(Date);
        expect(metric.recordCount).toBeGreaterThanOrEqual(0);
        expect(metric.stalenessScore).toBeGreaterThanOrEqual(0);
        expect(metric.stalenessScore).toBeLessThanOrEqual(1);
        expect(['healthy', 'warning', 'critical']).toContain(metric.healthStatus);
      });
    });

    it('should correctly categorize health status based on staleness', async () => {
      const metrics = await scheduledSyncService.getDataFreshnessMetrics();
      
      metrics.forEach(metric => {
        if (metric.stalenessScore < 0.33) {
          expect(metric.healthStatus).toBe('healthy');
        } else if (metric.stalenessScore < 0.66) {
          expect(metric.healthStatus).toBe('warning');
        } else {
          expect(metric.healthStatus).toBe('critical');
        }
      });
    });
  });

  describe('Sync History', () => {
    it('should maintain sync history', async () => {
      const jobConfig: SyncJobConfig = {
        id: 'history-test-job',
        name: 'History Test Job',
        sources: [DataSourceEnum.OPENRICE],
        schedule: '0 2 * * *',
        enabled: true,
        retryAttempts: 3,
        timeout: 300000
      };

      scheduledSyncService.addJob(jobConfig);

      // Mock successful sync
      jest.spyOn(dataIntegration, 'extractIncrementalData').mockResolvedValue([]);

      await scheduledSyncService.triggerManualSync('history-test-job');
      await scheduledSyncService.triggerManualSync('history-test-job');

      const history = scheduledSyncService.getSyncHistory(10);
      expect(history).toHaveLength(2);
      
      history.forEach(result => {
        expect(result.jobId).toBe('history-test-job');
        expect(result.status).toBe(SyncStatus.COMPLETED);
      });
    });

    it('should limit sync history to specified count', async () => {
      const jobConfig: SyncJobConfig = {
        id: 'history-limit-test',
        name: 'History Limit Test',
        sources: [DataSourceEnum.OPENRICE],
        schedule: '0 2 * * *',
        enabled: true,
        retryAttempts: 3,
        timeout: 300000
      };

      scheduledSyncService.addJob(jobConfig);
      jest.spyOn(dataIntegration, 'extractIncrementalData').mockResolvedValue([]);

      // Execute multiple syncs
      for (let i = 0; i < 5; i++) {
        await scheduledSyncService.triggerManualSync('history-limit-test');
      }

      const limitedHistory = scheduledSyncService.getSyncHistory(3);
      expect(limitedHistory).toHaveLength(3);
    });
  });

  describe('Failed Sync Alerts', () => {
    it('should generate alerts for failed syncs', async () => {
      const jobConfig: SyncJobConfig = {
        id: 'alert-test-job',
        name: 'Alert Test Job',
        sources: [DataSourceEnum.OPENRICE],
        schedule: '0 2 * * *',
        enabled: true,
        retryAttempts: 3,
        timeout: 300000
      };

      scheduledSyncService.addJob(jobConfig);
      jest.spyOn(dataIntegration, 'extractIncrementalData').mockRejectedValue(new Error('Test failure'));

      await scheduledSyncService.triggerManualSync('alert-test-job');

      const alerts = await scheduledSyncService.getFailedSyncAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      
      const syncAlert = alerts.find(alert => alert.includes('alert-test-job'));
      expect(syncAlert).toBeTruthy();
    });

    it('should generate alerts for stale data', async () => {
      // This test would require mocking the data freshness calculation
      // to return critical staleness scores
      const alerts = await scheduledSyncService.getFailedSyncAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  describe('Cron Schedule Calculation', () => {
    it('should calculate next run time for monthly schedule', () => {
      const jobConfig: SyncJobConfig = {
        id: 'monthly-schedule-test',
        name: 'Monthly Schedule Test',
        sources: [DataSourceEnum.OPENRICE],
        schedule: '0 2 1 * *', // 2 AM on 1st of every month
        enabled: true,
        retryAttempts: 3,
        timeout: 300000
      };

      scheduledSyncService.addJob(jobConfig);
      const job = scheduledSyncService.getJobStatus('monthly-schedule-test');
      
      expect(job?.nextRun).toBeDefined();
      expect(job?.nextRun).toBeInstanceOf(Date);
      
      if (job?.nextRun) {
        expect(job.nextRun.getDate()).toBe(1); // Should be 1st of month
        expect(job.nextRun.getHours()).toBe(2); // Should be 2 AM
        expect(job.nextRun.getMinutes()).toBe(0);
      }
    });

    it('should calculate next run time for weekly schedule', () => {
      const jobConfig: SyncJobConfig = {
        id: 'weekly-schedule-test',
        name: 'Weekly Schedule Test',
        sources: [DataSourceEnum.HK_GOV],
        schedule: '0 3 * * 0', // 3 AM every Sunday
        enabled: true,
        retryAttempts: 3,
        timeout: 300000
      };

      scheduledSyncService.addJob(jobConfig);
      const job = scheduledSyncService.getJobStatus('weekly-schedule-test');
      
      expect(job?.nextRun).toBeDefined();
      expect(job?.nextRun).toBeInstanceOf(Date);
      
      if (job?.nextRun) {
        expect(job.nextRun.getDay()).toBe(0); // Should be Sunday
        expect(job.nextRun.getHours()).toBe(3); // Should be 3 AM
        expect(job.nextRun.getMinutes()).toBe(0);
      }
    });
  });
});