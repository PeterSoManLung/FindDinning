import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { API_GATEWAY_CONFIG } from '../config/services';
import { ApiResponse, ErrorResponse, ErrorCode } from 'shared/src/types/api.types';

// Create custom rate limit handler
const rateLimitHandler = (req: Request, res: Response): void => {
  const requestId = req.headers['x-request-id'] as string;
  
  const errorResponse: ErrorResponse = {
    code: ErrorCode.RATE_LIMIT_EXCEEDED,
    message: 'Too many requests, please try again later',
    timestamp: new Date().toISOString(),
    requestId
  };

  const apiResponse: ApiResponse = {
    success: false,
    error: errorResponse
  };

  res.status(429).json(apiResponse);
};

// General rate limiting for all endpoints
export const generalRateLimit = rateLimit({
  windowMs: API_GATEWAY_CONFIG.rateLimitWindowMs,
  max: API_GATEWAY_CONFIG.rateLimitMax,
  message: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    // Use user ID if authenticated, otherwise use IP
    const userId = req.headers['x-user-id'] as string;
    return userId || req.ip || 'unknown';
  }
});

// Stricter rate limiting for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => req.ip || 'unknown'
});

// More lenient rate limiting for recommendation endpoints (ML operations)
export const recommendationRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    const userId = req.headers['x-user-id'] as string;
    return userId || req.ip || 'unknown';
  }
});

// Rate limiting for data-intensive operations
export const dataRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false
});