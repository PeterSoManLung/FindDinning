import { Request, Response } from 'express';
import { HealthCheckService } from '../services/healthCheckService';
import { MetricsService } from '../services/metricsService';
import { createLogger } from '../utils/logger';

export class MonitoringController {
  private healthCheckService: HealthCheckService;
  private metricsService: MetricsService;
  private logger: any;

  constructor(healthCheckService: HealthCheckService, metricsService: MetricsService) {
    this.healthCheckService = healthCheckService;
    this.metricsService = metricsService;
    this.logger = createLogger('monitoring-controller');
  }

  async getSystemHealth(req: Request, res: Response) {
    try {
      const health = await this.healthCheckService.getOverallSystemHealth();
      res.status(health.overall === 'healthy' ? 200 : 503).json(health);
    } catch (error: any) {
      this.logger.error('Failed to get system health:', error);
      res.status(500).json({ error: 'Failed to get system health' });
    }
  }

  async getMetrics(req: Request, res: Response) {
    try {
      const metrics = await this.metricsService.getAllMetrics();
      res.json(metrics);
    } catch (error: any) {
      this.logger.error('Failed to get metrics:', error);
      res.status(500).json({ error: 'Failed to get metrics' });
    }
  }

  async getDashboard(req: Request, res: Response) {
    try {
      const dashboard = await this.metricsService.getDashboardData();
      res.json(dashboard);
    } catch (error: any) {
      this.logger.error('Failed to get dashboard data:', error);
      res.status(500).json({ error: 'Failed to get dashboard data' });
    }
  }

  async testAlert(req: Request, res: Response) {
    try {
      const { severity, message } = req.body;
      await this.metricsService.sendTestAlert(severity || 'low', message || 'Test alert from monitoring service');
      res.json({ success: true, message: 'Test alert sent' });
    } catch (error: any) {
      this.logger.error('Failed to send test alert:', error);
      res.status(500).json({ error: 'Failed to send test alert' });
    }
  }

  // Individual service health checks
  async getUserServiceHealth(req: Request, res: Response) {
    try {
      const health = await this.healthCheckService.checkServiceHealth('user-service');
      res.status(health.status === 'healthy' ? 200 : 503).json(health);
    } catch (error: any) {
      this.logger.error('Failed to get user service health:', error);
      res.status(500).json({ error: 'Failed to get user service health' });
    }
  }

  async getRestaurantServiceHealth(req: Request, res: Response) {
    try {
      const health = await this.healthCheckService.checkServiceHealth('restaurant-service');
      res.status(health.status === 'healthy' ? 200 : 503).json(health);
    } catch (error: any) {
      this.logger.error('Failed to get restaurant service health:', error);
      res.status(500).json({ error: 'Failed to get restaurant service health' });
    }
  }

  async getRecommendationEngineHealth(req: Request, res: Response) {
    try {
      const health = await this.healthCheckService.checkServiceHealth('recommendation-engine');
      res.status(health.status === 'healthy' ? 200 : 503).json(health);
    } catch (error: any) {
      this.logger.error('Failed to get recommendation engine health:', error);
      res.status(500).json({ error: 'Failed to get recommendation engine health' });
    }
  }

  async getReviewServiceHealth(req: Request, res: Response) {
    try {
      const health = await this.healthCheckService.checkServiceHealth('review-service');
      res.status(health.status === 'healthy' ? 200 : 503).json(health);
    } catch (error: any) {
      this.logger.error('Failed to get review service health:', error);
      res.status(500).json({ error: 'Failed to get review service health' });
    }
  }

  async getEmotionServiceHealth(req: Request, res: Response) {
    try {
      const health = await this.healthCheckService.checkServiceHealth('emotion-service');
      res.status(health.status === 'healthy' ? 200 : 503).json(health);
    } catch (error: any) {
      this.logger.error('Failed to get emotion service health:', error);
      res.status(500).json({ error: 'Failed to get emotion service health' });
    }
  }

  async getDataIntegrationServiceHealth(req: Request, res: Response) {
    try {
      const health = await this.healthCheckService.checkServiceHealth('data-integration-service');
      res.status(health.status === 'healthy' ? 200 : 503).json(health);
    } catch (error: any) {
      this.logger.error('Failed to get data integration service health:', error);
      res.status(500).json({ error: 'Failed to get data integration service health' });
    }
  }

  // Metrics endpoints
  async getRecommendationAccuracyMetrics(req: Request, res: Response) {
    try {
      const metrics = await this.metricsService.getRecommendationAccuracyMetrics();
      res.json(metrics);
    } catch (error: any) {
      this.logger.error('Failed to get recommendation accuracy metrics:', error);
      res.status(500).json({ error: 'Failed to get recommendation accuracy metrics' });
    }
  }

  async getNegativeFeedbackAnalysisMetrics(req: Request, res: Response) {
    try {
      const metrics = await this.metricsService.getNegativeFeedbackAnalysisMetrics();
      res.json(metrics);
    } catch (error: any) {
      this.logger.error('Failed to get negative feedback analysis metrics:', error);
      res.status(500).json({ error: 'Failed to get negative feedback analysis metrics' });
    }
  }

  async getUserEngagementMetrics(req: Request, res: Response) {
    try {
      const metrics = await this.metricsService.getUserEngagementMetrics();
      res.json(metrics);
    } catch (error: any) {
      this.logger.error('Failed to get user engagement metrics:', error);
      res.status(500).json({ error: 'Failed to get user engagement metrics' });
    }
  }

  async getDataSyncMetrics(req: Request, res: Response) {
    try {
      const metrics = await this.metricsService.getDataSyncMetrics();
      res.json(metrics);
    } catch (error: any) {
      this.logger.error('Failed to get data sync metrics:', error);
      res.status(500).json({ error: 'Failed to get data sync metrics' });
    }
  }

  // Periodic operations
  async performPeriodicHealthChecks() {
    try {
      const services = [
        'user-service',
        'restaurant-service', 
        'recommendation-engine',
        'review-service',
        'emotion-service',
        'data-integration-service'
      ];

      for (const service of services) {
        const health = await this.healthCheckService.checkServiceHealth(service);
        if (health.status === 'unhealthy') {
          await this.metricsService.sendAlert('high', `Service ${service} is unhealthy`, health);
        }
      }

      this.logger.info('Periodic health checks completed');
    } catch (error) {
      this.logger.error('Periodic health checks failed:', error);
    }
  }

  async collectPeriodicMetrics() {
    try {
      // Collect and publish system metrics
      await this.metricsService.collectSystemMetrics();
      this.logger.info('Periodic metrics collection completed');
    } catch (error) {
      this.logger.error('Periodic metrics collection failed:', error);
    }
  }
}