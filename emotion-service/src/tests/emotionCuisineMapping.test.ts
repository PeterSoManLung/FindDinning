import { EmotionCuisineMappingService } from '../services/emotionCuisineMapping';
import { EmotionToCuisineMappingRequest } from '../../../shared/src/types/emotion.types';

describe('EmotionCuisineMappingService', () => {
  let service: EmotionCuisineMappingService;

  beforeEach(() => {
    service = new EmotionCuisineMappingService();
  });

  describe('getCuisineRecommendations', () => {
    it('should return cuisine recommendations for happy emotion', () => {
      const request: EmotionToCuisineMappingRequest = {
        emotion: 'happy'
      };

      const recommendations = service.getCuisineRecommendations(request);

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].cuisineType).toBe('Italian');
      expect(recommendations[0].matchScore).toBeGreaterThan(0.8);
      expect(recommendations[0].reasoning).toContain('celebratory');
    });

    it('should return cuisine recommendations for sad emotion', () => {
      const request: EmotionToCuisineMappingRequest = {
        emotion: 'sad'
      };

      const recommendations = service.getCuisineRecommendations(request);

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].cuisineType).toBe('Chinese');
      expect(recommendations[0].matchScore).toBeGreaterThan(0.9);
      expect(recommendations[0].reasoning.toLowerCase()).toContain('comfort');
    });

    it('should return cuisine recommendations for stressed emotion', () => {
      const request: EmotionToCuisineMappingRequest = {
        emotion: 'stressed'
      };

      const recommendations = service.getCuisineRecommendations(request);

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].cuisineType).toBe('Japanese');
      expect(recommendations[0].reasoning).toContain('calm');
    });

    it('should return cuisine recommendations for angry emotion', () => {
      const request: EmotionToCuisineMappingRequest = {
        emotion: 'angry'
      };

      const recommendations = service.getCuisineRecommendations(request);

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].cuisineType).toBe('Spicy Sichuan');
      expect(recommendations[0].reasoning).toContain('cathartic');
    });

    it('should return cuisine recommendations for tired emotion', () => {
      const request: EmotionToCuisineMappingRequest = {
        emotion: 'tired'
      };

      const recommendations = service.getCuisineRecommendations(request);

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].cuisineType).toBe('Comfort Food');
      expect(recommendations[0].reasoning.toLowerCase()).toContain('easy');
    });

    it('should return cuisine recommendations for romantic emotion', () => {
      const request: EmotionToCuisineMappingRequest = {
        emotion: 'romantic'
      };

      const recommendations = service.getCuisineRecommendations(request);

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].cuisineType).toBe('French');
      expect(recommendations[0].matchScore).toBeGreaterThan(0.9);
      expect(recommendations[0].reasoning).toContain('romantic');
    });

    it('should return cuisine recommendations for nostalgic emotion', () => {
      const request: EmotionToCuisineMappingRequest = {
        emotion: 'nostalgic'
      };

      const recommendations = service.getCuisineRecommendations(request);

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].cuisineType).toBe('Traditional Chinese');
      expect(recommendations[0].reasoning).toContain('heritage');
    });

    it('should return cuisine recommendations for adventurous emotion', () => {
      const request: EmotionToCuisineMappingRequest = {
        emotion: 'adventurous'
      };

      const recommendations = service.getCuisineRecommendations(request);

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].cuisineType).toBe('Fusion');
      expect(recommendations[0].reasoning).toContain('new experiences');
    });

    it('should filter recommendations based on dietary restrictions', () => {
      const request: EmotionToCuisineMappingRequest = {
        emotion: 'angry',
        userPreferences: {
          dietaryRestrictions: ['vegetarian']
        }
      };

      const recommendations = service.getCuisineRecommendations(request);

      expect(recommendations).toBeDefined();
      expect(recommendations.every(rec => rec.cuisineType !== 'Korean BBQ')).toBe(true);
    });

    it('should boost preferred cuisines in recommendations', () => {
      const request: EmotionToCuisineMappingRequest = {
        emotion: 'happy',
        userPreferences: {
          cuisineTypes: ['Japanese']
        }
      };

      const recommendations = service.getCuisineRecommendations(request);
      const japaneseRec = recommendations.find(rec => rec.cuisineType === 'Japanese');

      expect(japaneseRec).toBeDefined();
      expect(japaneseRec!.reasoning).toContain('matches your cuisine preferences');
    });

    it('should adjust recommendations based on emotion intensity', () => {
      const lowIntensityRequest: EmotionToCuisineMappingRequest = {
        emotion: 'sad',
        intensity: 2
      };

      const highIntensityRequest: EmotionToCuisineMappingRequest = {
        emotion: 'sad',
        intensity: 5
      };

      const lowRecommendations = service.getCuisineRecommendations(lowIntensityRequest);
      const highRecommendations = service.getCuisineRecommendations(highIntensityRequest);

      expect(lowRecommendations.length).toBeGreaterThanOrEqual(highRecommendations.length);
    });

    it('should return default recommendations for unknown emotion', () => {
      const request: EmotionToCuisineMappingRequest = {
        emotion: 'unknown_emotion'
      };

      const recommendations = service.getCuisineRecommendations(request);

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].cuisineType).toBe('Chinese');
    });

    it('should limit recommendations to maximum of 8', () => {
      const request: EmotionToCuisineMappingRequest = {
        emotion: 'happy'
      };

      const recommendations = service.getCuisineRecommendations(request);

      expect(recommendations.length).toBeLessThanOrEqual(8);
    });

    it('should sort recommendations by match score', () => {
      const request: EmotionToCuisineMappingRequest = {
        emotion: 'happy'
      };

      const recommendations = service.getCuisineRecommendations(request);

      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i - 1].matchScore).toBeGreaterThanOrEqual(recommendations[i].matchScore);
      }
    });

    it('should include specific dishes in recommendations', () => {
      const request: EmotionToCuisineMappingRequest = {
        emotion: 'happy'
      };

      const recommendations = service.getCuisineRecommendations(request);
      const italianRec = recommendations.find(rec => rec.cuisineType === 'Italian');

      expect(italianRec).toBeDefined();
      expect(italianRec!.specificDishes).toBeDefined();
      expect(italianRec!.specificDishes!.length).toBeGreaterThan(0);
      expect(italianRec!.specificDishes).toContain('Pizza');
    });
  });

  describe('getMoodMapping', () => {
    it('should return mood mapping for valid emotion', () => {
      const mapping = service.getMoodMapping('happy');

      expect(mapping).toBeDefined();
      expect(mapping!.emotion).toBe('happy');
      expect(mapping!.cuisineRecommendations).toBeDefined();
      expect(mapping!.atmospherePreferences).toBeDefined();
      expect(mapping!.priceRangeAdjustment).toBeDefined();
    });

    it('should return null for invalid emotion', () => {
      const mapping = service.getMoodMapping('invalid_emotion');

      expect(mapping).toBeNull();
    });

    it('should include atmosphere preferences in mood mapping', () => {
      const mapping = service.getMoodMapping('romantic');

      expect(mapping).toBeDefined();
      expect(mapping!.atmospherePreferences).toContain('intimate');
      expect(mapping!.atmospherePreferences).toContain('romantic');
    });

    it('should include price range adjustment in mood mapping', () => {
      const happyMapping = service.getMoodMapping('happy');
      const sadMapping = service.getMoodMapping('sad');

      expect(happyMapping!.priceRangeAdjustment).toBeGreaterThan(0);
      expect(sadMapping!.priceRangeAdjustment).toBeLessThan(0);
    });
  });

  describe('getAllMoodMappings', () => {
    it('should return all mood mappings', () => {
      const mappings = service.getAllMoodMappings();

      expect(mappings).toBeDefined();
      expect(mappings.size).toBeGreaterThan(0);
      expect(mappings.has('happy')).toBe(true);
      expect(mappings.has('sad')).toBe(true);
      expect(mappings.has('neutral')).toBe(true);
    });

    it('should include all expected emotions', () => {
      const mappings = service.getAllMoodMappings();
      const expectedEmotions = [
        'happy', 'sad', 'stressed', 'angry', 'tired', 
        'lonely', 'romantic', 'nostalgic', 'adventurous', 'comfort', 'neutral'
      ];

      expectedEmotions.forEach(emotion => {
        expect(mappings.has(emotion)).toBe(true);
      });
    });

    it('should return mappings with consistent structure', () => {
      const mappings = service.getAllMoodMappings();

      mappings.forEach((mapping, emotion) => {
        expect(mapping.emotion).toBe(emotion);
        expect(mapping.cuisineRecommendations).toBeDefined();
        expect(Array.isArray(mapping.cuisineRecommendations)).toBe(true);
        expect(mapping.atmospherePreferences).toBeDefined();
        expect(Array.isArray(mapping.atmospherePreferences)).toBe(true);
        expect(typeof mapping.priceRangeAdjustment).toBe('number');
      });
    });
  });

  describe('dietary restrictions filtering', () => {
    it('should filter vegetarian restrictions correctly', () => {
      const request: EmotionToCuisineMappingRequest = {
        emotion: 'angry',
        userPreferences: {
          dietaryRestrictions: ['vegetarian']
        }
      };

      const recommendations = service.getCuisineRecommendations(request);
      
      expect(recommendations.every(rec => 
        !['Korean BBQ', 'Spicy Sichuan'].includes(rec.cuisineType)
      )).toBe(true);
    });

    it('should filter multiple dietary restrictions', () => {
      const request: EmotionToCuisineMappingRequest = {
        emotion: 'romantic',
        userPreferences: {
          dietaryRestrictions: ['vegetarian', 'gluten-free']
        }
      };

      const recommendations = service.getCuisineRecommendations(request);
      
      // Check that vegetarian restrictions filter out Korean BBQ
      expect(recommendations.every(rec => 
        rec.cuisineType !== 'Korean BBQ'
      )).toBe(true);
    });
  });

  describe('intensity adjustments', () => {
    it('should boost therapeutic cuisines for high intensity negative emotions', () => {
      const request: EmotionToCuisineMappingRequest = {
        emotion: 'sad',
        intensity: 5
      };

      const recommendations = service.getCuisineRecommendations(request);
      const comfortFoodRec = recommendations.find(rec => rec.cuisineType.includes('Comfort'));

      expect(comfortFoodRec).toBeDefined();
      expect(comfortFoodRec!.matchScore).toBeGreaterThan(0.9);
    });

    it('should boost safe options for low intensity emotions', () => {
      const request: EmotionToCuisineMappingRequest = {
        emotion: 'sad',
        intensity: 1
      };

      const recommendations = service.getCuisineRecommendations(request);
      const comfortRec = recommendations.find(rec => rec.cuisineType.includes('Comfort') || rec.cuisineType === 'Chinese');

      expect(comfortRec).toBeDefined();
    });
  });
});