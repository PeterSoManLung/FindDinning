import { CacheService, CacheKeys, CacheTTL } from '@find-dining/shared/services/cacheService';
import { User, UserPreferences, DiningHistory } from '@find-dining/shared/types/user.types';

export class UserCacheService {
  constructor(private cacheService: CacheService) {}

  async getUser(userId: string): Promise<User | null> {
    const key = `user:${userId}`;
    return this.cacheService.get<User>(key);
  }

  async setUser(user: User): Promise<boolean> {
    const key = `user:${user.id}`;
    return this.cacheService.set(key, user, { ttl: CacheTTL.USER_PREFERENCES });
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

  async getUserDiningHistory(userId: string): Promise<DiningHistory[] | null> {
    const key = `user:dining-history:${userId}`;
    return this.cacheService.get<DiningHistory[]>(key);
  }

  async setUserDiningHistory(userId: string, history: DiningHistory[]): Promise<boolean> {
    const key = `user:dining-history:${userId}`;
    return this.cacheService.set(key, history, { ttl: CacheTTL.USER_PREFERENCES });
  }

  async addDiningHistoryEntry(userId: string, entry: DiningHistory): Promise<boolean> {
    // Get current history
    const currentHistory = await this.getUserDiningHistory(userId) || [];
    
    // Add new entry (keep last 100 entries for performance)
    const updatedHistory = [entry, ...currentHistory].slice(0, 100);
    
    // Update cache
    await this.setUserDiningHistory(userId, updatedHistory);
    
    // Invalidate related caches since preferences might have changed
    await this.invalidateUserRecommendationCaches(userId);
    
    return true;
  }

  async getUserEmotionalProfile(userId: string): Promise<any | null> {
    const key = `user:emotional-profile:${userId}`;
    return this.cacheService.get(key);
  }

  async setUserEmotionalProfile(userId: string, profile: any): Promise<boolean> {
    const key = `user:emotional-profile:${userId}`;
    return this.cacheService.set(key, profile, { ttl: CacheTTL.USER_PREFERENCES });
  }

  async getUserLocation(userId: string): Promise<{
    latitude: number;
    longitude: number;
    district: string;
  } | null> {
    const key = `user:location:${userId}`;
    return this.cacheService.get(key);
  }

  async setUserLocation(userId: string, location: {
    latitude: number;
    longitude: number;
    district: string;
  }): Promise<boolean> {
    const key = `user:location:${userId}`;
    // Shorter TTL for location data as it changes frequently
    return this.cacheService.set(key, location, { ttl: 300 }); // 5 minutes
  }

  async getFrequentUsers(): Promise<string[] | null> {
    const key = 'users:frequent';
    return this.cacheService.get<string[]>(key);
  }

  async setFrequentUsers(userIds: string[]): Promise<boolean> {
    const key = 'users:frequent';
    return this.cacheService.set(key, userIds, { ttl: CacheTTL.USER_PREFERENCES * 2 });
  }

  async isFrequentUser(userId: string): Promise<boolean> {
    const frequentUsers = await this.getFrequentUsers();
    return frequentUsers ? frequentUsers.includes(userId) : false;
  }

  async invalidateUser(userId: string): Promise<void> {
    const keys = [
      `user:${userId}`,
      CacheKeys.userPreferences(userId),
      `user:dining-history:${userId}`,
      `user:emotional-profile:${userId}`,
      `user:location:${userId}`,
    ];

    await Promise.all(keys.map(key => this.cacheService.del(key)));
    
    // Also invalidate recommendation caches
    await this.invalidateUserRecommendationCaches(userId);
  }

  async invalidateUserRecommendationCaches(userId: string): Promise<void> {
    // This would typically call the recommendation service to invalidate
    // For now, we'll just invalidate the basic recommendation keys
    const recommendationKeys = [
      CacheKeys.userRecommendations(userId),
      CacheKeys.userRecommendations(userId, 'happy'),
      CacheKeys.userRecommendations(userId, 'sad'),
      CacheKeys.userRecommendations(userId, 'celebrating'),
      CacheKeys.userRecommendations(userId, 'stressed'),
      CacheKeys.userRecommendations(userId, 'neutral'),
      `precomputed:recommendations:${userId}`,
    ];

    await Promise.all(recommendationKeys.map(key => this.cacheService.del(key)));
  }

  async warmupUserCache(userId: string, fetchUserFunction: (id: string) => Promise<User>): Promise<void> {
    const cachedUser = await this.getUser(userId);
    
    if (!cachedUser) {
      const user = await fetchUserFunction(userId);
      await this.setUser(user);
      
      // Also cache preferences separately for faster access
      if (user.preferences) {
        await this.setUserPreferences(userId, user.preferences);
      }
      
      if (user.diningHistory) {
        await this.setUserDiningHistory(userId, user.diningHistory);
      }
    }
  }

  async batchGetUsers(userIds: string[]): Promise<(User | null)[]> {
    const keys = userIds.map(id => `user:${id}`);
    return this.cacheService.mget<User>(keys);
  }

  async batchSetUsers(users: User[]): Promise<boolean> {
    const keyValuePairs = users.map(user => ({
      key: `user:${user.id}`,
      value: user,
      ttl: CacheTTL.USER_PREFERENCES
    }));

    return this.cacheService.mset(keyValuePairs);
  }
}