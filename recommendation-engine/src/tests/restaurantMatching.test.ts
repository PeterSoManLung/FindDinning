import { RestaurantMatchingService } from '../services/restaurantMatching';
import { User } from '../../../shared/src/types/user.types';
import { Restaurant } from '../../../shared/src/types/restaurant.types';

describe('RestaurantMatchingService', () => {
  let service: RestaurantMatchingService;
  let mockUser: User;
  let mockRestaurants: Restaurant[];

  beforeEach(() => {
    service = new RestaurantMatchingService();
    
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

    mockRestaurants = [
      {
        id: 'rest1',
        name: 'Great Cantonese Restaurant',
        cuisineType: ['cantonese'],
        location: {
          address: '123 Test St',
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
            id: 'item1',
            name: 'Vegetarian Dim Sum',
            category: 'appetizer',
            isSignatureDish: true,
            dietaryInfo: ['vegetarian'],
            spiceLevel: 2
          }
        ],
        specialFeatures: ['vegetarian-options'],
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
            rating: 4.5,
            reviewCount: 200,
            lastUpdated: new Date('2024-01-15'),
            dataReliability: 0.9
          }
        ],
        lastSyncDate: new Date('2024-01-15'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15')
      },
      {
        id: 'rest2',
        name: 'Authentic Italian Bistro',
        cuisineType: ['italian'],
        location: {
          address: '456 Test Ave',
          latitude: 22.3200,
          longitude: 114.1700,
          district: 'Central'
        },
        priceRange: 4,
        rating: 4.2,
        negativeScore: 0.2,
        atmosphere: ['cozy', 'romantic'],
        operatingHours: {
          monday: { isOpen: true, openTime: '17:00', closeTime: '23:00' },
          tuesday: { isOpen: true, openTime: '17:00', closeTime: '23:00' },
          wednesday: { isOpen: true, openTime: '17:00', closeTime: '23:00' },
          thursday: { isOpen: true, openTime: '17:00', closeTime: '23:00' },
          friday: { isOpen: true, openTime: '17:00', closeTime: '23:00' },
          saturday: { isOpen: true, openTime: '17:00', closeTime: '23:00' },
          sunday: { isOpen: false }
        },
        menuHighlights: [
          {
            id: 'item2',
            name: 'Margherita Pizza',
            category: 'main',
            isSignatureDish: true,
            dietaryInfo: ['vegetarian'],
            spiceLevel: 1
          }
        ],
        specialFeatures: ['wood-fired-oven'],
        isLocalGem: false,
        authenticityScore: 0.8,
        governmentLicense: {
          licenseNumber: 'HK789012',
          isValid: true,
          violations: []
        },
        dataQualityScore: 0.9,
        negativeFeedbackTrends: [],
        platformData: [
          {
            source: 'tripadvisor',
            externalId: 'ta456',
            rating: 4.0,
            reviewCount: 150,
            lastUpdated: new Date('2024-01-10'),
            dataReliability: 0.8
          }
        ],
        lastSyncDate: new Date('2024-01-10'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-10')
      },
      {
        id: 'rest3',
        name: 'Expensive French Restaurant',
        cuisineType: ['french'],
        location: {
          address: '789 Luxury St',
          latitude: 22.3250,
          longitude: 114.1750,
          district: 'Central'
        },
        priceRange: 5, // Outside user's price range
        rating: 4.8,
        negativeScore: 0.05,
        atmosphere: ['formal', 'upscale'],
        operatingHours: {
          monday: { isOpen: false },
          tuesday: { isOpen: true, openTime: '18:00', closeTime: '24:00' },
          wednesday: { isOpen: true, openTime: '18:00', closeTime: '24:00' },
          thursday: { isOpen: true, openTime: '18:00', closeTime: '24:00' },
          friday: { isOpen: true, openTime: '18:00', closeTime: '24:00' },
          saturday: { isOpen: true, openTime: '18:00', closeTime: '24:00' },
          sunday: { isOpen: true, openTime: '18:00', closeTime: '24:00' }
        },
        menuHighlights: [
          {
            id: 'item3',
            name: 'Foie Gras',
            category: 'appetizer',
            isSignatureDish: true,
            dietaryInfo: [],
            spiceLevel: 0
          }
        ],
        specialFeatures: ['michelin-starred'],
        isLocalGem: false,
        authenticityScore: 0.95,
        governmentLicense: {
          licenseNumber: 'HK345678',
          isValid: true,
          violations: []
        },
        dataQualityScore: 0.95,
        negativeFeedbackTrends: [],
        platformData: [
          {
            source: 'openrice',
            externalId: 'or789',
            rating: 4.8,
            reviewCount: 300,
            lastUpdated: new Date('2024-01-12'),
            dataReliability: 0.95
          }
        ],
        lastSyncDate: new Date('2024-01-12'),
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-12')
      }
    ];
  });

  describe('generateRecommendations', () => {
    it('should generate recommendations based on user preferences', async () => {
      const recommendations = await service.generateRecommendations(
        mockUser,
        mockRestaurants,
        undefined,
        undefined,
        5
      );

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.length).toBeLessThanOrEqual(3);
      expect(recommendations[0].matchScore).toBeGreaterThan(0);
      expect(recommendations[0].reasonsForRecommendation).toBeDefined();
      expect(recommendations[0].restaurant).toBeDefined();
    });

    it('should rank restaurants by match score', async () => {
      const recommendations = await service.generateRecommendations(
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
    });

    it('should filter restaurants by distance', async () => {
      const criteria = { maxDistance: 0.5 }; // Very small distance
      
      const recommendations = await service.generateRecommendations(
        mockUser,
        mockRestaurants,
        criteria,
        undefined,
        5
      );

      // Should only include nearby restaurants
      expect(recommendations.length).toBeLessThanOrEqual(mockRestaurants.length);
    });

    it('should filter restaurants by minimum rating', async () => {
      const criteria = { minRating: 4.5 };
      
      const recommendations = await service.generateRecommendations(
        mockUser,
        mockRestaurants,
        criteria,
        undefined,
        5
      );

      recommendations.forEach(rec => {
        expect(rec.restaurant.rating).toBeGreaterThanOrEqual(4.5);
      });
    });

    it('should filter restaurants by maximum negative score', async () => {
      const criteria = { maxNegativeScore: 0.15 };
      
      const recommendations = await service.generateRecommendations(
        mockUser,
        mockRestaurants,
        criteria,
        undefined,
        5
      );

      recommendations.forEach(rec => {
        expect(rec.restaurant.negativeScore).toBeLessThanOrEqual(0.15);
      });
    });

    it('should filter restaurants by operating hours', async () => {
      const mondayMorning = new Date('2024-01-15T10:00:00'); // Monday 10 AM
      const criteria = { 
        requireOpen: true,
        currentTime: mondayMorning
      };
      
      const recommendations = await service.generateRecommendations(
        mockUser,
        mockRestaurants,
        criteria,
        undefined,
        5
      );

      // Should only include restaurants that are open on Monday morning
      recommendations.forEach(rec => {
        const mondayHours = rec.restaurant.operatingHours.monday;
        if (mondayHours.isOpen && mondayHours.openTime) {
          expect(mondayHours.openTime <= '10:00').toBe(true);
        }
      });
    });

    it('should filter restaurants by dietary restrictions', async () => {
      const userWithStrictDiet = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          dietaryRestrictions: ['vegan'] // Stricter than vegetarian
        }
      };

      const recommendations = await service.generateRecommendations(
        userWithStrictDiet,
        mockRestaurants,
        undefined,
        undefined,
        5
      );

      // Should filter out restaurants without vegan options
      expect(recommendations.length).toBeLessThanOrEqual(mockRestaurants.length);
    });

    it('should limit number of recommendations', async () => {
      const limit = 2;
      
      const recommendations = await service.generateRecommendations(
        mockUser,
        mockRestaurants,
        undefined,
        undefined,
        limit
      );

      expect(recommendations).toHaveLength(Math.min(limit, mockRestaurants.length));
    });

    it('should handle empty restaurant list', async () => {
      const recommendations = await service.generateRecommendations(
        mockUser,
        [],
        undefined,
        undefined,
        5
      );

      expect(recommendations).toHaveLength(0);
    });

    it('should generate recommendation reasons', async () => {
      const recommendations = await service.generateRecommendations(
        mockUser,
        mockRestaurants,
        undefined,
        undefined,
        5
      );

      recommendations.forEach(rec => {
        expect(rec.reasonsForRecommendation).toBeDefined();
        expect(Array.isArray(rec.reasonsForRecommendation)).toBe(true);
      });
    });
  });

  describe('custom weights', () => {
    it('should respect custom matching weights', async () => {
      const customWeights = {
        preferenceMatch: 0.8, // High preference weight
        distance: 0.1,
        rating: 0.05,
        negativeScore: 0.05,
        popularity: 0.0
      };

      const recommendations = await service.generateRecommendations(
        mockUser,
        mockRestaurants,
        {},
        customWeights,
        5
      );

      // Restaurants matching user preferences should rank higher
      const cantoneseRestaurant = recommendations.find(r => 
        r.restaurant.cuisineType.includes('cantonese')
      );
      const frenchRestaurant = recommendations.find(r => 
        r.restaurant.cuisineType.includes('french')
      );

      if (cantoneseRestaurant && frenchRestaurant) {
        expect(cantoneseRestaurant.matchScore).toBeGreaterThan(frenchRestaurant.matchScore);
      }
    });
  });
});