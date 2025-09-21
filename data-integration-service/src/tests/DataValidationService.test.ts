import { DataValidationService } from '../services/DataValidationService';
import { RawRestaurantData, NormalizedRestaurantData } from '../types/dataSource.types';

describe('DataValidationService', () => {
  let service: DataValidationService;

  beforeEach(() => {
    service = new DataValidationService();
  });

  describe('validateRawData', () => {
    it('should validate correct raw restaurant data', async () => {
      const validData: RawRestaurantData[] = [
        {
          sourceId: 'test',
          externalId: 'test-1',
          name: 'Valid Restaurant',
          address: '123 Test Street, Hong Kong',
          latitude: 22.2783,
          longitude: 114.1747,
          cuisineType: ['Chinese'],
          priceRange: 2,
          rating: 4.5,
          reviewCount: 100,
          operatingHours: { 'Monday': '9:00 AM - 10:00 PM' },
          phone: '+85212345678',
          website: 'https://example.com',
          menuItems: ['Dim Sum'],
          features: ['WiFi'],
          photos: ['https://example.com/photo.jpg'],
          reviews: [],
          lastUpdated: new Date(),
          dataQuality: 0.8
        }
      ];

      const results = await service.validateRawData(validData);

      expect(results).toHaveLength(1);
      expect(results[0].isValid).toBe(true);
      expect(results[0].errors.filter(e => e.severity === 'critical')).toHaveLength(0);
      expect(results[0].qualityScore).toBeGreaterThan(0.8);
    });

    it('should identify critical validation errors', async () => {
      const invalidData: RawRestaurantData[] = [
        {
          sourceId: 'test',
          externalId: 'test-1',
          name: '', // Missing required name
          address: '123 Test Street',
          lastUpdated: new Date(),
          dataQuality: 0.5
        }
      ];

      const results = await service.validateRawData(invalidData);

      expect(results).toHaveLength(1);
      expect(results[0].isValid).toBe(false);
      
      const criticalErrors = results[0].errors.filter(e => e.severity === 'critical');
      expect(criticalErrors.length).toBeGreaterThan(0);
      expect(criticalErrors.some(e => e.field === 'name')).toBe(true);
    });

    it('should validate location coordinates', async () => {
      const invalidLocationData: RawRestaurantData[] = [
        {
          sourceId: 'test',
          externalId: 'test-1',
          name: 'Test Restaurant',
          address: '123 Test Street',
          latitude: 40.7128, // New York coordinates (outside Hong Kong)
          longitude: -74.0060,
          lastUpdated: new Date(),
          dataQuality: 0.7
        }
      ];

      const results = await service.validateRawData(invalidLocationData);

      expect(results[0].warnings.some(w => w.field === 'location')).toBe(true);
    });

    it('should validate rating ranges', async () => {
      const invalidRatingData: RawRestaurantData[] = [
        {
          sourceId: 'test',
          externalId: 'test-1',
          name: 'Test Restaurant',
          address: '123 Test Street',
          rating: 6, // Invalid rating > 5
          lastUpdated: new Date(),
          dataQuality: 0.7
        }
      ];

      const results = await service.validateRawData(invalidRatingData);

      expect(results[0].errors.some(e => e.field === 'rating')).toBe(true);
    });

    it('should validate price range', async () => {
      const invalidPriceData: RawRestaurantData[] = [
        {
          sourceId: 'test',
          externalId: 'test-1',
          name: 'Test Restaurant',
          address: '123 Test Street',
          priceRange: 5, // Invalid price range > 4
          lastUpdated: new Date(),
          dataQuality: 0.7
        }
      ];

      const results = await service.validateRawData(invalidPriceData);

      expect(results[0].errors.some(e => e.field === 'priceRange')).toBe(true);
    });

    it('should validate Hong Kong phone numbers', async () => {
      const invalidPhoneData: RawRestaurantData[] = [
        {
          sourceId: 'test',
          externalId: 'test-1',
          name: 'Test Restaurant',
          address: '123 Test Street',
          phone: '123-456-7890', // US format phone number
          lastUpdated: new Date(),
          dataQuality: 0.7
        }
      ];

      const results = await service.validateRawData(invalidPhoneData);

      expect(results[0].warnings.some(w => w.field === 'phone')).toBe(true);
    });

    it('should validate website URLs', async () => {
      const invalidWebsiteData: RawRestaurantData[] = [
        {
          sourceId: 'test',
          externalId: 'test-1',
          name: 'Test Restaurant',
          address: '123 Test Street',
          website: 'not-a-valid-url',
          lastUpdated: new Date(),
          dataQuality: 0.7
        }
      ];

      const results = await service.validateRawData(invalidWebsiteData);

      expect(results[0].warnings.some(w => w.field === 'website')).toBe(true);
    });

    it('should warn about stale data', async () => {
      const staleDate = new Date();
      staleDate.setDate(staleDate.getDate() - 100); // 100 days ago

      const staleData: RawRestaurantData[] = [
        {
          sourceId: 'test',
          externalId: 'test-1',
          name: 'Test Restaurant',
          address: '123 Test Street',
          lastUpdated: staleDate,
          dataQuality: 0.7
        }
      ];

      const results = await service.validateRawData(staleData);

      expect(results[0].warnings.some(w => w.field === 'lastUpdated')).toBe(true);
    });
  });

  describe('validateNormalizedData', () => {
    it('should validate correct normalized restaurant data', async () => {
      const validData: NormalizedRestaurantData[] = [
        {
          externalId: 'test-1',
          name: 'Valid Restaurant',
          address: '123 Test Street, Hong Kong',
          location: {
            latitude: 22.2783,
            longitude: 114.1747,
            district: 'Central'
          },
          cuisineType: ['Chinese'],
          priceRange: 2,
          rating: 4.5,
          reviewCount: 100,
          operatingHours: { 'Monday': '9:00 AM - 10:00 PM' },
          contactInfo: {
            phone: '+85212345678',
            website: 'https://example.com'
          },
          menuHighlights: ['Dim Sum'],
          features: ['WiFi'],
          photos: ['https://example.com/photo.jpg'],
          reviews: [],
          sourceMetadata: {
            sourceId: 'test',
            sourceName: 'Test Source',
            extractedAt: new Date(),
            lastUpdated: new Date(),
            reliability: 0.9,
            completeness: 0.8
          },
          dataQuality: {
            overall: 0.8,
            completeness: 0.8,
            accuracy: 0.9,
            freshness: 1.0,
            consistency: 0.8
          }
        }
      ];

      const results = await service.validateNormalizedData(validData);

      expect(results).toHaveLength(1);
      expect(results[0].isValid).toBe(true);
      expect(results[0].errors.filter(e => e.severity === 'critical')).toHaveLength(0);
    });

    it('should validate district names', async () => {
      const invalidDistrictData: NormalizedRestaurantData[] = [
        {
          externalId: 'test-1',
          name: 'Test Restaurant',
          address: '123 Test Street',
          location: {
            latitude: 22.2783,
            longitude: 114.1747,
            district: 'Invalid District'
          },
          cuisineType: ['Chinese'],
          priceRange: 2,
          rating: 4.5,
          reviewCount: 100,
          operatingHours: {},
          contactInfo: {},
          menuHighlights: [],
          features: [],
          photos: [],
          reviews: [],
          sourceMetadata: {
            sourceId: 'test',
            sourceName: 'Test',
            extractedAt: new Date(),
            lastUpdated: new Date(),
            reliability: 0.8,
            completeness: 0.7
          },
          dataQuality: {
            overall: 0.7,
            completeness: 0.7,
            accuracy: 0.8,
            freshness: 0.9,
            consistency: 0.7
          }
        }
      ];

      const results = await service.validateNormalizedData(invalidDistrictData);

      expect(results[0].warnings.some(w => w.field === 'location.district')).toBe(true);
    });

    it('should validate cuisine types', async () => {
      const invalidCuisineData: NormalizedRestaurantData[] = [
        {
          externalId: 'test-1',
          name: 'Test Restaurant',
          address: '123 Test Street',
          location: {
            latitude: 22.2783,
            longitude: 114.1747,
            district: 'Central'
          },
          cuisineType: ['Unknown Cuisine Type'],
          priceRange: 2,
          rating: 4.5,
          reviewCount: 100,
          operatingHours: {},
          contactInfo: {},
          menuHighlights: [],
          features: [],
          photos: [],
          reviews: [],
          sourceMetadata: {
            sourceId: 'test',
            sourceName: 'Test',
            extractedAt: new Date(),
            lastUpdated: new Date(),
            reliability: 0.8,
            completeness: 0.7
          },
          dataQuality: {
            overall: 0.7,
            completeness: 0.7,
            accuracy: 0.8,
            freshness: 0.9,
            consistency: 0.7
          }
        }
      ];

      const results = await service.validateNormalizedData(invalidCuisineData);

      expect(results[0].warnings.some(w => w.field === 'cuisineType')).toBe(true);
    });

    it('should warn about low data quality', async () => {
      const lowQualityData: NormalizedRestaurantData[] = [
        {
          externalId: 'test-1',
          name: 'Test Restaurant',
          address: '123 Test Street',
          location: {
            latitude: 22.2783,
            longitude: 114.1747,
            district: 'Central'
          },
          cuisineType: ['Chinese'],
          priceRange: 2,
          rating: 4.5,
          reviewCount: 100,
          operatingHours: {},
          contactInfo: {},
          menuHighlights: [],
          features: [],
          photos: [],
          reviews: [],
          sourceMetadata: {
            sourceId: 'test',
            sourceName: 'Test',
            extractedAt: new Date(),
            lastUpdated: new Date(),
            reliability: 0.8,
            completeness: 0.7
          },
          dataQuality: {
            overall: 0.3, // Low quality
            completeness: 0.3,
            accuracy: 0.5,
            freshness: 0.2,
            consistency: 0.3
          }
        }
      ];

      const results = await service.validateNormalizedData(lowQualityData);

      expect(results[0].warnings.some(w => w.field === 'dataQuality')).toBe(true);
    });

    it('should validate review consistency', async () => {
      const inconsistentReviewData: NormalizedRestaurantData[] = [
        {
          externalId: 'test-1',
          name: 'Test Restaurant',
          address: '123 Test Street',
          location: {
            latitude: 22.2783,
            longitude: 114.1747,
            district: 'Central'
          },
          cuisineType: ['Chinese'],
          priceRange: 2,
          rating: 4.5,
          reviewCount: 100, // Says 100 reviews
          operatingHours: {},
          contactInfo: {},
          menuHighlights: [],
          features: [],
          photos: [],
          reviews: [], // But no reviews present
          sourceMetadata: {
            sourceId: 'test',
            sourceName: 'Test',
            extractedAt: new Date(),
            lastUpdated: new Date(),
            reliability: 0.8,
            completeness: 0.7
          },
          dataQuality: {
            overall: 0.7,
            completeness: 0.7,
            accuracy: 0.8,
            freshness: 0.9,
            consistency: 0.7
          }
        }
      ];

      const results = await service.validateNormalizedData(inconsistentReviewData);

      expect(results[0].warnings.some(w => w.field === 'reviews')).toBe(true);
    });

    it('should validate operating hours day names', async () => {
      const invalidDayData: NormalizedRestaurantData[] = [
        {
          externalId: 'test-1',
          name: 'Test Restaurant',
          address: '123 Test Street',
          location: {
            latitude: 22.2783,
            longitude: 114.1747,
            district: 'Central'
          },
          cuisineType: ['Chinese'],
          priceRange: 2,
          rating: 4.5,
          reviewCount: 0,
          operatingHours: {
            'InvalidDay': '9:00 AM - 10:00 PM'
          },
          contactInfo: {},
          menuHighlights: [],
          features: [],
          photos: [],
          reviews: [],
          sourceMetadata: {
            sourceId: 'test',
            sourceName: 'Test',
            extractedAt: new Date(),
            lastUpdated: new Date(),
            reliability: 0.8,
            completeness: 0.7
          },
          dataQuality: {
            overall: 0.7,
            completeness: 0.7,
            accuracy: 0.8,
            freshness: 0.9,
            consistency: 0.7
          }
        }
      ];

      const results = await service.validateNormalizedData(invalidDayData);

      expect(results[0].warnings.some(w => w.field === 'operatingHours')).toBe(true);
    });
  });

  describe('quality score calculation', () => {
    it('should calculate quality scores based on errors and warnings', () => {
      const errors = [
        { field: 'name', message: 'Critical error', severity: 'critical' as const },
        { field: 'address', message: 'Major error', severity: 'major' as const },
        { field: 'phone', message: 'Minor error', severity: 'minor' as const }
      ];

      const warnings = [
        { field: 'website', message: 'Warning 1' },
        { field: 'rating', message: 'Warning 2' }
      ];

      const score = service['calculateValidationQualityScore'](errors, warnings);

      // Should be less than 1.0 due to errors and warnings
      expect(score).toBeLessThan(1.0);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('should return perfect score for no errors or warnings', () => {
      const score = service['calculateValidationQualityScore']([], []);
      expect(score).toBe(1.0);
    });
  });

  describe('utility functions', () => {
    it('should validate Hong Kong phone numbers correctly', () => {
      expect(service['isValidHongKongPhone']('+85212345678')).toBe(true);
      expect(service['isValidHongKongPhone']('12345678')).toBe(true);
      expect(service['isValidHongKongPhone']('1234-5678')).toBe(true);
      expect(service['isValidHongKongPhone']('123456789')).toBe(false); // Too long
      expect(service['isValidHongKongPhone']('1234567')).toBe(false); // Too short
      expect(service['isValidHongKongPhone']('+1234567890')).toBe(false); // Wrong country code
    });

    it('should validate URLs correctly', () => {
      expect(service['isValidUrl']('https://example.com')).toBe(true);
      expect(service['isValidUrl']('http://example.com')).toBe(true);
      expect(service['isValidUrl']('ftp://example.com')).toBe(true);
      expect(service['isValidUrl']('not-a-url')).toBe(false);
      expect(service['isValidUrl']('')).toBe(false);
    });
  });
});