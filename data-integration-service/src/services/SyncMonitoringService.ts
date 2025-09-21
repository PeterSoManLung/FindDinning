import { DataSourceEnum, SyncStatus } from '../types/dataSource.types';
import { SyncResult, DataFreshnessMetrics } from './ScheduledSyncService';

export interface AlertRule {
  id: string;
  name: string;
  condition: AlertCondition;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownPeriod: number; // in milliseconds
  lastTriggered?: Date;
}

export interface AlertCondition {
  type: 'sync_failure' | 'data_staleness' | 'error_rate' | 'performance' | 'data_quality';
  threshold: number;
  timeWindow: number; // in milliseconds
  source?: DataSourceEnum;
}

export interface Alert {
  id: string;
  ruleId: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  source?: DataSourceEnum;
  metadata: Record<string, any>;
  acknowledged: boolean;
  resolvedAt?: Date;
}

export interface SyncMetrics {
  source: DataSourceEnum;
  successRate: number;
  averageProcessingTime: number;
  errorRate: number;
  recordsPerSecond: number;
  lastSuccessfulSync: Date;
  consecutiveFailures: number;
}

export class SyncMonitoringService {
  private alerts: Alert[] = [];
  private alertRules: Map<string, AlertRule> = new Map();
  private syncMetrics: Map<DataSourceEnum, SyncMetrics> = new Map();
  private performanceHistory: Map<string, number[]> = new Map();

  constructor() {
    this.initializeDefaultAlertRules();
  }

  private initializeDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'sync-failure-critical',
        name: 'Critical Sync Failure',
        condition: {
          type: 'sync_failure',
          threshold: 3, // 3 consecutive failures
          timeWindow: 86400000 // 24 hours
        },
        severity: 'critical',
        enabled: true,
        cooldownPeriod: 3600000 // 1 hour
      },
      {
        id: 'data-staleness-warning',
        name: 'Data Staleness Warning',
        condition: {
          type: 'data_staleness',
          threshold: 0.7, // 70% staleness
          timeWindow: 86400000 // 24 hours
        },
        severity: 'medium',
        enabled: true,
        cooldownPeriod: 21600000 // 6 hours
      },
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        condition: {
          type: 'error_rate',
          threshold: 0.1, // 10% error rate
          timeWindow: 3600000 // 1 hour
        },
        severity: 'high',
        enabled: true,
        cooldownPeriod: 1800000 // 30 minutes
      },
      {
        id: 'slow-performance',
        name: 'Slow Sync Performance',
        condition: {
          type: 'performance',
          threshold: 300000, // 5 minutes
          timeWindow: 3600000 // 1 hour
        },
        severity: 'medium',
        enabled: true,
        cooldownPeriod: 3600000 // 1 hour
      },
      {
        id: 'data-quality-degradation',
        name: 'Data Quality Degradation',
        condition: {
          type: 'data_quality',
          threshold: 0.8, // 80% quality threshold
          timeWindow: 86400000 // 24 hours
        },
        severity: 'high',
        enabled: true,
        cooldownPeriod: 7200000 // 2 hours
      }
    ];

    defaultRules.forEach(rule => this.alertRules.set(rule.id, rule));
  }

  public recordSyncResult(result: SyncResult): void {
    // Update metrics
    this.updateSyncMetrics(result);

    // Check alert conditions
    this.checkAlertConditions(result);

    // Record performance data
    if (result.endTime && result.startTime) {
      const duration = result.endTime.getTime() - result.startTime.getTime();
      this.recordPerformanceMetric(result.jobId, duration);
    }
  }

  private updateSyncMetrics(result: SyncResult): void {
    // Extract source from job ID (assuming format like "source-sync")
    const source = this.extractSourceFromJobId(result.jobId);
    if (!source) return;

    let metrics = this.syncMetrics.get(source);
    if (!metrics) {
      metrics = {
        source,
        successRate: 0,
        averageProcessingTime: 0,
        errorRate: 0,
        recordsPerSecond: 0,
        lastSuccessfulSync: new Date(0),
        consecutiveFailures: 0
      };
      this.syncMetrics.set(source, metrics);
    }

    // Update success rate and consecutive failures
    if (result.status === SyncStatus.COMPLETED) {
      metrics.consecutiveFailures = 0;
      metrics.lastSuccessfulSync = result.endTime || new Date();
    } else if (result.status === SyncStatus.FAILED) {
      metrics.consecutiveFailures++;
    }

    // Update error rate
    const totalRecords = result.recordsProcessed;
    const errorCount = result.errors.length;
    if (totalRecords > 0) {
      metrics.errorRate = errorCount / totalRecords;
    }

    // Update processing speed
    if (result.endTime && result.startTime && result.recordsProcessed > 0) {
      const duration = (result.endTime.getTime() - result.startTime.getTime()) / 1000; // seconds
      metrics.recordsPerSecond = result.recordsProcessed / duration;
      metrics.averageProcessingTime = duration;
    }

    // Calculate success rate from recent history
    metrics.successRate = this.calculateSuccessRate(source);
  }

  private extractSourceFromJobId(jobId: string): DataSourceEnum | null {
    // Extract source from job ID patterns
    for (const source of Object.values(DataSourceEnum)) {
      if (jobId.toLowerCase().includes(source.toLowerCase())) {
        return source;
      }
    }
    return null;
  }

  private calculateSuccessRate(source: DataSourceEnum): number {
    // In production, this would calculate from historical data
    // For now, simulate based on consecutive failures
    const metrics = this.syncMetrics.get(source);
    if (!metrics) return 0;

    if (metrics.consecutiveFailures === 0) return 1.0;
    if (metrics.consecutiveFailures <= 2) return 0.8;
    if (metrics.consecutiveFailures <= 5) return 0.5;
    return 0.2;
  }

  private recordPerformanceMetric(jobId: string, duration: number): void {
    const history = this.performanceHistory.get(jobId) || [];
    history.push(duration);

    // Keep only last 100 measurements
    if (history.length > 100) {
      history.shift();
    }

    this.performanceHistory.set(jobId, history);
  }

  private checkAlertConditions(result: SyncResult): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;

      // Check cooldown period
      if (rule.lastTriggered) {
        const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
        if (timeSinceLastTrigger < rule.cooldownPeriod) {
          continue;
        }
      }

      const shouldTrigger = this.evaluateAlertCondition(rule, result);
      if (shouldTrigger) {
        this.triggerAlert(rule, result);
      }
    }
  }

  private evaluateAlertCondition(rule: AlertRule, result: SyncResult): boolean {
    const { condition } = rule;
    const source = this.extractSourceFromJobId(result.jobId);

    switch (condition.type) {
      case 'sync_failure':
        if (result.status === SyncStatus.FAILED) {
          const metrics = source ? this.syncMetrics.get(source) : null;
          return metrics ? metrics.consecutiveFailures >= condition.threshold : false;
        }
        return false;

      case 'error_rate':
        const totalRecords = result.recordsProcessed;
        const errorCount = result.errors.length;
        if (totalRecords > 0) {
          const errorRate = errorCount / totalRecords;
          return errorRate >= condition.threshold;
        }
        return false;

      case 'performance':
        if (result.endTime && result.startTime) {
          const duration = result.endTime.getTime() - result.startTime.getTime();
          return duration >= condition.threshold;
        }
        return false;

      case 'data_staleness':
        // This would be checked separately with freshness metrics
        return false;

      case 'data_quality':
        // Calculate data quality score based on validation results
        const qualityScore = this.calculateDataQualityScore(result);
        return qualityScore < condition.threshold;

      default:
        return false;
    }
  }

  private calculateDataQualityScore(result: SyncResult): number {
    // Calculate quality score based on various factors
    const totalRecords = result.recordsProcessed;
    if (totalRecords === 0) return 1.0;

    const successfulRecords = result.recordsCreated + result.recordsUpdated;
    const skippedRecords = result.recordsSkipped;
    const errorCount = result.errors.length;

    // Quality score based on successful processing and low error rate
    const successRate = successfulRecords / totalRecords;
    const errorRate = errorCount / totalRecords;
    const skipRate = skippedRecords / totalRecords;

    // Penalize high error rates and skip rates
    return Math.max(0, successRate - errorRate - (skipRate * 0.5));
  }

  private triggerAlert(rule: AlertRule, result: SyncResult): void {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      ruleId: rule.id,
      message: this.generateAlertMessage(rule, result),
      severity: rule.severity,
      timestamp: new Date(),
      source: this.extractSourceFromJobId(result.jobId) || undefined,
      metadata: {
        jobId: result.jobId,
        syncResult: result,
        ruleName: rule.name
      },
      acknowledged: false
    };

    this.alerts.push(alert);
    rule.lastTriggered = new Date();

    // Log alert
    console.error(`ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);

    // In production, this would send notifications (email, Slack, etc.)
    this.sendNotification(alert);
  }

  private generateAlertMessage(rule: AlertRule, result: SyncResult): string {
    const source = this.extractSourceFromJobId(result.jobId);
    
    switch (rule.condition.type) {
      case 'sync_failure':
        return `Sync job ${result.jobId} has failed ${this.syncMetrics.get(source!)?.consecutiveFailures || 0} consecutive times`;
      
      case 'error_rate':
        const errorRate = result.errors.length / Math.max(result.recordsProcessed, 1);
        return `High error rate detected in ${result.jobId}: ${(errorRate * 100).toFixed(1)}% (${result.errors.length} errors out of ${result.recordsProcessed} records)`;
      
      case 'performance':
        const duration = result.endTime && result.startTime ? 
          (result.endTime.getTime() - result.startTime.getTime()) / 1000 : 0;
        return `Sync job ${result.jobId} took ${duration.toFixed(1)} seconds to complete, exceeding threshold of ${rule.condition.threshold / 1000} seconds`;
      
      case 'data_quality':
        const qualityScore = this.calculateDataQualityScore(result);
        return `Data quality degradation detected in ${result.jobId}: quality score ${(qualityScore * 100).toFixed(1)}% below threshold of ${(rule.condition.threshold * 100).toFixed(1)}%`;
      
      default:
        return `Alert condition met for rule: ${rule.name}`;
    }
  }

  private sendNotification(alert: Alert): void {
    // In production, implement actual notification sending
    // For now, just log the notification
    console.log(`Notification sent for alert: ${alert.id}`);
  }

  public checkDataFreshness(metrics: DataFreshnessMetrics[]): void {
    for (const metric of metrics) {
      for (const rule of this.alertRules.values()) {
        if (rule.condition.type === 'data_staleness' && rule.enabled) {
          if (metric.stalenessScore >= rule.condition.threshold) {
            // Check cooldown
            if (rule.lastTriggered) {
              const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
              if (timeSinceLastTrigger < rule.cooldownPeriod) {
                continue;
              }
            }

            const alert: Alert = {
              id: `alert-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              ruleId: rule.id,
              message: `Data source ${metric.source} is ${(metric.stalenessScore * 100).toFixed(1)}% stale (last sync: ${metric.lastSyncTime.toISOString()})`,
              severity: rule.severity,
              timestamp: new Date(),
              source: metric.source,
              metadata: {
                freshnessMetric: metric,
                ruleName: rule.name
              },
              acknowledged: false
            };

            this.alerts.push(alert);
            rule.lastTriggered = new Date();
            this.sendNotification(alert);
          }
        }
      }
    }
  }

  public getActiveAlerts(): Alert[] {
    return this.alerts.filter(alert => !alert.acknowledged && !alert.resolvedAt);
  }

  public getAllAlerts(limit: number = 100): Alert[] {
    return this.alerts.slice(-limit);
  }

  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolvedAt = new Date();
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  public getSyncMetrics(source?: DataSourceEnum): SyncMetrics[] {
    if (source) {
      const metrics = this.syncMetrics.get(source);
      return metrics ? [metrics] : [];
    }
    return Array.from(this.syncMetrics.values());
  }

  public getPerformanceHistory(jobId: string): number[] {
    return this.performanceHistory.get(jobId) || [];
  }

  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  public removeAlertRule(ruleId: string): boolean {
    return this.alertRules.delete(ruleId);
  }

  public updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.alertRules.get(ruleId);
    if (rule) {
      Object.assign(rule, updates);
      return true;
    }
    return false;
  }

  public getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  public getHealthStatus(): {
    overall: 'healthy' | 'warning' | 'critical';
    activeAlerts: number;
    criticalAlerts: number;
    sourcesWithIssues: DataSourceEnum[];
  } {
    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
    
    const sourcesWithIssues = Array.from(new Set(
      activeAlerts
        .filter(a => a.source)
        .map(a => a.source!)
    ));

    let overall: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (criticalAlerts.length > 0) {
      overall = 'critical';
    } else if (activeAlerts.length > 0) {
      overall = 'warning';
    }

    return {
      overall,
      activeAlerts: activeAlerts.length,
      criticalAlerts: criticalAlerts.length,
      sourcesWithIssues
    };
  }
}