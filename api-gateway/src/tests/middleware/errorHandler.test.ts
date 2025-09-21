import { Request, Response, NextFunction } from 'express';
import { ApiError, errorHandler, notFoundHandler } from '../../middleware/errorHandler';
import { ErrorCode, HttpStatusCode } from 'shared/src/types/api.types';

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: { 'x-request-id': 'test-request-id' },
      url: '/test',
      method: 'GET',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-user-agent')
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  describe('errorHandler', () => {
    it('should handle ApiError correctly', () => {
      const apiError = new ApiError(
        HttpStatusCode.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
        'Test validation error',
        { field: 'test' }
      );

      errorHandler(apiError, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Test validation error',
          details: { field: 'test' },
          timestamp: expect.any(String),
          requestId: 'test-request-id'
        }
      });
    });

    it('should handle ValidationError', () => {
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';

      errorHandler(validationError, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Validation failed',
          details: undefined,
          timestamp: expect.any(String),
          requestId: 'test-request-id'
        }
      });
    });

    it('should handle UnauthorizedError', () => {
      const unauthorizedError = new Error('Unauthorized');
      unauthorizedError.name = 'UnauthorizedError';

      errorHandler(unauthorizedError, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ErrorCode.INVALID_CREDENTIALS,
          message: 'Authentication required',
          details: undefined,
          timestamp: expect.any(String),
          requestId: 'test-request-id'
        }
      });
    });

    it('should handle generic errors', () => {
      const genericError = new Error('Something went wrong');

      errorHandler(genericError, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.INTERNAL_SERVER_ERROR);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ErrorCode.DATABASE_ERROR,
          message: 'Internal server error',
          details: undefined,
          timestamp: expect.any(String),
          requestId: 'test-request-id'
        }
      });
    });

    it('should generate request ID if not present', () => {
      mockRequest.headers = {};
      const apiError = new ApiError(
        HttpStatusCode.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
        'Test error'
      );

      errorHandler(apiError, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Test error',
          details: undefined,
          timestamp: expect.any(String),
          requestId: expect.any(String)
        }
      });
    });
  });

  describe('notFoundHandler', () => {
    it('should handle 404 errors correctly', () => {
      (mockRequest as any).path = '/nonexistent';
      mockRequest.method = 'GET';

      notFoundHandler(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatusCode.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: ErrorCode.NOT_FOUND,
          message: 'Route GET /nonexistent not found',
          timestamp: expect.any(String),
          requestId: 'test-request-id'
        }
      });
    });
  });
});