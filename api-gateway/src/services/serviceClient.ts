import { SERVICES, ServiceConfig } from '../config/services';
import { ApiResponse, ErrorCode, HttpStatusCode } from 'shared/src/types/api.types';
import { ApiError } from '../middleware/errorHandler';

export interface ServiceRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface ServiceResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export class ServiceClient {
  private static instance: ServiceClient;
  private baseHeaders: Record<string, string>;

  private constructor() {
    this.baseHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'api-gateway/1.0.0'
    };
  }

  public static getInstance(): ServiceClient {
    if (!ServiceClient.instance) {
      ServiceClient.instance = new ServiceClient();
    }
    return ServiceClient.instance;
  }

  public async callService<T = any>(
    serviceKey: string,
    request: ServiceRequest,
    requestId?: string
  ): Promise<ServiceResponse<T>> {
    const config = SERVICES[serviceKey];
    if (!config) {
      throw new ApiError(
        HttpStatusCode.INTERNAL_SERVER_ERROR,
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        `Service configuration not found: ${serviceKey}`
      );
    }

    const url = `${config.url}${request.path}`;
    const headers = {
      ...this.baseHeaders,
      ...request.headers,
      ...(requestId && { 'x-request-id': requestId })
    };

    try {
      const response = await fetch(url, {
        method: request.method,
        headers,
        body: request.data ? JSON.stringify(request.data) : undefined,
        signal: AbortSignal.timeout(request.timeout || config.timeout)
      });

      const responseData: any = await response.json();

      if (!response.ok) {
        throw new ApiError(
          response.status,
          responseData.error?.code || ErrorCode.EXTERNAL_SERVICE_ERROR,
          responseData.error?.message || `Service ${config.name} returned error`,
          responseData.error?.details
        );
      }

      return {
        data: responseData as T,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new ApiError(
          HttpStatusCode.SERVICE_UNAVAILABLE,
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          `Service ${config.name} timeout`,
          { timeout: request.timeout || config.timeout }
        );
      }

      throw new ApiError(
        HttpStatusCode.SERVICE_UNAVAILABLE,
        ErrorCode.EXTERNAL_SERVICE_ERROR,
        `Failed to communicate with ${config.name}`,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Convenience methods for common operations
  public async get<T = any>(
    serviceKey: string,
    path: string,
    requestId?: string,
    headers?: Record<string, string>
  ): Promise<ServiceResponse<T>> {
    return this.callService<T>(serviceKey, {
      method: 'GET',
      path,
      headers
    }, requestId);
  }

  public async post<T = any>(
    serviceKey: string,
    path: string,
    data: any,
    requestId?: string,
    headers?: Record<string, string>
  ): Promise<ServiceResponse<T>> {
    return this.callService<T>(serviceKey, {
      method: 'POST',
      path,
      data,
      headers
    }, requestId);
  }

  public async put<T = any>(
    serviceKey: string,
    path: string,
    data: any,
    requestId?: string,
    headers?: Record<string, string>
  ): Promise<ServiceResponse<T>> {
    return this.callService<T>(serviceKey, {
      method: 'PUT',
      path,
      data,
      headers
    }, requestId);
  }

  public async delete<T = any>(
    serviceKey: string,
    path: string,
    requestId?: string,
    headers?: Record<string, string>
  ): Promise<ServiceResponse<T>> {
    return this.callService<T>(serviceKey, {
      method: 'DELETE',
      path,
      headers
    }, requestId);
  }
}