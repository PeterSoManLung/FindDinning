import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { API_GATEWAY_CONFIG } from './config/services';
import { addRequestId } from './middleware/requestValidation';
import { generalRateLimit } from './middleware/rateLimiting';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import healthRoutes from './routes/healthRoutes';
import apiRoutes from './routes/apiRoutes';
import integrationRoutes from './routes/integrationRoutes';

// Load environment variables
dotenv.config();

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
app.use(cors({
  origin: API_GATEWAY_CONFIG.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'x-request-id',
    'x-user-id'
  ],
  exposedHeaders: ['x-request-id', 'x-service']
}));

// Compression middleware
app.use(compression());

// Request parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined', {
  skip: (req) => req.path === '/health' // Skip health check logs
}));

// Request ID middleware (must be before rate limiting)
app.use(addRequestId);

// Rate limiting middleware
app.use(generalRateLimit);

// Health check routes (no rate limiting)
app.use('/', healthRoutes);

// API routes with proxying
app.use('/api', apiRoutes);

// Integration routes for cross-service operations
app.use('/api/integration', integrationRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

export default app;