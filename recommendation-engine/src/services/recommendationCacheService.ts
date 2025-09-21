import { CacheService, CacheKeys, CacheTTL } from '@find-dining/shared/services/cacheService';
import { Recommendation, RecommendedRestaurant } from '@find-dining/shared/types/recommendation.types';
import { UserPreferences } from '@find-dining/shared/types/user.types';

export interface RecommendationQuery {
  userId: string;
  emotionalState?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  preferences?: UserPreferences;
  limit?: number;
}

export class RecommendationCacheService {
  constructor(private cacheService: CacheService) {}

  async getRecommendations(query: RecommendationQuery): Promise<Recommendation | null> {
    const key = this.generateRecommendationKey(query);
    return this.cacheService.get<Recommendation>(key);
  }

  async setRecommendations(query: RecommendationQuery, recommendation: Recommendation): Promise<boolean> {
    const key = this.generateRecommendationKey(query);
    return this.cacheService.set(key, recommendation, { ttl: CacheTTL.RECOMMENDATIONS });
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    return this.cacheService.get<UserPreferences>(CacheKeys.userPreferences(userId));
  }

  async setUserPreferences(userId: string, preferences: UserPreferences): Promise<boolean> {
    return this.cacheService.set(
      CacheKeys.userPreferences(userId),
      preferences,
      { ttl: CacheTTL.USER_PREFERENCES }
    );
  }

  async getPrecomputedRecommendations(userId: string): Promise<RecommendedRestaurant[] | null> {
    const key = `precomputed:recommendations:${userId}`;
    return this.cacheService.get<RecommendedRestaurant[]>(key);
  }

  async setPrecomputedRecommendations(
    userId: string,
    recommendations: RecommendedRestaurant[]
  ): Promise<boolean> {
    const key = `precomputed:recommendations:${userId}`;
    // Longer TTL for precomputed recommendations
    return this.cacheService.set(key, recommendations, { ttl: CacheTTL.RECOMMENDATIONS * 4 });
  }

  async getEmotionBasedRecommendations(
    userId: string,
    emotionalState: string
  ): Promise<RecommendedRestaurant[] | null> {
    const key = CacheKeys.userRecommendations(userId, emotionalState);
    return this.cacheService.get<RecommendedRestaurant[]>(key);
  }

  async setEmotionBasedRecommendations(
    userId: string,
    emotionalState: string,
    recommendations: RecommendedRestaurant[]
  ): Promise<boolean> {
    const key = CacheKeys.userRecommendations(userId, emotionalState);
    return this.cacheService.set(key, recommendations, { ttl: CacheTTL.RECOMMENDATIONS });
  }

  async invalidateUserRecommendations(userId: string): Promise<void> {
    // Invalidate all recommendation caches for a user
    const patterns = [
      CacheKeys.userRecommendations(userId),
      CacheKeys.userPreferences(userId),
      `precomputed:recommendations:${userId}`,
      // Emotion-based recommendations
      CacheKeys.userRecommendations(userId, 'happy'),
      CacheKeys.userRecommendations(userId, 'sad'),
      CacheKeys.userRecommendations(userId, 'celebrating'),
      CacheKeys.userRecommendations(userId, 'stressed'),
      CacheKeys.userRecommendations(userId, 'neutral'),
    ];

    await Promise.all(patterns.map(pattern => this.cacheService.del(pattern)));
  }

  async getOrGenerateRecommendations(
    query: RecommendationQuery,
    generateFunction: () => Promise<Recommendation>
  ): Promise<Recommendation> {
    const key = this.generateRecommendationKey(query);
    
    return this.cacheService.getOrSet(
      key,
      generateFunction,
      { ttl: CacheTTL.RECOMMENDATIONS }
    );
  }

  async batchCacheRecommendations(
    queries: RecommendationQuery[],
    recommendations: Recommendation[]
  ): Promise<boolean> {
    const keyValuePairs = queries.map((query, index) => ({
      key: this.generateRecommendationKey(query),
      value: recommendations[index],
      ttl: CacheTTL.RECOMMENDATIONS
    }));

    return this.cacheService.mset(keyValuePairs);
  }

  async getRecommendationStats(userId: string): Promise<{
    totalCached: number;
    emotionBasedCount: number;
    precomputedExists: boolean;
  } | null> {
    const key = `recommendation:stats:${userId}`;
    return this.cacheService.get(key);
  }

  async updateRecommendationStats(userId: string, stats: {
    totalCached: number;
    emotionBasedCount: number;
    precomputedExists: boolean;
  }): Promise<boolean> {
    const key = `recommendation:stats:${userId}`;
    return this.cacheService.set(key, stats, { ttl: CacheTTL.USER_PREFERENCES });
  }

  private generateRecommendationKey(query: RecommendationQuery): string {
    const parts = ['recommendation', query.userId];
    
    if (query.emotionalState) {
      parts.push(`emotion:${query.emotionalState}`);
    }
    
    if (query.location) {
      const { latitude, longitude } = query.location;
      // Round to 3 decimal places for cache efficiency
      const lat = Math.round(latitude * 1000) / 1000;
      const lng = Math.round(longitude * 1000) / 1000;
      parts.push(`location:${lat}:${lng}`);
    }
    
    if (query.limit) {
      parts.push(`limit:${query.limit}`);
    }
    
    return parts.join(':');
  }
}