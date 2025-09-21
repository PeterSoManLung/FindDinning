import { S3 } from 'aws-sdk';
import { DataSourceEnum } from '../types/dataSource.types';
import { DataLineageService } from './DataLineageService';

export interface BackupConfig {
  bucketName: string;
  retentionDays: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  backupSchedule: 'daily' | 'weekly' | 'monthly';
}

export interface BackupMetadata {
  backupId: string;
  timestamp: string;
  source: DataSourceEnum | 'all';
  backupType: 'full' | 'incremental' | 'differential';
  recordCount: number;
  sizeBytes: number;
  checksum: string;
  retentionExpiry: string;
  tags: Record<string, string>;
}

export interface RestoreOptions {
  backupId: string;
  targetEnvironment: string;
  validateIntegrity: boolean;
  dryRun: boolean;
  conflictResolution: 'overwrite' | 'merge' | 'skip';
}

export class DataBackupService {
  private s3: S3;
  private lineageService: DataLineageService;
  private config: BackupConfig;

  constructor(config: BackupConfig) {
    this.s3 = new S3({
      region: process.env.AWS_REGION || 'ap-southeast-1'
    });
    this.lineageService = new DataLineageService();
    this.config = config;
  }

  /**
   * Create a full backup of all data
   */
  public async createFullBackup(sources?: DataSourceEnum[]): Promise<BackupMetadata> {
    const backupId = this.generateBackupId('full');
    const timestamp = new Date().toISOString();
    
    console.log('Starting full backup', { backupId, sources });

    try {
      // Get all data to backup
      const backupData = await this.collectBackupData(sources);
      
      // Compress if enabled
      const processedData = this.config.compressionEnabled ? 
        await this.compressData(backupData) : 
        JSON.stringify(backupData);

      // Calculate checksum
      const checksum = this.calculateChecksum(processedData);

      // Upload to S3
      const s3Key = `backups/full/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${backupId}.json${this.config.compressionEnabled ? '.gz' : ''}`;
      
      await this.s3.putObject({
        Bucket: this.config.bucketName,
        Key: s3Key,
        Body: processedData,
        ContentType: this.config.compressionEnabled ? 'application/gzip' : 'application/json',
        ServerSideEncryption: this.config.encryptionEnabled ? 'AES256' : undefined,
        Metadata: {
          backupId,
          timestamp,
          backupType: 'full',
          recordCount: backupData.totalRecords.toString(),
          checksum,
          sources: sources ? sources.join(',') : 'all'
        },
        Tagging: this.buildS3Tags({
          BackupType: 'full',
          Environment: process.env.ENVIRONMENT || 'development',
          CreatedBy: 'data-backup-service'
        })
      }).promise();

      const metadata: BackupMetadata = {
        backupId,
        timestamp,
        source: sources ? (sources.length === 1 ? sources[0] : 'all') : 'all',
        backupType: 'full',
        recordCount: backupData.totalRecords,
        sizeBytes: Buffer.byteLength(processedData),
        checksum,
        retentionExpiry: this.calculateRetentionExpiry(timestamp),
        tags: {
          BackupType: 'full',
          Environment: process.env.ENVIRONMENT || 'development'
        }
      };

      // Record backup in lineage
      await this.recordBackupLineage(metadata);

      console.log('Full backup completed', metadata);
      return metadata;

    } catch (error) {
      console.error('Full backup failed', error);
      throw new Error(`Full backup failed: ${error.message}`);
    }
  }

  /**
   * Create an incremental backup (changes since last backup)
   */
  public async createIncrementalBackup(source: DataSourceEnum, since?: Date): Promise<BackupMetadata> {
    const backupId = this.generateBackupId('incremental');
    const timestamp = new Date().toISOString();
    
    // Get last backup time if not provided
    if (!since) {
      since = await this.getLastBackupTime(source);
    }

    console.log('Starting incremental backup', { backupId, source, since });

    try {
      // Get incremental changes
      const changes = await this.collectIncrementalChanges(source, since);
      
      if (changes.length === 0) {
        console.log('No changes found for incremental backup');
        return null;
      }

      // Process and upload
      const processedData = this.config.compressionEnabled ? 
        await this.compressData(changes) : 
        JSON.stringify(changes);

      const checksum = this.calculateChecksum(processedData);
      const s3Key = `backups/incremental/${source}/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${backupId}.json${this.config.compressionEnabled ? '.gz' : ''}`;
      
      await this.s3.putObject({
        Bucket: this.config.bucketName,
        Key: s3Key,
        Body: processedData,
        ContentType: this.config.compressionEnabled ? 'application/gzip' : 'application/json',
        ServerSideEncryption: this.config.encryptionEnabled ? 'AES256' : undefined,
        Metadata: {
          backupId,
          timestamp,
          backupType: 'incremental',
          recordCount: changes.length.toString(),
          checksum,
          source,
          sinceTimestamp: since.toISOString()
        },
        Tagging: this.buildS3Tags({
          BackupType: 'incremental',
          Source: source,
          Environment: process.env.ENVIRONMENT || 'development'
        })
      }).promise();

      const metadata: BackupMetadata = {
        backupId,
        timestamp,
        source,
        backupType: 'incremental',
        recordCount: changes.length,
        sizeBytes: Buffer.byteLength(processedData),
        checksum,
        retentionExpiry: this.calculateRetentionExpiry(timestamp),
        tags: {
          BackupType: 'incremental',
          Source: source,
          Environment: process.env.ENVIRONMENT || 'development'
        }
      };

      await this.recordBackupLineage(metadata);

      console.log('Incremental backup completed', metadata);
      return metadata;

    } catch (error) {
      console.error('Incremental backup failed', error);
      throw new Error(`Incremental backup failed: ${error.message}`);
    }
  }

  /**
   * List available backups
   */
  public async listBackups(source?: DataSourceEnum, backupType?: 'full' | 'incremental'): Promise<BackupMetadata[]> {
    const prefix = backupType ? `backups/${backupType}/` : 'backups/';
    
    try {
      const response = await this.s3.listObjectsV2({
        Bucket: this.config.bucketName,
        Prefix: prefix,
        MaxKeys: 1000
      }).promise();

      const backups: BackupMetadata[] = [];

      for (const object of response.Contents || []) {
        if (!object.Key) continue;

        // Get object metadata
        const headResponse = await this.s3.headObject({
          Bucket: this.config.bucketName,
          Key: object.Key
        }).promise();

        const metadata = headResponse.Metadata;
        if (!metadata || !metadata.backupId) continue;

        // Filter by source if specified
        if (source && metadata.source !== source && metadata.source !== 'all') {
          continue;
        }

        backups.push({
          backupId: metadata.backupId,
          timestamp: metadata.timestamp,
          source: metadata.source as DataSourceEnum | 'all',
          backupType: metadata.backupType as 'full' | 'incremental',
          recordCount: parseInt(metadata.recordCount || '0'),
          sizeBytes: object.Size || 0,
          checksum: metadata.checksum,
          retentionExpiry: this.calculateRetentionExpiry(metadata.timestamp),
          tags: this.parseS3Tags(headResponse.TagSet)
        });
      }

      // Sort by timestamp (newest first)
      backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return backups;

    } catch (error) {
      console.error('Failed to list backups', error);
      throw new Error(`Failed to list backups: ${error.message}`);
    }
  }

  /**
   * Restore data from backup
   */
  public async restoreFromBackup(options: RestoreOptions): Promise<{
    success: boolean;
    recordsRestored: number;
    conflicts: number;
    errors: string[];
  }> {
    console.log('Starting restore operation', options);

    try {
      // Find backup
      const backup = await this.findBackup(options.backupId);
      if (!backup) {
        throw new Error(`Backup not found: ${options.backupId}`);
      }

      // Download backup data
      const backupData = await this.downloadBackup(backup);

      // Validate integrity if requested
      if (options.validateIntegrity) {
        const isValid = await this.validateBackupIntegrity(backup, backupData);
        if (!isValid) {
          throw new Error('Backup integrity validation failed');
        }
      }

      if (options.dryRun) {
        console.log('Dry run completed - no data was restored');
        return {
          success: true,
          recordsRestored: 0,
          conflicts: 0,
          errors: []
        };
      }

      // Restore data
      const result = await this.performRestore(backupData, options);

      // Record restore operation in lineage
      await this.recordRestoreLineage(backup, options, result);

      console.log('Restore operation completed', result);
      return result;

    } catch (error) {
      console.error('Restore operation failed', error);
      throw new Error(`Restore failed: ${error.message}`);
    }
  }

  /**
   * Clean up expired backups
   */
  public async cleanupExpiredBackups(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    console.log('Starting backup cleanup', { cutoffDate, retentionDays: this.config.retentionDays });

    try {
      const allBackups = await this.listBackups();
      const expiredBackups = allBackups.filter(backup => 
        new Date(backup.timestamp) < cutoffDate
      );

      let deletedCount = 0;

      for (const backup of expiredBackups) {
        try {
          await this.deleteBackup(backup.backupId);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete backup ${backup.backupId}`, error);
        }
      }

      console.log(`Cleanup completed - deleted ${deletedCount} expired backups`);
      return deletedCount;

    } catch (error) {
      console.error('Backup cleanup failed', error);
      throw new Error(`Backup cleanup failed: ${error.message}`);
    }
  }

  private generateBackupId(type: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `${type}-${timestamp}-${random}`;
  }

  private async collectBackupData(sources?: DataSourceEnum[]): Promise<any> {
    // In production, this would collect actual data from the database
    // For now, simulate data collection
    const data = {
      restaurants: [],
      reviews: [],
      users: [],
      metadata: {},
      totalRecords: 0,
      sources: sources || Object.values(DataSourceEnum),
      timestamp: new Date().toISOString()
    };

    // Simulate data collection
    data.totalRecords = Math.floor(Math.random() * 10000) + 1000;
    
    return data;
  }

  private async collectIncrementalChanges(source: DataSourceEnum, since: Date): Promise<any[]> {
    // In production, this would collect actual incremental changes
    // For now, simulate changes
    const changeCount = Math.floor(Math.random() * 100);
    const changes = [];

    for (let i = 0; i < changeCount; i++) {
      changes.push({
        id: `change-${i}`,
        type: 'update',
        timestamp: new Date().toISOString(),
        source,
        data: { /* simulated change data */ }
      });
    }

    return changes;
  }

  private async compressData(data: any): Promise<Buffer> {
    const zlib = require('zlib');
    const jsonString = JSON.stringify(data);
    return new Promise((resolve, reject) => {
      zlib.gzip(jsonString, (error, compressed) => {
        if (error) reject(error);
        else resolve(compressed);
      });
    });
  }

  private calculateChecksum(data: string | Buffer): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private calculateRetentionExpiry(timestamp: string): string {
    const expiry = new Date(timestamp);
    expiry.setDate(expiry.getDate() + this.config.retentionDays);
    return expiry.toISOString();
  }

  private buildS3Tags(tags: Record<string, string>): string {
    return Object.entries(tags)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  }

  private parseS3Tags(tagSet?: any[]): Record<string, string> {
    if (!tagSet) return {};
    
    const tags: Record<string, string> = {};
    for (const tag of tagSet) {
      tags[tag.Key] = tag.Value;
    }
    return tags;
  }

  private async getLastBackupTime(source: DataSourceEnum): Promise<Date> {
    const backups = await this.listBackups(source);
    if (backups.length === 0) {
      // If no previous backup, use 30 days ago
      const defaultTime = new Date();
      defaultTime.setDate(defaultTime.getDate() - 30);
      return defaultTime;
    }
    
    return new Date(backups[0].timestamp);
  }

  private async findBackup(backupId: string): Promise<BackupMetadata | null> {
    const allBackups = await this.listBackups();
    return allBackups.find(backup => backup.backupId === backupId) || null;
  }

  private async downloadBackup(backup: BackupMetadata): Promise<any> {
    // Construct S3 key based on backup metadata
    const keyPrefix = backup.backupType === 'full' ? 'backups/full/' : `backups/incremental/${backup.source}/`;
    const date = new Date(backup.timestamp);
    const s3Key = `${keyPrefix}${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${backup.backupId}.json${this.config.compressionEnabled ? '.gz' : ''}`;

    try {
      const response = await this.s3.getObject({
        Bucket: this.config.bucketName,
        Key: s3Key
      }).promise();

      let data = response.Body as Buffer;

      // Decompress if needed
      if (this.config.compressionEnabled) {
        const zlib = require('zlib');
        data = await new Promise((resolve, reject) => {
          zlib.gunzip(data, (error, decompressed) => {
            if (error) reject(error);
            else resolve(decompressed);
          });
        });
      }

      return JSON.parse(data.toString());

    } catch (error) {
      throw new Error(`Failed to download backup: ${error.message}`);
    }
  }

  private async validateBackupIntegrity(backup: BackupMetadata, data: any): Promise<boolean> {
    // Calculate checksum of downloaded data
    const dataString = JSON.stringify(data);
    const calculatedChecksum = this.calculateChecksum(dataString);
    
    return calculatedChecksum === backup.checksum;
  }

  private async performRestore(backupData: any, options: RestoreOptions): Promise<{
    success: boolean;
    recordsRestored: number;
    conflicts: number;
    errors: string[];
  }> {
    // In production, this would perform actual data restoration
    // For now, simulate the restore process
    const result = {
      success: true,
      recordsRestored: backupData.totalRecords || backupData.length || 0,
      conflicts: Math.floor(Math.random() * 10),
      errors: []
    };

    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    return result;
  }

  private async deleteBackup(backupId: string): Promise<void> {
    const backup = await this.findBackup(backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    // Construct S3 key
    const keyPrefix = backup.backupType === 'full' ? 'backups/full/' : `backups/incremental/${backup.source}/`;
    const date = new Date(backup.timestamp);
    const s3Key = `${keyPrefix}${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${backup.backupId}.json${this.config.compressionEnabled ? '.gz' : ''}`;

    await this.s3.deleteObject({
      Bucket: this.config.bucketName,
      Key: s3Key
    }).promise();

    console.log(`Deleted backup: ${backupId}`);
  }

  private async recordBackupLineage(metadata: BackupMetadata): Promise<void> {
    await this.lineageService.recordLineage({
      source: metadata.source as DataSourceEnum,
      operation: 'sync',
      entityType: 'metadata',
      entityId: metadata.backupId,
      metadata: {
        jobId: metadata.backupId,
        batchId: metadata.backupId
      },
      dataQuality: {
        validationScore: 1.0,
        completenessScore: 1.0,
        accuracyScore: 1.0,
        consistencyScore: 1.0
      },
      compliance: {
        gdprCompliant: true,
        dataRetentionDays: this.config.retentionDays,
        sensitiveDataFields: []
      }
    });
  }

  private async recordRestoreLineage(backup: BackupMetadata, options: RestoreOptions, result: any): Promise<void> {
    await this.lineageService.recordLineage({
      source: backup.source as DataSourceEnum,
      operation: 'update',
      entityType: 'metadata',
      entityId: `restore-${backup.backupId}`,
      metadata: {
        jobId: `restore-${backup.backupId}`,
        batchId: backup.backupId
      },
      changes: {
        backupId: backup.backupId,
        targetEnvironment: options.targetEnvironment,
        recordsRestored: result.recordsRestored,
        conflicts: result.conflicts
      },
      dataQuality: {
        validationScore: result.errors.length === 0 ? 1.0 : 0.8,
        completenessScore: 1.0,
        accuracyScore: 1.0,
        consistencyScore: result.conflicts === 0 ? 1.0 : 0.9
      },
      compliance: {
        gdprCompliant: true,
        dataRetentionDays: this.config.retentionDays,
        sensitiveDataFields: []
      }
    });
  }
}