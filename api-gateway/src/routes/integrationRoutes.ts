import { Router, Request, Response, NextFunction } from 'express';
import { ServiceClient } from '../services/serviceClient';
import { TransactionManager, TransactionStep } from '../services/transactionManager';
import { DataConsistencyManager } from '../services/dataConsistency';
import { validateRequest } from '../middleware/requestValidation';
import { ApiResponse } from 'shared/src/types/api.types';
import Joi from 'joi';

const router = Router();
const serviceClient = ServiceClient.getInstance();
const transactionManager = TransactionManager.getInstance();
const dataConsistencyManager = DataConsistencyManager.getInstance();

// Cross-service user registration workflow
router.post('/users/register-complete',
  validateRequest({
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(8).required(),
      name: Joi.string().min(2).max(100).required(),
      preferences: Joi.object({
        cuisineTypes: Joi.array().items(Joi.string()).optional(),
        dietaryRestrictions: Joi.array().items(Joi.string()).optional(),
        priceRange: Joi.array().items(Joi.number().min(1).max(4)).length(2).optional()
      }).optional()
    })
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestId = req.headers['x-request-id'] as string;
      const { email, password, name, preferences } = req.body;

      // Define transaction steps for complete user registration
      const steps: TransactionStep[] = [
        // 1. Create user in user service
        {
          serviceKey: 'USER_SERVICE',
          operation: 'create',
          path: '/users',
          data: { email, password, name, preferences },
          compensationPath: '/users/{userId}' // Will be filled after creation
        },
        // 2. Initialize user profile in recommendation engine
        {
          serviceKey: 'RECOMMENDATION_ENGINE',
          operation: 'create',
          path: '/users/{userId}/profile',
          data: { preferences: preferences || {} },
          compensationPath: '/users/{userId}/profile'
        },
        // 3. Create user profile in review service
        {
          serviceKey: 'REVIEW_SERVICE',
          operation: 'create',
          path: '/users/{userId}/profile',
          data: { name, email },
          compensationPath: '/users/{userId}/profile'
        }
      ];

      const result = await transactionManager.executeTransaction(steps, requestId);

      if (result.success) {
        const userData = result.results[0]?.data?.data;
        
        const response: ApiResponse = {
          success: true,
          data: {
            user: userData,
            message: 'User registration completed successfully across all services'
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString()
          }
        };

        res.status(201).json(response);
      } else {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'REGISTRATION_FAILED',
            message: 'User registration failed',
            details: {
              errors: result.errors.map(e => e.message),
              compensated: result.compensated
            },
            timestamp: new Date().toISOString(),
            requestId
          }
        };

        res.status(400).json(response);
      }
    } catch (error) {
      next(error);
    }
  }
);

// Cross-service restaurant creation workflow
router.post('/restaurants/create-complete',
  validateRequest({
    body: Joi.object({
      name: Joi.string().min(2).max(200).required(),
      location: Joi.object({
        address: Joi.string().required(),
        latitude: Joi.number().min(-90).max(90).required(),
        longitude: Joi.number().min(-180).max(180).required(),
        district: Joi.string().required()
      }).required(),
      cuisineType: Joi.array().items(Joi.string()).min(1).required(),
      priceRange: Joi.number().min(1).max(4).required(),
      operatingHours: Joi.object().required(),
      menuHighlights: Joi.array().items(Joi.object()).optional(),
      specialFeatures: Joi.array().items(Joi.string()).optional()
    })
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestId = req.headers['x-request-id'] as string;
      const restaurantData = req.body;

      const steps: TransactionStep[] = [
        // 1. Create restaurant in restaurant service
        {
          serviceKey: 'RESTAURANT_SERVICE',
          operation: 'create',
          path: '/restaurants',
          data: restaurantData,
          compensationPath: '/restaurants/{restaurantId}'
        },
        // 2. Initialize restaurant in recommendation engine
        {
          serviceKey: 'RECOMMENDATION_ENGINE',
          operation: 'create',
          path: '/restaurants/{restaurantId}',
          data: {
            name: restaurantData.name,
            cuisineType: restaurantData.cuisineType,
            location: restaurantData.location,
            priceRange: restaurantData.priceRange,
            rating: 0,
            negativeScore: 0
          },
          compensationPath: '/restaurants/{restaurantId}'
        },
        // 3. Initialize restaurant in review service
        {
          serviceKey: 'REVIEW_SERVICE',
          operation: 'create',
          path: '/restaurants/{restaurantId}',
          data: {
            name: restaurantData.name,
            location: restaurantData.location,
            cuisineType: restaurantData.cuisineType
          },
          compensationPath: '/restaurants/{restaurantId}'
        }
      ];

      const result = await transactionManager.executeTransaction(steps, requestId);

      if (result.success) {
        const restaurantResponse = result.results[0]?.data?.data;
        
        const response: ApiResponse = {
          success: true,
          data: {
            restaurant: restaurantResponse,
            message: 'Restaurant created successfully across all services'
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString()
          }
        };

        res.status(201).json(response);
      } else {
        const response: ApiResponse = {
          success: false,
          error: {
            code: 'RESTAURANT_CREATION_FAILED',
            message: 'Restaurant creation failed',
            details: {
              errors: result.errors.map(e => e.message),
              compensated: result.compensated
            },
            timestamp: new Date().toISOString(),
            requestId
          }
        };

        res.status(400).json(response);
      }
    } catch (error) {
      next(error);
    }
  }
);

// Cross-service review submission with aggregation
router.post('/reviews/submit-complete',
  validateRequest({
    body: Joi.object({
      userId: Joi.string().uuid().required(),
      restaurantId: Joi.string().uuid().required(),
      rating: Joi.number().min(1).max(5).required(),
      content: Joi.string().min(10).max(2000).required(),
      visitDate: Joi.date().iso().max('now').required(),
      photos: Joi.array().items(Joi.string().uri()).max(5).optional()
    })
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestId = req.headers['x-request-id'] as string;
      const reviewData = req.body;

      // First, create the review
      const reviewResponse = await serviceClient.post(
        'REVIEW_SERVICE',
        '/reviews',
        reviewData,
        requestId
      );

      const review = reviewResponse.data.data;

      // Then, get updated restaurant metrics
      const metricsResponse = await serviceClient.get(
        'REVIEW_SERVICE',
        `/restaurants/${reviewData.restaurantId}/metrics`,
        requestId
      );

      const metrics = metricsResponse.data.data;

      // Enforce consistency across services
      await dataConsistencyManager.enforceConsistency(
        'review-aggregation-consistency',
        {
          restaurantId: reviewData.restaurantId,
          newAverageRating: metrics.averageRating,
          newReviewCount: metrics.reviewCount,
          newNegativeScore: metrics.negativeScore,
          previousAverageRating: metrics.previousAverageRating,
          previousReviewCount: metrics.previousReviewCount,
          previousNegativeScore: metrics.previousNegativeScore
        },
        requestId
      );

      const response: ApiResponse = {
        success: true,
        data: {
          review,
          updatedMetrics: metrics,
          message: 'Review submitted and restaurant metrics updated successfully'
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// Data consistency check endpoint
router.get('/consistency/check/:ruleName',
  validateRequest({
    params: Joi.object({
      ruleName: Joi.string().required()
    })
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestId = req.headers['x-request-id'] as string;
      const { ruleName } = req.params;

      const consistencyCheck = await dataConsistencyManager.checkConsistency(
        ruleName,
        requestId
      );

      const response: ApiResponse = {
        success: true,
        data: consistencyCheck,
        meta: {
          requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// Get all consistency rules
router.get('/consistency/rules',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestId = req.headers['x-request-id'] as string;
      const rules = dataConsistencyManager.getConsistencyRules();

      const response: ApiResponse = {
        success: true,
        data: {
          rules: rules.map(rule => ({
            name: rule.name,
            description: rule.description,
            services: rule.services
          }))
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// Get active transactions (for monitoring)
router.get('/transactions/active',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestId = req.headers['x-request-id'] as string;
      const activeTransactions = transactionManager.getActiveTransactions();

      const response: ApiResponse = {
        success: true,
        data: {
          activeTransactions: Array.from(activeTransactions.entries()).map(([id, steps]) => ({
            transactionId: id,
            stepCount: steps.length,
            services: [...new Set(steps.map(step => step.serviceKey))]
          }))
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;