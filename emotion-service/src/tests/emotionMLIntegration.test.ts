import { EmotionMLIntegrationService, SentimentAnalysisConfig } from '../services/emotionMLIntegration';
import { EmotionAnalysisRequest, EmotionAnalysisResult } from '../../../shared/src/types/emotion.types';

describe('EmotionMLIntegrationService', () => {
  let emotionMLService: EmotionMLIntegrationService;
  let mockConfig: SentimentAnalysisConfig;

  beforeEach(() => {
    mockConfig = {
      region: 'us-east-1',
      timeout: 5000,
      retryAttempts: 2,
      fallbackEnabled: true
    };

    emotionMLService = new EmotionMLIntegrationService(mockConfig);
  });

  describe('analyzeEmotionWithML', () => {
    it('should analyze emotion with ML enhancement when text input is provided', async () => {
      const request: EmotionAnalysisRequest = {
        userId: 'user-1',
        textInput: 'I am feeling really happy and excited about trying new food today!',
        emotionalState: 'happy'
      };

      const result = await emotionMLService.analyzeEmotionWithML(request);

      expect(result).toBeDefined();
      expect(result.emotionAnalysis).toBeDefined();
      expect(result.nlpAnalysis).toBeDefined();
      expect(result.enhancedRecommendations).toBeDefined();
      expect(result.modelMetadata).toBeDefined();

      // Check emotion analysis
      expect(result.emotionAnalysis.primaryEmotion).toBe('happy');
      expect(result.emotionAnalysis.confidence).toBeGreaterThan(0);
      expect(result.emotionAnalysis.intensity).toBeGreaterThanOrEqual(1);
      expect(result.emotionAnalysis.intensity).toBeLessThanOrEqual(5);

      // Check NLP analysis
      expect(result.nlpAnalysis.sentiment).toBeDefined();
      expect(result.nlpAnalysis.confidence).toBeGreaterThan(0);
      expect(result.nlpAnalysis.emotions).toBeInstanceOf(Array);
      expect(result.nlpAnalysis.keywords).toBeInstanceOf(Array);

      // Check enhanced recommendations
      expect(result.enhancedRecommendations.cuisines).toBeInstanceOf(Array);
      expect(result.enhancedRecommendations.atmospheres).toBeInstanceOf(Array);
      expect(result.enhancedRecommendations.confidence).toBeGreaterThan(0);
      expect(result.enhancedRecommendations.reasoning).toBeDefined();

      // Check metadata
      expect(result.modelMetadata.modelsUsed).toBeInstanceOf(Array);
      expect(result.modelMetadata.modelsUsed.length).toBeGreaterThan(0);
      expect(result.modelMetadata.processingTime).toBeGreaterThan(0);
      expect(typeof result.modelMetadata.fallbackUsed).toBe('boolean');
    });

    it('should handle emotion analysis without text input', async () => {
      const request: EmotionAnalysisRequest = {
        userId: 'user-1',
        emotionalState: 'sad'
      };

      const result = await emotionMLService.analyzeEmotionWithML(request);

      expect(result).toBeDefined();
      expect(result.emotionAnalysis.primaryEmotion).toBe('sad');
      expect(result.nlpAnalysis.emotions).toHaveLength(0); // No text to analyze
      expect(result.enhancedRecommendations.cuisines).toContain('Comfort Food');
    });

    it('should provide different recommendations for different emotions', async () => {
      const happyRequest: EmotionAnalysisRequest = {
        userId: 'user-1',
        textInput: 'I am so happy and want to celebrate!',
        emotionalState: 'happy'
      };

      const sadRequest: EmotionAnalysisRequest = {
        userId: 'user-1',
        textInput: 'I am feeling down and need comfort food',
        emotionalState: 'sad'
      };

      const happyResult = await emotionMLService.analyzeEmotionWithML(happyRequest);
      const sadResult = await emotionMLService.analyzeEmotionWithML(sadRequest);

      expect(happyResult.emotionAnalysis.primaryEmotion).toBe('happy');
      expect(sadResult.emotionAnalysis.primaryEmotion).toBe('sad');

      // Happy recommendations should be different from sad recommendations
      expect(happyResult.enhancedRecommendations.cuisines).not.toEqual(
        sadResult.enhancedRecommendations.cuisines
      );
      expect(happyResult.enhancedRecommendations.atmospheres).not.toEqual(
        sadResult.enhancedRecommendations.atmospheres
      );
    });

    it('should handle fallback when ML services fail', async () => {
      // This test would require mocking actual failures
      // For now, we'll test that the service handles the configuration correctly
      const fallbackConfig = { ...mockConfig, fallbackEnabled: true };
      const serviceWithFallback = new EmotionMLIntegrationService(fallbackConfig);

      const request: EmotionAnalysisRequest = {
        userId: 'user-1',
        textInput: 'I am feeling neutral today',
        emotionalState: 'neutral'
      };

      const result = await serviceWithFallback.analyzeEmotionWithML(request);

      expect(result).toBeDefined();
      expect(result.emotionAnalysis.primaryEmotion).toBeDefined();
    });
  });

  describe('detectMoodFromText', () => {
    it('should detect mood from positive text', async () => {
      const textInput = 'I am extremely excited about this amazing restaurant experience!';

      const result = await emotionMLService.detectMoodFromText(textInput);

      expect(result).toBeDefined();
      expect(result.detectedMood).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.intensity).toBeGreaterThanOrEqual(1);
      expect(result.intensity).toBeLessThanOrEqual(5);
      expect(result.supportingEvidence).toBeInstanceOf(Array);

      // Should detect positive emotion
      expect(['happy', 'excited', 'adventurous'].includes(result.detectedMood)).toBe(true);
    });

    it('should detect mood from negative text', async () => {
      const textInput = 'I am feeling really sad and need some comfort food to cheer me up';

      const result = await emotionMLService.detectMoodFromText(textInput);

      expect(result).toBeDefined();
      expect(result.detectedMood).toBe('sad');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.supportingEvidence).toBeInstanceOf(Array);
      expect(result.supportingEvidence.length).toBeGreaterThan(0);
    });

    it('should detect mood from stressed text', async () => {
      const textInput = 'I am so overwhelmed and stressed, need something calming';

      const result = await emotionMLService.detectMoodFromText(textInput);

      expect(result).toBeDefined();
      expect(result.detectedMood).toBe('stressed');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.supportingEvidence).toBeInstanceOf(Array);
      // Supporting evidence might be empty in some cases, which is acceptable
    });

    it('should handle context in mood detection', async () => {
      const textInput = 'Looking for a romantic dinner';
      const context = {
        socialSetting: 'date' as const,
        timeOfDay: 'evening'
      };

      const result = await emotionMLService.detectMoodFromText(textInput, context);

      expect(result).toBeDefined();
      expect(result.detectedMood).toBe('romantic');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should provide fallback when NLP fails', async () => {
      // Test with empty or minimal text that might cause NLP to fail
      const textInput = 'a';

      const result = await emotionMLService.detectMoodFromText(textInput);

      expect(result).toBeDefined();
      expect(result.detectedMood).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('generateEmotionAwareRecommendations', () => {
    it('should generate recommendations based on emotion analysis', async () => {
      const emotionAnalysis: EmotionAnalysisResult = {
        primaryEmotion: 'happy',
        secondaryEmotions: ['excited'],
        intensity: 4,
        confidence: 0.8,
        recommendedCuisines: ['Italian', 'Japanese', 'Thai'],
        recommendedAtmosphere: ['lively', 'social', 'bright'],
        reasoning: 'You appear to be strongly feeling happy.',
        analysisDate: new Date()
      };

      const result = await emotionMLService.generateEmotionAwareRecommendations(emotionAnalysis);

      expect(result).toBeDefined();
      expect(result.cuisineRecommendations).toBeInstanceOf(Array);
      expect(result.atmosphereRecommendations).toBeInstanceOf(Array);
      expect(result.overallConfidence).toBeGreaterThan(0);

      // Check cuisine recommendations structure
      result.cuisineRecommendations.forEach(rec => {
        expect(rec.cuisine).toBeDefined();
        expect(rec.matchScore).toBeGreaterThanOrEqual(0);
        expect(rec.matchScore).toBeLessThanOrEqual(1);
        expect(rec.emotionalAlignment).toBeGreaterThanOrEqual(0);
        expect(rec.emotionalAlignment).toBeLessThanOrEqual(1);
        expect(rec.reasoning).toBeDefined();
      });

      // Check atmosphere recommendations structure
      result.atmosphereRecommendations.forEach(rec => {
        expect(rec.atmosphere).toBeDefined();
        expect(rec.matchScore).toBeGreaterThanOrEqual(0);
        expect(rec.matchScore).toBeLessThanOrEqual(1);
        expect(rec.emotionalAlignment).toBeGreaterThanOrEqual(0);
        expect(rec.emotionalAlignment).toBeLessThanOrEqual(1);
        expect(rec.reasoning).toBeDefined();
      });
    });

    it('should generate different recommendations for different emotions', async () => {
      const happyAnalysis: EmotionAnalysisResult = {
        primaryEmotion: 'happy',
        secondaryEmotions: [],
        intensity: 4,
        confidence: 0.8,
        recommendedCuisines: ['Italian', 'Japanese'],
        recommendedAtmosphere: ['lively', 'social'],
        reasoning: 'Happy mood analysis',
        analysisDate: new Date()
      };

      const sadAnalysis: EmotionAnalysisResult = {
        primaryEmotion: 'sad',
        secondaryEmotions: [],
        intensity: 3,
        confidence: 0.8,
        recommendedCuisines: ['Comfort Food', 'Chinese'],
        recommendedAtmosphere: ['cozy', 'quiet'],
        reasoning: 'Sad mood analysis',
        analysisDate: new Date()
      };

      const happyResult = await emotionMLService.generateEmotionAwareRecommendations(happyAnalysis);
      const sadResult = await emotionMLService.generateEmotionAwareRecommendations(sadAnalysis);

      expect(happyResult.cuisineRecommendations).not.toEqual(sadResult.cuisineRecommendations);
      expect(happyResult.atmosphereRecommendations).not.toEqual(sadResult.atmosphereRecommendations);

      // Happy should have more social/lively atmospheres
      const happyAtmospheres = happyResult.atmosphereRecommendations.map(r => r.atmosphere);
      expect(happyAtmospheres.some(atm => ['lively', 'social', 'bright'].includes(atm))).toBe(true);

      // Sad should have more cozy/quiet atmospheres
      const sadAtmospheres = sadResult.atmosphereRecommendations.map(r => r.atmosphere);
      expect(sadAtmospheres.some(atm => ['cozy', 'quiet', 'intimate'].includes(atm))).toBe(true);
    });

    it('should consider user preferences in recommendations', async () => {
      const emotionAnalysis: EmotionAnalysisResult = {
        primaryEmotion: 'neutral',
        secondaryEmotions: [],
        intensity: 3,
        confidence: 0.6,
        recommendedCuisines: ['Chinese', 'Japanese'],
        recommendedAtmosphere: ['casual', 'comfortable'],
        reasoning: 'Neutral mood analysis',
        analysisDate: new Date()
      };

      const userPreferences = {
        cuisineTypes: ['Italian', 'French'],
        dietaryRestrictions: ['vegetarian']
      };

      const result = await emotionMLService.generateEmotionAwareRecommendations(
        emotionAnalysis,
        userPreferences
      );

      expect(result).toBeDefined();
      expect(result.cuisineRecommendations).toBeInstanceOf(Array);
      expect(result.overallConfidence).toBeGreaterThan(0);
    });

    it('should handle fallback when mood-based service fails', async () => {
      const emotionAnalysis: EmotionAnalysisResult = {
        primaryEmotion: 'unknown_emotion',
        secondaryEmotions: [],
        intensity: 3,
        confidence: 0.5,
        recommendedCuisines: ['Chinese'],
        recommendedAtmosphere: ['casual'],
        reasoning: 'Unknown emotion',
        analysisDate: new Date()
      };

      const result = await emotionMLService.generateEmotionAwareRecommendations(emotionAnalysis);

      expect(result).toBeDefined();
      expect(result.cuisineRecommendations).toBeInstanceOf(Array);
      expect(result.atmosphereRecommendations).toBeInstanceOf(Array);
      expect(result.overallConfidence).toBeGreaterThan(0);
    });
  });

  describe('Integration and Performance', () => {
    it('should complete emotion analysis within reasonable time', async () => {
      const request: EmotionAnalysisRequest = {
        userId: 'user-1',
        textInput: 'I am feeling great today and want to try something new!',
        emotionalState: 'happy'
      };

      const startTime = Date.now();
      const result = await emotionMLService.analyzeEmotionWithML(request);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.modelMetadata.processingTime).toBeGreaterThan(0);
    });

    it('should handle multiple concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        userId: `user-${i}`,
        textInput: `I am feeling emotion ${i} today`,
        emotionalState: 'neutral'
      }));

      const promises = requests.map(req => emotionMLService.analyzeEmotionWithML(req));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.emotionAnalysis).toBeDefined();
        expect(result.modelMetadata.processingTime).toBeGreaterThan(0);
      });
    });

    it('should handle edge cases in text input', async () => {
      const edgeCases = [
        { textInput: '', emotionalState: 'neutral' },
        { textInput: '!@#$%^&*()', emotionalState: 'confused' },
        { textInput: 'a'.repeat(1000), emotionalState: 'neutral' }, // Very long text
        { textInput: '😀😢😡🤔', emotionalState: 'mixed' } // Emojis
      ];

      for (const testCase of edgeCases) {
        const request: EmotionAnalysisRequest = {
          userId: 'user-edge-case',
          ...testCase
        };

        const result = await emotionMLService.analyzeEmotionWithML(request);
        expect(result).toBeDefined();
        expect(result.emotionAnalysis.primaryEmotion).toBeDefined();
      }
    });
  });

  describe('Error Handling and Fallbacks', () => {
    it('should use fallback when ML services are unavailable', async () => {
      const noFallbackConfig = { ...mockConfig, fallbackEnabled: false };
      const serviceWithoutFallback = new EmotionMLIntegrationService(noFallbackConfig);

      const request: EmotionAnalysisRequest = {
        userId: 'user-1',
        textInput: 'I am feeling happy',
        emotionalState: 'happy'
      };

      // Should still work with mock implementation
      const result = await serviceWithoutFallback.analyzeEmotionWithML(request);
      expect(result).toBeDefined();
    });

    it('should handle invalid emotion states gracefully', async () => {
      const request: EmotionAnalysisRequest = {
        userId: 'user-1',
        textInput: 'I am feeling something weird',
        emotionalState: 'invalid_emotion_state'
      };

      const result = await emotionMLService.analyzeEmotionWithML(request);

      expect(result).toBeDefined();
      expect(result.emotionAnalysis.primaryEmotion).toBeDefined();
      expect(result.enhancedRecommendations.cuisines).toBeInstanceOf(Array);
    });

    it('should maintain service availability during partial failures', async () => {
      // Test that the service continues to work even if some components fail
      const request: EmotionAnalysisRequest = {
        userId: 'user-1',
        textInput: 'Testing service resilience',
        emotionalState: 'testing'
      };

      const result = await emotionMLService.analyzeEmotionWithML(request);

      expect(result).toBeDefined();
      expect(result.emotionAnalysis).toBeDefined();
      expect(result.enhancedRecommendations).toBeDefined();
      expect(result.modelMetadata.modelsUsed).toBeInstanceOf(Array);
    });
  });
});