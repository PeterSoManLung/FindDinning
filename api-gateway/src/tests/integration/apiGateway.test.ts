import request from 'supertest';
import app from '../../app';
import { ErrorCode } from 'shared/src/types/api.types';

describe('API Gateway Integration Tests', () => {
  describe('Health Check Endpoints', () => {
    it('should return gateway health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
          timestamp: expect.any(String),
          service: 'api-gateway',
          version: expect.any(String),
          dependencies: expect.any(Array),
          uptime: expect.any(Number)
        },
        meta: {
          requestId: expect.any(String),
          timestamp: expect.any(String)
        }
      });
    });

    it('should return individual service health', async () => {
      const response = await request(app)
        .get('/health/user')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          name: 'user-service',
          status: expect.stringMatching(/^(healthy|unhealthy)$/),
          lastChecked: expect.any(String)
        }
      });
    });

    it('should return 404 for unknown service health check', async () => {
      const response = await request(app)
        .get('/health/unknown')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'SERVICE_NOT_FOUND',
          message: 'Service unknown not found'
        }
      });
    });
  });

  describe('API Routing', () => {
    it('should proxy user service requests', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'Mock response from USER_SERVICE'
        }
      });
    });

    it('should proxy restaurant service requests', async () => {
      const response = await request(app)
        .get('/api/restaurants/123e4567-e89b-12d3-a456-426614174000')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'Mock response from RESTAURANT_SERVICE'
        }
      });
    });

    it('should proxy recommendation engine requests', async () => {
      const response = await request(app)
        .post('/api/recommendations/generate')
        .send({
          userId: '123e4567-e89b-12d3-a456-426614174000',
          emotionalState: 'happy'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'Mock response from RECOMMENDATION_ENGINE'
        }
      });
    });

    it('should proxy review service requests', async () => {
      const response = await request(app)
        .get('/api/reviews/restaurant/123e4567-e89b-12d3-a456-426614174000')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'Mock response from REVIEW_SERVICE'
        }
      });
    });

    it('should proxy emotion service requests', async () => {
      const response = await request(app)
        .post('/api/emotion/analyze')
        .send({
          text: 'I am feeling great today!'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          message: 'Mock response from EMOTION_SERVICE'
        }
      });
    });
  });

  describe('Request Validation', () => {
    it('should validate restaurant search parameters', async () => {
      const response = await request(app)
        .get('/api/restaurants/search')
        .query({
          latitude: 'invalid',
          longitude: 'invalid'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed'
        }
      });
    });

    it('should validate recommendation generation request', async () => {
      const response = await request(app)
        .post('/api/recommendations/generate')
        .send({
          userId: 'invalid-uuid'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed'
        }
      });
    });

    it('should validate review creation request', async () => {
      const response = await request(app)
        .post('/api/reviews')
        .send({
          restaurantId: '123e4567-e89b-12d3-a456-426614174000',
          rating: 6, // Invalid rating
          content: 'Too short' // Too short content
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed'
        }
      });
    });

    it('should validate emotion analysis request', async () => {
      const response = await request(app)
        .post('/api/emotion/analyze')
        .send({}) // Missing required fields
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed'
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown/endpoint')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: 'Route GET /api/unknown/endpoint not found'
        }
      });
    });

    it('should include request ID in all responses', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.body.meta.requestId).toBeDefined();
    });

    it('should preserve custom request ID', async () => {
      const customRequestId = 'custom-request-id';
      const response = await request(app)
        .get('/health')
        .set('x-request-id', customRequestId)
        .expect(200);

      expect(response.headers['x-request-id']).toBe(customRequestId);
      expect(response.body.meta.requestId).toBe(customRequestId);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(response.headers['x-xss-protection']).toBe('0');
    });

    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/users/profile')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
    });
  });
});