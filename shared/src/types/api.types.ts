export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ErrorResponse;
  meta?: ResponseMeta;
}

export interface ErrorResponse {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
  requestId: string;
}

export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
  requestId: string;
  timestamp: string;
}

export interface PaginationRequest {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: ResponseMeta;
}

// Standard HTTP status codes used across services
export enum HttpStatusCode {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503
}

// Standard error codes used across services
export enum ErrorCode {
  // Authentication & Authorization
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT = 'INVALID_FORMAT',
  
  // Business Logic
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  RESTAURANT_NOT_FOUND = 'RESTAURANT_NOT_FOUND',
  REVIEW_NOT_FOUND = 'REVIEW_NOT_FOUND',
  RECOMMENDATION_NOT_FOUND = 'RECOMMENDATION_NOT_FOUND',
  INSUFFICIENT_USER_DATA = 'INSUFFICIENT_USER_DATA',
  RESTAURANT_NOT_AVAILABLE = 'RESTAURANT_NOT_AVAILABLE',
  CONFLICTING_PREFERENCES = 'CONFLICTING_PREFERENCES',
  
  // System Errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  ML_MODEL_UNAVAILABLE = 'ML_MODEL_UNAVAILABLE',
  CACHE_ERROR = 'CACHE_ERROR',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Data Integration
  DATA_SYNC_ERROR = 'DATA_SYNC_ERROR',
  DATA_QUALITY_ERROR = 'DATA_QUALITY_ERROR',
  PLATFORM_UNAVAILABLE = 'PLATFORM_UNAVAILABLE',
  
  // Not Found
  NOT_FOUND = 'NOT_FOUND'
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  service: string;
  version: string;
  dependencies: DependencyStatus[];
  uptime: number;
}

export interface DependencyStatus {
  name: string;
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  lastChecked: string;
  error?: string;
}