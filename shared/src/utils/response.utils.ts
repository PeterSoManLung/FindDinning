import { ApiResponse, ErrorResponse, ResponseMeta, HttpStatusCode, ErrorCode } from '../types/api.types';

export class ResponseBuilder {
  static success<T>(data: T, meta?: Partial<ResponseMeta>): ApiResponse<T> {
    return {
      success: true,
      data,
      meta: meta ? {
        requestId: generateRequestId(),
        timestamp: new Date().toISOString(),
        ...meta
      } : undefined
    };
  }

  static error(
    code: ErrorCode | string,
    message: string,
    details?: any,
    requestId?: string
  ): ApiResponse {
    const errorResponse: ErrorResponse = {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
      requestId: requestId || generateRequestId()
    };

    return {
      success: false,
      error: errorResponse
    };
  }

  static paginated<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
    requestId?: string
  ): ApiResponse<T[]> {
    const hasNext = page * limit < total;
    const hasPrevious = page > 1;

    return {
      success: true,
      data,
      meta: {
        page,
        limit,
        total,
        hasNext,
        hasPrevious,
        requestId: requestId || generateRequestId(),
        timestamp: new Date().toISOString()
      }
    };
  }
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export function getHttpStatusFromErrorCode(errorCode: ErrorCode | string): HttpStatusCode {
  const errorCodeMap: Record<string, HttpStatusCode> = {
    [ErrorCode.INVALID_CREDENTIALS]: HttpStatusCode.UNAUTHORIZED,
    [ErrorCode.TOKEN_EXPIRED]: HttpStatusCode.UNAUTHORIZED,
    [ErrorCode.INSUFFICIENT_PERMISSIONS]: HttpStatusCode.FORBIDDEN,
    [ErrorCode.VALIDATION_ERROR]: HttpStatusCode.BAD_REQUEST,
    [ErrorCode.MISSING_REQUIRED_FIELD]: HttpStatusCode.BAD_REQUEST,
    [ErrorCode.INVALID_FORMAT]: HttpStatusCode.BAD_REQUEST,
    [ErrorCode.USER_NOT_FOUND]: HttpStatusCode.NOT_FOUND,
    [ErrorCode.RESTAURANT_NOT_FOUND]: HttpStatusCode.NOT_FOUND,
    [ErrorCode.REVIEW_NOT_FOUND]: HttpStatusCode.NOT_FOUND,
    [ErrorCode.RECOMMENDATION_NOT_FOUND]: HttpStatusCode.NOT_FOUND,
    [ErrorCode.INSUFFICIENT_USER_DATA]: HttpStatusCode.UNPROCESSABLE_ENTITY,
    [ErrorCode.RESTAURANT_NOT_AVAILABLE]: HttpStatusCode.UNPROCESSABLE_ENTITY,
    [ErrorCode.CONFLICTING_PREFERENCES]: HttpStatusCode.UNPROCESSABLE_ENTITY,
    [ErrorCode.RATE_LIMIT_EXCEEDED]: HttpStatusCode.UNPROCESSABLE_ENTITY,
    [ErrorCode.DATABASE_ERROR]: HttpStatusCode.INTERNAL_SERVER_ERROR,
    [ErrorCode.EXTERNAL_SERVICE_ERROR]: HttpStatusCode.SERVICE_UNAVAILABLE,
    [ErrorCode.ML_MODEL_UNAVAILABLE]: HttpStatusCode.SERVICE_UNAVAILABLE,
    [ErrorCode.CACHE_ERROR]: HttpStatusCode.INTERNAL_SERVER_ERROR,
    [ErrorCode.DATA_SYNC_ERROR]: HttpStatusCode.INTERNAL_SERVER_ERROR,
    [ErrorCode.DATA_QUALITY_ERROR]: HttpStatusCode.INTERNAL_SERVER_ERROR,
    [ErrorCode.PLATFORM_UNAVAILABLE]: HttpStatusCode.SERVICE_UNAVAILABLE
  };

  return errorCodeMap[errorCode] || HttpStatusCode.INTERNAL_SERVER_ERROR;
}