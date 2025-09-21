import { 
  RawRestaurantData, 
  NormalizedRestaurantData, 
  DataValidationResult, 
  ValidationError, 
  ValidationWarning 
} from '../types/dataSource.types';
import { Logger } from 'winston';
import { createLogger } from '../utils/logger';
import * as Joi from 'joi';

export class DataValidationService {
  private logger: Logger;
  private rawDataSchema!: Joi.ObjectSchema;
  private normalizedDataSchema!: Joi.ObjectSchema;

  constructor() {
    this.logger = createLogger('DataValidationService');
    this.setupValidationSchemas();
  }

  /**
   * Validate raw restaurant data
   */
  async validateRawData(data: RawRestaurantData[]): Promise<DataValidationResult[]> {
    const results: DataValidationResult[] = [];

    for (const restaurant of data) {
      const result = await this.validateSingleRawRestaurant(restaurant);
      results.push(result);
    }

    this.logValidationSummary(results, 'raw');
    return results;
  }

  /**
   * Validate normalized restaurant data
   */
  async validateNormalizedData(data: NormalizedRestaurantData[]): Promise<DataValidationResult[]> {
    const results: DataValidationResult[] = [];

    for (const restaurant of data) {
      const result = await this.validateSingleNormalizedRestaurant(restaurant);
      results.push(result);
    }

    this.logValidationSummary(results, 'normalized');
    return results;
  }

  /**
   * Validate a single raw restaurant
   */
  private async validateSingleRawRestaurant(restaurant: RawRestaurantData): Promise<DataValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Schema validation
    const schemaResult = this.rawDataSchema.validate(restaurant, { abortEarly: false });
    if (schemaResult.error) {
      schemaResult.error.details.forEach(detail => {
        errors.push({
          field: detail.path.join('.'),
          message: detail.message,
          severity: this.determineSeverity(detail.path.join('.'))
        });
      });
    }

    // Business logic validation
    await this.validateBusinessRules(restaurant, errors, warnings);

    // Data quality checks
    await this.performQualityChecks(restaurant, warnings);

    const qualityScore = this.calculateValidationQualityScore(errors, warnings);

    return {
      isValid: errors.filter(e => e.severity === 'critical').length === 0,
      errors,
      warnings,
      qualityScore
    };
  }

  /**
   * Validate a single normalized restaurant
   */
  private async validateSingleNormalizedRestaurant(restaurant: NormalizedRestaurantData): Promise<DataValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Schema validation
    const schemaResult = this.normalizedDataSchema.validate(restaurant, { abortEarly: false });
    if (schemaResult.error) {
      schemaResult.error.details.forEach(detail => {
        errors.push({
          field: detail.path.join('.'),
          message: detail.message,
          severity: this.determineSeverity(detail.path.join('.'))
        });
      });
    }

    // Normalized data specific validations
    await this.validateNormalizedBusinessRules(restaurant, errors, warnings);

    const qualityScore = this.calculateValidationQualityScore(errors, warnings);

    return {
      isValid: errors.filter(e => e.severity === 'critical').length === 0,
      errors,
      warnings,
      qualityScore
    };
  }

  /**
   * Validate business rules for raw data
   */
  private async validateBusinessRules(
    restaurant: RawRestaurantData, 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): Promise<void> {
    // Name validation
    if (!restaurant.name || restaurant.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Restaurant name is required',
        severity: 'critical'
      });
    } else if (restaurant.name.length > 100) {
      warnings.push({
        field: 'name',
        message: 'Restaurant name is unusually long',
        suggestion: 'Consider truncating to 100 characters'
      });
    }

    // Location validation
    if (restaurant.latitude && restaurant.longitude) {
      const lat = parseFloat(restaurant.latitude.toString());
      const lng = parseFloat(restaurant.longitude.toString());

      if (isNaN(lat) || isNaN(lng)) {
        errors.push({
          field: 'location',
          message: 'Invalid coordinate format',
          severity: 'major'
        });
      } else if (lat < 22.1 || lat > 22.6 || lng < 113.8 || lng > 114.5) {
        warnings.push({
          field: 'location',
          message: 'Coordinates appear to be outside Hong Kong',
          suggestion: 'Verify location accuracy'
        });
      }
    } else if (!restaurant.address) {
      errors.push({
        field: 'location',
        message: 'Either coordinates or address must be provided',
        severity: 'major'
      });
    }

    // Rating validation
    if (restaurant.rating !== undefined) {
      const rating = parseFloat(restaurant.rating.toString());
      if (isNaN(rating) || rating < 0 || rating > 5) {
        errors.push({
          field: 'rating',
          message: 'Rating must be between 0 and 5',
          severity: 'minor'
        });
      }
    }

    // Price range validation
    if (restaurant.priceRange !== undefined) {
      const priceRange = parseInt(restaurant.priceRange.toString());
      if (isNaN(priceRange) || priceRange < 1 || priceRange > 4) {
        errors.push({
          field: 'priceRange',
          message: 'Price range must be between 1 and 4',
          severity: 'minor'
        });
      }
    }

    // Phone validation
    if (restaurant.phone) {
      if (!this.isValidHongKongPhone(restaurant.phone)) {
        warnings.push({
          field: 'phone',
          message: 'Phone number format may be invalid for Hong Kong',
          suggestion: 'Verify phone number format'
        });
      }
    }

    // Website validation
    if (restaurant.website) {
      if (!this.isValidUrl(restaurant.website)) {
        warnings.push({
          field: 'website',
          message: 'Website URL format appears invalid',
          suggestion: 'Check URL format'
        });
      }
    }

    // Data freshness validation
    const daysSinceUpdate = (Date.now() - restaurant.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > 90) {
      warnings.push({
        field: 'lastUpdated',
        message: 'Data is more than 90 days old',
        suggestion: 'Consider refreshing data from source'
      });
    }
  }

  /**
   * Validate business rules for normalized data
   */
  private async validateNormalizedBusinessRules(
    restaurant: NormalizedRestaurantData, 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): Promise<void> {
    // District validation
    const validDistricts = [
      'Central', 'Tsim Sha Tsui', 'Causeway Bay', 'Wan Chai', 'Mong Kok',
      'Admiralty', 'Sheung Wan', 'Hong Kong Island West', 'Hong Kong Island South',
      'New Territories', 'Kowloon North', 'Kowloon'
    ];

    if (!validDistricts.includes(restaurant.location.district)) {
      warnings.push({
        field: 'location.district',
        message: 'District not recognized',
        suggestion: 'Verify district mapping'
      });
    }

    // Cuisine type validation
    const validCuisines = [
      'Chinese', 'Cantonese', 'Dim Sum', 'Japanese', 'Korean', 'Thai', 'Vietnamese',
      'Indian', 'Western', 'Italian', 'French', 'American', 'Seafood', 'BBQ',
      'Hot Pot', 'Fast Food', 'Cafe', 'Dessert', 'Bakery'
    ];

    const invalidCuisines = restaurant.cuisineType.filter(cuisine => !validCuisines.includes(cuisine));
    if (invalidCuisines.length > 0) {
      warnings.push({
        field: 'cuisineType',
        message: `Unrecognized cuisine types: ${invalidCuisines.join(', ')}`,
        suggestion: 'Review cuisine type mapping'
      });
    }

    // Data quality validation
    if (restaurant.dataQuality.overall < 0.5) {
      warnings.push({
        field: 'dataQuality',
        message: 'Overall data quality is low',
        suggestion: 'Consider improving data completeness and accuracy'
      });
    }

    // Review validation
    if (restaurant.reviewCount > 0 && restaurant.reviews.length === 0) {
      warnings.push({
        field: 'reviews',
        message: 'Review count indicates reviews exist but none are present',
        suggestion: 'Check review extraction process'
      });
    }

    // Operating hours validation
    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const invalidDays = Object.keys(restaurant.operatingHours).filter(day => !validDays.includes(day));
    if (invalidDays.length > 0) {
      warnings.push({
        field: 'operatingHours',
        message: `Invalid day names: ${invalidDays.join(', ')}`,
        suggestion: 'Standardize day names'
      });
    }
  }

  /**
   * Perform quality checks
   */
  private async performQualityChecks(
    restaurant: RawRestaurantData, 
    warnings: ValidationWarning[]
  ): Promise<void> {
    // Completeness check
    const requiredFields = ['name', 'address'];
    const optionalFields = ['latitude', 'longitude', 'cuisineType', 'priceRange', 'rating', 'phone'];
    
    let filledOptionalFields = 0;
    for (const field of optionalFields) {
      if (restaurant[field as keyof RawRestaurantData]) {
        filledOptionalFields++;
      }
    }

    const completeness = filledOptionalFields / optionalFields.length;
    if (completeness < 0.5) {
      warnings.push({
        field: 'general',
        message: 'Data completeness is low',
        suggestion: 'Try to extract more fields from the source'
      });
    }

    // Consistency checks
    if (restaurant.rating && restaurant.reviewCount === 0) {
      warnings.push({
        field: 'rating',
        message: 'Rating exists but no review count',
        suggestion: 'Verify rating and review count consistency'
      });
    }

    // Duplicate content check
    if (restaurant.name && restaurant.address && restaurant.name.toLowerCase() === restaurant.address.toLowerCase()) {
      warnings.push({
        field: 'name',
        message: 'Name and address appear to be identical',
        suggestion: 'Verify data extraction accuracy'
      });
    }
  }

  /**
   * Setup Joi validation schemas
   */
  private setupValidationSchemas(): void {
    // Raw data schema
    this.rawDataSchema = Joi.object({
      sourceId: Joi.string().required(),
      externalId: Joi.string().required(),
      name: Joi.string().min(1).max(200).required(),
      address: Joi.string().max(500),
      latitude: Joi.alternatives().try(Joi.number(), Joi.string()),
      longitude: Joi.alternatives().try(Joi.number(), Joi.string()),
      cuisineType: Joi.array().items(Joi.string()),
      priceRange: Joi.alternatives().try(Joi.number().min(1).max(4), Joi.string()),
      rating: Joi.alternatives().try(Joi.number().min(0).max(5), Joi.string()),
      reviewCount: Joi.number().min(0),
      operatingHours: Joi.object().pattern(Joi.string(), Joi.string()),
      phone: Joi.string(),
      website: Joi.string().uri(),
      menuItems: Joi.array().items(Joi.string()),
      features: Joi.array().items(Joi.string()),
      photos: Joi.array().items(Joi.string().uri()),
      reviews: Joi.array(),
      lastUpdated: Joi.date().required(),
      dataQuality: Joi.number().min(0).max(1).required()
    });

    // Normalized data schema
    this.normalizedDataSchema = Joi.object({
      externalId: Joi.string().required(),
      name: Joi.string().min(1).max(100).required(),
      address: Joi.string().max(200).required(),
      location: Joi.object({
        latitude: Joi.number().min(22.1).max(22.6).required(),
        longitude: Joi.number().min(113.8).max(114.5).required(),
        district: Joi.string().required()
      }).required(),
      cuisineType: Joi.array().items(Joi.string()).min(1).required(),
      priceRange: Joi.number().min(1).max(4).required(),
      rating: Joi.number().min(0).max(5).required(),
      reviewCount: Joi.number().min(0).required(),
      operatingHours: Joi.object().pattern(Joi.string(), Joi.string()),
      contactInfo: Joi.object({
        phone: Joi.string().pattern(/^\+852\d{8}$/),
        website: Joi.string().uri()
      }),
      menuHighlights: Joi.array().items(Joi.string()).max(20),
      features: Joi.array().items(Joi.string()).max(10),
      photos: Joi.array().items(Joi.string().uri()).max(10),
      reviews: Joi.array().max(100),
      sourceMetadata: Joi.object().required(),
      dataQuality: Joi.object({
        overall: Joi.number().min(0).max(1).required(),
        completeness: Joi.number().min(0).max(1).required(),
        accuracy: Joi.number().min(0).max(1).required(),
        freshness: Joi.number().min(0).max(1).required(),
        consistency: Joi.number().min(0).max(1).required()
      }).required()
    });
  }

  /**
   * Determine error severity based on field
   */
  private determineSeverity(field: string): 'critical' | 'major' | 'minor' {
    const criticalFields = ['name', 'externalId', 'sourceId'];
    const majorFields = ['address', 'location', 'latitude', 'longitude'];

    if (criticalFields.some(f => field.includes(f))) return 'critical';
    if (majorFields.some(f => field.includes(f))) return 'major';
    return 'minor';
  }

  /**
   * Calculate validation quality score
   */
  private calculateValidationQualityScore(errors: ValidationError[], warnings: ValidationWarning[]): number {
    let score = 1.0;

    // Deduct points for errors
    errors.forEach(error => {
      switch (error.severity) {
        case 'critical':
          score -= 0.3;
          break;
        case 'major':
          score -= 0.2;
          break;
        case 'minor':
          score -= 0.1;
          break;
      }
    });

    // Deduct smaller amounts for warnings
    warnings.forEach(() => {
      score -= 0.05;
    });

    return Math.max(0, score);
  }

  /**
   * Log validation summary
   */
  private logValidationSummary(results: DataValidationResult[], dataType: string): void {
    const totalRecords = results.length;
    const validRecords = results.filter(r => r.isValid).length;
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
    const avgQuality = results.reduce((sum, r) => sum + r.qualityScore, 0) / totalRecords;

    this.logger.info(`Validation Summary for ${dataType} data:`, {
      totalRecords,
      validRecords,
      validationRate: `${((validRecords / totalRecords) * 100).toFixed(1)}%`,
      totalErrors,
      totalWarnings,
      averageQualityScore: avgQuality.toFixed(3)
    });

    // Log most common errors
    const errorCounts: Record<string, number> = {};
    results.forEach(result => {
      result.errors.forEach(error => {
        const key = `${error.field}: ${error.message}`;
        errorCounts[key] = (errorCounts[key] || 0) + 1;
      });
    });

    const topErrors = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    if (topErrors.length > 0) {
      this.logger.info('Most common validation errors:', topErrors);
    }
  }

  /**
   * Utility: Validate Hong Kong phone number
   */
  private isValidHongKongPhone(phone: string): boolean {
    const cleaned = phone.replace(/[^\d+]/g, '');
    return /^\+852\d{8}$/.test(cleaned) || /^\d{8}$/.test(cleaned);
  }

  /**
   * Utility: Validate URL
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}