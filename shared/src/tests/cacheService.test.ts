import { CacheService, CacheKeys, CacheTTL } from '../services/cacheService';

// Mock Redis client for testing
const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  set: jest.fn().mockResolvedValue('OK'),
  setEx: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(1),
  flushDb: jest.fn().mockResolvedValue('OK'),
  mGet: jest.fn(),
  multi: jest.fn().mockReturnValue({
    setEx: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([])
  }),
  on: jest.fn()
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient)
}));

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    cacheService = new CacheService({
      host: 'localhost',
      port: 6379,
      keyPrefix: 'test:'
    });
  });

  describe('Basic Operations', () => {
    it('should set and get a value', async () => {
      const testData = { id: '1', name: 'Test Restaurant' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(testData));

      await cacheService.set('restaurant:1', testData);
      const result = await cacheService.get('restaurant:1');

      expect(mockRedisClient.set).toHaveBeenCalledWith('test:restaurant:1', JSON.stringify(testData));
      expect(result).toEqual(testData);
    });

    it('should set value with TTL', async () => {
      const testData = { id: '1', name: 'Test Restaurant' };

      await cacheService.set('restaurant:1', testData, { ttl: 3600 });

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'test:restaurant:1',
        3600,
        JSON.stringify(testData)
      );
    });

    it('should return null for non-existent key', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await cacheService.get('non-existent');

      expect(result).toBeNull();
    });

    it('should delete a key', async () => {
      const result = await cacheService.del('restaurant:1');

      expect(mockRedisClient.del).toHaveBeenCalledWith('test:restaurant:1');
      expect(result).toBe(true);
    });

    it('should check if key exists', async () => {
      const result = await cacheService.exists('restaurant:1');

      expect(mockRedisClient.exists).toHaveBeenCalledWith('test:restaurant:1');
      expect(result).toBe(true);
    });
  });

  describe('Batch Operations', () => {
    it('should get multiple values', async () => {
      const testData = [
        JSON.stringify({ id: '1', name: 'Restaurant 1' }),
        JSON.stringify({ id: '2', name: 'Restaurant 2' })
      ];
      mockRedisClient.mGet.mockResolvedValue(testData);

      const result = await cacheService.mget(['restaurant:1', 'restaurant:2']);

      expect(mockRedisClient.mGet).toHaveBeenCalledWith(['test:restaurant:1', 'test:restaurant:2']);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: '1', name: 'Restaurant 1' });
    });

    it('should set multiple values', async () => {
      const keyValuePairs = [
        { key: 'restaurant:1', value: { id: '1', name: 'Restaurant 1' }, ttl: 3600 },
        { key: 'restaurant:2', value: { id: '2', name: 'Restaurant 2' } }
      ];

      await cacheService.mset(keyValuePairs);

      expect(mockRedisClient.multi).toHaveBeenCalled();
    });
  });

  describe('getOrSet Pattern', () => {
    it('should return cached value if exists', async () => {
      const cachedData = { id: '1', name: 'Cached Restaurant' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedData));

      const fetchFunction = jest.fn().mockResolvedValue({ id: '1', name: 'Fresh Restaurant' });
      const result = await cacheService.getOrSet('restaurant:1', fetchFunction);

      expect(fetchFunction).not.toHaveBeenCalled();
      expect(result).toEqual(cachedData);
    });

    it('should fetch and cache if not exists', async () => {
      const freshData = { id: '1', name: 'Fresh Restaurant' };
      mockRedisClient.get.mockResolvedValue(null);

      const fetchFunction = jest.fn().mockResolvedValue(freshData);
      const result = await cacheService.getOrSet('restaurant:1', fetchFunction, { ttl: 3600 });

      expect(fetchFunction).toHaveBeenCalled();
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        'test:restaurant:1',
        3600,
        JSON.stringify(freshData)
      );
      expect(result).toEqual(freshData);
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Connection failed'));

      const result = await cacheService.get('restaurant:1');

      expect(result).toBeNull();
    });

    it('should handle set errors gracefully', async () => {
      mockRedisClient.set.mockRejectedValue(new Error('Set failed'));

      const result = await cacheService.set('restaurant:1', { id: '1' });

      expect(result).toBe(false);
    });
  });
});

describe('CacheKeys', () => {
  it('should generate correct restaurant key', () => {
    expect(CacheKeys.restaurant('123')).toBe('restaurant:123');
  });

  it('should generate correct search key', () => {
    expect(CacheKeys.restaurantSearch('chinese', 'central')).toBe('restaurant:search:chinese:central');
  });

  it('should generate correct user preferences key', () => {
    expect(CacheKeys.userPreferences('user123')).toBe('user:preferences:user123');
  });

  it('should generate correct recommendations key', () => {
    expect(CacheKeys.userRecommendations('user123', 'happy')).toBe('recommendations:user123:happy');
  });

  it('should generate correct location key', () => {
    expect(CacheKeys.restaurantsByLocation(22.3193, 114.1694, 1000))
      .toBe('restaurants:location:22.3193:114.1694:1000');
  });
});

describe('Performance Tests', () => {
  beforeEach(() => {
    // Reset mocks for performance tests
    jest.clearAllMocks();
  });

  it('should handle high-volume cache operations efficiently', async () => {
    const startTime = Date.now();
    const operations = [];

    // Simulate 1000 cache operations
    for (let i = 0; i < 1000; i++) {
      operations.push(cacheService.set(`key:${i}`, { id: i, data: `data-${i}` }));
    }

    await Promise.all(operations);
    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete 1000 operations in under 1 second (mock operations)
    expect(duration).toBeLessThan(1000);
    expect(mockRedisClient.set).toHaveBeenCalledTimes(1000);
  });

  it('should efficiently batch multiple get operations', async () => {
    const keys = Array.from({ length: 100 }, (_, i) => `restaurant:${i}`);
    const mockValues = keys.map(key => JSON.stringify({ id: key, name: `Restaurant ${key}` }));
    
    mockRedisClient.mGet.mockResolvedValue(mockValues);

    const startTime = Date.now();
    const result = await cacheService.mget(keys);
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(100); // Should be very fast for mocked operations
    expect(result).toHaveLength(100);
    expect(mockRedisClient.mGet).toHaveBeenCalledTimes(1); // Single batch call
  });

  it('should handle cache misses efficiently', async () => {
    mockRedisClient.get.mockResolvedValue(null);
    
    const startTime = Date.now();
    const operations = [];

    for (let i = 0; i < 100; i++) {
      operations.push(cacheService.get(`missing:${i}`));
    }

    const results = await Promise.all(operations);
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(500);
    expect(results.every(result => result === null)).toBe(true);
  });
});

describe('Cache TTL Constants', () => {
  it('should have appropriate TTL values', () => {
    expect(CacheTTL.RESTAURANT_DATA).toBe(3600); // 1 hour
    expect(CacheTTL.USER_PREFERENCES).toBe(1800); // 30 minutes
    expect(CacheTTL.RECOMMENDATIONS).toBe(900); // 15 minutes
    expect(CacheTTL.SEARCH_RESULTS).toBe(600); // 10 minutes
    expect(CacheTTL.REVIEWS).toBe(1800); // 30 minutes
    expect(CacheTTL.NEGATIVE_FEEDBACK).toBe(3600); // 1 hour
    expect(CacheTTL.EMOTION_MAPPING).toBe(86400); // 24 hours
    expect(CacheTTL.LOCATION_SEARCH).toBe(1800); // 30 minutes
  });
});