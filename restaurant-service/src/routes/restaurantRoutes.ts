import { Router } from 'express';
import {
  createRestaurant,
  getRestaurant,
  searchRestaurants,
  getNearbyRestaurants,
  getRestaurantsByCuisine,
  checkRestaurantAvailability,
  getOpenRestaurants,
  updateRestaurant,
  deleteRestaurant
} from '../controllers/restaurantController';

const router = Router();

// Restaurant CRUD operations
router.post('/', createRestaurant);
router.get('/:id', getRestaurant);
router.put('/:id', updateRestaurant);
router.delete('/:id', deleteRestaurant);

// Restaurant search and filtering
router.get('/', searchRestaurants); // This should be after specific routes to avoid conflicts
router.get('/search/nearby', getNearbyRestaurants);
router.get('/search/cuisine', getRestaurantsByCuisine);
router.get('/search/open', getOpenRestaurants);

// Restaurant availability
router.get('/:id/availability', checkRestaurantAvailability);

export default router;