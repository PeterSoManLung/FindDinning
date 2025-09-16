import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateToken, validatePasswordStrength } from '../middleware/auth';

const router = Router();

/**
 * @route POST /api/auth/register
 * @desc Register a new user
 * @access Public
 */
router.post('/register', validatePasswordStrength, AuthController.register);

/**
 * @route POST /api/auth/login
 * @desc Login user
 * @access Public
 */
router.post('/login', AuthController.login);

/**
 * @route GET /api/auth/profile
 * @desc Get current user profile
 * @access Private
 */
router.get('/profile', authenticateToken, AuthController.getProfile);

/**
 * @route POST /api/auth/refresh
 * @desc Refresh JWT token
 * @access Private
 */
router.post('/refresh', authenticateToken, AuthController.refreshToken);

/**
 * @route PUT /api/auth/change-password
 * @desc Change user password
 * @access Private
 */
router.put('/change-password', authenticateToken, validatePasswordStrength, AuthController.changePassword);

/**
 * @route POST /api/auth/logout
 * @desc Logout user
 * @access Private
 */
router.post('/logout', authenticateToken, AuthController.logout);

export default router;