import { BaseDataExtractor } from './BaseDataExtractor';
import { DataSource, RawRestaurantData, DataExtractionResult, RawReviewData } from '../types/dataSource.types';

export class ChopeExtractor extends BaseDataExtractor {
  constructor() {
    const dataSource: DataSource = {
      id: 'chope',
      name: 'Chope',
      type: 'api' as any,
      baseUrl: 'https://api.chope.co',
      isActive: true,
      rateLimitMs: 2000, // 1 request per 2 seconds
      maxRetries: 3,
      timeout: 15000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'FindDining-DataIntegration/1.0'
      },
      authentication: {
        type: 'api_key',
        credentials: {
          apiKey: process.env.CHOPE_API_KEY || ''
        }
      }
    };
    
    super(dataSource);
  }

  async extractRestaurantData(params?: { 
    city?: string; 
    district?: string; 
    limit?: number; 
    offset?: number 
  }): Promise<DataExtractionResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const restaurants: RawRestaurantData[] = [];

    try {
      const queryParams = new URLSearchParams({
        city: params?.city || 'hong-kong',
        limit: (params?.limit || 50).toString(),
        offset: (params?.offset || 0).toString(),
        ...(params?.district && { area: params.district })
      });

      const response = await this.makeRequest<any>({
        method: 'GET',
        url: `/api/v1/restaurants?${queryParams.toString()}`
      });

      if (response.restaurants) {
        for (const restaurant of response.restaurants) {
          try {
            const normalizedData = await this.normalizeChopeData(restaurant);
            if (normalizedData) {
              restaurants.push(normalizedData);
            }
          } catch (error: any) {
            errors.push(`Failed to normalize restaurant ${restaurant.id}: ${error.message}`);
            this.logger.warn(`Normalization error for restaurant ${restaurant.id}:`, error);
          }
        }
      }

      return {
        success: true,
        data: restaurants,
        errors,
        metadata: {
          totalExtracted: restaurants.length,
          processingTime: Date.now() - startTime,
          sourceReliability: 0.82 // Chope has good reservation data and basic restaurant info
        }
      };

    } catch (error: any) {
      this.logger.error('Chope extraction failed:', error);
      return {
        success: false,
        errors: [error.message],
        metadata: {
          totalExtracted: 0,
          processingTime: Date.now() - startTime,
          sourceReliability: 0
        }
      };
    }
  }

  async extractRestaurantById(externalId: string): Promise<RawRestaurantData | null> {
    try {
      const response = await this.makeRequest<any>({
        method: 'GET',
        url: `/api/v1/restaurants/${externalId}`
      });

      if (response.restaurant) {
        return await this.normalizeChopeData(response.restaurant);
      }

      return null;
    } catch (error: any) {
      this.logger.error(`Failed to extract Chope restaurant ${externalId}:`, error);
      return null;
    }
  }

  async extractIncremental(since: Date): Promise<DataExtractionResult> {
    // Chope focuses on reservations, extract restaurants with recent availability updates
    this.logger.info(`Chope incremental extraction since ${since.toISOString()} - extracting available restaurants`);
    return this.extractRestaurantData();
  }

  private async normalizeChopeData(restaurant: any): Promise<RawRestaurantData> {
    const coordinates = this.parseCoordinates(restaurant.latitude, restaurant.longitude);
    
    // Chope typically has limited reviews, focus on reservation and availability data
    const reviews: RawReviewData[] = [];
    if (restaurant.reviews) {
      for (const review of restaurant.reviews.slice(0, 5)) {
        reviews.push({
          externalId: review.id?.toString() || `${restaurant.id}_${Date.now()}`,
          rating: this.normalizeRating(review.rating),
          content: this.cleanText(review.comment || review.feedback || ''),
          authorName: this.cleanText(review.diner?.name || review.user_name || ''),
          visitDate: review.dining_date ? new Date(review.dining_date) : undefined,
          photos: [],
          isVerified: review.verified_booking || false,
          helpfulCount: 0,
          source: 'chope'
        });
      }
    }

    // Extract reservation-specific features
    const features = this.extractFeatures(restaurant.amenities || []);
    features.push('Online Reservations');
    
    if (restaurant.instant_booking) {
      features.push('Instant Booking');
    }
    
    if (restaurant.cancellation_policy) {
      features.push(`Cancellation: ${restaurant.cancellation_policy}`);
    }

    const rawData: RawRestaurantData = {
      sourceId: 'chope',
      externalId: restaurant.id?.toString() || '',
      name: this.cleanText(restaurant.name || ''),
      address: this.cleanText(restaurant.address || restaurant.location?.address || ''),
      latitude: coordinates?.latitude,
      longitude: coordinates?.longitude,
      cuisineType: this.normalizeCuisineTypes(restaurant.cuisine_types || restaurant.cuisines || []),
      priceRange: this.normalizePriceRange(restaurant.price_range || restaurant.price_level),
      rating: this.normalizeRating(restaurant.rating || restaurant.average_rating),
      reviewCount: restaurant.review_count || restaurant.total_reviews || 0,
      operatingHours: this.normalizeOperatingHours(restaurant.opening_hours || restaurant.hours),
      phone: this.cleanText(restaurant.phone || restaurant.contact?.phone || ''),
      website: restaurant.website || restaurant.chope_url || '',
      menuItems: this.extractMenuItems(restaurant.menu || restaurant.sample_dishes || []),
      features,
      photos: this.extractPhotos(restaurant.images || restaurant.photos || []),
      reviews,
      lastUpdated: new Date(),
      dataQuality: 0
    };

    rawData.dataQuality = this.calculateDataQuality(rawData);
    return rawData;
  }

  private normalizeRating(rating: any): number {
    if (!rating) return 0;
    const numRating = parseFloat(rating);
    if (isNaN(numRating)) return 0;
    
    return Math.max(0, Math.min(5, numRating));
  }

  private normalizePriceRange(priceRange: any): number {
    if (!priceRange) return 2;
    
    if (typeof priceRange === 'number') {
      return Math.max(1, Math.min(4, priceRange));
    }
    
    if (typeof priceRange === 'string') {
      return this.parsePriceRange(priceRange);
    }
    
    return 2;
  }

  private normalizeCuisineTypes(cuisines: any[]): string[] {
    if (!Array.isArray(cuisines)) return [];
    
    return cuisines
      .map(cuisine => {
        if (typeof cuisine === 'string') return cuisine;
        return cuisine.name || cuisine.type || cuisine.category || '';
      })
      .filter(Boolean)
      .map(cuisine => this.cleanText(cuisine));
  }

  private normalizeOperatingHours(hours: any): Record<string, string> {
    if (!hours || typeof hours !== 'object') return {};
    
    const normalizedHours: Record<string, string> = {};
    
    if (Array.isArray(hours)) {
      for (const schedule of hours) {
        if (schedule.day && schedule.slots) {
          const day = schedule.day.toLowerCase().substring(0, 3);
          const timeSlots = schedule.slots.map((slot: any) => 
            `${slot.start || '00:00'}-${slot.end || '23:59'}`
          ).join(', ');
          normalizedHours[day] = timeSlots;
        }
      }
    } else {
      const dayMapping: Record<string, string> = {
        'monday': 'mon', 'tuesday': 'tue', 'wednesday': 'wed',
        'thursday': 'thu', 'friday': 'fri', 'saturday': 'sat', 'sunday': 'sun'
      };

      for (const [day, time] of Object.entries(hours)) {
        const normalizedDay = dayMapping[day.toLowerCase()] || day.toLowerCase();
        normalizedHours[normalizedDay] = this.cleanText(time as string);
      }
    }

    return normalizedHours;
  }

  private extractMenuItems(menu: any[]): string[] {
    if (!Array.isArray(menu)) return [];
    
    return menu
      .map(item => {
        if (typeof item === 'string') return item;
        return item.name || item.dish_name || item.title || '';
      })
      .filter(Boolean)
      .map(item => this.cleanText(item))
      .slice(0, 15);
  }

  private extractFeatures(features: any[]): string[] {
    if (!Array.isArray(features)) return [];
    
    return features
      .map(feature => {
        if (typeof feature === 'string') return feature;
        return feature.name || feature.type || feature.amenity || '';
      })
      .filter(Boolean)
      .map(feature => this.cleanText(feature));
  }

  private extractPhotos(photos: any[]): string[] {
    if (!Array.isArray(photos)) return [];
    
    return photos
      .map(photo => {
        if (typeof photo === 'string') return photo;
        return photo.url || photo.image_url || photo.src || '';
      })
      .filter(Boolean)
      .slice(0, 8);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/api/v1/health');
      return response.status === 200;
    } catch (error) {
      try {
        // Fallback health check
        const response = await this.httpClient.get('/api/v1/restaurants?limit=1&city=hong-kong');
        return response.status === 200;
      } catch (fallbackError) {
        this.logger.error('Chope health check failed:', fallbackError);
        return false;
      }
    }
  }
}