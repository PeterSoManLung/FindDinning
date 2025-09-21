import { BaseDataExtractor } from './BaseDataExtractor';
import { DataSource, RawRestaurantData, DataExtractionResult, RawReviewData } from '../types/dataSource.types';

export class OpenRiceExtractor extends BaseDataExtractor {
  constructor() {
    const dataSource: DataSource = {
      id: 'openrice',
      name: 'OpenRice',
      type: 'api' as any,
      baseUrl: 'https://api.openrice.com',
      isActive: true,
      rateLimitMs: 1000, // 1 request per second
      maxRetries: 3,
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      authentication: {
        type: 'api_key',
        credentials: {
          apiKey: process.env.OPENRICE_API_KEY || ''
        }
      }
    };
    
    super(dataSource);
  }

  async extractRestaurantData(params?: { 
    district?: string; 
    cuisineType?: string; 
    limit?: number; 
    offset?: number 
  }): Promise<DataExtractionResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const restaurants: RawRestaurantData[] = [];

    try {
      const queryParams = new URLSearchParams({
        limit: (params?.limit || 50).toString(),
        offset: (params?.offset || 0).toString(),
        ...(params?.district && { district: params.district }),
        ...(params?.cuisineType && { cuisine: params.cuisineType })
      });

      const response = await this.makeRequest<any>({
        method: 'GET',
        url: `/v2/restaurants?${queryParams.toString()}`
      });

      if (response.restaurants) {
        for (const restaurant of response.restaurants) {
          try {
            const normalizedData = await this.normalizeOpenRiceData(restaurant);
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
          sourceReliability: 0.85 // OpenRice generally has good data quality
        }
      };

    } catch (error: any) {
      this.logger.error('OpenRice extraction failed:', error);
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
        url: `/v2/restaurants/${externalId}`
      });

      if (response.restaurant) {
        return await this.normalizeOpenRiceData(response.restaurant);
      }

      return null;
    } catch (error: any) {
      this.logger.error(`Failed to extract OpenRice restaurant ${externalId}:`, error);
      return null;
    }
  }

  async extractIncremental(since: Date): Promise<DataExtractionResult> {
    // OpenRice doesn't typically support incremental updates via API
    // Fall back to full extraction with date filtering
    this.logger.info(`OpenRice incremental extraction since ${since.toISOString()} - using full extraction`);
    return this.extractRestaurantData();
  }

  private async normalizeOpenRiceData(restaurant: any): Promise<RawRestaurantData> {
    const coordinates = this.parseCoordinates(restaurant.latitude, restaurant.longitude);
    
    // Extract reviews if available
    const reviews: RawReviewData[] = [];
    if (restaurant.reviews) {
      for (const review of restaurant.reviews.slice(0, 10)) { // Limit to 10 most recent
        reviews.push({
          externalId: review.id?.toString() || `${restaurant.id}_${Date.now()}`,
          rating: this.normalizeRating(review.rating),
          content: this.cleanText(review.content || review.comment || ''),
          authorName: this.cleanText(review.author?.name || review.username || ''),
          visitDate: review.visit_date ? new Date(review.visit_date) : undefined,
          photos: review.photos?.map((photo: any) => photo.url).filter(Boolean) || [],
          isVerified: review.verified || false,
          helpfulCount: review.helpful_count || 0,
          source: 'openrice'
        });
      }
    }

    const rawData: RawRestaurantData = {
      sourceId: 'openrice',
      externalId: restaurant.id?.toString() || '',
      name: this.cleanText(restaurant.name || ''),
      address: this.cleanText(restaurant.address || ''),
      latitude: coordinates?.latitude,
      longitude: coordinates?.longitude,
      cuisineType: this.normalizeCuisineTypes(restaurant.cuisine_types || restaurant.cuisines || []),
      priceRange: this.normalizePriceRange(restaurant.price_range || restaurant.price_level),
      rating: this.normalizeRating(restaurant.rating || restaurant.average_rating),
      reviewCount: restaurant.review_count || restaurant.total_reviews || 0,
      operatingHours: this.normalizeOperatingHours(restaurant.opening_hours || restaurant.hours),
      phone: this.cleanText(restaurant.phone || restaurant.telephone || ''),
      website: restaurant.website || restaurant.url || '',
      menuItems: this.extractMenuItems(restaurant.menu || restaurant.dishes || []),
      features: this.extractFeatures(restaurant.features || restaurant.amenities || []),
      photos: restaurant.photos?.map((photo: any) => photo.url || photo.image_url).filter(Boolean) || [],
      reviews,
      lastUpdated: new Date(),
      dataQuality: 0 // Will be calculated
    };

    rawData.dataQuality = this.calculateDataQuality(rawData);
    return rawData;
  }

  private normalizeRating(rating: any): number {
    if (!rating) return 0;
    const numRating = parseFloat(rating);
    if (isNaN(numRating)) return 0;
    
    // OpenRice uses 1-5 scale, normalize to 0-5
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
        return cuisine.name || cuisine.type || '';
      })
      .filter(Boolean)
      .map(cuisine => this.cleanText(cuisine));
  }

  private normalizeOperatingHours(hours: any): Record<string, string> {
    if (!hours || typeof hours !== 'object') return {};
    
    const normalizedHours: Record<string, string> = {};
    const dayMapping: Record<string, string> = {
      'monday': 'mon',
      'tuesday': 'tue',
      'wednesday': 'wed',
      'thursday': 'thu',
      'friday': 'fri',
      'saturday': 'sat',
      'sunday': 'sun'
    };

    for (const [day, time] of Object.entries(hours)) {
      const normalizedDay = dayMapping[day.toLowerCase()] || day.toLowerCase();
      normalizedHours[normalizedDay] = this.cleanText(time as string);
    }

    return normalizedHours;
  }

  private extractMenuItems(menu: any[]): string[] {
    if (!Array.isArray(menu)) return [];
    
    return menu
      .map(item => {
        if (typeof item === 'string') return item;
        return item.name || item.title || item.dish_name || '';
      })
      .filter(Boolean)
      .map(item => this.cleanText(item))
      .slice(0, 20); // Limit to 20 items
  }

  private extractFeatures(features: any[]): string[] {
    if (!Array.isArray(features)) return [];
    
    return features
      .map(feature => {
        if (typeof feature === 'string') return feature;
        return feature.name || feature.type || feature.feature || '';
      })
      .filter(Boolean)
      .map(feature => this.cleanText(feature));
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/v2/health');
      return response.status === 200;
    } catch (error) {
      // Try alternative health check
      try {
        const response = await this.httpClient.get('/v2/restaurants?limit=1');
        return response.status === 200;
      } catch (fallbackError) {
        this.logger.error('OpenRice health check failed:', fallbackError);
        return false;
      }
    }
  }
}