import { Request, Response } from 'express';
import { AuthService } from '../middleware/auth';
import { UserModel, UserValidation } from '../models/User';
import { UserRegistrationRequest, UserLoginRequest } from '../../../shared/src/types/user.types';

// Mock user storage - In production, this would be a database
const users: Map<string, UserModel & { password: string }> = new Map();
const usersByEmail: Map<string, string> = new Map(); // email -> userId mapping

export class AuthController {
  /**
   * Register a new user
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const registrationData: UserRegistrationRequest = req.body;

      // Validate registration data
      const validation = UserValidation.validateRegistration(registrationData);
      if (validation.error) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.message,
            details: validation.error.details,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Check if user already exists
      if (usersByEmail.has(registrationData.email.toLowerCase())) {
        res.status(409).json({
          error: {
            code: 'USER_EXISTS',
            message: 'User with this email already exists',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Hash password
      const hashedPassword = await AuthService.hashPassword(registrationData.password);

      // Create user
      const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const newUser = new UserModel({
        id: userId,
        email: registrationData.email.toLowerCase(),
        name: registrationData.name,
        preferences: registrationData.preferences
      });

      // Store user (in production, save to database)
      const userWithPassword = Object.assign(newUser, { password: hashedPassword });
      users.set(userId, userWithPassword);
      usersByEmail.set(registrationData.email.toLowerCase(), userId);

      // Generate JWT token
      const token = AuthService.generateToken({
        id: newUser.id,
        email: newUser.email,
        name: newUser.name
      });

      res.status(201).json({
        success: true,
        data: {
          user: newUser.toJSON(),
          token,
          expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        error: {
          code: 'REGISTRATION_FAILED',
          message: 'User registration failed',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  /**
   * Login user
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const loginData: UserLoginRequest = req.body;

      // Basic validation
      if (!loginData.email || !loginData.password) {
        res.status(400).json({
          error: {
            code: 'MISSING_CREDENTIALS',
            message: 'Email and password are required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Find user by email
      const userId = usersByEmail.get(loginData.email.toLowerCase());
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const user = users.get(userId);
      if (!user) {
        res.status(401).json({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Verify password
      const isPasswordValid = await AuthService.comparePassword(loginData.password, user.password);
      if (!isPasswordValid) {
        res.status(401).json({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Generate JWT token
      const token = AuthService.generateToken({
        id: user.id,
        email: user.email,
        name: user.name
      });

      res.status(200).json({
        success: true,
        data: {
          user: user.toJSON(),
          token,
          expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        error: {
          code: 'LOGIN_FAILED',
          message: 'Login failed',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  /**
   * Get current user profile
   */
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const user = users.get(req.user.id);
      if (!user) {
        res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          user: user.toJSON()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        error: {
          code: 'PROFILE_FETCH_FAILED',
          message: 'Failed to fetch user profile',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  /**
   * Refresh JWT token
   */
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const user = users.get(req.user.id);
      if (!user) {
        res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Generate new JWT token - add a small random component to ensure uniqueness
      const token = AuthService.generateToken({
        id: user.id,
        email: user.email,
        name: user.name,
        refreshId: Math.random().toString(36).substring(2, 15)
      });

      res.status(200).json({
        success: true,
        data: {
          token,
          expiresIn: process.env.JWT_EXPIRES_IN || '7d'
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({
        error: {
          code: 'TOKEN_REFRESH_FAILED',
          message: 'Failed to refresh token',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  /**
   * Change user password
   */
  static async changePassword(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          error: {
            code: 'MISSING_PASSWORDS',
            message: 'Current password and new password are required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const user = users.get(req.user.id);
      if (!user) {
        res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Verify current password
      const isCurrentPasswordValid = await AuthService.comparePassword(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        res.status(401).json({
          error: {
            code: 'INVALID_CURRENT_PASSWORD',
            message: 'Current password is incorrect',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Validate new password strength
      const passwordValidation = AuthService.validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        res.status(400).json({
          error: {
            code: 'WEAK_PASSWORD',
            message: 'New password does not meet security requirements',
            details: passwordValidation.errors,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      // Hash new password and update
      const hashedNewPassword = await AuthService.hashPassword(newPassword);
      user.password = hashedNewPassword;
      user.updatedAt = new Date();

      res.status(200).json({
        success: true,
        data: {
          message: 'Password changed successfully'
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        error: {
          code: 'PASSWORD_CHANGE_FAILED',
          message: 'Failed to change password',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  /**
   * Logout user (in a stateless JWT system, this is mainly for client-side cleanup)
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      // In a stateless JWT system, logout is handled client-side by removing the token
      // In production, you might want to implement token blacklisting
      
      res.status(200).json({
        success: true,
        data: {
          message: 'Logged out successfully'
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        error: {
          code: 'LOGOUT_FAILED',
          message: 'Logout failed',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }
}

// Helper function to get user storage (for testing purposes)
export const getUserStorage = () => ({ users, usersByEmail });