import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ApiResponse, ErrorResponse, ErrorCode, HttpStatusCode } from 'shared/src/types/api.types';

export class ApiError extends Error {
  public statusCode: number;
  public errorCode: string;
  public details?: any;

  constructor(statusCode: number, errorCode: string, message: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.name = 'ApiError';
  }
}

export const errorHandler = (
  error: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  
  let statusCode = HttpStatusCode.INTERNAL_SERVER_ERROR;
  let errorCode = ErrorCode.DATABASE_ERROR;
  let message = 'Internal server error';
  let details: any = undefined;

  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    errorCode = error.errorCode as ErrorCode;
    message = error.message;
    details = error.details;
  } else if (error.name === 'ValidationError') {
    statusCode = HttpStatusCode.BAD_REQUEST;
    errorCode = ErrorCode.VALIDATION_ERROR;
    message = error.message;
  } else if (error.name === 'UnauthorizedError') {
    statusCode = HttpStatusCode.UNAUTHORIZED;
    errorCode = ErrorCode.INVALID_CREDENTIALS;
    message = 'Authentication required';
  }

  const errorResponse: ErrorResponse = {
    code: errorCode,
    message,
    details,
    timestamp: new Date().toISOString(),
    requestId
  };

  const apiResponse: ApiResponse = {
    success: false,
    error: errorResponse
  };

  // Log error for monitoring
  console.error(`[${requestId}] ${statusCode} ${errorCode}: ${message}`, {
    error: error.stack,
    details,
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  res.status(statusCode).json(apiResponse);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  
  const errorResponse: ErrorResponse = {
    code: ErrorCode.NOT_FOUND,
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
    requestId
  };

  const apiResponse: ApiResponse = {
    success: false,
    error: errorResponse
  };

  res.status(HttpStatusCode.NOT_FOUND).json(apiResponse);
};