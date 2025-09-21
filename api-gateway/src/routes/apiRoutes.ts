import { Router } from 'express';
import { ProxyService } from '../services/proxyService';
import { validateRequest, commonSchemas } from '../middleware/requestValidation';
import { authRateLimit, recommendationRateLimit, dataRateLimit } from '../middleware/rateLimiting';
import Joi from 'joi';

const router = Router();
const proxyService = ProxyService.getInstance();

// User Service Routes
router.use('/users/register', authRateLimit);
router.use('/users/login', authRateLimit);
router.use('/users*', proxyService.getProxy('USER_SERVICE'));

// Restaurant Service Routes
router.get('/restaurants/search', 
  validateRequest({
    query: Joi.object({
      q: Joi.string().min(1).max(100).optional(),
      cuisineType: Joi.string().optional(),
      priceRange: Joi.string().pattern(/^\d+-\d+$/).optional(),
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().valid('asc', 'desc').default('asc'),
      latitude: Joi.number().min(-90).max(90).optional(),
      longitude: Joi.number().min(-180).max(180).optional(),
      radius: Joi.number().min(0.1).max(50).default(5).optional()
    })
  }),
  dataRateLimit,
  proxyService.getProxy('RESTAURANT_SERVICE')
);

router.get('/restaurants/nearby',
  validateRequest({
    query: commonSchemas.location
  }),
  dataRateLimit,
  proxyService.getProxy('RESTAURANT_SERVICE')
);

router.get('/restaurants/:id',
  validateRequest({
    params: commonSchemas.id
  }),
  proxyService.getProxy('RESTAURANT_SERVICE')
);

router.use('/restaurants*', proxyService.getProxy('RESTAURANT_SERVICE'));

// Recommendation Engine Routes
router.post('/recommendations/generate',
  validateRequest({
    body: Joi.object({
      userId: Joi.string().uuid().required(),
      emotionalState: Joi.string().optional(),
      location: Joi.object({
        latitude: Joi.number().min(-90).max(90).required(),
        longitude: Joi.number().min(-180).max(180).required()
      }).optional(),
      preferences: Joi.object({
        cuisineTypes: Joi.array().items(Joi.string()).optional(),
        priceRange: Joi.array().items(Joi.number().min(1).max(4)).length(2).optional(),
        dietaryRestrictions: Joi.array().items(Joi.string()).optional()
      }).optional()
    })
  }),
  recommendationRateLimit,
  proxyService.getProxy('RECOMMENDATION_ENGINE')
);

router.post('/recommendations/feedback',
  validateRequest({
    body: Joi.object({
      recommendationId: Joi.string().uuid().required(),
      restaurantId: Joi.string().uuid().required(),
      feedback: Joi.string().valid('liked', 'disliked', 'visited', 'not_interested').required(),
      rating: Joi.number().min(1).max(5).optional()
    })
  }),
  proxyService.getProxy('RECOMMENDATION_ENGINE')
);

router.use('/recommendations*', recommendationRateLimit, proxyService.getProxy('RECOMMENDATION_ENGINE'));

// Review Service Routes
router.post('/reviews',
  validateRequest({
    body: Joi.object({
      restaurantId: Joi.string().uuid().required(),
      rating: Joi.number().min(1).max(5).required(),
      content: Joi.string().min(10).max(2000).required(),
      visitDate: Joi.date().iso().max('now').required(),
      photos: Joi.array().items(Joi.string().uri()).max(5).optional()
    })
  }),
  proxyService.getProxy('REVIEW_SERVICE')
);

router.get('/reviews/restaurant/:id',
  validateRequest({
    params: commonSchemas.id,
    query: Joi.object({
      ...commonSchemas.pagination.describe(),
      sortBy: Joi.string().valid('date', 'rating', 'helpfulness', 'authenticity').default('date'),
      filterBy: Joi.string().valid('positive', 'negative', 'verified').optional()
    })
  }),
  proxyService.getProxy('REVIEW_SERVICE')
);

router.post('/reviews/analyze-negative',
  validateRequest({
    body: Joi.object({
      restaurantId: Joi.string().uuid().required(),
      timeframe: Joi.string().valid('week', 'month', 'quarter', 'year').default('month')
    })
  }),
  dataRateLimit,
  proxyService.getProxy('REVIEW_SERVICE')
);

router.use('/reviews*', proxyService.getProxy('REVIEW_SERVICE'));

// Emotion Service Routes
router.post('/emotion/analyze',
  validateRequest({
    body: Joi.object({
      text: Joi.string().min(1).max(500).optional(),
      emotionalState: Joi.string().valid(
        'happy', 'sad', 'stressed', 'excited', 'tired', 'celebratory', 
        'comfort_seeking', 'adventurous', 'nostalgic', 'neutral'
      ).optional(),
      context: Joi.object({
        timeOfDay: Joi.string().valid('morning', 'afternoon', 'evening', 'late_night').optional(),
        weather: Joi.string().optional(),
        occasion: Joi.string().optional(),
        companionType: Joi.string().valid('alone', 'partner', 'family', 'friends', 'colleagues').optional()
      }).optional()
    }).or('text', 'emotionalState')
  }),
  recommendationRateLimit,
  proxyService.getProxy('EMOTION_SERVICE')
);

router.get('/emotion/mood-mapping',
  proxyService.getProxy('EMOTION_SERVICE')
);

router.use('/emotion*', recommendationRateLimit, proxyService.getProxy('EMOTION_SERVICE'));

export default router;