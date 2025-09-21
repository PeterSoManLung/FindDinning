import { ServiceClient } from '../../services/serviceClient';
import { ApiError } from '../../middleware/errorHandler';
import { ErrorCode, HttpStatusCode } from 'shared/src/types/api.types';

// Mock fetch globally
global.fetch = jest.fn();

describe('ServiceClient', () => {
  let serviceClient: ServiceClient;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    serviceClient = ServiceClient.getInstance();
    mockFetch.mockClear();
  });

  describe('callService', () => {
    it('should make successful service call', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ success: true, data: { id: '123' } }),
        headers: new Map([['content-type', 'application/json']])
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await serviceClient.callService('USER_SERVICE', {
        method: 'GET',
        path: '/users/123'
      });

      expect(result.status).toBe(200);
      expect(result.data).toEqual({ success: true, data: { id: '123' } });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/users/123',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'api-gateway/1.0.0'
          })
        })
      );
    });

    it('should handle service errors', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        json: jest.fn().mockResolvedValue({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        })
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(
        serviceClient.callService('USER_SERVICE', {
          method: 'GET',
          path: '/users/nonexistent'
        })
      ).rejects.toThrow(ApiError);
    });

    it('should handle network timeouts', async () => {
      mockFetch.mockRejectedValue(new Error('TimeoutError'));

      await expect(
        serviceClient.callService('USER_SERVICE', {
          method: 'GET',
          path: '/users/123',
          timeout: 1000
        })
      ).rejects.toThrow(ApiError);
    });

    it('should include request ID in headers', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ success: true }),
        headers: new Map()
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      await serviceClient.callService(
        'USER_SERVICE',
        { method: 'GET', path: '/users/123' },
        'test-request-id'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-request-id': 'test-request-id'
          })
        })
      );
    });

    it('should throw error for unknown service', async () => {
      await expect(
        serviceClient.callService('UNKNOWN_SERVICE', {
          method: 'GET',
          path: '/test'
        })
      ).rejects.toThrow(ApiError);
    });
  });

  describe('convenience methods', () => {
    beforeEach(() => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ success: true }),
        headers: new Map()
      };
      mockFetch.mockResolvedValue(mockResponse as any);
    });

    it('should make GET request', async () => {
      await serviceClient.get('USER_SERVICE', '/users/123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should make POST request', async () => {
      const data = { name: 'Test User' };
      await serviceClient.post('USER_SERVICE', '/users', data);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(data)
        })
      );
    });

    it('should make PUT request', async () => {
      const data = { name: 'Updated User' };
      await serviceClient.put('USER_SERVICE', '/users/123', data);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(data)
        })
      );
    });

    it('should make DELETE request', async () => {
      await serviceClient.delete('USER_SERVICE', '/users/123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});