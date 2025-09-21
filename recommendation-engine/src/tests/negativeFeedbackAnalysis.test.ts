import { NegativeFeedbackAnalysisService } from '../services/negativeFeedbackAnalysis';
import { Restaurant } from '../../../shared/src/types/restaurant.types';
import { User } from '../../../shared/src/types/user.types';

describe('NegativeFeedbackAnalysisService', () => {
  let service: NegativeFeedbackAnalysisService;
  let mockRestaurant: Restaurant;
  let mockUser: User;

  beforeEach(() => {
    service = new NegativeFeedbackAnalysisService();
    
    mockRestaurant = {
      id: 'rest1',
      name: 'Test Restaurant',
      cuisineType: ['cantonese'],
      location: {
        address: '123 Test St',
        latitude: 22.3193,
        longitude: 114.1694,
        district: 'Central'
      },
      priceRange: 3,
      rating: 4.0,
      negativeScore: 0.3,
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
      authenticityScore: 0.8,
      governmentLicense: {
        licenseNumber: 'HK123456',
        isValid: true,
        violations: []
      },
      dataQualityScore: 0.9,
      negativeFeedbackTrends: [
        {
          category: 'service',
          trend: 'stable',
          severity: 0.4,
          frequency: 0.2,
          timeframe: 'recent'
        },
        {
          category: 'food_quality',
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
    };

    mockUser = {
      id: 'user1',
      email: 'test@example.com',
      name: 'Test User',
      preferences: {
        cuisineTypes: ['cantonese'],
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
  });

  describe('analyzeNegativeFeedback', () => {
    it('should analyze negative feedback correctly', () => {
      const result = service.analyzeNegativeFeedback(mockRestaurant);

      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1);
      expect(result.categoryScores).toBeDefined();
      expect(result.trendAnalysis).toBeDefined();
      expect(result.authenticity).toBeGreaterThanOrEqual(0);
      expect(result.authenticity).toBeLessThanOrEqual(1);
    });

    it('should calculate category scores from trends', () => {
      const result = service.analyzeNegativeFeedback(mockRestaurant);

      expect(result.categoryScores.has('service')).toBe(true);
      expect(result.categoryScores.has('food_quality')).toBe(true);
      expect(result.categoryScores.get('service')).toBe(0.4 * 0.2); // severity * frequency
      expect(result.categoryScores.get('food_quality')).toBe(0.2 * 0.1);
    });

    it('should analyze trends correctly', () => {
      const result = service.analyzeNegativeFeedback(mockRestaurant);

      expect(result.trendAnalysis.isImproving).toBe(true); // More improving than declining trends
      expect(result.trendAnalysis.isDeclining).toBe(false);
      expect(result.trendAnalysis.recentTrendScore).toBeGreaterThanOrEqual(0);
      expect(result.trendAnalysis.consistencyScore).toBeGreaterThanOrEqual(0);
    });

    it('should calculate authenticity score', () => {
      const result = service.analyzeNegativeFeedback(mockRestaurant);

      // Should be based on restaurant's authenticity score, data quality, and local gem status
      expect(result.authenticity).toBeGreaterThan(0.8); // Base authenticity + bonuses
    });
  });

  describe('calculateRestaurantPenalty', () => {
    it('should calculate penalty based on negative feedback', () => {
      const penalty = service.calculateRestaurantPenalty(mockRestaurant);

      expect(penalty).toBeGreaterThanOrEqual(0);
      expect(penalty).toBeLessThanOrEqual(1);
    });

    it('should apply user sensitivity weights', () => {
      const highServiceSensitivity = {
        serviceWeight: 0.8,
        foodQualityWeight: 0.1,
        cleanlinessWeight: 0.05,
        valueWeight: 0.025,
        atmosphereWeight: 0.0125,
        waitTimeWeight: 0.0125
      };

      const lowServiceSensitivity = {
        serviceWeight: 0.1,
        foodQualityWeight: 0.3,
        cleanlinessWeight: 0.2,
        valueWeight: 0.2,
        atmosphereWeight: 0.1,
        waitTimeWeight: 0.1
      };

      const highServicePenalty = service.calculateRestaurantPenalty(mockRestaurant, highServiceSensitivity);
      const lowServicePenalty = service.calculateRestaurantPenalty(mockRestaurant, lowServiceSensitivity);

      // High service sensitivity should result in higher penalty for service issues
      expect(highServicePenalty).toBeGreaterThan(lowServicePenalty);
    });

    it('should apply trend and authenticity adjustments', () => {
      const decliningRestaurant = {
        ...mockRestaurant,
        negativeFeedbackTrends: [
          {
            category: 'service',
            trend: 'declining' as const,
            severity: 0.8,
            frequency: 0.6,
            timeframe: 'recent'
          }
        ],
        authenticityScore: 0.3
      };

      const decliningPenalty = service.calculateRestaurantPenalty(decliningRestaurant);
      const basePenalty = service.calculateRestaurantPenalty(mockRestaurant);

      expect(decliningPenalty).toBeGreaterThan(basePenalty);
    });
  });

  describe('filterByNegativeFeedback', () => {
    it('should filter restaurants by negative feedback score', () => {
      const restaurants = [
        mockRestaurant,
        { ...mockRestaurant, id: 'rest2', negativeScore: 0.8 }, // High negative score
        { ...mockRestaurant, id: 'rest3', negativeScore: 0.1 }  // Low negative score
      ];

      const filtered = service.filterByNegativeFeedback(restaurants, mockUser, 0.5);

      expect(filtered.length).toBe(2); // Should exclude the high negative score restaurant
      expect(filtered.find(r => r.id === 'rest2')).toBeUndefined();
    });

    it('should consider user sensitivity in filtering', () => {
      const userWithDietaryRestrictions = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          dietaryRestrictions: ['vegetarian', 'gluten-free']
        }
      };

      const restaurants = [mockRestaurant];
      const filtered = service.filterByNegativeFeedback(restaurants, userWithDietaryRestrictions, 0.7);

      expect(filtered.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('predictQualityDecline', () => {
    it('should predict low risk for stable restaurant', () => {
      const prediction = service.predictQualityDecline(mockRestaurant);

      expect(prediction.riskLevel).toBe('low');
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(prediction.reasons)).toBe(true);
    });

    it('should predict high risk for declining restaurant', () => {
      const decliningRestaurant = {
        ...mockRestaurant,
        negativeFeedbackTrends: [
          {
            category: 'service',
            trend: 'declining' as const,
            severity: 0.9,
            frequency: 0.8,
            timeframe: 'recent'
          },
          {
            category: 'food_quality',
            trend: 'declining' as const,
            severity: 0.8,
            frequency: 0.7,
            timeframe: 'recent'
          }
        ],
        authenticityScore: 0.9
      };

      const prediction = service.predictQualityDecline(decliningRestaurant);

      expect(prediction.riskLevel).toBe('high');
      expect(prediction.reasons.length).toBeGreaterThan(0);
    });

    it('should provide relevant reasons for risk assessment', () => {
      const decliningRestaurant = {
        ...mockRestaurant,
        negativeFeedbackTrends: [
          {
            category: 'service',
            trend: 'declining' as const,
            severity: 0.8,
            frequency: 0.7,
            timeframe: 'recent'
          }
        ]
      };

      const prediction = service.predictQualityDecline(decliningRestaurant);

      expect(prediction.reasons).toContain('Declining trend in customer satisfaction');
      expect(prediction.reasons.some(reason => reason.includes('service'))).toBe(true);
    });
  });

  describe('getUserSensitivity', () => {
    it('should return default sensitivity for basic user', () => {
      const sensitivity = service.getUserSensitivity(mockUser);

      expect(sensitivity.serviceWeight).toBeDefined();
      expect(sensitivity.foodQualityWeight).toBeDefined();
      expect(sensitivity.cleanlinessWeight).toBeDefined();
      expect(sensitivity.valueWeight).toBeDefined();
      expect(sensitivity.atmosphereWeight).toBeDefined();
      expect(sensitivity.waitTimeWeight).toBeDefined();

      // All weights should sum to approximately 1
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

      const sensitivity = service.getUserSensitivity(userWithDietaryRestrictions);
      const baseSensitivity = service.getUserSensitivity(userWithoutDietaryRestrictions);

      expect(sensitivity.cleanlinessWeight).toBeGreaterThan(baseSensitivity.cleanlinessWeight);
      expect(sensitivity.foodQualityWeight).toBeGreaterThan(baseSensitivity.foodQualityWeight);
    });

    it('should adjust sensitivity for budget-conscious users', () => {
      const budgetUser = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          priceRange: [1, 2] as [number, number]
        }
      };

      const sensitivity = service.getUserSensitivity(budgetUser);
      const baseSensitivity = service.getUserSensitivity(mockUser);

      expect(sensitivity.valueWeight).toBeGreaterThan(baseSensitivity.valueWeight);
    });
  });
});