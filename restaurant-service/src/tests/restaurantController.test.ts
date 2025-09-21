import request from 'supertest';
import express from 'express';
import restaurantRoutes from '../routes/restaurantRoutes';
import { restaurantModel } from '../models/Restaurant';
import { RestaurantCreateRequest } from '../../../shared/src/types/restaurant.types';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/restaurants', restaurantRoutes);

describe('Restaurant Controller', () => {
  beforeEach(() => {
    restaurantModel.clear();
  });

  const mockRestaurantData: RestaurantCreateRequest = {
    name: 'Test Restaurant',
    cuisineType: ['Cantonese', 'Dim Sum'],
    location: {
      address: '123 Test Street, Central, Hong Kong',
      latitude: 22.2783,
      longitude: 114.1747,
      district: 'Central'
    },
    priceRange: 2,
    atmosphere: ['casual', 'family-friendly'],
    operatingHours: {
      monday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
      tuesday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
      wednesday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
      thursday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
      friday: { isOpen: true, openTime: '09:00', closeTime: '23:00' },
      saturday: { isOpen: true, openTime: '08:00', closeTime: '23:00' },
      sunday: { isOpen: true, openTime: '08:00', closeTime: '22:00' }
    },
    menuHighlights: [
      {
        id: 'item1',
        name: 'Har Gow',
        description: 'Steamed shrimp dumplings',
        price: 45,
        category: 'Dim Sum',
        isSignatureDish: true,
        dietaryInfo: ['gluten-free'],
        spiceLevel: 0
      }
    ],
    specialFeatures: ['wheelchair-accessible', 'outdoor-seating']
  };

  describe('POST /api/restaurants', () => {
    it('should create a new restaurant', async () => {
      const response = await request(app)
        .post('/api/restaurants')
        .send(mockRestaurantData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.name).toBe(mockRestaurantData.name);
      expect(response.body.data.id).toBeDefined();
    });

    it('should return validation error for invalid data', async () => {
      const invalidData = { ...mockRestaurantData, name: '' };
      
      const response = await request(app)
        .post('/api/restaurants')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return validation error for missing required fields', async () => {
      const response = await request(app)
        .post('/api/restaurants')
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/restaurants/:id', () => {
    it('should get restaurant by ID', async () => {
      // Create a restaurant first
      const createResponse = await request(app)
        .post('/api/restaurants')
        .send(mockRestaurantData);

      const restaurantId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/restaurants/${restaurantId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(restaurantId);
      expect(response.body.data.name).toBe(mockRestaurantData.name);
    });

    it('should return 404 for non-existent restaurant', async () => {
      const response = await request(app)
        .get('/api/restaurants/non-existent-id')
        .expect(404);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('RESTAURANT_NOT_FOUND');
    });
  });

  describe('GET /api/restaurants/search/nearby', () => {
    beforeEach(async () => {
      // Create test restaurants at different locations
      await request(app)
        .post('/api/restaurants')
        .send({
          ...mockRestaurantData,
          name: 'Central Restaurant',
          location: {
            address: 'Central, Hong Kong',
            latitude: 22.2783,
            longitude: 114.1747,
            district: 'Central'
          }
        });

      await request(app)
        .post('/api/restaurants')
        .send({
          ...mockRestaurantData,
          name: 'TST Restaurant',
          location: {
            address: 'Tsim Sha Tsui, Hong Kong',
            latitude: 22.2988,
            longitude: 114.1722,
            district: 'Tsim Sha Tsui'
          }
        });
    });

    it('should find nearby restaurants', async () => {
      const response = await request(app)
        .get('/api/restaurants/search/nearby')
        .query({
          latitude: 22.2783,
          longitude: 114.1747,
          radius: 5
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.restaurants).toBeDefined();
      expect(response.body.data.count).toBeGreaterThan(0);
      expect(response.body.data.searchLocation).toEqual({
        latitude: 22.2783,
        longitude: 114.1747,
        radius: 5
      });
    });

    it('should return validation error for missing coordinates', async () => {
      const response = await request(app)
        .get('/api/restaurants/search/nearby')
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('Latitude and longitude are required');
    });

    it('should return validation error for invalid coordinates', async () => {
      const response = await request(app)
        .get('/api/restaurants/search/nearby')
        .query({
          latitude: 'invalid',
          longitude: 'invalid'
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('Invalid coordinates');
    });
  });

  describe('GET /api/restaurants/search/cuisine', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/restaurants')
        .send({
          ...mockRestaurantData,
          name: 'Cantonese Restaurant',
          cuisineType: ['Cantonese']
        });

      await request(app)
        .post('/api/restaurants')
        .send({
          ...mockRestaurantData,
          name: 'Italian Restaurant',
          cuisineType: ['Italian']
        });
    });

    it('should find restaurants by cuisine type', async () => {
      const response = await request(app)
        .get('/api/restaurants/search/cuisine')
        .query({ cuisines: 'Cantonese' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.restaurants).toBeDefined();
      expect(response.body.data.count).toBe(1);
      expect(response.body.data.restaurants[0].name).toBe('Cantonese Restaurant');
    });

    it('should find restaurants by multiple cuisine types', async () => {
      const response = await request(app)
        .get('/api/restaurants/search/cuisine')
        .query({ cuisines: ['Cantonese', 'Italian'] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBe(2);
    });

    it('should return validation error for missing cuisine types', async () => {
      const response = await request(app)
        .get('/api/restaurants/search/cuisine')
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('Cuisine types are required');
    });
  });

  describe('GET /api/restaurants/:id/availability', () => {
    let restaurantId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/restaurants')
        .send(mockRestaurantData);
      restaurantId = createResponse.body.data.id;
    });

    it('should check restaurant availability', async () => {
      const response = await request(app)
        .get(`/api/restaurants/${restaurantId}/availability`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.restaurantId).toBe(restaurantId);
      expect(response.body.data.restaurantName).toBe(mockRestaurantData.name);
      expect(typeof response.body.data.isOpen).toBe('boolean');
      expect(response.body.data.operatingHours).toBeDefined();
    });

    it('should check availability at specific time', async () => {
      const checkTime = '2024-01-01T15:00:00.000Z';
      
      const response = await request(app)
        .get(`/api/restaurants/${restaurantId}/availability`)
        .query({ checkTime })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.checkTime).toBe(checkTime);
    });

    it('should return 404 for non-existent restaurant', async () => {
      const response = await request(app)
        .get('/api/restaurants/non-existent-id/availability')
        .expect(404);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('RESTAURANT_NOT_FOUND');
    });
  });

  describe('GET /api/restaurants/search/open', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/restaurants')
        .send({
          ...mockRestaurantData,
          name: 'Always Open Restaurant'
        });

      await request(app)
        .post('/api/restaurants')
        .send({
          ...mockRestaurantData,
          name: 'Closed Restaurant',
          operatingHours: {
            monday: { isOpen: false },
            tuesday: { isOpen: false },
            wednesday: { isOpen: false },
            thursday: { isOpen: false },
            friday: { isOpen: false },
            saturday: { isOpen: false },
            sunday: { isOpen: false }
          }
        });
    });

    it('should find currently open restaurants', async () => {
      const response = await request(app)
        .get('/api/restaurants/search/open')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.restaurants).toBeDefined();
      expect(response.body.data.count).toBeGreaterThanOrEqual(0);
      expect(response.body.data.checkTime).toBeDefined();
    });
  });

  describe('PUT /api/restaurants/:id', () => {
    let restaurantId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/restaurants')
        .send(mockRestaurantData);
      restaurantId = createResponse.body.data.id;
    });

    it('should update restaurant', async () => {
      const updateData = {
        name: 'Updated Restaurant Name',
        rating: 4.5
      };

      const response = await request(app)
        .put(`/api/restaurants/${restaurantId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.rating).toBe(updateData.rating);
    });

    it('should return 404 for non-existent restaurant', async () => {
      const response = await request(app)
        .put('/api/restaurants/non-existent-id')
        .send({ name: 'Test' })
        .expect(404);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('RESTAURANT_NOT_FOUND');
    });

    it('should return validation error for invalid update data', async () => {
      const response = await request(app)
        .put(`/api/restaurants/${restaurantId}`)
        .send({ rating: 6 }) // Invalid rating
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/restaurants/:id', () => {
    let restaurantId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/restaurants')
        .send(mockRestaurantData);
      restaurantId = createResponse.body.data.id;
    });

    it('should delete restaurant', async () => {
      const response = await request(app)
        .delete(`/api/restaurants/${restaurantId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');

      // Verify restaurant is deleted
      await request(app)
        .get(`/api/restaurants/${restaurantId}`)
        .expect(404);
    });

    it('should return 404 for non-existent restaurant', async () => {
      const response = await request(app)
        .delete('/api/restaurants/non-existent-id')
        .expect(404);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('RESTAURANT_NOT_FOUND');
    });
  });

  describe('Advanced search functionality', () => {
    beforeEach(async () => {
      // Create restaurants with different characteristics for testing
      await request(app)
        .post('/api/restaurants')
        .send({
          ...mockRestaurantData,
          name: 'Budget Cantonese',
          cuisineType: ['Cantonese'],
          priceRange: 1,
          location: {
            address: 'Central, Hong Kong',
            latitude: 22.2783,
            longitude: 114.1747,
            district: 'Central'
          },
          specialFeatures: ['wheelchair-accessible']
        });

      await request(app)
        .post('/api/restaurants')
        .send({
          ...mockRestaurantData,
          name: 'Upscale Italian',
          cuisineType: ['Italian'],
          priceRange: 4,
          location: {
            address: 'TST, Hong Kong',
            latitude: 22.2988,
            longitude: 114.1722,
            district: 'Tsim Sha Tsui'
          },
          specialFeatures: ['outdoor-seating', 'live-music']
        });
    });

    it('should search with multiple criteria', async () => {
      const response = await request(app)
        .get('/api/restaurants')
        .query({
          'location[latitude]': 22.2783,
          'location[longitude]': 114.1747,
          'location[radius]': 5,
          'cuisineTypes[]': 'Cantonese',
          'priceRange[]': [1, 2],
          'features[]': 'wheelchair-accessible',
          sortBy: 'distance'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.restaurants).toBeDefined();
      expect(response.body.data.searchCriteria).toBeDefined();
    });
  });
});