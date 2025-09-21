import { ContextualMoodProcessingService } from '../services/contextualMoodProcessing';
import { EmotionContextRequest } from '../../../shared/src/types/emotion.types';

describe('ContextualMoodProcessingService', () => {
  let service: ContextualMoodProcessingService;

  beforeEach(() => {
    service = new ContextualMoodProcessingService();
  });

  describe('processEmotionContext', () => {
    it('should extract emotions from text input', () => {
      const request: EmotionContextRequest = {
        textInput: 'I am feeling really excited about this new opportunity'
      };

      const result = service.processEmotionContext(request);

      expect(result.detectedEmotions).toBeDefined();
      expect(result.detectedEmotions.length).toBeGreaterThan(0);
      expect(result.detectedEmotions[0].emotion).toBe('excited');
      expect(result.detectedEmotions[0].confidence).toBeGreaterThan(0.5);
      expect(result.detectedEmotions[0].triggers).toContain('excited');
    });

    it('should identify work stress context', () => {
      const request: EmotionContextRequest = {
        textInput: 'Work has been overwhelming with all these deadlines and meetings'
      };

      const result = service.processEmotionContext(request);

      expect(result.contextualFactors).toContain('work_stress');
      expect(result.recommendationAdjustments.some(adj => 
        adj.factor === 'quick_service' && adj.adjustment === 'increase'
      )).toBe(true);
    });

    it('should identify relationship context', () => {
      const request: EmotionContextRequest = {
        textInput: 'Going on a date with my girlfriend tonight'
      };

      const result = service.processEmotionContext(request);

      expect(result.contextualFactors).toContain('relationship');
      expect(result.recommendationAdjustments.some(adj => 
        adj.factor === 'romantic_atmosphere' && adj.adjustment === 'increase'
      )).toBe(true);
    });

    it('should identify family context', () => {
      const request: EmotionContextRequest = {
        textInput: 'Having dinner with my parents and kids tonight'
      };

      const result = service.processEmotionContext(request);

      expect(result.contextualFactors).toContain('family');
      expect(result.recommendationAdjustments.some(adj => 
        adj.factor === 'family_friendly' && adj.adjustment === 'increase'
      )).toBe(true);
    });

    it('should process time of day context', () => {
      const request: EmotionContextRequest = {
        textInput: 'Looking for lunch options',
        additionalContext: {
          timeOfDay: 'lunch'
        }
      };

      const result = service.processEmotionContext(request);

      expect(result.contextualFactors).toContain('time_lunch');
      expect(result.recommendationAdjustments.some(adj => 
        adj.factor === 'quick_service' && adj.adjustment === 'increase'
      )).toBe(true);
    });

    it('should process location context', () => {
      const request: EmotionContextRequest = {
        textInput: 'Need food recommendations',
        additionalContext: {
          location: 'Central'
        }
      };

      const result = service.processEmotionContext(request);

      expect(result.contextualFactors).toContain('location_central');
    });

    it('should process recent events context', () => {
      const request: EmotionContextRequest = {
        textInput: 'Looking for comfort food',
        additionalContext: {
          recentEvents: ['had a fight with boss', 'work stress']
        }
      };

      const result = service.processEmotionContext(request);

      expect(result.contextualFactors).toContain('recent_work_stress');
    });

    it('should handle stressed emotions with appropriate adjustments', () => {
      const request: EmotionContextRequest = {
        textInput: 'I am so stressed and overwhelmed right now'
      };

      const result = service.processEmotionContext(request);

      expect(result.detectedEmotions[0].emotion).toBe('stressed');
      expect(result.recommendationAdjustments.some(adj => 
        adj.factor === 'calm_atmosphere' && adj.adjustment === 'increase'
      )).toBe(true);
      expect(result.recommendationAdjustments.some(adj => 
        adj.factor === 'spicy_food' && adj.adjustment === 'decrease'
      )).toBe(true);
    });

    it('should handle sad emotions with comfort recommendations', () => {
      const request: EmotionContextRequest = {
        textInput: 'Feeling really down and sad today'
      };

      const result = service.processEmotionContext(request);

      expect(result.detectedEmotions[0].emotion).toBe('sad');
      expect(result.recommendationAdjustments.some(adj => 
        adj.factor === 'comfort_food' && adj.adjustment === 'increase'
      )).toBe(true);
      expect(result.recommendationAdjustments.some(adj => 
        adj.factor === 'cozy_atmosphere' && adj.adjustment === 'increase'
      )).toBe(true);
    });

    it('should handle excited emotions with adventurous recommendations', () => {
      const request: EmotionContextRequest = {
        textInput: 'I am so excited and want to try something new'
      };

      const result = service.processEmotionContext(request);

      expect(result.detectedEmotions[0].emotion).toBe('excited');
      expect(result.recommendationAdjustments.some(adj => 
        adj.factor === 'adventurous_cuisine' && adj.adjustment === 'increase'
      )).toBe(true);
    });

    it('should handle tired emotions with simple food recommendations', () => {
      const request: EmotionContextRequest = {
        textInput: 'I am exhausted and just want something easy'
      };

      const result = service.processEmotionContext(request);

      expect(result.detectedEmotions[0].emotion).toBe('tired');
      expect(result.recommendationAdjustments.some(adj => 
        adj.factor === 'simple_food' && adj.adjustment === 'increase'
      )).toBe(true);
      expect(result.recommendationAdjustments.some(adj => 
        adj.factor === 'quick_service' && adj.adjustment === 'increase'
      )).toBe(true);
    });

    it('should handle lonely emotions with social recommendations', () => {
      const request: EmotionContextRequest = {
        textInput: 'Feeling lonely and isolated today'
      };

      const result = service.processEmotionContext(request);

      expect(result.detectedEmotions[0].emotion).toBe('lonely');
      expect(result.recommendationAdjustments.some(adj => 
        adj.factor === 'social_atmosphere' && adj.adjustment === 'increase'
      )).toBe(true);
    });

    it('should boost confidence with intensity modifiers', () => {
      const request1: EmotionContextRequest = {
        textInput: 'I am happy'
      };

      const request2: EmotionContextRequest = {
        textInput: 'I am extremely happy'
      };

      const result1 = service.processEmotionContext(request1);
      const result2 = service.processEmotionContext(request2);

      expect(result2.detectedEmotions[0].confidence).toBeGreaterThan(result1.detectedEmotions[0].confidence);
    });

    it('should calculate contextual confidence correctly', () => {
      const request: EmotionContextRequest = {
        textInput: 'I am happy and excited about work today',
        additionalContext: {
          timeOfDay: 'morning',
          location: 'office'
        }
      };

      const result = service.processEmotionContext(request);

      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should reduce confidence for conflicting emotions', () => {
      const request: EmotionContextRequest = {
        textInput: 'I am happy but also sad and angry'
      };

      const result = service.processEmotionContext(request);

      expect(result.confidence).toBeLessThan(0.8);
    });

    it('should handle financial context appropriately', () => {
      const request: EmotionContextRequest = {
        textInput: 'Looking for something cheap and affordable'
      };

      const result = service.processEmotionContext(request);

      expect(result.contextualFactors).toContain('financial');
      expect(result.recommendationAdjustments.some(adj => 
        adj.factor === 'budget_friendly' && adj.adjustment === 'increase'
      )).toBe(true);
    });

    it('should handle multiple contextual factors', () => {
      const request: EmotionContextRequest = {
        textInput: 'Stressed about work and need quick lunch with family'
      };

      const result = service.processEmotionContext(request);

      expect(result.contextualFactors).toContain('work_stress');
      expect(result.contextualFactors).toContain('family');
      expect(result.recommendationAdjustments.length).toBeGreaterThan(2);
    });

    it('should sort detected emotions by confidence', () => {
      const request: EmotionContextRequest = {
        textInput: 'I am happy and excited but also a bit tired'
      };

      const result = service.processEmotionContext(request);

      for (let i = 1; i < result.detectedEmotions.length; i++) {
        expect(result.detectedEmotions[i - 1].confidence)
          .toBeGreaterThanOrEqual(result.detectedEmotions[i].confidence);
      }
    });

    it('should remove duplicate contextual factors', () => {
      const request: EmotionContextRequest = {
        textInput: 'Work work work, so much work stress',
        additionalContext: {
          recentEvents: ['work meeting', 'work deadline']
        }
      };

      const result = service.processEmotionContext(request);

      const workFactors = result.contextualFactors.filter(factor => 
        factor.includes('work')
      );
      const uniqueWorkFactors = [...new Set(workFactors)];
      
      expect(workFactors.length).toBe(uniqueWorkFactors.length);
    });
  });

  describe('getContextualRecommendations', () => {
    it('should return recommendations for first date context', () => {
      const recommendations = service.getContextualRecommendations('first_date');

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(rec => rec.factor === 'quiet_atmosphere')).toBe(true);
      expect(recommendations.some(rec => rec.factor === 'moderate_pricing')).toBe(true);
    });

    it('should return recommendations for business lunch context', () => {
      const recommendations = service.getContextualRecommendations('business_lunch');

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(rec => rec.factor === 'professional_atmosphere')).toBe(true);
      expect(recommendations.some(rec => rec.factor === 'quick_service')).toBe(true);
    });

    it('should return recommendations for celebration context', () => {
      const recommendations = service.getContextualRecommendations('celebration');

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(rec => rec.factor === 'festive_atmosphere')).toBe(true);
      expect(recommendations.some(rec => rec.factor === 'special_cuisine')).toBe(true);
    });

    it('should return recommendations for comfort seeking context', () => {
      const recommendations = service.getContextualRecommendations('comfort_seeking');

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(rec => rec.factor === 'comfort_food')).toBe(true);
      expect(recommendations.some(rec => rec.factor === 'cozy_atmosphere')).toBe(true);
    });

    it('should return empty array for unknown context', () => {
      const recommendations = service.getContextualRecommendations('unknown_context');

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBe(0);
    });

    it('should include reasoning for each recommendation', () => {
      const recommendations = service.getContextualRecommendations('first_date');

      recommendations.forEach(rec => {
        expect(rec.reasoning).toBeDefined();
        expect(rec.reasoning.length).toBeGreaterThan(0);
      });
    });

    it('should include appropriate weights for recommendations', () => {
      const recommendations = service.getContextualRecommendations('business_lunch');

      recommendations.forEach(rec => {
        expect(rec.weight).toBeGreaterThan(0);
        expect(rec.weight).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('emotion detection patterns', () => {
    it('should detect multiple emotions in complex text', () => {
      const request: EmotionContextRequest = {
        textInput: 'I am excited about the promotion but also stressed about the new responsibilities'
      };

      const result = service.processEmotionContext(request);

      expect(result.detectedEmotions.length).toBeGreaterThan(1);
      expect(result.detectedEmotions.some(e => e.emotion === 'excited')).toBe(true);
      expect(result.detectedEmotions.some(e => e.emotion === 'stressed')).toBe(true);
    });

    it('should handle negation in text appropriately', () => {
      const request: EmotionContextRequest = {
        textInput: 'I am not happy about this situation'
      };

      const result = service.processEmotionContext(request);

      // Should still detect 'happy' but with lower confidence due to negation context
      expect(result.detectedEmotions.some(e => e.emotion === 'happy')).toBe(true);
    });

    it('should detect gratitude emotions', () => {
      const request: EmotionContextRequest = {
        textInput: 'I am so grateful and thankful for this opportunity'
      };

      const result = service.processEmotionContext(request);

      expect(result.detectedEmotions[0].emotion).toBe('grateful');
      expect(result.detectedEmotions[0].triggers).toContain('grateful');
    });

    it('should detect nostalgic emotions', () => {
      const request: EmotionContextRequest = {
        textInput: 'I remember when I used to eat this as a child'
      };

      const result = service.processEmotionContext(request);

      expect(result.detectedEmotions[0].emotion).toBe('nostalgic');
      expect(result.detectedEmotions[0].triggers).toContain('remember');
    });

    it('should detect confused emotions', () => {
      const request: EmotionContextRequest = {
        textInput: 'I am so confused and don\'t know what to choose'
      };

      const result = service.processEmotionContext(request);

      expect(result.detectedEmotions[0].emotion).toBe('confused');
      expect(result.detectedEmotions[0].triggers).toContain('confused');
    });
  });
});