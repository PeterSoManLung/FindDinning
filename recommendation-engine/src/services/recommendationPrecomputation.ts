import { RecommendationCacheService } from './recommendationCacheService';
import { UserCacheService } from '@find-dining/shared/services/userCacheService';
import { RecommendedRestaurant } from '@find-dining/shared/types/recommendation.types';
import { UserPreferences } from '@find-dining/shared/types/user.types';

export interface PrecomputationConfig {
  batchSize: number;
  maxConcurrentUsers: number;
  emotionalScenarios: string[];
  refreshIntervalHours: number;
  frequentUserThreshold: number; // minimum visits per month
}

export interface PrecomputationStats {
  totalUsers: number;
  completedUsers: number;
  failedUsers: number;
  averageProcessingTime: number;
  totalRecommendationsGenerated: number;
  lastRunTime: Date;
}

export class RecommendationPrecomputation {
  private config: PrecomputationConfig;
  private stats: PrecomputationStats;
  private isRunning: boolean = false;

  constructor(
    private recommendationCache: RecommendationCacheService,
    private userCache: UserCacheService,
    config?: Partial<PrecomputationConfig>
  ) {
    this.config = {
      batchSize: 50,
      maxConcurrentUsers: 10,
      emotionalScenarios: ['happy', 'sad', 'celebrating', 'stressed', 'neutral'],
      refreshIntervalHours: 24,
      frequentUserThreshold: 5,
      ...config
    };

    this.stats = {
      totalUsers: 0,
      completedUsers: 0,
      failedUsers: 0,
      averageProcessingTime: 0,
      totalRecommendationsGenerated: 0,
      lastRunTime: new Date(0)
    };

    // Schedule periodic precomputation
    this.schedulePrecomputation();
  }

  async precomputeForFrequentUsers(): Promise<PrecomputationStats> {
    if (this.isRunning) {
      throw new Error('Precomputation is already running');
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      // Reset stats
      this.stats = {
        totalUsers: 0,
        completedUsers: 0,
        failedUsers: 0,
        averageProcessingTime: 0,
        totalRecommendationsGenerated: 0,
        lastRunTime: new Date()
      };

      // Get frequent users
      const frequentUsers = await this.getFrequentUsers();
      this.stats.totalUsers = frequentUsers.length;

      console.log(`Starting precomputation for ${frequentUsers.length} frequent users`);

      // Process users in batches
      const batches = this.chunkArray(frequentUsers, this.config.batchSize);
      
      for (const batch of batches) {
        await this.processBatch(batch);
      }

      this.stats.averageProcessingTime = (Date.now() - startTime) / this.stats.totalUsers;
      
      console.log(`Precomputation completed: ${this.stats.completedUsers}/${this.stats.totalUsers} users processed`);
      
      return this.stats;
    } finally {
      this.isRunning = false;
    }
  }

  async precomputeForUser(userId: string): Promise<{
    success: boolean;
    recommendationsGenerated: number;
    processingTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    let recommendationsGenerated = 0;

    try {
      // Get user preferences
      const preferences = await this.userCache.getUserPreferences(userId);
      if (!preferences) {
        throw new Error('User preferences not found');
      }

      // Generate recommendations for each emotional scenario
      const precomputationPromises = this.config.emotionalScenarios.map(async (emotion) => {
        try {
          const recommendations = await this.generateRecommendationsForScenario(
            userId,
            emotion,
            preferences
          );
          
          await this.recommendationCache.setEmotionBasedRecommendations(
            userId,
            emotion,
            recommendations
          );
          
          return recommendations.length;
        } catch (error) {
          console.error(`Failed to precompute recommendations for ${userId} - ${emotion}:`, error);
          return 0;
        }
      });

      const results = await Promise.allSettled(precomputationPromises);
      recommendationsGenerated = results
        .filter(result => result.status === 'fulfilled')
        .reduce((sum, result) => sum + (result as PromiseFulfilledResult<number>).value, 0);

      // Also generate general recommendations
      const generalRecommendations = await this.generateRecommendationsForScenario(
        userId,
        'neutral',
        preferences
      );
      
      await this.recommendationCache.setPrecomputedRecommendations(userId, generalRecommendations);
      recommendationsGenerated += generalRecommendations.length;

      return {
        success: true,
        recommendationsGenerated,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        recommendationsGenerated,
        processingTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async invalidatePrecomputedRecommendations(userId: string): Promise<void> {
    await this.recommendationCache.invalidateUserRecommendations(userId);
  }

  async getPrecomputationStatus(): Promise<{
    isRunning: boolean;
    stats: PrecomputationStats;
    nextScheduledRun: Date;
  }> {
    const nextRun = new Date(
      this.stats.lastRunTime.getTime() + (this.config.refreshIntervalHours * 60 * 60 * 1000)
    );

    return {
      isRunning: this.isRunning,
      stats: this.stats,
      nextScheduledRun: nextRun
    };
  }

  private async getFrequentUsers(): Promise<string[]> {
    // This would typically query the database for users with high activity
    // For now, we'll get from cache or simulate
    const cachedFrequentUsers = await this.userCache.getFrequentUsers();
    
    if (cachedFrequentUsers) {
      return cachedFrequentUsers;
    }

    // Simulate frequent user identification
    // In production, this would query user activity data
    const mockFrequentUsers = Array.from({ length: 100 }, (_, i) => `user-${i}`);
    
    await this.userCache.setFrequentUsers(mockFrequentUsers);
    return mockFrequentUsers;
  }

  private async processBatch(userIds: string[]): Promise<void> {
    const batchPromises = userIds.map(async (userId) => {
      try {
        const result = await this.precomputeForUser(userId);
        
        if (result.success) {
          this.stats.completedUsers++;
          this.stats.totalRecommendationsGenerated += result.recommendationsGenerated;
        } else {
          this.stats.failedUsers++;
          console.error(`Failed to precompute for user ${userId}: ${result.error}`);
        }
      } catch (error) {
        this.stats.failedUsers++;
        console.error(`Error processing user ${userId}:`, error);
      }
    });

    // Limit concurrency
    const chunks = this.chunkArray(batchPromises, this.config.maxConcurrentUsers);
    
    for (const chunk of chunks) {
      await Promise.allSettled(chunk);
    }
  }

  private async generateRecommendationsForScenario(
    userId: string,
    emotionalState: string,
    preferences: UserPreferences
  ): Promise<RecommendedRestaurant[]> {
    // This would integrate with the actual recommendation generation logic
    // For now, we'll simulate the process
    
    const simulatedDelay = Math.random() * 500 + 200; // 200-700ms
    await new Promise(resolve => setTimeout(resolve, simulatedDelay));

    // Generate mock recommendations based on emotional state and preferences
    const mockRecommendations: RecommendedRestaurant[] = [];
    
    const recommendationCount = Math.floor(Math.random() * 10) + 5; // 5-15 recommendations
    
    for (let i = 0; i < recommendationCount; i++) {
      mockRecommendations.push({
        restaurant: {
          id: `restaurant-${userId}-${emotionalState}-${i}`,
          name: `${emotionalState} Restaurant ${i}`,
          cuisineType: preferences.cuisineTypes.slice(0, 1),
          location: {
            address: `${i} Test Street`,
            latitude: 22.3193 + (Math.random() - 0.5) * 0.1,
            longitude: 114.1694 + (Math.random() - 0.5) * 0.1,
            district: 'Central'
          },
          priceRange: preferences.priceRange[0],
          rating: 4.0 + Math.random(),
          negativeScore: Math.random() * 0.3,
          atmosphere: preferences.atmospherePreferences.slice(0, 1),
          operatingHours: {
            monday: { open: '09:00', close: '22:00' },
            tuesday: { open: '09:00', close: '22:00' },
            wednesday: { open: '09:00', close: '22:00' },
            thursday: { open: '09:00', close: '22:00' },
            friday: { open: '09:00', close: '22:00' },
            saturday: { open: '09:00', close: '22:00' },
            sunday: { open: '09:00', close: '22:00' }
          },
          menuHighlights: [],
          specialFeatures: [],
          isLocalGem: Math.random() > 0.5,
          authenticityScore: Math.random(),
          governmentLicense: {
            licenseNumber: `LIC-${i}`,
            isValid: true,
            violations: []
          },
          dataQualityScore: Math.random(),
          negativeFeedbackTrends: [],
          platformData: [],
          lastSyncDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        matchScore: Math.random() * 0.5 + 0.5, // 0.5-1.0
        reasonsForRecommendation: [
          `Matches your ${emotionalState} mood`,
          `Preferred cuisine: ${preferences.cuisineTypes[0]}`,
          `Within price range: ${preferences.priceRange[0]}-${preferences.priceRange[1]}`
        ],
        emotionalAlignment: Math.random() * 0.3 + 0.7 // 0.7-1.0
      });
    }

    return mockRecommendations;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private schedulePrecomputation(): void {
    const intervalMs = this.config.refreshIntervalHours * 60 * 60 * 1000;
    
    setInterval(async () => {
      if (!this.isRunning) {
        try {
          console.log('Starting scheduled precomputation...');
          await this.precomputeForFrequentUsers();
        } catch (error) {
          console.error('Scheduled precomputation failed:', error);
        }
      }
    }, intervalMs);
  }

  // Manual trigger for immediate precomputation
  async triggerImmediatePrecomputation(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Precomputation is already running');
    }

    // Run precomputation in background
    this.precomputeForFrequentUsers().catch(error => {
      console.error('Immediate precomputation failed:', error);
    });
  }

  // Get recommendations with fallback to real-time generation
  async getRecommendationsWithFallback(
    userId: string,
    emotionalState?: string
  ): Promise<RecommendedRestaurant[]> {
    try {
      // Try to get precomputed recommendations first
      if (emotionalState) {
        const precomputed = await this.recommendationCache.getEmotionBasedRecommendations(
          userId,
          emotionalState
        );
        if (precomputed && precomputed.length > 0) {
          return precomputed;
        }
      } else {
        const precomputed = await this.recommendationCache.getPrecomputedRecommendations(userId);
        if (precomputed && precomputed.length > 0) {
          return precomputed;
        }
      }

      // Fallback to real-time generation
      console.log(`No precomputed recommendations found for user ${userId}, generating real-time`);
      
      const preferences = await this.userCache.getUserPreferences(userId);
      if (!preferences) {
        throw new Error('User preferences not found');
      }

      return await this.generateRecommendationsForScenario(
        userId,
        emotionalState || 'neutral',
        preferences
      );
    } catch (error) {
      console.error('Failed to get recommendations with fallback:', error);
      return [];
    }
  }
}