import { Request, Response } from 'express';
import { restaurantRepository } from '../repositories/RestaurantRepository';
import { validateRestaurantCreate, validateRestaurantUpdate, validateRestaurantSearch } from '../validation/restaurantValidation';
import { RestaurantSearchRequest } from '../../../shared/src/types/restaurant.types';

/**
 * Create a new restaurant
 */
export async function createRestaurant(req: Request, res: Response): Promise<void> {
  try {
    const validation = validateRestaurantCreate(req.body);
    
    if (validation.error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const restaurant = await restaurantRepository.create(validation.value!);
    
    res.status(201).json({
      success: true,
      data: restaurant,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating restaurant:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create restaurant',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
}

/**
 * Get restaurant by ID
 */
export async function getRestaurant(req: Request, res: Response): Promise<void> {
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
    
    res.json({
      success: true,
      data: restaurant,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting restaurant:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get restaurant',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
}

/**
 * Search restaurants with filtering and sorting
 */
export async function searchRestaurants(req: Request, res: Response): Promise<void> {
  try {
    const validation = validateRestaurantSearch(req.query);
    
    if (validation.error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const searchCriteria: RestaurantSearchRequest = validation.value;
    const restaurants = await restaurantRepository.search(searchCriteria);
    
    res.json({
      success: true,
      data: {
        restaurants,
        count: restaurants.length,
        searchCriteria
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error searching restaurants:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to search restaurants',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
}

/**
 * Get nearby restaurants
 */
export async function getNearbyRestaurants(req: Request, res: Response): Promise<void> {
  try {
    const { latitude, longitude, radius } = req.query;
    
    if (!latitude || !longitude) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Latitude and longitude are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const lat = parseFloat(latitude as string);
    const lng = parseFloat(longitude as string);
    const radiusKm = radius ? parseFloat(radius as string) : 5;

    if (isNaN(lat) || isNaN(lng) || isNaN(radiusKm)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid coordinates or radius',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const restaurants = await restaurantRepository.findByLocation(lat, lng, radiusKm);
    
    res.json({
      success: true,
      data: {
        restaurants,
        count: restaurants.length,
        searchLocation: { latitude: lat, longitude: lng, radius: radiusKm }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting nearby restaurants:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get nearby restaurants',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
}

/**
 * Get restaurants by cuisine type
 */
export async function getRestaurantsByCuisine(req: Request, res: Response): Promise<void> {
  try {
    const { cuisines } = req.query;
    
    if (!cuisines) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Cuisine types are required',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const cuisineTypes = Array.isArray(cuisines) ? cuisines as string[] : [cuisines as string];
    const restaurants = await restaurantRepository.findByCuisine(cuisineTypes);
    
    res.json({
      success: true,
      data: {
        restaurants,
        count: restaurants.length,
        cuisineTypes
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting restaurants by cuisine:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get restaurants by cuisine',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
}

/**
 * Check if restaurant is currently open
 */
export async function checkRestaurantAvailability(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { checkTime } = req.query;
    
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

    const timeToCheck = checkTime ? new Date(checkTime as string) : new Date();
    const isOpen = await restaurantRepository.isOpen(id, timeToCheck);
    
    res.json({
      success: true,
      data: {
        restaurantId: id,
        restaurantName: restaurant.name,
        isOpen,
        checkTime: timeToCheck.toISOString(),
        operatingHours: restaurant.operatingHours
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking restaurant availability:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to check restaurant availability',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
}

/**
 * Get all currently open restaurants
 */
export async function getOpenRestaurants(req: Request, res: Response): Promise<void> {
  try {
    const restaurants = await restaurantRepository.findOpenRestaurants();
    
    res.json({
      success: true,
      data: {
        restaurants,
        count: restaurants.length,
        checkTime: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting open restaurants:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get open restaurants',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
}

/**
 * Update restaurant
 */
export async function updateRestaurant(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const validation = validateRestaurantUpdate(req.body);
    
    if (validation.error) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.error,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown'
        }
      });
      return;
    }

    const restaurant = await restaurantRepository.update(id, validation.value!);
    
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
      data: restaurant,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating restaurant:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update restaurant',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
}

/**
 * Delete restaurant
 */
export async function deleteRestaurant(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const deleted = await restaurantRepository.delete(id);
    
    if (!deleted) {
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
      message: 'Restaurant deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error deleting restaurant:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete restaurant',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown'
      }
    });
  }
}