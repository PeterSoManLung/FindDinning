import { Router, Request, Response } from 'express';
import { ProxyService } from '../services/proxyService';
import { SERVICES } from '../config/services';
import { HealthCheckResponse, DependencyStatus, ApiResponse } from 'shared/src/types/api.types';

const router = Router();
const proxyService = ProxyService.getInstance();

// API Gateway health check
router.get('/health', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const serviceHealthChecks = await proxyService.checkAllServicesHealth();
    const dependencies: DependencyStatus[] = Object.entries(SERVICES).map(([key, config]) => ({
      name: config.name,
      status: serviceHealthChecks[key] ? 'healthy' : 'unhealthy',
      lastChecked: new Date().toISOString(),
      error: serviceHealthChecks[key] ? undefined : 'Service unreachable'
    }));

    const allHealthy = dependencies.every(dep => dep.status === 'healthy');
    const someHealthy = dependencies.some(dep => dep.status === 'healthy');
    
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
    if (allHealthy) {
      overallStatus = 'healthy';
    } else if (someHealthy) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    const healthResponse: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: 'api-gateway',
      version: process.env.npm_package_version || '1.0.0',
      dependencies,
      uptime: process.uptime()
    };

    const apiResponse: ApiResponse<HealthCheckResponse> = {
      success: true,
      data: healthResponse,
      meta: {
        requestId: req.headers['x-request-id'] as string,
        timestamp: new Date().toISOString()
      }
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    res.status(statusCode).json(apiResponse);
  } catch (error) {
    const healthResponse: HealthCheckResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'api-gateway',
      version: process.env.npm_package_version || '1.0.0',
      dependencies: [],
      uptime: process.uptime()
    };

    const apiResponse: ApiResponse<HealthCheckResponse> = {
      success: false,
      data: healthResponse,
      error: {
        code: 'HEALTH_CHECK_ERROR',
        message: 'Failed to perform health check',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string
      }
    };

    res.status(503).json(apiResponse);
  }
});

// Individual service health check
router.get('/health/:service', async (req: Request, res: Response) => {
  const serviceName = req.params.service.toUpperCase() + '_SERVICE';
  const serviceKey = serviceName === 'RECOMMENDATION_SERVICE' ? 'RECOMMENDATION_ENGINE' : serviceName;
  
  if (!SERVICES[serviceKey]) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'SERVICE_NOT_FOUND',
        message: `Service ${req.params.service} not found`,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string
      }
    });
  }

  try {
    const isHealthy = await proxyService.checkServiceHealth(serviceKey);
    const config = SERVICES[serviceKey];
    
    const dependency: DependencyStatus = {
      name: config.name,
      status: isHealthy ? 'healthy' : 'unhealthy',
      lastChecked: new Date().toISOString(),
      error: isHealthy ? undefined : 'Service unreachable'
    };

    const apiResponse: ApiResponse<DependencyStatus> = {
      success: true,
      data: dependency,
      meta: {
        requestId: req.headers['x-request-id'] as string,
        timestamp: new Date().toISOString()
      }
    };

    res.status(isHealthy ? 200 : 503).json(apiResponse);
  } catch (error) {
    res.status(503).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_ERROR',
        message: `Failed to check health of ${req.params.service}`,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string
      }
    });
  }
});

export default router;