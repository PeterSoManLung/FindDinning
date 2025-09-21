import { BaseDataExtractor } from '../extractors/BaseDataExtractor';
import { DataSource, DataSourceType, RawRestaurantData, DataExtractionResult } from '../types/dataSource.types';

// Mock implementation for testing
class MockDataExtractor extends BaseDataExtractor {
  async extractRestaurantData(): Promise<DataExtractionResult> {
    return {
      success: true,
      data: [
        {
          sourceId: 'test',
          externalId: 'test-1',
          name: 'Test Restaurant',
          address: '123 Test Street, Hong Kong',
          latitude: 22.3193,
          longitude: 114.1694,
          cuisineType: ['Chinese'],
          priceRange: 2,
          rating: 4.5,
          reviewCount: 100,
          operatingHours: { 'Monday': '9:00 AM - 10:00 PM' },
          phone: '+85212345678',
          website: 'https://test-restaurant.com',
          menuItems: ['Dim Sum', 'Fried Rice'],
          features: ['WiFi', 'Parking'],
          photos: ['https://example.com/photo1.jpg'],
          reviews: [],
          lastUpdated: new Date(),
          dataQuality: 0.8
        }
      ],
      errors: [],
      metadata: {
        totalExtracted: 1,
        processingTime: 1000,
        sourceReliability: 0.9
      }
    };
  }

  async extractRestaurantById(externalId: string): Promise<RawRestaurantData | null> {
    if (externalId === 'test-1') {
      return {
        sourceId: 'test',
        externalId: 'test-1',
        name: 'Test Restaurant',
        address: '123 Test Street, Hong Kong',
        latitude: 22.3193,
        longitude: 114.1694,
        cuisineType: ['Chinese'],
        priceRange: 2,
        rating: 4.5,
        reviewCount: 100,
        operatingHours: { 'Monday': '9:00 AM - 10:00 PM' },
        phone: '+85212345678',
        website: 'https://test-restaurant.com',
        menuItems: ['Dim Sum', 'Fried Rice'],
        features: ['WiFi', 'Parking'],
        photos: ['https://example.com/photo1.jpg'],
        reviews: [],
        lastUpdated: new Date(),
        dataQuality: 0.8
      };
    }
    return null;
  }
}

describe('BaseDataExtractor', () => {
  let mockDataSource: DataSource;
  let extractor: MockDataExtractor;

  beforeEach(() => {
    mockDataSource = {
      id: 'test',
      name: 'Test Source',
      type: DataSourceType.API,
      baseUrl: 'https://api.test.com',
      isActive: true,
      rateLimitMs: 1000,
      maxRetries: 3,
      timeout: 10000,
      headers: {
        'Accept': 'application/json'
      }
    };

    extractor = new MockDataExtractor(mockDataSource);
  });

  afterEach(async () => {
    if ('cleanup' in extractor && typeof extractor.cleanup === 'function') {
      await extractor.cleanup();
    }
  });

  describe('constructor', () => {
    it('should initialize with data source configuration', () => {
      expect(extractor).toBeDefined();
      expect(extractor['dataSource']).toEqual(mockDataSource);
    });

    it('should create HTTP client with correct configuration', () => {
      const httpClient = extractor['httpClient'];
      expect(httpClient.defaults.baseURL).toBe(mockDataSource.baseUrl);
      expect(httpClient.defaults.timeout).toBe(mockDataSource.timeout);
    });
  });

  describe('extractRestaurantData', () => {
    it('should extract restaurant data successfully', async () => {
      const result = await extractor.extractRestaurantData();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.totalExtracted).toBe(1);
    });

    it('should return restaurant with correct structure', async () => {
      const result = await extractor.extractRestaurantData();
      const restaurant = result.data![0];

      expect(restaurant).toHaveProperty('sourceId');
      expect(restaurant).toHaveProperty('externalId');
      expect(restaurant).toHaveProperty('name');
      expect(restaurant).toHaveProperty('address');
      expect(restaurant).toHaveProperty('latitude');
      expect(restaurant).toHaveProperty('longitude');
      expect(restaurant).toHaveProperty('lastUpdated');
      expect(restaurant).toHaveProperty('dataQuality');
    });
  });

  describe('extractRestaurantById', () => {
    it('should extract specific restaurant by ID', async () => {
      const restaurant = await extractor.extractRestaurantById('test-1');

      expect(restaurant).not.toBeNull();
      expect(restaurant!.externalId).toBe('test-1');
      expect(restaurant!.name).toBe('Test Restaurant');
    });

    it('should return null for non-existent restaurant', async () => {
      const restaurant = await extractor.extractRestaurantById('non-existent');

      expect(restaurant).toBeNull();
    });
  });

  describe('healthCheck', () => {
    it('should perform health check', async () => {
      // Mock the HTTP client to avoid actual network calls
      jest.spyOn(extractor['httpClient'], 'get').mockResolvedValue({
        status: 200,
        statusText: 'OK',
        data: {},
        headers: {},
        config: {}
      });

      const isHealthy = await extractor.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should return false when health check fails', async () => {
      jest.spyOn(extractor['httpClient'], 'get').mockRejectedValue(new Error('Network error'));

      const isHealthy = await extractor.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('rate limiting', () => {
    it('should enforce rate limiting between requests', async () => {
      const startTime = Date.now();
      
      // Make two consecutive requests
      await extractor['enforceRateLimit']();
      await extractor['enforceRateLimit']();
      
      const endTime = Date.now();
      const elapsed = endTime - startTime;
      
      // Should take at least the rate limit time
      expect(elapsed).toBeGreaterThanOrEqual(mockDataSource.rateLimitMs);
    });
  });

  describe('data quality calculation', () => {
    it('should calculate data quality score correctly', () => {
      const testData: RawRestaurantData = {
        sourceId: 'test',
        externalId: 'test-1',
        name: 'Test Restaurant',
        address: '123 Test Street',
        latitude: 22.3193,
        longitude: 114.1694,
        cuisineType: ['Chinese'],
        priceRange: 2,
        rating: 4.5,
        phone: '+85212345678',
        website: 'https://test.com',
        lastUpdated: new Date(),
        dataQuality: 0.8
      };

      const quality = extractor['calculateDataQuality'](testData);
      expect(quality).toBeGreaterThan(0.8); // Should be high due to complete data
    });

    it('should return lower score for incomplete data', () => {
      const incompleteData: RawRestaurantData = {
        sourceId: 'test',
        externalId: 'test-1',
        name: 'Test Restaurant',
        lastUpdated: new Date(),
        dataQuality: 0.3
      };

      const quality = extractor['calculateDataQuality'](incompleteData);
      expect(quality).toBeLessThan(0.5); // Should be low due to missing data
    });
  });

  describe('text cleaning', () => {
    it('should clean text properly', () => {
      const dirtyText = '  Test   Restaurant!!!   ';
      const cleaned = extractor['cleanText'](dirtyText);
      
      expect(cleaned).toBe('Test Restaurant');
    });

    it('should handle empty or null text', () => {
      expect(extractor['cleanText']('')).toBe('');
      expect(extractor['cleanText'](null as any)).toBe('');
      expect(extractor['cleanText'](undefined as any)).toBe('');
    });

    it('should limit text length', () => {
      const longText = 'a'.repeat(1000);
      const cleaned = extractor['cleanText'](longText);
      
      expect(cleaned.length).toBeLessThanOrEqual(500);
    });
  });

  describe('coordinate parsing', () => {
    it('should parse valid Hong Kong coordinates', () => {
      const coords = extractor['parseCoordinates'](22.3193, 114.1694);
      
      expect(coords).not.toBeNull();
      expect(coords!.latitude).toBe(22.3193);
      expect(coords!.longitude).toBe(114.1694);
    });

    it('should return null for invalid coordinates', () => {
      const coords = extractor['parseCoordinates']('invalid', 'invalid');
      expect(coords).toBeNull();
    });

    it('should return null for coordinates outside Hong Kong', () => {
      const coords = extractor['parseCoordinates'](40.7128, -74.0060); // New York
      expect(coords).toBeNull();
    });
  });

  describe('price range parsing', () => {
    it('should parse price range indicators correctly', () => {
      expect(extractor['parsePriceRange']('$$$')).toBe(4);
      expect(extractor['parsePriceRange']('$$')).toBe(3);
      expect(extractor['parsePriceRange']('$')).toBe(1);
      expect(extractor['parsePriceRange']('expensive')).toBe(4);
      expect(extractor['parsePriceRange']('cheap')).toBe(1);
    });

    it('should return default for unknown price indicators', () => {
      expect(extractor['parsePriceRange']('unknown')).toBe(2);
      expect(extractor['parsePriceRange']('')).toBe(2);
    });
  });
});