import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
      };
    }
  }
}

export interface JWTPayload {
  id: string;
  email: string;
  name: string;
  refreshId?: string;
  iat?: number;
  exp?: number;
}

export class AuthService {
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  private static readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
  private static readonly SALT_ROUNDS = 12;

  /**
   * Generates a JWT token for a user
   */
  static generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN
    } as jwt.SignOptions);
  }

  /**
   * Verifies and decodes a JWT token
   */
  static verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.JWT_SECRET) as JWTPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  /**
   * Hashes a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, this.SALT_ROUNDS);
    } catch (error) {
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Compares a plain text password with a hashed password
   */
  static async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      throw new Error('Password comparison failed');
    }
  }

  /**
   * Extracts token from Authorization header
   */
  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Validates token format and structure
   */
  static isValidTokenFormat(token: string): boolean {
    // Basic JWT format validation (3 parts separated by dots)
    const parts = token.split('.');
    return parts.length === 3 && parts.every(part => part.length > 0);
  }

  /**
   * Validates password strength
   */
  static validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password should contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = AuthService.extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      res.status(401).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Access token is required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    if (!AuthService.isValidTokenFormat(token)) {
      res.status(401).json({
        error: {
          code: 'INVALID_TOKEN_FORMAT',
          message: 'Invalid token format',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const decoded = AuthService.verifyToken(token);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name
    };

    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    
    res.status(401).json({
      error: {
        code: 'AUTHENTICATION_FAILED',
        message: errorMessage,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = AuthService.extractTokenFromHeader(req.headers.authorization);

    if (token && AuthService.isValidTokenFormat(token)) {
      const decoded = AuthService.verifyToken(token);
      req.user = {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name
      };
    }

    next();
  } catch (error) {
    // For optional auth, we continue even if token is invalid
    next();
  }
};

/**
 * Middleware to validate password strength
 */
export const validatePasswordStrength = (req: Request, res: Response, next: NextFunction): void => {
  const { password } = req.body;

  if (!password) {
    res.status(400).json({
      error: {
        code: 'MISSING_PASSWORD',
        message: 'Password is required',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
    return;
  }

  const validation = AuthService.validatePasswordStrength(password);
  
  if (!validation.isValid) {
    res.status(400).json({
      error: {
        code: 'WEAK_PASSWORD',
        message: 'Password does not meet security requirements',
        details: validation.errors,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
    return;
  }

  next();
};

