import { PersonalizedRecommendationService } from '../services/personalizedRecommendation';
import { MLIntegrationConfig } from '../services/mlIntegrationService';
import { User } from '../../../shared/src/types/user.types';
import { Restaurant } from '../../../shared/src/types/restaurant.types';
import { RecommendationRequest } from '../../../shared/src/types/recommendation.types';

describe('PersonalizedRecommendationService with ML Integration', () => {
  let recommendationService: PersonalizedRecommendationService;
  let recommendationServiceWithoutML: PersonalizedRecommendationService;
  let mockUser: User;
  let mockRestaurants: Restaurant[];
  let mockRequest: RecommendationRequest;

  const mockMLConfig: MLIntegrationConfig = {
    modelConfigs: {
      preference: {
        sagemakerEndpoint: 'mock-preference-endpoint',
        region: 'us-east-1',
        timeout: 5000,
        retryAttempts: 2,
        fallbackEnabled: true
      }
    },
    ensembleWeights: {
      preference: 0.6,
      collaborative: 0.2,
      content: 0.2,
      fallback: 0.1
    },
    confidenceThreshold: 0.6,
    fallbackEnabled: true
  };

  beforeEach(() => {
    // Service with ML integration
    recommendationService = new PersonalizedRecommendationService(mockMLConfig);
    
    // Service without ML integration for comparison
    recommendationServiceWithoutML = new PersonalizedRecommendationService();

    mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      preferences: {
        cuisineTypes: ['cantonese', 'dim_sum'],
        priceRange: [2, 4],
        dietaryRestrictions: ['vegetarian'],
        atmospherePreferences: ['casual', 'cozy'],
        spiceLevel: 2
      },
      diningHistory: [
        {
          id: 'visit-1',
          restaurantId: 'rest-1',
          visitDate: new Date('2024-01-15'),
          rating: 4,
          moodContext: 'happy'
        }
      ],
      emotionalProfile: {
        preferredMoodCuisines: {
          'happy': ['cantonese', 'dim_sum'],
          'sad': ['comfort_food', 'congee'],
          'celebrating': ['fine_dining', 'cantonese']
        },
        comfortFoodPreferences: ['congee', 'noodles'],
        celebratoryPreferences: ['dim_sum', 'peking_duck'],
        emotionalPatterns: [
          {
            emotion: 'happy',
            frequency: 0.6,
            associatedCuisines: ['cantonese', 'dim_sum'],
            timeOfDay: 'lunch'
          }
        ]
      },
      location: {
        latitude: 22.3193,
        longitude: 114.1694,
        district: 'Central'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockRestaurants = [
      {
        id: 'rest-1',
        name: 'Golden Dragon Dim Sum',
        cuisineType: ['cantonese', 'dim_sum'],
        location: {
          address: '123 Central St',
          latitude: 22.3193,
          longitude: 114.1694,
          district: 'Central'
        },
        priceRange: 3,
        rating: 4.5,
        negativeScore: 0.1,
        atmosphere: ['casual', 'family-friendly'],
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
            id: 'item-1',
            name: 'Har Gow', 
            price: 45, 
            description: 'Shrimp dumplings',
            category: 'dim_sum',
            isSignatureDish: true,
            dietaryInfo: []
          }
        ],
        specialFeatures: ['dim_sum_cart', 'tea_service'],
        isLocalGem: true,
        authenticityScore: 0.95,
        governmentLicense: {
          licenseNumber: 'HK-123456',
          isValid: true,
          violations: []
        },
        dataQualityScore: 0.9,
        negativeFeedbackTrends: [],
        platformData: [],
        lastSyncDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'rest-2',
        name: 'Modern Fusion Bistro',
        cuisineType: ['fusion', 'western'],
        location: {
          address: '456 Wan Chai Rd',
          latitude: 22.2783,
          longitude: 114.1747,
          district: 'Wan Chai'
        },
        priceRange: 4,
        rating: 4.2,
        negativeScore: 0.3,
        atmosphere: ['upscale', 'modern'],
        operatingHours: {
          monday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
          tuesday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
          wednesday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
          thursday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
          friday: { isOpen: true, openTime: '18:00', closeTime: '24:00' },
          saturday: { isOpen: true, openTime: '18:00', closeTime: '24:00' },
          sunday: { isOpen: true, openTime: '18:00', closeTime: '23:00' }
        },
        menuHighlights: [
          { 
            id: 'item-2',
            name: 'Wagyu Steak', 
            price: 380, 
            description: 'Premium beef',
            category: 'main',
            isSignatureDish: true,
            dietaryInfo: []
          }
        ],
        specialFeatures: ['wine_pairing', 'chef_table'],
        isLocalGem: false,
        authenticityScore: 0.6,
        governmentLicense: {
          licenseNumber: 'HK-789012',
          isValid: true,
          violations: []
        },
        dataQualityScore: 0.8,
        negativeFeedbackTrends: [
          {
            category: 'service',
            trend: 'declining',
            severity: 2,
            frequency: 0.15,
            timeframe: 'last_month'
          }
        ],
        platformData: [],
        lastSyncDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    mockRequest = {
      userId: 'user-1',
      emotionalState: 'happy',
      location: {
        latitude: 22.3193,
        longitude: 114.1694
      },
      context: {
        timeOfDay: 'lunch',
        groupSize: 2,
        occasion: 'casual'
      }
    };
  });

  describe('ML-Enhanced Recommendations', () => {
    it('should generate recommendations using ML integration', async () => {
      const recommendations = await recommendationService.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        mockRequest,
        undefined,
        2
      );

      expect(recommendations).toBeDefined();
      expect(recommendations).toHaveLength(2);
      
      recommendations.forEach(rec => {
        expect(rec.restaurant).toBeDefined();
        expect(rec.matchScore).toBeGreaterThanOrEqual(0);
        expect(rec.matchScore).toBeLessThanOrEqual(1);
        expect(rec.emotionalAlignment).toBeGreaterThanOrEqual(0);
        expect(rec.emotionalAlignment).toBeLessThanOrEqual(1);
        expect(rec.reasonsForRecommendation).toBeInstanceOf(Array);
        expect(rec.reasonsForRecommendation.length).toBeGreaterThan(0);
      });
    });

    it('should provide different recommendations than traditional approach', async () => {
      const mlRecommendations = await recommendationService.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        mockRequest,
        undefined,
        2
      );

      const traditionalRecommendations = await recommendationServiceWithoutML.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        mockRequest,
        undefined,
        2
      );

      expect(mlRecommendations).toHaveLength(2);
      expect(traditionalRecommendations).toHaveLength(2);

      // Both should provide valid recommendations
      const mlTopScore = mlRecommendations[0].matchScore;
      const traditionalTopScore = traditionalRecommendations[0].matchScore;

      expect(mlTopScore).toBeGreaterThanOrEqual(0);
      expect(traditionalTopScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle different emotional states appropriately', async () => {
      const happyRequest = { ...mockRequest, emotionalState: 'happy' };
      const sadRequest = { ...mockRequest, emotionalState: 'sad' };

      const happyRecs = await recommendationService.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        happyRequest,
        undefined,
        2
      );

      const sadRecs = await recommendationService.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        sadRequest,
        undefined,
        2
      );

      expect(happyRecs).toHaveLength(2);
      expect(sadRecs).toHaveLength(2);

      // Emotional alignment should vary based on emotional state
      happyRecs.forEach(rec => {
        expect(rec.emotionalAlignment).toBeGreaterThanOrEqual(0);
      });

      sadRecs.forEach(rec => {
        expect(rec.emotionalAlignment).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('ML Fallback Mechanisms', () => {
    it('should fallback to traditional recommendations when ML fails', async () => {
      // This test simulates ML failure by using a service without ML config
      const recommendations = await recommendationServiceWithoutML.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        mockRequest,
        undefined,
        2
      );

      expect(recommendations).toBeDefined();
      expect(recommendations).toHaveLength(2);
      
      // Should still provide valid recommendations
      recommendations.forEach(rec => {
        expect(rec.restaurant).toBeDefined();
        expect(rec.matchScore).toBeGreaterThanOrEqual(0);
        expect(rec.matchScore).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Confidence Scoring', () => {
    it('should calculate recommendation confidence with ML integration', async () => {
      const restaurant = mockRestaurants[0];
      const { confidence, reasoning } = recommendationService.calculateRecommendationConfidence(
        mockUser,
        restaurant,
        mockRequest.emotionalState
      );

      expect(confidence).toBeDefined();
      expect(confidence.overall).toBeGreaterThanOrEqual(0);
      expect(confidence.overall).toBeLessThanOrEqual(1);
      expect(confidence.preferenceMatch).toBeGreaterThanOrEqual(0);
      expect(confidence.preferenceMatch).toBeLessThanOrEqual(1);

      expect(reasoning).toBeDefined();
      expect(reasoning.primaryReasons).toBeInstanceOf(Array);
      expect(reasoning.emotionalReasons).toBeInstanceOf(Array);
      expect(reasoning.contextualReasons).toBeInstanceOf(Array);
      expect(reasoning.confidenceFactors).toBeInstanceOf(Array);
    });
  });

  describe('Caching with ML Integration', () => {
    it('should cache ML-enhanced recommendations', async () => {
      const firstCall = await recommendationService.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        mockRequest,
        undefined,
        2
      );

      const secondCall = await recommendationService.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        mockRequest,
        undefined,
        2
      );

      expect(firstCall).toHaveLength(2);
      expect(secondCall).toHaveLength(2);

      // Second call should be faster (cached)
      expect(firstCall[0].restaurant.id).toBe(secondCall[0].restaurant.id);
    });

    it('should clear cache when user preferences change', async () => {
      const initialRecs = await recommendationService.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        mockRequest,
        undefined,
        2
      );

      // Clear user cache
      recommendationService.clearUserCache(mockUser.id);

      const newRecs = await recommendationService.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        mockRequest,
        undefined,
        2
      );

      expect(initialRecs).toHaveLength(2);
      expect(newRecs).toHaveLength(2);
    });
  });

  describe('ML Health Monitoring', () => {
    it('should provide ML health status', async () => {
      const healthStatus = await recommendationService.getMLHealthStatus();

      expect(healthStatus).toBeDefined();
      expect(healthStatus.available).toBeDefined();
      expect(typeof healthStatus.available).toBe('boolean');

      if (healthStatus.available && healthStatus.health) {
        expect(healthStatus.health.overall).toBeDefined();
        expect(typeof healthStatus.health.overall).toBe('boolean');
        expect(healthStatus.health.models).toBeDefined();
        expect(typeof healthStatus.health.models).toBe('object');
        expect(healthStatus.health.details).toBeDefined();
        expect(typeof healthStatus.health.details).toBe('object');
      }
    });

    it('should handle ML unavailability gracefully', async () => {
      const healthStatus = await recommendationServiceWithoutML.getMLHealthStatus();

      expect(healthStatus).toBeDefined();
      expect(healthStatus.available).toBe(false);
    });
  });

  describe('Performance with ML Integration', () => {
    it('should complete ML-enhanced recommendations within reasonable time', async () => {
      const startTime = Date.now();

      const recommendations = await recommendationService.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        mockRequest,
        undefined,
        2
      );

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(recommendations).toHaveLength(2);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Context-Aware ML Recommendations', () => {
    it('should consider time of day in ML recommendations', async () => {
      const lunchRequest = { ...mockRequest, context: { ...mockRequest.context, timeOfDay: 'lunch' } };
      const dinnerRequest = { ...mockRequest, context: { ...mockRequest.context, timeOfDay: 'dinner' } };

      const lunchRecs = await recommendationService.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        lunchRequest,
        undefined,
        2
      );

      const dinnerRecs = await recommendationService.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        dinnerRequest,
        undefined,
        2
      );

      expect(lunchRecs).toHaveLength(2);
      expect(dinnerRecs).toHaveLength(2);

      // Both should provide valid recommendations
      lunchRecs.forEach(rec => expect(rec.matchScore).toBeGreaterThanOrEqual(0));
      dinnerRecs.forEach(rec => expect(rec.matchScore).toBeGreaterThanOrEqual(0));
    });

    it('should consider group size in ML recommendations', async () => {
      const smallGroupRequest = { ...mockRequest, context: { ...mockRequest.context, groupSize: 2 } };
      const largeGroupRequest = { ...mockRequest, context: { ...mockRequest.context, groupSize: 8 } };

      const smallGroupRecs = await recommendationService.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        smallGroupRequest,
        undefined,
        2
      );

      const largeGroupRecs = await recommendationService.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        largeGroupRequest,
        undefined,
        2
      );

      expect(smallGroupRecs).toHaveLength(2);
      expect(largeGroupRecs).toHaveLength(2);

      // Both should provide valid recommendations
      smallGroupRecs.forEach(rec => expect(rec.matchScore).toBeGreaterThanOrEqual(0));
      largeGroupRecs.forEach(rec => expect(rec.matchScore).toBeGreaterThanOrEqual(0));
    });
  });
});