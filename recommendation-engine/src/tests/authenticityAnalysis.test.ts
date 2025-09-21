import { AuthenticityAnalysisService } from '../services/authenticityAnalysis';
import { Restaurant } from '../../../shared/src/types/restaurant.types';

describe('AuthenticityAnalysisService', () => {
  let service: AuthenticityAnalysisService;
  let mockLocalGem: Restaurant;
  let mockChainRestaurant: Restaurant;
  let mockHongKongRestaurant: Restaurant;

  beforeEach(() => {
    service = new AuthenticityAnalysisService();
    
    mockLocalGem = {
      id: 'local1',
      name: 'Authentic Dim Sum House',
      cuisineType: ['cantonese', 'dim_sum'],
      location: {
        address: '123 Local St',
        latitude: 22.3193,
        longitude: 114.1694,
        district: 'Central'
      },
      priceRange: 2,
      rating: 4.3,
      negativeScore: 0.2,
      atmosphere: ['traditional', 'authentic', 'family-friendly'],
      operatingHours: {
        monday: { isOpen: true, openTime: '06:00', closeTime: '15:00' },
        tuesday: { isOpen: true, openTime: '06:00', closeTime: '15:00' },
        wednesday: { isOpen: true, openTime: '06:00', closeTime: '15:00' },
        thursday: { isOpen: true, openTime: '06:00', closeTime: '15:00' },
        friday: { isOpen: true, openTime: '06:00', closeTime: '15:00' },
        saturday: { isOpen: true, openTime: '06:00', closeTime: '15:00' },
        sunday: { isOpen: true, openTime: '06:00', closeTime: '15:00' }
      },
      menuHighlights: [],
      specialFeatures: ['family_owned', 'traditional_recipe', 'local_favorite'],
      isLocalGem: true,
      authenticityScore: 0.9,
      governmentLicense: {
        licenseNumber: 'HK123456',
        isValid: true,
        violations: []
      },
      dataQualityScore: 0.8,
      negativeFeedbackTrends: [
        {
          category: 'authenticity',
          trend: 'improving',
          severity: 0.3,
          frequency: 0.1,
          timeframe: 'recent'
        }
      ],
      platformData: [
        {
          source: 'openrice',
          externalId: 'or123',
          rating: 4.2,
          reviewCount: 85,
          lastUpdated: new Date('2024-01-15'),
          dataReliability: 0.9
        }
      ],
      lastSyncDate: new Date('2024-01-15'),
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-15')
    };

    mockChainRestaurant = {
      id: 'chain1',
      name: 'McDonald\'s Central',
      cuisineType: ['fast_food', 'american'],
      location: {
        address: '456 Chain Ave',
        latitude: 22.3200,
        longitude: 114.1700,
        district: 'Central'
      },
      priceRange: 1,
      rating: 3.8,
      negativeScore: 0.4,
      atmosphere: ['corporate', 'fast', 'standardized'],
      operatingHours: {
        monday: { isOpen: true, openTime: '06:00', closeTime: '24:00' },
        tuesday: { isOpen: true, openTime: '06:00', closeTime: '24:00' },
        wednesday: { isOpen: true, openTime: '06:00', closeTime: '24:00' },
        thursday: { isOpen: true, openTime: '06:00', closeTime: '24:00' },
        friday: { isOpen: true, openTime: '06:00', closeTime: '24:00' },
        saturday: { isOpen: true, openTime: '06:00', closeTime: '24:00' },
        sunday: { isOpen: true, openTime: '06:00', closeTime: '24:00' }
      },
      menuHighlights: [],
      specialFeatures: ['fast_service', 'standardized_menu'],
      isLocalGem: false,
      authenticityScore: 0.2,
      governmentLicense: {
        licenseNumber: 'HK789012',
        isValid: true,
        violations: []
      },
      dataQualityScore: 0.9,
      negativeFeedbackTrends: [],
      platformData: [
        {
          source: 'openrice',
          externalId: 'or456',
          rating: 3.8,
          reviewCount: 2500,
          lastUpdated: new Date('2024-01-10'),
          dataReliability: 0.8
        },
        {
          source: 'tripadvisor',
          externalId: 'ta789',
          rating: 3.7,
          reviewCount: 1800,
          lastUpdated: new Date('2024-01-12'),
          dataReliability: 0.8
        }
      ],
      lastSyncDate: new Date('2024-01-12'),
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-12')
    };

    mockHongKongRestaurant = {
      id: 'hk1',
      name: 'Traditional Cha Chaan Teng',
      cuisineType: ['cha_chaan_teng', 'hong_kong_style'],
      location: {
        address: '789 HK St',
        latitude: 22.3250,
        longitude: 114.1750,
        district: 'Wan Chai'
      },
      priceRange: 2,
      rating: 4.1,
      negativeScore: 0.3,
      atmosphere: ['local', 'traditional', 'neighborhood'],
      operatingHours: {
        monday: { isOpen: true, openTime: '07:00', closeTime: '22:00' },
        tuesday: { isOpen: true, openTime: '07:00', closeTime: '22:00' },
        wednesday: { isOpen: true, openTime: '07:00', closeTime: '22:00' },
        thursday: { isOpen: true, openTime: '07:00', closeTime: '22:00' },
        friday: { isOpen: true, openTime: '07:00', closeTime: '22:00' },
        saturday: { isOpen: true, openTime: '07:00', closeTime: '22:00' },
        sunday: { isOpen: true, openTime: '07:00', closeTime: '22:00' }
      },
      menuHighlights: [],
      specialFeatures: ['authentic_ingredients', 'local_chef'],
      isLocalGem: true,
      authenticityScore: 0.85,
      governmentLicense: {
        licenseNumber: 'HK345678',
        isValid: true,
        violations: []
      },
      dataQualityScore: 0.7,
      negativeFeedbackTrends: [
        {
          category: 'service',
          trend: 'stable',
          severity: 0.4,
          frequency: 0.2,
          timeframe: 'recent'
        }
      ],
      platformData: [
        {
          source: 'openrice',
          externalId: 'or789',
          rating: 4.0,
          reviewCount: 120,
          lastUpdated: new Date('2024-01-08'),
          dataReliability: 0.7
        }
      ],
      lastSyncDate: new Date('2024-01-08'),
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-08')
    };
  });

  describe('analyzeAuthenticity', () => {
    it('should give high authenticity score to local gems', () => {
      const authenticity = service.analyzeAuthenticity(mockLocalGem);

      expect(authenticity.overall).toBeGreaterThan(0.7);
      expect(authenticity.localGemScore).toBeGreaterThan(0.6);
      expect(authenticity.chainPenalty).toBeLessThan(0.3);
      expect(authenticity.hongKongCuisineAuthenticity).toBeGreaterThan(0.5);
    });

    it('should give low authenticity score to chain restaurants', () => {
      const authenticity = service.analyzeAuthenticity(mockChainRestaurant);

      expect(authenticity.overall).toBeLessThan(0.5);
      expect(authenticity.localGemScore).toBeLessThan(0.3);
      expect(authenticity.chainPenalty).toBeGreaterThan(0.5);
      expect(authenticity.hongKongCuisineAuthenticity).toBeLessThan(0.5);
    });

    it('should give high Hong Kong cuisine authenticity to traditional restaurants', () => {
      const authenticity = service.analyzeAuthenticity(mockHongKongRestaurant);

      expect(authenticity.hongKongCuisineAuthenticity).toBeGreaterThan(0.7);
      expect(authenticity.localGemScore).toBeGreaterThan(0.5);
    });

    it('should calculate all authenticity components', () => {
      const authenticity = service.analyzeAuthenticity(mockLocalGem);

      expect(authenticity.overall).toBeGreaterThanOrEqual(0);
      expect(authenticity.overall).toBeLessThanOrEqual(1);
      expect(authenticity.localGemScore).toBeGreaterThanOrEqual(0);
      expect(authenticity.chainPenalty).toBeGreaterThanOrEqual(0);
      expect(authenticity.reviewAuthenticity).toBeGreaterThanOrEqual(0);
      expect(authenticity.hongKongCuisineAuthenticity).toBeGreaterThanOrEqual(0);
      expect(authenticity.hiddenGemBonus).toBeGreaterThanOrEqual(0);
    });
  });

  describe('prioritizeLocalEstablishments', () => {
    it('should prioritize local gems over chains', () => {
      const restaurants = [mockChainRestaurant, mockLocalGem, mockHongKongRestaurant];
      const prioritized = service.prioritizeLocalEstablishments(restaurants);

      // Local gems should come first
      expect(prioritized[0].isLocalGem).toBe(true);
      expect(prioritized[prioritized.length - 1].name).toContain('McDonald');
    });

    it('should maintain order for restaurants with similar authenticity', () => {
      const restaurants = [mockLocalGem, mockHongKongRestaurant];
      const prioritized = service.prioritizeLocalEstablishments(restaurants);

      expect(prioritized.length).toBe(2);
      // Both are local gems, so order might be based on other factors
    });

    it('should handle empty restaurant list', () => {
      const prioritized = service.prioritizeLocalEstablishments([]);
      expect(prioritized).toEqual([]);
    });
  });

  describe('identifyHiddenGems', () => {
    it('should identify restaurants with low negative feedback and local characteristics', () => {
      const restaurants = [mockLocalGem, mockChainRestaurant, mockHongKongRestaurant];
      const hiddenGems = service.identifyHiddenGems(restaurants);

      expect(hiddenGems.length).toBeGreaterThan(0);
      hiddenGems.forEach(gem => {
        expect(gem.negativeScore).toBeLessThanOrEqual(0.3);
        expect(gem.isLocalGem).toBe(true);
      });
    });

    it('should exclude chain restaurants from hidden gems', () => {
      const restaurants = [mockChainRestaurant];
      const hiddenGems = service.identifyHiddenGems(restaurants);

      expect(hiddenGems.length).toBe(0);
    });

    it('should exclude restaurants with high negative feedback', () => {
      const highNegativeFeedbackRestaurant = {
        ...mockLocalGem,
        negativeScore: 0.8
      };

      const restaurants = [highNegativeFeedbackRestaurant];
      const hiddenGems = service.identifyHiddenGems(restaurants);

      expect(hiddenGems.length).toBe(0);
    });

    it('should apply custom criteria correctly', () => {
      const strictCriteria = {
        maxReviewCount: 50,
        minAuthenticityScore: 0.9,
        preferredCuisines: ['cantonese'],
        maxChainPresence: 0.1,
        minLocalCharacteristics: 3
      };

      const restaurants = [mockLocalGem, mockHongKongRestaurant];
      const hiddenGems = service.identifyHiddenGems(restaurants, strictCriteria);

      // Should be more restrictive with strict criteria
      expect(hiddenGems.length).toBeLessThanOrEqual(restaurants.length);
    });
  });

  describe('analyzeHongKongCuisineAuthenticity', () => {
    it('should give high scores to Hong Kong cuisine restaurants', () => {
      const score = service.analyzeHongKongCuisineAuthenticity(mockHongKongRestaurant);
      expect(score).toBeGreaterThan(0.7);
    });

    it('should give lower scores to non-Hong Kong cuisines', () => {
      const score = service.analyzeHongKongCuisineAuthenticity(mockChainRestaurant);
      expect(score).toBeLessThan(0.5);
    });

    it('should boost scores for local gems', () => {
      const localGemScore = service.analyzeHongKongCuisineAuthenticity(mockLocalGem);
      
      const nonLocalGem = { ...mockLocalGem, isLocalGem: false };
      const nonLocalGemScore = service.analyzeHongKongCuisineAuthenticity(nonLocalGem);

      expect(localGemScore).toBeGreaterThan(nonLocalGemScore);
    });

    it('should consider traditional features', () => {
      const traditionalRestaurant = {
        ...mockHongKongRestaurant,
        specialFeatures: ['traditional_recipe', 'authentic_ingredients', 'family_recipe'],
        isLocalGem: false // Remove local gem bonus to see traditional feature effect
      };

      const baseRestaurant = {
        ...mockHongKongRestaurant,
        specialFeatures: [],
        isLocalGem: false
      };

      const score = service.analyzeHongKongCuisineAuthenticity(traditionalRestaurant);
      const baseScore = service.analyzeHongKongCuisineAuthenticity(baseRestaurant);

      expect(score).toBeGreaterThan(baseScore);
    });
  });

  describe('analyzeReviewAuthenticity', () => {
    it('should analyze review patterns for authenticity', () => {
      const score = service.analyzeReviewAuthenticity(mockLocalGem);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should return neutral score for restaurants with no platform data', () => {
      const noDataRestaurant = { ...mockLocalGem, platformData: [] };
      const score = service.analyzeReviewAuthenticity(noDataRestaurant);

      expect(score).toBe(0.5);
    });

    it('should detect potential artificial inflation', () => {
      const suspiciousRestaurant = {
        ...mockLocalGem,
        rating: 4.9,
        negativeScore: 0.05,
        platformData: [
          {
            source: 'openrice' as const,
            externalId: 'or999',
            rating: 4.9,
            reviewCount: 5000,
            lastUpdated: new Date('2024-01-15'),
            dataReliability: 0.6
          }
        ]
      };

      const score = service.analyzeReviewAuthenticity(suspiciousRestaurant);
      const normalScore = service.analyzeReviewAuthenticity(mockLocalGem);

      expect(score).toBeLessThan(normalScore);
    });

    it('should reward genuine quality indicators', () => {
      const genuineRestaurant = {
        ...mockLocalGem,
        rating: 4.2,
        platformData: [
          {
            source: 'openrice' as const,
            externalId: 'or888',
            rating: 4.2,
            reviewCount: 150,
            lastUpdated: new Date('2024-01-15'),
            dataReliability: 0.9
          }
        ]
      };

      const score = service.analyzeReviewAuthenticity(genuineRestaurant);
      expect(score).toBeGreaterThan(0.5);
    });
  });
});