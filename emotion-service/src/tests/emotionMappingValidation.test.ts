import { EmotionAnalysis } from '../services/emotionAnalysis';
import { EmotionCuisineMapping } from '../services/emotionCuisineMapping';
import { MoodBasedRecommendation } from '../services/moodBasedRecommendation';
import { EmotionState, EmotionContext } from '../../../shared/src/types/emotion.types';
import { Restaurant } from '../../../shared/src/types/restaurant.types';

describe('Emotion-to-Recommendation Mapping Validation', () => {
  let emotionAnalysis: EmotionAnalysis;
  let emotionMapping: EmotionCuisineMapping;
  let moodRecommendation: MoodBasedRecommendation;

  const mockRestaurants: Restaurant[] = [
    {
      id: 'comfort-1',
      name: 'Cozy Noodle House',
      cuisineType: ['Chinese', 'Comfort Food'],
      location: {
        address: '123 Comfort Street',
        latitude: 22.3193,
        longitude: 114.1694,
        district: 'Central',
      },
      priceRange: 2,
      rating: 4.3,
      negativeScore: 0.15,
      atmosphere: ['cozy', 'casual', 'family-friendly'],
      operatingHours: {
        monday: { open: '11:00', close: '22:00' },
        tuesday: { open: '11:00', close: '22:00' },
        wednesday: { open: '11:00', close: '22:00' },
        thursday: { open: '11:00', close: '22:00' },
        friday: { open: '11:00', close: '22:00' },
        saturday: { open: '11:00', close: '22:00' },
        sunday: { open: '11:00', close: '22:00' },
      },
      menuHighlights: [
        { name: 'Wonton Noodle Soup', price: 45, description: 'Comforting traditional soup' },
        { name: 'Congee', price: 35, description: 'Warm rice porridge' },
      ],
      specialFeatures: ['comfort food', 'warm atmosphere'],
      isLocalGem: true,
      authenticityScore: 0.9,
      governmentLicense: {
        licenseNumber: 'HK123',
        isValid: true,
        violations: [],
      },
      dataQualityScore: 0.95,
      negativeFeedbackTrends: [],
      platformData: [],
      lastSyncDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'celebration-1',
      name: 'Golden Palace',
      cuisineType: ['Chinese', 'Fine Dining'],
      location: {
        address: '456 Luxury Avenue',
        latitude: 22.3200,
        longitude: 114.1700,
        district: 'Central',
      },
      priceRange: 4,
      rating: 4.7,
      negativeScore: 0.08,
      atmosphere: ['upscale', 'elegant', 'romantic'],
      operatingHours: {
        monday: { open: '18:00', close: '23:00' },
        tuesday: { open: '18:00', close: '23:00' },
        wednesday: { open: '18:00', close: '23:00' },
        thursday: { open: '18:00', close: '23:00' },
        friday: { open: '18:00', close: '23:00' },
        saturday: { open: '18:00', close: '23:00' },
        sunday: { open: '18:00', close: '23:00' },
      },
      menuHighlights: [
        { name: 'Peking Duck', price: 380, description: 'Premium roasted duck' },
        { name: 'Abalone', price: 280, description: 'Luxury seafood' },
      ],
      specialFeatures: ['fine dining', 'celebration venue'],
      isLocalGem: false,
      authenticityScore: 0.85,
      governmentLicense: {
        licenseNumber: 'HK456',
        isValid: true,
        violations: [],
      },
      dataQualityScore: 0.98,
      negativeFeedbackTrends: [],
      platformData: [],
      lastSyncDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    emotionAnalysis = new EmotionAnalysis();
    emotionMapping = new EmotionCuisineMapping();
    moodRecommendation = new MoodBasedRecommendation();
  });

  describe('Emotion Detection Accuracy', () => {
    it('should correctly identify sad emotions from text input', async () => {
      const sadTexts = [
        'I feel really down today',
        'Having a terrible day at work',
        'Feeling lonely and need comfort',
        'Just broke up with my partner',
        'Lost my job today',
      ];

      for (const text of sadTexts) {
        const emotion = await emotionAnalysis.analyzeText(text);
        expect(emotion.primaryEmotion).toBe('sad');
        expect(emotion.confidence).toBeGreaterThan(0.7);
      }
    });

    it('should correctly identify happy emotions from text input', async () => {
      const happyTexts = [
        'Got promoted today! Want to celebrate',
        'Feeling amazing and energetic',
        'Just got engaged!',
        'Won the lottery!',
        'Having the best day ever',
      ];

      for (const text of happyTexts) {
        const emotion = await emotionAnalysis.analyzeText(text);
        expect(emotion.primaryEmotion).toBe('happy');
        expect(emotion.confidence).toBeGreaterThan(0.7);
      }
    });

    it('should correctly identify stressed emotions from text input', async () => {
      const stressedTexts = [
        'So overwhelmed with work deadlines',
        'Feeling anxious about the presentation',
        'Too much pressure from everything',
        'Can\'t handle all this stress',
        'Feeling burnt out',
      ];

      for (const text of stressedTexts) {
        const emotion = await emotionAnalysis.analyzeText(text);
        expect(emotion.primaryEmotion).toBe('stressed');
        expect(emotion.confidence).toBeGreaterThan(0.7);
      }
    });

    it('should handle neutral emotions appropriately', async () => {
      const neutralTexts = [
        'Just looking for something to eat',
        'Normal day, nothing special',
        'Want to try something new',
        'Regular lunch break',
        'Meeting friends for dinner',
      ];

      for (const text of neutralTexts) {
        const emotion = await emotionAnalysis.analyzeText(text);
        expect(emotion.primaryEmotion).toBe('neutral');
        expect(emotion.confidence).toBeGreaterThan(0.6);
      }
    });
  });

  describe('Emotion-to-Cuisine Mapping Validation', () => {
    it('should map sad emotions to comfort food cuisines', () => {
      const sadEmotion: EmotionState = {
        primaryEmotion: 'sad',
        intensity: 0.8,
        confidence: 0.9,
        secondaryEmotions: ['lonely', 'tired'],
      };

      const cuisineMapping = emotionMapping.mapEmotionToCuisine(sadEmotion);
      
      expect(cuisineMapping.recommendedCuisines).toContain('Chinese');
      expect(cuisineMapping.recommendedCuisines).toContain('Comfort Food');
      expect(cuisineMapping.atmospherePreferences).toContain('cozy');
      expect(cuisineMapping.atmospherePreferences).toContain('casual');
      expect(cuisineMapping.reasoning).toContain('comfort');
    });

    it('should map happy emotions to celebratory cuisines', () => {
      const happyEmotion: EmotionState = {
        primaryEmotion: 'happy',
        intensity: 0.9,
        confidence: 0.85,
        secondaryEmotions: ['excited', 'energetic'],
      };

      const cuisineMapping = emotionMapping.mapEmotionToCuisine(happyEmotion);
      
      expect(cuisineMapping.recommendedCuisines).toContain('Fine Dining');
      expect(cuisineMapping.atmospherePreferences).toContain('upscale');
      expect(cuisineMapping.atmospherePreferences).toContain('celebratory');
      expect(cuisineMapping.reasoning).toContain('celebration');
    });

    it('should map stressed emotions to quick and healthy options', () => {
      const stressedEmotion: EmotionState = {
        primaryEmotion: 'stressed',
        intensity: 0.7,
        confidence: 0.8,
        secondaryEmotions: ['anxious', 'overwhelmed'],
      };

      const cuisineMapping = emotionMapping.mapEmotionToCuisine(stressedEmotion);
      
      expect(cuisineMapping.recommendedCuisines).toContain('Healthy');
      expect(cuisineMapping.atmospherePreferences).toContain('quiet');
      expect(cuisineMapping.atmospherePreferences).toContain('peaceful');
      expect(cuisineMapping.reasoning).toContain('stress relief');
    });

    it('should provide appropriate intensity-based recommendations', () => {
      const lowIntensitySad: EmotionState = {
        primaryEmotion: 'sad',
        intensity: 0.3,
        confidence: 0.8,
        secondaryEmotions: [],
      };

      const highIntensitySad: EmotionState = {
        primaryEmotion: 'sad',
        intensity: 0.9,
        confidence: 0.8,
        secondaryEmotions: ['depressed'],
      };

      const lowMapping = emotionMapping.mapEmotionToCuisine(lowIntensitySad);
      const highMapping = emotionMapping.mapEmotionToCuisine(highIntensitySad);

      // High intensity should have stronger comfort food recommendations
      expect(highMapping.emotionalAlignment).toBeGreaterThan(lowMapping.emotionalAlignment);
      expect(highMapping.recommendedCuisines.length).toBeGreaterThanOrEqual(lowMapping.recommendedCuisines.length);
    });
  });

  describe('Mood-Based Recommendation Accuracy', () => {
    it('should recommend comfort food restaurants for sad emotions', async () => {
      const sadContext: EmotionContext = {
        emotion: {
          primaryEmotion: 'sad',
          intensity: 0.8,
          confidence: 0.9,
          secondaryEmotions: ['lonely'],
        },
        context: 'Had a bad day at work',
        timestamp: new Date(),
      };

      const recommendations = await moodRecommendation.generateMoodBasedRecommendations(
        sadContext,
        mockRestaurants,
        { latitude: 22.3193, longitude: 114.1694 }
      );

      expect(recommendations.length).toBeGreaterThan(0);
      
      const comfortRestaurant = recommendations.find(r => r.restaurant.id === 'comfort-1');
      expect(comfortRestaurant).toBeDefined();
      expect(comfortRestaurant!.emotionalAlignment).toBeGreaterThan(0.8);
      expect(comfortRestaurant!.reasonsForRecommendation).toContain('comfort food');
    });

    it('should recommend upscale restaurants for happy emotions', async () => {
      const happyContext: EmotionContext = {
        emotion: {
          primaryEmotion: 'happy',
          intensity: 0.9,
          confidence: 0.85,
          secondaryEmotions: ['excited'],
        },
        context: 'Got promoted today!',
        timestamp: new Date(),
      };

      const recommendations = await moodRecommendation.generateMoodBasedRecommendations(
        happyContext,
        mockRestaurants,
        { latitude: 22.3193, longitude: 114.1694 }
      );

      expect(recommendations.length).toBeGreaterThan(0);
      
      const celebrationRestaurant = recommendations.find(r => r.restaurant.id === 'celebration-1');
      expect(celebrationRestaurant).toBeDefined();
      expect(celebrationRestaurant!.emotionalAlignment).toBeGreaterThan(0.8);
      expect(celebrationRestaurant!.reasonsForRecommendation).toContain('celebration');
    });

    it('should adjust recommendations based on emotion intensity', async () => {
      const mildSadContext: EmotionContext = {
        emotion: {
          primaryEmotion: 'sad',
          intensity: 0.3,
          confidence: 0.8,
          secondaryEmotions: [],
        },
        context: 'Slightly disappointed',
        timestamp: new Date(),
      };

      const intenseSadContext: EmotionContext = {
        emotion: {
          primaryEmotion: 'sad',
          intensity: 0.9,
          confidence: 0.8,
          secondaryEmotions: ['depressed'],
        },
        context: 'Extremely upset',
        timestamp: new Date(),
      };

      const mildRecommendations = await moodRecommendation.generateMoodBasedRecommendations(
        mildSadContext,
        mockRestaurants,
        { latitude: 22.3193, longitude: 114.1694 }
      );

      const intenseRecommendations = await moodRecommendation.generateMoodBasedRecommendations(
        intenseSadContext,
        mockRestaurants,
        { latitude: 22.3193, longitude: 114.1694 }
      );

      // Intense emotions should have higher emotional alignment scores
      const intenseComfort = intenseRecommendations.find(r => r.restaurant.id === 'comfort-1');
      const mildComfort = mildRecommendations.find(r => r.restaurant.id === 'comfort-1');

      if (intenseComfort && mildComfort) {
        expect(intenseComfort.emotionalAlignment).toBeGreaterThan(mildComfort.emotionalAlignment);
      }
    });
  });

  describe('Contextual Emotion Processing', () => {
    it('should consider time of day in emotion-based recommendations', async () => {
      const morningContext: EmotionContext = {
        emotion: {
          primaryEmotion: 'tired',
          intensity: 0.7,
          confidence: 0.8,
          secondaryEmotions: ['sleepy'],
        },
        context: 'Need energy for the day',
        timestamp: new Date('2024-01-01T08:00:00Z'),
      };

      const eveningContext: EmotionContext = {
        emotion: {
          primaryEmotion: 'tired',
          intensity: 0.7,
          confidence: 0.8,
          secondaryEmotions: ['sleepy'],
        },
        context: 'Exhausted after work',
        timestamp: new Date('2024-01-01T19:00:00Z'),
      };

      const morningRecs = await moodRecommendation.generateMoodBasedRecommendations(
        morningContext,
        mockRestaurants,
        { latitude: 22.3193, longitude: 114.1694 }
      );

      const eveningRecs = await moodRecommendation.generateMoodBasedRecommendations(
        eveningContext,
        mockRestaurants,
        { latitude: 22.3193, longitude: 114.1694 }
      );

      // Morning tired should suggest energizing options
      // Evening tired should suggest comforting options
      expect(morningRecs[0].reasonsForRecommendation).toEqual(
        expect.arrayContaining([expect.stringMatching(/energy|energizing|breakfast/i)])
      );

      expect(eveningRecs[0].reasonsForRecommendation).toEqual(
        expect.arrayContaining([expect.stringMatching(/comfort|relaxing|dinner/i)])
      );
    });

    it('should handle mixed emotions appropriately', async () => {
      const mixedContext: EmotionContext = {
        emotion: {
          primaryEmotion: 'happy',
          intensity: 0.6,
          confidence: 0.7,
          secondaryEmotions: ['nervous', 'excited'],
        },
        context: 'First date tonight',
        timestamp: new Date(),
      };

      const recommendations = await moodRecommendation.generateMoodBasedRecommendations(
        mixedContext,
        mockRestaurants,
        { latitude: 22.3193, longitude: 114.1694 }
      );

      expect(recommendations.length).toBeGreaterThan(0);
      
      // Should balance celebratory and comfortable elements
      const topRec = recommendations[0];
      expect(topRec.reasonsForRecommendation).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/romantic|date|special/i)
        ])
      );
    });
  });

  describe('Recommendation Quality Metrics', () => {
    it('should maintain high emotional alignment scores', async () => {
      const testEmotions: EmotionContext[] = [
        {
          emotion: { primaryEmotion: 'sad', intensity: 0.8, confidence: 0.9, secondaryEmotions: [] },
          context: 'Feeling down',
          timestamp: new Date(),
        },
        {
          emotion: { primaryEmotion: 'happy', intensity: 0.9, confidence: 0.85, secondaryEmotions: [] },
          context: 'Celebrating',
          timestamp: new Date(),
        },
        {
          emotion: { primaryEmotion: 'stressed', intensity: 0.7, confidence: 0.8, secondaryEmotions: [] },
          context: 'Work pressure',
          timestamp: new Date(),
        },
      ];

      for (const emotionContext of testEmotions) {
        const recommendations = await moodRecommendation.generateMoodBasedRecommendations(
          emotionContext,
          mockRestaurants,
          { latitude: 22.3193, longitude: 114.1694 }
        );

        expect(recommendations.length).toBeGreaterThan(0);
        
        // All recommendations should have reasonable emotional alignment
        recommendations.forEach(rec => {
          expect(rec.emotionalAlignment).toBeGreaterThan(0.5);
        });

        // Top recommendation should have high emotional alignment
        expect(recommendations[0].emotionalAlignment).toBeGreaterThan(0.7);
      }
    });

    it('should provide meaningful reasoning for recommendations', async () => {
      const emotionContext: EmotionContext = {
        emotion: {
          primaryEmotion: 'sad',
          intensity: 0.8,
          confidence: 0.9,
          secondaryEmotions: ['lonely'],
        },
        context: 'Need comfort food',
        timestamp: new Date(),
      };

      const recommendations = await moodRecommendation.generateMoodBasedRecommendations(
        emotionContext,
        mockRestaurants,
        { latitude: 22.3193, longitude: 114.1694 }
      );

      recommendations.forEach(rec => {
        expect(rec.reasonsForRecommendation).toBeDefined();
        expect(rec.reasonsForRecommendation.length).toBeGreaterThan(0);
        
        // Reasons should be relevant to the emotion
        const reasonsText = rec.reasonsForRecommendation.join(' ').toLowerCase();
        expect(reasonsText).toMatch(/comfort|cozy|warm|soothing/);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle unknown emotions gracefully', async () => {
      const unknownEmotion: EmotionState = {
        primaryEmotion: 'confused' as any,
        intensity: 0.5,
        confidence: 0.3,
        secondaryEmotions: [],
      };

      const cuisineMapping = emotionMapping.mapEmotionToCuisine(unknownEmotion);
      
      expect(cuisineMapping).toBeDefined();
      expect(cuisineMapping.recommendedCuisines.length).toBeGreaterThan(0);
      expect(cuisineMapping.reasoning).toContain('general');
    });

    it('should handle low confidence emotions', async () => {
      const lowConfidenceEmotion: EmotionState = {
        primaryEmotion: 'happy',
        intensity: 0.8,
        confidence: 0.2,
        secondaryEmotions: [],
      };

      const cuisineMapping = emotionMapping.mapEmotionToCuisine(lowConfidenceEmotion);
      
      expect(cuisineMapping.emotionalAlignment).toBeLessThan(0.7);
      expect(cuisineMapping.reasoning).toContain('uncertain');
    });

    it('should handle empty restaurant list', async () => {
      const emotionContext: EmotionContext = {
        emotion: {
          primaryEmotion: 'happy',
          intensity: 0.8,
          confidence: 0.9,
          secondaryEmotions: [],
        },
        context: 'Celebrating',
        timestamp: new Date(),
      };

      const recommendations = await moodRecommendation.generateMoodBasedRecommendations(
        emotionContext,
        [],
        { latitude: 22.3193, longitude: 114.1694 }
      );

      expect(recommendations).toEqual([]);
    });
  });
});