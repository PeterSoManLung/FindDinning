import { PreferenceAnalysisService } from '../services/preferenceAnalysis';
import { User } from '../../../shared/src/types/user.types';
import { Restaurant } from '../../../shared/src/types/restaurant.types';

describe('PreferenceAnalysisService', () => {
  let service: PreferenceAnalysisService;
  let mockUser: User;
  let mockRestaurant: Restaurant;

  beforeEach(() => {
    service = new PreferenceAnalysisService();
    
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
        preferredMoodCuisines: { happy: ['italian'], sad: ['comfort'] },
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
      rating: 4.2,
      negativeScore: 0.2,
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
          id: 'item1',
          name: 'Dim Sum',
          category: 'appetizer',
          isSignatureDish: true,
          dietaryInfo: ['vegetarian-options'],
          spiceLevel: 2
        }
      ],
      specialFeatures: ['dim-sum', 'tea-service'],
      isLocalGem: true,
      authenticityScore: 0.9,
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

  describe('analyzeUserPreferences', () => {
    it('should analyze user preferences correctly', () => {
      const result = service.analyzeUserPreferences(mockUser);

      expect(result.preferredCuisines.has('cantonese')).toBe(true);
      expect(result.preferredCuisines.has('italian')).toBe(true);
      expect(result.preferredCuisines.get('cantonese')).toBe(1.0);
      expect(result.preferredPriceRange).toEqual([2, 4]);
      expect(result.preferredAtmosphere.has('casual')).toBe(true);
      expect(result.preferredAtmosphere.has('cozy')).toBe(true);
      expect(result.preferredSpiceLevel).toBe(3);
    });

    it('should handle user with no explicit preferences', () => {
      const userWithoutPreferences = {
        ...mockUser,
        preferences: {
          cuisineTypes: [],
          priceRange: [1, 4] as [number, number],
          dietaryRestrictions: [],
          atmospherePreferences: [],
          spiceLevel: 2
        }
      };

      const result = service.analyzeUserPreferences(userWithoutPreferences);

      expect(result.preferredCuisines.size).toBe(0);
      expect(result.preferredAtmosphere.size).toBe(0);
      expect(result.preferredPriceRange).toEqual([1, 4]);
    });
  });

  describe('calculatePreferenceMatch', () => {
    it('should calculate high match score for matching preferences', () => {
      const userAnalysis = service.analyzeUserPreferences(mockUser);
      const matchScore = service.calculatePreferenceMatch(userAnalysis, mockRestaurant);

      expect(matchScore).toBeGreaterThan(0.5);
      expect(matchScore).toBeLessThanOrEqual(1.0);
    });

    it('should calculate lower match score for non-matching cuisine', () => {
      const userAnalysis = service.analyzeUserPreferences(mockUser);
      const nonMatchingRestaurant = {
        ...mockRestaurant,
        cuisineType: ['japanese', 'korean']
      };

      const matchScore = service.calculatePreferenceMatch(userAnalysis, nonMatchingRestaurant);

      expect(matchScore).toBeLessThan(0.5);
    });

    it('should handle price range matching correctly', () => {
      const userAnalysis = service.analyzeUserPreferences(mockUser);
      
      // Test restaurant within price range
      const affordableRestaurant = { ...mockRestaurant, priceRange: 3 };
      const matchScore1 = service.calculatePreferenceMatch(userAnalysis, affordableRestaurant);

      // Test restaurant outside price range
      const expensiveRestaurant = { ...mockRestaurant, priceRange: 5 };
      const matchScore2 = service.calculatePreferenceMatch(userAnalysis, expensiveRestaurant);

      expect(matchScore1).toBeGreaterThan(matchScore2);
    });

    it('should handle atmosphere matching correctly', () => {
      const userAnalysis = service.analyzeUserPreferences(mockUser);
      
      // Test restaurant with matching atmosphere
      const matchingAtmosphere = { ...mockRestaurant, atmosphere: ['casual', 'cozy'] };
      const matchScore1 = service.calculatePreferenceMatch(userAnalysis, matchingAtmosphere);

      // Test restaurant with non-matching atmosphere
      const nonMatchingAtmosphere = { ...mockRestaurant, atmosphere: ['formal', 'loud'] };
      const matchScore2 = service.calculatePreferenceMatch(userAnalysis, nonMatchingAtmosphere);

      expect(matchScore1).toBeGreaterThan(matchScore2);
    });
  });

  describe('updatePreferencesFromFeedback', () => {
    it('should boost preferences for liked restaurants', () => {
      const updates = service.updatePreferencesFromFeedback(
        mockUser,
        mockRestaurant,
        'liked'
      );

      expect(updates.cuisineTypes).toContain('cantonese');
      expect(updates.atmospherePreferences).toContain('casual');
    });

    it('should reduce preferences for disliked restaurants', () => {
      const userWithMultipleCuisines = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          cuisineTypes: ['cantonese', 'italian', 'japanese']
        }
      };

      const updates = service.updatePreferencesFromFeedback(
        userWithMultipleCuisines,
        mockRestaurant,
        'disliked'
      );

      expect(updates.cuisineTypes).toBeDefined();
      if (updates.cuisineTypes) {
        expect(updates.cuisineTypes.length).toBeLessThan(3);
      }
    });

    it('should handle visited feedback with high rating', () => {
      const updates = service.updatePreferencesFromFeedback(
        mockUser,
        mockRestaurant,
        'visited',
        5
      );

      expect(updates.cuisineTypes).toContain('cantonese');
      expect(updates.atmospherePreferences).toContain('casual');
    });

    it('should handle visited feedback with low rating', () => {
      const userWithMultipleCuisines = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          cuisineTypes: ['cantonese', 'italian', 'japanese']
        }
      };

      const updates = service.updatePreferencesFromFeedback(
        userWithMultipleCuisines,
        mockRestaurant,
        'visited',
        2
      );

      expect(updates.cuisineTypes).toBeDefined();
      if (updates.cuisineTypes) {
        expect(updates.cuisineTypes.length).toBeLessThan(3);
      }
    });

    it('should not remove all cuisine preferences', () => {
      const userWithOneCuisine = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          cuisineTypes: ['cantonese']
        }
      };

      const updates = service.updatePreferencesFromFeedback(
        userWithOneCuisine,
        mockRestaurant,
        'disliked'
      );

      // Should not remove the only cuisine preference
      expect(updates.cuisineTypes).toBeUndefined();
    });
  });
});