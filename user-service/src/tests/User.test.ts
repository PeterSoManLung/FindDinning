import { UserModel, UserValidation } from '../models/User';
import { 
  User, 
  UserPreferences, 
  DiningHistory, 
  EmotionalProfile, 
  UserRegistrationRequest,
  UserUpdateRequest 
} from '../../../shared/src/types/user.types';

describe('UserModel', () => {
  let testUser: UserModel;

  beforeEach(() => {
    testUser = new UserModel({
      id: 'test-user-1',
      email: 'test@example.com',
      name: 'Test User'
    });
  });

  describe('Constructor', () => {
    it('should create a user with default values when minimal data provided', () => {
      const user = new UserModel({
        email: 'test@example.com',
        name: 'Test User'
      });

      expect(user.email).toBe('test@example.com');
      expect(user.name).toBe('Test User');
      expect(user.preferences.cuisineTypes).toEqual([]);
      expect(user.preferences.priceRange).toEqual([1, 4]);
      expect(user.diningHistory).toEqual([]);
      expect(user.emotionalProfile.preferredMoodCuisines).toEqual({});
      expect(user.location.district).toBe('Central');
    });

    it('should create a user with provided data', () => {
      const userData: Partial<User> = {
        id: 'user-123',
        email: 'user@test.com',
        name: 'John Doe',
        preferences: {
          cuisineTypes: ['Japanese', 'Italian'],
          priceRange: [2, 3],
          dietaryRestrictions: ['Vegetarian'],
          atmospherePreferences: ['Casual'],
          spiceLevel: 3
        }
      };

      const user = new UserModel(userData);

      expect(user.id).toBe('user-123');
      expect(user.preferences.cuisineTypes).toEqual(['Japanese', 'Italian']);
      expect(user.preferences.priceRange).toEqual([2, 3]);
    });
  });

  describe('updatePreferences', () => {
    it('should update preferences with valid data', () => {
      const newPreferences: Partial<UserPreferences> = {
        cuisineTypes: ['Thai', 'Korean'],
        spiceLevel: 4
      };

      testUser.updatePreferences(newPreferences);

      expect(testUser.preferences.cuisineTypes).toEqual(['Thai', 'Korean']);
      expect(testUser.preferences.spiceLevel).toBe(4);
      expect(testUser.preferences.priceRange).toEqual([1, 4]); // Should keep existing values
    });

    it('should throw error with invalid preferences', () => {
      const invalidPreferences = {
        spiceLevel: 10 // Invalid: should be 0-5
      };

      expect(() => {
        testUser.updatePreferences(invalidPreferences);
      }).toThrow('Invalid preferences');
    });

    it('should update updatedAt timestamp', () => {
      const originalUpdatedAt = testUser.updatedAt;
      
      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        testUser.updatePreferences({ spiceLevel: 3 });
        expect(testUser.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
      }, 10);
    });
  });

  describe('addDiningHistory', () => {
    it('should add valid dining history entry', () => {
      const historyEntry: Omit<DiningHistory, 'id'> = {
        restaurantId: 'restaurant-123',
        visitDate: new Date('2024-01-15'),
        rating: 4,
        notes: 'Great food!',
        moodContext: 'happy'
      };

      testUser.addDiningHistory(historyEntry);

      expect(testUser.diningHistory).toHaveLength(1);
      expect(testUser.diningHistory[0].restaurantId).toBe('restaurant-123');
      expect(testUser.diningHistory[0].rating).toBe(4);
      expect(testUser.diningHistory[0].id).toMatch(/^dining_/);
    });

    it('should throw error with invalid dining history', () => {
      const invalidHistory = {
        restaurantId: '', // Invalid: empty string
        visitDate: new Date('2025-12-31'), // Invalid: future date
        rating: 6 // Invalid: should be 1-5
      };

      expect(() => {
        testUser.addDiningHistory(invalidHistory);
      }).toThrow('Invalid dining history');
    });
  });

  describe('updateEmotionalProfile', () => {
    it('should update emotional profile with valid data', () => {
      const profileUpdate: Partial<EmotionalProfile> = {
        comfortFoodPreferences: ['Italian', 'Japanese'],
        lastEmotionalState: 'content'
      };

      testUser.updateEmotionalProfile(profileUpdate);

      expect(testUser.emotionalProfile.comfortFoodPreferences).toEqual(['Italian', 'Japanese']);
      expect(testUser.emotionalProfile.lastEmotionalState).toBe('content');
    });

    it('should throw error with invalid emotional profile', () => {
      const invalidProfile = {
        comfortFoodPreferences: ['InvalidCuisine'] // Invalid cuisine type
      };

      expect(() => {
        testUser.updateEmotionalProfile(invalidProfile);
      }).toThrow('Invalid emotional profile');
    });
  });

  describe('updateLocation', () => {
    it('should update location with valid data', () => {
      const newLocation = {
        latitude: 22.3193,
        longitude: 114.1694,
        district: 'Tsim Sha Tsui'
      };

      testUser.updateLocation(newLocation);

      expect(testUser.location.district).toBe('Tsim Sha Tsui');
      expect(testUser.location.latitude).toBe(22.3193);
    });

    it('should throw error with invalid location', () => {
      const invalidLocation = {
        latitude: 25.0, // Invalid: outside Hong Kong bounds
        district: 'InvalidDistrict'
      };

      expect(() => {
        testUser.updateLocation(invalidLocation);
      }).toThrow('Invalid location');
    });
  });

  describe('toJSON', () => {
    it('should return user data without sensitive information', () => {
      const json = testUser.toJSON();

      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('email');
      expect(json).toHaveProperty('name');
      expect(json).toHaveProperty('preferences');
      expect(json).toHaveProperty('diningHistory');
      expect(json).toHaveProperty('emotionalProfile');
      expect(json).toHaveProperty('location');
      expect(json).toHaveProperty('createdAt');
      expect(json).toHaveProperty('updatedAt');
      expect(json).not.toHaveProperty('password');
    });
  });
});

describe('UserValidation', () => {
  describe('validateRegistration', () => {
    it('should validate correct registration data', () => {
      const validData: UserRegistrationRequest = {
        email: 'test@example.com',
        password: 'Password123',
        name: 'Test User',
        preferences: {
          cuisineTypes: ['Japanese', 'Italian'],
          priceRange: [2, 4],
          dietaryRestrictions: ['Vegetarian'],
          atmospherePreferences: ['Casual'],
          spiceLevel: 3
        }
      };

      const result = UserValidation.validateRegistration(validData);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid email', () => {
      const invalidData: UserRegistrationRequest = {
        email: 'invalid-email',
        password: 'Password123',
        name: 'Test User'
      };

      const result = UserValidation.validateRegistration(invalidData);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('valid email address');
    });

    it('should reject weak password', () => {
      const invalidData: UserRegistrationRequest = {
        email: 'test@example.com',
        password: 'weak',
        name: 'Test User'
      };

      const result = UserValidation.validateRegistration(invalidData);
      expect(result.error).toBeDefined();
    });

    it('should reject short name', () => {
      const invalidData: UserRegistrationRequest = {
        email: 'test@example.com',
        password: 'Password123',
        name: 'A'
      };

      const result = UserValidation.validateRegistration(invalidData);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('at least 2 characters');
    });
  });

  describe('validateProfileUpdate', () => {
    it('should validate correct profile update data', () => {
      const validData: UserUpdateRequest = {
        name: 'Updated Name',
        preferences: {
          cuisineTypes: ['Thai'],
          spiceLevel: 4
        },
        location: {
          district: 'Wan Chai'
        }
      };

      const result = UserValidation.validateProfileUpdate(validData);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid cuisine types', () => {
      const invalidData: UserUpdateRequest = {
        preferences: {
          cuisineTypes: ['InvalidCuisine']
        }
      };

      const result = UserValidation.validateProfileUpdate(invalidData);
      expect(result.error).toBeDefined();
    });

    it('should reject invalid price range', () => {
      const invalidData: UserUpdateRequest = {
        preferences: {
          priceRange: [0, 5] // Invalid: should be 1-4
        }
      };

      const result = UserValidation.validateProfileUpdate(invalidData);
      expect(result.error).toBeDefined();
    });
  });

  describe('validatePreferences', () => {
    it('should validate correct preferences', () => {
      const validPreferences = {
        cuisineTypes: ['Japanese', 'Korean'],
        priceRange: [2, 3] as [number, number],
        dietaryRestrictions: ['Vegetarian', 'Gluten-Free'],
        atmospherePreferences: ['Casual', 'Family-Friendly'],
        spiceLevel: 3
      };

      const result = UserValidation.validatePreferences(validPreferences);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid spice level', () => {
      const invalidPreferences = {
        spiceLevel: 10 // Invalid: should be 0-5
      };

      const result = UserValidation.validatePreferences(invalidPreferences);
      expect(result.error).toBeDefined();
    });
  });

  describe('validateDiningHistory', () => {
    it('should validate correct dining history', () => {
      const validHistory: Omit<DiningHistory, 'id'> = {
        restaurantId: 'restaurant-123',
        visitDate: new Date('2024-01-15'),
        rating: 4,
        notes: 'Great experience',
        moodContext: 'happy'
      };

      const result = UserValidation.validateDiningHistory(validHistory);
      expect(result.error).toBeUndefined();
    });

    it('should reject future visit date', () => {
      const invalidHistory: Omit<DiningHistory, 'id'> = {
        restaurantId: 'restaurant-123',
        visitDate: new Date('2025-12-31'), // Future date
        rating: 4
      };

      const result = UserValidation.validateDiningHistory(invalidHistory);
      expect(result.error).toBeDefined();
    });

    it('should reject invalid rating', () => {
      const invalidHistory: Omit<DiningHistory, 'id'> = {
        restaurantId: 'restaurant-123',
        visitDate: new Date('2024-01-15'),
        rating: 6 // Invalid: should be 1-5
      };

      const result = UserValidation.validateDiningHistory(invalidHistory);
      expect(result.error).toBeDefined();
    });
  });

  describe('validateLocation', () => {
    it('should validate correct Hong Kong location', () => {
      const validLocation = {
        latitude: 22.3193,
        longitude: 114.1694,
        district: 'Central'
      };

      const result = UserValidation.validateLocation(validLocation);
      expect(result.error).toBeUndefined();
    });

    it('should reject coordinates outside Hong Kong', () => {
      const invalidLocation = {
        latitude: 25.0, // Outside Hong Kong bounds
        longitude: 114.1694,
        district: 'Central'
      };

      const result = UserValidation.validateLocation(invalidLocation);
      expect(result.error).toBeDefined();
    });

    it('should reject invalid district', () => {
      const invalidLocation = {
        district: 'InvalidDistrict'
      };

      const result = UserValidation.validateLocation(invalidLocation);
      expect(result.error).toBeDefined();
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      expect(UserValidation.validateEmail('test@example.com')).toBe(true);
      expect(UserValidation.validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(UserValidation.validateEmail('user+tag@example.org')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(UserValidation.validateEmail('invalid-email')).toBe(false);
      expect(UserValidation.validateEmail('test@')).toBe(false);
      expect(UserValidation.validateEmail('@example.com')).toBe(false);
      expect(UserValidation.validateEmail('test.example.com')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      const result = UserValidation.validatePassword('Password123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject short passwords', () => {
      const result = UserValidation.validatePassword('Pass1');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject passwords without uppercase', () => {
      const result = UserValidation.validatePassword('password123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject passwords without lowercase', () => {
      const result = UserValidation.validatePassword('PASSWORD123');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject passwords without numbers', () => {
      const result = UserValidation.validatePassword('Password');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should return multiple errors for weak passwords', () => {
      const result = UserValidation.validatePassword('weak');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});