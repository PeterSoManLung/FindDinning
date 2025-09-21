import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import AWS from 'aws-sdk';
import { createLogger } from './utils/logger';
import { MonitoringController } from './controllers/monitoringController';
import { HealthCheckService } from './services/healthCheckService';
import { MetricsService } from './services/metricsService';

const app = express();
const port = process.env.PORT || 3000;
const logger = createLogger('monitoring-service');

// Configure AWS
AWS.config.update({
  region: process.env.AWS_REGION || 'ap-southeast-1'
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Services
const healthCheckService = new HealthCheckService();
const metricsService = new MetricsService();
const monitoringController = new MonitoringController(healthCheckService, metricsService);

// Routes
app.get('/health', monitoringController.getSystemHealth.bind(monitoringController));
app.get('/metrics', monitoringController.getMetrics.bind(monitoringController));
app.get('/dashboard', monitoringController.getDashboard.bind(monitoringController));
app.post('/alerts/test', monitoringController.testAlert.bind(monitoringController));

// System health endpoints for individual services
app.get('/health/user-service', monitoringController.getUserServiceHealth.bind(monitoringController));
app.get('/health/restaurant-service', monitoringController.getRestaurantServiceHealth.bind(monitoringController));
app.get('/health/recommendation-engine', monitoringController.getRecommendationEngineHealth.bind(monitoringController));
app.get('/health/review-service', monitoringController.getReviewServiceHealth.bind(monitoringController));
app.get('/health/emotion-service', monitoringController.getEmotionServiceHealth.bind(monitoringController));
app.get('/health/data-integration-service', monitoringController.getDataIntegrationServiceHealth.bind(monitoringController));

// Metrics endpoints
app.get('/metrics/recommendation-accuracy', monitoringController.getRecommendationAccuracyMetrics.bind(monitoringController));
app.get('/metrics/negative-feedback-analysis', monitoringController.getNegativeFeedbackAnalysisMetrics.bind(monitoringController));
app.get('/metrics/user-engagement', monitoringController.getUserEngagementMetrics.bind(monitoringController));
app.get('/metrics/data-sync', monitoringController.getDataSyncMetrics.bind(monitoringController));

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// Start server
app.listen(port, () => {
  logger.info(`Monitoring service started on port ${port}`);
  
  // Start periodic health checks
  setInterval(async () => {
    try {
      await monitoringController.performPeriodicHealthChecks();
    } catch (error) {
      logger.error('Periodic health check failed:', error);
    }
  }, 60000); // Every minute

  // Start periodic metrics collection
  setInterval(async () => {
    try {
      await monitoringController.collectPeriodicMetrics();
    } catch (error) {
      logger.error('Periodic metrics collection failed:', error);
    }
  }, 300000); // Every 5 minutes
});

export default app;