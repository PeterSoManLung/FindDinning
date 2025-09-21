import { createClient, RedisClientType } from 'redis';

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  compress?: boolean;
}

export class CacheService {
  private client: RedisClientType;
  private keyPrefix: string;
  private isConnected: boolean = false;

  constructor(config: CacheConfig) {
    this.keyPrefix = config.keyPrefix || 'find-dining:';
    this.client = createClient({
      socket: {
        host: config.host,
        port: config.port,
      },
      password: config.password,
      database: config.db || 0,
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log('Redis Client Connected');
      this.isConnected = true;
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      const value = await this.client.get(this.getKey(key));
      if (!value) {
        return null;
      }
      
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      const serializedValue = JSON.stringify(value);
      const cacheKey = this.getKey(key);
      
      if (options?.ttl) {
        await this.client.setEx(cacheKey, options.ttl, serializedValue);
      } else {
        await this.client.set(cacheKey, serializedValue);
      }
      
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      const result = await this.client.del(this.getKey(key));
      return result > 0;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      const result = await this.client.exists(this.getKey(key));
      return result > 0;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  async flush(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      await this.client.flushDb();
      return true;
    } catch (error) {
      console.error('Cache flush error:', error);
      return false;
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      const cacheKeys = keys.map(key => this.getKey(key));
      const values = await this.client.mGet(cacheKeys);
      
      return values.map(value => {
        if (!value) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      console.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  }

  async mset<T>(keyValuePairs: Array<{ key: string; value: T; ttl?: number }>): Promise<boolean> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }
      
      const pipeline = this.client.multi();
      
      for (const { key, value, ttl } of keyValuePairs) {
        const cacheKey = this.getKey(key);
        const serializedValue = JSON.stringify(value);
        
        if (ttl) {
          pipeline.setEx(cacheKey, ttl, serializedValue);
        } else {
          pipeline.set(cacheKey, serializedValue);
        }
      }
      
      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('Cache mset error:', error);
      return false;
    }
  }

  // Cache patterns for common use cases
  async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    const fresh = await fetchFunction();
    await this.set(key, fresh, options);
    return fresh;
  }
}

// Cache key generators for consistent naming
export class CacheKeys {
  static restaurant(id: string): string {
    return `restaurant:${id}`;
  }

  static restaurantSearch(query: string, location?: string): string {
    const locationPart = location ? `:${location}` : '';
    return `restaurant:search:${query}${locationPart}`;
  }

  static userPreferences(userId: string): string {
    return `user:preferences:${userId}`;
  }

  static userRecommendations(userId: string, emotionalState?: string): string {
    const emotionPart = emotionalState ? `:${emotionalState}` : '';
    return `recommendations:${userId}${emotionPart}`;
  }

  static restaurantReviews(restaurantId: string): string {
    return `reviews:restaurant:${restaurantId}`;
  }

  static negativeFeedbackAnalysis(restaurantId: string): string {
    return `negative-feedback:${restaurantId}`;
  }

  static emotionMapping(emotion: string): string {
    return `emotion:mapping:${emotion}`;
  }

  static restaurantsByLocation(lat: number, lng: number, radius: number): string {
    return `restaurants:location:${lat}:${lng}:${radius}`;
  }
}

// TTL constants (in seconds)
export const CacheTTL = {
  RESTAURANT_DATA: 3600, // 1 hour
  USER_PREFERENCES: 1800, // 30 minutes
  RECOMMENDATIONS: 900, // 15 minutes
  SEARCH_RESULTS: 600, // 10 minutes
  REVIEWS: 1800, // 30 minutes
  NEGATIVE_FEEDBACK: 3600, // 1 hour
  EMOTION_MAPPING: 86400, // 24 hours
  LOCATION_SEARCH: 1800, // 30 minutes
} as const;