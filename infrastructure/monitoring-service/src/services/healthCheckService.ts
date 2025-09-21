import axios from 'axios';
import { createLogger } from '../utils/logger';

export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  timestamp: string;
  checks: HealthCheck[];
  error?: string;
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  error?: string;
  details?: any;
}

export interface SystemHealth {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  services: ServiceHealth[];
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
  };
}

export class HealthCheckService {
  private logger: any;
  private serviceEndpoints: Map<string, string>;

  constructor() {
    this.logger = createLogger('health-check-service');
    this.serviceEndpoints = new Map([
      ['user-service', process.env.USER_SERVICE_URL || 'http://user-service:3001'],
      ['restaurant-service', process.env.RESTAURANT_SERVICE_URL || 'http://restaurant-service:3002'],
      ['recommendation-engine', process.env.RECOMMENDATION_ENGINE_URL || 'http://recommendation-engine:3003'],
      ['review-service', process.env.REVIEW_SERVICE_URL || 'http://review-service:3004'],
      ['emotion-service', process.env.EMOTION_SERVICE_URL || 'http://emotion-service:3005'],
      ['data-integration-service', process.env.DATA_INTEGRATION_SERVICE_URL || 'http://data-integration-service:3006']
    ]);
  }

  async getOverallSystemHealth(): Promise<SystemHealth> {
    const services: ServiceHealth[] = [];
    
    for (const [serviceName] of this.serviceEndpoints) {
      try {
        const serviceHealth = await this.checkServiceHealth(serviceName);
        services.push(serviceHealth);
      } catch (error: any) {
        services.push({
          service: serviceName,
          status: 'unhealthy',
          responseTime: 0,
          timestamp: new Date().toISOString(),
          checks: [],
          error: error.message
        });
      }
    }

    const summary = {
      total: services.length,
      healthy: services.filter(s => s.status === 'healthy').length,
      unhealthy: services.filter(s => s.status === 'unhealthy').length,
      degraded: services.filter(s => s.status === 'degraded').length
    };

    let overall: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (summary.unhealthy > 0) {
      overall = 'unhealthy';
    } else if (summary.degraded > 0) {
      overall = 'degraded';
    }

    return {
      overall,
      timestamp: new Date().toISOString(),
      services,
      summary
    };
  }

  async checkServiceHealth(serviceName: string): Promise<ServiceHealth> {
    const startTime = Date.now();
    const serviceUrl = this.serviceEndpoints.get(serviceName);
    
    if (!serviceUrl) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    try {
      const response = await axios.get(`${serviceUrl}/health`, {
        timeout: 5000,
        headers: {
          'User-Agent': 'monitoring-service/1.0'
        }
      });

      const responseTime = Date.now() - startTime;
      const healthData = response.data;

      return {
        service: serviceName,
        status: this.determineServiceStatus(healthData, responseTime),
        responseTime,
        timestamp: new Date().toISOString(),
        checks: healthData.checks || [],
        error: healthData.error
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      this.logger.warn(`Health check failed for ${serviceName}:`, {
        error: error.message,
        responseTime,
        serviceUrl
      });

      return {
        service: serviceName,
        status: 'unhealthy',
        responseTime,
        timestamp: new Date().toISOString(),
        checks: [],
        error: error.message
      };
    }
  }

  private determineServiceStatus(healthData: any, responseTime: number): 'healthy' | 'unhealthy' | 'degraded' {
    // If the service explicitly reports its status
    if (healthData.overall) {
      return healthData.overall;
    }

    // If response time is too high, consider it degraded
    if (responseTime > 3000) {
      return 'degraded';
    }

    // If there are unhealthy checks, consider the service unhealthy
    if (healthData.checks) {
      const unhealthyChecks = healthData.checks.filter((check: HealthCheck) => check.status === 'unhealthy');
      const degradedChecks = healthData.checks.filter((check: HealthCheck) => check.status === 'degraded');
      
      if (unhealthyChecks.length > 0) {
        return 'unhealthy';
      } else if (degradedChecks.length > 0) {
        return 'degraded';
      }
    }

    return 'healthy';
  }

  async checkDatabaseConnectivity(serviceName: string): Promise<HealthCheck> {
    const startTime = Date.now();
    const serviceUrl = this.serviceEndpoints.get(serviceName);
    
    try {
      await axios.get(`${serviceUrl}/health/database`, { timeout: 3000 });
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'database',
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        responseTime
      };
    } catch (error: any) {
      return {
        name: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  async checkExternalServiceConnectivity(serviceName: string): Promise<HealthCheck> {
    const startTime = Date.now();
    const serviceUrl = this.serviceEndpoints.get(serviceName);
    
    try {
      await axios.get(`${serviceUrl}/health/external`, { timeout: 5000 });
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'external_services',
        status: responseTime < 2000 ? 'healthy' : 'degraded',
        responseTime
      };
    } catch (error: any) {
      return {
        name: 'external_services',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }

  async checkCacheConnectivity(serviceName: string): Promise<HealthCheck> {
    const startTime = Date.now();
    const serviceUrl = this.serviceEndpoints.get(serviceName);
    
    try {
      await axios.get(`${serviceUrl}/health/cache`, { timeout: 2000 });
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'cache',
        status: responseTime < 500 ? 'healthy' : 'degraded',
        responseTime
      };
    } catch (error: any) {
      return {
        name: 'cache',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }
}