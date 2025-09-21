import request from 'supertest';
import app from '../../app';
import { ServiceClient } from '../../services/serviceClient';
import { TransactionManager } from '../../services/transactionManager';

// Mock the service client
jest.mock('../../services/serviceClient');

describe('Cross-Service Communication Integration Tests', () => {
  let mockServiceClient: jest.Mocked<ServiceClient>;

  beforeEach(() => {
    mockServiceClient = ServiceClient.getInstance() as jest.Mocked<ServiceClient>;
    mockServiceClient.post = jest.fn();
    mockServiceClient.get = jest.fn();
    mockServiceClient.put = jest.fn();
    mockServiceClient.delete = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/integration/users/register-complete', () => {
    it('should complete user registration across all services', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        preferences: {
          cuisineTypes: ['chinese', 'italian'],
          dietaryRestrictions: ['vegetarian']
        }
      };

      // Mock successful responses from all services
      mockServiceClient.post
        .mockResolvedValueOnce({
          data: { data: { id: 'user-123', ...userData } },
          status: 201,
          headers: {}
        })
        .mockResolvedValueOnce({
          data: { data: { success: true } },
          status: 201,
          headers: {}
        })
        .mockResolvedValueOnce({
          data: { data: { success: true } },
          status: 201,
          headers: {}
        });

      const response = await request(app)
        .post('/api/integration/users/register-complete')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: expect.objectContaining({
            id: 'user-123',
            email: userData.email
          }),
          message: 'User registration completed successfully across all services'
        }
      });

      expect(mockServiceClient.post).toHaveBeenCalledTimes(3);
    });

    it('should handle registration failure with compensation', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };

      // Mock first service success, second service failure
      mockServiceClient.post
        .mockResolvedValueOnce({
          data: { data: { id: 'user-123' } },
          status: 201,
          headers: {}
        })
        .mockRejectedValueOnce(new Error('Recommendation service unavailable'));

      mockServiceClient.delete
        .mockResolvedValueOnce({
          data: { data: { success: true } },
          status: 200,
          headers: {}
        });

      const response = await request(app)
        .post('/api/integration/users/register-complete')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'REGISTRATION_FAILED',
          message: 'User registration failed'
        }
      });
    });

    it('should validate request data', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: '123', // Too short
        name: 'T' // Too short
      };

      const response = await request(app)
        .post('/api/integration/users/register-complete')
        .send(invalidData)
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

  describe('POST /api/integration/restaurants/create-complete', () => {
    it('should create restaurant across all services', async () => {
      const restaurantData = {
        name: 'Test Restaurant',
        location: {
          address: '123 Test Street',
          latitude: 22.3193,
          longitude: 114.1694,
          district: 'Central'
        },
        cuisineType: ['chinese'],
        priceRange: 2,
        operatingHours: {
          monday: { open: '09:00', close: '22:00' }
        }
      };

      mockServiceClient.post
        .mockResolvedValueOnce({
          data: { data: { id: 'restaurant-123', ...restaurantData } },
          status: 201,
          headers: {}
        })
        .mockResolvedValueOnce({
          data: { data: { success: true } },
          status: 201,
          headers: {}
        })
        .mockResolvedValueOnce({
          data: { data: { success: true } },
          status: 201,
          headers: {}
        });

      const response = await request(app)
        .post('/api/integration/restaurants/create-complete')
        .send(restaurantData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          restaurant: expect.objectContaining({
            id: 'restaurant-123',
            name: restaurantData.name
          }),
          message: 'Restaurant created successfully across all services'
        }
      });
    });
  });

  describe('POST /api/integration/reviews/submit-complete', () => {
    it('should submit review and update restaurant metrics', async () => {
      const reviewData = {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        restaurantId: '123e4567-e89b-12d3-a456-426614174001',
        rating: 4,
        content: 'Great food and service!',
        visitDate: '2023-09-20T10:00:00.000Z'
      };

      const mockReview = { id: 'review-123', ...reviewData };
      const mockMetrics = {
        averageRating: 4.2,
        reviewCount: 15,
        negativeScore: 0.1,
        previousAverageRating: 4.1,
        previousReviewCount: 14,
        previousNegativeScore: 0.12
      };

      mockServiceClient.post
        .mockResolvedValueOnce({
          data: { data: mockReview },
          status: 201,
          headers: {}
        });

      mockServiceClient.get
        .mockResolvedValueOnce({
          data: { data: mockMetrics },
          status: 200,
          headers: {}
        });

      // Mock consistency enforcement calls
      mockServiceClient.put
        .mockResolvedValueOnce({
          data: { data: { success: true } },
          status: 200,
          headers: {}
        })
        .mockResolvedValueOnce({
          data: { data: { success: true } },
          status: 200,
          headers: {}
        });

      const response = await request(app)
        .post('/api/integration/reviews/submit-complete')
        .send(reviewData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          review: expect.objectContaining({
            id: 'review-123'
          }),
          updatedMetrics: expect.objectContaining({
            averageRating: 4.2,
            reviewCount: 15
          }),
          message: 'Review submitted and restaurant metrics updated successfully'
        }
      });
    });
  });

  describe('GET /api/integration/consistency/rules', () => {
    it('should return all consistency rules', async () => {
      const response = await request(app)
        .get('/api/integration/consistency/rules')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          rules: expect.arrayContaining([
            expect.objectContaining({
              name: 'user-profile-consistency',
              description: expect.any(String),
              services: expect.any(Array)
            })
          ])
        }
      });
    });
  });

  describe('GET /api/integration/transactions/active', () => {
    it('should return active transactions', async () => {
      const response = await request(app)
        .get('/api/integration/transactions/active')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          activeTransactions: expect.any(Array)
        }
      });
    });
  });

  describe('GET /api/integration/consistency/check/:ruleName', () => {
    it('should check consistency for a specific rule', async () => {
      const response = await request(app)
        .get('/api/integration/consistency/check/user-profile-consistency')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          consistent: expect.any(Boolean),
          issues: expect.any(Array)
        }
      });
    });

    it('should handle unknown consistency rule', async () => {
      const response = await request(app)
        .get('/api/integration/consistency/check/unknown-rule')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('Consistency rule not found')
        }
      });
    });
  });
});