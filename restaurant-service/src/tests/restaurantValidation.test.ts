import {
  validateRestaurantCreate,
  validateRestaurantUpdate,
  validateRestaurantSearch,
  validateTimeFormat,
  isWithinHongKongBounds
} from '../validation/restaurantValidation';
import { RestaurantCreateRequest } from '../../../shared/src/types/restaurant.types';

describe('Restaurant Validation', () => {
  const validRestaurantData: RestaurantCreateRequest = {
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
      sunday: { isOpen: false }
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

  describe('validateRestaurantCreate', () => {
    it('should validate correct restaurant data', () => {
      const result = validateRestaurantCreate(validRestaurantData);
      
      expect(result.error).toBeUndefined();
      expect(result.value).toEqual(validRestaurantData);
    });

    describe('name validation', () => {
      it('should reject empty name', () => {
        const invalidData = { ...validRestaurantData, name: '' };
        const result = validateRestaurantCreate(invalidData);
        
        expect(result.error).toContain('Restaurant name is required');
      });

      it('should reject name longer than 100 characters', () => {
        const invalidData = { ...validRestaurantData, name: 'a'.repeat(101) };
        const result = validateRestaurantCreate(invalidData);
        
        expect(result.error).toContain('Restaurant name cannot exceed 100 characters');
      });
    });

    describe('cuisine type validation', () => {
      it('should reject empty cuisine type array', () => {
        const invalidData = { ...validRestaurantData, cuisineType: [] };
        const result = validateRestaurantCreate(invalidData);
        
        expect(result.error).toContain('At least one cuisine type is required');
      });

      it('should reject non-array cuisine type', () => {
        const invalidData = { ...validRestaurantData, cuisineType: 'Cantonese' as any };
        const result = validateRestaurantCreate(invalidData);
        
        expect(result.error).toContain('Cuisine type must be an array');
      });
    });

    describe('location validation', () => {
      it('should reject invalid latitude', () => {
        const invalidData = {
          ...validRestaurantData,
          location: { ...validRestaurantData.location, latitude: 91 }
        };
        const result = validateRestaurantCreate(invalidData);
        
        expect(result.error).toBeDefined();
      });

      it('should reject invalid longitude', () => {
        const invalidData = {
          ...validRestaurantData,
          location: { ...validRestaurantData.location, longitude: 181 }
        };
        const result = validateRestaurantCreate(invalidData);
        
        expect(result.error).toBeDefined();
      });

      it('should reject coordinates outside Hong Kong bounds', () => {
        const invalidData = {
          ...validRestaurantData,
          location: { ...validRestaurantData.location, latitude: 25.0, longitude: 121.0 } // Taiwan coordinates
        };
        const result = validateRestaurantCreate(invalidData);
        
        expect(result.error).toContain('Location coordinates must be within Hong Kong bounds');
      });
    });

    describe('price range validation', () => {
      it('should reject price range below 1', () => {
        const invalidData = { ...validRestaurantData, priceRange: 0 };
        const result = validateRestaurantCreate(invalidData);
        
        expect(result.error).toContain('Price range must be between 1 and 4');
      });

      it('should reject price range above 4', () => {
        const invalidData = { ...validRestaurantData, priceRange: 5 };
        const result = validateRestaurantCreate(invalidData);
        
        expect(result.error).toContain('Price range must be between 1 and 4');
      });

      it('should reject non-integer price range', () => {
        const invalidData = { ...validRestaurantData, priceRange: 2.5 };
        const result = validateRestaurantCreate(invalidData);
        
        expect(result.error).toContain('Price range must be an integer');
      });
    });

    describe('operating hours validation', () => {
      it('should reject invalid time format', () => {
        const invalidData = {
          ...validRestaurantData,
          operatingHours: {
            ...validRestaurantData.operatingHours,
            monday: { isOpen: true, openTime: '25:00', closeTime: '22:00' }
          }
        };
        const result = validateRestaurantCreate(invalidData);
        
        expect(result.error).toContain('Time must be in HH:mm format');
      });

      it('should reject open time after close time', () => {
        const invalidData = {
          ...validRestaurantData,
          operatingHours: {
            ...validRestaurantData.operatingHours,
            monday: { isOpen: true, openTime: '23:00', closeTime: '22:00' }
          }
        };
        const result = validateRestaurantCreate(invalidData);
        
        expect(result.error).toContain('open time must be before close time');
      });

      it('should reject break time outside operating hours', () => {
        const invalidData = {
          ...validRestaurantData,
          operatingHours: {
            ...validRestaurantData.operatingHours,
            monday: {
              isOpen: true,
              openTime: '09:00',
              closeTime: '22:00',
              breaks: [{ startTime: '08:00', endTime: '10:00' }]
            }
          }
        };
        const result = validateRestaurantCreate(invalidData);
        
        expect(result.error).toContain('Break time for monday must be within operating hours');
      });

      it('should reject break with start time after end time', () => {
        const invalidData = {
          ...validRestaurantData,
          operatingHours: {
            ...validRestaurantData.operatingHours,
            monday: {
              isOpen: true,
              openTime: '09:00',
              closeTime: '22:00',
              breaks: [{ startTime: '15:00', endTime: '14:00' }]
            }
          }
        };
        const result = validateRestaurantCreate(invalidData);
        
        expect(result.error).toContain('Break start time must be before end time');
      });
    });

    describe('menu highlights validation', () => {
      it('should reject duplicate menu item IDs', () => {
        const invalidData = {
          ...validRestaurantData,
          menuHighlights: [
            {
              id: 'item1',
              name: 'Har Gow',
              category: 'Dim Sum',
              isSignatureDish: true,
              dietaryInfo: []
            },
            {
              id: 'item1', // Duplicate ID
              name: 'Siu Mai',
              category: 'Dim Sum',
              isSignatureDish: false,
              dietaryInfo: []
            }
          ]
        };
        const result = validateRestaurantCreate(invalidData);
        
        expect(result.error).toContain('Menu item IDs must be unique');
      });

      it('should reject invalid spice level', () => {
        const invalidData = {
          ...validRestaurantData,
          menuHighlights: [
            {
              id: 'item1',
              name: 'Spicy Dish',
              category: 'Main',
              isSignatureDish: true,
              dietaryInfo: [],
              spiceLevel: 6 // Invalid spice level
            }
          ]
        };
        const result = validateRestaurantCreate(invalidData);
        
        expect(result.error).toBeDefined();
      });
    });
  });

  describe('validateRestaurantUpdate', () => {
    it('should validate partial update data', () => {
      const updateData = {
        name: 'Updated Restaurant Name',
        rating: 4.5
      };
      const result = validateRestaurantUpdate(updateData);
      
      expect(result.error).toBeUndefined();
      expect(result.value).toEqual(updateData);
    });

    it('should reject invalid rating', () => {
      const updateData = { rating: 6 };
      const result = validateRestaurantUpdate(updateData);
      
      expect(result.error).toBeDefined();
    });

    it('should allow empty update object', () => {
      const result = validateRestaurantUpdate({});
      
      expect(result.error).toBeUndefined();
      expect(result.value).toEqual({});
    });
  });

  describe('validateRestaurantSearch', () => {
    it('should validate correct search criteria', () => {
      const searchData = {
        location: {
          latitude: 22.2783,
          longitude: 114.1747,
          radius: 5
        },
        cuisineTypes: ['Cantonese'],
        priceRange: [1, 3],
        isOpen: true,
        features: ['wheelchair-accessible'],
        sortBy: 'distance'
      };
      const result = validateRestaurantSearch(searchData);
      
      expect(result.error).toBeUndefined();
      expect(result.value).toEqual(searchData);
    });

    it('should reject invalid price range order', () => {
      const searchData = {
        priceRange: [3, 1] // Min > Max
      };
      const result = validateRestaurantSearch(searchData);
      
      expect(result.error).toContain('Minimum price cannot be greater than maximum price');
    });

    it('should reject invalid sort option', () => {
      const searchData = {
        sortBy: 'invalid-sort'
      };
      const result = validateRestaurantSearch(searchData);
      
      expect(result.error).toBeDefined();
    });

    it('should reject invalid location coordinates', () => {
      const searchData = {
        location: {
          latitude: 91, // Invalid latitude
          longitude: 114.1747
        }
      };
      const result = validateRestaurantSearch(searchData);
      
      expect(result.error).toBeDefined();
    });
  });

  describe('utility functions', () => {
    describe('validateTimeFormat', () => {
      it('should validate correct time formats', () => {
        expect(validateTimeFormat('09:00')).toBe(true);
        expect(validateTimeFormat('23:59')).toBe(true);
        expect(validateTimeFormat('00:00')).toBe(true);
      });

      it('should reject invalid time formats', () => {
        expect(validateTimeFormat('25:00')).toBe(false);
        expect(validateTimeFormat('12:60')).toBe(false);
        expect(validateTimeFormat('9:00')).toBe(false); // Missing leading zero
        expect(validateTimeFormat('12:5')).toBe(false); // Missing leading zero
        expect(validateTimeFormat('12:00:00')).toBe(false); // Seconds not allowed
      });
    });

    describe('isWithinHongKongBounds', () => {
      it('should validate Hong Kong coordinates', () => {
        expect(isWithinHongKongBounds(22.2783, 114.1747)).toBe(true); // Central
        expect(isWithinHongKongBounds(22.3964, 114.1095)).toBe(true); // Sha Tin
        expect(isWithinHongKongBounds(22.5, 114.3)).toBe(true); // Within bounds
      });

      it('should reject coordinates outside Hong Kong', () => {
        expect(isWithinHongKongBounds(25.0, 121.0)).toBe(false); // Taiwan
        expect(isWithinHongKongBounds(39.9, 116.4)).toBe(false); // Beijing
        expect(isWithinHongKongBounds(22.0, 114.0)).toBe(false); // Just outside bounds
        expect(isWithinHongKongBounds(22.7, 114.6)).toBe(false); // Just outside bounds
      });
    });
  });
});