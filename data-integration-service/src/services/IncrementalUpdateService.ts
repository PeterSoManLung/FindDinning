import { DataSourceEnum } from '../types/dataSource.types';
import { Restaurant } from '../../../shared/src/types/restaurant.types';

export interface ChangeDetectionResult {
  recordId: string;
  changeType: 'created' | 'updated' | 'deleted';
  changedFields: string[];
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
  confidence: number; // 0-1 confidence in change detection
  timestamp: Date;
}

export interface IncrementalUpdateConfig {
  source: DataSourceEnum;
  checkInterval: number; // in milliseconds
  batchSize: number;
  changeThreshold: number; // minimum change significance to trigger update
}

export class IncrementalUpdateService {
  private changeLog: Map<string, ChangeDetectionResult[]> = new Map();
  private lastCheckTimes: Map<DataSource, Date> = new Map();

  public async detectChanges(
    source: DataSourceEnum,
    since: Date,
    batchSize: number = 100
  ): Promise<ChangeDetectionResult[]> {
    const changes: ChangeDetectionResult[] = [];

    try {
      // Get current data from source
      const currentData = await this.fetchCurrentData(source, since, batchSize);
      
      // Get stored data for comparison
      const storedData = await this.fetchStoredData(source, since, batchSize);

      // Create lookup maps for efficient comparison
      const currentMap = new Map(currentData.map(item => [item.id, item]));
      const storedMap = new Map(storedData.map(item => [item.id, item]));

      // Detect new records
      for (const [id, current] of currentMap) {
        if (!storedMap.has(id)) {
          changes.push({
            recordId: id,
            changeType: 'created',
            changedFields: Object.keys(current),
            oldValues: {},
            newValues: current,
            confidence: 1.0,
            timestamp: new Date()
          });
        }
      }

      // Detect updated records
      for (const [id, current] of currentMap) {
        const stored = storedMap.get(id);
        if (stored) {
          const fieldChanges = this.compareRecords(stored, current);
          if (fieldChanges.changedFields.length > 0) {
            changes.push({
              recordId: id,
              changeType: 'updated',
              changedFields: fieldChanges.changedFields,
              oldValues: fieldChanges.oldValues,
              newValues: fieldChanges.newValues,
              confidence: fieldChanges.confidence,
              timestamp: new Date()
            });
          }
        }
      }

      // Detect deleted records
      for (const [id, stored] of storedMap) {
        if (!currentMap.has(id)) {
          // Verify deletion by checking if record still exists in source
          const stillExists = await this.verifyRecordExists(source, id);
          if (!stillExists) {
            changes.push({
              recordId: id,
              changeType: 'deleted',
              changedFields: Object.keys(stored),
              oldValues: stored,
              newValues: {},
              confidence: 0.9, // Slightly lower confidence for deletions
              timestamp: new Date()
            });
          }
        }
      }

      // Store changes in log
      this.logChanges(source, changes);

      // Update last check time
      this.lastCheckTimes.set(source, new Date());

      return changes;

    } catch (error) {
      console.error(`Error detecting changes for ${source}:`, error);
      throw error;
    }
  }

  private compareRecords(stored: any, current: any): {
    changedFields: string[];
    oldValues: Record<string, any>;
    newValues: Record<string, any>;
    confidence: number;
  } {
    const changedFields: string[] = [];
    const oldValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};
    let significantChanges = 0;
    let totalFields = 0;

    // Define field weights for significance calculation
    const fieldWeights: Record<string, number> = {
      name: 3,
      address: 2,
      phone: 2,
      rating: 3,
      operatingHours: 2,
      priceRange: 1,
      cuisineType: 2,
      description: 1,
      menuHighlights: 1
    };

    for (const field in current) {
      totalFields++;
      const oldValue = stored[field];
      const newValue = current[field];

      if (!this.valuesEqual(oldValue, newValue)) {
        changedFields.push(field);
        oldValues[field] = oldValue;
        newValues[field] = newValue;

        // Calculate significance
        const weight = fieldWeights[field] || 1;
        const changeSignificance = this.calculateChangeSignificance(field, oldValue, newValue);
        significantChanges += weight * changeSignificance;
      }
    }

    // Calculate confidence based on significance of changes
    const maxPossibleSignificance = totalFields * 3; // Maximum weight
    const confidence = Math.min(significantChanges / maxPossibleSignificance, 1);

    return {
      changedFields,
      oldValues,
      newValues,
      confidence
    };
  }

  private valuesEqual(a: any, b: any): boolean {
    // Handle null/undefined
    if (a === null || a === undefined || b === null || b === undefined) {
      return a === b;
    }

    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => this.valuesEqual(item, b[index]));
    }

    // Handle objects
    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      
      if (keysA.length !== keysB.length) return false;
      
      return keysA.every(key => this.valuesEqual(a[key], b[key]));
    }

    // Handle primitives
    return a === b;
  }

  private calculateChangeSignificance(field: string, oldValue: any, newValue: any): number {
    // Calculate how significant a change is (0-1 scale)
    
    if (field === 'rating') {
      const diff = Math.abs(Number(oldValue) - Number(newValue));
      return Math.min(diff / 5, 1); // Rating changes are significant
    }

    if (field === 'name' || field === 'address') {
      // String similarity for important text fields
      return this.calculateStringSimilarity(String(oldValue), String(newValue));
    }

    if (field === 'operatingHours') {
      // Operating hours changes are moderately significant
      return 0.7;
    }

    if (field === 'phone') {
      // Phone number changes are significant
      return 0.8;
    }

    // Default significance for other fields
    return 0.5;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 0;

    const distance = this.levenshteinDistance(str1, str2);
    return distance / maxLength;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private async fetchCurrentData(source: DataSourceEnum, since: Date, batchSize: number): Promise<any[]> {
    // In production, this would fetch from the actual data source
    // For now, simulate fetching current data
    const mockData = [];
    for (let i = 0; i < batchSize; i++) {
      mockData.push({
        id: `${source}-${i}`,
        name: `Restaurant ${i}`,
        address: `Address ${i}`,
        rating: Math.random() * 5,
        lastUpdated: new Date()
      });
    }
    return mockData;
  }

  private async fetchStoredData(source: DataSourceEnum, since: Date, batchSize: number): Promise<any[]> {
    // In production, this would fetch from the database
    // For now, simulate stored data with some differences
    const mockData = [];
    for (let i = 0; i < batchSize - 10; i++) { // Simulate some new records
      mockData.push({
        id: `${source}-${i}`,
        name: `Restaurant ${i}`,
        address: `Address ${i}`,
        rating: Math.random() * 5,
        lastUpdated: new Date(Date.now() - 86400000) // 1 day ago
      });
    }
    return mockData;
  }

  private async verifyRecordExists(source: DataSourceEnum, recordId: string): Promise<boolean> {
    // In production, this would check if the record still exists in the source
    // For now, simulate some records being deleted
    return Math.random() > 0.1; // 10% chance of being deleted
  }

  private logChanges(source: DataSourceEnum, changes: ChangeDetectionResult[]): void {
    const sourceKey = source.toString();
    const existingChanges = this.changeLog.get(sourceKey) || [];
    
    // Add new changes
    existingChanges.push(...changes);
    
    // Keep only recent changes (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentChanges = existingChanges.filter(change => change.timestamp > thirtyDaysAgo);
    
    this.changeLog.set(sourceKey, recentChanges);
  }

  public getChangeHistory(source: DataSourceEnum, limit: number = 100): ChangeDetectionResult[] {
    const sourceKey = source.toString();
    const changes = this.changeLog.get(sourceKey) || [];
    return changes.slice(-limit);
  }

  public async processIncrementalUpdates(
    source: DataSourceEnum,
    config: IncrementalUpdateConfig
  ): Promise<void> {
    try {
      const lastCheck = this.lastCheckTimes.get(source) || new Date(Date.now() - config.checkInterval);
      const changes = await this.detectChanges(source, lastCheck, config.batchSize);

      // Filter changes by significance threshold
      const significantChanges = changes.filter(change => 
        change.confidence >= config.changeThreshold
      );

      if (significantChanges.length > 0) {
        console.log(`Processing ${significantChanges.length} significant changes for ${source}`);
        
        // Process changes in batches
        for (let i = 0; i < significantChanges.length; i += config.batchSize) {
          const batch = significantChanges.slice(i, i + config.batchSize);
          await this.processBatch(source, batch);
        }
      }

    } catch (error) {
      console.error(`Error processing incremental updates for ${source}:`, error);
      throw error;
    }
  }

  private async processBatch(source: DataSourceEnum, changes: ChangeDetectionResult[]): Promise<void> {
    for (const change of changes) {
      try {
        switch (change.changeType) {
          case 'created':
            await this.handleCreate(source, change);
            break;
          case 'updated':
            await this.handleUpdate(source, change);
            break;
          case 'deleted':
            await this.handleDelete(source, change);
            break;
        }
      } catch (error) {
        console.error(`Error processing change for record ${change.recordId}:`, error);
      }
    }
  }

  private async handleCreate(source: DataSourceEnum, change: ChangeDetectionResult): Promise<void> {
    // In production, this would create a new record in the database
    console.log(`Creating new record ${change.recordId} from ${source}`);
  }

  private async handleUpdate(source: DataSourceEnum, change: ChangeDetectionResult): Promise<void> {
    // In production, this would update the existing record in the database
    console.log(`Updating record ${change.recordId} from ${source}:`, change.changedFields);
  }

  private async handleDelete(source: DataSourceEnum, change: ChangeDetectionResult): Promise<void> {
    // In production, this would mark the record as deleted or remove it
    console.log(`Deleting record ${change.recordId} from ${source}`);
  }

  public getLastCheckTime(source: DataSourceEnum): Date | null {
    return this.lastCheckTimes.get(source) || null;
  }

  public getChangeStatistics(source: DataSourceEnum): {
    totalChanges: number;
    createdCount: number;
    updatedCount: number;
    deletedCount: number;
    averageConfidence: number;
  } {
    const sourceKey = source.toString();
    const changes = this.changeLog.get(sourceKey) || [];

    const stats = {
      totalChanges: changes.length,
      createdCount: changes.filter(c => c.changeType === 'created').length,
      updatedCount: changes.filter(c => c.changeType === 'updated').length,
      deletedCount: changes.filter(c => c.changeType === 'deleted').length,
      averageConfidence: 0
    };

    if (changes.length > 0) {
      stats.averageConfidence = changes.reduce((sum, c) => sum + c.confidence, 0) / changes.length;
    }

    return stats;
  }
}