import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { addRequestId, validateRequest, commonSchemas } from '../../middleware/requestValidation';
import { ApiError } from '../../middleware/errorHandler';

describe('Request Validation Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      body: {},
      query: {},
      params: {}
    };
    mockResponse = {
      setHeader: jest.fn()
    };
    mockNext = jest.fn();
  });

  describe('addRequestId', () => {
    it('should add request ID if not present', () => {
      addRequestId(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.headers!['x-request-id']).toBeDefined();
      expect(mockResponse.setHeader).toHaveBeenCalledWith('x-request-id', expect.any(String));
      expect(mockNext).toHaveBeenCalled();
    });

    it('should preserve existing request ID', () => {
      const existingId = 'existing-request-id';
      mockRequest.headers!['x-request-id'] = existingId;

      addRequestId(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.headers!['x-request-id']).toBe(existingId);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('x-request-id', existingId);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('validateRequest', () => {
    it('should pass validation with valid data', () => {
      const schema = {
        body: Joi.object({
          name: Joi.string().required(),
          age: Joi.number().min(0)
        })
      };

      mockRequest.body = { name: 'John', age: 25 };

      const middleware = validateRequest(schema);
      expect(() => {
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
      }).not.toThrow();

      expect(mockNext).toHaveBeenCalled();
    });

    it('should throw ApiError for invalid body', () => {
      const schema = {
        body: Joi.object({
          name: Joi.string().required(),
          age: Joi.number().min(0)
        })
      };

      mockRequest.body = { age: -1 }; // Missing name, invalid age

      const middleware = validateRequest(schema);
      expect(() => {
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
      }).toThrow(ApiError);
    });

    it('should validate query parameters', () => {
      const schema = {
        query: Joi.object({
          page: Joi.number().min(1),
          limit: Joi.number().min(1).max(100)
        })
      };

      mockRequest.query = { page: '0', limit: '200' }; // Invalid values

      const middleware = validateRequest(schema);
      expect(() => {
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
      }).toThrow(ApiError);
    });

    it('should validate path parameters', () => {
      const schema = {
        params: Joi.object({
          id: Joi.string().uuid().required()
        })
      };

      mockRequest.params = { id: 'invalid-uuid' };

      const middleware = validateRequest(schema);
      expect(() => {
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
      }).toThrow(ApiError);
    });

    it('should combine multiple validation errors', () => {
      const schema = {
        body: Joi.object({
          name: Joi.string().required()
        }),
        query: Joi.object({
          page: Joi.number().min(1)
        })
      };

      mockRequest.body = {}; // Missing name
      mockRequest.query = { page: '0' }; // Invalid page

      const middleware = validateRequest(schema);
      expect(() => {
        middleware(mockRequest as Request, mockResponse as Response, mockNext);
      }).toThrow(ApiError);
    });
  });

  describe('commonSchemas', () => {
    it('should validate pagination schema', () => {
      const validPagination = { page: 1, limit: 20, sortBy: 'name', sortOrder: 'asc' };
      const { error } = commonSchemas.pagination.validate(validPagination);
      expect(error).toBeUndefined();
    });

    it('should validate id schema', () => {
      const validId = { id: '123e4567-e89b-12d3-a456-426614174000' };
      const { error } = commonSchemas.id.validate(validId);
      expect(error).toBeUndefined();
    });

    it('should validate location schema', () => {
      const validLocation = { latitude: 22.3193, longitude: 114.1694, radius: 5 };
      const { error } = commonSchemas.location.validate(validLocation);
      expect(error).toBeUndefined();
    });

    it('should reject invalid location coordinates', () => {
      const invalidLocation = { latitude: 100, longitude: 200 }; // Out of range
      const { error } = commonSchemas.location.validate(invalidLocation);
      expect(error).toBeDefined();
    });
  });
});