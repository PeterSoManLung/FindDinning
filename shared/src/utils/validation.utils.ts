import { ErrorCode } from '../types/api.types';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  code: ErrorCode;
  message: string;
}

export class ValidationUtils {
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validatePassword(password: string): ValidationResult {
    const errors: ValidationError[] = [];

    if (password.length < 8) {
      errors.push({
        field: 'password',
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Password must be at least 8 characters long'
      });
    }

    if (!/(?=.*[a-z])/.test(password)) {
      errors.push({
        field: 'password',
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Password must contain at least one lowercase letter'
      });
    }

    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push({
        field: 'password',
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Password must contain at least one uppercase letter'
      });
    }

    if (!/(?=.*\d)/.test(password)) {
      errors.push({
        field: 'password',
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Password must contain at least one number'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateCoordinates(latitude: number, longitude: number): boolean {
    return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
  }

  static validatePriceRange(priceRange: [number, number]): boolean {
    return priceRange[0] >= 1 && priceRange[0] <= 4 && 
           priceRange[1] >= 1 && priceRange[1] <= 4 && 
           priceRange[0] <= priceRange[1];
  }

  static validateRating(rating: number): boolean {
    return rating >= 1 && rating <= 5;
  }

  static validateSpiceLevel(spiceLevel: number): boolean {
    return spiceLevel >= 0 && spiceLevel <= 5;
  }

  static validateTimeFormat(time: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }

  static validatePhoneNumber(phoneNumber: string): boolean {
    // Hong Kong phone number validation
    const hkPhoneRegex = /^(\+852\s?)?[2-9]\d{7}$/;
    return hkPhoneRegex.test(phoneNumber.replace(/\s/g, ''));
  }

  static sanitizeString(input: string): string {
    return input.trim().replace(/[<>]/g, '');
  }

  static validateRequiredFields(obj: any, requiredFields: string[]): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const field of requiredFields) {
      if (!obj[field] || (typeof obj[field] === 'string' && obj[field].trim() === '')) {
        errors.push({
          field,
          code: ErrorCode.MISSING_REQUIRED_FIELD,
          message: `${field} is required`
        });
      }
    }

    return errors;
  }
}