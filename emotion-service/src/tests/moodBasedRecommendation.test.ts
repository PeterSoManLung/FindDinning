import { MoodBasedRecommendationService, MoodBasedRecommendationRequest } from '../services/moodBasedRecommendation';

describe('MoodBasedRecommendationService', () => {
  let service: MoodBasedRecommendationService;

  beforeEach(() => {
    service = new MoodBasedRecommendationService();
  });

  describe('generateMoodBasedRecommendations', () => {
    it('should generate comfort recommendations for sad emotions', () => {
      const request: MoodBasedRecommendationRequest = {
        primaryEmotion: 'sad',
        intensity: 4
      };

      const result = service.generateMoodBasedRecommendations(request);

      expect(result.recommendationType).toBe('comfort');
      expect(result.primaryRecommendations.length).toBeGreaterThan(0);
      expect(result.primaryRecommendations[0].cuisineType).toBe('Comfort Food');
      expect(result.fallbackRecommendations.length).toBeGreaterThan(0);
      expect(result.reasoning).toContain('comfort food');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should generate celebratory recommendations for happy emotions', () => {
      const request: MoodBasedRecommendationRequest = {
        primaryEmotion: 'happy',
        intensity: 4
      };

      const result = service.generateMoodBasedRecommendations(request);

      expect(result.recommendationType).toBe('celebratory');
      expect(result.primaryRecommendations.length).toBeGreaterThan(0);
      expect(result.primaryRecommendations[0].cuisineType).toBe('French');
      expect(result.atmosphereAdjustments.some(adj => adj.factor === 'festive_atmosphere')).toBe(true);
      expect(result.reasoning).toContain('celebratory');
    });

    it('should generate therapeutic recommendations for stressed emotions', () => {
      const request: MoodBasedRecommendationRequest = {
        primaryEmotion: 'stressed',
        intensity: 3
      };

      const result = service.generateMoodBasedRecommendations(request);

      expect(result.recommendationType).toBe('therapeutic');
      expect(result.primaryRecommendations.length).toBeGreaterThan(0);
      expect(result.primaryRecommendations[0].cuisineType).toBe('Japanese');
      expect(result.atmosphereAdjustments.some(adj => adj.factor === 'calm_atmosphere')).toBe(true);
      expect(result.reasoning).toContain('calming');
    });

    it('should generate adventurous recommendations for adventurous emotions', () => {
      const request: MoodBasedRecommendationRequest = {
        primaryEmotion: 'adventurous',
        intensity: 3
      };

      const result = service.generateMoodBasedRecommendations(request);

      expect(result.recommendationType).toBe('adventurous');
      expect(result.primaryRecommendations.length).toBeGreaterThan(0);
      expect(result.primaryRecommendations[0].cuisineType).toBe('Fusion');
      expect(result.atmosphereAdjustments.some(adj => adj.factor === 'unique_atmosphere')).toBe(true);
      expect(result.reasoning).toContain('adventurous');
    });

    it('should generate neutral recommendations for unknown emotions', () => {
      const request: MoodBasedRecommendationRequest = {
        primaryEmotion: 'unknown',
        intensity: 3
      };

      const result = service.generateMoodBasedRecommendations(request);

      expect(result.recommendationType).toBe('neutral');
      expect(result.primaryRecommendations.length).toBeGreaterThan(0);
      expect(result.primaryRecommendations[0].cuisineType).toBe('Chinese');
      expect(result.reasoning).toContain('versatile');
    });

    it('should include price adjustments for celebratory recommendations', () => {
      const request: MoodBasedRecommendationRequest = {
        primaryEmotion: 'happy',
        intensity: 5
      };

      const result = service.generateMoodBasedRecommendations(request);

      expect(result.priceAdjustments.length).toBeGreaterThan(0);
      expect(result.priceAdjustments.some(adj => 
        adj.factor === 'price_increase_tolerance' && adj.adjustment === 'increase'
      )).toBe(true);
    });

    it('should filter recommendations based on dietary restrictions', () => {
      const request: MoodBasedRecommendationRequest = {
        primaryEmotion: 'happy',
        intensity: 3,
        userPreferences: {
          dietaryRestrictions: ['vegetarian']
        }
      };

      const result = service.generateMoodBasedRecommendations(request);

      expect(result.primaryRecommendations.every(rec => 
        !['Korean BBQ', 'Steakhouse'].includes(rec.cuisineType)
      )).toBe(true);
    });

    it('should boost preferred cuisines in recommendations', () => {
      const request: MoodBasedRecommendationRequest = {
        primaryEmotion: 'neutral',
        intensity: 3,
        userPreferences: {
          cuisineTypes: ['Japanese']
        }
      };

      const result = service.generateMoodBasedRecommendations(request);

      const japaneseRec = result.primaryRecommendations.find(rec => rec.cuisineType === 'Japanese');
      expect(japaneseRec).toBeDefined();
      expect(japaneseRec!.reasoning).toContain('preferences');
    });
  });

  describe('identifyComfortFood', () => {
    it('should identify comfort food for sad emotions', () => {
      const recommendations = service.identifyComfortFood('sad', 3);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].cuisineType).toBe('Comfort Food');
      expect(recommendations[0].matchScore).toBeGreaterThan(0.9);
      expect(recommendations[0].reasoning.toLowerCase()).toContain('comfort');
    });

    it('should identify comfort food for lonely emotions', () => {
      const recommendations = service.identifyComfortFood('lonely', 3);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].cuisineType).toBe('Comfort Food');
      expect(recommendations[0].reasoning.toLowerCase()).toContain('emotional warmth');
    });

    it('should identify comfort food for tired emotions', () => {
      const recommendations = service.identifyComfortFood('tired', 3);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].cuisineType).toBe('Comfort Food');
      expect(recommendations[0].reasoning.toLowerCase()).toContain('easy');
    });

    it('should enhance recommendations for high intensity emotions', () => {
      const lowIntensity = service.identifyComfortFood('sad', 2);
      const highIntensity = service.identifyComfortFood('sad', 5);

      expect(highIntensity[0].matchScore).toBeGreaterThan(lowIntensity[0].matchScore);
      expect(highIntensity[0].reasoning).toContain('high emotional intensity');
    });

    it('should adjust recommendations for solo dining context', () => {
      const recommendations = service.identifyComfortFood('sad', 3, { socialSetting: 'alone' });

      expect(recommendations.length).toBeGreaterThan(0);
      // Should not include sharing dishes for solo dining
      expect(recommendations.every(rec => 
        !rec.specificDishes?.some(dish => dish.toLowerCase().includes('sharing'))
      )).toBe(true);
    });

    it('should adjust recommendations for late night context', () => {
      const recommendations = service.identifyComfortFood('tired', 3, { timeOfDay: 'late_night' });

      expect(recommendations.length).toBeGreaterThan(0);
      const congeeRec = recommendations.find(rec => rec.cuisineType === 'Congee');
      if (congeeRec) {
        expect(congeeRec.reasoning).toContain('late night');
      }
    });

    it('should return sorted recommendations by match score', () => {
      const recommendations = service.identifyComfortFood('sad', 3);

      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i - 1].matchScore).toBeGreaterThanOrEqual(recommendations[i].matchScore);
      }
    });
  });

  describe('suggestCelebratoryDining', () => {
    it('should suggest celebratory dining for happy emotions', () => {
      const recommendations = service.suggestCelebratoryDining('happy', 4);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].cuisineType).toBe('French');
      expect(recommendations[0].reasoning.toLowerCase()).toContain('special occasions');
    });

    it('should suggest celebratory dining for excited emotions', () => {
      const recommendations = service.suggestCelebratoryDining('excited', 4);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].cuisineType).toBe('Korean BBQ');
      expect(recommendations[0].reasoning.toLowerCase()).toContain('excited');
    });

    it('should enhance premium options for high intensity celebrations', () => {
      const recommendations = service.suggestCelebratoryDining('happy', 5);

      const fineDiningRec = recommendations.find(rec => rec.cuisineType.includes('Fine Dining'));
      const frenchRec = recommendations.find(rec => rec.cuisineType === 'French');
      
      if (fineDiningRec) {
        expect(fineDiningRec.reasoning).toContain('major celebrations');
      }
      if (frenchRec) {
        expect(frenchRec.reasoning).toContain('major celebrations');
      }
    });

    it('should adjust recommendations for friends context', () => {
      const recommendations = service.suggestCelebratoryDining('happy', 4, { socialSetting: 'friends' });

      const koreanRec = recommendations.find(rec => rec.cuisineType === 'Korean BBQ');
      if (koreanRec) {
        expect(koreanRec.reasoning).toContain('celebrating with friends');
      }
    });

    it('should adjust recommendations for date context', () => {
      const recommendations = service.suggestCelebratoryDining('happy', 4, { socialSetting: 'date' });

      const frenchRec = recommendations.find(rec => rec.cuisineType === 'French');
      const italianRec = recommendations.find(rec => rec.cuisineType === 'Italian');
      
      if (frenchRec) {
        expect(frenchRec.reasoning).toContain('romantic celebration');
      }
      if (italianRec) {
        expect(italianRec.reasoning).toContain('romantic celebration');
      }
    });

    it('should return sorted recommendations by match score', () => {
      const recommendations = service.suggestCelebratoryDining('happy', 4);

      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i - 1].matchScore).toBeGreaterThanOrEqual(recommendations[i].matchScore);
      }
    });
  });

  describe('handleNeutralState', () => {
    it('should provide neutral recommendations with Chinese as top choice', () => {
      const recommendations = service.handleNeutralState();

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].cuisineType).toBe('Chinese');
      expect(recommendations[0].reasoning.toLowerCase()).toContain('versatile');
    });

    it('should boost user preferred cuisines', () => {
      const recommendations = service.handleNeutralState({ cuisineTypes: ['Japanese'] });

      const japaneseRec = recommendations.find(rec => rec.cuisineType === 'Japanese');
      expect(japaneseRec).toBeDefined();
      expect(japaneseRec!.reasoning).toContain('preferences');
    });

    it('should add breakfast options for morning context', () => {
      const recommendations = service.handleNeutralState(undefined, { timeOfDay: 'breakfast' });

      expect(recommendations[0].cuisineType).toBe('Breakfast');
      expect(recommendations[0].reasoning).toContain('morning');
    });

    it('should boost lunch-appropriate options for lunch context', () => {
      const recommendations = service.handleNeutralState(undefined, { timeOfDay: 'lunch' });

      const casualRec = recommendations.find(rec => rec.cuisineType === 'Casual Dining');
      const chineseRec = recommendations.find(rec => rec.cuisineType === 'Chinese');
      
      if (casualRec) {
        expect(casualRec.reasoning).toContain('lunch');
      }
      if (chineseRec) {
        expect(chineseRec.reasoning).toContain('lunch');
      }
    });

    it('should include local Hong Kong options', () => {
      const recommendations = service.handleNeutralState();

      const localRec = recommendations.find(rec => rec.cuisineType === 'Local Hong Kong');
      expect(localRec).toBeDefined();
      expect(localRec!.reasoning).toContain('local');
    });

    it('should return sorted recommendations by match score', () => {
      const recommendations = service.handleNeutralState();

      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i - 1].matchScore).toBeGreaterThanOrEqual(recommendations[i].matchScore);
      }
    });
  });

  describe('atmosphere adjustments', () => {
    it('should provide cozy atmosphere adjustments for comfort recommendations', () => {
      const request: MoodBasedRecommendationRequest = {
        primaryEmotion: 'sad',
        intensity: 3
      };

      const result = service.generateMoodBasedRecommendations(request);

      expect(result.atmosphereAdjustments.some(adj => 
        adj.factor === 'cozy_atmosphere' && adj.adjustment === 'increase'
      )).toBe(true);
      expect(result.atmosphereAdjustments.some(adj => 
        adj.factor === 'quiet_atmosphere' && adj.adjustment === 'increase'
      )).toBe(true);
    });

    it('should provide festive atmosphere adjustments for celebratory recommendations', () => {
      const request: MoodBasedRecommendationRequest = {
        primaryEmotion: 'happy',
        intensity: 4
      };

      const result = service.generateMoodBasedRecommendations(request);

      expect(result.atmosphereAdjustments.some(adj => 
        adj.factor === 'festive_atmosphere' && adj.adjustment === 'increase'
      )).toBe(true);
      expect(result.atmosphereAdjustments.some(adj => 
        adj.factor === 'social_atmosphere' && adj.adjustment === 'increase'
      )).toBe(true);
    });

    it('should provide calm atmosphere adjustments for therapeutic recommendations', () => {
      const request: MoodBasedRecommendationRequest = {
        primaryEmotion: 'stressed',
        intensity: 4
      };

      const result = service.generateMoodBasedRecommendations(request);

      expect(result.atmosphereAdjustments.some(adj => 
        adj.factor === 'calm_atmosphere' && adj.adjustment === 'increase'
      )).toBe(true);
      expect(result.atmosphereAdjustments.some(adj => 
        adj.factor === 'peaceful_atmosphere' && adj.adjustment === 'increase'
      )).toBe(true);
    });

    it('should provide unique atmosphere adjustments for adventurous recommendations', () => {
      const request: MoodBasedRecommendationRequest = {
        primaryEmotion: 'adventurous',
        intensity: 3
      };

      const result = service.generateMoodBasedRecommendations(request);

      expect(result.atmosphereAdjustments.some(adj => 
        adj.factor === 'unique_atmosphere' && adj.adjustment === 'increase'
      )).toBe(true);
      expect(result.atmosphereAdjustments.some(adj => 
        adj.factor === 'vibrant_atmosphere' && adj.adjustment === 'increase'
      )).toBe(true);
    });
  });

  describe('price adjustments', () => {
    it('should increase price tolerance for celebratory recommendations', () => {
      const request: MoodBasedRecommendationRequest = {
        primaryEmotion: 'happy',
        intensity: 4
      };

      const result = service.generateMoodBasedRecommendations(request);

      expect(result.priceAdjustments.some(adj => 
        adj.factor === 'price_increase_tolerance' && adj.adjustment === 'increase'
      )).toBe(true);
    });

    it('should prefer budget-friendly options for comfort recommendations', () => {
      const request: MoodBasedRecommendationRequest = {
        primaryEmotion: 'sad',
        intensity: 3
      };

      const result = service.generateMoodBasedRecommendations(request);

      expect(result.priceAdjustments.some(adj => 
        adj.factor === 'budget_friendly_preference' && adj.adjustment === 'increase'
      )).toBe(true);
    });

    it('should focus on value for therapeutic recommendations', () => {
      const request: MoodBasedRecommendationRequest = {
        primaryEmotion: 'stressed',
        intensity: 3
      };

      const result = service.generateMoodBasedRecommendations(request);

      expect(result.priceAdjustments.some(adj => 
        adj.factor === 'value_focus' && adj.adjustment === 'increase'
      )).toBe(true);
    });
  });

  describe('confidence calculation', () => {
    it('should have higher confidence for clear emotional states', () => {
      const clearEmotion: MoodBasedRecommendationRequest = {
        primaryEmotion: 'sad',
        intensity: 4
      };

      const unclearEmotion: MoodBasedRecommendationRequest = {
        primaryEmotion: 'unknown',
        intensity: 2
      };

      const result1 = service.generateMoodBasedRecommendations(clearEmotion);
      const result2 = service.generateMoodBasedRecommendations(unclearEmotion);

      expect(result1.confidence).toBeGreaterThan(result2.confidence);
    });

    it('should boost confidence for high intensity emotions', () => {
      const lowIntensity: MoodBasedRecommendationRequest = {
        primaryEmotion: 'happy',
        intensity: 2
      };

      const highIntensity: MoodBasedRecommendationRequest = {
        primaryEmotion: 'happy',
        intensity: 5
      };

      const result1 = service.generateMoodBasedRecommendations(lowIntensity);
      const result2 = service.generateMoodBasedRecommendations(highIntensity);

      expect(result2.confidence).toBeGreaterThan(result1.confidence);
    });

    it('should boost confidence with contextual information', () => {
      const withoutContext: MoodBasedRecommendationRequest = {
        primaryEmotion: 'happy',
        intensity: 3
      };

      const withContext: MoodBasedRecommendationRequest = {
        primaryEmotion: 'happy',
        intensity: 3,
        context: {
          socialSetting: 'date',
          timeOfDay: 'dinner'
        }
      };

      const result1 = service.generateMoodBasedRecommendations(withoutContext);
      const result2 = service.generateMoodBasedRecommendations(withContext);

      expect(result2.confidence).toBeGreaterThan(result1.confidence);
    });

    it('should boost confidence with user preferences', () => {
      const withoutPrefs: MoodBasedRecommendationRequest = {
        primaryEmotion: 'neutral',
        intensity: 3
      };

      const withPrefs: MoodBasedRecommendationRequest = {
        primaryEmotion: 'neutral',
        intensity: 3,
        userPreferences: {
          cuisineTypes: ['Japanese', 'Italian'],
          dietaryRestrictions: ['vegetarian']
        }
      };

      const result1 = service.generateMoodBasedRecommendations(withoutPrefs);
      const result2 = service.generateMoodBasedRecommendations(withPrefs);

      expect(result2.confidence).toBeGreaterThan(result1.confidence);
    });
  });

  describe('reasoning generation', () => {
    it('should generate appropriate reasoning for different recommendation types', () => {
      const emotions = ['sad', 'happy', 'stressed', 'adventurous', 'neutral'];
      
      emotions.forEach(emotion => {
        const request: MoodBasedRecommendationRequest = {
          primaryEmotion: emotion,
          intensity: 3
        };

        const result = service.generateMoodBasedRecommendations(request);
        
        expect(result.reasoning).toBeTruthy();
        expect(result.reasoning.length).toBeGreaterThan(20);
        expect(result.reasoning.toLowerCase()).toContain(emotion);
      });
    });

    it('should include social context in reasoning', () => {
      const request: MoodBasedRecommendationRequest = {
        primaryEmotion: 'happy',
        intensity: 3,
        context: {
          socialSetting: 'date'
        }
      };

      const result = service.generateMoodBasedRecommendations(request);
      
      expect(result.reasoning).toContain('date');
    });

    it('should reflect intensity in reasoning', () => {
      const lowIntensity: MoodBasedRecommendationRequest = {
        primaryEmotion: 'sad',
        intensity: 1
      };

      const highIntensity: MoodBasedRecommendationRequest = {
        primaryEmotion: 'sad',
        intensity: 5
      };

      const result1 = service.generateMoodBasedRecommendations(lowIntensity);
      const result2 = service.generateMoodBasedRecommendations(highIntensity);

      expect(result1.reasoning).toContain('mildly');
      expect(result2.reasoning).toContain('strongly');
    });
  });

  describe('edge cases', () => {
    it('should handle empty user preferences gracefully', () => {
      const request: MoodBasedRecommendationRequest = {
        primaryEmotion: 'happy',
        intensity: 3,
        userPreferences: {}
      };

      const result = service.generateMoodBasedRecommendations(request);

      expect(result.primaryRecommendations.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should handle multiple dietary restrictions', () => {
      const request: MoodBasedRecommendationRequest = {
        primaryEmotion: 'happy',
        intensity: 3,
        userPreferences: {
          dietaryRestrictions: ['vegetarian', 'gluten-free', 'dairy-free']
        }
      };

      const result = service.generateMoodBasedRecommendations(request);

      expect(result.primaryRecommendations.length).toBeGreaterThan(0);
      // Should filter out multiple restricted cuisines
      expect(result.primaryRecommendations.every(rec => 
        !['Korean BBQ', 'Steakhouse', 'French', 'Fine Dining', 'Italian'].includes(rec.cuisineType)
      )).toBe(true);
    });

    it('should limit recommendations to maximum of 6', () => {
      const request: MoodBasedRecommendationRequest = {
        primaryEmotion: 'neutral',
        intensity: 3
      };

      const result = service.generateMoodBasedRecommendations(request);

      expect(result.primaryRecommendations.length).toBeLessThanOrEqual(6);
      expect(result.fallbackRecommendations.length).toBeLessThanOrEqual(6);
    });
  });
});