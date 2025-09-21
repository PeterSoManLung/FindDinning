import { DataNormalizationService } from '../services/DataNormalizationService';
import { RawRestaurantData } from '../types/dataSource.types';

describe('DataNormalizationService', () => {
  let service: DataNormalizationService;

  beforeEach(() => {
    service = new DataNormalizationService();
  });

  describe('normalizeRestaurantData', () => {
    it('should normalize valid restaurant data', async () => {
      const rawData: RawRestaurantData[] = [
        {
          sourceId: 'test',
          externalId: 'test-1',
          name: '  Test Restaurant  ',
          address: '123 Test Street, Central, Hong Kong',
          latitude: 22.2783,
          longitude: 114.1747,
          cuisineType: ['chinese', 'dim sum'],
          priceRange: 2,
          rating: 4.5,
          reviewCount: 100,
          operatingHours: {
            'mon': '9:00 am - 10:00 pm',
            'tue': '9:00 am - 10:00 pm'
          },
          phone: '12345678',
          website: 'test-restaurant.com',
          menuItems: ['Har Gow', 'Siu Mai'],
          features: ['wifi', 'parking'],
          photos: ['https://example.com/photo1.jpg'],
          reviews: [
            {
              externalId: 'review-1',
              rating: 5,
              content: 'Great food!',
              authorName: 'John Doe',
              source: 'test'
            }
          ],
          lastUpdated: new Date(),
          dataQuality: 0.8
        }
      ];

      const normalized = await service.normalizeRestaurantData(rawData, 'test');

      expect(normalized).toHaveLength(1);
      
      const restaurant = normalized[0];
      expect(restaurant.name).toBe('Test Restaurant');
      expect(restaurant.address).toBe('123 Test Street, Central, Hong Kong');
      expect(restaurant.location.latitude).toBe(22.2783);
      expect(restaurant.location.longitude).toBe(114.1747);
      expect(restaurant.location.district).toBe('Central');
      expect(restaurant.cuisineType).toContain('Chinese');
      expect(restaurant.cuisineType).toContain('Dim Sum');
      expect(restaurant.contactInfo.phone).toBe('+85212345678');
      expect(restaurant.contactInfo.website).toBe('https://test-restaurant.com');
    });

    it('should skip restaurants with missing critical data', async () => {
      const rawData: RawRestaurantData[] = [
        {
          sourceId: 'test',
          externalId: 'test-1',
          name: '', // Missing name
          address: '123 Test Street',
          lastUpdated: new Date(),
          dataQuality: 0.5
        },
        {
          sourceId: 'test',
          externalId: 'test-2',
          name: 'Valid Restaurant',
          address: '456 Valid Street',
          lastUpdated: new Date(),
          dataQuality: 0.7
        }
      ];

      const normalized = await service.normalizeRestaurantData(rawData, 'test');

      expect(normalized).toHaveLength(1);
      expect(normalized[0].name).toBe('Valid Restaurant');
    });

    it('should handle missing optional fields gracefully', async () => {
      const rawData: RawRestaurantData[] = [
        {
          sourceId: 'test',
          externalId: 'test-1',
          name: 'Minimal Restaurant',
          address: '123 Test Street',
          lastUpdated: new Date(),
          dataQuality: 0.5
        }
      ];

      const normalized = await service.normalizeRestaurantData(rawData, 'test');

      expect(normalized).toHaveLength(1);
      
      const restaurant = normalized[0];
      expect(restaurant.name).toBe('Minimal Restaurant');
      expect(restaurant.cuisineType).toHaveLength(0);
      expect(restaurant.priceRange).toBe(2); // Default
      expect(restaurant.rating).toBe(0); // Default
      expect(restaurant.reviewCount).toBe(0);
    });
  });

  describe('name normalization', () => {
    it('should clean and normalize restaurant names', () => {
      const testCases = [
        { input: '  Test Restaurant  ', expected: 'Test Restaurant' },
        { input: 'Test@#$%Restaurant!!!', expected: 'TestRestaurant' },
        { input: 'Multiple   Spaces   Restaurant', expected: 'Multiple Spaces Restaurant' },
        { input: 'A'.repeat(150), expected: 'A'.repeat(100) } // Length limit
      ];

      testCases.forEach(({ input, expected }) => {
        const result = service['normalizeName'](input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('location normalization', () => {
    it('should normalize valid Hong Kong coordinates', () => {
      const rawData: RawRestaurantData = {
        sourceId: 'test',
        externalId: 'test-1',
        name: 'Test',
        latitude: 22.2783,
        longitude: 114.1747,
        lastUpdated: new Date(),
        dataQuality: 0.8
      };

      const location = service['normalizeLocation'](rawData);

      expect(location.latitude).toBe(22.2783);
      expect(location.longitude).toBe(114.1747);
      expect(location.district).toBe('Central');
    });

    it('should return default location for invalid coordinates', () => {
      const rawData: RawRestaurantData = {
        sourceId: 'test',
        externalId: 'test-1',
        name: 'Test',
        latitude: 40.7128, // New York coordinates
        longitude: -74.0060,
        lastUpdated: new Date(),
        dataQuality: 0.8
      };

      const location = service['normalizeLocation'](rawData);

      expect(location.latitude).toBe(22.3193); // Default Hong Kong coordinates
      expect(location.longitude).toBe(114.1694);
      expect(location.district).toBe('Unknown');
    });

    it('should determine correct Hong Kong districts', () => {
      const testCases = [
        { lat: 22.2783, lng: 114.1747, expectedDistrict: 'Central' },
        { lat: 22.2976, lng: 114.1722, expectedDistrict: 'Tsim Sha Tsui' },
        { lat: 22.2793, lng: 114.1847, expectedDistrict: 'Causeway Bay' },
        { lat: 22.3193, lng: 114.1694, expectedDistrict: 'Mong Kok' }
      ];

      testCases.forEach(({ lat, lng, expectedDistrict }) => {
        const district = service['determineDistrict'](lat, lng);
        expect(district).toBe(expectedDistrict);
      });
    });
  });

  describe('cuisine type normalization', () => {
    it('should normalize and map cuisine types correctly', () => {
      const input = ['chinese', 'dim sum', 'JAPANESE', 'sushi', 'unknown cuisine'];
      const result = service['normalizeCuisineTypes'](input);

      expect(result).toContain('Chinese');
      expect(result).toContain('Dim Sum');
      expect(result).toContain('Japanese');
      expect(result).toContain('Unknown Cuisine');
      expect(result).not.toContain('sushi'); // Should be mapped to Japanese
    });

    it('should remove duplicates', () => {
      const input = ['chinese', 'Chinese', 'CHINESE'];
      const result = service['normalizeCuisineTypes'](input);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe('Chinese');
    });
  });

  describe('price range normalization', () => {
    it('should normalize price ranges correctly', () => {
      expect(service['normalizePriceRange'](1)).toBe(1);
      expect(service['normalizePriceRange'](4)).toBe(4);
      expect(service['normalizePriceRange'](2.7)).toBe(3); // Should round
      expect(service['normalizePriceRange'](0)).toBe(2); // Default for invalid
      expect(service['normalizePriceRange'](5)).toBe(2); // Default for out of range
      expect(service['normalizePriceRange'](undefined)).toBe(2); // Default for undefined
    });
  });

  describe('rating normalization', () => {
    it('should normalize ratings correctly', () => {
      expect(service['normalizeRating'](4.567)).toBe(4.6); // Round to 1 decimal
      expect(service['normalizeRating'](0)).toBe(0);
      expect(service['normalizeRating'](5)).toBe(5);
      expect(service['normalizeRating'](6)).toBe(5); // Cap at 5
      expect(service['normalizeRating'](-1)).toBe(0); // Floor at 0
      expect(service['normalizeRating'](undefined)).toBe(0); // Default
    });
  });

  describe('operating hours normalization', () => {
    it('should normalize operating hours correctly', () => {
      const input = {
        'mon': '9:00 am - 10:00 pm',
        'tue': '9:00am-10:00pm',
        'wed': 'closed',
        'thursday': '10:00 AM - 11:00 PM'
      };

      const result = service['normalizeOperatingHours'](input);

      expect(result['Monday']).toBe('9:00:00 am - 10:00:00 pm');
      expect(result['Tuesday']).toBe('9:00:00 am-10:00:00 pm');
      expect(result['Wednesday']).toBe('Closed');
      expect(result['Thursday']).toBe('10:00:00 AM - 11:00:00 PM');
    });
  });

  describe('phone normalization', () => {
    it('should normalize Hong Kong phone numbers', () => {
      expect(service['normalizePhone']('12345678')).toBe('+85212345678');
      expect(service['normalizePhone']('+85212345678')).toBe('+85212345678');
      expect(service['normalizePhone']('1234-5678')).toBe('+85212345678');
      expect(service['normalizePhone']('123456789')).toBeUndefined(); // Invalid length
      expect(service['normalizePhone']('abcd1234')).toBeUndefined(); // Invalid format
    });
  });

  describe('website normalization', () => {
    it('should normalize website URLs', () => {
      expect(service['normalizeWebsite']('example.com')).toBe('https://example.com');
      expect(service['normalizeWebsite']('http://example.com')).toBe('http://example.com');
      expect(service['normalizeWebsite']('https://example.com')).toBe('https://example.com');
      expect(service['normalizeWebsite']('invalid-url')).toBeUndefined();
      expect(service['normalizeWebsite']('')).toBeUndefined();
    });
  });

  describe('data quality calculation', () => {
    it('should calculate data quality scores correctly', () => {
      const completeData: RawRestaurantData = {
        sourceId: 'test',
        externalId: 'test-1',
        name: 'Complete Restaurant',
        address: '123 Test Street',
        latitude: 22.2783,
        longitude: 114.1747,
        cuisineType: ['Chinese'],
        priceRange: 2,
        rating: 4.5,
        phone: '+85212345678',
        website: 'https://example.com',
        lastUpdated: new Date(),
        dataQuality: 0.9
      };

      const quality = service['calculateDataQuality'](completeData);

      expect(quality.overall).toBeGreaterThan(0.8);
      expect(quality.completeness).toBeGreaterThan(0.8);
      expect(quality.accuracy).toBe(1.0); // All data is valid
      expect(quality.freshness).toBe(1.0); // Just updated
    });

    it('should penalize incomplete data', () => {
      const incompleteData: RawRestaurantData = {
        sourceId: 'test',
        externalId: 'test-1',
        name: 'Incomplete Restaurant',
        address: '123 Test Street',
        lastUpdated: new Date(),
        dataQuality: 0.3
      };

      const quality = service['calculateDataQuality'](incompleteData);

      expect(quality.completeness).toBeLessThan(0.5);
      expect(quality.overall).toBeLessThan(0.8);
    });

    it('should penalize stale data', () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 100); // 100 days ago

      const staleData: RawRestaurantData = {
        sourceId: 'test',
        externalId: 'test-1',
        name: 'Stale Restaurant',
        address: '123 Test Street',
        lastUpdated: staleDate,
        dataQuality: 0.8
      };

      const quality = service['calculateDataQuality'](staleData);

      expect(quality.freshness).toBeLessThan(0.6);
    });
  });
});