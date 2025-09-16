import { 
  User, 
  UserPreferences, 
  DiningHistory, 
  EmotionalProfile, 
  UserLocation,
  UserRegistrationRequest,
  UserUpdateRequest 
} from '../../../shared/src/types/user.types';
import Joi from 'joi';

export class UserModel implements User {
  id: string;
  email: string;
  name: string;
  preferences: UserPreferences;
  diningHistory: DiningHistory[];
  emotionalProfile: EmotionalProfile;
  location: UserLocation;
  createdAt: Date;
  updatedAt: Date;

  constructor(userData: Partial<Omit<User, 'preferences'>> & { preferences?: Partial<UserPreferences> }) {
    this.id = userData.id || '';
    this.email = userData.email || '';
    this.name = userData.name || '';
    this.preferences = { ...this.getDefaultPreferences(), ...userData.preferences };
    this.diningHistory = userData.diningHistory || [];
    this.emotionalProfile = userData.emotionalProfile || this.getDefaultEmotionalProfile();
    this.location = userData.location || this.getDefaultLocation();
    this.createdAt = userData.createdAt || new Date();
    this.updatedAt = userData.updatedAt || new Date();
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      cuisineTypes: [],
      priceRange: [1, 4],
      dietaryRestrictions: [],
      atmospherePreferences: [],
      spiceLevel: 2
    };
  }

  private getDefaultEmotionalProfile(): EmotionalProfile {
    return {
      preferredMoodCuisines: {},
      comfortFoodPreferences: [],
      celebratoryPreferences: [],
      emotionalPatterns: []
    };
  }

  private getDefaultLocation(): UserLocation {
    return {
      latitude: 22.3193,
      longitude: 114.1694,
      district: 'Central'
    };
  }

  /**
   * Updates user preferences and validates the data
   */
  updatePreferences(newPreferences: Partial<UserPreferences>): void {
    const validationResult = UserValidation.validatePreferences(newPreferences);
    if (validationResult.error) {
      throw new Error(`Invalid preferences: ${validationResult.error.message}`);
    }

    this.preferences = { ...this.preferences, ...newPreferences };
    this.updatedAt = new Date();
  }

  /**
   * Adds a dining history entry
   */
  addDiningHistory(historyEntry: Omit<DiningHistory, 'id'>): void {
    const validationResult = UserValidation.validateDiningHistory(historyEntry);
    if (validationResult.error) {
      throw new Error(`Invalid dining history: ${validationResult.error.message}`);
    }

    const newEntry: DiningHistory = {
      ...historyEntry,
      id: `dining_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    this.diningHistory.push(newEntry);
    this.updatedAt = new Date();
  }

  /**
   * Updates emotional profile
   */
  updateEmotionalProfile(profileUpdate: Partial<EmotionalProfile>): void {
    const validationResult = UserValidation.validateEmotionalProfile(profileUpdate);
    if (validationResult.error) {
      throw new Error(`Invalid emotional profile: ${validationResult.error.message}`);
    }

    this.emotionalProfile = { ...this.emotionalProfile, ...profileUpdate };
    this.updatedAt = new Date();
  }

  /**
   * Updates user location
   */
  updateLocation(newLocation: Partial<UserLocation>): void {
    const validationResult = UserValidation.validateLocation(newLocation);
    if (validationResult.error) {
      throw new Error(`Invalid location: ${validationResult.error.message}`);
    }

    this.location = { ...this.location, ...newLocation };
    this.updatedAt = new Date();
  }

  /**
   * Converts the model to a plain object for API responses
   */
  toJSON(): Omit<User, 'password'> {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      preferences: this.preferences,
      diningHistory: this.diningHistory,
      emotionalProfile: this.emotionalProfile,
      location: this.location,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

export class UserValidation {
  private static readonly HONG_KONG_DISTRICTS = [
    'Central', 'Wan Chai', 'Causeway Bay', 'Tsim Sha Tsui', 'Mong Kok', 
    'Yau Ma Tei', 'Jordan', 'Admiralty', 'Sheung Wan', 'Mid-Levels',
    'Happy Valley', 'Tin Hau', 'Fortress Hill', 'North Point', 'Quarry Bay',
    'Tai Koo', 'Shau Kei Wan', 'Chai Wan', 'Aberdeen', 'Wong Chuk Hang',
    'Stanley', 'Repulse Bay', 'Kowloon Tong', 'Diamond Hill', 'Wong Tai Sin',
    'Kowloon Bay', 'Kwun Tong', 'Lam Tin', 'Yau Tong', 'Lei Yue Mun',
    'Sha Tin', 'Tai Po', 'Fanling', 'Sheung Shui', 'Tuen Mun', 'Yuen Long',
    'Tin Shui Wai', 'Tsuen Wan', 'Kwai Chung', 'Tsing Yi', 'Ma On Shan',
    'Sai Kung', 'Tseung Kwan O', 'Discovery Bay', 'Tung Chung'
  ];

  private static readonly CUISINE_TYPES = [
    'Cantonese', 'Sichuan', 'Japanese', 'Korean', 'Thai', 'Vietnamese',
    'Italian', 'French', 'American', 'Indian', 'Middle Eastern', 'Mexican',
    'Dim Sum', 'Hot Pot', 'BBQ', 'Seafood', 'Vegetarian', 'Fusion',
    'Street Food', 'Desserts', 'Bakery', 'Tea Restaurant', 'Western'
  ];

  private static readonly DIETARY_RESTRICTIONS = [
    'Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-Free', 'Dairy-Free',
    'Nut-Free', 'Shellfish-Free', 'Low-Sodium', 'Diabetic-Friendly'
  ];

  private static readonly ATMOSPHERE_PREFERENCES = [
    'Casual', 'Fine Dining', 'Family-Friendly', 'Romantic', 'Business',
    'Outdoor Seating', 'Quiet', 'Lively', 'Traditional', 'Modern',
    'Cozy', 'Spacious', 'View', 'Live Music', 'Bar Setting'
  ];

  /**
   * Validates user registration data
   */
  static validateRegistration(data: UserRegistrationRequest): Joi.ValidationResult {
    const schema = Joi.object({
      email: Joi.string().email().required().messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required'
      }),
      password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
        'any.required': 'Password is required'
      }),
      name: Joi.string().min(2).max(50).required().messages({
        'string.min': 'Name must be at least 2 characters long',
        'string.max': 'Name cannot exceed 50 characters',
        'any.required': 'Name is required'
      }),
      preferences: Joi.object({
        cuisineTypes: Joi.array().items(Joi.string().valid(...this.CUISINE_TYPES)),
        priceRange: Joi.array().length(2).items(Joi.number().min(1).max(4)),
        dietaryRestrictions: Joi.array().items(Joi.string().valid(...this.DIETARY_RESTRICTIONS)),
        atmospherePreferences: Joi.array().items(Joi.string().valid(...this.ATMOSPHERE_PREFERENCES)),
        spiceLevel: Joi.number().min(0).max(5)
      }).optional()
    });

    return schema.validate(data);
  }

  /**
   * Validates user profile update data
   */
  static validateProfileUpdate(data: UserUpdateRequest): Joi.ValidationResult {
    const schema = Joi.object({
      name: Joi.string().min(2).max(50).optional(),
      preferences: Joi.object({
        cuisineTypes: Joi.array().items(Joi.string().valid(...this.CUISINE_TYPES)),
        priceRange: Joi.array().length(2).items(Joi.number().min(1).max(4)),
        dietaryRestrictions: Joi.array().items(Joi.string().valid(...this.DIETARY_RESTRICTIONS)),
        atmospherePreferences: Joi.array().items(Joi.string().valid(...this.ATMOSPHERE_PREFERENCES)),
        spiceLevel: Joi.number().min(0).max(5)
      }).optional(),
      location: Joi.object({
        latitude: Joi.number().min(22.1).max(22.6),
        longitude: Joi.number().min(113.8).max(114.5),
        district: Joi.string().valid(...this.HONG_KONG_DISTRICTS)
      }).optional()
    });

    return schema.validate(data);
  }

  /**
   * Validates user preferences
   */
  static validatePreferences(preferences: Partial<UserPreferences>): Joi.ValidationResult {
    const schema = Joi.object({
      cuisineTypes: Joi.array().items(Joi.string().valid(...this.CUISINE_TYPES)).optional(),
      priceRange: Joi.array().length(2).items(Joi.number().min(1).max(4)).optional(),
      dietaryRestrictions: Joi.array().items(Joi.string().valid(...this.DIETARY_RESTRICTIONS)).optional(),
      atmospherePreferences: Joi.array().items(Joi.string().valid(...this.ATMOSPHERE_PREFERENCES)).optional(),
      spiceLevel: Joi.number().min(0).max(5).optional()
    });

    return schema.validate(preferences);
  }

  /**
   * Validates dining history entry
   */
  static validateDiningHistory(history: Omit<DiningHistory, 'id'>): Joi.ValidationResult {
    const schema = Joi.object({
      restaurantId: Joi.string().required(),
      visitDate: Joi.date().max('now').required(),
      rating: Joi.number().min(1).max(5).optional(),
      notes: Joi.string().max(500).optional(),
      moodContext: Joi.string().max(100).optional()
    });

    return schema.validate(history);
  }

  /**
   * Validates emotional profile
   */
  static validateEmotionalProfile(profile: Partial<EmotionalProfile>): Joi.ValidationResult {
    const schema = Joi.object({
      preferredMoodCuisines: Joi.object().pattern(
        Joi.string(),
        Joi.array().items(Joi.string().valid(...this.CUISINE_TYPES))
      ).optional(),
      comfortFoodPreferences: Joi.array().items(Joi.string().valid(...this.CUISINE_TYPES)).optional(),
      celebratoryPreferences: Joi.array().items(Joi.string().valid(...this.CUISINE_TYPES)).optional(),
      lastEmotionalState: Joi.string().max(50).optional(),
      emotionalPatterns: Joi.array().items(
        Joi.object({
          emotion: Joi.string().required(),
          frequency: Joi.number().min(0).max(1).required(),
          associatedCuisines: Joi.array().items(Joi.string().valid(...this.CUISINE_TYPES)).required(),
          timeOfDay: Joi.string().valid('morning', 'afternoon', 'evening', 'night').optional()
        })
      ).optional()
    });

    return schema.validate(profile);
  }

  /**
   * Validates user location
   */
  static validateLocation(location: Partial<UserLocation>): Joi.ValidationResult {
    const schema = Joi.object({
      latitude: Joi.number().min(22.1).max(22.6).optional(),
      longitude: Joi.number().min(113.8).max(114.5).optional(),
      district: Joi.string().valid(...this.HONG_KONG_DISTRICTS).optional()
    });

    return schema.validate(location);
  }

  /**
   * Validates email format
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validates password strength
   */
  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}