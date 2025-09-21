import { SyncMonitoringService, AlertRule, Alert, SyncMetrics } from '../services/SyncMonitoringService';
import { SyncResult, DataFreshnessMetrics } from '../services/ScheduledSyncService';
import { DataSourceEnum, SyncStatus } from '../types/dataSource.types';

describe('SyncMonitoringService', () => {
  let monitoringService: SyncMonitoringService;

  beforeEach(() => {
    monitoringService = new SyncMonitoringService();
  });

  describe('Default Alert Rules', () => {
    it('should initialize with default alert rules', () => {
      const rules = monitoringService.getAlertRules();
      
      expect(rules.length).toBeGreaterThan(0);
      
      const criticalSyncFailure = rules.find(rule => rule.id === 'sync-failure-critical');
      expect(criticalSyncFailure).toBeTruthy();
      expect(criticalSyncFailure?.severity).toBe('critical');
      expect(criticalSyncFailure?.condition.type).toBe('sync_failure');
      
      const dataStalenesss = rules.find(rule => rule.id === 'data-staleness-warning');
      expect(dataStalenesss).toBeTruthy();
      expect(dataStalenesss?.severity).toBe('medium');
      
      const highErrorRate = rules.find(rule => rule.id === 'high-error-rate');
      expect(highErrorRate).toBeTruthy();
      expect(highErrorRate?.condition.type).toBe('error_rate');
    });
  });

  describe('Sync Result Recording', () => {
    it('should record successful sync results', () => {
      const syncResult: SyncResult = {
        jobId: 'openrice-sync',
        status: SyncStatus.COMPLETED,
        startTime: new Date(Date.now() - 60000), // 1 minute ago
        endTime: new Date(),
        recordsProcessed: 100,
        recordsUpdated: 20,
        recordsCreated: 5,
        recordsSkipped: 75,
        errors: [],
        conflicts: []
      };

      monitoringService.recordSyncResult(syncResult);

      const metrics = monitoringService.getSyncMetrics(DataSourceEnum.OPENRICE);
      expect(metrics).toHaveLength(1);
      expect(metrics[0].source).toBe(DataSourceEnum.OPENRICE);
      expect(metrics[0].consecutiveFailures).toBe(0);
      expect(metrics[0].lastSuccessfulSync).toEqual(syncResult.endTime);
    });

    it('should record failed sync results', () => {
      const syncResult: SyncResult = {
        jobId: 'openrice-sync',
        status: SyncStatus.FAILED,
        startTime: new Date(Date.now() - 60000),
        endTime: new Date(),
        recordsProcessed: 0,
        recordsUpdated: 0,
        recordsCreated: 0,
        recordsSkipped: 0,
        errors: ['Connection timeout', 'Authentication failed'],
        conflicts: []
      };

      monitoringService.recordSyncResult(syncResult);

      const metrics = monitoringService.getSyncMetrics(DataSourceEnum.OPENRICE);
      expect(metrics).toHaveLength(1);
      expect(metrics[0].consecutiveFailures).toBe(1);
    });

    it('should calculate processing speed metrics', () => {
      const syncResult: SyncResult = {
        jobId: 'openrice-sync',
        status: SyncStatus.COMPLETED,
        startTime: new Date(Date.now() - 120000), // 2 minutes ago
        endTime: new Date(),
        recordsProcessed: 120, // 1 record per second
        recordsUpdated: 60,
        recordsCreated: 60,
        recordsSkipped: 0,
        errors: [],
        conflicts: []
      };

      monitoringService.recordSyncResult(syncResult);

      const metrics = monitoringService.getSyncMetrics(DataSourceEnum.OPENRICE);
      expect(metrics[0].recordsPerSecond).toBeCloseTo(1, 1);
      expect(metrics[0].averageProcessingTime).toBeCloseTo(120, 0);
    });
  });

  describe('Alert Triggering', () => {
    it('should trigger alert for consecutive sync failures', () => {
      // Create multiple failed sync results
      for (let i = 0; i < 4; i++) {
        const syncResult: SyncResult = {
          jobId: 'openrice-sync',
          status: SyncStatus.FAILED,
          startTime: new Date(Date.now() - 60000),
          endTime: new Date(),
          recordsProcessed: 0,
          recordsUpdated: 0,
          recordsCreated: 0,
          recordsSkipped: 0,
          errors: [`Failure ${i + 1}`],
          conflicts: []
        };

        monitoringService.recordSyncResult(syncResult);
      }

      const activeAlerts = monitoringService.getActiveAlerts();
      const syncFailureAlert = activeAlerts.find(alert => 
        alert.ruleId === 'sync-failure-critical'
      );
      
      expect(syncFailureAlert).toBeTruthy();
      expect(syncFailureAlert?.severity).toBe('critical');
      expect(syncFailureAlert?.source).toBe(DataSourceEnum.OPENRICE);
    });

    it('should trigger alert for high error rate', () => {
      const syncResult: SyncResult = {
        jobId: 'openrice-sync',
        status: SyncStatus.COMPLETED_WITH_ERRORS,
        startTime: new Date(Date.now() - 60000),
        endTime: new Date(),
        recordsProcessed: 100,
        recordsUpdated: 80,
        recordsCreated: 0,
        recordsSkipped: 0,
        errors: Array(15).fill('Processing error'), // 15% error rate
        conflicts: []
      };

      monitoringService.recordSyncResult(syncResult);

      const activeAlerts = monitoringService.getActiveAlerts();
      const errorRateAlert = activeAlerts.find(alert => 
        alert.ruleId === 'high-error-rate'
      );
      
      expect(errorRateAlert).toBeTruthy();
      expect(errorRateAlert?.severity).toBe('high');
    });

    it('should trigger alert for slow performance', () => {
      const syncResult: SyncResult = {
        jobId: 'openrice-sync',
        status: SyncStatus.COMPLETED,
        startTime: new Date(Date.now() - 400000), // 6.67 minutes ago (> 5 minute threshold)
        endTime: new Date(),
        recordsProcessed: 100,
        recordsUpdated: 100,
        recordsCreated: 0,
        recordsSkipped: 0,
        errors: [],
        conflicts: []
      };

      monitoringService.recordSyncResult(syncResult);

      const activeAlerts = monitoringService.getActiveAlerts();
      const performanceAlert = activeAlerts.find(alert => 
        alert.ruleId === 'slow-performance'
      );
      
      expect(performanceAlert).toBeTruthy();
      expect(performanceAlert?.severity).toBe('medium');
    });

    it('should respect cooldown periods', () => {
      // Trigger first alert
      const syncResult: SyncResult = {
        jobId: 'openrice-sync',
        status: SyncStatus.FAILED,
        startTime: new Date(Date.now() - 60000),
        endTime: new Date(),
        recordsProcessed: 0,
        recordsUpdated: 0,
        recordsCreated: 0,
        recordsSkipped: 0,
        errors: ['First failure'],
        conflicts: []
      };

      // Record multiple failures to trigger alert
      for (let i = 0; i < 4; i++) {
        monitoringService.recordSyncResult(syncResult);
      }

      const alertsAfterFirst = monitoringService.getActiveAlerts();
      const firstAlertCount = alertsAfterFirst.length;

      // Record another failure immediately (should not trigger new alert due to cooldown)
      monitoringService.recordSyncResult(syncResult);

      const alertsAfterSecond = monitoringService.getActiveAlerts();
      expect(alertsAfterSecond.length).toBe(firstAlertCount);
    });
  });

  describe('Data Freshness Monitoring', () => {
    it('should trigger alerts for stale data', () => {
      const staleMetrics: DataFreshnessMetrics[] = [
        {
          source: DataSourceEnum.OPENRICE,
          lastSyncTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          recordCount: 1000,
          stalenessScore: 0.8, // 80% stale (above 70% threshold)
          healthStatus: 'critical'
        }
      ];

      monitoringService.checkDataFreshness(staleMetrics);

      const activeAlerts = monitoringService.getActiveAlerts();
      const stalenessAlert = activeAlerts.find(alert => 
        alert.ruleId === 'data-staleness-warning'
      );
      
      expect(stalenessAlert).toBeTruthy();
      expect(stalenessAlert?.source).toBe(DataSourceEnum.OPENRICE);
      expect(stalenessAlert?.message).toContain('80.0% stale');
    });

    it('should not trigger alerts for fresh data', () => {
      const freshMetrics: DataFreshnessMetrics[] = [
        {
          source: DataSourceEnum.OPENRICE,
          lastSyncTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
          recordCount: 1000,
          stalenessScore: 0.1, // 10% stale (below threshold)
          healthStatus: 'healthy'
        }
      ];

      const alertsBefore = monitoringService.getActiveAlerts().length;
      monitoringService.checkDataFreshness(freshMetrics);
      const alertsAfter = monitoringService.getActiveAlerts().length;

      expect(alertsAfter).toBe(alertsBefore);
    });
  });

  describe('Alert Management', () => {
    it('should acknowledge alerts', () => {
      // Create an alert
      const syncResult: SyncResult = {
        jobId: 'openrice-sync',
        status: SyncStatus.FAILED,
        startTime: new Date(),
        endTime: new Date(),
        recordsProcessed: 0,
        recordsUpdated: 0,
        recordsCreated: 0,
        recordsSkipped: 0,
        errors: ['Test error'],
        conflicts: []
      };

      for (let i = 0; i < 4; i++) {
        monitoringService.recordSyncResult(syncResult);
      }

      const activeAlerts = monitoringService.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);

      const alertId = activeAlerts[0].id;
      const acknowledged = monitoringService.acknowledgeAlert(alertId);
      
      expect(acknowledged).toBe(true);
      
      const updatedActiveAlerts = monitoringService.getActiveAlerts();
      expect(updatedActiveAlerts.length).toBe(activeAlerts.length - 1);
    });

    it('should resolve alerts', () => {
      // Create an alert
      const syncResult: SyncResult = {
        jobId: 'openrice-sync',
        status: SyncStatus.FAILED,
        startTime: new Date(),
        endTime: new Date(),
        recordsProcessed: 0,
        recordsUpdated: 0,
        recordsCreated: 0,
        recordsSkipped: 0,
        errors: ['Test error'],
        conflicts: []
      };

      for (let i = 0; i < 4; i++) {
        monitoringService.recordSyncResult(syncResult);
      }

      const activeAlerts = monitoringService.getActiveAlerts();
      const alertId = activeAlerts[0].id;
      
      const resolved = monitoringService.resolveAlert(alertId);
      expect(resolved).toBe(true);

      const allAlerts = monitoringService.getAllAlerts();
      const resolvedAlert = allAlerts.find(alert => alert.id === alertId);
      expect(resolvedAlert?.resolvedAt).toBeDefined();
      expect(resolvedAlert?.acknowledged).toBe(true);
    });

    it('should return false for non-existent alert operations', () => {
      expect(monitoringService.acknowledgeAlert('non-existent')).toBe(false);
      expect(monitoringService.resolveAlert('non-existent')).toBe(false);
    });
  });

  describe('Alert Rule Management', () => {
    it('should add custom alert rules', () => {
      const customRule: AlertRule = {
        id: 'custom-rule',
        name: 'Custom Test Rule',
        condition: {
          type: 'error_rate',
          threshold: 0.05,
          timeWindow: 1800000
        },
        severity: 'low',
        enabled: true,
        cooldownPeriod: 900000
      };

      monitoringService.addAlertRule(customRule);
      
      const rules = monitoringService.getAlertRules();
      const addedRule = rules.find(rule => rule.id === 'custom-rule');
      
      expect(addedRule).toEqual(customRule);
    });

    it('should update existing alert rules', () => {
      const ruleId = 'high-error-rate';
      const updates = { threshold: 0.05, enabled: false };
      
      const updated = monitoringService.updateAlertRule(ruleId, updates);
      expect(updated).toBe(true);
      
      const rules = monitoringService.getAlertRules();
      const updatedRule = rules.find(rule => rule.id === ruleId);
      
      expect(updatedRule?.condition.threshold).toBe(0.05);
      expect(updatedRule?.enabled).toBe(false);
    });

    it('should remove alert rules', () => {
      const rulesBefore = monitoringService.getAlertRules().length;
      
      const removed = monitoringService.removeAlertRule('high-error-rate');
      expect(removed).toBe(true);
      
      const rulesAfter = monitoringService.getAlertRules().length;
      expect(rulesAfter).toBe(rulesBefore - 1);
    });

    it('should return false for operations on non-existent rules', () => {
      expect(monitoringService.updateAlertRule('non-existent', {})).toBe(false);
      expect(monitoringService.removeAlertRule('non-existent')).toBe(false);
    });
  });

  describe('Performance History', () => {
    it('should track performance history for jobs', () => {
      const jobId = 'openrice-sync';
      const syncResult: SyncResult = {
        jobId,
        status: SyncStatus.COMPLETED,
        startTime: new Date(Date.now() - 120000), // 2 minutes ago
        endTime: new Date(),
        recordsProcessed: 100,
        recordsUpdated: 100,
        recordsCreated: 0,
        recordsSkipped: 0,
        errors: [],
        conflicts: []
      };

      monitoringService.recordSyncResult(syncResult);

      const history = monitoringService.getPerformanceHistory(jobId);
      expect(history).toHaveLength(1);
      expect(history[0]).toBeCloseTo(120000, -3); // 2 minutes in milliseconds
    });

    it('should limit performance history to 100 entries', () => {
      const jobId = 'performance-test';
      
      // Record 150 sync results
      for (let i = 0; i < 150; i++) {
        const syncResult: SyncResult = {
          jobId,
          status: SyncStatus.COMPLETED,
          startTime: new Date(Date.now() - 60000),
          endTime: new Date(),
          recordsProcessed: 10,
          recordsUpdated: 10,
          recordsCreated: 0,
          recordsSkipped: 0,
          errors: [],
          conflicts: []
        };

        monitoringService.recordSyncResult(syncResult);
      }

      const history = monitoringService.getPerformanceHistory(jobId);
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Health Status', () => {
    it('should report healthy status with no alerts', () => {
      const health = monitoringService.getHealthStatus();
      
      expect(health.overall).toBe('healthy');
      expect(health.activeAlerts).toBe(0);
      expect(health.criticalAlerts).toBe(0);
      expect(health.sourcesWithIssues).toHaveLength(0);
    });

    it('should report warning status with non-critical alerts', () => {
      // Create a medium severity alert
      const syncResult: SyncResult = {
        jobId: 'openrice-sync',
        status: SyncStatus.COMPLETED,
        startTime: new Date(Date.now() - 400000), // Slow performance
        endTime: new Date(),
        recordsProcessed: 100,
        recordsUpdated: 100,
        recordsCreated: 0,
        recordsSkipped: 0,
        errors: [],
        conflicts: []
      };

      monitoringService.recordSyncResult(syncResult);

      const health = monitoringService.getHealthStatus();
      expect(health.overall).toBe('warning');
      expect(health.activeAlerts).toBeGreaterThan(0);
      expect(health.criticalAlerts).toBe(0);
    });

    it('should report critical status with critical alerts', () => {
      // Create critical alerts by failing sync multiple times
      for (let i = 0; i < 4; i++) {
        const syncResult: SyncResult = {
          jobId: 'openrice-sync',
          status: SyncStatus.FAILED,
          startTime: new Date(),
          endTime: new Date(),
          recordsProcessed: 0,
          recordsUpdated: 0,
          recordsCreated: 0,
          recordsSkipped: 0,
          errors: ['Critical failure'],
          conflicts: []
        };

        monitoringService.recordSyncResult(syncResult);
      }

      const health = monitoringService.getHealthStatus();
      expect(health.overall).toBe('critical');
      expect(health.criticalAlerts).toBeGreaterThan(0);
      expect(health.sourcesWithIssues).toContain(DataSourceEnum.OPENRICE);
    });
  });

  describe('Data Quality Scoring', () => {
    it('should calculate data quality scores correctly', () => {
      const service = monitoringService as any;
      
      // High quality result
      const highQualityResult: SyncResult = {
        jobId: 'test',
        status: SyncStatus.COMPLETED,
        startTime: new Date(),
        endTime: new Date(),
        recordsProcessed: 100,
        recordsUpdated: 90,
        recordsCreated: 10,
        recordsSkipped: 0,
        errors: [],
        conflicts: []
      };

      const highScore = service.calculateDataQualityScore(highQualityResult);
      expect(highScore).toBeGreaterThan(0.8);

      // Low quality result
      const lowQualityResult: SyncResult = {
        jobId: 'test',
        status: SyncStatus.COMPLETED_WITH_ERRORS,
        startTime: new Date(),
        endTime: new Date(),
        recordsProcessed: 100,
        recordsUpdated: 20,
        recordsCreated: 0,
        recordsSkipped: 60,
        errors: Array(20).fill('Error'),
        conflicts: []
      };

      const lowScore = service.calculateDataQualityScore(lowQualityResult);
      expect(lowScore).toBeLessThan(highScore);
    });
  });
});