// Jest setup file for restaurant service tests

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set timezone for consistent date testing
process.env.TZ = 'Asia/Hong_Kong';

// Global test timeout
jest.setTimeout(10000);