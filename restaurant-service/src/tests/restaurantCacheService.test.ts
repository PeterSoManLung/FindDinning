import { RestaurantCacheService } from '../services/restaurantCacheService';
import { CacheService } from '@find-dining/shared/services/cacheService';
import { Restaurant } from '../models/Restaurant';

// Mock the cache service
const mockCacheService = {
  get: jest.fn(),
  set: jest.fn().mockResolvedValue(true),
  del: jest.fn().mockResolvedValue(true),
  mget: jest.fn(),
  mset: jest.fn().mockResolvedValue(true),
  getOrSet: jest.fn()
} as unknown as CacheService;

describe('RestaurantCacheService', () => {
  let restaurantCacheService: RestaurantCacheService;
  let mockRestaurant: Restaurant;

  beforeEach(() => {
    jest.clearAllMocks();
    restaurantCacheService = new RestaurantCacheService(mockCacheService);
    
    mockRestaurant = {
      id: '1',
      name: 'Test Restaurant',
      cuisineType: ['Chinese'],
      location: {
        address: '123 Test St',
        latitude: 22.3193,
        longitude: 114.1694,
        district: 'Central'
      },
      priceRange: 2,
      rating: 4.5,
      negativeScore: 0.1,
      atmosphere: ['casual'],
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
      isLocalGem: true,
      authenticityScore: 0.9,
      governmentLicense: {
        licenseNumber: 'TEST123',
        isValid: true,
        violations: []
      },
      dataQualityScore: 0.95,
      negativeFeedbackTrends: [],
      platformData: [],
      lastSyncDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  describe('Restaurant Caching', () => {
    it('should cache and retrieve a restaurant', async () => {
      mockCacheService.get = jest.fn().mockResolvedValue(mockRestaurant);

      await restaurantCacheService.setRestaurant(mockRestaurant);
      const result = await restaurantCacheService.getRestaurant('1');

      expect(mockCacheService.set).toHaveBeenCalledWith(
        'restaurant:1',
        mockRestaurant,
        { ttl: 3600 }
      );
      expect(result).toEqual(mockRestaurant);
    });

    it('should batch cache multiple restaurants', async () => {
      const restaurants = [mockRestaurant, { ...mockRestaurant, id: '2', name: 'Restaurant 2' }];

      await restaurantCacheService.setRestaurants(restaurants);

      expect(mockCacheService.mset).toHaveBeenCalledWith([
        { key: 'restaurant:1', value: mockRestaurant, ttl: 3600 },
        { key: 'restaurant:2', value: restaurants[1], ttl: 3600 }
      ]);
    });

    it('should batch retrieve multiple restaurants', async () => {
      const restaurants = [mockRestaurant, null];
      mockCacheService.mget = jest.fn().mockResolvedValue(restaurants);

      const result = await restaurantCacheService.getRestaurants(['1', '2']);

      expect(mockCacheService.mget).toHaveBeenCalledWith(['restaurant:1', 'restaurant:2']);
      expect(result).toEqual(restaurants);
    });
  });

  describe('Search Result Caching', () => {
    it('should cache search results', async () => {
      const query = {
        cuisineType: ['Chinese'],
        priceRange: [1, 3] as [number, number],
        location: {
          latitude: 22.3193,
          longitude: 114.1694,
          radius: 1000
        }
      };
      const results = [mockRestaurant];

      await restaurantCacheService.setSearchResults(query, results);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('restaurant:search'),
        results,
        { ttl: 600 }
      );
    });

    it('should retrieve cached search results', async () => {
      const query = {
        cuisineType: ['Chinese'],
        priceRange: [1, 3] as [number, number]
      };
      const results = [mockRestaurant];
      
      mockCacheService.get = jest.fn().mockResolvedValue(results);

      const result = await restaurantCacheService.getSearchResults(query);

      expect(result).toEqual(results);
    });

    it('should generate consistent search keys for same query', async () => {
      const query = {
        cuisineType: ['Italian', 'Chinese'], // Will be sorted
        priceRange: [2, 4] as [number, number],
        atmosphere: ['romantic', 'casual'] // Will be sorted
      };

      await restaurantCacheService.setSearchResults(query, [mockRestaurant]);
      await restaurantCacheService.getSearchResults(query);

      // Both calls should use the same key
      const setCalls = (mockCacheService.set as jest.Mock).mock.calls;
      const getCalls = (mockCacheService.get as jest.Mock).mock.calls;
      
      expect(setCalls[0][0]).toBe(getCalls[0][0]);
    });
  });

  describe('Location-based Caching', () => {
    it('should cache restaurants by location', async () => {
      const restaurants = [mockRestaurant];
      const lat = 22.3193;
      const lng = 114.1694;
      const radius = 1000;

      await restaurantCacheService.setRestaurantsByLocation(lat, lng, radius, restaurants);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        `restaurants:location:${lat}:${lng}:${radius}`,
        restaurants,
        { ttl: 1800 }
      );
    });

    it('should retrieve restaurants by location', async () => {
      const restaurants = [mockRestaurant];
      mockCacheService.get = jest.fn().mockResolvedValue(restaurants);

      const result = await restaurantCacheService.getRestaurantsByLocation(22.3193, 114.1694, 1000);

      expect(result).toEqual(restaurants);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate restaurant cache', async () => {
      await restaurantCacheService.invalidateRestaurant('1');

      expect(mockCacheService.del).toHaveBeenCalledWith('restaurant:1');
    });
  });

  describe('Cache Warmup', () => {
    it('should warmup cache for missing restaurants', async () => {
      const restaurantIds = ['1', '2', '3'];
      const cachedRestaurants = [mockRestaurant, null, null]; // Only first is cached
      const freshRestaurants = [
        { ...mockRestaurant, id: '2', name: 'Restaurant 2' },
        { ...mockRestaurant, id: '3', name: 'Restaurant 3' }
      ];

      mockCacheService.mget = jest.fn().mockResolvedValue(cachedRestaurants);
      const fetchFunction = jest.fn().mockResolvedValue(freshRestaurants);

      await restaurantCacheService.warmupCache(restaurantIds, fetchFunction);

      expect(fetchFunction).toHaveBeenCalledWith(['2', '3']);
      expect(mockCacheService.mset).toHaveBeenCalledWith([
        { key: 'restaurant:2', value: freshRestaurants[0], ttl: 3600 },
        { key: 'restaurant:3', value: freshRestaurants[1], ttl: 3600 }
      ]);
    });

    it('should not fetch if all restaurants are cached', async () => {
      const restaurantIds = ['1', '2'];
      const cachedRestaurants = [mockRestaurant, { ...mockRestaurant, id: '2' }];

      mockCacheService.mget = jest.fn().mockResolvedValue(cachedRestaurants);
      const fetchFunction = jest.fn();

      await restaurantCacheService.warmupCache(restaurantIds, fetchFunction);

      expect(fetchFunction).not.toHaveBeenCalled();
    });
  });

  describe('Performance Tests', () => {
    it('should handle high-volume restaurant caching efficiently', async () => {
      const restaurants = Array.from({ length: 1000 }, (_, i) => ({
        ...mockRestaurant,
        id: `${i}`,
        name: `Restaurant ${i}`
      }));

      const startTime = Date.now();
      await restaurantCacheService.setRestaurants(restaurants);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100); // Should be very fast with mocked cache
      expect(mockCacheService.mset).toHaveBeenCalledTimes(1);
    });

    it('should efficiently retrieve multiple restaurants', async () => {
      const restaurantIds = Array.from({ length: 100 }, (_, i) => `${i}`);
      const mockResults = restaurantIds.map(id => ({ ...mockRestaurant, id }));
      
      mockCacheService.mget = jest.fn().mockResolvedValue(mockResults);

      const startTime = Date.now();
      const results = await restaurantCacheService.getRestaurants(restaurantIds);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(50);
      expect(results).toHaveLength(100);
      expect(mockCacheService.mget).toHaveBeenCalledTimes(1); // Single batch call
    });

    it('should generate search keys efficiently', async () => {
      const complexQuery = {
        cuisineType: ['Chinese', 'Italian', 'Japanese', 'Thai', 'Indian'],
        priceRange: [1, 4] as [number, number],
        location: {
          latitude: 22.3193,
          longitude: 114.1694,
          radius: 2000
        },
        atmosphere: ['casual', 'romantic', 'family-friendly', 'business'],
        isLocalGem: true
      };

      const startTime = Date.now();
      
      // Perform multiple operations with the same complex query
      for (let i = 0; i < 100; i++) {
        await restaurantCacheService.setSearchResults(complexQuery, [mockRestaurant]);
      }
      
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(200);
      expect(mockCacheService.set).toHaveBeenCalledTimes(100);
    });
  });
});