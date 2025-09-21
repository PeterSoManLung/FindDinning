import { RestaurantRepository } from '../repositories/RestaurantRepository';
import { restaurantModel } from '../models/Restaurant';
import { RestaurantCreateRequest, RestaurantSearchRequest } from '../../../shared/src/types/restaurant.types';

describe('RestaurantRepository', () => {
  let repository: RestaurantRepository;

  beforeEach(() => {
    repository = new RestaurantRepository();
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

  describe('CRUD operations', () => {
    describe('create', () => {
      it('should create a new restaurant', async () => {
        const restaurant = await repository.create(mockRestaurantData);

        expect(restaurant).toBeDefined();
        expect(restaurant.id).toBeDefined();
        expect(restaurant.name).toBe(mockRestaurantData.name);
        expect(restaurant.cuisineType).toEqual(mockRestaurantData.cuisineType);
      });
    });

    describe('findById', () => {
      it('should find restaurant by ID', async () => {
        const created = await repository.create(mockRestaurantData);
        const found = await repository.findById(created.id);

        expect(found).toEqual(created);
      });

      it('should return null for non-existent ID', async () => {
        const found = await repository.findById('non-existent-id');
        expect(found).toBeNull();
      });
    });

    describe('findAll', () => {
      it('should return all restaurants', async () => {
        await repository.create(mockRestaurantData);
        await repository.create({ ...mockRestaurantData, name: 'Second Restaurant' });

        const restaurants = await repository.findAll();
        expect(restaurants).toHaveLength(2);
      });

      it('should return empty array when no restaurants exist', async () => {
        const restaurants = await repository.findAll();
        expect(restaurants).toEqual([]);
      });
    });

    describe('update', () => {
      it('should update existing restaurant', async () => {
        const restaurant = await repository.create(mockRestaurantData);
        const updates = { name: 'Updated Name', rating: 4.5 };

        const updated = await repository.update(restaurant.id, updates);

        expect(updated).toBeDefined();
        expect(updated!.name).toBe(updates.name);
        expect(updated!.rating).toBe(updates.rating);
      });

      it('should return null for non-existent restaurant', async () => {
        const updated = await repository.update('non-existent-id', { name: 'Test' });
        expect(updated).toBeNull();
      });
    });

    describe('delete', () => {
      it('should delete existing restaurant', async () => {
        const restaurant = await repository.create(mockRestaurantData);
        const deleted = await repository.delete(restaurant.id);

        expect(deleted).toBe(true);
        
        const found = await repository.findById(restaurant.id);
        expect(found).toBeNull();
      });

      it('should return false for non-existent restaurant', async () => {
        const deleted = await repository.delete('non-existent-id');
        expect(deleted).toBe(false);
      });
    });
  });

  describe('search functionality', () => {
    beforeEach(async () => {
      // Create test restaurants
      await repository.create({
        ...mockRestaurantData,
        name: 'Central Cantonese',
        cuisineType: ['Cantonese'],
        location: {
          address: 'Central, Hong Kong',
          latitude: 22.2783,
          longitude: 114.1747,
          district: 'Central'
        },
        priceRange: 2,
        specialFeatures: ['wheelchair-accessible']
      });

      await repository.create({
        ...mockRestaurantData,
        name: 'TST Italian',
        cuisineType: ['Italian'],
        location: {
          address: 'Tsim Sha Tsui, Hong Kong',
          latitude: 22.2988,
          longitude: 114.1722,
          district: 'Tsim Sha Tsui'
        },
        priceRange: 3,
        specialFeatures: ['outdoor-seating'],
        operatingHours: {
          ...mockRestaurantData.operatingHours,
          sunday: { isOpen: false }
        }
      });

      await repository.create({
        ...mockRestaurantData,
        name: 'Causeway Bay Fusion',
        cuisineType: ['Cantonese', 'Western'],
        location: {
          address: 'Causeway Bay, Hong Kong',
          latitude: 22.2793,
          longitude: 114.1847,
          district: 'Causeway Bay'
        },
        priceRange: 4,
        specialFeatures: ['live-music']
      });
    });

    describe('search by location', () => {
      it('should find restaurants within radius', async () => {
        const searchCriteria: RestaurantSearchRequest = {
          location: {
            latitude: 22.2783,
            longitude: 114.1747,
            radius: 2
          }
        };

        const results = await repository.search(searchCriteria);
        
        expect(results.length).toBeGreaterThan(0);
        expect(results.some(r => r.name === 'Central Cantonese')).toBe(true);
      });

      it('should sort by distance when specified', async () => {
        const searchCriteria: RestaurantSearchRequest = {
          location: {
            latitude: 22.2783,
            longitude: 114.1747,
            radius: 10
          },
          sortBy: 'distance'
        };

        const results = await repository.search(searchCriteria);
        
        expect(results.length).toBeGreaterThan(1);
        // First result should be closest (Central Cantonese)
        expect(results[0].name).toBe('Central Cantonese');
      });
    });

    describe('search by cuisine', () => {
      it('should find restaurants by cuisine type', async () => {
        const searchCriteria: RestaurantSearchRequest = {
          cuisineTypes: ['Cantonese']
        };

        const results = await repository.search(searchCriteria);
        
        expect(results).toHaveLength(2);
        expect(results.some(r => r.name === 'Central Cantonese')).toBe(true);
        expect(results.some(r => r.name === 'Causeway Bay Fusion')).toBe(true);
      });

      it('should find restaurants by multiple cuisine types', async () => {
        const searchCriteria: RestaurantSearchRequest = {
          cuisineTypes: ['Cantonese', 'Italian']
        };

        const results = await repository.search(searchCriteria);
        expect(results).toHaveLength(3);
      });
    });

    describe('search by price range', () => {
      it('should find restaurants within price range', async () => {
        const searchCriteria: RestaurantSearchRequest = {
          priceRange: [2, 3]
        };

        const results = await repository.search(searchCriteria);
        
        expect(results).toHaveLength(2);
        expect(results.some(r => r.name === 'Central Cantonese')).toBe(true);
        expect(results.some(r => r.name === 'TST Italian')).toBe(true);
      });
    });

    describe('search by features', () => {
      it('should find restaurants with specific features', async () => {
        const searchCriteria: RestaurantSearchRequest = {
          features: ['wheelchair-accessible']
        };

        const results = await repository.search(searchCriteria);
        
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Central Cantonese');
      });

      it('should find restaurants with multiple features', async () => {
        const searchCriteria: RestaurantSearchRequest = {
          features: ['wheelchair-accessible', 'outdoor-seating']
        };

        const results = await repository.search(searchCriteria);
        expect(results).toHaveLength(2);
      });
    });

    describe('search by availability', () => {
      it('should find only open restaurants when isOpen is true', async () => {
        // Mock current time to Sunday when TST Italian is closed
        const sundayTime = new Date('2024-01-07T15:00:00'); // Sunday
        jest.spyOn(restaurantModel, 'isRestaurantOpen').mockImplementation((restaurant) => {
          return restaurant.name !== 'TST Italian';
        });

        const searchCriteria: RestaurantSearchRequest = {
          isOpen: true
        };

        const results = await repository.search(searchCriteria);
        
        expect(results).toHaveLength(2);
        expect(results.some(r => r.name === 'TST Italian')).toBe(false);
      });
    });

    describe('sorting', () => {
      beforeEach(async () => {
        // Update restaurants with different ratings for sorting tests
        const restaurants = await repository.findAll();
        await repository.update(restaurants[0].id, { rating: 4.5 });
        await repository.update(restaurants[1].id, { rating: 3.8 });
        await repository.update(restaurants[2].id, { rating: 4.2 });
      });

      it('should sort by rating', async () => {
        const searchCriteria: RestaurantSearchRequest = {
          sortBy: 'rating'
        };

        const results = await repository.search(searchCriteria);
        
        expect(results.length).toBeGreaterThan(1);
        expect(results[0].rating).toBeGreaterThanOrEqual(results[1].rating);
      });

      it('should sort by negative score', async () => {
        // Update restaurants with different negative scores
        const restaurants = await repository.findAll();
        await repository.update(restaurants[0].id, { negativeScore: 0.1 });
        await repository.update(restaurants[1].id, { negativeScore: 0.3 });
        await repository.update(restaurants[2].id, { negativeScore: 0.2 });

        const searchCriteria: RestaurantSearchRequest = {
          sortBy: 'negativeScore'
        };

        const results = await repository.search(searchCriteria);
        
        expect(results.length).toBeGreaterThan(1);
        expect(results[0].negativeScore).toBeLessThanOrEqual(results[1].negativeScore);
      });
    });

    describe('combined search criteria', () => {
      it('should apply multiple filters correctly', async () => {
        const searchCriteria: RestaurantSearchRequest = {
          location: {
            latitude: 22.2783,
            longitude: 114.1747,
            radius: 5
          },
          cuisineTypes: ['Cantonese'],
          priceRange: [1, 3],
          features: ['wheelchair-accessible']
        };

        const results = await repository.search(searchCriteria);
        
        expect(results).toHaveLength(1);
        expect(results[0].name).toBe('Central Cantonese');
      });
    });
  });

  describe('specialized queries', () => {
    beforeEach(async () => {
      await repository.create(mockRestaurantData);
      await repository.create({
        ...mockRestaurantData,
        name: 'Italian Restaurant',
        cuisineType: ['Italian']
      });
    });

    describe('findByCuisine', () => {
      it('should find restaurants by cuisine type', async () => {
        const restaurants = await repository.findByCuisine(['Cantonese']);
        
        expect(restaurants).toHaveLength(1);
        expect(restaurants[0].name).toBe('Test Restaurant');
      });
    });

    describe('findByLocation', () => {
      it('should find restaurants by location', async () => {
        const restaurants = await repository.findByLocation(22.2783, 114.1747, 5);
        
        expect(restaurants.length).toBeGreaterThan(0);
      });
    });

    describe('isOpen', () => {
      it('should check if restaurant is open', async () => {
        const restaurant = await repository.create(mockRestaurantData);
        const isOpen = await repository.isOpen(restaurant.id);
        
        expect(typeof isOpen).toBe('boolean');
      });

      it('should return false for non-existent restaurant', async () => {
        const isOpen = await repository.isOpen('non-existent-id');
        expect(isOpen).toBe(false);
      });
    });

    describe('findOpenRestaurants', () => {
      it('should find all currently open restaurants', async () => {
        const openRestaurants = await repository.findOpenRestaurants();
        
        expect(Array.isArray(openRestaurants)).toBe(true);
      });
    });
  });
});