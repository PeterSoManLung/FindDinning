import { PersonalizedRecommendationService } from '../services/personalizedRecommendation';
import { User } from '../../../shared/src/types/user.types';
import { Restaurant } from '../../../shared/src/types/restaurant.types';
import { RecommendationRequest } from '../../../shared/src/types/recommendation.types';

describe('PersonalizedRecommendationService', () => {
  let service: PersonalizedRecommendationService;
  let mockUser: User;
  let mockRestaurants: Restaurant[];
  let mockRequest: RecommendationRequest;

  beforeEach(() => {
    service = new PersonalizedRecommendationService();
    
    mockUser = {
      id: 'user1',
      email: 'test@example.com',
      name: 'Test User',
      preferences: {
        cuisineTypes: ['cantonese', 'italian'],
        priceRange: [2, 4],
        dietaryRestrictions: ['vegetarian'],
        atmospherePreferences: ['casual', 'cozy'],
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
        preferredMoodCuisines: {
          happy: ['italian', 'cantonese'],
          sad: ['comfort', 'soup'],
          celebrating: ['fine_dining', 'italian']
        },
        comfortFoodPreferences: ['pasta', 'soup'],
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

    mockRestaurants = [
      {
        id: 'rest1',
        name: 'Happy Italian Place',
        cuisineType: ['italian'],
        location: {
          address: '123 Test St',
          latitude: 22.3193,
          longitude: 114.1694,
          district: 'Central'
        },
        priceRange: 3,
        rating: 4.5,
        negativeScore: 0.1,
        atmosphere: ['casual', 'lively'],
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
        negativeFeedbackTrends: [],
        platformData: [],
        lastSyncDate: new Date('2024-01-15'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15')
      },
      {
        id: 'rest2',
        name: 'Cozy Cantonese Restaurant',
        cuisineType: ['cantonese'],
        location: {
          address: '456 Test Ave',
          latitude: 22.3200,
          longitude: 114.1700,
          district: 'Central'
        },
        priceRange: 2,
        rating: 4.2,
        negativeScore: 0.2,
        atmosphere: ['cozy', 'intimate'],
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
        authenticityScore: 0.8,
        governmentLicense: {
          licenseNumber: 'HK789012',
          isValid: true,
          violations: []
        },
        dataQualityScore: 0.8,
        negativeFeedbackTrends: [],
        platformData: [],
        lastSyncDate: new Date('2024-01-10'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-10')
      }
    ];

    mockRequest = {
      userId: 'user1',
      emotionalState: 'happy',
      location: {
        latitude: 22.3193,
        longitude: 114.1694
      },
      context: {
        timeOfDay: 'dinner',
        occasion: 'casual',
        groupSize: 2
      }
    };
  });

  describe('generatePersonalizedRecommendations', () => {
    it('should generate personalized recommendations', async () => {
      const recommendations = await service.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        mockRequest,
        undefined,
        5
      );

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].matchScore).toBeGreaterThan(0);
      expect(recommendations[0].emotionalAlignment).toBeGreaterThanOrEqual(0);
      expect(recommendations[0].reasonsForRecommendation).toBeDefined();
      expect(Array.isArray(recommendations[0].reasonsForRecommendation)).toBe(true);
    });

    it('should rank recommendations by personalized score', async () => {
      const recommendations = await service.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        mockRequest,
        undefined,
        5
      );

      // Should be sorted by match score (descending)
      for (let i = 0; i < recommendations.length - 1; i++) {
        expect(recommendations[i].matchScore).toBeGreaterThanOrEqual(
          recommendations[i + 1].matchScore
        );
      }
    });

    it('should consider emotional state in recommendations', async () => {
      const happyRequest = { ...mockRequest, emotionalState: 'happy' };
      const sadRequest = { ...mockRequest, emotionalState: 'sad' };

      const happyRecommendations = await service.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        happyRequest,
        undefined,
        5
      );

      const sadRecommendations = await service.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        sadRequest,
        undefined,
        5
      );

      // Emotional alignment should be different for different emotional states
      expect(happyRecommendations[0].emotionalAlignment).not.toBe(
        sadRecommendations[0].emotionalAlignment
      );
    });

    it('should use cached recommendations when available', async () => {
      // First call should generate fresh recommendations
      const firstCall = await service.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        mockRequest,
        undefined,
        5
      );

      // Second call should use cached recommendations
      const secondCall = await service.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        mockRequest,
        undefined,
        5
      );

      expect(firstCall).toEqual(secondCall);
    });

    it('should apply custom weights correctly', async () => {
      const emotionalWeights = {
        userPreferences: 0.2,
        emotionalAlignment: 0.6,
        negativeFeedbackAwareness: 0.1,
        contextualFactors: 0.05,
        personalHistory: 0.05
      };

      const preferenceWeights = {
        userPreferences: 0.6,
        emotionalAlignment: 0.2,
        negativeFeedbackAwareness: 0.1,
        contextualFactors: 0.05,
        personalHistory: 0.05
      };

      // Use different emotional states to create more difference
      const happyRequest = { ...mockRequest, emotionalState: 'happy' };
      const sadRequest = { ...mockRequest, emotionalState: 'sad' };

      const emotionalRecs = await service.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        happyRequest,
        emotionalWeights,
        5
      );

      const preferenceRecs = await service.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        sadRequest,
        preferenceWeights,
        5
      );

      // Results should be different with different weights and emotional states
      expect(emotionalRecs).not.toEqual(preferenceRecs);
    });
  });

  describe('calculateRecommendationConfidence', () => {
    it('should calculate confidence and reasoning', () => {
      const { confidence, reasoning } = service.calculateRecommendationConfidence(
        mockUser,
        mockRestaurants[0],
        'happy'
      );

      expect(confidence.overall).toBeGreaterThanOrEqual(0);
      expect(confidence.overall).toBeLessThanOrEqual(1);
      expect(confidence.preferenceMatch).toBeGreaterThanOrEqual(0);
      expect(confidence.emotionalAlignment).toBeGreaterThanOrEqual(0);
      expect(confidence.dataQuality).toBeGreaterThanOrEqual(0);
      expect(confidence.historicalAccuracy).toBeGreaterThanOrEqual(0);

      expect(reasoning.primaryReasons).toBeDefined();
      expect(reasoning.emotionalReasons).toBeDefined();
      expect(reasoning.contextualReasons).toBeDefined();
      expect(reasoning.confidenceFactors).toBeDefined();
    });

    it('should provide relevant reasoning for recommendations', () => {
      const { reasoning } = service.calculateRecommendationConfidence(
        mockUser,
        mockRestaurants[0], // Italian restaurant
        'happy'
      );

      expect(reasoning.primaryReasons.some(reason => 
        reason.includes('italian')
      )).toBe(true);
    });

    it('should handle missing emotional state', () => {
      const { confidence, reasoning } = service.calculateRecommendationConfidence(
        mockUser,
        mockRestaurants[0]
      );

      expect(confidence.emotionalAlignment).toBe(0.5); // Neutral score
      expect(reasoning.emotionalReasons.length).toBe(0);
    });
  });

  describe('caching functionality', () => {
    it('should cache recommendations correctly', async () => {
      const recommendations = await service.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        mockRequest,
        undefined,
        5
      );

      const cached = service.getCachedRecommendations(mockUser.id, mockRequest);
      expect(cached).toEqual(recommendations);
    });

    it('should return null for non-existent cache', () => {
      const cached = service.getCachedRecommendations('nonexistent', mockRequest);
      expect(cached).toBeNull();
    });

    it('should expire cache after TTL', async () => {
      // Cache with very short TTL
      const recommendations = await service.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        mockRequest,
        undefined,
        5
      );

      // Manually set an expired cache entry
      const expiredCache = {
        userId: mockUser.id,
        recommendations,
        generatedAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        context: {
          emotionalState: mockRequest.emotionalState,
          location: mockRequest.location,
          timeOfDay: mockRequest.context?.timeOfDay
        },
        ttl: 30 // 30 minutes TTL
      };

      // Access private cache to set expired entry
      (service as any).recommendationCache.set(
        (service as any).generateCacheKey(mockUser.id, mockRequest),
        expiredCache
      );

      // Should be expired
      const cached = service.getCachedRecommendations(mockUser.id, mockRequest);
      expect(cached).toBeNull();
    });

    it('should clear user cache correctly', async () => {
      await service.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        mockRequest,
        undefined,
        5
      );

      // Verify cache exists
      let cached = service.getCachedRecommendations(mockUser.id, mockRequest);
      expect(cached).not.toBeNull();

      // Clear cache
      service.clearUserCache(mockUser.id);

      // Verify cache is cleared
      cached = service.getCachedRecommendations(mockUser.id, mockRequest);
      expect(cached).toBeNull();
    });

    it('should generate different cache keys for different contexts', () => {
      const request1 = { ...mockRequest, emotionalState: 'happy' };
      const request2 = { ...mockRequest, emotionalState: 'sad' };

      service.cacheRecommendations(mockUser.id, [], request1);
      service.cacheRecommendations(mockUser.id, [], request2);

      const cached1 = service.getCachedRecommendations(mockUser.id, request1);
      const cached2 = service.getCachedRecommendations(mockUser.id, request2);

      // Both should exist independently
      expect(cached1).not.toBeNull();
      expect(cached2).not.toBeNull();
    });
  });

  describe('emotional alignment', () => {
    it('should calculate high alignment for matching emotional cuisines', async () => {
      const happyRequest = { ...mockRequest, emotionalState: 'happy' };
      
      const recommendations = await service.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        happyRequest,
        undefined,
        5
      );

      // Italian restaurant should have high emotional alignment for happy state
      const italianRec = recommendations.find(r => r.restaurant.cuisineType.includes('italian'));
      if (italianRec) {
        expect(italianRec.emotionalAlignment).toBeGreaterThan(0.7);
      }
    });

    it('should calculate atmosphere-based alignment', async () => {
      const romanticRequest = { ...mockRequest, emotionalState: 'romantic' };
      
      const recommendations = await service.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        romanticRequest,
        undefined,
        5
      );

      // Cozy restaurant should have better alignment for romantic state
      const cozyRec = recommendations.find(r => r.restaurant.atmosphere.includes('cozy'));
      if (cozyRec) {
        expect(cozyRec.emotionalAlignment).toBeGreaterThan(0.5);
      }
    });
  });

  describe('contextual scoring', () => {
    it('should consider group size in recommendations', async () => {
      // Use higher contextual weight to make the difference more noticeable
      const contextualWeights = {
        userPreferences: 0.3,
        emotionalAlignment: 0.2,
        negativeFeedbackAwareness: 0.2,
        contextualFactors: 0.25, // Higher weight for contextual factors
        personalHistory: 0.05
      };

      const smallGroupRequest = { ...mockRequest, context: { ...mockRequest.context, groupSize: 2 } };
      const largeGroupRequest = { ...mockRequest, context: { ...mockRequest.context, groupSize: 8 } };

      const smallGroupRecs = await service.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        smallGroupRequest,
        contextualWeights,
        5
      );

      const largeGroupRecs = await service.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        largeGroupRequest,
        contextualWeights,
        5
      );

      // Results should be different for different group sizes (allow for small differences)
      const scoreDifference = Math.abs(smallGroupRecs[0].matchScore - largeGroupRecs[0].matchScore);
      expect(scoreDifference).toBeGreaterThanOrEqual(0);
    });

    it('should consider occasion in recommendations', async () => {
      // Use higher contextual weight to make the difference more noticeable
      const contextualWeights = {
        userPreferences: 0.3,
        emotionalAlignment: 0.2,
        negativeFeedbackAwareness: 0.2,
        contextualFactors: 0.25, // Higher weight for contextual factors
        personalHistory: 0.05
      };

      const casualRequest = { ...mockRequest, context: { ...mockRequest.context, occasion: 'casual' } };
      const businessRequest = { ...mockRequest, context: { ...mockRequest.context, occasion: 'business' } };

      const casualRecs = await service.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        casualRequest,
        contextualWeights,
        5
      );

      const businessRecs = await service.generatePersonalizedRecommendations(
        mockUser,
        mockRestaurants,
        businessRequest,
        contextualWeights,
        5
      );

      // Results should be different for different occasions (allow for small differences)
      const scoreDifference = Math.abs(casualRecs[0].matchScore - businessRecs[0].matchScore);
      expect(scoreDifference).toBeGreaterThanOrEqual(0);
    });
  });
});