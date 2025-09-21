import { ExtractorFactory } from '../extractors/ExtractorFactory';
import { PlatformDataExtractionService } from '../services/PlatformDataExtractionService';
import { DataSourceEnum } from '../types/dataSource.types';

describe('Platform Data Extractors', () => {
  let extractionService: PlatformDataExtractionService;

  beforeAll(() => {
    extractionService = new PlatformDataExtractionService();
  });

  afterAll(() => {
    ExtractorFactory.clearCache();
  });

  describe('ExtractorFactory', () => {
    test('should create all platform extractors', () => {
      const sources = Object.values(DataSourceEnum);
      
      for (const source of sources) {
        const extractor = ExtractorFactory.getExtractor(source);
        expect(extractor).toBeDefined();
        expect(extractor.extractRestaurantData).toBeDefined();
        expect(extractor.extractRestaurantById).toBeDefined();
        expect(extractor.healthCheck).toBeDefined();
      }
    });

    test('should return same instance for repeated calls', () => {
      const extractor1 = ExtractorFactory.getExtractor(DataSourceEnum.OPENRICE);
      const extractor2 = ExtractorFactory.getExtractor(DataSourceEnum.OPENRICE);
      
      expect(extractor1).toBe(extractor2);
    });

    test('should get all extractors', () => {
      const extractors = ExtractorFactory.getAllExtractors();
      
      expect(extractors.size).toBe(Object.values(DataSourceEnum).length);
      
      for (const source of Object.values(DataSourceEnum)) {
        expect(extractors.has(source)).toBe(true);
      }
    });

    test('should get reliability scores', () => {
      const scores = ExtractorFactory.getExtractorReliabilityScores();
      
      expect(scores.size).toBeGreaterThan(0);
      
      for (const [source, score] of scores.entries()) {
        expect(Object.values(DataSourceEnum)).toContain(source);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    });

    test('should get recommended extraction order', () => {
      const order = ExtractorFactory.getRecommendedExtractionOrder();
      
      expect(order.length).toBe(Object.values(DataSourceEnum).length);
      expect(order[0]).toBe(DataSourceEnum.HK_GOV); // Should be most reliable
    });

    test('should get extractor summary', () => {
      const summary = ExtractorFactory.getExtractorSummary();
      
      expect(summary.length).toBe(Object.values(DataSourceEnum).length);
      
      for (const item of summary) {
        expect(item.source).toBeDefined();
        expect(item.name).toBeDefined();
        expect(item.reliability).toBeGreaterThanOrEqual(0);
        expect(item.rateLimitMs).toBeGreaterThan(0);
        expect(typeof item.isActive).toBe('boolean');
      }
    });
  });

  describe('Individual Platform Extractors', () => {
    describe('OpenRice Extractor', () => {
      let extractor: any;

      beforeAll(() => {
        extractor = ExtractorFactory.getExtractor(DataSourceEnum.OPENRICE);
      });

      test('should have correct configuration', () => {
        expect(extractor.dataSource.id).toBe('openrice');
        expect(extractor.dataSource.name).toBe('OpenRice');
        expect(extractor.dataSource.rateLimitMs).toBe(1000);
        expect(extractor.dataSource.maxRetries).toBe(3);
      });

      test('should handle extraction parameters', async () => {
        // Mock the HTTP client to avoid actual API calls
        const mockResponse = {
          restaurants: [
            {
              id: '123',
              name: 'Test Restaurant',
              address: 'Test Address',
              latitude: 22.3193,
              longitude: 114.1694,
              cuisine_types: ['Chinese'],
              rating: 4.5,
              review_count: 100
            }
          ]
        };

        (extractor as any).makeRequest = jest.fn().mockResolvedValue(mockResponse);

        const result = await extractor.extractRestaurantData({
          district: 'Central',
          limit: 10
        });

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        if (result.data) {
          expect(result.data.length).toBeGreaterThan(0);
          expect(result.data[0].sourceId).toBe('openrice');
        }
      });
    });

    describe('TripAdvisor Extractor', () => {
      let extractor: any;

      beforeAll(() => {
        extractor = ExtractorFactory.getExtractor(DataSourceEnum.TRIPADVISOR);
      });

      test('should have correct configuration', () => {
        expect(extractor.dataSource.id).toBe('tripadvisor');
        expect(extractor.dataSource.name).toBe('TripAdvisor');
        expect(extractor.dataSource.rateLimitMs).toBe(3000); // Stricter rate limiting
        expect(extractor.dataSource.maxRetries).toBe(3);
      });

      test('should handle TripAdvisor data format', async () => {
        const mockResponse = {
          data: [
            {
              location_id: '456',
              name: 'TripAdvisor Restaurant',
              address_obj: { address_string: 'TripAdvisor Address' },
              latitude: 22.3193,
              longitude: 114.1694,
              cuisine: [{ name: 'Italian' }],
              rating: 4.0,
              num_reviews: 250
            }
          ]
        };

        (extractor as any).makeRequest = jest.fn().mockResolvedValue(mockResponse);

        const result = await extractor.extractRestaurantData({
          location: 'Hong Kong',
          limit: 20
        });

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        if (result.data) {
          expect(result.data.length).toBeGreaterThan(0);
          expect(result.data[0].sourceId).toBe('tripadvisor');
        }
      });
    });

    describe('Foodpanda Extractor', () => {
      let extractor: any;

      beforeAll(() => {
        extractor = ExtractorFactory.getExtractor(DataSourceEnum.FOODPANDA);
      });

      test('should have delivery-specific features', async () => {
        const mockResponse = {
          data: {
            restaurants: [
              {
                id: '789',
                name: 'Delivery Restaurant',
                address: 'Delivery Address',
                latitude: 22.3193,
                longitude: 114.1694,
                cuisines: [{ name: 'Thai' }],
                rating: 4.2,
                delivery_time: { min: 30, max: 45 },
                minimum_order_value: 50,
                delivery_fee: 0
              }
            ]
          }
        };

        (extractor as any).makeRequest = jest.fn().mockResolvedValue(mockResponse);

        const result = await extractor.extractRestaurantData();

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        if (result.data) {
          expect(result.data.length).toBeGreaterThan(0);
          
          const restaurant = result.data[0];
          expect(restaurant.sourceId).toBe('foodpanda');
          expect(restaurant.features).toContain('Food Delivery');
          expect(restaurant.features).toContain('Free Delivery');
        }
      });
    });
  });

  describe('PlatformDataExtractionService', () => {
    test('should extract from single platform', async () => {
      // Mock extractor
      const mockExtractor = {
        healthCheck: jest.fn().mockResolvedValue(true),
        extractRestaurantData: jest.fn().mockResolvedValue({
          success: true,
          data: [
            {
              sourceId: 'test',
              externalId: '123',
              name: 'Test Restaurant',
              dataQuality: 0.8
            }
          ],
          errors: [],
          metadata: {
            totalExtracted: 1,
            processingTime: 1000,
            sourceReliability: 0.8
          }
        })
      };

      ExtractorFactory.getExtractor = jest.fn().mockReturnValue(mockExtractor);

      const result = await extractionService.extractFromPlatform(DataSourceEnum.OPENRICE);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      if (result.data) {
        expect(result.data.length).toBe(1);
      }
      expect(mockExtractor.healthCheck).toHaveBeenCalled();
      expect(mockExtractor.extractRestaurantData).toHaveBeenCalled();
    });

    test('should handle extraction from multiple platforms', async () => {
      const mockExtractor = {
        healthCheck: jest.fn().mockResolvedValue(true),
        extractRestaurantData: jest.fn().mockResolvedValue({
          success: true,
          data: [{ sourceId: 'test', externalId: '123', name: 'Test', dataQuality: 0.8 }],
          errors: [],
          metadata: { totalExtracted: 1, processingTime: 1000, sourceReliability: 0.8 }
        })
      };

      ExtractorFactory.getExtractor = jest.fn().mockReturnValue(mockExtractor);
      ExtractorFactory.checkExtractorsHealth = jest.fn().mockResolvedValue(
        new Map([[DataSourceEnum.OPENRICE, true], [DataSourceEnum.TRIPADVISOR, true]])
      );

      const result = await extractionService.extractFromPlatforms([
        DataSourceEnum.OPENRICE,
        DataSourceEnum.TRIPADVISOR
      ]);

      expect(result.success).toBe(true);
      expect(result.totalRestaurants).toBe(2); // 1 from each platform
      expect(result.sourceResults.size).toBe(2);
    });

    test('should handle failed extractions gracefully', async () => {
      const mockExtractor = {
        healthCheck: jest.fn().mockResolvedValue(false),
        extractRestaurantData: jest.fn().mockRejectedValue(new Error('API Error'))
      };

      ExtractorFactory.getExtractor = jest.fn().mockReturnValue(mockExtractor);

      const result = await extractionService.extractFromPlatform(DataSourceEnum.OPENRICE);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('API Error');
      expect(result.metadata.totalExtracted).toBe(0);
    });

    test('should get platform health status', async () => {
      ExtractorFactory.checkAllExtractorsHealth = jest.fn().mockResolvedValue(
        new Map([
          [DataSourceEnum.OPENRICE, true],
          [DataSourceEnum.TRIPADVISOR, false],
          [DataSourceEnum.FOODPANDA, true]
        ])
      );

      const healthStatus = await extractionService.getPlatformHealthStatus();

      expect(healthStatus.size).toBe(3);
      expect(healthStatus.get(DataSourceEnum.OPENRICE)).toBe(true);
      expect(healthStatus.get(DataSourceEnum.TRIPADVISOR)).toBe(false);
      expect(healthStatus.get(DataSourceEnum.FOODPANDA)).toBe(true);
    });

    test('should extract restaurant from all platforms', async () => {
      const mockExtractor = {
        extractRestaurantData: jest.fn().mockResolvedValue({
          success: true,
          data: [
            {
              sourceId: 'test',
              externalId: '123',
              name: 'Matching Restaurant',
              dataQuality: 0.8
            }
          ],
          errors: [],
          metadata: { totalExtracted: 1, processingTime: 1000, sourceReliability: 0.8 }
        })
      };

      ExtractorFactory.getAllExtractors = jest.fn().mockReturnValue(
        new Map([
          [DataSourceEnum.OPENRICE, mockExtractor],
          [DataSourceEnum.TRIPADVISOR, mockExtractor]
        ])
      );

      const results = await extractionService.extractRestaurantFromAllPlatforms(
        'Matching Restaurant',
        'Hong Kong'
      );

      expect(results.size).toBe(2);
      expect(results.get(DataSourceEnum.OPENRICE)).toBeDefined();
      expect(results.get(DataSourceEnum.TRIPADVISOR)).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle extraction errors gracefully', async () => {
      const extractor = ExtractorFactory.getExtractor(DataSourceEnum.OPENRICE);
      
      // Mock a failed request
      (extractor as any).makeRequest = jest.fn().mockRejectedValue(new Error('Network Error'));
      
      const result = await extractor.extractRestaurantData();
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.metadata.totalExtracted).toBe(0);
    });

    test('should handle invalid data gracefully', async () => {
      const extractor = ExtractorFactory.getExtractor(DataSourceEnum.OPENRICE);
      
      // Mock response with invalid data
      const mockResponse = {
        restaurants: [
          {
            // Missing required fields
            id: null,
            name: '',
            latitude: 'invalid',
            longitude: 'invalid'
          }
        ]
      };
      
      (extractor as any).makeRequest = jest.fn().mockResolvedValue(mockResponse);
      
      const result = await extractor.extractRestaurantData();
      
      // Should handle invalid data and still return a result
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    test('should have health check functionality', async () => {
      const extractor = ExtractorFactory.getExtractor(DataSourceEnum.TRIPADVISOR);
      
      // Mock health check
      (extractor as any).httpClient = {
        get: jest.fn().mockResolvedValue({ status: 200 })
      };
      
      const isHealthy = await extractor.healthCheck();
      expect(typeof isHealthy).toBe('boolean');
    });

    test('should handle extraction by ID', async () => {
      const extractor = ExtractorFactory.getExtractor(DataSourceEnum.OPENRICE);
      
      // Test that the method exists
      expect(typeof extractor.extractRestaurantById).toBe('function');
      
      // Mock successful response
      const mockResponse = {
        restaurant: {
          id: '123',
          name: 'Test Restaurant',
          address: 'Test Address'
        }
      };
      
      (extractor as any).makeRequest = jest.fn().mockResolvedValue(mockResponse);
      
      const result = await extractor.extractRestaurantById('123');
      
      if (result) {
        expect(result.externalId).toBe('123');
        expect(result.sourceId).toBe('openrice');
      }
    });
  });

  describe('Integration with Existing Services', () => {
    test('should work with data normalization service', async () => {
      // This would test integration with existing normalization service
      // For now, we'll just verify the data format is compatible
      const extractor = ExtractorFactory.getExtractor(DataSourceEnum.OPENRICE);
      
      const mockResponse = {
        restaurants: [
          {
            id: '123',
            name: 'Integration Test Restaurant',
            address: 'Test Address',
            latitude: 22.3193,
            longitude: 114.1694
          }
        ]
      };

      (extractor as any).makeRequest = jest.fn().mockResolvedValue(mockResponse);
      const result = await extractor.extractRestaurantData();
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      
      if (result.data && result.data.length > 0) {
        const restaurant = result.data[0];
        
        // Verify required fields for normalization
        expect(restaurant.sourceId).toBeDefined();
        expect(restaurant.externalId).toBeDefined();
        expect(restaurant.name).toBeDefined();
        expect(restaurant.lastUpdated).toBeDefined();
        expect(restaurant.dataQuality).toBeDefined();
      }
    });

    test('should handle concurrent extractions', async () => {
      const sources = [DataSourceEnum.OPENRICE, DataSourceEnum.TRIPADVISOR, DataSourceEnum.FOODPANDA];
      
      const extractionPromises = sources.map(source => 
        extractionService.extractFromPlatform(source)
      );
      
      const results = await Promise.all(extractionPromises);
      
      expect(results).toHaveLength(3);
      for (const result of results) {
        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
      }
    });
  });
});