import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Use random port for tests

// Mock external services for testing
jest.mock('../services/proxyService', () => {
  return {
    ProxyService: {
      getInstance: jest.fn(() => ({
        getProxy: jest.fn((serviceKey: string) => {
          return (req: any, res: any, next: any) => {
            // Mock proxy behavior
            res.json({
              success: true,
              data: { message: `Mock response from ${serviceKey}` },
              meta: {
                requestId: req.headers['x-request-id'],
                timestamp: new Date().toISOString()
              }
            });
          };
        }),
        checkServiceHealth: jest.fn().mockResolvedValue(true),
        checkAllServicesHealth: jest.fn().mockResolvedValue({
          USER_SERVICE: true,
          RESTAURANT_SERVICE: true,
          RECOMMENDATION_ENGINE: true,
          REVIEW_SERVICE: true,
          EMOTION_SERVICE: true
        })
      }))
    }
  };
});

// Increase timeout for integration tests
jest.setTimeout(30000);