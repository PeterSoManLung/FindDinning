import { BaseDataExtractor } from './BaseDataExtractor';
import { DataSource, RawRestaurantData, DataExtractionResult, RawReviewData } from '../types/dataSource.types';

export class BistroChatExtractor extends BaseDataExtractor {
  constructor() {
    const dataSource: DataSource = {
      id: 'bistrochat',
      name: 'BistroCHAT',
      type: 'social' as any,
      baseUrl: 'https://api.bistrochat.hk',
      isActive: true,
      rateLimitMs: 2000, // 1 request per 2 seconds (social platform, be respectful)
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
          apiKey: process.env.BISTROCHAT_API_KEY || ''
        }
      }
    };
    
    super(dataSource);
  }

  async extractRestaurantData(params?: { 
    district?: string; 
    limit?: number; 
    offset?: number 
  }): Promise<DataExtractionResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const restaurants: RawRestaurantData[] = [];

    try {
      const queryParams = new URLSearchParams({
        limit: (params?.limit || 30).toString(), // Lower limit for social data
        offset: (params?.offset || 0).toString(),
        ...(params?.district && { district: params.district })
      });

      const response = await this.makeRequest<any>({
        method: 'GET',
        url: `/v1/restaurants?${queryParams.toString()}`
      });

      if (response.restaurants) {
        for (const restaurant of response.restaurants) {
          try {
            const normalizedData = await this.normalizeBistroChatData(restaurant);
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
          sourceReliability: 0.70 // BistroCHAT has good social data but may be less comprehensive
        }
      };

    } catch (error: any) {
      this.logger.error('BistroCHAT extraction failed:', error);
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

      if (response.restaurant) {
        return await this.normalizeBistroChatData(response.restaurant);
      }

      return null;
    } catch (error: any) {
      this.logger.error(`Failed to extract BistroCHAT restaurant ${externalId}:`, error);
      return null;
    }
  }

  async extractIncremental(since: Date): Promise<DataExtractionResult> {
    // BistroCHAT is social-focused, extract restaurants with recent social activity
    this.logger.info(`BistroCHAT incremental extraction since ${since.toISOString()} - extracting socially active restaurants`);
    
    try {
      const queryParams = new URLSearchParams({
        updated_since: since.toISOString(),
        limit: '50'
      });

      const response = await this.makeRequest<any>({
        method: 'GET',
        url: `/v1/restaurants/recent?${queryParams.toString()}`
      });

      if (response.restaurants) {
        const restaurants: RawRestaurantData[] = [];
        for (const restaurant of response.restaurants) {
          const normalizedData = await this.normalizeBistroChatData(restaurant);
          if (normalizedData) {
            restaurants.push(normalizedData);
          }
        }

        return {
          success: true,
          data: restaurants,
          errors: [],
          metadata: {
            totalExtracted: restaurants.length,
            processingTime: Date.now() - Date.now(),
            sourceReliability: 0.70
          }
        };
      }
    } catch (error: any) {
      this.logger.warn('BistroCHAT incremental extraction failed, falling back to full extraction:', error);
    }

    return this.extractRestaurantData();
  }

  private async normalizeBistroChatData(restaurant: any): Promise<RawRestaurantData> {
    const coordinates = this.parseCoordinates(restaurant.latitude, restaurant.longitude);
    
    // Extract social reviews and posts
    const reviews: RawReviewData[] = [];
    if (restaurant.posts) {
      for (const post of restaurant.posts.slice(0, 8)) {
        if (post.rating || post.review_text) {
          reviews.push({
            externalId: post.id?.toString() || `${restaurant.id}_${Date.now()}`,
            rating: this.normalizeRating(post.rating),
            content: this.cleanText(post.review_text || post.content || post.caption || ''),
            authorName: this.cleanText(post.author?.username || post.user?.name || ''),
            visitDate: post.visit_date ? new Date(post.visit_date) : undefined,
            photos: this.extractPostPhotos(post.photos || post.images || []),
            isVerified: post.verified_user || false,
            helpfulCount: post.likes_count || post.reactions || 0,
            source: 'bistrochat'
          });
        }
      }
    }

    // Extract social-specific features
    const features = this.extractFeatures(restaurant.amenities || []);
    
    if (restaurant.social_score) {
      features.push(`Social Score: ${restaurant.social_score}/10`);
    }
    
    if (restaurant.trending) {
      features.push('Trending on Social Media');
    }
    
    if (restaurant.instagram_worthy) {
      features.push('Instagram Worthy');
    }

    if (restaurant.community_favorite) {
      features.push('Community Favorite');
    }

    const rawData: RawRestaurantData = {
      sourceId: 'bistrochat',
      externalId: restaurant.id?.toString() || '',
      name: this.cleanText(restaurant.name || ''),
      address: this.cleanText(restaurant.address || restaurant.location?.address || ''),
      latitude: coordinates?.latitude,
      longitude: coordinates?.longitude,
      cuisineType: this.normalizeCuisineTypes(restaurant.cuisine_types || restaurant.tags || []),
      priceRange: this.normalizePriceRange(restaurant.price_range || restaurant.budget_level),
      rating: this.normalizeRating(restaurant.rating || restaurant.social_rating),
      reviewCount: restaurant.post_count || restaurant.review_count || 0,
      operatingHours: this.normalizeOperatingHours(restaurant.opening_hours || restaurant.hours),
      phone: this.cleanText(restaurant.phone || restaurant.contact?.phone || ''),
      website: restaurant.website || restaurant.social_links?.website || '',
      menuItems: this.extractMenuItems(restaurant.popular_dishes || restaurant.signature_items || []),
      features,
      photos: this.extractPhotos(restaurant.photos || restaurant.gallery || []),
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
    
    // BistroCHAT might use different scales, normalize to 0-5
    if (numRating > 5) {
      return Math.max(0, Math.min(5, numRating / 2)); // Convert from 10-point scale
    }
    
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
        return cuisine.name || cuisine.tag || cuisine.category || '';
      })
      .filter(Boolean)
      .map(cuisine => this.cleanText(cuisine));
  }

  private normalizeOperatingHours(hours: any): Record<string, string> {
    if (!hours || typeof hours !== 'object') return {};
    
    const normalizedHours: Record<string, string> = {};
    const dayMapping: Record<string, string> = {
      'monday': 'mon', 'tuesday': 'tue', 'wednesday': 'wed',
      'thursday': 'thu', 'friday': 'fri', 'saturday': 'sat', 'sunday': 'sun'
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
        return item.name || item.dish_name || item.title || '';
      })
      .filter(Boolean)
      .map(item => this.cleanText(item))
      .slice(0, 12); // BistroCHAT focuses on popular/signature items
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
      .slice(0, 20); // Social platforms typically have many photos
  }

  private extractPostPhotos(photos: any[]): string[] {
    if (!Array.isArray(photos)) return [];
    
    return photos
      .map(photo => {
        if (typeof photo === 'string') return photo;
        return photo.url || photo.image_url || photo.src || '';
      })
      .filter(Boolean)
      .slice(0, 5); // Limit photos per post
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/v1/health');
      return response.status === 200;
    } catch (error) {
      try {
        // Fallback health check
        const response = await this.httpClient.get('/v1/restaurants?limit=1');
        return response.status === 200;
      } catch (fallbackError) {
        this.logger.error('BistroCHAT health check failed:', fallbackError);
        return false;
      }
    }
  }
}