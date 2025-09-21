import { CacheService, CacheKeys, CacheTTL } from '../../../shared/src/services/cacheService';
import { Restaurant } from '../../../shared/src/types/restaurant.types';

export interface RestaurantSearchQuery {
  cuisineType?: string[];
  priceRange?: [number, number];
  location?: {
    latitude: number;
    longitude: number;
    radius: number;
  };
  atmosphere?: string[];
  isLocalGem?: boolean;
}

export class RestaurantCacheService {
  constructor(private cacheService: CacheService) {}

  async getRestaurant(id: string): Promise<Restaurant | null> {
    return this.cacheService.get<Restaurant>(CacheKeys.restaurant(id));
  }

  async setRestaurant(restaurant: Restaurant): Promise<boolean> {
    return this.cacheService.set(
      CacheKeys.restaurant(restaurant.id),
      restaurant,
      { ttl: CacheTTL.RESTAURANT_DATA }
    );
  }

  async getRestaurants(ids: string[]): Promise<(Restaurant | null)[]> {
    const keys = ids.map(id => CacheKeys.restaurant(id));
    return this.cacheService.mget<Restaurant>(keys);
  }

  async setRestaurants(restaurants: Restaurant[]): Promise<boolean> {
    const keyValuePairs = restaurants.map(restaurant => ({
      key: CacheKeys.restaurant(restaurant.id),
      value: restaurant,
      ttl: CacheTTL.RESTAURANT_DATA
    }));
    
    return this.cacheService.mset(keyValuePairs);
  }

  async getSearchResults(query: RestaurantSearchQuery): Promise<Restaurant[] | null> {
    const searchKey = this.generateSearchKey(query);
    return this.cacheService.get<Restaurant[]>(searchKey);
  }

  async setSearchResults(query: RestaurantSearchQuery, results: Restaurant[]): Promise<boolean> {
    const searchKey = this.generateSearchKey(query);
    return this.cacheService.set(searchKey, results, { ttl: CacheTTL.SEARCH_RESULTS });
  }

  async getRestaurantsByLocation(
    latitude: number,
    longitude: number,
    radius: number
  ): Promise<Restaurant[] | null> {
    const key = CacheKeys.restaurantsByLocation(latitude, longitude, radius);
    return this.cacheService.get<Restaurant[]>(key);
  }

  async setRestaurantsByLocation(
    latitude: number,
    longitude: number,
    radius: number,
    restaurants: Restaurant[]
  ): Promise<boolean> {
    const key = CacheKeys.restaurantsByLocation(latitude, longitude, radius);
    return this.cacheService.set(key, restaurants, { ttl: CacheTTL.LOCATION_SEARCH });
  }

  async invalidateRestaurant(id: string): Promise<boolean> {
    // Invalidate the specific restaurant cache
    const restaurantKey = CacheKeys.restaurant(id);
    await this.cacheService.del(restaurantKey);
    
    // Note: In a production system, you might want to implement
    // more sophisticated cache invalidation for search results
    // that might contain this restaurant
    
    return true;
  }

  async warmupCache(restaurantIds: string[], fetchFunction: (ids: string[]) => Promise<Restaurant[]>): Promise<void> {
    // Check which restaurants are not in cache
    const cachedRestaurants = await this.getRestaurants(restaurantIds);
    const missingIds: string[] = [];
    
    cachedRestaurants.forEach((restaurant, index) => {
      if (!restaurant) {
        missingIds.push(restaurantIds[index]);
      }
    });
    
    if (missingIds.length > 0) {
      // Fetch missing restaurants and cache them
      const freshRestaurants = await fetchFunction(missingIds);
      await this.setRestaurants(freshRestaurants);
    }
  }

  private generateSearchKey(query: RestaurantSearchQuery): string {
    const parts = ['restaurant:search'];
    
    if (query.cuisineType?.length) {
      parts.push(`cuisine:${query.cuisineType.sort().join(',')}`);
    }
    
    if (query.priceRange) {
      parts.push(`price:${query.priceRange[0]}-${query.priceRange[1]}`);
    }
    
    if (query.location) {
      const { latitude, longitude, radius } = query.location;
      parts.push(`location:${latitude}:${longitude}:${radius}`);
    }
    
    if (query.atmosphere?.length) {
      parts.push(`atmosphere:${query.atmosphere.sort().join(',')}`);
    }
    
    if (query.isLocalGem !== undefined) {
      parts.push(`local:${query.isLocalGem}`);
    }
    
    return parts.join(':');
  }
}