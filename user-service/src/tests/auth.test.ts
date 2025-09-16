import request from 'supertest';
import jwt from 'jsonwebtoken';
import { AuthService, authenticateToken, optionalAuth, validatePasswordStrength } from '../middleware/auth';
import { AuthController, getUserStorage } from '../controllers/authController';
import app from '../index';

// Mock Express request and response for middleware testing
const mockRequest = (headers: any = {}, body: any = {}) => ({
  headers,
  body,
  user: undefined as any
});

const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

describe('AuthService', () => {
  const testPayload = {
    id: 'test-user-1',
    email: 'test@example.com',
    name: 'Test User'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = AuthService.generateToken(testPayload);
      
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should generate different tokens for different payloads', () => {
      const token1 = AuthService.generateToken(testPayload);
      const token2 = AuthService.generateToken({
        ...testPayload,
        id: 'different-user'
      });
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode a valid token', () => {
      const token = AuthService.generateToken(testPayload);
      const decoded = AuthService.verifyToken(token);
      
      expect(decoded.id).toBe(testPayload.id);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.name).toBe(testPayload.name);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        AuthService.verifyToken('invalid-token');
      }).toThrow('Invalid token');
    });

    it('should throw error for expired token', () => {
      // Create a token that expires immediately
      const expiredToken = jwt.sign(testPayload, process.env.JWT_SECRET || 'your-secret-key-change-in-production', {
        expiresIn: '0s'
      });
      
      // Wait a bit to ensure expiration
      setTimeout(() => {
        expect(() => {
          AuthService.verifyToken(expiredToken);
        }).toThrow('Token has expired');
      }, 100);
    });
  });

  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'TestPassword123';
      const hashedPassword = await AuthService.hashPassword(password);
      
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50); // bcrypt hashes are long
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'TestPassword123';
      const hash1 = await AuthService.hashPassword(password);
      const hash2 = await AuthService.hashPassword(password);
      
      expect(hash1).not.toBe(hash2); // Due to salt
    });
  });

  describe('comparePassword', () => {
    it('should return true for correct password', async () => {
      const password = 'TestPassword123';
      const hashedPassword = await AuthService.hashPassword(password);
      const isMatch = await AuthService.comparePassword(password, hashedPassword);
      
      expect(isMatch).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const password = 'TestPassword123';
      const wrongPassword = 'WrongPassword123';
      const hashedPassword = await AuthService.hashPassword(password);
      const isMatch = await AuthService.comparePassword(wrongPassword, hashedPassword);
      
      expect(isMatch).toBe(false);
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const token = 'valid-jwt-token';
      const authHeader = `Bearer ${token}`;
      const extracted = AuthService.extractTokenFromHeader(authHeader);
      
      expect(extracted).toBe(token);
    });

    it('should return null for invalid header format', () => {
      expect(AuthService.extractTokenFromHeader('InvalidFormat token')).toBeNull();
      expect(AuthService.extractTokenFromHeader('Bearer')).toBeNull();
      expect(AuthService.extractTokenFromHeader('Bearer token extra')).toBeNull();
    });

    it('should return null for undefined header', () => {
      expect(AuthService.extractTokenFromHeader(undefined)).toBeNull();
    });
  });

  describe('isValidTokenFormat', () => {
    it('should validate correct JWT format', () => {
      const validToken = 'header.payload.signature';
      expect(AuthService.isValidTokenFormat(validToken)).toBe(true);
    });

    it('should reject invalid JWT format', () => {
      expect(AuthService.isValidTokenFormat('invalid')).toBe(false);
      expect(AuthService.isValidTokenFormat('header.payload')).toBe(false);
      expect(AuthService.isValidTokenFormat('header..signature')).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should validate strong passwords', () => {
      const result = AuthService.validatePasswordStrength('StrongPass123!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject passwords that are too short', () => {
      const result = AuthService.validatePasswordStrength('Short1!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject passwords without uppercase letters', () => {
      const result = AuthService.validatePasswordStrength('lowercase123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject passwords without lowercase letters', () => {
      const result = AuthService.validatePasswordStrength('UPPERCASE123!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject passwords without numbers', () => {
      const result = AuthService.validatePasswordStrength('NoNumbers!');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should suggest special characters', () => {
      const result = AuthService.validatePasswordStrength('NoSpecial123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password should contain at least one special character');
    });
  });
});

describe('Authentication Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token', () => {
      const token = AuthService.generateToken({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User'
      });
      
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const res = mockResponse();
      
      authenticateToken(req as any, res as any, mockNext);
      
      expect(req.user).toBeDefined();
      expect(req.user?.id).toBe('user-1');
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject request without token', () => {
      const req = mockRequest();
      const res = mockResponse();
      
      authenticateToken(req as any, res as any, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'MISSING_TOKEN'
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid token format', () => {
      const req = mockRequest({ authorization: 'Bearer invalid-format' });
      const res = mockResponse();
      
      authenticateToken(req as any, res as any, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INVALID_TOKEN_FORMAT'
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject expired token', () => {
      const expiredToken = jwt.sign(
        { id: 'user-1', email: 'test@example.com', name: 'Test User' },
        process.env.JWT_SECRET || 'your-secret-key-change-in-production',
        { expiresIn: '0s' }
      );
      
      const req = mockRequest({ authorization: `Bearer ${expiredToken}` });
      const res = mockResponse();
      
      setTimeout(() => {
        authenticateToken(req as any, res as any, mockNext);
        
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              code: 'AUTHENTICATION_FAILED'
            })
          })
        );
        expect(mockNext).not.toHaveBeenCalled();
      }, 100);
    });
  });

  describe('optionalAuth', () => {
    it('should set user for valid token', () => {
      const token = AuthService.generateToken({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User'
      });
      
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const res = mockResponse();
      
      optionalAuth(req as any, res as any, mockNext);
      
      expect(req.user).toBeDefined();
      expect(req.user?.id).toBe('user-1');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue without user for missing token', () => {
      const req = mockRequest();
      const res = mockResponse();
      
      optionalAuth(req as any, res as any, mockNext);
      
      expect(req.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should continue without user for invalid token', () => {
      const req = mockRequest({ authorization: 'Bearer invalid-token' });
      const res = mockResponse();
      
      optionalAuth(req as any, res as any, mockNext);
      
      expect(req.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('validatePasswordStrength', () => {
    it('should pass for strong password', () => {
      const req = mockRequest({}, { password: 'StrongPass123!' });
      const res = mockResponse();
      
      validatePasswordStrength(req as any, res as any, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject missing password', () => {
      const req = mockRequest({}, {});
      const res = mockResponse();
      
      validatePasswordStrength(req as any, res as any, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'MISSING_PASSWORD'
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject weak password', () => {
      const req = mockRequest({}, { password: 'weak' });
      const res = mockResponse();
      
      validatePasswordStrength(req as any, res as any, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'WEAK_PASSWORD'
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});

describe('Authentication API Endpoints', () => {
  beforeEach(() => {
    // Clear user storage before each test
    const { users, usersByEmail } = getUserStorage();
    users.clear();
    usersByEmail.clear();
  });

  describe('POST /api/auth/register', () => {
    const validRegistrationData = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      name: 'Test User',
      preferences: {
        cuisineTypes: ['Japanese'],
        spiceLevel: 3
      }
    };

    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(validRegistrationData.email);
      expect(response.body.data.user.name).toBe(validRegistrationData.name);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.password).toBeUndefined(); // Should not return password
    });

    it('should reject registration with invalid email', async () => {
      const invalidData = { ...validRegistrationData, email: 'invalid-email' };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration with weak password', async () => {
      const invalidData = { ...validRegistrationData, password: 'weak' };
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('WEAK_PASSWORD');
    });

    it('should reject duplicate email registration', async () => {
      // Register first user
      await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(201);

      // Try to register with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData)
        .expect(409);

      expect(response.body.error.code).toBe('USER_EXISTS');
    });
  });

  describe('POST /api/auth/login', () => {
    const registrationData = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      name: 'Test User'
    };

    beforeEach(async () => {
      // Register a user for login tests
      await request(app)
        .post('/api/auth/register')
        .send(registrationData);
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: registrationData.email,
          password: registrationData.password
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(registrationData.email);
      expect(response.body.data.token).toBeDefined();
    });

    it('should reject login with invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: registrationData.password
        })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: registrationData.email,
          password: 'WrongPassword123!'
        })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: registrationData.email
          // Missing password
        })
        .expect(400);

      expect(response.body.error.code).toBe('MISSING_CREDENTIALS');
    });
  });

  describe('GET /api/auth/profile', () => {
    let authToken: string;

    beforeEach(async () => {
      const registrationResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
          name: 'Test User'
        });
      
      authToken = registrationResponse.body.data.token;
    });

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.user.name).toBe('Test User');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_TOKEN_FORMAT');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let authToken: string;

    beforeEach(async () => {
      const registrationResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
          name: 'Test User'
        });
      
      authToken = registrationResponse.body.data.token;
    });

    it('should refresh token with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.token).not.toBe(authToken); // Should be a new token
    });

    it('should reject refresh without token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('POST /api/auth/logout', () => {
    let authToken: string;

    beforeEach(async () => {
      const registrationResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
          name: 'Test User'
        });
      
      authToken = registrationResponse.body.data.token;
    });

    it('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Logged out successfully');
    });

    it('should reject logout without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });
});