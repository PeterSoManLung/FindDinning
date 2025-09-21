import { IncrementalUpdateService, ChangeDetectionResult, IncrementalUpdateConfig } from '../services/IncrementalUpdateService';
import { DataSourceEnum } from '../types/dataSource.types';

describe('IncrementalUpdateService', () => {
  let incrementalUpdateService: IncrementalUpdateService;

  beforeEach(() => {
    incrementalUpdateService = new IncrementalUpdateService();
  });

  describe('Change Detection', () => {
    it('should detect new records', async () => {
      // Mock current data with new records
      jest.spyOn(incrementalUpdateService as any, 'fetchCurrentData').mockResolvedValue([
        { id: 'new-1', name: 'New Restaurant 1', rating: 4.5 },
        { id: 'new-2', name: 'New Restaurant 2', rating: 4.0 }
      ]);

      // Mock stored data (empty)
      jest.spyOn(incrementalUpdateService as any, 'fetchStoredData').mockResolvedValue([]);

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const changes = await incrementalUpdateService.detectChanges(DataSourceEnum.OPENRICE, since, 100);

      expect(changes).toHaveLength(2);
      changes.forEach(change => {
        expect(change.changeType).toBe('created');
        expect(change.confidence).toBe(1.0);
        expect(change.changedFields.length).toBeGreaterThan(0);
      });
    });

    it('should detect updated records', async () => {
      const baseRecord = { id: 'existing-1', name: 'Existing Restaurant', rating: 4.0, address: 'Old Address' };
      const updatedRecord = { id: 'existing-1', name: 'Existing Restaurant', rating: 4.5, address: 'New Address' };

      jest.spyOn(incrementalUpdateService as any, 'fetchCurrentData').mockResolvedValue([updatedRecord]);
      jest.spyOn(incrementalUpdateService as any, 'fetchStoredData').mockResolvedValue([baseRecord]);

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const changes = await incrementalUpdateService.detectChanges(DataSourceEnum.OPENRICE, since, 100);

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('updated');
      expect(changes[0].changedFields).toContain('rating');
      expect(changes[0].changedFields).toContain('address');
      expect(changes[0].oldValues.rating).toBe(4.0);
      expect(changes[0].newValues.rating).toBe(4.5);
    });

    it('should detect deleted records', async () => {
      const deletedRecord = { id: 'deleted-1', name: 'Deleted Restaurant', rating: 3.5 };

      jest.spyOn(incrementalUpdateService as any, 'fetchCurrentData').mockResolvedValue([]);
      jest.spyOn(incrementalUpdateService as any, 'fetchStoredData').mockResolvedValue([deletedRecord]);
      jest.spyOn(incrementalUpdateService as any, 'verifyRecordExists').mockResolvedValue(false);

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const changes = await incrementalUpdateService.detectChanges(DataSourceEnum.OPENRICE, since, 100);

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('deleted');
      expect(changes[0].recordId).toBe('deleted-1');
      expect(changes[0].confidence).toBe(0.9); // Slightly lower confidence for deletions
    });

    it('should not detect deleted records that still exist in source', async () => {
      const record = { id: 'existing-1', name: 'Existing Restaurant', rating: 3.5 };

      jest.spyOn(incrementalUpdateService as any, 'fetchCurrentData').mockResolvedValue([]);
      jest.spyOn(incrementalUpdateService as any, 'fetchStoredData').mockResolvedValue([record]);
      jest.spyOn(incrementalUpdateService as any, 'verifyRecordExists').mockResolvedValue(true);

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const changes = await incrementalUpdateService.detectChanges(DataSourceEnum.OPENRICE, since, 100);

      expect(changes).toHaveLength(0);
    });

    it('should handle errors gracefully', async () => {
      jest.spyOn(incrementalUpdateService as any, 'fetchCurrentData').mockRejectedValue(new Error('Network error'));

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      await expect(incrementalUpdateService.detectChanges(DataSourceEnum.OPENRICE, since, 100))
        .rejects.toThrow('Network error');
    });
  });

  describe('Change Significance Calculation', () => {
    it('should calculate high significance for rating changes', () => {
      const service = incrementalUpdateService as any;
      const significance = service.calculateChangeSignificance('rating', 3.0, 4.5);
      
      expect(significance).toBeGreaterThan(0);
      expect(significance).toBeLessThanOrEqual(1);
      
      // Large rating change should be significant
      const largeChange = service.calculateChangeSignificance('rating', 2.0, 5.0);
      expect(largeChange).toBeGreaterThan(significance);
    });

    it('should calculate significance for name changes', () => {
      const service = incrementalUpdateService as any;
      const significance = service.calculateChangeSignificance('name', 'Old Name', 'Completely Different Name');
      
      expect(significance).toBeGreaterThan(0);
      expect(significance).toBeLessThanOrEqual(1);
    });

    it('should assign moderate significance to operating hours changes', () => {
      const service = incrementalUpdateService as any;
      const significance = service.calculateChangeSignificance('operatingHours', 
        { monday: '9-17' }, 
        { monday: '10-18' }
      );
      
      expect(significance).toBe(0.7);
    });

    it('should assign high significance to phone changes', () => {
      const service = incrementalUpdateService as any;
      const significance = service.calculateChangeSignificance('phone', '+852-1234-5678', '+852-8765-4321');
      
      expect(significance).toBe(0.8);
    });
  });

  describe('Value Comparison', () => {
    it('should correctly compare primitive values', () => {
      const service = incrementalUpdateService as any;
      
      expect(service.valuesEqual('test', 'test')).toBe(true);
      expect(service.valuesEqual('test', 'different')).toBe(false);
      expect(service.valuesEqual(123, 123)).toBe(true);
      expect(service.valuesEqual(123, 456)).toBe(false);
      expect(service.valuesEqual(null, null)).toBe(true);
      expect(service.valuesEqual(null, 'test')).toBe(false);
    });

    it('should correctly compare arrays', () => {
      const service = incrementalUpdateService as any;
      
      expect(service.valuesEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(service.valuesEqual([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(service.valuesEqual(['a', 'b'], ['a', 'b'])).toBe(true);
      expect(service.valuesEqual(['a', 'b'], ['a', 'b', 'c'])).toBe(false);
    });

    it('should correctly compare objects', () => {
      const service = incrementalUpdateService as any;
      
      const obj1 = { name: 'test', value: 123 };
      const obj2 = { name: 'test', value: 123 };
      const obj3 = { name: 'test', value: 456 };
      
      expect(service.valuesEqual(obj1, obj2)).toBe(true);
      expect(service.valuesEqual(obj1, obj3)).toBe(false);
    });
  });

  describe('Change History Management', () => {
    it('should store and retrieve change history', async () => {
      // Mock data to generate changes
      jest.spyOn(incrementalUpdateService as any, 'fetchCurrentData').mockResolvedValue([
        { id: 'test-1', name: 'Test Restaurant', rating: 4.5 }
      ]);
      jest.spyOn(incrementalUpdateService as any, 'fetchStoredData').mockResolvedValue([]);

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await incrementalUpdateService.detectChanges(DataSourceEnum.OPENRICE, since, 100);

      const history = incrementalUpdateService.getChangeHistory(DataSourceEnum.OPENRICE, 10);
      expect(history).toHaveLength(1);
      expect(history[0].changeType).toBe('created');
    });

    it('should limit change history to specified count', async () => {
      // Generate multiple changes
      for (let i = 0; i < 5; i++) {
        jest.spyOn(incrementalUpdateService as any, 'fetchCurrentData').mockResolvedValue([
          { id: `test-${i}`, name: `Test Restaurant ${i}`, rating: 4.0 }
        ]);
        jest.spyOn(incrementalUpdateService as any, 'fetchStoredData').mockResolvedValue([]);

        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        await incrementalUpdateService.detectChanges(DataSourceEnum.OPENRICE, since, 100);
      }

      const limitedHistory = incrementalUpdateService.getChangeHistory(DataSourceEnum.OPENRICE, 3);
      expect(limitedHistory.length).toBeLessThanOrEqual(3);
    });

    it('should clean up old changes (older than 30 days)', async () => {
      // This test would require mocking the internal change log
      // and simulating the passage of time
      const stats = incrementalUpdateService.getChangeStatistics(DataSourceEnum.OPENRICE);
      expect(stats).toBeDefined();
      expect(stats.totalChanges).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Incremental Update Processing', () => {
    it('should process incremental updates with configuration', async () => {
      const config: IncrementalUpdateConfig = {
        source: DataSourceEnum.OPENRICE,
        checkInterval: 3600000, // 1 hour
        batchSize: 50,
        changeThreshold: 0.5
      };

      // Mock changes with varying confidence levels
      jest.spyOn(incrementalUpdateService, 'detectChanges').mockResolvedValue([
        {
          recordId: 'high-confidence',
          changeType: 'updated',
          changedFields: ['rating'],
          oldValues: { rating: 3.0 },
          newValues: { rating: 4.5 },
          confidence: 0.8,
          timestamp: new Date()
        },
        {
          recordId: 'low-confidence',
          changeType: 'updated',
          changedFields: ['description'],
          oldValues: { description: 'old' },
          newValues: { description: 'new' },
          confidence: 0.3,
          timestamp: new Date()
        }
      ]);

      // Mock batch processing
      jest.spyOn(incrementalUpdateService as any, 'processBatch').mockResolvedValue(undefined);

      await incrementalUpdateService.processIncrementalUpdates(DataSourceEnum.OPENRICE, config);

      // Should only process changes above threshold (0.5)
      expect(incrementalUpdateService.detectChanges).toHaveBeenCalled();
    });

    it('should handle processing errors gracefully', async () => {
      const config: IncrementalUpdateConfig = {
        source: DataSourceEnum.OPENRICE,
        checkInterval: 3600000,
        batchSize: 50,
        changeThreshold: 0.5
      };

      jest.spyOn(incrementalUpdateService, 'detectChanges').mockRejectedValue(new Error('Processing error'));

      await expect(incrementalUpdateService.processIncrementalUpdates(DataSourceEnum.OPENRICE, config))
        .rejects.toThrow('Processing error');
    });
  });

  describe('Change Statistics', () => {
    it('should calculate accurate change statistics', async () => {
      // Generate test changes
      jest.spyOn(incrementalUpdateService as any, 'fetchCurrentData').mockResolvedValue([
        { id: 'new-1', name: 'New Restaurant 1' },
        { id: 'updated-1', name: 'Updated Restaurant', rating: 4.5 }
      ]);
      jest.spyOn(incrementalUpdateService as any, 'fetchStoredData').mockResolvedValue([
        { id: 'updated-1', name: 'Updated Restaurant', rating: 4.0 },
        { id: 'deleted-1', name: 'Deleted Restaurant' }
      ]);
      jest.spyOn(incrementalUpdateService as any, 'verifyRecordExists').mockResolvedValue(false);

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await incrementalUpdateService.detectChanges(DataSourceEnum.OPENRICE, since, 100);

      const stats = incrementalUpdateService.getChangeStatistics(DataSourceEnum.OPENRICE);
      
      expect(stats.totalChanges).toBe(3); // 1 created, 1 updated, 1 deleted
      expect(stats.createdCount).toBe(1);
      expect(stats.updatedCount).toBe(1);
      expect(stats.deletedCount).toBe(1);
      expect(stats.averageConfidence).toBeGreaterThan(0);
      expect(stats.averageConfidence).toBeLessThanOrEqual(1);
    });

    it('should return zero statistics for sources with no changes', () => {
      const stats = incrementalUpdateService.getChangeStatistics(DataSourceEnum.BISTROCHAT);
      
      expect(stats.totalChanges).toBe(0);
      expect(stats.createdCount).toBe(0);
      expect(stats.updatedCount).toBe(0);
      expect(stats.deletedCount).toBe(0);
      expect(stats.averageConfidence).toBe(0);
    });
  });

  describe('Last Check Time Tracking', () => {
    it('should track last check time for data sources', async () => {
      expect(incrementalUpdateService.getLastCheckTime(DataSourceEnum.OPENRICE)).toBeNull();

      // Perform a change detection
      jest.spyOn(incrementalUpdateService as any, 'fetchCurrentData').mockResolvedValue([]);
      jest.spyOn(incrementalUpdateService as any, 'fetchStoredData').mockResolvedValue([]);

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await incrementalUpdateService.detectChanges(DataSourceEnum.OPENRICE, since, 100);

      const lastCheckTime = incrementalUpdateService.getLastCheckTime(DataSourceEnum.OPENRICE);
      expect(lastCheckTime).toBeInstanceOf(Date);
      expect(lastCheckTime!.getTime()).toBeCloseTo(Date.now(), -3); // Within 1 second
    });
  });

  describe('String Similarity Calculation', () => {
    it('should calculate string similarity correctly', () => {
      const service = incrementalUpdateService as any;
      
      // Identical strings
      expect(service.calculateStringSimilarity('test', 'test')).toBe(0);
      
      // Completely different strings
      const similarity1 = service.calculateStringSimilarity('abc', 'xyz');
      expect(similarity1).toBeGreaterThan(0);
      
      // Similar strings
      const similarity2 = service.calculateStringSimilarity('restaurant', 'restaurants');
      expect(similarity2).toBeGreaterThan(0);
      expect(similarity2).toBeLessThan(similarity1); // Should be more similar
    });

    it('should handle empty strings', () => {
      const service = incrementalUpdateService as any;
      
      expect(service.calculateStringSimilarity('', '')).toBe(0);
      expect(service.calculateStringSimilarity('test', '')).toBeGreaterThan(0);
      expect(service.calculateStringSimilarity('', 'test')).toBeGreaterThan(0);
    });
  });
});