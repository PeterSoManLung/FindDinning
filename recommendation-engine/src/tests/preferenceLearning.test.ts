import { PreferenceLearningService } from '../services/preferenceLearning';
import { User } from '../../../shared/src/types/user.types';
import { Restaurant } from '../../../shared/src/types/restaurant.types';
import { RecommendationFeedback } from '../../../shared/src/types/recommendation.types';

describe('PreferenceLearningService', () => {
  let service: PreferenceLearningService;
  let mockUser: User;
  let mockRestaurant: Restaurant;

  beforeEach(() => {
    service = new PreferenceLearningService();
    
    mockUser = {
      id: 'user1',
      email: 'test@example.com',
      name: 'Test User',
      preferences: {
        cuisineTypes: ['cantonese', 'italian'],
        priceRange: [2, 3],
        dietaryRestrictions: ['vegetarian'],
        atmospherePreferences: ['casual'],
        spiceLevel: 3
      },
      diningHistory: [
        {
          id: 'visit1',
          restaurantId: 'rest1',
          visitDate: new Date('2024-01-15'),
          rating: 4,
          moodContext: 'happy'
        },
        {
          id: 'visit2',
          restaurantId: 'rest2',
          visitDate: new Date('2024-01-10'),
          rating: 5,
          moodContext: 'celebrating'
        }
      ],
      emotionalProfile: {
        preferredMoodCuisines: { happy: ['italian'] },
        comfortFoodPreferences: ['pasta'],
        celebratoryPreferences: ['fine_dining'],
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

    mockRestaurant = {
      id: 'rest1',
      name: 'Test Japanese Restaurant',
      cuisineType: ['japanese', 'sushi'],
      location: {
        address: '123 Test St',
        latitude: 22.3193,
        longitude: 114.1694,
        district: 'Central'
      },
      priceRange: 4,
      rating: 4.2,
      negativeScore: 0.2,
      atmosphere: ['modern', 'quiet'],
      operatingHours: {
        monday: { isOpen: true, openTime: '11:00', closeTime: '22:00' },
        tuesday: { isOpen: true, openTime: '11:00', closeTime: '22:00' },
        wednesday: { isOpen: true, openTime: '11:00', closeTime: '22:00' },
        thursday: { isOpen: true, openTime: '11:00', closeTime: '22:00' },
        friday: { isOpen: true, openTime: '11:00', closeTime: '22:00' },
        saturday: { isOpen: true, openTime: '11:00', closeTime: '22:00' },
        sunday: { isOpen: true, openTime: '11:00', closeTime: '22:00' }
      },
      menuHighlights: [
        {
          id: 'item1',
          name: 'Sashimi Set',
          category: 'main',
          isSignatureDish: true,
          dietaryInfo: ['gluten-free'],
          spiceLevel: 0
        }
      ],
      specialFeatures: ['fresh-fish', 'sake-bar'],
      isLocalGem: false,
      authenticityScore: 0.8,
      governmentLicense: {
        licenseNumber: 'HK123456',
        isValid: true,
        violations: []
      },
      dataQualityScore: 0.8,
      negativeFeedbackTrends: [],
      platformData: [
        {
          source: 'openrice',
          externalId: 'or123',
          rating: 4.1,
          reviewCount: 150,
          lastUpdated: new Date('2024-01-15'),
          dataReliability: 0.9
        }
      ],
      lastSyncDate: new Date('2024-01-15'),
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-15')
    };
  });

  describe('learnFromFeedback', () => {
    it('should learn from positive feedback (liked)', () => {
      const feedback: RecommendationFeedback = {
        recommendationId: 'rec1',
        restaurantId: 'rest1',
        userId: 'user1',
        feedback: 'liked',
        createdAt: new Date('2024-01-20')
      };

      const result = service.learnFromFeedback(mockUser, mockRestaurant, feedback);

      expect(result.updatedPreferences.cuisineTypes).toContain('japanese');
      expect(result.updatedPreferences.cuisineTypes).toContain('sushi');
      expect(result.updatedPreferences.atmospherePreferences).toContain('modern');
      expect(result.updatedPreferences.atmospherePreferences).toContain('quiet');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.learningInsights.length).toBeGreaterThan(0);
    });

    it('should learn from negative feedback (disliked)', () => {
      const feedback: RecommendationFeedback = {
        recommendationId: 'rec1',
        restaurantId: 'rest1',
        userId: 'user1',
        feedback: 'disliked',
        createdAt: new Date('2024-01-20')
      };

      const result = service.learnFromFeedback(mockUser, mockRestaurant, feedback);

      // Should reduce preferences for this restaurant's characteristics
      if (result.updatedPreferences.cuisineTypes) {
        expect(result.updatedPreferences.cuisineTypes.length).toBeLessThan(
          mockUser.preferences.cuisineTypes.length + mockRestaurant.cuisineType.length
        );
      }
      if (result.updatedPreferences.atmospherePreferences) {
        expect(result.updatedPreferences.atmospherePreferences.length).toBeLessThan(
          mockUser.preferences.atmospherePreferences.length + mockRestaurant.atmosphere.length
        );
      }
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.learningInsights.length).toBeGreaterThan(0);
    });

    it('should learn from visit feedback with high rating', () => {
      const feedback: RecommendationFeedback = {
        recommendationId: 'rec1',
        restaurantId: 'rest1',
        userId: 'user1',
        feedback: 'visited',
        rating: 5,
        notes: 'Excellent sushi, great atmosphere',
        createdAt: new Date('2024-01-20')
      };

      const result = service.learnFromFeedback(mockUser, mockRestaurant, feedback);

      expect(result.updatedPreferences.cuisineTypes).toContain('japanese');
      expect(result.updatedPreferences.cuisineTypes).toContain('sushi');
      expect(result.updatedPreferences.atmospherePreferences).toContain('modern');
      expect(result.confidence).toBeGreaterThan(0.7); // High confidence due to visit + rating + notes
      expect(result.learningInsights.length).toBeGreaterThan(0);
    });

    it('should learn from visit feedback with low rating', () => {
      const feedback: RecommendationFeedback = {
        recommendationId: 'rec1',
        restaurantId: 'rest1',
        userId: 'user1',
        feedback: 'visited',
        rating: 2,
        notes: 'Food was not fresh, too expensive',
        createdAt: new Date('2024-01-20')
      };

      const result = service.learnFromFeedback(mockUser, mockRestaurant, feedback);

      // Should reduce preferences for this restaurant's characteristics
      if (result.updatedPreferences.cuisineTypes) {
        expect(result.updatedPreferences.cuisineTypes.length).toBeLessThan(
          mockUser.preferences.cuisineTypes.length + mockRestaurant.cuisineType.length
        );
      }
      expect(result.confidence).toBeGreaterThan(0.7); // High confidence due to visit + rating + notes
      expect(result.learningInsights.length).toBeGreaterThan(0);
    });

    it('should learn from not_interested feedback', () => {
      const feedback: RecommendationFeedback = {
        recommendationId: 'rec1',
        restaurantId: 'rest1',
        userId: 'user1',
        feedback: 'not_interested',
        createdAt: new Date('2024-01-20')
      };

      const result = service.learnFromFeedback(mockUser, mockRestaurant, feedback);

      // Should have some negative learning but less strong than disliked
      expect(result.confidence).toBeLessThan(0.8);
      expect(result.learningInsights.length).toBeGreaterThan(0);
    });

    it('should expand price range for liked expensive restaurants', () => {
      const feedback: RecommendationFeedback = {
        recommendationId: 'rec1',
        restaurantId: 'rest1',
        userId: 'user1',
        feedback: 'liked',
        createdAt: new Date('2024-01-20')
      };

      const result = service.learnFromFeedback(mockUser, mockRestaurant, feedback);

      // Restaurant price range is 4, user's current range is [2, 3]
      expect(result.updatedPreferences.priceRange).toEqual([2, 4]);
      expect(result.learningInsights).toContain('Expanded price range to include higher-priced options');
    });

    it('should not remove all cuisine preferences', () => {
      const userWithOneCuisine = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          cuisineTypes: ['japanese'] // Only one cuisine that matches restaurant
        }
      };

      const feedback: RecommendationFeedback = {
        recommendationId: 'rec1',
        restaurantId: 'rest1',
        userId: 'user1',
        feedback: 'disliked',
        createdAt: new Date('2024-01-20')
      };

      const result = service.learnFromFeedback(userWithOneCuisine, mockRestaurant, feedback);

      // Should not remove the only cuisine preference or should add new ones
      if (result.updatedPreferences.cuisineTypes) {
        expect(result.updatedPreferences.cuisineTypes.length).toBeGreaterThan(0);
      }
    });

    it('should have higher confidence for recent feedback', () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

      const recentFeedback: RecommendationFeedback = {
        recommendationId: 'rec1',
        restaurantId: 'rest1',
        userId: 'user1',
        feedback: 'visited',
        rating: 5,
        notes: 'Great experience',
        createdAt: now // Very recent
      };

      const oldFeedback: RecommendationFeedback = {
        recommendationId: 'rec2',
        restaurantId: 'rest1',
        userId: 'user1',
        feedback: 'visited',
        rating: 5,
        notes: 'Great experience',
        createdAt: thirtyDaysAgo // Older feedback
      };

      const recentResult = service.learnFromFeedback(mockUser, mockRestaurant, recentFeedback);
      const oldResult = service.learnFromFeedback(mockUser, mockRestaurant, oldFeedback);

      expect(recentResult.confidence).toBeGreaterThanOrEqual(oldResult.confidence);
    });

    it('should have higher confidence for detailed feedback', () => {
      const detailedFeedback: RecommendationFeedback = {
        recommendationId: 'rec1',
        restaurantId: 'rest1',
        userId: 'user1',
        feedback: 'visited',
        rating: 4,
        notes: 'Great sushi, excellent service, nice atmosphere for date night',
        createdAt: new Date('2024-01-20')
      };

      const simpleFeedback: RecommendationFeedback = {
        recommendationId: 'rec2',
        restaurantId: 'rest1',
        userId: 'user1',
        feedback: 'liked',
        createdAt: new Date('2024-01-20')
      };

      const detailedResult = service.learnFromFeedback(mockUser, mockRestaurant, detailedFeedback);
      const simpleResult = service.learnFromFeedback(mockUser, mockRestaurant, simpleFeedback);

      expect(detailedResult.confidence).toBeGreaterThan(simpleResult.confidence);
    });
  });

  describe('analyzeDiningPatterns', () => {
    it('should analyze dining patterns from history', () => {
      const result = service.analyzeDiningPatterns(mockUser);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.learningInsights).toBeDefined();
      expect(Array.isArray(result.learningInsights)).toBe(true);
    });

    it('should handle insufficient dining history', () => {
      const userWithLittleHistory = {
        ...mockUser,
        diningHistory: [
          {
            id: 'visit1',
            restaurantId: 'rest1',
            visitDate: new Date('2024-01-15'),
            rating: 4
          }
        ]
      };

      const result = service.analyzeDiningPatterns(userWithLittleHistory);

      expect(result.confidence).toBeLessThan(0.5);
      expect(result.learningInsights).toContain('Insufficient dining history for pattern analysis');
    });

    it('should handle user with no dining history', () => {
      const userWithNoHistory = {
        ...mockUser,
        diningHistory: []
      };

      const result = service.analyzeDiningPatterns(userWithNoHistory);

      expect(result.confidence).toBeLessThan(0.5);
      expect(result.learningInsights).toContain('Insufficient dining history for pattern analysis');
    });
  });
});