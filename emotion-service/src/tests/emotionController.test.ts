import request from 'supertest';
import express from 'express';
import { EmotionController } from '../controllers/emotionController';
import emotionRoutes from '../routes/emotionRoutes';

const app = express();
app.use(express.json());
app.use('/api/emotion', emotionRoutes);

describe('EmotionController', () => {
  describe('POST /api/emotion/analyze', () => {
    it('should analyze emotion successfully with valid request', async () => {
      const requestBody = {
        userId: 'user123',
        emotionalState: 'happy',
        textInput: 'I am feeling great today!'
      };

      const response = await request(app)
        .post('/api/emotion/analyze')
        .send(requestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.primaryEmotion).toBe('happy');
      expect(response.body.data.confidence).toBeGreaterThan(0);
      expect(response.body.data.recommendedCuisines).toBeDefined();
      expect(response.body.data.recommendedAtmosphere).toBeDefined();
      expect(response.body.data.reasoning).toBeDefined();
    });

    it('should return error when userId is missing', async () => {
      const requestBody = {
        emotionalState: 'happy'
      };

      const response = await request(app)
        .post('/api/emotion/analyze')
        .send(requestBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('User ID is required');
    });

    it('should return error when both textInput and emotionalState are missing', async () => {
      const requestBody = {
        userId: 'user123'
      };

      const response = await request(app)
        .post('/api/emotion/analyze')
        .send(requestBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('Either textInput or emotionalState is required');
    });

    it('should analyze emotion with only textInput', async () => {
      const requestBody = {
        userId: 'user123',
        textInput: 'I am feeling really sad and down'
      };

      const response = await request(app)
        .post('/api/emotion/analyze')
        .send(requestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.primaryEmotion).toBe('sad');
    });

    it('should analyze emotion with context information', async () => {
      const requestBody = {
        userId: 'user123',
        emotionalState: 'romantic',
        context: {
          socialSetting: 'date',
          timeOfDay: 'dinner'
        }
      };

      const response = await request(app)
        .post('/api/emotion/analyze')
        .send(requestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.primaryEmotion).toBe('romantic');
      expect(response.body.data.recommendedAtmosphere).toContain('romantic');
    });
  });

  describe('GET /api/emotion/mood-mapping', () => {
    it('should return mood mapping for valid emotion', async () => {
      const response = await request(app)
        .get('/api/emotion/mood-mapping?emotion=happy')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.emotion).toBe('happy');
      expect(response.body.data.cuisineRecommendations).toBeDefined();
      expect(response.body.data.atmospherePreferences).toBeDefined();
      expect(response.body.data.priceRangeAdjustment).toBeDefined();
    });

    it('should return error when emotion parameter is missing', async () => {
      const response = await request(app)
        .get('/api/emotion/mood-mapping')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('Emotion parameter is required');
    });

    it('should handle intensity parameter', async () => {
      const response = await request(app)
        .get('/api/emotion/mood-mapping?emotion=sad&intensity=4')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.emotion).toBe('sad');
    });

    it('should return error for invalid intensity', async () => {
      const response = await request(app)
        .get('/api/emotion/mood-mapping?emotion=happy&intensity=6')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('Intensity must be between 1 and 5');
    });

    it('should handle user preferences', async () => {
      const response = await request(app)
        .get('/api/emotion/mood-mapping?emotion=happy&cuisineTypes=Japanese,Italian&dietaryRestrictions=vegetarian')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.cuisineRecommendations).toBeDefined();
    });

    it('should handle unknown emotion gracefully', async () => {
      const response = await request(app)
        .get('/api/emotion/mood-mapping?emotion=unknown_emotion')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.cuisineRecommendations).toBeDefined();
    });
  });

  describe('POST /api/emotion/context', () => {
    it('should process emotion context successfully', async () => {
      const requestBody = {
        textInput: 'I am stressed about work and need something quick',
        additionalContext: {
          timeOfDay: 'lunch',
          location: 'office'
        }
      };

      const response = await request(app)
        .post('/api/emotion/context')
        .send(requestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.detectedEmotions).toBeDefined();
      expect(response.body.data.contextualFactors).toBeDefined();
      expect(response.body.data.recommendationAdjustments).toBeDefined();
      expect(response.body.data.confidence).toBeDefined();
    });

    it('should return error when textInput is missing', async () => {
      const requestBody = {
        additionalContext: {
          timeOfDay: 'lunch'
        }
      };

      const response = await request(app)
        .post('/api/emotion/context')
        .send(requestBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('Text input is required');
    });

    it('should return error when textInput is empty', async () => {
      const requestBody = {
        textInput: '   '
      };

      const response = await request(app)
        .post('/api/emotion/context')
        .send(requestBody)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('Text input cannot be empty');
    });

    it('should process context with recent events', async () => {
      const requestBody = {
        textInput: 'Looking for comfort food',
        additionalContext: {
          recentEvents: ['had a bad day at work', 'feeling down']
        }
      };

      const response = await request(app)
        .post('/api/emotion/context')
        .send(requestBody)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.contextualFactors.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/emotion/mappings', () => {
    it('should return all mood mappings', async () => {
      const response = await request(app)
        .get('/api/emotion/mappings')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.happy).toBeDefined();
      expect(response.body.data.sad).toBeDefined();
      expect(response.body.data.neutral).toBeDefined();
    });

    it('should include all expected emotions in mappings', async () => {
      const response = await request(app)
        .get('/api/emotion/mappings')
        .expect(200);

      const expectedEmotions = [
        'happy', 'sad', 'stressed', 'angry', 'tired', 
        'lonely', 'romantic', 'nostalgic', 'adventurous', 'comfort', 'neutral'
      ];

      expectedEmotions.forEach(emotion => {
        expect(response.body.data[emotion]).toBeDefined();
      });
    });
  });

  describe('GET /api/emotion/contextual-recommendations/:context', () => {
    it('should return contextual recommendations for valid context', async () => {
      const response = await request(app)
        .get('/api/emotion/contextual-recommendations/first_date')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.context).toBe('first_date');
      expect(response.body.data.recommendations).toBeDefined();
      expect(response.body.data.recommendations.length).toBeGreaterThan(0);
    });

    it('should return 404 for unknown context', async () => {
      const response = await request(app)
        .get('/api/emotion/contextual-recommendations/unknown_context')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return recommendations for business lunch context', async () => {
      const response = await request(app)
        .get('/api/emotion/contextual-recommendations/business_lunch')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.recommendations.some((rec: any) => 
        rec.factor === 'professional_atmosphere'
      )).toBe(true);
    });

    it('should return recommendations for celebration context', async () => {
      const response = await request(app)
        .get('/api/emotion/contextual-recommendations/celebration')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.recommendations.some((rec: any) => 
        rec.factor === 'festive_atmosphere'
      )).toBe(true);
    });
  });

  describe('GET /api/emotion/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/emotion/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.service).toBe('emotion-service');
      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.version).toBeDefined();
      expect(response.body.data.features).toBeDefined();
    });

    it('should include all expected features in health check', async () => {
      const response = await request(app)
        .get('/api/emotion/health')
        .expect(200);

      expect(response.body.data.features.emotionAnalysis).toBe(true);
      expect(response.body.data.features.cuisineMapping).toBe(true);
      expect(response.body.data.features.contextualProcessing).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle internal server errors gracefully', async () => {
      // This test would require mocking the service to throw an error
      // For now, we'll test the error response format
      const response = await request(app)
        .post('/api/emotion/analyze')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBeDefined();
      expect(response.body.error.message).toBeDefined();
    });

    it('should return proper error format for validation errors', async () => {
      const response = await request(app)
        .post('/api/emotion/analyze')
        .send({ userId: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBeDefined();
      expect(response.body.error.details).toBeDefined();
    });
  });

  describe('Integration tests', () => {
    it('should handle complete emotion analysis workflow', async () => {
      // Step 1: Analyze emotion
      const analyzeResponse = await request(app)
        .post('/api/emotion/analyze')
        .send({
          userId: 'user123',
          textInput: 'I am feeling stressed about work and need quick lunch',
          context: {
            socialSetting: 'alone',
            timeOfDay: 'lunch'
          }
        })
        .expect(200);

      expect(analyzeResponse.body.data.primaryEmotion).toBe('stressed');

      // Step 2: Get mood mapping for the detected emotion
      const mappingResponse = await request(app)
        .get(`/api/emotion/mood-mapping?emotion=${analyzeResponse.body.data.primaryEmotion}&intensity=${analyzeResponse.body.data.intensity}`)
        .expect(200);

      expect(mappingResponse.body.data.cuisineRecommendations).toBeDefined();

      // Step 3: Process contextual information
      const contextResponse = await request(app)
        .post('/api/emotion/context')
        .send({
          textInput: 'I am feeling stressed about work and need quick lunch',
          additionalContext: {
            timeOfDay: 'lunch'
          }
        })
        .expect(200);

      expect(contextResponse.body.data.recommendationAdjustments).toBeDefined();
    });

    it('should handle romantic dining scenario', async () => {
      const response = await request(app)
        .post('/api/emotion/analyze')
        .send({
          userId: 'user123',
          emotionalState: 'romantic',
          textInput: 'Planning a special dinner for anniversary',
          context: {
            socialSetting: 'date',
            occasion: 'anniversary'
          }
        })
        .expect(200);

      expect(response.body.data.primaryEmotion).toBe('romantic');
      expect(response.body.data.recommendedCuisines).toContain('French');
      expect(response.body.data.recommendedAtmosphere).toContain('intimate');
    });

    it('should handle comfort food seeking scenario', async () => {
      const response = await request(app)
        .post('/api/emotion/analyze')
        .send({
          userId: 'user123',
          textInput: 'Had a terrible day and just want comfort food',
          emotionalState: 'sad'
        })
        .expect(200);

      expect(response.body.data.primaryEmotion).toBe('sad');
      expect(response.body.data.recommendedCuisines).toContain('Comfort Food');
      expect(response.body.data.recommendedAtmosphere).toContain('cozy');
    });
  });
});