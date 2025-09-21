import { RestaurantModel } from '../models/Restaurant';
import { RestaurantCreateRequest, Restaurant } from '../../../shared/src/types/restaurant.types';

describe('RestaurantModel', () => {
  let restaurantModel: RestaurantModel;

  beforeEach(() => {
    restaurantModel = new RestaurantModel();
  });

  afterEach(() => {
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

  describe('create', () => {
    it('should create a new restaurant with all required fields', () => {
      const restaurant = restaurantModel.create(mockRestaurantData);

      expect(restaurant).toBeDefined();
      expect(restaurant.id).toBeDefined();
      expect(restaurant.name).toBe(mockRestaurantData.name);
      expect(restaurant.cuisineType).toEqual(mockRestaurantData.cuisineType);
      expect(restaurant.location).toEqual(mockRestaurantData.location);
      expect(restaurant.priceRange).toBe(mockRestaurantData.priceRange);
      expect(restaurant.atmosphere).toEqual(mockRestaurantData.atmosphere);
      expect(restaurant.operatingHours).toEqual(mockRestaurantData.operatingHours);
      expect(restaurant.menuHighlights).toEqual(mockRestaurantData.menuHighlights);
      expect(restaurant.specialFeatures).toEqual(mockRestaurantData.specialFeatures);
      expect(restaurant.createdAt).toBeInstanceOf(Date);
      expect(restaurant.updatedAt).toBeInstanceOf(Date);
    });

    it('should set default values for calculated fields', () => {
      const restaurant = restaurantModel.create(mockRestaurantData);

      expect(restaurant.rating).toBe(0);
      expect(restaurant.negativeScore).toBe(0);
      expect(restaurant.isLocalGem).toBe(false);
      expect(restaurant.authenticityScore).toBe(0);
      expect(restaurant.dataQualityScore).toBe(0.5);
      expect(restaurant.negativeFeedbackTrends).toEqual([]);
      expect(restaurant.platformData).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return restaurant when found', () => {
      const created = restaurantModel.create(mockRestaurantData);
      const found = restaurantModel.findById(created.id);

      expect(found).toEqual(created);
    });

    it('should return null when restaurant not found', () => {
      const found = restaurantModel.findById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return empty array when no restaurants exist', () => {
      const restaurants = restaurantModel.findAll();
      expect(restaurants).toEqual([]);
    });

    it('should return all restaurants', () => {
      const restaurant1 = restaurantModel.create(mockRestaurantData);
      const restaurant2 = restaurantModel.create({
        ...mockRestaurantData,
        name: 'Second Restaurant'
      });

      const restaurants = restaurantModel.findAll();
      expect(restaurants).toHaveLength(2);
      expect(restaurants).toContainEqual(restaurant1);
      expect(restaurants).toContainEqual(restaurant2);
    });
  });

  describe('update', () => {
    it('should update existing restaurant', async () => {
      const restaurant = restaurantModel.create(mockRestaurantData);
      
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const updates = {
        name: 'Updated Restaurant Name',
        rating: 4.5
      };

      const updated = restaurantModel.update(restaurant.id, updates);

      expect(updated).toBeDefined();
      expect(updated!.name).toBe(updates.name);
      expect(updated!.rating).toBe(updates.rating);
      expect(updated!.updatedAt.getTime()).toBeGreaterThan(restaurant.updatedAt.getTime());
    });

    it('should return null when restaurant not found', () => {
      const updated = restaurantModel.update('non-existent-id', { name: 'Test' });
      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete existing restaurant', () => {
      const restaurant = restaurantModel.create(mockRestaurantData);
      const deleted = restaurantModel.delete(restaurant.id);

      expect(deleted).toBe(true);
      expect(restaurantModel.findById(restaurant.id)).toBeNull();
    });

    it('should return false when restaurant not found', () => {
      const deleted = restaurantModel.delete('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('findByLocation', () => {
    beforeEach(() => {
      // Create restaurants at different locations
      restaurantModel.create({
        ...mockRestaurantData,
        name: 'Central Restaurant',
        location: {
          address: 'Central, Hong Kong',
          latitude: 22.2783,
          longitude: 114.1747,
          district: 'Central'
        }
      });

      restaurantModel.create({
        ...mockRestaurantData,
        name: 'Tsim Sha Tsui Restaurant',
        location: {
          address: 'Tsim Sha Tsui, Hong Kong',
          latitude: 22.2988,
          longitude: 114.1722,
          district: 'Tsim Sha Tsui'
        }
      });

      restaurantModel.create({
        ...mockRestaurantData,
        name: 'Causeway Bay Restaurant',
        location: {
          address: 'Causeway Bay, Hong Kong',
          latitude: 22.2793,
          longitude: 114.1847,
          district: 'Causeway Bay'
        }
      });
    });

    it('should find restaurants within specified radius', () => {
      // Search from Central location with 2km radius
      const restaurants = restaurantModel.findByLocation(22.2783, 114.1747, 2);
      
      expect(restaurants).toHaveLength(2); // Central and Causeway Bay should be within 2km
      expect(restaurants.some(r => r.name === 'Central Restaurant')).toBe(true);
      expect(restaurants.some(r => r.name === 'Causeway Bay Restaurant')).toBe(true);
    });

    it('should use default radius of 5km when not specified', () => {
      const restaurants = restaurantModel.findByLocation(22.2783, 114.1747);
      expect(restaurants.length).toBeGreaterThan(0);
    });
  });

  describe('findByCuisine', () => {
    beforeEach(() => {
      restaurantModel.create({
        ...mockRestaurantData,
        name: 'Cantonese Restaurant',
        cuisineType: ['Cantonese']
      });

      restaurantModel.create({
        ...mockRestaurantData,
        name: 'Italian Restaurant',
        cuisineType: ['Italian']
      });

      restaurantModel.create({
        ...mockRestaurantData,
        name: 'Fusion Restaurant',
        cuisineType: ['Cantonese', 'Western']
      });
    });

    it('should find restaurants by single cuisine type', () => {
      const restaurants = restaurantModel.findByCuisine(['cantonese']);
      
      expect(restaurants).toHaveLength(2);
      expect(restaurants.some(r => r.name === 'Cantonese Restaurant')).toBe(true);
      expect(restaurants.some(r => r.name === 'Fusion Restaurant')).toBe(true);
    });

    it('should find restaurants by multiple cuisine types', () => {
      const restaurants = restaurantModel.findByCuisine(['cantonese', 'italian']);
      
      expect(restaurants).toHaveLength(3);
    });

    it('should be case insensitive', () => {
      const restaurants = restaurantModel.findByCuisine(['CANTONESE']);
      expect(restaurants.length).toBeGreaterThan(0);
    });
  });

  describe('findByPriceRange', () => {
    beforeEach(() => {
      restaurantModel.create({ ...mockRestaurantData, name: 'Budget Restaurant', priceRange: 1 });
      restaurantModel.create({ ...mockRestaurantData, name: 'Mid-range Restaurant', priceRange: 2 });
      restaurantModel.create({ ...mockRestaurantData, name: 'Upscale Restaurant', priceRange: 4 });
    });

    it('should find restaurants within price range', () => {
      const restaurants = restaurantModel.findByPriceRange(1, 2);
      
      expect(restaurants).toHaveLength(2);
      expect(restaurants.some(r => r.name === 'Budget Restaurant')).toBe(true);
      expect(restaurants.some(r => r.name === 'Mid-range Restaurant')).toBe(true);
    });

    it('should find restaurants at exact price point', () => {
      const restaurants = restaurantModel.findByPriceRange(4, 4);
      
      expect(restaurants).toHaveLength(1);
      expect(restaurants[0].name).toBe('Upscale Restaurant');
    });
  });

  describe('isRestaurantOpen', () => {
    let restaurant: Restaurant;

    beforeEach(() => {
      restaurant = restaurantModel.create({
        ...mockRestaurantData,
        operatingHours: {
          monday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
          tuesday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
          wednesday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
          thursday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
          friday: { isOpen: true, openTime: '09:00', closeTime: '23:00' },
          saturday: { isOpen: true, openTime: '08:00', closeTime: '23:00' },
          sunday: { isOpen: false }
        }
      });
    });

    it('should return true when restaurant is open', () => {
      // Monday at 15:00
      const checkTime = new Date('2024-01-01T15:00:00');
      const isOpen = restaurantModel.isRestaurantOpen(restaurant, checkTime);
      expect(isOpen).toBe(true);
    });

    it('should return false when restaurant is closed', () => {
      // Monday at 23:00 (after closing)
      const checkTime = new Date('2024-01-01T23:00:00');
      const isOpen = restaurantModel.isRestaurantOpen(restaurant, checkTime);
      expect(isOpen).toBe(false);
    });

    it('should return false when restaurant is closed on that day', () => {
      // Sunday (closed day)
      const checkTime = new Date('2024-01-07T15:00:00');
      const isOpen = restaurantModel.isRestaurantOpen(restaurant, checkTime);
      expect(isOpen).toBe(false);
    });

    it('should handle break times correctly', () => {
      const restaurantWithBreaks = restaurantModel.create({
        ...mockRestaurantData,
        operatingHours: {
          ...mockRestaurantData.operatingHours,
          monday: {
            isOpen: true,
            openTime: '09:00',
            closeTime: '22:00',
            breaks: [{ startTime: '14:00', endTime: '17:00' }]
          }
        }
      });

      // During break time
      const breakTime = new Date('2024-01-01T15:00:00');
      const isDuringBreak = restaurantModel.isRestaurantOpen(restaurantWithBreaks, breakTime);
      expect(isDuringBreak).toBe(false);

      // Before break time
      const beforeBreak = new Date('2024-01-01T13:00:00');
      const isBeforeBreak = restaurantModel.isRestaurantOpen(restaurantWithBreaks, beforeBreak);
      expect(isBeforeBreak).toBe(true);

      // After break time
      const afterBreak = new Date('2024-01-01T18:00:00');
      const isAfterBreak = restaurantModel.isRestaurantOpen(restaurantWithBreaks, afterBreak);
      expect(isAfterBreak).toBe(true);
    });
  });
});