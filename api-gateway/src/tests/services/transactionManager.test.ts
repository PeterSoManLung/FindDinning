import { TransactionManager, TransactionStep } from '../../services/transactionManager';
import { ServiceClient } from '../../services/serviceClient';

// Mock ServiceClient
jest.mock('../../services/serviceClient', () => ({
  ServiceClient: {
    getInstance: jest.fn(() => ({
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      get: jest.fn(),
      callService: jest.fn()
    }))
  }
}));

describe('TransactionManager', () => {
  let transactionManager: TransactionManager;
  let mockServiceClient: jest.Mocked<ServiceClient>;

  beforeEach(() => {
    transactionManager = TransactionManager.getInstance();
    mockServiceClient = ServiceClient.getInstance() as jest.Mocked<ServiceClient>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('executeTransaction', () => {
    it('should execute all steps successfully', async () => {
      const steps: TransactionStep[] = [
        {
          serviceKey: 'USER_SERVICE',
          operation: 'create',
          path: '/users',
          data: { name: 'Test User' }
        },
        {
          serviceKey: 'RECOMMENDATION_ENGINE',
          operation: 'create',
          path: '/users/123/profile',
          data: { preferences: {} }
        }
      ];

      mockServiceClient.post
        .mockResolvedValueOnce({ data: { id: '123' }, status: 201, headers: {} })
        .mockResolvedValueOnce({ data: { success: true }, status: 201, headers: {} });

      const result = await transactionManager.executeTransaction(steps);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.compensated).toBe(false);
      expect(mockServiceClient.post).toHaveBeenCalledTimes(2);
    });

    it('should compensate on failure', async () => {
      const steps: TransactionStep[] = [
        {
          serviceKey: 'USER_SERVICE',
          operation: 'create',
          path: '/users',
          data: { name: 'Test User' },
          compensationPath: '/users/123'
        },
        {
          serviceKey: 'RECOMMENDATION_ENGINE',
          operation: 'create',
          path: '/users/123/profile',
          data: { preferences: {} }
        }
      ];

      mockServiceClient.post
        .mockResolvedValueOnce({ data: { id: '123' }, status: 201, headers: {} })
        .mockRejectedValueOnce(new Error('Service unavailable'));

      mockServiceClient.delete
        .mockResolvedValueOnce({ data: { success: true }, status: 200, headers: {} });

      const result = await transactionManager.executeTransaction(steps);

      expect(result.success).toBe(false);
      expect(result.results).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.compensated).toBe(true);
      expect(mockServiceClient.delete).toHaveBeenCalledWith(
        'USER_SERVICE',
        '/users/123',
        undefined
      );
    });

    it('should handle update operations', async () => {
      const steps: TransactionStep[] = [
        {
          serviceKey: 'USER_SERVICE',
          operation: 'update',
          path: '/users/123',
          data: { name: 'Updated User' }
        }
      ];

      mockServiceClient.put
        .mockResolvedValueOnce({ data: { success: true }, status: 200, headers: {} });

      const result = await transactionManager.executeTransaction(steps);

      expect(result.success).toBe(true);
      expect(mockServiceClient.put).toHaveBeenCalledWith(
        'USER_SERVICE',
        '/users/123',
        { name: 'Updated User' },
        undefined
      );
    });

    it('should handle delete operations', async () => {
      const steps: TransactionStep[] = [
        {
          serviceKey: 'USER_SERVICE',
          operation: 'delete',
          path: '/users/123'
        }
      ];

      mockServiceClient.delete
        .mockResolvedValueOnce({ data: { success: true }, status: 200, headers: {} });

      const result = await transactionManager.executeTransaction(steps);

      expect(result.success).toBe(true);
      expect(mockServiceClient.delete).toHaveBeenCalledWith(
        'USER_SERVICE',
        '/users/123',
        undefined
      );
    });

    it('should handle compensation failure gracefully', async () => {
      const steps: TransactionStep[] = [
        {
          serviceKey: 'USER_SERVICE',
          operation: 'create',
          path: '/users',
          data: { name: 'Test User' },
          compensationPath: '/users/123'
        },
        {
          serviceKey: 'RECOMMENDATION_ENGINE',
          operation: 'create',
          path: '/users/123/profile',
          data: { preferences: {} }
        }
      ];

      mockServiceClient.post
        .mockResolvedValueOnce({ data: { id: '123' }, status: 201, headers: {} })
        .mockRejectedValueOnce(new Error('Service unavailable'));

      mockServiceClient.delete
        .mockRejectedValueOnce(new Error('Compensation failed'));

      const result = await transactionManager.executeTransaction(steps);

      expect(result.success).toBe(false);
      expect(result.compensated).toBe(false);
    });
  });

  describe('executeSaga', () => {
    it('should execute saga pattern', async () => {
      const steps: TransactionStep[] = [
        {
          serviceKey: 'USER_SERVICE',
          operation: 'create',
          path: '/users',
          data: { name: 'Test User' }
        }
      ];

      mockServiceClient.post
        .mockResolvedValueOnce({ data: { id: '123' }, status: 201, headers: {} });

      const result = await transactionManager.executeSaga(steps);

      expect(result.success).toBe(true);
    });
  });

  describe('getActiveTransactions', () => {
    it('should return active transactions', () => {
      const activeTransactions = transactionManager.getActiveTransactions();
      expect(activeTransactions).toBeInstanceOf(Map);
    });
  });

  describe('forceCompensation', () => {
    it('should return false for non-existent transaction', async () => {
      const result = await transactionManager.forceCompensation('non-existent-id');
      expect(result).toBe(false);
    });
  });
});