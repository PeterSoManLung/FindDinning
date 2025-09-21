export interface ServiceConfig {
  name: string;
  url: string;
  healthPath: string;
  timeout: number;
}

export const SERVICES: Record<string, ServiceConfig> = {
  USER_SERVICE: {
    name: 'user-service',
    url: process.env.USER_SERVICE_URL || 'http://localhost:3001',
    healthPath: '/health',
    timeout: 5000
  },
  RESTAURANT_SERVICE: {
    name: 'restaurant-service',
    url: process.env.RESTAURANT_SERVICE_URL || 'http://localhost:3002',
    healthPath: '/health',
    timeout: 5000
  },
  RECOMMENDATION_ENGINE: {
    name: 'recommendation-engine',
    url: process.env.RECOMMENDATION_ENGINE_URL || 'http://localhost:3003',
    healthPath: '/health',
    timeout: 10000 // Higher timeout for ML operations
  },
  REVIEW_SERVICE: {
    name: 'review-service',
    url: process.env.REVIEW_SERVICE_URL || 'http://localhost:3004',
    healthPath: '/health',
    timeout: 5000
  },
  EMOTION_SERVICE: {
    name: 'emotion-service',
    url: process.env.EMOTION_SERVICE_URL || 'http://localhost:3005',
    healthPath: '/health',
    timeout: 8000 // Higher timeout for AI processing
  }
};

export const API_GATEWAY_CONFIG = {
  port: parseInt(process.env.PORT || '3000'),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100'), // 100 requests per window
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:19006'],
  logLevel: process.env.LOG_LEVEL || 'info'
};