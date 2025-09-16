import { Request, Response } from 'express';
import { UserModel, UserValidation } from '../models/User';
import { UserPreferences, UserUpdateRequest } from '@shared/types/user.types';
import { getUserStorage } from './authController';

// Types for preference history tracking
interface PreferenceChange {
  id: string;
  userId: string;
  field: keyof UserPreferences;
  oldValue: any;
  newValue: any;
  timestamp: Date;
  reason?: string;
}

// Mock preference history storage - In production, this would be a database
const preferenceHistory: Map<string, PreferenceChange[]> = new Map();

export class PreferencesController {
  /**
   * Get user preferences
   */
  static async getPreferences(req: Request, res: Response): Promise<void> {
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

      const { users } = getUserStorage();
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
          preferences: user.preferences,
          lastUpdated: user.updatedAt
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get preferences error:', error);
      res.status(500).json({
        error: {
          code: 'PREFERENCES_FETCH_FAILED',
          message: 'Failed to fetch user preferences',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  /**
   * Update user preferences
   */
  static async updatePreferences(req: Request, res: Response): Promise<void> {
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

      const { users } = getUserStorage();
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

      const { reason, ...preferenceUpdates } = req.body; // Extract reason separately

      // Check for conflicts and resolve them first
      const resolvedPreferences = PreferencesController.resolvePreferenceConflicts(
        user.preferences,
        preferenceUpdates
      );

      // Validate resolved preference updates
      const validation = UserValidation.validatePreferences(resolvedPreferences);
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

      // Track preference changes
      const oldPreferences = { ...user.preferences };
      
      try {
        user.updatePreferences(resolvedPreferences);
        
        // Record preference history
        PreferencesController.recordPreferenceChanges(
          req.user.id,
          oldPreferences,
          user.preferences,
          reason
        );

        res.status(200).json({
          success: true,
          data: {
            preferences: user.preferences,
            conflicts: PreferencesController.getConflictWarnings(oldPreferences, resolvedPreferences),
            lastUpdated: user.updatedAt
          },
          timestamp: new Date().toISOString()
        });
      } catch (updateError) {
        res.status(400).json({
          error: {
            code: 'PREFERENCE_UPDATE_FAILED',
            message: updateError instanceof Error ? updateError.message : 'Failed to update preferences',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
      }
    } catch (error) {
      console.error('Update preferences error:', error);
      res.status(500).json({
        error: {
          code: 'PREFERENCES_UPDATE_FAILED',
          message: 'Failed to update user preferences',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  /**
   * Update specific cuisine preferences
   */
  static async updateCuisinePreferences(req: Request, res: Response): Promise<void> {
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

      const { cuisineTypes, action = 'replace' } = req.body; // action: 'add', 'remove', 'replace'

      if (!Array.isArray(cuisineTypes)) {
        res.status(400).json({
          error: {
            code: 'INVALID_CUISINE_TYPES',
            message: 'Cuisine types must be an array',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const { users } = getUserStorage();
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

      let newCuisineTypes: string[];
      
      switch (action) {
        case 'add':
          newCuisineTypes = [...new Set([...user.preferences.cuisineTypes, ...cuisineTypes])];
          break;
        case 'remove':
          newCuisineTypes = user.preferences.cuisineTypes.filter(cuisine => !cuisineTypes.includes(cuisine));
          break;
        case 'replace':
        default:
          newCuisineTypes = [...new Set(cuisineTypes)];
          break;
      }

      const preferenceUpdate = { cuisineTypes: newCuisineTypes };
      
      // Validate the update
      const validation = UserValidation.validatePreferences(preferenceUpdate);
      if (validation.error) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.message,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const oldPreferences = { ...user.preferences };
      user.updatePreferences(preferenceUpdate);

      // Record the change
      PreferencesController.recordPreferenceChanges(
        req.user.id,
        oldPreferences,
        user.preferences,
        `Cuisine preferences ${action}: ${cuisineTypes.join(', ')}`
      );

      res.status(200).json({
        success: true,
        data: {
          cuisineTypes: user.preferences.cuisineTypes,
          action,
          lastUpdated: user.updatedAt
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Update cuisine preferences error:', error);
      res.status(500).json({
        error: {
          code: 'CUISINE_UPDATE_FAILED',
          message: 'Failed to update cuisine preferences',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  /**
   * Update dietary restrictions
   */
  static async updateDietaryRestrictions(req: Request, res: Response): Promise<void> {
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

      const { dietaryRestrictions, action = 'replace' } = req.body;

      if (!Array.isArray(dietaryRestrictions)) {
        res.status(400).json({
          error: {
            code: 'INVALID_DIETARY_RESTRICTIONS',
            message: 'Dietary restrictions must be an array',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const { users } = getUserStorage();
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

      let newDietaryRestrictions: string[];
      
      switch (action) {
        case 'add':
          newDietaryRestrictions = [...new Set([...user.preferences.dietaryRestrictions, ...dietaryRestrictions])];
          break;
        case 'remove':
          newDietaryRestrictions = user.preferences.dietaryRestrictions.filter(restriction => !dietaryRestrictions.includes(restriction));
          break;
        case 'replace':
        default:
          newDietaryRestrictions = [...new Set(dietaryRestrictions)];
          break;
      }

      // Resolve conflicts automatically
      newDietaryRestrictions = PreferencesController.resolveDietaryConflicts(newDietaryRestrictions);

      // Check for remaining conflicts that can't be auto-resolved
      const conflicts = PreferencesController.checkDietaryConflicts(newDietaryRestrictions);
      if (conflicts.length > 0) {
        res.status(400).json({
          error: {
            code: 'DIETARY_CONFLICTS',
            message: 'Conflicting dietary restrictions detected',
            details: conflicts,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const preferenceUpdate = { dietaryRestrictions: newDietaryRestrictions };
      
      // Validate the update
      const validation = UserValidation.validatePreferences(preferenceUpdate);
      if (validation.error) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.message,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const oldPreferences = { ...user.preferences };
      user.updatePreferences(preferenceUpdate);

      // Record the change
      PreferencesController.recordPreferenceChanges(
        req.user.id,
        oldPreferences,
        user.preferences,
        `Dietary restrictions ${action}: ${dietaryRestrictions.join(', ')}`
      );

      res.status(200).json({
        success: true,
        data: {
          dietaryRestrictions: user.preferences.dietaryRestrictions,
          action,
          lastUpdated: user.updatedAt
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Update dietary restrictions error:', error);
      res.status(500).json({
        error: {
          code: 'DIETARY_UPDATE_FAILED',
          message: 'Failed to update dietary restrictions',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  /**
   * Update atmosphere preferences
   */
  static async updateAtmospherePreferences(req: Request, res: Response): Promise<void> {
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

      const { atmospherePreferences, action = 'replace' } = req.body;

      if (!Array.isArray(atmospherePreferences)) {
        res.status(400).json({
          error: {
            code: 'INVALID_ATMOSPHERE_PREFERENCES',
            message: 'Atmosphere preferences must be an array',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const { users } = getUserStorage();
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

      let newAtmospherePreferences: string[];
      
      switch (action) {
        case 'add':
          newAtmospherePreferences = [...new Set([...user.preferences.atmospherePreferences, ...atmospherePreferences])];
          break;
        case 'remove':
          newAtmospherePreferences = user.preferences.atmospherePreferences.filter(atmosphere => !atmospherePreferences.includes(atmosphere));
          break;
        case 'replace':
        default:
          newAtmospherePreferences = [...new Set(atmospherePreferences)];
          break;
      }

      const preferenceUpdate = { atmospherePreferences: newAtmospherePreferences };
      
      // Validate the update
      const validation = UserValidation.validatePreferences(preferenceUpdate);
      if (validation.error) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.message,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown'
          }
        });
        return;
      }

      const oldPreferences = { ...user.preferences };
      user.updatePreferences(preferenceUpdate);

      // Record the change
      PreferencesController.recordPreferenceChanges(
        req.user.id,
        oldPreferences,
        user.preferences,
        `Atmosphere preferences ${action}: ${atmospherePreferences.join(', ')}`
      );

      res.status(200).json({
        success: true,
        data: {
          atmospherePreferences: user.preferences.atmospherePreferences,
          action,
          lastUpdated: user.updatedAt
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Update atmosphere preferences error:', error);
      res.status(500).json({
        error: {
          code: 'ATMOSPHERE_UPDATE_FAILED',
          message: 'Failed to update atmosphere preferences',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  /**
   * Get preference history for a user
   */
  static async getPreferenceHistory(req: Request, res: Response): Promise<void> {
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

      const { limit = 50, offset = 0 } = req.query;
      const userHistory = preferenceHistory.get(req.user.id) || [];
      
      // Sort by timestamp (most recent first) and paginate
      const sortedHistory = userHistory
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(Number(offset), Number(offset) + Number(limit));

      res.status(200).json({
        success: true,
        data: {
          history: sortedHistory,
          total: userHistory.length,
          limit: Number(limit),
          offset: Number(offset)
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Get preference history error:', error);
      res.status(500).json({
        error: {
          code: 'HISTORY_FETCH_FAILED',
          message: 'Failed to fetch preference history',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
    }
  }

  /**
   * Resolve conflicts between old and new preferences
   */
  private static resolvePreferenceConflicts(
    oldPreferences: UserPreferences,
    newPreferences: Partial<UserPreferences>
  ): Partial<UserPreferences> {
    const resolved = { ...newPreferences };

    // Price range validation
    if (resolved.priceRange) {
      const [min, max] = resolved.priceRange;
      if (min > max) {
        resolved.priceRange = [max, min]; // Swap if reversed
      }
      if (min < 1) resolved.priceRange[0] = 1;
      if (max > 4) resolved.priceRange[1] = 4;
    }

    // Spice level validation
    if (resolved.spiceLevel !== undefined) {
      if (resolved.spiceLevel < 0) resolved.spiceLevel = 0;
      if (resolved.spiceLevel > 5) resolved.spiceLevel = 5;
    }

    // Dietary restrictions conflicts
    if (resolved.dietaryRestrictions) {
      resolved.dietaryRestrictions = PreferencesController.resolveDietaryConflicts(resolved.dietaryRestrictions);
    }

    return resolved;
  }

  /**
   * Check for dietary restriction conflicts
   */
  private static checkDietaryConflicts(restrictions: string[]): string[] {
    const conflicts: string[] = [];
    
    // Check for vegetarian/vegan conflicts with non-vegetarian options
    const hasVegetarian = restrictions.includes('Vegetarian');
    const hasVegan = restrictions.includes('Vegan');
    
    if (hasVegan && hasVegetarian) {
      conflicts.push('Vegan diet already includes vegetarian restrictions');
    }

    // Add more conflict checks as needed
    const conflictPairs = [
      ['Halal', 'Non-Halal'],
      ['Kosher', 'Non-Kosher'],
      ['Dairy-Free', 'Dairy-Required']
    ];

    conflictPairs.forEach(([restriction1, restriction2]) => {
      if (restrictions.includes(restriction1) && restrictions.includes(restriction2)) {
        conflicts.push(`${restriction1} and ${restriction2} are conflicting`);
      }
    });

    return conflicts;
  }

  /**
   * Resolve dietary restriction conflicts automatically
   */
  private static resolveDietaryConflicts(restrictions: string[]): string[] {
    let resolved = [...restrictions];

    // If both Vegan and Vegetarian are present, keep only Vegan
    if (resolved.includes('Vegan') && resolved.includes('Vegetarian')) {
      resolved = resolved.filter(r => r !== 'Vegetarian');
    }

    // Remove duplicates
    return [...new Set(resolved)];
  }

  /**
   * Get conflict warnings for preference updates
   */
  private static getConflictWarnings(
    oldPreferences: UserPreferences,
    newPreferences: Partial<UserPreferences>
  ): string[] {
    const warnings: string[] = [];

    // Check for significant changes
    if (newPreferences.priceRange && oldPreferences.priceRange) {
      const [oldMin, oldMax] = oldPreferences.priceRange;
      const [newMin, newMax] = newPreferences.priceRange;
      
      if (Math.abs(newMin - oldMin) > 1 || Math.abs(newMax - oldMax) > 1) {
        warnings.push('Significant price range change detected');
      }
    }

    if (newPreferences.spiceLevel !== undefined && oldPreferences.spiceLevel !== undefined) {
      if (Math.abs(newPreferences.spiceLevel - oldPreferences.spiceLevel) > 2) {
        warnings.push('Significant spice level change detected');
      }
    }

    return warnings;
  }

  /**
   * Record preference changes for history tracking
   */
  private static recordPreferenceChanges(
    userId: string,
    oldPreferences: UserPreferences,
    newPreferences: UserPreferences,
    reason?: string
  ): void {
    const changes: PreferenceChange[] = [];
    const timestamp = new Date();

    // Compare each field and record changes
    (Object.keys(newPreferences) as Array<keyof UserPreferences>).forEach(field => {
      const oldValue = oldPreferences[field];
      const newValue = newPreferences[field];

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          id: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId,
          field,
          oldValue,
          newValue,
          timestamp,
          reason
        });
      }
    });

    if (changes.length > 0) {
      const userHistory = preferenceHistory.get(userId) || [];
      userHistory.push(...changes);
      preferenceHistory.set(userId, userHistory);
    }
  }
}

// Helper function to get preference history storage (for testing purposes)
export const getPreferenceHistoryStorage = () => preferenceHistory;