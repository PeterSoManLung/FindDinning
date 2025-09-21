import { BaseDataExtractor } from './BaseDataExtractor';
import { DataSource, RawRestaurantData, DataExtractionResult, RawReviewData } from '../types/dataSource.types';

export class FoodpandaExtractor extends BaseDataExtractor {
  constructor() {
    const dataSource: DataSource = {
      id: 'foodpanda',
      name: 'Foodpanda',
      type: 'api' as any,
      baseUrl: 'https://api.foodpanda.com',
      isActive: true,
      rateLimitMs: 1200, // 1 request per 1.2 seconds
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
          apiKey: process.env.FOODPANDA_API_KEY || ''
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
        url: `/api/v2/restaurants?${queryParams.toString()}`
      });

      if (response.data?.restaurants) {
        for (const restaurant of response.data.restaurants) {
          try {
            const normalizedData = await this.normalizeFoodpandaData(restaurant);
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
          sourceReliability: 0.78 // Foodpanda has good delivery data and decent reviews
        }
      };

    } catch (error: any) {
      this.logger.error('Foodpanda extraction failed:', error);
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
        url: `/api/v2/restaurants/${externalId}`
      });

      if (response.data?.restaurant) {
        return await this.normalizeFoodpandaData(response.data.restaurant);
      }

      return null;
    } catch (error: any) {
      this.logger.error(`Failed to extract Foodpanda restaurant ${externalId}:`, error);
      return null;
    }
  }

  async extractIncremental(since: Date): Promise<DataExtractionResult> {
    // Foodpanda focuses on delivery, extract restaurants with recent activity
    this.logger.info(`Foodpanda incremental extraction since ${since.toISOString()} - extracting active delivery restaurants`);
    return this.extractRestaurantData();
  }

  private async normalizeFoodpandaData(restaurant: any): Promise<RawRestaurantData> {
    const coordinates = this.parseCoordinates(restaurant.latitude, restaurant.longitude);
    
    // Extract reviews from Foodpanda
    const reviews: RawReviewData[] = [];
    if (restaurant.reviews) {
      for (const review of restaurant.reviews.slice(0, 10)) {
        reviews.push({
          externalId: review.id?.toString() || `${restaurant.id}_${Date.now()}`,
          rating: this.normalizeRating(review.rating),
          content: this.cleanText(review.comment || review.review_text || ''),
          authorName: this.cleanText(review.customer?.name || review.reviewer || ''),
          visitDate: review.order_date ? new Date(review.order_date) : undefined,
          photos: review.photos?.map((photo: any) => photo.url).filter(Boolean) || [],
          isVerified: review.verified_purchase || false,
          helpfulCount: review.helpful_votes || 0,
          source: 'foodpanda'
        });
      }
    }

    // Extract delivery-specific features
    const features = this.extractFeatures(restaurant.features || []);
    features.push('Food Delivery');
    
    if (restaurant.delivery_time) {
      features.push(`Delivery: ${restaurant.delivery_time.min}-${restaurant.delivery_time.max} mins`);
    }
    
    if (restaurant.minimum_order_value) {
      features.push(`Min Order: $${restaurant.minimum_order_value}`);
    }

    if (restaurant.delivery_fee === 0) {
      features.push('Free Delivery');
    } else if (restaurant.delivery_fee) {
      features.push(`Delivery Fee: $${restaurant.delivery_fee}`);
    }

    if (restaurant.is_premium) {
      features.push('Premium Partner');
    }

    const rawData: RawRestaurantData = {
      sourceId: 'foodpanda',
      externalId: restaurant.id?.toString() || '',
      name: this.cleanText(restaurant.name || ''),
      address: this.cleanText(restaurant.address || restaurant.location?.address || ''),
      latitude: coordinates?.latitude,
      longitude: coordinates?.longitude,
      cuisineType: this.normalizeCuisineTypes(restaurant.cuisines || restaurant.categories || []),
      priceRange: this.normalizePriceRange(restaurant.price_range || restaurant.budget),
      rating: this.normalizeRating(restaurant.rating || restaurant.customer_rating),
      reviewCount: restaurant.review_count || restaurant.total_reviews || 0,
      operatingHours: this.normalizeOperatingHours(restaurant.opening_hours || restaurant.schedule),
      phone: this.cleanText(restaurant.phone || restaurant.contact?.phone || ''),
      website: restaurant.website || '',
      menuItems: this.extractMenuItems(restaurant.menu || restaurant.products || []),
      features,
      photos: this.extractPhotos(restaurant.images || restaurant.hero_images || []),
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
        return cuisine.name || cuisine.title || cuisine.category || '';
      })
      .filter(Boolean)
      .map(cuisine => this.cleanText(cuisine));
  }

  private normalizeOperatingHours(hours: any): Record<string, string> {
    if (!hours || typeof hours !== 'object') return {};
    
    const normalizedHours: Record<string, string> = {};
    
    if (Array.isArray(hours)) {
      for (const schedule of hours) {
        if (schedule.weekday !== undefined && schedule.opening_time && schedule.closing_time) {
          const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
          const day = dayNames[schedule.weekday] || schedule.weekday;
          normalizedHours[day] = `${schedule.opening_time} - ${schedule.closing_time}`;
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
    
    const items: string[] = [];
    
    for (const category of menu) {
      if (category.products && Array.isArray(category.products)) {
        for (const product of category.products) {
          const itemName = product.name || product.title || product.product_name;
          if (itemName) {
            items.push(this.cleanText(itemName));
          }
        }
      } else if (typeof category === 'string') {
        items.push(this.cleanText(category));
      } else if (category.name) {
        items.push(this.cleanText(category.name));
      }
    }
    
    return items.slice(0, 30); // Foodpanda can have extensive menus
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

  private extractPhotos(photos: any[]): string[] {
    if (!Array.isArray(photos)) return [];
    
    return photos
      .map(photo => {
        if (typeof photo === 'string') return photo;
        return photo.image_url || photo.url || photo.src || '';
      })
      .filter(Boolean)
      .slice(0, 15);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/api/v2/health');
      return response.status === 200;
    } catch (error) {
      try {
        // Fallback health check
        const response = await this.httpClient.get('/api/v2/restaurants?limit=1&city=hong-kong');
        return response.status === 200;
      } catch (fallbackError) {
        this.logger.error('Foodpanda health check failed:', fallbackError);
        return false;
      }
    }
  }
}