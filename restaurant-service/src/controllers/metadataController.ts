import { Request, Response } from 'express';
import { restaurantRepository } from '../repositories/RestaurantRepository';
import { MenuItem } from '../../../shared/src/types/restaurant.types';
import Joi from 'joi';

/**
 * Update restaurant atmosphere
 */
export async function updateAtmosphere(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { atmosphere } = req.body;

    // Validate atmosphere data
    const schema = Joi.object({
      atmosphere: Joi.array().items(Joi.string().min(1).max(50)).min(1).required()
    });

    const { error } = schema.validate({ atmosphere });
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details.map(d => d.message).join(', '),
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const restaurant = await restaurantRepository.update(id, { atmosphere });
    
    if (!restaurant) {
      res.status(404).json({
        error: {
          code: 'RESTAURANT_NOT_FOUND',
          message: 'Restaurant not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        restaurantId: id,
        atmosphere: restaurant.atmosphere
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating atmosphere:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update atmosphere',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
}

/**
 * Update restaurant special features
 */
export async function updateSpecialFeatures(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { specialFeatures } = req.body;

    // Validate special features data
    const schema = Joi.object({
      specialFeatures: Joi.array().items(Joi.string().min(1).max(100)).required()
    });

    const { error } = schema.validate({ specialFeatures });
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details.map(d => d.message).join(', '),
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const restaurant = await restaurantRepository.update(id, { specialFeatures });
    
    if (!restaurant) {
      res.status(404).json({
        error: {
          code: 'RESTAURANT_NOT_FOUND',
          message: 'Restaurant not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        restaurantId: id,
        specialFeatures: restaurant.specialFeatures
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating special features:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update special features',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
}

/**
 * Update local gem status
 */
export async function updateLocalGemStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { isLocalGem, authenticityScore } = req.body;

    // Validate local gem data
    const schema = Joi.object({
      isLocalGem: Joi.boolean().required(),
      authenticityScore: Joi.number().min(0).max(1).optional()
    });

    const { error } = schema.validate({ isLocalGem, authenticityScore });
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details.map(d => d.message).join(', '),
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const updateData: any = { isLocalGem };
    if (authenticityScore !== undefined) {
      updateData.authenticityScore = authenticityScore;
    }

    const restaurant = await restaurantRepository.update(id, updateData);
    
    if (!restaurant) {
      res.status(404).json({
        error: {
          code: 'RESTAURANT_NOT_FOUND',
          message: 'Restaurant not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        restaurantId: id,
        isLocalGem: restaurant.isLocalGem,
        authenticityScore: restaurant.authenticityScore
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating local gem status:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update local gem status',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
}

/**
 * Add menu highlight
 */
export async function addMenuHighlight(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const menuItem = req.body;

    // Validate menu item data
    const schema = Joi.object({
      id: Joi.string().required(),
      name: Joi.string().min(1).max(100).required(),
      description: Joi.string().max(500).optional(),
      price: Joi.number().min(0).optional(),
      category: Joi.string().min(1).max(50).required(),
      isSignatureDish: Joi.boolean().required(),
      dietaryInfo: Joi.array().items(Joi.string().max(50)).required(),
      spiceLevel: Joi.number().min(0).max(5).optional()
    });

    const { error } = schema.validate(menuItem);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details.map(d => d.message).join(', '),
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const restaurant = await restaurantRepository.findById(id);
    if (!restaurant) {
      res.status(404).json({
        error: {
          code: 'RESTAURANT_NOT_FOUND',
          message: 'Restaurant not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    // Check if menu item ID already exists
    const existingItem = restaurant.menuHighlights.find(item => item.id === menuItem.id);
    if (existingItem) {
      res.status(400).json({
        error: {
          code: 'DUPLICATE_MENU_ITEM',
          message: 'Menu item with this ID already exists',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const updatedMenuHighlights = [...restaurant.menuHighlights, menuItem];
    const updatedRestaurant = await restaurantRepository.update(id, { 
      menuHighlights: updatedMenuHighlights 
    });

    res.status(201).json({
      success: true,
      data: {
        restaurantId: id,
        menuItem: menuItem,
        totalMenuHighlights: updatedRestaurant!.menuHighlights.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error adding menu highlight:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to add menu highlight',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
}

/**
 * Update menu highlight
 */
export async function updateMenuHighlight(req: Request, res: Response): Promise<void> {
  try {
    const { id, itemId } = req.params;
    const updates = req.body;

    // Validate menu item updates
    const schema = Joi.object({
      name: Joi.string().min(1).max(100).optional(),
      description: Joi.string().max(500).optional(),
      price: Joi.number().min(0).optional(),
      category: Joi.string().min(1).max(50).optional(),
      isSignatureDish: Joi.boolean().optional(),
      dietaryInfo: Joi.array().items(Joi.string().max(50)).optional(),
      spiceLevel: Joi.number().min(0).max(5).optional()
    });

    const { error } = schema.validate(updates);
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details.map(d => d.message).join(', '),
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const restaurant = await restaurantRepository.findById(id);
    if (!restaurant) {
      res.status(404).json({
        error: {
          code: 'RESTAURANT_NOT_FOUND',
          message: 'Restaurant not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const menuItemIndex = restaurant.menuHighlights.findIndex(item => item.id === itemId);
    if (menuItemIndex === -1) {
      res.status(404).json({
        error: {
          code: 'MENU_ITEM_NOT_FOUND',
          message: 'Menu item not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const updatedMenuHighlights = [...restaurant.menuHighlights];
    updatedMenuHighlights[menuItemIndex] = {
      ...updatedMenuHighlights[menuItemIndex],
      ...updates
    };

    const updatedRestaurant = await restaurantRepository.update(id, { 
      menuHighlights: updatedMenuHighlights 
    });

    res.json({
      success: true,
      data: {
        restaurantId: id,
        menuItem: updatedMenuHighlights[menuItemIndex]
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating menu highlight:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update menu highlight',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
}

/**
 * Remove menu highlight
 */
export async function removeMenuHighlight(req: Request, res: Response): Promise<void> {
  try {
    const { id, itemId } = req.params;

    const restaurant = await restaurantRepository.findById(id);
    if (!restaurant) {
      res.status(404).json({
        error: {
          code: 'RESTAURANT_NOT_FOUND',
          message: 'Restaurant not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const menuItemIndex = restaurant.menuHighlights.findIndex(item => item.id === itemId);
    if (menuItemIndex === -1) {
      res.status(404).json({
        error: {
          code: 'MENU_ITEM_NOT_FOUND',
          message: 'Menu item not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const updatedMenuHighlights = restaurant.menuHighlights.filter(item => item.id !== itemId);
    await restaurantRepository.update(id, { menuHighlights: updatedMenuHighlights });

    res.json({
      success: true,
      message: 'Menu highlight removed successfully',
      data: {
        restaurantId: id,
        removedItemId: itemId,
        remainingMenuHighlights: updatedMenuHighlights.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error removing menu highlight:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to remove menu highlight',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
}

/**
 * Get restaurant menu highlights
 */
export async function getMenuHighlights(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { category, signatureOnly } = req.query;

    const restaurant = await restaurantRepository.findById(id);
    if (!restaurant) {
      res.status(404).json({
        error: {
          code: 'RESTAURANT_NOT_FOUND',
          message: 'Restaurant not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    let menuHighlights = restaurant.menuHighlights;

    // Filter by category if specified
    if (category) {
      menuHighlights = menuHighlights.filter(item => 
        item.category.toLowerCase() === (category as string).toLowerCase()
      );
    }

    // Filter signature dishes only if specified
    if (signatureOnly === 'true') {
      menuHighlights = menuHighlights.filter(item => item.isSignatureDish);
    }

    res.json({
      success: true,
      data: {
        restaurantId: id,
        restaurantName: restaurant.name,
        menuHighlights,
        count: menuHighlights.length,
        filters: {
          category: category || null,
          signatureOnly: signatureOnly === 'true'
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting menu highlights:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get menu highlights',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
}

/**
 * Add seasonal offering
 */
export async function addSeasonalOffering(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { offering, season, startDate, endDate } = req.body;

    // Validate seasonal offering data
    const schema = Joi.object({
      offering: Joi.string().min(1).max(200).required(),
      season: Joi.string().valid('spring', 'summer', 'autumn', 'winter', 'holiday', 'festival').required(),
      startDate: Joi.date().optional(),
      endDate: Joi.date().optional()
    });

    const { error } = schema.validate({ offering, season, startDate, endDate });
    if (error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details.map(d => d.message).join(', '),
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const restaurant = await restaurantRepository.findById(id);
    if (!restaurant) {
      res.status(404).json({
        error: {
          code: 'RESTAURANT_NOT_FOUND',
          message: 'Restaurant not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    // Add seasonal offering to special features
    const seasonalTag = `seasonal-${season}`;
    const offeringTag = `offering-${offering.toLowerCase().replace(/\s+/g, '-')}`;
    
    const updatedSpecialFeatures = [
      ...restaurant.specialFeatures.filter(feature => 
        !feature.startsWith('seasonal-') && !feature.startsWith('offering-')
      ),
      seasonalTag,
      offeringTag
    ];

    const updatedRestaurant = await restaurantRepository.update(id, { 
      specialFeatures: updatedSpecialFeatures 
    });

    res.status(201).json({
      success: true,
      data: {
        restaurantId: id,
        seasonalOffering: {
          offering,
          season,
          startDate,
          endDate,
          tags: [seasonalTag, offeringTag]
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error adding seasonal offering:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to add seasonal offering',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
}

/**
 * Get restaurant metadata summary
 */
export async function getMetadataSummary(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const restaurant = await restaurantRepository.findById(id);
    if (!restaurant) {
      res.status(404).json({
        error: {
          code: 'RESTAURANT_NOT_FOUND',
          message: 'Restaurant not found',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    // Extract seasonal and offering features
    const seasonalFeatures = restaurant.specialFeatures.filter(feature => 
      feature.startsWith('seasonal-')
    );
    const offeringFeatures = restaurant.specialFeatures.filter(feature => 
      feature.startsWith('offering-')
    );
    const regularFeatures = restaurant.specialFeatures.filter(feature => 
      !feature.startsWith('seasonal-') && !feature.startsWith('offering-')
    );

    // Count signature dishes
    const signatureDishes = restaurant.menuHighlights.filter(item => item.isSignatureDish);
    const menuCategories = [...new Set(restaurant.menuHighlights.map(item => item.category))];

    res.json({
      success: true,
      data: {
        restaurantId: id,
        restaurantName: restaurant.name,
        metadata: {
          atmosphere: restaurant.atmosphere,
          regularFeatures,
          seasonalFeatures: seasonalFeatures.map(f => f.replace('seasonal-', '')),
          currentOfferings: offeringFeatures.map(f => f.replace('offering-', '').replace(/-/g, ' ')),
          isLocalGem: restaurant.isLocalGem,
          authenticityScore: restaurant.authenticityScore,
          menuHighlights: {
            total: restaurant.menuHighlights.length,
            signatureDishes: signatureDishes.length,
            categories: menuCategories
          }
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting metadata summary:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get metadata summary',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
}