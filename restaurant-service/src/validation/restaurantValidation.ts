import Joi from 'joi';
import { RestaurantCreateRequest, OperatingHours, DayHours, MenuItem } from '../../../shared/src/types/restaurant.types';

// Time format validation (HH:mm) - strict format requiring leading zeros
const timeSchema = Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).messages({
  'string.pattern.base': 'Time must be in HH:mm format (24-hour)'
});

// Day hours validation schema
const dayHoursSchema = Joi.object<DayHours>({
  isOpen: Joi.boolean().required(),
  openTime: Joi.when('isOpen', {
    is: true,
    then: timeSchema.required(),
    otherwise: Joi.optional()
  }),
  closeTime: Joi.when('isOpen', {
    is: true,
    then: timeSchema.required(),
    otherwise: Joi.optional()
  }),
  breaks: Joi.array().items(
    Joi.object({
      startTime: timeSchema.required(),
      endTime: timeSchema.required()
    })
  ).optional()
});

// Operating hours validation schema
const operatingHoursSchema = Joi.object<OperatingHours>({
  monday: dayHoursSchema.required(),
  tuesday: dayHoursSchema.required(),
  wednesday: dayHoursSchema.required(),
  thursday: dayHoursSchema.required(),
  friday: dayHoursSchema.required(),
  saturday: dayHoursSchema.required(),
  sunday: dayHoursSchema.required()
});

// Menu item validation schema
const menuItemSchema = Joi.object<MenuItem>({
  id: Joi.string().required(),
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional(),
  price: Joi.number().min(0).optional(),
  category: Joi.string().min(1).max(50).required(),
  isSignatureDish: Joi.boolean().required(),
  dietaryInfo: Joi.array().items(Joi.string().max(50)).required(),
  spiceLevel: Joi.number().min(0).max(5).optional()
});

// Restaurant location validation schema
const locationSchema = Joi.object({
  address: Joi.string().min(5).max(200).required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  district: Joi.string().min(1).max(50).required()
});

// Restaurant creation validation schema
export const restaurantCreateSchema = Joi.object<RestaurantCreateRequest>({
  name: Joi.string().min(1).max(100).required().messages({
    'string.empty': 'Restaurant name is required',
    'string.min': 'Restaurant name must be at least 1 character',
    'string.max': 'Restaurant name cannot exceed 100 characters'
  }),
  
  cuisineType: Joi.array()
    .items(Joi.string().min(1).max(50))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one cuisine type is required',
      'array.base': 'Cuisine type must be an array'
    }),
  
  location: locationSchema.required(),
  
  priceRange: Joi.number().integer().min(1).max(4).required().messages({
    'number.min': 'Price range must be between 1 and 4',
    'number.max': 'Price range must be between 1 and 4',
    'number.integer': 'Price range must be an integer'
  }),
  
  atmosphere: Joi.array()
    .items(Joi.string().min(1).max(50))
    .required()
    .messages({
      'array.base': 'Atmosphere must be an array'
    }),
  
  operatingHours: operatingHoursSchema.required(),
  
  menuHighlights: Joi.array().items(menuItemSchema).optional(),
  
  specialFeatures: Joi.array()
    .items(Joi.string().min(1).max(100))
    .optional()
});

// Restaurant update validation schema (all fields optional)
export const restaurantUpdateSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  cuisineType: Joi.array().items(Joi.string().min(1).max(50)).min(1).optional(),
  location: locationSchema.optional(),
  priceRange: Joi.number().integer().min(1).max(4).optional(),
  atmosphere: Joi.array().items(Joi.string().min(1).max(50)).optional(),
  operatingHours: operatingHoursSchema.optional(),
  menuHighlights: Joi.array().items(menuItemSchema).optional(),
  specialFeatures: Joi.array().items(Joi.string().min(1).max(100)).optional(),
  rating: Joi.number().min(0).max(5).optional(),
  negativeScore: Joi.number().min(0).optional(),
  isLocalGem: Joi.boolean().optional(),
  authenticityScore: Joi.number().min(0).max(1).optional()
});

// Restaurant search validation schema
export const restaurantSearchSchema = Joi.object({
  location: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    radius: Joi.number().min(0.1).max(50).optional()
  }).optional(),
  
  cuisineTypes: Joi.array().items(Joi.string().min(1).max(50)).optional(),
  
  priceRange: Joi.array()
    .items(Joi.number().integer().min(1).max(4))
    .length(2)
    .optional()
    .custom((value, helpers) => {
      if (value && value[0] > value[1]) {
        throw new Error('Minimum price cannot be greater than maximum price');
      }
      return value;
    }),
  
  isOpen: Joi.boolean().optional(),
  
  features: Joi.array().items(Joi.string().min(1).max(100)).optional(),
  
  sortBy: Joi.string().valid('distance', 'rating', 'negativeScore', 'popularity').optional()
});

/**
 * Validate restaurant creation data
 */
export function validateRestaurantCreate(data: any): { error?: string; value?: RestaurantCreateRequest } {
  const { error, value } = restaurantCreateSchema.validate(data, { abortEarly: false });
  
  if (error) {
    const errorMessage = error.details.map(detail => detail.message).join(', ');
    return { error: errorMessage };
  }
  
  // Additional business logic validation
  const validationError = validateBusinessRules(value);
  if (validationError) {
    return { error: validationError };
  }
  
  return { value };
}

/**
 * Validate restaurant update data
 */
export function validateRestaurantUpdate(data: any): { error?: string; value?: Partial<RestaurantCreateRequest> } {
  const { error, value } = restaurantUpdateSchema.validate(data, { abortEarly: false });
  
  if (error) {
    const errorMessage = error.details.map(detail => detail.message).join(', ');
    return { error: errorMessage };
  }
  
  return { value };
}

/**
 * Validate restaurant search criteria
 */
export function validateRestaurantSearch(data: any): { error?: string; value?: any } {
  const { error, value } = restaurantSearchSchema.validate(data, { abortEarly: false });
  
  if (error) {
    const errorMessage = error.details.map(detail => detail.message).join(', ');
    return { error: errorMessage };
  }
  
  return { value };
}

/**
 * Additional business rule validations
 */
function validateBusinessRules(data: RestaurantCreateRequest): string | null {
  // Validate operating hours consistency
  for (const [day, hours] of Object.entries(data.operatingHours)) {
    if (hours.isOpen && hours.openTime && hours.closeTime) {
      // Check if open time is before close time (handle overnight hours)
      if (hours.openTime >= hours.closeTime && hours.closeTime !== '00:00') {
        return `Invalid operating hours for ${day}: open time must be before close time`;
      }
      
      // Validate breaks are within operating hours
      if (hours.breaks) {
        for (const breakTime of hours.breaks) {
          if (breakTime.startTime < hours.openTime || breakTime.endTime > hours.closeTime) {
            return `Break time for ${day} must be within operating hours`;
          }
          if (breakTime.startTime >= breakTime.endTime) {
            return `Break start time must be before end time for ${day}`;
          }
        }
      }
    }
  }
  
  // Validate Hong Kong coordinates (approximate bounds)
  const { latitude, longitude } = data.location;
  if (latitude < 22.1 || latitude > 22.6 || longitude < 113.8 || longitude > 114.5) {
    return 'Location coordinates must be within Hong Kong bounds';
  }
  
  // Validate menu items have unique IDs
  if (data.menuHighlights) {
    const menuIds = data.menuHighlights.map(item => item.id);
    const uniqueIds = new Set(menuIds);
    if (menuIds.length !== uniqueIds.size) {
      return 'Menu item IDs must be unique';
    }
  }
  
  return null;
}

/**
 * Validate time format and logical consistency
 */
export function validateTimeFormat(time: string): boolean {
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
}

/**
 * Check if restaurant is within Hong Kong bounds
 */
export function isWithinHongKongBounds(latitude: number, longitude: number): boolean {
  return latitude >= 22.1 && latitude <= 22.6 && longitude >= 113.8 && longitude <= 114.5;
}