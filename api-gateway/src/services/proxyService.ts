import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { Request, Response, NextFunction } from 'express';
import { SERVICES, ServiceConfig } from '../config/services';
import { ApiError } from '../middleware/errorHandler';
import { ErrorCode, HttpStatusCode } from 'shared/src/types/api.types';

export class ProxyService {
  private static instance: ProxyService;
  private serviceProxies: Map<string, any> = new Map();

  private constructor() {
    this.initializeProxies();
  }

  public static getInstance(): ProxyService {
    if (!ProxyService.instance) {
      ProxyService.instance = new ProxyService();
    }
    return ProxyService.instance;
  }

  private initializeProxies(): void {
    Object.entries(SERVICES).forEach(([key, config]) => {
      const proxyOptions: Options = {
        target: config.url,
        changeOrigin: true,
        timeout: config.timeout,
        pathRewrite: (path: string, req: Request) => {
          // Remove the service prefix from the path
          const servicePath = this.getServicePath(key);
          return path.replace(servicePath, '');
        },
        onProxyReq: (proxyReq, req: Request) => {
          // Forward request ID and user context
          const requestId = req.headers['x-request-id'] as string;
          const userId = req.headers['x-user-id'] as string;
          
          if (requestId) {
            proxyReq.setHeader('x-request-id', requestId);
          }
          if (userId) {
            proxyReq.setHeader('x-user-id', userId);
          }

          // Forward original IP
          proxyReq.setHeader('x-forwarded-for', req.ip);
          proxyReq.setHeader('x-original-host', req.get('host') || '');
        },
        onError: (err: Error, req: Request, res: Response) => {
          console.error(`Proxy error for ${config.name}:`, err.message);
          
          const apiError = new ApiError(
            HttpStatusCode.SERVICE_UNAVAILABLE,
            ErrorCode.EXTERNAL_SERVICE_ERROR,
            `Service ${config.name} is currently unavailable`,
            { service: config.name, error: err.message }
          );

          // Use the error handler middleware
          const next: NextFunction = (error?: any) => {
            if (error) throw error;
          };
          next(apiError);
        },
        onProxyRes: (proxyRes, req: Request, res: Response) => {
          // Add service identification header
          res.setHeader('x-service', config.name);
          
          // Log response for monitoring
          console.log(`${req.method} ${req.path} -> ${config.name} [${proxyRes.statusCode}]`);
        }
      };

      this.serviceProxies.set(key, createProxyMiddleware(proxyOptions));
    });
  }

  private getServicePath(serviceKey: string): string {
    const pathMap: Record<string, string> = {
      USER_SERVICE: '/api/users',
      RESTAURANT_SERVICE: '/api/restaurants',
      RECOMMENDATION_ENGINE: '/api/recommendations',
      REVIEW_SERVICE: '/api/reviews',
      EMOTION_SERVICE: '/api/emotion'
    };
    return pathMap[serviceKey] || '/api';
  }

  public getProxy(serviceKey: string): any {
    const proxy = this.serviceProxies.get(serviceKey);
    if (!proxy) {
      throw new ApiError(
        HttpStatusCode.INTERNAL_SERVER_ERROR,
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        `Proxy not found for service: ${serviceKey}`
      );
    }
    return proxy;
  }

  public async checkServiceHealth(serviceKey: string): Promise<boolean> {
    const config = SERVICES[serviceKey];
    if (!config) return false;

    try {
      const response = await fetch(`${config.url}${config.healthPath}`, {
        method: 'GET',
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      console.error(`Health check failed for ${config.name}:`, error);
      return false;
    }
  }

  public async checkAllServicesHealth(): Promise<Record<string, boolean>> {
    const healthChecks = Object.keys(SERVICES).map(async (serviceKey) => {
      const isHealthy = await this.checkServiceHealth(serviceKey);
      return { serviceKey, isHealthy };
    });

    const results = await Promise.all(healthChecks);
    return results.reduce((acc, { serviceKey, isHealthy }) => {
      acc[serviceKey] = isHealthy;
      return acc;
    }, {} as Record<string, boolean>);
  }
}