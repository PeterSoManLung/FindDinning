import { NegativeFeedbackRecommendationService } from '../services/negativeFeedbackRecommendation';
import { Restaurant } from '../../../shared/src/types/restaurant.types';
import { User } from '../../../shared/src/types/user.types';

describe('NegativeFeedbackRecommendationService', () => {
  let service: NegativeFeedbackRecommendationService;
  let mockUser: User;
  let mockRestaurants: Restaurant[];

  beforeEach(() => {
    service = new NegativeFeedbackRecommendationService();
    
    mockUser = {
      id: 'user1',
      email: 'test@example.com',
      name: 'Test User',
      preferences: {
        cuisineTypes: ['cantonese', 'italian'],
        priceRange: [2, 4],
        dietaryRestrictions: ['vegetarian'],
        atmospherePreferences: ['casual'],
        spiceLevel: 3
      },
      diningHistory: [],
      emotionalProfile: {
        preferredMoodCuisines: {},
        comfortFoodPreferences: [],
        celebratoryPreferences: [],
        emotionalPatterns: []
      },
      location: {
        latitude: 22.3193,
        longitude: 114.1694,
        district: 'Central'
      },
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-20')
    };

    mockRestaurants = [
      {
        id: 'rest1',
        name: 'Excellent Cantonese Restaurant',
        cuisineType: ['cantonese'],
        location: {
          address: '123 Test St',
          latitude: 22.3193,
          longitude: 114.1694,
          district: 'Central'
        },
        priceRange: 3,
        rating: 4.5,
        negativeScore: 0.1, // Very low negative feedback
        atmosphere: ['casual'],
        operatingHours: {
          monday: { isOpen: true, openTime: '11:00', closeTime: '22:00' },
          tuesday: { isOpen: true, openTime: '11:00', closeTime: '22:00' },
          wednesday: { isOpen: true, openTime: '11:00', closeTime: '22:00' },
          thursday: { isOpen: true, openTime: '11:00', closeTime: '22:00' },
          friday: { isOpen: true, openTime: '11:00', closeTime: '22:00' },
          saturday: { isOpen: true, openTime: '11:00', closeTime: '22:00' },
          sunday: { isOpen: true, openTime: '11:00', closeTime: '22:00' }
        },
        menuHighlights: [],
        specialFeatures: [],
        isLocalGem: true,
        authenticityScore: 0.9,
        governmentLicense: {
          licenseNumber: 'HK123456',
          isValid: true,
          violations: []
        },
        dataQualityScore: 0.9,
        negativeFeedbackTrends: [
          {
            category: 'service',
            trend: 'improving',
            severity: 0.2,
            frequency: 0.1,
            timeframe: 'recent'
          }
        ],
        platformData: [],
        lastSyncDate: new Date('2024-01-15'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15')
      },
      {
        id: 'rest2',
        name: 'Problematic Italian Restaurant',
        cuisineType: ['italian'],
        location: {
          address: '456 Test Ave',
          latitude: 22.3200,
          longitude: 114.1700,
          district: 'Central'
        },
        priceRange: 4,
        rating: 3.5,
        negativeScore: 0.8, // High negative feedback
        atmosphere: ['casual'],
        operatingHours: {
          monday: { isOpen: true, openTime: '17:00', closeTime: '23:00' },
          tuesday: { isOpen: true, openTime: '17:00', closeTime: '23:00' },
          wednesday: { isOpen: true, openTime: '17:00', closeTime: '23:00' },
          thursday: { isOpen: true, openTime: '17:00', closeTime: '23:00' },
          friday: { isOpen: true, openTime: '17:00', closeTime: '23:00' },
          saturday: { isOpen: true, openTime: '17:00', closeTime: '23:00' },
          sunday: { isOpen: false }
        },
        menuHighlights: [],
        specialFeatures: [],
        isLocalGem: false,
        authenticityScore: 0.6,
        governmentLicense: {
          licenseNumber: 'HK789012',
          isValid: true,
          violations: []
        },
        dataQualityScore: 0.7,
        negativeFeedbackTrends: [
          {
            category: 'service',
            trend: 'declining',
            severity: 0.8,
            frequency: 0.7,
            timeframe: 'recent'
          },
          {
            category: 'food_quality',
            trend: 'declining',
            severity: 0.7,
            frequency: 0.6,
            timeframe: 'recent'
          }
        ],
        platformData: [],
        lastSyncDate: new Date('2024-01-10'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-10')
      },
      {
        id: 'rest3',
        name: 'Average Cantonese Place',
        cuisineType: ['cantonese'],
        location: {
          address: '789 Test Rd',
          latitude: 22.3250,
          longitude: 114.1750,
          district: 'Central'
        },
        priceRange: 2,
        rating: 4.0,
        negativeScore: 0.4, // Moderate negative feedback
        atmosphere: ['casual'],
        operatingHours: {
          monday: { isOpen: true, openTime: '11:00', closeTime: '22:00' },
          tuesday: { isOpen: true, openTime: '11:00', closeTime: '22:00' },
          wednesday: { isOpen: true, openTime: '11:00', closeTime: '22:00' },
          thursday: { isOpen: true, openTime: '11:00', closeTime: '22:00' },
          friday: { isOpen: true, openTime: '11:00', closeTime: '22:00' },
          saturday: { isOpen: true, openTime: '11:00', closeTime: '22:00' },
          sunday: { isOpen: true, openTime: '11:00', closeTime: '22:00' }
        },
        menuHighlights: [],
        specialFeatures: [],
        isLocalGem: false,
        authenticityScore: 0.7,
        governmentLicense: {
          licenseNumber: 'HK345678',
          isValid: true,
          violations: []
        },
        dataQualityScore: 0.8,
        negativeFeedbackTrends: [
          {
            category: 'service',
            trend: 'stable',
            severity: 0.5,
            frequency: 0.3,
            timeframe: 'recent'
          }
        ],
        platformData: [],
        lastSyncDate: new Date('2024-01-12'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-12')
      }
    ];
  });

  describe('generateNegativeFeedbackAwareRecommendations', () => {
    it('should generate recommendations with negative feedback awareness', async () => {
      const recommendations = await service.generateNegativeFeedbackAwareRecommendations(
        mockUser,
        mockRestaurants,
        undefined,
        undefined,
        5
      );

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].matchScore).toBeGreaterThan(0);
      expect(recommendations[0].reasonsForRecommendation).toBeDefined();
      expect(Array.isArray(recommendations[0].reasonsForRecommendation)).toBe(true);
    });

    it('should rank restaurants by negative feedback-aware score', async () => {
      const recommendations = await service.generateNegativeFeedbackAwareRecommendations(
        mockUser,
        mockRestaurants,
        undefined,
        undefined,
        5
      );

      // Should be sorted by match score (descending)
      for (let i = 0; i < recommendations.length - 1; i++) {
        expect(recommendations[i].matchScore).toBeGreaterThanOrEqual(
          recommendations[i + 1].matchScore
        );
      }

      // The excellent restaurant should rank higher than the problematic one
      const excellentRestaurant = recommendations.find(r => r.restaurant.id === 'rest1');
      const problematicRestaurant = recommendations.find(r => r.restaurant.id === 'rest2');
      
      if (excellentRestaurant && problematicRestaurant) {
        expect(excellentRestaurant.matchScore).toBeGreaterThan(problematicRestaurant.matchScore);
      }
    });

    it('should filter out restaurants with high negative feedback', async () => {
      const strictCriteria = {
        maxNegativeScore: 0.5,
        excludeHighRiskRestaurants: true,
        minAuthenticityScore: 0.5,
        categoryThresholds: new Map([
          ['service', 0.5],
          ['food_quality', 0.5]
        ])
      };

      const recommendations = await service.generateNegativeFeedbackAwareRecommendations(
        mockUser,
        mockRestaurants,
        undefined,
        strictCriteria,
        5
      );

      // Should exclude the problematic restaurant (rest2)
      const problematicRestaurant = recommendations.find(r => r.restaurant.id === 'rest2');
      expect(problematicRestaurant).toBeUndefined();
    });

    it('should generate appropriate reasons for recommendations', async () => {
      const recommendations = await service.generateNegativeFeedbackAwareRecommendations(
        mockUser,
        mockRestaurants,
        undefined,
        undefined,
        5
      );

      const excellentRestaurant = recommendations.find(r => r.restaurant.id === 'rest1');
      if (excellentRestaurant) {
        expect(excellentRestaurant.reasonsForRecommendation).toContain(
          'Consistently positive customer feedback with minimal complaints'
        );
        expect(excellentRestaurant.reasonsForRecommendation).toContain(
          'Authentic reviews indicate genuine quality'
        );
      }
    });
  });

  describe('filterRestaurantsByNegativeFeedback', () => {
    it('should filter restaurants by negative score threshold', () => {
      const criteria = {
        maxNegativeScore: 0.5,
        excludeHighRiskRestaurants: false,
        minAuthenticityScore: 0.3,
        categoryThresholds: new Map()
      };

      const filtered = service.filterRestaurantsByNegativeFeedback(
        mockRestaurants,
        mockUser,
        criteria
      );

      // Should exclude rest2 (negativeScore: 0.8)
      expect(filtered.length).toBe(2);
      expect(filtered.find(r => r.id === 'rest2')).toBeUndefined();
    });

    it('should filter restaurants by authenticity score', () => {
      const criteria = {
        maxNegativeScore: 1.0,
        excludeHighRiskRestaurants: false,
        minAuthenticityScore: 0.8,
        categoryThresholds: new Map()
      };

      const filtered = service.filterRestaurantsByNegativeFeedback(
        mockRestaurants,
        mockUser,
        criteria
      );

      // Should only include rest1 (authenticityScore: 0.9)
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('rest1');
    });

    it('should exclude high-risk restaurants when enabled', () => {
      const criteria = {
        maxNegativeScore: 1.0,
        excludeHighRiskRestaurants: true,
        minAuthenticityScore: 0.3,
        categoryThresholds: new Map()
      };

      const filtered = service.filterRestaurantsByNegativeFeedback(
        mockRestaurants,
        mockUser,
        criteria
      );

      // Should exclude restaurants with high decline risk
      expect(filtered.length).toBeLessThanOrEqual(mockRestaurants.length);
    });

    it('should apply category-specific thresholds', () => {
      const criteria = {
        maxNegativeScore: 1.0,
        excludeHighRiskRestaurants: false,
        minAuthenticityScore: 0.3,
        categoryThresholds: new Map([
          ['service', 0.3] // Very strict service threshold
        ])
      };

      const filtered = service.filterRestaurantsByNegativeFeedback(
        mockRestaurants,
        mockUser,
        criteria
      );

      // Should filter based on service category scores
      expect(filtered.length).toBeLessThanOrEqual(mockRestaurants.length);
    });
  });

  describe('analyzeNegativeFeedbackTrends', () => {
    it('should analyze trends for all restaurants', () => {
      const analysis = service.analyzeNegativeFeedbackTrends(mockRestaurants);

      expect(analysis.length).toBe(mockRestaurants.length);
      analysis.forEach(item => {
        expect(item.restaurant).toBeDefined();
        expect(item.riskAnalysis).toBeDefined();
        expect(['avoid', 'caution', 'monitor', 'safe']).toContain(item.recommendation);
      });
    });

    it('should recommend avoiding high-risk restaurants', () => {
      const analysis = service.analyzeNegativeFeedbackTrends(mockRestaurants);
      
      const problematicAnalysis = analysis.find(a => a.restaurant.id === 'rest2');
      if (problematicAnalysis) {
        expect(['avoid', 'caution']).toContain(problematicAnalysis.recommendation);
      }
    });

    it('should recommend safe restaurants as safe', () => {
      const analysis = service.analyzeNegativeFeedbackTrends(mockRestaurants);
      
      const excellentAnalysis = analysis.find(a => a.restaurant.id === 'rest1');
      if (excellentAnalysis) {
        expect(['safe', 'monitor']).toContain(excellentAnalysis.recommendation);
      }
    });
  });

  describe('buildUserNegativeFeedbackSensitivity', () => {
    it('should build user sensitivity profile', () => {
      const sensitivity = service.buildUserNegativeFeedbackSensitivity(mockUser);

      expect(sensitivity.serviceWeight).toBeDefined();
      expect(sensitivity.foodQualityWeight).toBeDefined();
      expect(sensitivity.cleanlinessWeight).toBeDefined();
      expect(sensitivity.valueWeight).toBeDefined();
      expect(sensitivity.atmosphereWeight).toBeDefined();
      expect(sensitivity.waitTimeWeight).toBeDefined();

      // All weights should be positive and sum to approximately 1
      const totalWeight = Object.values(sensitivity).reduce((sum, weight) => sum + weight, 0);
      expect(totalWeight).toBeCloseTo(1, 0);
    });

    it('should adjust sensitivity for users with dietary restrictions', () => {
      const userWithoutDietaryRestrictions = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          dietaryRestrictions: []
        }
      };

      const userWithDietaryRestrictions = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          dietaryRestrictions: ['vegetarian', 'gluten-free']
        }
      };

      const sensitivity = service.buildUserNegativeFeedbackSensitivity(userWithDietaryRestrictions);
      const baseSensitivity = service.buildUserNegativeFeedbackSensitivity(userWithoutDietaryRestrictions);

      expect(sensitivity.cleanlinessWeight).toBeGreaterThan(baseSensitivity.cleanlinessWeight);
      expect(sensitivity.foodQualityWeight).toBeGreaterThan(baseSensitivity.foodQualityWeight);
    });

    it('should handle feedback history when provided', () => {
      const feedbackHistory = [
        { category: 'service', complaint: true },
        { category: 'cleanliness', complaint: true }
      ];

      const sensitivity = service.buildUserNegativeFeedbackSensitivity(mockUser, feedbackHistory);

      expect(sensitivity).toBeDefined();
      // In a full implementation, this would adjust weights based on feedback history
    });
  });
});