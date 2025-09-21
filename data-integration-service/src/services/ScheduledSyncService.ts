import { DataIntegrationFramework } from './DataIntegrationFramework';
import { DataValidationService } from './DataValidationService';
import { DeduplicationService } from './DeduplicationService';
import { DataSourceEnum, SyncJob, SyncStatus, ConflictResolution } from '../types/dataSource.types';
import { Restaurant } from '../../../shared/src/types/restaurant.types';

export interface SyncJobConfig {
  id: string;
  name: string;
  sources: DataSourceEnum[];
  schedule: string; // cron expression
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  retryAttempts: number;
  timeout: number; // in milliseconds
}

export interface SyncResult {
  jobId: string;
  status: SyncStatus;
  startTime: Date;
  endTime?: Date;
  recordsProcessed: number;
  recordsUpdated: number;
  recordsCreated: number;
  recordsSkipped: number;
  errors: string[];
  conflicts: ConflictResolution[];
}

export interface DataFreshnessMetrics {
  source: DataSourceEnum;
  lastSyncTime: Date;
  recordCount: number;
  stalenessScore: number; // 0-1, where 1 is completely stale
  healthStatus: 'healthy' | 'warning' | 'critical';
}

export class ScheduledSyncService {
  private jobs: Map<string, SyncJobConfig> = new Map();
  private activeJobs: Map<string, NodeJS.Timeout> = new Map();
  private syncHistory: SyncResult[] = [];
  private dataIntegration: DataIntegrationFramework;
  private validation: DataValidationService;
  private deduplication: DeduplicationService;

  constructor(
    dataIntegration: DataIntegrationFramework,
    validation: DataValidationService,
    deduplication: DeduplicationService
  ) {
    this.dataIntegration = dataIntegration;
    this.validation = validation;
    this.deduplication = deduplication;
    this.initializeDefaultJobs();
  }

  private initializeDefaultJobs(): void {
    // Monthly sync job for all Hong Kong platforms
    const monthlySync: SyncJobConfig = {
      id: 'monthly-hk-platforms-sync',
      name: 'Monthly Hong Kong Platforms Synchronization',
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
      schedule: '0 2 1 * *', // 2 AM on the 1st of every month
      enabled: true,
      retryAttempts: 3,
      timeout: 7200000 // 2 hours
    };

    // Weekly government data sync
    const weeklyGovSync: SyncJobConfig = {
      id: 'weekly-gov-sync',
      name: 'Weekly Government Data Synchronization',
      sources: [DataSourceEnum.HK_GOV],
      schedule: '0 3 * * 0', // 3 AM every Sunday
      enabled: true,
      retryAttempts: 2,
      timeout: 1800000 // 30 minutes
    };

    this.addJob(monthlySync);
    this.addJob(weeklyGovSync);
  }

  public addJob(config: SyncJobConfig): void {
    this.jobs.set(config.id, config);
    if (config.enabled) {
      this.scheduleJob(config);
    }
  }

  public removeJob(jobId: string): boolean {
    const timeout = this.activeJobs.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeJobs.delete(jobId);
    }
    return this.jobs.delete(jobId);
  }

  public enableJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.enabled = true;
    this.scheduleJob(job);
    return true;
  }

  public disableJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.enabled = false;
    const timeout = this.activeJobs.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeJobs.delete(jobId);
    }
    return true;
  }

  private scheduleJob(config: SyncJobConfig): void {
    const nextRun = this.calculateNextRun(config.schedule);
    const delay = nextRun.getTime() - Date.now();

    const timeout = setTimeout(async () => {
      await this.executeJob(config);
      // Reschedule for next run
      this.scheduleJob(config);
    }, delay);

    this.activeJobs.set(config.id, timeout);
    config.nextRun = nextRun;
  }

  private calculateNextRun(cronExpression: string): Date {
    // Simple cron parser for basic expressions
    // In production, use a proper cron library like node-cron
    const parts = cronExpression.split(' ');
    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    const now = new Date();
    const next = new Date(now);

    // Handle monthly schedule (0 2 1 * *)
    if (dayOfMonth === '1' && month === '*') {
      next.setMonth(next.getMonth() + 1, 1);
      next.setHours(parseInt(hour), parseInt(minute), 0, 0);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
    }
    // Handle weekly schedule (0 3 * * 0)
    else if (dayOfWeek === '0' && dayOfMonth === '*') {
      const daysUntilSunday = (7 - next.getDay()) % 7 || 7;
      next.setDate(next.getDate() + daysUntilSunday);
      next.setHours(parseInt(hour), parseInt(minute), 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 7);
      }
    }

    return next;
  }

  public async executeJob(config: SyncJobConfig): Promise<SyncResult> {
    const result: SyncResult = {
      jobId: config.id,
      status: SyncStatus.RUNNING,
      startTime: new Date(),
      recordsProcessed: 0,
      recordsUpdated: 0,
      recordsCreated: 0,
      recordsSkipped: 0,
      errors: [],
      conflicts: []
    };

    try {
      console.log(`Starting sync job: ${config.name}`);
      
      // Update last run time
      config.lastRun = result.startTime;

      // Execute sync for each data source
      for (const source of config.sources) {
        try {
          const sourceResult = await this.syncDataSource(source);
          result.recordsProcessed += sourceResult.recordsProcessed;
          result.recordsUpdated += sourceResult.recordsUpdated;
          result.recordsCreated += sourceResult.recordsCreated;
          result.recordsSkipped += sourceResult.recordsSkipped;
          result.conflicts.push(...sourceResult.conflicts);
        } catch (error) {
          const errorMessage = `Failed to sync ${source}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMessage);
          console.error(errorMessage);
        }
      }

      result.status = result.errors.length > 0 ? SyncStatus.COMPLETED_WITH_ERRORS : SyncStatus.COMPLETED;
      result.endTime = new Date();

      console.log(`Sync job completed: ${config.name}`, {
        processed: result.recordsProcessed,
        updated: result.recordsUpdated,
        created: result.recordsCreated,
        errors: result.errors.length
      });

    } catch (error) {
      result.status = SyncStatus.FAILED;
      result.endTime = new Date();
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      console.error(`Sync job failed: ${config.name}`, error);
    }

    this.syncHistory.push(result);
    this.cleanupSyncHistory();

    return result;
  }

  private async syncDataSource(source: DataSourceEnum): Promise<SyncResult> {
    const result: SyncResult = {
      jobId: `${source}-sync`,
      status: SyncStatus.RUNNING,
      startTime: new Date(),
      recordsProcessed: 0,
      recordsUpdated: 0,
      recordsCreated: 0,
      recordsSkipped: 0,
      errors: [],
      conflicts: []
    };

    try {
      // Get incremental updates since last sync
      const lastSyncTime = await this.getLastSyncTime(source);
      const newData = await this.dataIntegration.extractIncrementalData(source, lastSyncTime);

      for (const record of newData) {
        try {
          result.recordsProcessed++;

          // Validate data quality
          const validationResult = await this.validation.validateRestaurantData(record);
          if (!validationResult.isValid) {
            result.recordsSkipped++;
            continue;
          }

          // Check for existing record
          const existingRecord = await this.findExistingRecord(record);
          
          if (existingRecord) {
            // Detect changes
            const hasChanges = await this.detectChanges(existingRecord, record);
            if (hasChanges) {
              // Handle conflicts if data differs significantly
              const conflict = await this.resolveConflicts(existingRecord, record, source);
              if (conflict) {
                result.conflicts.push(conflict);
              }
              
              await this.updateRecord(record);
              result.recordsUpdated++;
            } else {
              result.recordsSkipped++;
            }
          } else {
            // Create new record
            await this.createRecord(record);
            result.recordsCreated++;
          }

        } catch (error) {
          result.errors.push(`Failed to process record ${record.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Update last sync time
      await this.updateLastSyncTime(source, new Date());

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    result.status = result.errors.length > 0 ? SyncStatus.COMPLETED_WITH_ERRORS : SyncStatus.COMPLETED;
    result.endTime = new Date();

    return result;
  }

  private async getLastSyncTime(source: DataSourceEnum): Promise<Date> {
    // In production, this would query the database
    // For now, return a default time (30 days ago)
    const defaultTime = new Date();
    defaultTime.setDate(defaultTime.getDate() - 30);
    return defaultTime;
  }

  private async updateLastSyncTime(source: DataSourceEnum, time: Date): Promise<void> {
    // In production, this would update the database
    console.log(`Updated last sync time for ${source}: ${time.toISOString()}`);
  }

  private async findExistingRecord(record: any): Promise<any | null> {
    // In production, this would query the database
    // For now, simulate finding existing records
    return Math.random() > 0.7 ? { ...record, lastUpdated: new Date(Date.now() - 86400000) } : null;
  }

  private async detectChanges(existing: any, incoming: any): Promise<boolean> {
    // Compare key fields to detect meaningful changes
    const keyFields = ['name', 'address', 'phone', 'operatingHours', 'rating'];
    
    for (const field of keyFields) {
      if (JSON.stringify(existing[field]) !== JSON.stringify(incoming[field])) {
        return true;
      }
    }

    return false;
  }

  private async resolveConflicts(existing: any, incoming: any, source: DataSourceEnum): Promise<ConflictResolution | null> {
    // Implement conflict resolution logic
    const conflicts: string[] = [];
    const resolutions: any = {};

    // Check for rating conflicts
    if (Math.abs(existing.rating - incoming.rating) > 0.5) {
      conflicts.push('rating');
      // Use weighted average based on source reliability
      const sourceWeight = this.getSourceWeight(source);
      resolutions.rating = (existing.rating * 0.7 + incoming.rating * sourceWeight) / (0.7 + sourceWeight);
    }

    // Check for address conflicts
    if (existing.address !== incoming.address) {
      conflicts.push('address');
      // Prefer government data for addresses
      resolutions.address = source === DataSourceEnum.HK_GOV ? incoming.address : existing.address;
    }

    if (conflicts.length > 0) {
      return {
        recordId: existing.id,
        source,
        conflicts,
        resolutions,
        timestamp: new Date(),
        status: 'auto-resolved'
      };
    }

    return null;
  }

  private getSourceWeight(source: DataSourceEnum): number {
    // Define reliability weights for different sources
    const weights = {
      [DataSourceEnum.HK_GOV]: 1.0,
      [DataSourceEnum.OPENRICE]: 0.8,
      [DataSourceEnum.TRIPADVISOR]: 0.7,
      [DataSourceEnum.EATIGO]: 0.6,
      [DataSourceEnum.CHOPE]: 0.6,
      [DataSourceEnum.FOODPANDA]: 0.5,
      [DataSourceEnum.KEETA]: 0.5,
      [DataSourceEnum.BISTROCHAT]: 0.4
    };

    return weights[source] || 0.3;
  }

  private async updateRecord(record: any): Promise<void> {
    // In production, this would update the database
    console.log(`Updated record: ${record.id}`);
  }

  private async createRecord(record: any): Promise<void> {
    // In production, this would create a new database record
    console.log(`Created record: ${record.id}`);
  }

  public async getDataFreshnessMetrics(): Promise<DataFreshnessMetrics[]> {
    const metrics: DataFreshnessMetrics[] = [];

    for (const source of Object.values(DataSourceEnum)) {
      const lastSyncTime = await this.getLastSyncTime(source);
      const staleness = this.calculateStaleness(lastSyncTime);
      
      metrics.push({
        source,
        lastSyncTime,
        recordCount: await this.getRecordCount(source),
        stalenessScore: staleness,
        healthStatus: this.getHealthStatus(staleness)
      });
    }

    return metrics;
  }

  private calculateStaleness(lastSyncTime: Date): number {
    const now = new Date();
    const daysSinceSync = (now.getTime() - lastSyncTime.getTime()) / (1000 * 60 * 60 * 24);
    
    // Consider data stale after 30 days, completely stale after 90 days
    return Math.min(daysSinceSync / 90, 1);
  }

  private getHealthStatus(staleness: number): 'healthy' | 'warning' | 'critical' {
    if (staleness < 0.33) return 'healthy';
    if (staleness < 0.66) return 'warning';
    return 'critical';
  }

  private async getRecordCount(source: DataSourceEnum): Promise<number> {
    // In production, this would query the database
    return Math.floor(Math.random() * 10000) + 1000;
  }

  public getSyncHistory(limit: number = 50): SyncResult[] {
    return this.syncHistory.slice(-limit);
  }

  public getJobStatus(jobId: string): SyncJobConfig | null {
    return this.jobs.get(jobId) || null;
  }

  public getAllJobs(): SyncJobConfig[] {
    return Array.from(this.jobs.values());
  }

  private cleanupSyncHistory(): void {
    // Keep only the last 1000 sync results
    if (this.syncHistory.length > 1000) {
      this.syncHistory = this.syncHistory.slice(-1000);
    }
  }

  public async triggerManualSync(jobId: string): Promise<SyncResult> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    return await this.executeJob(job);
  }

  public async getFailedSyncAlerts(): Promise<string[]> {
    const alerts: string[] = [];
    const recentResults = this.syncHistory.slice(-10);

    for (const result of recentResults) {
      if (result.status === SyncStatus.FAILED) {
        alerts.push(`Sync job ${result.jobId} failed at ${result.startTime.toISOString()}: ${result.errors.join(', ')}`);
      }
    }

    // Check for stale data
    const freshnessMetrics = await this.getDataFreshnessMetrics();
    for (const metric of freshnessMetrics) {
      if (metric.healthStatus === 'critical') {
        alerts.push(`Data source ${metric.source} is critically stale (last sync: ${metric.lastSyncTime.toISOString()})`);
      }
    }

    return alerts;
  }
}