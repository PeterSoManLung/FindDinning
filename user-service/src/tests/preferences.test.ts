import request from 'supertest';
import { PreferencesController, getPreferenceHistoryStorage } from '../controllers/preferencesController';
import { getUserStorage } from '../controllers/authController';
import app from '../index';

describe('Preferences Management', () => {
  let authToken: string;
  let userId: string;

  beforeEach(async () => {
    // Clear storage
    const { users, usersByEmail } = getUserStorage();
    const preferenceHistory = getPreferenceHistoryStorage();
    users.clear();
    usersByEmail.clear();
    preferenceHistory.clear();

    // Register and login a user
    const registrationResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'TestPassword123!',
        name: 'Test User',
        preferences: {
          cuisineTypes: ['Japanese'],
          priceRange: [2, 4],
          dietaryRestrictions: ['Vegetarian'],
          atmospherePreferences: ['Casual'],
          spiceLevel: 3
        }
      });
    
    authToken = registrationResponse.body.data.token;
    userId = registrationResponse.body.data.user.id;
  });

  describe('GET /api/preferences', () => {
    it('should get user preferences successfully', async () => {
      const response = await request(app)
        .get('/api/preferences')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.preferences).toEqual({
        cuisineTypes: ['Japanese'],
        priceRange: [2, 4],
        dietaryRestrictions: ['Vegetarian'],
        atmospherePreferences: ['Casual'],
        spiceLevel: 3
      });
      expect(response.body.data.lastUpdated).toBeDefined();
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/preferences');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('PUT /api/preferences', () => {
    it('should update user preferences successfully', async () => {
      const updateData = {
        cuisineTypes: ['Korean', 'Thai'],
        priceRange: [1, 3],
        spiceLevel: 4,
        reason: 'Expanding taste preferences'
      };

      const response = await request(app)
        .put('/api/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.preferences.cuisineTypes).toEqual(['Korean', 'Thai']);
      expect(response.body.data.preferences.priceRange).toEqual([1, 3]);
      expect(response.body.data.preferences.spiceLevel).toBe(4);
      expect(response.body.data.conflicts).toBeDefined();
    });

    it('should resolve price range conflicts automatically', async () => {
      const updateData = {
        priceRange: [4, 1] // Reversed range
      };

      const response = await request(app)
        .put('/api/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.data.preferences.priceRange).toEqual([1, 4]); // Should be corrected
    });

    it('should validate spice level bounds', async () => {
      const updateData = {
        spiceLevel: 10 // Invalid - too high
      };

      const response = await request(app)
        .put('/api/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);



      expect(response.status).toBe(200);
      expect(response.body.data.preferences.spiceLevel).toBe(5); // Should be capped at 5
    });

    it('should return validation error for invalid cuisine types', async () => {
      const updateData = {
        cuisineTypes: ['InvalidCuisine']
      };

      const response = await request(app)
        .put('/api/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .put('/api/preferences')
        .send({ spiceLevel: 2 });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('PUT /api/preferences/cuisine', () => {
    it('should replace cuisine preferences', async () => {
      const response = await request(app)
        .put('/api/preferences/cuisine')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cuisineTypes: ['Korean', 'Thai'],
          action: 'replace'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.cuisineTypes).toEqual(['Korean', 'Thai']);
      expect(response.body.data.action).toBe('replace');
    });

    it('should add cuisine preferences', async () => {
      const response = await request(app)
        .put('/api/preferences/cuisine')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cuisineTypes: ['Korean', 'Thai'],
          action: 'add'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.cuisineTypes).toContain('Japanese'); // Original
      expect(response.body.data.cuisineTypes).toContain('Korean'); // Added
      expect(response.body.data.cuisineTypes).toContain('Thai'); // Added
    });

    it('should remove cuisine preferences', async () => {
      // First add more cuisines
      await request(app)
        .put('/api/preferences/cuisine')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cuisineTypes: ['Korean', 'Thai'],
          action: 'add'
        });

      // Then remove some
      const response = await request(app)
        .put('/api/preferences/cuisine')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cuisineTypes: ['Japanese'],
          action: 'remove'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.cuisineTypes).not.toContain('Japanese');
      expect(response.body.data.cuisineTypes).toContain('Korean');
      expect(response.body.data.cuisineTypes).toContain('Thai');
    });

    it('should handle duplicate cuisine types', async () => {
      const response = await request(app)
        .put('/api/preferences/cuisine')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cuisineTypes: ['Korean', 'Korean', 'Thai'],
          action: 'add'
        });

      expect(response.status).toBe(200);
      const cuisineCount = response.body.data.cuisineTypes.filter((c: string) => c === 'Korean').length;
      expect(cuisineCount).toBe(1); // Should deduplicate
    });

    it('should return error for invalid cuisine types array', async () => {
      const response = await request(app)
        .put('/api/preferences/cuisine')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cuisineTypes: 'not-an-array'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_CUISINE_TYPES');
    });
  });

  describe('PUT /api/preferences/dietary', () => {
    it('should replace dietary restrictions', async () => {
      const response = await request(app)
        .put('/api/preferences/dietary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          dietaryRestrictions: ['Vegan', 'Gluten-Free'],
          action: 'replace'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.dietaryRestrictions).toEqual(['Vegan', 'Gluten-Free']);
    });

    it('should add dietary restrictions', async () => {
      const response = await request(app)
        .put('/api/preferences/dietary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          dietaryRestrictions: ['Gluten-Free'],
          action: 'add'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.dietaryRestrictions).toContain('Vegetarian'); // Original
      expect(response.body.data.dietaryRestrictions).toContain('Gluten-Free'); // Added
    });

    it('should remove dietary restrictions', async () => {
      const response = await request(app)
        .put('/api/preferences/dietary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          dietaryRestrictions: ['Vegetarian'],
          action: 'remove'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.dietaryRestrictions).not.toContain('Vegetarian');
    });

    it('should resolve Vegan/Vegetarian conflicts', async () => {
      const response = await request(app)
        .put('/api/preferences/dietary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          dietaryRestrictions: ['Vegan', 'Vegetarian'],
          action: 'replace'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.dietaryRestrictions).toContain('Vegan');
      expect(response.body.data.dietaryRestrictions).not.toContain('Vegetarian'); // Should be removed
    });

    it('should return error for conflicting dietary restrictions', async () => {
      const response = await request(app)
        .put('/api/preferences/dietary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          dietaryRestrictions: ['Halal', 'Non-Halal'],
          action: 'replace'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('DIETARY_CONFLICTS');
      expect(response.body.error.details).toContain('Halal and Non-Halal are conflicting');
    });

    it('should return error for invalid dietary restrictions array', async () => {
      const response = await request(app)
        .put('/api/preferences/dietary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          dietaryRestrictions: 'not-an-array'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_DIETARY_RESTRICTIONS');
    });
  });

  describe('PUT /api/preferences/atmosphere', () => {
    it('should replace atmosphere preferences', async () => {
      const response = await request(app)
        .put('/api/preferences/atmosphere')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          atmospherePreferences: ['Fine Dining', 'Romantic'],
          action: 'replace'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.atmospherePreferences).toEqual(['Fine Dining', 'Romantic']);
    });

    it('should add atmosphere preferences', async () => {
      const response = await request(app)
        .put('/api/preferences/atmosphere')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          atmospherePreferences: ['Fine Dining', 'Outdoor Seating'],
          action: 'add'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.atmospherePreferences).toContain('Casual'); // Original
      expect(response.body.data.atmospherePreferences).toContain('Fine Dining'); // Added
      expect(response.body.data.atmospherePreferences).toContain('Outdoor Seating'); // Added
    });

    it('should remove atmosphere preferences', async () => {
      const response = await request(app)
        .put('/api/preferences/atmosphere')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          atmospherePreferences: ['Casual'],
          action: 'remove'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.atmospherePreferences).not.toContain('Casual');
    });

    it('should handle duplicate atmosphere preferences', async () => {
      const response = await request(app)
        .put('/api/preferences/atmosphere')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          atmospherePreferences: ['Fine Dining', 'Fine Dining', 'Romantic'],
          action: 'add'
        });

      expect(response.status).toBe(200);
      const fineDiningCount = response.body.data.atmospherePreferences.filter((a: string) => a === 'Fine Dining').length;
      expect(fineDiningCount).toBe(1); // Should deduplicate
    });

    it('should return error for invalid atmosphere preferences array', async () => {
      const response = await request(app)
        .put('/api/preferences/atmosphere')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          atmospherePreferences: 'not-an-array'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_ATMOSPHERE_PREFERENCES');
    });
  });

  describe('GET /api/preferences/history', () => {
    beforeEach(async () => {
      // Make some preference changes to create history
      await request(app)
        .put('/api/preferences/cuisine')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cuisineTypes: ['Korean'],
          action: 'add'
        });

      await request(app)
        .put('/api/preferences/dietary')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          dietaryRestrictions: ['Gluten-Free'],
          action: 'add'
        });
    });

    it('should get preference history successfully', async () => {
      const response = await request(app)
        .get('/api/preferences/history')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.history).toBeInstanceOf(Array);
      expect(response.body.data.history.length).toBeGreaterThan(0);
      expect(response.body.data.total).toBeGreaterThan(0);
      
      // Check history entry structure
      const historyEntry = response.body.data.history[0];
      expect(historyEntry).toHaveProperty('id');
      expect(historyEntry).toHaveProperty('userId');
      expect(historyEntry).toHaveProperty('field');
      expect(historyEntry).toHaveProperty('oldValue');
      expect(historyEntry).toHaveProperty('newValue');
      expect(historyEntry).toHaveProperty('timestamp');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/preferences/history?limit=1&offset=0')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.history.length).toBe(1);
      expect(response.body.data.limit).toBe(1);
      expect(response.body.data.offset).toBe(0);
    });

    it('should return empty history for new user', async () => {
      // Register a new user
      const newUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'TestPassword123!',
          name: 'New User'
        });

      const newUserToken = newUserResponse.body.data.token;

      const response = await request(app)
        .get('/api/preferences/history')
        .set('Authorization', `Bearer ${newUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.history).toEqual([]);
      expect(response.body.data.total).toBe(0);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/preferences/history');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('Preference Validation and Conflict Resolution', () => {
    it('should track preference changes with reasons', async () => {
      const response = await request(app)
        .put('/api/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          spiceLevel: 5,
          reason: 'Developing tolerance for spicy food'
        });

      expect(response.status).toBe(200);

      // Check history
      const historyResponse = await request(app)
        .get('/api/preferences/history')
        .set('Authorization', `Bearer ${authToken}`);

      const historyEntry = historyResponse.body.data.history.find(
        (entry: any) => entry.field === 'spiceLevel'
      );
      expect(historyEntry.reason).toBe('Developing tolerance for spicy food');
    });

    it('should detect significant preference changes', async () => {
      const response = await request(app)
        .put('/api/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          priceRange: [1, 1], // Significant change from [2, 4]
          spiceLevel: 0 // Significant change from 3
        });

      expect(response.status).toBe(200);
      expect(response.body.data.conflicts).toContain('Significant price range change detected');
      expect(response.body.data.conflicts).toContain('Significant spice level change detected');
    });

    it('should handle multiple preference updates in single request', async () => {
      const response = await request(app)
        .put('/api/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cuisineTypes: ['Korean', 'Thai', 'Vietnamese'],
          priceRange: [1, 2],
          dietaryRestrictions: ['Vegan'],
          atmospherePreferences: ['Fine Dining', 'Romantic'],
          spiceLevel: 4
        });

      expect(response.status).toBe(200);
      expect(response.body.data.preferences.cuisineTypes).toEqual(['Korean', 'Thai', 'Vietnamese']);
      expect(response.body.data.preferences.priceRange).toEqual([1, 2]);
      expect(response.body.data.preferences.dietaryRestrictions).toEqual(['Vegan']);
      expect(response.body.data.preferences.atmospherePreferences).toEqual(['Fine Dining', 'Romantic']);
      expect(response.body.data.preferences.spiceLevel).toBe(4);

      // Should create multiple history entries
      const historyResponse = await request(app)
        .get('/api/preferences/history')
        .set('Authorization', `Bearer ${authToken}`);

      expect(historyResponse.body.data.history.length).toBeGreaterThan(4); // Multiple fields changed
    });
  });

  describe('Error Handling', () => {
    it('should handle user not found scenario', async () => {
      // Clear users to simulate user not found
      const { users } = getUserStorage();
      users.clear();

      const response = await request(app)
        .get('/api/preferences')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('should handle invalid authentication token', async () => {
      const response = await request(app)
        .get('/api/preferences')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_TOKEN_FORMAT');
    });

    it('should include request ID in error responses', async () => {
      const response = await request(app)
        .get('/api/preferences');

      expect(response.status).toBe(401);
      expect(response.body.error.requestId).toBeDefined();
      expect(response.body.error.timestamp).toBeDefined();
    });
  });
});