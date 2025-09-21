import request from 'supertest';
import express from 'express';
import restaurantRoutes from '../routes/restaurantRoutes';
import metadataRoutes from '../routes/metadataRoutes';
import { restaurantModel } from '../models/Restaurant';
import { RestaurantCreateRequest } from '../../../shared/src/types/restaurant.types';

// Create test app
const app = express();
app.use(express.json());
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/restaurants', metadataRoutes);

describe('Metadata Controller', () => {
  let restaurantId: string;

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

  beforeEach(async () => {
    restaurantModel.clear();
    
    // Create a test restaurant
    const createResponse = await request(app)
      .post('/api/restaurants')
      .send(mockRestaurantData);
    
    restaurantId = createResponse.body.data.id;
  });

  describe('PUT /api/restaurants/:id/atmosphere', () => {
    it('should update restaurant atmosphere', async () => {
      const newAtmosphere = ['upscale', 'romantic', 'quiet'];
      
      const response = await request(app)
        .put(`/api/restaurants/${restaurantId}/atmosphere`)
        .send({ atmosphere: newAtmosphere })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.restaurantId).toBe(restaurantId);
      expect(response.body.data.atmosphere).toEqual(newAtmosphere);
    });

    it('should return validation error for invalid atmosphere', async () => {
      const response = await request(app)
        .put(`/api/restaurants/${restaurantId}/atmosphere`)
        .send({ atmosphere: [] })
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent restaurant', async () => {
      const response = await request(app)
        .put('/api/restaurants/non-existent-id/atmosphere')
        .send({ atmosphere: ['casual'] })
        .expect(404);

      expect(response.body.error.code).toBe('RESTAURANT_NOT_FOUND');
    });
  });

  describe('PUT /api/restaurants/:id/features', () => {
    it('should update special features', async () => {
      const newFeatures = ['live-music', 'private-dining', 'valet-parking'];
      
      const response = await request(app)
        .put(`/api/restaurants/${restaurantId}/features`)
        .send({ specialFeatures: newFeatures })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.specialFeatures).toEqual(newFeatures);
    });

    it('should allow empty special features array', async () => {
      const response = await request(app)
        .put(`/api/restaurants/${restaurantId}/features`)
        .send({ specialFeatures: [] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.specialFeatures).toEqual([]);
    });

    it('should return validation error for invalid features', async () => {
      const response = await request(app)
        .put(`/api/restaurants/${restaurantId}/features`)
        .send({ specialFeatures: [''] })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /api/restaurants/:id/local-gem', () => {
    it('should update local gem status', async () => {
      const response = await request(app)
        .put(`/api/restaurants/${restaurantId}/local-gem`)
        .send({ 
          isLocalGem: true,
          authenticityScore: 0.85
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isLocalGem).toBe(true);
      expect(response.body.data.authenticityScore).toBe(0.85);
    });

    it('should update local gem status without authenticity score', async () => {
      const response = await request(app)
        .put(`/api/restaurants/${restaurantId}/local-gem`)
        .send({ isLocalGem: false })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isLocalGem).toBe(false);
    });

    it('should return validation error for invalid authenticity score', async () => {
      const response = await request(app)
        .put(`/api/restaurants/${restaurantId}/local-gem`)
        .send({ 
          isLocalGem: true,
          authenticityScore: 1.5
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Menu Highlights Management', () => {
    describe('GET /api/restaurants/:id/menu-highlights', () => {
      it('should get all menu highlights', async () => {
        const response = await request(app)
          .get(`/api/restaurants/${restaurantId}/menu-highlights`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.menuHighlights).toHaveLength(1);
        expect(response.body.data.menuHighlights[0].name).toBe('Har Gow');
      });

      it('should filter menu highlights by category', async () => {
        const response = await request(app)
          .get(`/api/restaurants/${restaurantId}/menu-highlights`)
          .query({ category: 'Dim Sum' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.menuHighlights).toHaveLength(1);
        expect(response.body.data.filters.category).toBe('Dim Sum');
      });

      it('should filter signature dishes only', async () => {
        const response = await request(app)
          .get(`/api/restaurants/${restaurantId}/menu-highlights`)
          .query({ signatureOnly: 'true' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.menuHighlights).toHaveLength(1);
        expect(response.body.data.filters.signatureOnly).toBe(true);
      });
    });

    describe('POST /api/restaurants/:id/menu-highlights', () => {
      it('should add new menu highlight', async () => {
        const newMenuItem = {
          id: 'item2',
          name: 'Siu Mai',
          description: 'Steamed pork dumplings',
          price: 40,
          category: 'Dim Sum',
          isSignatureDish: false,
          dietaryInfo: [],
          spiceLevel: 0
        };

        const response = await request(app)
          .post(`/api/restaurants/${restaurantId}/menu-highlights`)
          .send(newMenuItem)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.menuItem.name).toBe('Siu Mai');
        expect(response.body.data.totalMenuHighlights).toBe(2);
      });

      it('should return validation error for invalid menu item', async () => {
        const invalidMenuItem = {
          id: 'item2',
          name: '',
          category: 'Dim Sum',
          isSignatureDish: false,
          dietaryInfo: []
        };

        const response = await request(app)
          .post(`/api/restaurants/${restaurantId}/menu-highlights`)
          .send(invalidMenuItem)
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });

      it('should return error for duplicate menu item ID', async () => {
        const duplicateMenuItem = {
          id: 'item1', // Same as existing
          name: 'Duplicate Item',
          category: 'Main',
          isSignatureDish: false,
          dietaryInfo: []
        };

        const response = await request(app)
          .post(`/api/restaurants/${restaurantId}/menu-highlights`)
          .send(duplicateMenuItem)
          .expect(400);

        expect(response.body.error.code).toBe('DUPLICATE_MENU_ITEM');
      });
    });

    describe('PUT /api/restaurants/:id/menu-highlights/:itemId', () => {
      it('should update existing menu highlight', async () => {
        const updates = {
          name: 'Premium Har Gow',
          price: 55,
          description: 'Premium steamed shrimp dumplings with truffle'
        };

        const response = await request(app)
          .put(`/api/restaurants/${restaurantId}/menu-highlights/item1`)
          .send(updates)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.menuItem.name).toBe('Premium Har Gow');
        expect(response.body.data.menuItem.price).toBe(55);
      });

      it('should return 404 for non-existent menu item', async () => {
        const response = await request(app)
          .put(`/api/restaurants/${restaurantId}/menu-highlights/non-existent`)
          .send({ name: 'Updated Name' })
          .expect(404);

        expect(response.body.error.code).toBe('MENU_ITEM_NOT_FOUND');
      });
    });

    describe('DELETE /api/restaurants/:id/menu-highlights/:itemId', () => {
      it('should remove menu highlight', async () => {
        const response = await request(app)
          .delete(`/api/restaurants/${restaurantId}/menu-highlights/item1`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.removedItemId).toBe('item1');
        expect(response.body.data.remainingMenuHighlights).toBe(0);
      });

      it('should return 404 for non-existent menu item', async () => {
        const response = await request(app)
          .delete(`/api/restaurants/${restaurantId}/menu-highlights/non-existent`)
          .expect(404);

        expect(response.body.error.code).toBe('MENU_ITEM_NOT_FOUND');
      });
    });
  });

  describe('POST /api/restaurants/:id/seasonal-offerings', () => {
    it('should add seasonal offering', async () => {
      const seasonalOffering = {
        offering: 'Mooncake Festival Special Menu',
        season: 'festival',
        startDate: '2024-09-01',
        endDate: '2024-09-30'
      };

      const response = await request(app)
        .post(`/api/restaurants/${restaurantId}/seasonal-offerings`)
        .send(seasonalOffering)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.seasonalOffering.offering).toBe(seasonalOffering.offering);
      expect(response.body.data.seasonalOffering.season).toBe(seasonalOffering.season);
      expect(response.body.data.seasonalOffering.tags).toContain('seasonal-festival');
    });

    it('should return validation error for invalid season', async () => {
      const invalidOffering = {
        offering: 'Test Offering',
        season: 'invalid-season'
      };

      const response = await request(app)
        .post(`/api/restaurants/${restaurantId}/seasonal-offerings`)
        .send(invalidOffering)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/restaurants/:id/summary', () => {
    beforeEach(async () => {
      // Add some metadata to test
      await request(app)
        .put(`/api/restaurants/${restaurantId}/local-gem`)
        .send({ isLocalGem: true, authenticityScore: 0.9 });

      await request(app)
        .post(`/api/restaurants/${restaurantId}/seasonal-offerings`)
        .send({
          offering: 'Summer Special',
          season: 'summer'
        });
    });

    it('should get metadata summary', async () => {
      const response = await request(app)
        .get(`/api/restaurants/${restaurantId}/summary`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.metadata).toBeDefined();
      expect(response.body.data.metadata.isLocalGem).toBe(true);
      expect(response.body.data.metadata.authenticityScore).toBe(0.9);
      expect(response.body.data.metadata.seasonalFeatures).toContain('summer');
      expect(response.body.data.metadata.menuHighlights.total).toBe(1);
      expect(response.body.data.metadata.menuHighlights.signatureDishes).toBe(1);
    });

    it('should return 404 for non-existent restaurant', async () => {
      const response = await request(app)
        .get('/api/restaurants/non-existent-id/summary')
        .expect(404);

      expect(response.body.error.code).toBe('RESTAURANT_NOT_FOUND');
    });
  });

  describe('Error handling', () => {
    it('should handle server errors gracefully', async () => {
      // Mock a server error by using invalid restaurant ID format that causes internal error
      jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // This should trigger an internal error in the metadata controller
      const response = await request(app)
        .put('/api/restaurants/null/atmosphere')
        .send({ atmosphere: ['casual'] });

      expect(response.status).toBeGreaterThanOrEqual(400);
      
      jest.restoreAllMocks();
    });
  });
});