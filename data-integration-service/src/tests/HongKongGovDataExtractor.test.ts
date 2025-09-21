import { HongKongGovDataExtractor } from '../extractors/HongKongGovDataExtractor';
import { DataSource, DataSourceType } from '../types/dataSource.types';

// Mock data that simulates data.gov.hk API responses
const mockLicenseData = {
  success: true,
  result: {
    records: [
      {
        licence_no: 'R001234',
        name_of_licensee: 'Test Restaurant Ltd',
        name_of_premises: 'Golden Dragon Restaurant',
        address_of_premises: '123 Nathan Road, Tsim Sha Tsui, Kowloon',
        type_of_licence: 'Restaurant Licence',
        licence_status: 'Active',
        issue_date: '2023-01-15',
        expiry_date: '2025-12-31',
        district: 'Yau Tsim Mong',
        latitude: '22.2976',
        longitude: '114.1722'
      },
      {
        licence_no: 'R005678',
        name_of_licensee: 'Cafe Holdings',
        name_of_premises: 'Central Cafe',
        address_of_premises: '456 Des Voeux Road, Central, Hong Kong',
        type_of_licence: 'Food Establishment Licence',
        licence_status: 'Active',
        issue_date: '2023-03-20',
        expiry_date: '2025-12-31',
        district: 'Central and Western',
        latitude: '22.2783',
        longitude: '114.1747'
      },
      {
        licence_no: 'R009999',
        name_of_licensee: 'Expired Restaurant',
        name_of_premises: 'Old Restaurant',
        address_of_premises: '789 Old Street',
        type_of_licence: 'Restaurant Licence',
        licence_status: 'Expired',
        issue_date: '2020-01-01',
        expiry_date: '2022-12-31',
        district: 'Wan Chai'
      }
    ],
    total: 3
  }
};

const mockInspectionData = {
  success: true,
  result: {
    records: [
      {
        licence_no: 'R001234',
        inspection_date: '2023-06-15',
        inspection_result: 'Satisfactory',
        violations: '',
        score: '85'
      },
      {
        licence_no: 'R001234',
        inspection_date: '2023-12-10',
        inspection_result: 'Satisfactory',
        violations: 'Minor cleanliness issue',
        score: '78'
      },
      {
        licence_no: 'R005678',
        inspection_date: '2023-08-20',
        inspection_result: 'Unsatisfactory',
        violations: 'Temperature control issues, Staff hygiene',
        score: '30'
      }
    ],
    total: 3
  }
};

describe('HongKongGovDataExtractor', () => {
  let extractor: HongKongGovDataExtractor;
  let mockDataSource: DataSource;

  beforeEach(() => {
    mockDataSource = {
      id: 'gov_hk',
      name: 'Hong Kong Government Data',
      type: DataSourceType.GOVERNMENT,
      baseUrl: 'https://data.gov.hk',
      isActive: true,
      rateLimitMs: 1000,
      maxRetries: 3,
      timeout: 10000
    };

    extractor = new HongKongGovDataExtractor(mockDataSource);
  });

  afterEach(async () => {
    if ('cleanup' in extractor && typeof extractor.cleanup === 'function') {
      await extractor.cleanup();
    }
  });

  describe('extractRestaurantData', () => {
    beforeEach(() => {
      // Mock the HTTP requests
      jest.spyOn(extractor as any, 'makeRequest')
        .mockImplementationOnce(() => Promise.resolve(mockLicenseData))
        .mockImplementationOnce(() => Promise.resolve(mockInspectionData));
    });

    it('should extract restaurant data from government sources', async () => {
      const result = await extractor.extractRestaurantData();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2); // Only active licenses
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.sourceReliability).toBe(1.0);
    });

    it('should filter out expired licenses', async () => {
      const result = await extractor.extractRestaurantData();

      const restaurantIds = result.data!.map(r => r.externalId);
      expect(restaurantIds).toContain('R001234');
      expect(restaurantIds).toContain('R005678');
      expect(restaurantIds).not.toContain('R009999'); // Expired license
    });

    it('should include government-specific features', async () => {
      const result = await extractor.extractRestaurantData();

      const restaurant = result.data!.find(r => r.externalId === 'R001234');
      expect(restaurant).toBeDefined();
      expect(restaurant!.features).toContain('Government Licensed');
      expect(restaurant!.sourceId).toBe('gov_hk');
    });

    it('should calculate health scores from inspection data', async () => {
      const result = await extractor.extractRestaurantData();

      const restaurant1 = result.data!.find(r => r.externalId === 'R001234');
      const restaurant2 = result.data!.find(r => r.externalId === 'R005678');

      expect(restaurant1!.rating || 0).toBeGreaterThan(restaurant2!.rating || 0); // Better inspection scores
    });

    it('should handle missing inspection data gracefully', async () => {
      // Mock with no inspection data
      jest.spyOn(extractor as any, 'makeRequest')
        .mockImplementationOnce(() => Promise.resolve(mockLicenseData))
        .mockImplementationOnce(() => Promise.resolve({ success: true, result: { records: [], total: 0 } }));

      const result = await extractor.extractRestaurantData();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      
      // Should have default ratings when no inspection data
      result.data!.forEach(restaurant => {
        expect(restaurant.rating).toBeGreaterThan(0);
      });
    });
  });

  describe('extractRestaurantById', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should extract specific restaurant by license number', async () => {
      jest.spyOn(extractor as any, 'makeRequest')
        .mockImplementationOnce(() => Promise.resolve({
          success: true,
          result: {
            records: [mockLicenseData.result.records[0]],
            total: 1
          }
        }))
        .mockImplementationOnce(() => Promise.resolve({
          success: true,
          result: {
            records: mockInspectionData.result.records.filter(r => r.licence_no === 'R001234'),
            total: 2
          }
        }));

      const restaurant = await extractor.extractRestaurantById('R001234');

      expect(restaurant).not.toBeNull();
      expect(restaurant!.externalId).toBe('R001234');
      expect(restaurant!.name).toBe('Golden Dragon Restaurant');
      expect(restaurant!.address).toBe('123 Nathan Road, Tsim Sha Tsui, Kowloon');
    });

    it('should return null for non-existent license', async () => {
      jest.spyOn(extractor as any, 'makeRequest')
        .mockImplementationOnce(() => Promise.resolve({
          success: true,
          result: { records: [], total: 0 }
        }))
        .mockImplementationOnce(() => Promise.resolve({
          success: true,
          result: { records: [], total: 0 }
        }));

      const restaurant = await extractor.extractRestaurantById('NONEXISTENT');

      expect(restaurant).toBeNull();
    });
  });

  describe('verifyRestaurantLicense', () => {
    it('should verify valid restaurant license', async () => {
      jest.spyOn(extractor, 'extractRestaurantById')
        .mockResolvedValue({
          sourceId: 'gov_hk',
          externalId: 'R001234',
          name: 'Test Restaurant',
          address: 'Test Address',
          lastUpdated: new Date(),
          dataQuality: 0.9
        });

      jest.spyOn(extractor as any, 'extractInspectionData')
        .mockResolvedValue([
          {
            licence_no: 'R001234',
            inspection_date: '2023-06-15',
            inspection_result: 'Satisfactory',
            violations: 'Minor issue'
          }
        ]);

      const verification = await extractor.verifyRestaurantLicense('R001234');

      expect(verification.isValid).toBe(true);
      expect(verification.status).toBe('Active');
      expect(verification.violations).toContain('Minor issue');
    });

    it('should handle invalid license numbers', async () => {
      jest.spyOn(extractor, 'extractRestaurantById')
        .mockResolvedValue(null);

      const verification = await extractor.verifyRestaurantLicense('INVALID');

      expect(verification.isValid).toBe(false);
      expect(verification.status).toBe('Not Found');
      expect(verification.violations).toHaveLength(0);
    });
  });

  describe('getHealthInspectionScores', () => {
    it('should get health inspection scores for multiple restaurants', async () => {
      jest.spyOn(extractor as any, 'extractInspectionData')
        .mockImplementation((filters: any) => {
          const licenseNo = filters.licence_no;
          return Promise.resolve(
            mockInspectionData.result.records.filter(r => r.licence_no === licenseNo)
          );
        });

      const scores = await extractor.getHealthInspectionScores(['R001234', 'R005678']);

      expect(scores['R001234']).toBeDefined();
      expect(scores['R005678']).toBeDefined();
      
      expect(scores['R001234'].score).toBeGreaterThan(scores['R005678'].score);
      expect(scores['R001234'].violations).toContain('Minor cleanliness issue');
      expect(scores['R005678'].violations).toContain('Temperature control issues, Staff hygiene');
    });

    it('should handle restaurants with no inspection data', async () => {
      jest.spyOn(extractor as any, 'extractInspectionData')
        .mockResolvedValue([]);

      const scores = await extractor.getHealthInspectionScores(['R999999']);

      expect(Object.keys(scores)).toHaveLength(0);
    });
  });

  describe('data processing methods', () => {
    it('should identify restaurant licenses correctly', () => {
      const restaurantLicense = {
        licence_no: 'R001',
        type_of_licence: 'Restaurant Licence',
        licence_status: 'Active'
      };

      const nonRestaurantLicense = {
        licence_no: 'L001',
        type_of_licence: 'Liquor Licence',
        licence_status: 'Active'
      };

      expect(extractor['isRestaurantLicense'](restaurantLicense as any)).toBe(true);
      expect(extractor['isRestaurantLicense'](nonRestaurantLicense as any)).toBe(false);
    });

    it('should identify active licenses correctly', () => {
      const activeLicense = {
        licence_status: 'Active',
        expiry_date: '2025-12-31'
      };

      const expiredLicense = {
        licence_status: 'Expired',
        expiry_date: '2022-12-31'
      };

      expect(extractor['isActiveLicense'](activeLicense as any)).toBe(true);
      expect(extractor['isActiveLicense'](expiredLicense as any)).toBe(false);
    });

    it('should infer cuisine types from restaurant names', () => {
      const testCases = [
        { name: 'Golden Dragon Chinese Restaurant', expected: ['Chinese'] },
        { name: 'Sushi Zen Japanese Kitchen', expected: ['Japanese'] },
        { name: 'Central Cafe & Bakery', expected: ['Cafe'] },
        { name: 'Unknown Restaurant', expected: ['Chinese'] } // Default
      ];

      testCases.forEach(({ name, expected }) => {
        const result = extractor['inferCuisineFromName'](name);
        expect(result).toEqual(expect.arrayContaining(expected));
      });
    });

    it('should convert health scores to ratings correctly', () => {
      expect(extractor['convertHealthScoreToRating'](0.95)).toBe(5.0);
      expect(extractor['convertHealthScoreToRating'](0.85)).toBe(4.5);
      expect(extractor['convertHealthScoreToRating'](0.75)).toBe(4.0);
      expect(extractor['convertHealthScoreToRating'](0.65)).toBe(3.5);
      expect(extractor['convertHealthScoreToRating'](0.45)).toBe(2.5);
      expect(extractor['convertHealthScoreToRating'](0.25)).toBe(2.0);
    });

    it('should calculate health scores from inspection data', () => {
      const goodInspections = [
        { inspection_result: 'Satisfactory', score: '90', inspection_date: '2023-06-15' },
        { inspection_result: 'Satisfactory', score: '85', inspection_date: '2023-12-10' }
      ];

      const poorInspections = [
        { inspection_result: 'Unsatisfactory', score: '40', inspection_date: '2023-06-15' },
        { inspection_result: 'Unsatisfactory', score: '35', inspection_date: '2023-12-10' }
      ];

      const goodScore = extractor['calculateHealthScore'](goodInspections as any);
      const poorScore = extractor['calculateHealthScore'](poorInspections as any);

      expect(goodScore).toBeGreaterThan(poorScore);
      expect(goodScore).toBeGreaterThan(0.8);
      expect(poorScore).toBeLessThan(0.5);
    });

    it('should parse various date formats', () => {
      const testDates = [
        '2023-12-31',
        '31/12/2023',
        '2023/12/31'
      ];

      testDates.forEach(dateStr => {
        const parsed = extractor['parseDate'](dateStr);
        expect(parsed).toBeInstanceOf(Date);
        expect(parsed!.getFullYear()).toBe(2023);
        expect(parsed!.getMonth()).toBe(11); // December (0-indexed)
        expect(parsed!.getDate()).toBe(31);
      });
    });

    it('should handle invalid dates gracefully', () => {
      const invalidDates = ['invalid-date', '', undefined];

      invalidDates.forEach(dateStr => {
        const parsed = extractor['parseDate'](dateStr);
        expect(parsed).toBeNull();
      });
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      jest.spyOn(extractor as any, 'makeRequest')
        .mockRejectedValue(new Error('API Error'));

      const result = await extractor.extractRestaurantData();

      expect(result.success).toBe(false);
      expect(result.data).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle malformed API responses', async () => {
      jest.spyOn(extractor as any, 'makeRequest')
        .mockResolvedValue({ success: false });

      const result = await extractor.extractRestaurantData();

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});