import { BaseDataExtractor } from './BaseDataExtractor';
import { DataSource, RawRestaurantData, DataExtractionResult, RawReviewData } from '../types/dataSource.types';

export class EatigoExtractor extends BaseDataExtractor {
  constructor() {
    const dataSource: DataSource = {
      id: 'eatigo',
      name: 'Eatigo',
      type: 'api' as any,
      baseUrl: 'https://api.eatigo.com',
      isActive: true,
      rateLimitMs: 1500, // 1 request per 1.5 seconds
      maxRetries: 3,
      timeout: 12000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'FindDining-DataIntegration/1.0'
      },
      authentication: {
        type: 'api_key',
        credentials: {
          apiKey: process.env.EATIGO_API_KEY || ''
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
        ...(params?.district && { district: params.district })
      });

      const response = await this.makeRequest<any>({
        method: 'GET',
        url: `/v1/restaurants?${queryParams.toString()}`
      });

      if (response.data?.restaurants) {
        for (const restaurant of response.data.restaurants) {
          try {
            const normalizedData = await this.normalizeEatigoData(restaurant);
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
          sourceReliability: 0.80 // Eatigo has good promotional data but limited reviews
        }
      };

    } catch (error: any) {
      this.logger.error('Eatigo extraction failed:', error);
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
        url: `/v1/restaurants/${externalId}`
      });

      if (response.data?.restaurant) {
        return await this.normalizeEatigoData(response.data.restaurant);
      }

      return null;
    } catch (error: any) {
      this.logger.error(`Failed to extract Eatigo restaurant ${externalId}:`, error);
      return null;
    }
  }

  async extractIncremental(since: Date): Promise<DataExtractionResult> {
    // Eatigo focuses on current promotions, so incremental is less relevant
    // Extract all current active restaurants with promotions
    this.logger.info(`Eatigo incremental extraction since ${since.toISOString()} - extracting current promotions`);
    return this.extractRestaurantData();
  }

  private async normalizeEatigoData(restaurant: any): Promise<RawRestaurantData> {
    const coordinates = this.parseCoordinates(restaurant.latitude, restaurant.longitude);
    
    // Eatigo typically has limited reviews, focus on promotional data
    const reviews: RawReviewData[] = [];
    if (restaurant.reviews) {
      for (const review of restaurant.reviews.slice(0, 5)) {
        reviews.push({
          externalId: review.id?.toString() || `${restaurant.id}_${Date.now()}`,
          rating: this.normalizeRating(review.rating),
          content: this.cleanText(review.comment || review.review || ''),
          authorName: this.cleanText(review.user?.name || review.reviewer || ''),
          visitDate: review.created_at ? new Date(review.created_at) : undefined,
          photos: [],
          isVerified: false,
          helpfulCount: 0,
          source: 'eatigo'
        });
      }
    }

    // Extract promotional information as features
    const features = this.extractFeatures(restaurant.amenities || []);
    if (restaurant.promotions) {
      for (const promo of restaurant.promotions) {
        if (promo.active && promo.description) {
          features.push(`Promotion: ${this.cleanText(promo.description)}`);
        }
      }
    }

    const rawData: RawRestaurantData = {
      sourceId: 'eatigo',
      externalId: restaurant.id?.toString() || '',
      name: this.cleanText(restaurant.name || ''),
      address: this.cleanText(restaurant.address || restaurant.full_address || ''),
      latitude: coordinates?.latitude,
      longitude: coordinates?.longitude,
      cuisineType: this.normalizeCuisineTypes(restaurant.cuisine_types || restaurant.cuisines || []),
      priceRange: this.normalizePriceRange(restaurant.price_range || restaurant.price_level),
      rating: this.normalizeRating(restaurant.rating || restaurant.average_rating),
      reviewCount: restaurant.review_count || 0,
      operatingHours: this.normalizeOperatingHours(restaurant.opening_hours || restaurant.hours),
      phone: this.cleanText(restaurant.phone || restaurant.contact?.phone || ''),
      website: restaurant.website || restaurant.booking_url || '',
      menuItems: this.extractMenuItems(restaurant.menu_items || restaurant.dishes || []),
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
      // Handle array format: [{ day: 'monday', open: '10:00', close: '22:00' }]
      for (const schedule of hours) {
        if (schedule.day && (schedule.open || schedule.close)) {
          const day = schedule.day.toLowerCase().substring(0, 3);
          normalizedHours[day] = `${schedule.open || '00:00'} - ${schedule.close || '23:59'}`;
        }
      }
    } else {
      // Handle object format
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
        return item.name || item.title || item.dish_name || item.item_name || '';
      })
      .filter(Boolean)
      .map(item => this.cleanText(item))
      .slice(0, 15);
  }

  private extractFeatures(features: any[]): string[] {
    if (!Array.isArray(features)) return [];
    
    const featureList = features
      .map(feature => {
        if (typeof feature === 'string') return feature;
        return feature.name || feature.type || feature.amenity || '';
      })
      .filter(Boolean)
      .map(feature => this.cleanText(feature));

    // Add Eatigo-specific features
    featureList.push('Online Reservations', 'Discount Promotions');
    
    return featureList;
  }

  private extractPhotos(photos: any[]): string[] {
    if (!Array.isArray(photos)) return [];
    
    return photos
      .map(photo => {
        if (typeof photo === 'string') return photo;
        return photo.url || photo.image_url || photo.src || '';
      })
      .filter(Boolean)
      .slice(0, 10);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/v1/health');
      return response.status === 200;
    } catch (error) {
      try {
        // Fallback health check
        const response = await this.httpClient.get('/v1/restaurants?limit=1&city=hong-kong');
        return response.status === 200;
      } catch (fallbackError) {
        this.logger.error('Eatigo health check failed:', fallbackError);
        return false;
      }
    }
  }
}