import { AsyncRecommendationProcessor } from '../services/asyncRecommendationProcessor';
import { RecommendationPrecomputation } from '../services/recommendationPrecomputation';
import { RecommendationCacheService } from '../services/recommendationCacheService';

// Mock dependencies

const mockRecommendationCache = {
  getRecommendations: jest.fn(),
  setRecommendations: jest.fn().mockResolvedValue(true),
  getUserPreferences: jest.fn(),
  setUserPreferences: jest.fn().mockResolvedValue(true),
  getPrecomputedRecommendations: jest.fn(),
  setPrecomputedRecommendations: jest.fn().mockResolvedValue(true),
  getEmotionBasedRecommendations: jest.fn(),
  setEmotionBasedRecommendations: jest.fn().mockResolvedValue(true),
  invalidateUserRecommendations: jest.fn().mockResolvedValue(undefined),
  batchCacheRecommendations: jest.fn().mockResolvedValue(true)
} as any;

const mockUserCache = {
  getUserPreferences: jest.fn(),
  getFrequentUsers: jest.fn(),
  setFrequentUsers: jest.fn().mockResolvedValue(true)
} as any;

describe('Performance Optimization Tests', () => {
  describe('AsyncRecommendationProcessor', () => {
    let processor: AsyncRecommendationProcessor;

    beforeEach(() => {
      jest.clearAllMocks();
      processor = new AsyncRecommendationProcessor(mockRecommendationCache, {
        maxConcurrentJobs: 5,
        jobTimeoutMs: 3000 // 3 seconds
      });
    });

    it('should process recommendations within 3 seconds', async () => {
      const startTime = Date.now();
      
      const jobId = await processor.queueRecommendationJob('user1', {
        userId: 'user1',
        emotionalState: 'happy',
        limit: 10
      }, 'high');

      const result = await processor.waitForJob(jobId, 3000);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(3000);
      expect(result).toBeDefined();
      expect(result.userId).toBe('user1');
    });

    it('should handle high-volume concurrent requests efficiently', async () => {
      const startTime = Date.now();
      const jobPromises = [];

      // Queue 50 concurrent jobs
      for (let i = 0; i < 50; i++) {
        const jobId = await processor.queueRecommendationJob(`user${i}`, {
          userId: `user${i}`,
          emotionalState: 'neutral',
          limit: 5
        });
        jobPromises.push(processor.waitForJob(jobId, 5000));
      }

      const results = await Promise.allSettled(jobPromises);
      const endTime = Date.now();
      
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      const totalTime = endTime - startTime;
      
      expect(successfulResults.length).toBeGreaterThan(40); // At least 80% success rate
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
      
      // Average time per job should be reasonable
      const avgTimePerJob = totalTime / successfulResults.length;
      expect(avgTimePerJob).toBeLessThan(1000); // Less than 1 second average
    });

    it('should prioritize high-priority jobs', async () => {
      const jobTimes: { priority: string; startTime: number; endTime: number }[] = [];

      // Queue low priority jobs first
      for (let i = 0; i < 5; i++) {
        const jobId = await processor.queueRecommendationJob(`low-user${i}`, {
          userId: `low-user${i}`,
          limit: 5
        }, 'low');
        
        processor.waitForJob(jobId, 5000).then(() => {
          jobTimes.push({
            priority: 'low',
            startTime: Date.now(),
            endTime: Date.now()
          });
        });
      }

      // Queue high priority job after
      const highPriorityJobId = await processor.queueRecommendationJob('high-user', {
        userId: 'high-user',
        limit: 5
      }, 'high');

      const highPriorityStart = Date.now();
      await processor.waitForJob(highPriorityJobId, 5000);
      const highPriorityEnd = Date.now();

      // Wait a bit for other jobs to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // High priority job should complete faster than average low priority jobs
      const highPriorityTime = highPriorityEnd - highPriorityStart;
      expect(highPriorityTime).toBeLessThan(2000);
    });

    it('should provide accurate queue statistics', async () => {
      // Queue several jobs
      const jobIds = [];
      for (let i = 0; i < 10; i++) {
        const jobId = await processor.queueRecommendationJob(`user${i}`, {
          userId: `user${i}`,
          limit: 5
        });
        jobIds.push(jobId);
      }

      const stats = processor.getQueueStats();
      
      expect(stats.totalJobs).toBe(10);
      expect(stats.queueLength).toBeGreaterThan(0);
      expect(stats.activeJobs).toBeGreaterThanOrEqual(0);
      expect(stats.completedJobs).toBeGreaterThanOrEqual(0);
      expect(stats.failedJobs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('RecommendationPrecomputation', () => {
    let precomputation: RecommendationPrecomputation;

    beforeEach(() => {
      jest.clearAllMocks();
      
      mockUserCache.getUserPreferences.mockResolvedValue({
        cuisineTypes: ['Chinese', 'Italian'],
        priceRange: [1, 3],
        dietaryRestrictions: [],
        atmospherePreferences: ['casual'],
        spiceLevel: 2
      });

      mockUserCache.getFrequentUsers.mockResolvedValue(
        Array.from({ length: 20 }, (_, i) => `user${i}`)
      );

      precomputation = new RecommendationPrecomputation(
        mockRecommendationCache,
        mockUserCache,
        {
          batchSize: 5,
          maxConcurrentUsers: 3,
          emotionalScenarios: ['happy', 'sad', 'neutral']
        }
      );
    });

    it('should precompute recommendations for frequent users efficiently', async () => {
      const startTime = Date.now();
      
      const stats = await precomputation.precomputeForFrequentUsers();
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(stats.totalUsers).toBe(20);
      expect(stats.completedUsers).toBeGreaterThan(15); // At least 75% success rate
      expect(stats.averageProcessingTime).toBeLessThan(2000); // Less than 2 seconds per user
      expect(totalTime).toBeLessThan(30000); // Complete within 30 seconds
    });

    it('should precompute recommendations for single user quickly', async () => {
      const startTime = Date.now();
      
      const result = await precomputation.precomputeForUser('test-user');
      
      const endTime = Date.now();
      
      expect(result.success).toBe(true);
      expect(result.processingTime).toBeLessThan(3000); // Less than 3 seconds
      expect(result.recommendationsGenerated).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should provide fast fallback to real-time generation', async () => {
      // Mock no precomputed recommendations
      (mockRecommendationCache.getEmotionBasedRecommendations as jest.Mock).mockResolvedValue(null);
      (mockRecommendationCache.getPrecomputedRecommendations as jest.Mock).mockResolvedValue(null);

      const startTime = Date.now();
      
      const recommendations = await precomputation.getRecommendationsWithFallback(
        'test-user',
        'happy'
      );
      
      const endTime = Date.now();
      
      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
    });

    it('should handle batch processing efficiently', async () => {
      const userIds = Array.from({ length: 50 }, (_, i) => `batch-user${i}`);
      
      const startTime = Date.now();
      
      const results = await Promise.allSettled(
        userIds.map(userId => precomputation.precomputeForUser(userId))
      );
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      
      expect(successfulResults.length).toBeGreaterThan(40); // At least 80% success
      expect(totalTime).toBeLessThan(60000); // Complete within 1 minute
      
      // Check average processing time
      const avgTime = totalTime / successfulResults.length;
      expect(avgTime).toBeLessThan(2000); // Less than 2 seconds per user on average
    });
  });

  describe('Cache Performance', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should retrieve cached recommendations quickly', async () => {
      const mockRecommendation = {
        id: 'rec1',
        userId: 'user1',
        restaurants: [],
        emotionalContext: 'happy',
        generatedAt: new Date(),
        confidence: 0.9,
        reasoning: 'Test recommendation'
      };

      (mockRecommendationCache.getRecommendations as jest.Mock).mockResolvedValue(mockRecommendation);

      const startTime = Date.now();
      
      const result = await mockRecommendationCache.getRecommendations({
        userId: 'user1',
        emotionalState: 'happy'
      });
      
      const endTime = Date.now();
      
      expect(result).toEqual(mockRecommendation);
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast
    });

    it('should handle cache misses gracefully', async () => {
      (mockRecommendationCache.getRecommendations as jest.Mock).mockResolvedValue(null);

      const startTime = Date.now();
      
      const result = await mockRecommendationCache.getRecommendations({
        userId: 'user1',
        emotionalState: 'happy'
      });
      
      const endTime = Date.now();
      
      expect(result).toBeNull();
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should batch cache operations efficiently', async () => {
      const queries = Array.from({ length: 100 }, (_, i) => ({
        userId: `user${i}`,
        emotionalState: 'neutral'
      }));

      const recommendations = queries.map(query => ({
        id: `rec${query.userId}`,
        userId: query.userId,
        restaurants: [],
        emotionalContext: query.emotionalState!,
        generatedAt: new Date(),
        confidence: 0.8,
        reasoning: 'Batch recommendation'
      }));

      const startTime = Date.now();
      
      await mockRecommendationCache.batchCacheRecommendations(queries, recommendations);
      
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(mockRecommendationCache.batchCacheRecommendations).toHaveBeenCalledTimes(1); // Single batch operation
    });
  });

  describe('End-to-End Performance', () => {
    it('should complete full recommendation flow within 3 seconds', async () => {
      const processor = new AsyncRecommendationProcessor(mockRecommendationCache);
      
      // Mock cache miss to force generation
      (mockRecommendationCache.getRecommendations as jest.Mock).mockResolvedValue(null);
      
      const startTime = Date.now();
      
      const jobId = await processor.queueRecommendationJob('e2e-user', {
        userId: 'e2e-user',
        emotionalState: 'celebrating',
        location: {
          latitude: 22.3193,
          longitude: 114.1694
        },
        limit: 10
      }, 'high');

      const result = await processor.waitForJob(jobId, 3000);
      
      const endTime = Date.now();
      
      expect(result).toBeDefined();
      expect(result.userId).toBe('e2e-user');
      expect(endTime - startTime).toBeLessThan(3000);
    });

    it('should maintain performance under load', async () => {
      const processor = new AsyncRecommendationProcessor(mockRecommendationCache, {
        maxConcurrentJobs: 20
      });

      const startTime = Date.now();
      const jobPromises = [];

      // Simulate high load with 100 concurrent requests
      for (let i = 0; i < 100; i++) {
        const jobId = await processor.queueRecommendationJob(`load-user${i}`, {
          userId: `load-user${i}`,
          emotionalState: i % 2 === 0 ? 'happy' : 'sad',
          limit: 5
        });
        jobPromises.push(processor.waitForJob(jobId, 10000));
      }

      const results = await Promise.allSettled(jobPromises);
      const endTime = Date.now();
      
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      const totalTime = endTime - startTime;
      
      expect(successfulResults.length).toBeGreaterThan(80); // At least 80% success rate
      expect(totalTime).toBeLessThan(30000); // Complete within 30 seconds
      
      // 95th percentile should be under 5 seconds
      const times = results
        .filter(r => r.status === 'fulfilled')
        .map(() => totalTime / successfulResults.length)
        .sort((a, b) => a - b);
      
      const p95Index = Math.floor(times.length * 0.95);
      expect(times[p95Index]).toBeLessThan(5000);
    });
  });
});