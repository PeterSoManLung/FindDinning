import { EmotionAnalysisService } from '../services/emotionAnalysis';
import { EmotionAnalysisRequest } from '../../../shared/src/types/emotion.types';

describe('EmotionAnalysisService', () => {
  let service: EmotionAnalysisService;

  beforeEach(() => {
    service = new EmotionAnalysisService();
  });

  describe('analyzeEmotion', () => {
    it('should analyze explicit emotional state correctly', () => {
      const request: EmotionAnalysisRequest = {
        userId: 'user123',
        emotionalState: 'happy'
      };

      const result = service.analyzeEmotion(request);

      expect(result.primaryEmotion).toBe('happy');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.recommendedCuisines).toContain('Italian');
      expect(result.recommendedAtmosphere).toContain('lively');
      expect(result.reasoning).toContain('happy');
    });

    it('should analyze text input for emotional keywords', () => {
      const request: EmotionAnalysisRequest = {
        userId: 'user123',
        textInput: 'I am feeling really sad and down today'
      };

      const result = service.analyzeEmotion(request);

      expect(result.primaryEmotion).toBe('sad');
      expect(result.intensity).toBeGreaterThanOrEqual(3);
      expect(result.recommendedCuisines).toContain('Chinese');
      expect(result.recommendedAtmosphere).toContain('cozy');
    });

    it('should handle high intensity emotions', () => {
      const request: EmotionAnalysisRequest = {
        userId: 'user123',
        textInput: 'I am extremely excited and thrilled!!!'
      };

      const result = service.analyzeEmotion(request);

      expect(result.primaryEmotion).toBe('happy');
      expect(result.intensity).toBe(5);
      expect(result.confidence).toBeGreaterThanOrEqual(0.3);
    });

    it('should handle stressed emotions appropriately', () => {
      const request: EmotionAnalysisRequest = {
        userId: 'user123',
        emotionalState: 'stressed',
        textInput: 'Work has been overwhelming lately'
      };

      const result = service.analyzeEmotion(request);

      expect(result.primaryEmotion).toBe('stressed');
      expect(result.recommendedCuisines).toContain('Japanese');
      expect(result.recommendedAtmosphere).toContain('calm');
      expect(result.reasoning).toContain('calming');
    });

    it('should handle angry emotions with appropriate recommendations', () => {
      const request: EmotionAnalysisRequest = {
        userId: 'user123',
        emotionalState: 'angry',
        textInput: 'I am so frustrated and mad right now'
      };

      const result = service.analyzeEmotion(request);

      expect(result.primaryEmotion).toBe('angry');
      expect(result.recommendedCuisines).toContain('Spicy Sichuan');
      expect(result.recommendedAtmosphere).toContain('private');
    });

    it('should handle tired emotions with comfort recommendations', () => {
      const request: EmotionAnalysisRequest = {
        userId: 'user123',
        emotionalState: 'tired',
        textInput: 'I am exhausted and drained'
      };

      const result = service.analyzeEmotion(request);

      expect(result.primaryEmotion).toBe('tired');
      expect(result.recommendedCuisines).toContain('Comfort Food');
      expect(result.recommendedAtmosphere).toContain('comfortable');
    });

    it('should handle romantic context appropriately', () => {
      const request: EmotionAnalysisRequest = {
        userId: 'user123',
        emotionalState: 'romantic',
        context: {
          socialSetting: 'date'
        }
      };

      const result = service.analyzeEmotion(request);

      expect(result.primaryEmotion).toBe('romantic');
      expect(result.recommendedCuisines).toContain('French');
      expect(result.recommendedAtmosphere).toContain('romantic');
      expect(result.recommendedAtmosphere).toContain('intimate');
    });

    it('should handle nostalgic emotions with traditional recommendations', () => {
      const request: EmotionAnalysisRequest = {
        userId: 'user123',
        textInput: 'I miss the old days and childhood memories'
      };

      const result = service.analyzeEmotion(request);

      expect(result.primaryEmotion).toBe('nostalgic');
      expect(result.recommendedCuisines).toContain('Traditional Chinese');
      expect(result.recommendedAtmosphere).toContain('traditional');
    });

    it('should handle adventurous emotions with experimental recommendations', () => {
      const request: EmotionAnalysisRequest = {
        userId: 'user123',
        emotionalState: 'adventurous',
        textInput: 'I want to try something new and exciting'
      };

      const result = service.analyzeEmotion(request);

      expect(result.primaryEmotion).toBe('adventurous');
      expect(result.recommendedCuisines).toContain('Fusion');
      expect(result.recommendedAtmosphere).toContain('unique');
    });

    it('should handle neutral state with default recommendations', () => {
      const request: EmotionAnalysisRequest = {
        userId: 'user123',
        textInput: 'Just looking for something to eat'
      };

      const result = service.analyzeEmotion(request);

      expect(result.primaryEmotion).toBe('neutral');
      expect(result.recommendedCuisines).toContain('Chinese');
      expect(result.recommendedAtmosphere).toContain('casual');
    });

    it('should adjust recommendations based on social context', () => {
      const request: EmotionAnalysisRequest = {
        userId: 'user123',
        emotionalState: 'happy',
        context: {
          socialSetting: 'business'
        }
      };

      const result = service.analyzeEmotion(request);

      expect(result.recommendedAtmosphere).toContain('professional');
    });

    it('should handle conflicting emotions with reduced confidence', () => {
      const request: EmotionAnalysisRequest = {
        userId: 'user123',
        textInput: 'I am happy but also sad and confused'
      };

      const result = service.analyzeEmotion(request);

      expect(result.confidence).toBeLessThan(0.8);
      expect(result.secondaryEmotions.length).toBeGreaterThan(0);
    });

    it('should normalize emotional state input', () => {
      const request: EmotionAnalysisRequest = {
        userId: 'user123',
        emotionalState: 'feeling down'
      };

      const result = service.analyzeEmotion(request);

      expect(result.primaryEmotion).toBe('sad');
    });

    it('should calculate intensity based on text modifiers', () => {
      const request1: EmotionAnalysisRequest = {
        userId: 'user123',
        textInput: 'I am slightly happy'
      };

      const request2: EmotionAnalysisRequest = {
        userId: 'user123',
        textInput: 'I am extremely happy!!!'
      };

      const result1 = service.analyzeEmotion(request1);
      const result2 = service.analyzeEmotion(request2);

      expect(result2.intensity).toBeGreaterThan(result1.intensity);
    });

    it('should boost confidence with contextual information', () => {
      const requestWithoutContext: EmotionAnalysisRequest = {
        userId: 'user123',
        emotionalState: 'happy'
      };

      const requestWithContext: EmotionAnalysisRequest = {
        userId: 'user123',
        emotionalState: 'happy',
        context: {
          socialSetting: 'date',
          timeOfDay: 'dinner'
        }
      };

      const result1 = service.analyzeEmotion(requestWithoutContext);
      const result2 = service.analyzeEmotion(requestWithContext);

      expect(result2.confidence).toBeGreaterThanOrEqual(result1.confidence);
    });

    it('should include analysis date in results', () => {
      const request: EmotionAnalysisRequest = {
        userId: 'user123',
        emotionalState: 'happy'
      };

      const result = service.analyzeEmotion(request);

      expect(result.analysisDate).toBeInstanceOf(Date);
      expect(result.analysisDate.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('should handle empty text input gracefully', () => {
      const request: EmotionAnalysisRequest = {
        userId: 'user123',
        textInput: '',
        emotionalState: 'neutral'
      };

      const result = service.analyzeEmotion(request);

      expect(result.primaryEmotion).toBe('neutral');
      expect(result.intensity).toBe(3);
    });

    it('should provide appropriate reasoning for each emotion', () => {
      const emotions = ['happy', 'sad', 'stressed', 'tired', 'romantic'];
      
      emotions.forEach(emotion => {
        const request: EmotionAnalysisRequest = {
          userId: 'user123',
          emotionalState: emotion
        };

        const result = service.analyzeEmotion(request);
        
        expect(result.reasoning).toBeTruthy();
        expect(result.reasoning.length).toBeGreaterThan(10);
        expect(result.reasoning.toLowerCase()).toContain(emotion);
      });
    });
  });
});