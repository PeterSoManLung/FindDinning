import { Router } from 'express';
import { PreferencesController } from '../controllers/preferencesController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/preferences
 * @desc Get user preferences
 * @access Private
 */
router.get('/', authenticateToken, PreferencesController.getPreferences);

/**
 * @route PUT /api/preferences
 * @desc Update user preferences
 * @access Private
 */
router.put('/', authenticateToken, PreferencesController.updatePreferences);

/**
 * @route PUT /api/preferences/cuisine
 * @desc Update cuisine preferences
 * @access Private
 */
router.put('/cuisine', authenticateToken, PreferencesController.updateCuisinePreferences);

/**
 * @route PUT /api/preferences/dietary
 * @desc Update dietary restrictions
 * @access Private
 */
router.put('/dietary', authenticateToken, PreferencesController.updateDietaryRestrictions);

/**
 * @route PUT /api/preferences/atmosphere
 * @desc Update atmosphere preferences
 * @access Private
 */
router.put('/atmosphere', authenticateToken, PreferencesController.updateAtmospherePreferences);

/**
 * @route GET /api/preferences/history
 * @desc Get preference change history
 * @access Private
 */
router.get('/history', authenticateToken, PreferencesController.getPreferenceHistory);

export default router;