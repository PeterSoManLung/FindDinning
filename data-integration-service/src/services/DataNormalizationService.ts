import { 
  RawRestaurantData, 
  NormalizedRestaurantData, 
  NormalizedReviewData,
  SourceMetadata,
  DataQualityScore 
} from '../types/dataSource.types';
import { Logger } from 'winston';
import { createLogger } from '../utils/logger';
import * as _ from 'lodash';

export class DataNormalizationService {
  private logger: Logger;

  constructor() {
    this.logger = createLogger('DataNormalizationService');
  }

  /**
   * Normalize raw restaurant data from various sources
   */
  async normalizeRestaurantData(
    rawData: RawRestaurantData[], 
    sourceId: string
  ): Promise<NormalizedRestaurantData[]> {
    const normalizedData: NormalizedRestaurantData[] = [];

    for (const raw of rawData) {
      try {
        const normalized = await this.normalizeRestaurant(raw, sourceId);
        if (normalized) {
          normalizedData.push(normalized);
        }
      } catch (error) {
        this.logger.error(`Failed to normalize restaurant ${raw.externalId}:`, error);
      }
    }

    this.logger.info(`Normalized ${normalizedData.length} out of ${rawData.length} restaurants`);
    return normalizedData;
  }

  /**
   * Normalize a single restaurant record
   */
  private async normalizeRestaurant(
    raw: RawRestaurantData, 
    sourceId: string
  ): Promise<NormalizedRestaurantData | null> {
    // Skip if missing critical data
    if (!raw.name || !raw.address) {
      this.logger.warn(`Skipping restaurant with missing critical data: ${raw.externalId}`);
      return null;
    }

    const normalized: NormalizedRestaurantData = {
      externalId: raw.externalId,
      name: this.normalizeName(raw.name),
      address: this.normalizeAddress(raw.address),
      location: this.normalizeLocation(raw),
      cuisineType: this.normalizeCuisineTypes(raw.cuisineType || []),
      priceRange: this.normalizePriceRange(raw.priceRange),
      rating: this.normalizeRating(raw.rating),
      reviewCount: raw.reviewCount || 0,
      operatingHours: this.normalizeOperatingHours(raw.operatingHours || {}),
      contactInfo: {
        phone: this.normalizePhone(raw.phone),
        website: this.normalizeWebsite(raw.website)
      },
      menuHighlights: this.normalizeMenuItems(raw.menuItems || []),
      features: this.normalizeFeatures(raw.features || []),
      photos: this.normalizePhotos(raw.photos || []),
      reviews: this.normalizeReviews(raw.reviews || []),
      sourceMetadata: this.createSourceMetadata(raw, sourceId),
      dataQuality: this.calculateDataQuality(raw)
    };

    return normalized;
  }

  /**
   * Normalize restaurant name
   */
  private normalizeName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-&'()]/g, '')
      .substring(0, 100);
  }

  /**
   * Normalize address
   */
  private normalizeAddress(address: string): string {
    if (!address) return '';

    return address
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/,+/g, ',')
      .replace(/^,|,$/g, '')
      .substring(0, 200);
  }

  /**
   * Normalize location data
   */
  private normalizeLocation(raw: RawRestaurantData): { latitude: number; longitude: number; district: string } {
    const defaultLocation = {
      latitude: 22.3193,
      longitude: 114.1694,
      district: 'Unknown'
    };

    if (!raw.latitude || !raw.longitude) {
      this.logger.warn(`Missing coordinates for restaurant ${raw.externalId}`);
      return defaultLocation;
    }

    const latitude = parseFloat(raw.latitude.toString());
    const longitude = parseFloat(raw.longitude.toString());

    // Validate Hong Kong coordinates
    if (isNaN(latitude) || isNaN(longitude) || 
        latitude < 22.1 || latitude > 22.6 || 
        longitude < 113.8 || longitude > 114.5) {
      this.logger.warn(`Invalid coordinates for restaurant ${raw.externalId}: ${latitude}, ${longitude}`);
      return defaultLocation;
    }

    return {
      latitude,
      longitude,
      district: this.determineDistrict(latitude, longitude)
    };
  }

  /**
   * Determine Hong Kong district from coordinates
   */
  private determineDistrict(latitude: number, longitude: number): string {
    // Simplified district mapping for Hong Kong
    const districts = [
      { name: 'Central', lat: 22.2783, lng: 114.1747, radius: 0.01 },
      { name: 'Tsim Sha Tsui', lat: 22.2976, lng: 114.1722, radius: 0.01 },
      { name: 'Causeway Bay', lat: 22.2793, lng: 114.1847, radius: 0.01 },
      { name: 'Wan Chai', lat: 22.2783, lng: 114.1747, radius: 0.01 },
      { name: 'Mong Kok', lat: 22.3193, lng: 114.1694, radius: 0.01 },
      { name: 'Admiralty', lat: 22.2783, lng: 114.1656, radius: 0.01 },
      { name: 'Sheung Wan', lat: 22.2864, lng: 114.1508, radius: 0.01 }
    ];

    for (const district of districts) {
      const distance = Math.sqrt(
        Math.pow(latitude - district.lat, 2) + Math.pow(longitude - district.lng, 2)
      );
      
      if (distance <= district.radius) {
        return district.name;
      }
    }

    // Determine by general area if no specific district match
    if (longitude < 114.15) return 'Hong Kong Island West';
    if (longitude > 114.2) return 'New Territories';
    if (latitude > 22.32) return 'Kowloon North';
    if (latitude < 22.25) return 'Hong Kong Island South';
    
    return 'Kowloon';
  }

  /**
   * Normalize cuisine types
   */
  private normalizeCuisineTypes(cuisineTypes: string[]): string[] {
    const cuisineMapping: Record<string, string> = {
      'chinese': 'Chinese',
      'cantonese': 'Cantonese',
      'dim sum': 'Dim Sum',
      'japanese': 'Japanese',
      'sushi': 'Japanese',
      'korean': 'Korean',
      'thai': 'Thai',
      'vietnamese': 'Vietnamese',
      'indian': 'Indian',
      'western': 'Western',
      'italian': 'Italian',
      'french': 'French',
      'american': 'American',
      'seafood': 'Seafood',
      'bbq': 'BBQ',
      'hotpot': 'Hot Pot',
      'fast food': 'Fast Food',
      'cafe': 'Cafe',
      'dessert': 'Dessert',
      'bakery': 'Bakery'
    };

    const normalized = cuisineTypes
      .map(type => type.toLowerCase().trim())
      .map(type => cuisineMapping[type] || this.capitalizeWords(type))
      .filter(type => type.length > 0);

    return [...new Set(normalized)]; // Remove duplicates
  }

  /**
   * Normalize price range to 1-4 scale
   */
  private normalizePriceRange(priceRange?: number): number {
    if (!priceRange || priceRange < 1 || priceRange > 4) {
      return 2; // Default to medium price range
    }
    return Math.round(priceRange);
  }

  /**
   * Normalize rating to 0-5 scale
   */
  private normalizeRating(rating?: number): number {
    if (!rating || rating < 0) return 0;
    if (rating > 5) return 5;
    return Math.round(rating * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Normalize operating hours
   */
  private normalizeOperatingHours(hours: Record<string, string>): Record<string, string> {
    const dayMapping: Record<string, string> = {
      'mon': 'Monday',
      'tue': 'Tuesday',
      'wed': 'Wednesday',
      'thu': 'Thursday',
      'fri': 'Friday',
      'sat': 'Saturday',
      'sun': 'Sunday',
      'monday': 'Monday',
      'tuesday': 'Tuesday',
      'wednesday': 'Wednesday',
      'thursday': 'Thursday',
      'friday': 'Friday',
      'saturday': 'Saturday',
      'sunday': 'Sunday'
    };

    const normalized: Record<string, string> = {};

    for (const [day, time] of Object.entries(hours)) {
      const normalizedDay = dayMapping[day.toLowerCase()] || this.capitalizeWords(day);
      const normalizedTime = this.normalizeTimeString(time);
      
      if (normalizedTime) {
        normalized[normalizedDay] = normalizedTime;
      }
    }

    return normalized;
  }

  /**
   * Normalize time string
   */
  private normalizeTimeString(timeStr: string): string {
    if (!timeStr) return '';

    // Handle common time formats
    return timeStr
      .replace(/(\d{1,2}):(\d{2}):(\d{2})\s*(am|pm)/gi, '$1:$2 $4') // Remove seconds
      .replace(/(\d{1,2}):(\d{2})\s*(am|pm)/gi, '$1:$2 $3')
      .replace(/(\d{1,2})\s*(am|pm)/gi, '$1:00 $2')
      .replace(/closed/gi, 'Closed')
      .trim();
  }

  /**
   * Normalize phone number
   */
  private normalizePhone(phone?: string): string | undefined {
    if (!phone) return undefined;

    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    // Hong Kong phone number validation
    if (cleaned.match(/^\+852\d{8}$/) || cleaned.match(/^\d{8}$/)) {
      return cleaned.startsWith('+852') ? cleaned : `+852${cleaned}`;
    }

    return undefined;
  }

  /**
   * Normalize website URL
   */
  private normalizeWebsite(website?: string): string | undefined {
    if (!website) return undefined;

    let url = website.trim();
    
    // Only add protocol if it looks like a valid domain
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Check if it contains at least one dot and valid characters
      if (url.includes('.') && /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(url)) {
        url = `https://${url}`;
      } else {
        return undefined;
      }
    }

    try {
      new URL(url);
      return url;
    } catch {
      return undefined;
    }
  }

  /**
   * Normalize menu items
   */
  private normalizeMenuItems(menuItems: string[]): string[] {
    return menuItems
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .map(item => this.capitalizeWords(item))
      .slice(0, 20); // Limit to 20 items
  }

  /**
   * Normalize features
   */
  private normalizeFeatures(features: string[]): string[] {
    const featureMapping: Record<string, string> = {
      'wifi': 'WiFi',
      'parking': 'Parking',
      'outdoor seating': 'Outdoor Seating',
      'delivery': 'Delivery',
      'takeout': 'Takeout',
      'reservations': 'Reservations',
      'credit cards': 'Credit Cards',
      'wheelchair accessible': 'Wheelchair Accessible',
      'live music': 'Live Music',
      'private dining': 'Private Dining'
    };

    return features
      .map(feature => feature.toLowerCase().trim())
      .map(feature => featureMapping[feature] || this.capitalizeWords(feature))
      .filter(feature => feature.length > 0)
      .slice(0, 10); // Limit to 10 features
  }

  /**
   * Normalize photo URLs
   */
  private normalizePhotos(photos: string[]): string[] {
    return photos
      .filter(photo => this.isValidUrl(photo))
      .slice(0, 10); // Limit to 10 photos
  }

  /**
   * Normalize reviews
   */
  private normalizeReviews(reviews: any[]): NormalizedReviewData[] {
    return reviews
      .map(review => this.normalizeReview(review))
      .filter(review => review !== null)
      .slice(0, 50) as NormalizedReviewData[]; // Limit to 50 reviews
  }

  /**
   * Normalize a single review
   */
  private normalizeReview(review: any): NormalizedReviewData | null {
    if (!review.content || !review.rating) {
      return null;
    }

    return {
      externalId: review.externalId || '',
      rating: this.normalizeRating(review.rating),
      content: review.content.trim().substring(0, 1000),
      authorName: review.authorName?.trim(),
      visitDate: review.visitDate ? new Date(review.visitDate) : undefined,
      photos: this.normalizePhotos(review.photos || []),
      isVerified: Boolean(review.isVerified),
      helpfulCount: Math.max(0, review.helpfulCount || 0),
      sentimentScore: 0, // Will be calculated by sentiment analysis service
      authenticityScore: 0, // Will be calculated by authenticity service
      negativeCategories: [] // Will be populated by negative feedback analysis
    };
  }

  /**
   * Create source metadata
   */
  private createSourceMetadata(raw: RawRestaurantData, sourceId: string): SourceMetadata {
    return {
      sourceId,
      sourceName: this.getSourceName(sourceId),
      extractedAt: new Date(),
      lastUpdated: raw.lastUpdated,
      reliability: this.calculateSourceReliability(sourceId),
      completeness: raw.dataQuality
    };
  }

  /**
   * Calculate data quality score
   */
  private calculateDataQuality(raw: RawRestaurantData): DataQualityScore {
    const completeness = this.calculateCompleteness(raw);
    const accuracy = this.calculateAccuracy(raw);
    const freshness = this.calculateFreshness(raw.lastUpdated);
    const consistency = 0.8; // Default consistency score

    return {
      overall: (completeness + accuracy + freshness + consistency) / 4,
      completeness,
      accuracy,
      freshness,
      consistency
    };
  }

  /**
   * Calculate completeness score
   */
  private calculateCompleteness(raw: RawRestaurantData): number {
    const requiredFields = ['name', 'address'];
    const importantFields = ['latitude', 'longitude', 'cuisineType', 'priceRange'];
    const optionalFields = ['rating', 'phone', 'operatingHours'];
    
    let score = 0;
    let totalWeight = 0;

    // Required fields (weight: 3)
    for (const field of requiredFields) {
      const value = raw[field as keyof RawRestaurantData];
      if (value !== null && value !== undefined && value !== '') {
        score += 3;
      }
      totalWeight += 3;
    }

    // Important fields (weight: 2)
    for (const field of importantFields) {
      const value = raw[field as keyof RawRestaurantData];
      if (value !== null && value !== undefined && value !== '') {
        score += 2;
      }
      totalWeight += 2;
    }

    // Optional fields (weight: 1)
    for (const field of optionalFields) {
      const value = raw[field as keyof RawRestaurantData];
      if (value !== null && value !== undefined && value !== '') {
        score += 1;
      }
      totalWeight += 1;
    }

    return score / totalWeight;
  }

  /**
   * Calculate accuracy score based on data validation
   */
  private calculateAccuracy(raw: RawRestaurantData): number {
    let score = 1.0;

    // Check coordinate validity
    if (raw.latitude && raw.longitude) {
      const lat = parseFloat(raw.latitude.toString());
      const lng = parseFloat(raw.longitude.toString());
      if (lat < 22.1 || lat > 22.6 || lng < 113.8 || lng > 114.5) {
        score -= 0.2;
      }
    }

    // Check rating validity
    if (raw.rating && (raw.rating < 0 || raw.rating > 5)) {
      score -= 0.1;
    }

    // Check price range validity
    if (raw.priceRange && (raw.priceRange < 1 || raw.priceRange > 4)) {
      score -= 0.1;
    }

    return Math.max(0, score);
  }

  /**
   * Calculate freshness score based on last update time
   */
  private calculateFreshness(lastUpdated: Date): number {
    const now = new Date();
    const daysSinceUpdate = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceUpdate <= 7) return 1.0;
    if (daysSinceUpdate <= 30) return 0.8;
    if (daysSinceUpdate <= 90) return 0.6;
    if (daysSinceUpdate <= 180) return 0.4;
    return 0.2;
  }

  /**
   * Get source name from ID
   */
  private getSourceName(sourceId: string): string {
    const sourceNames: Record<string, string> = {
      'openrice': 'OpenRice',
      'tripadvisor': 'TripAdvisor',
      'eatigo': 'Eatigo',
      'chope': 'Chope',
      'foodpanda': 'Foodpanda',
      'bistrochat': 'BistroCHAT',
      'keeta': 'Keeta',
      'gov_hk': 'data.gov.hk'
    };

    return sourceNames[sourceId] || sourceId;
  }

  /**
   * Calculate source reliability score
   */
  private calculateSourceReliability(sourceId: string): number {
    const reliabilityScores: Record<string, number> = {
      'gov_hk': 1.0,
      'openrice': 0.9,
      'tripadvisor': 0.85,
      'chope': 0.8,
      'eatigo': 0.8,
      'foodpanda': 0.75,
      'bistrochat': 0.7,
      'keeta': 0.7
    };

    return reliabilityScores[sourceId] || 0.6;
  }

  /**
   * Utility: Capitalize words
   */
  private capitalizeWords(str: string): string {
    return str.replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
    );
  }

  /**
   * Utility: Check if URL is valid
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