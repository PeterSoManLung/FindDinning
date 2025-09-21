import { BaseDataExtractor } from './BaseDataExtractor';
import { DataSource, RawRestaurantData, DataExtractionResult, RawReviewData } from '../types/dataSource.types';

export class TripAdvisorExtractor extends BaseDataExtractor {
  constructor() {
    const dataSource: DataSource = {
      id: 'tripadvisor',
      name: 'TripAdvisor',
      type: 'api' as any,
      baseUrl: 'https://api.tripadvisor.com',
      isActive: true,
      rateLimitMs: 3000, // 1 request per 3 seconds (TripAdvisor has strict rate limits)
      maxRetries: 3,
      timeout: 20000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'FindDining-DataIntegration/1.0'
      },
      authentication: {
        type: 'api_key',
        credentials: {
          apiKey: process.env.TRIPADVISOR_API_KEY || ''
        }
      }
    };
    
    super(dataSource);
  }

  async extractRestaurantData(params?: { 
    location?: string; 
    limit?: number; 
    offset?: number 
  }): Promise<DataExtractionResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const restaurants: RawRestaurantData[] = [];

    try {
      const queryParams = new URLSearchParams({
        location: params?.location || 'Hong Kong',
        limit: (params?.limit || 30).toString(), // TripAdvisor typically returns fewer results
        offset: (params?.offset || 0).toString(),
        category: 'restaurants'
      });

      const response = await this.makeRequest<any>({
        method: 'GET',
        url: `/api/partner/2.0/search?${queryParams.toString()}`
      });

      if (response.data) {
        for (const restaurant of response.data) {
          try {
            const normalizedData = await this.normalizeTripAdvisorData(restaurant);
            if (normalizedData) {
              restaurants.push(normalizedData);
            }
          } catch (error: any) {
            errors.push(`Failed to normalize restaurant ${restaurant.location_id}: ${error.message}`);
            this.logger.warn(`Normalization error for restaurant ${restaurant.location_id}:`, error);
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
          sourceReliability: 0.88 // TripAdvisor has high-quality review data
        }
      };

    } catch (error: any) {
      this.logger.error('TripAdvisor extraction failed:', error);
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
        url: `/api/partner/2.0/location/${externalId}`
      });

      if (response) {
        return await this.normalizeTripAdvisorData(response);
      }

      return null;
    } catch (error: any) {
      this.logger.error(`Failed to extract TripAdvisor restaurant ${externalId}:`, error);
      return null;
    }
  }

  async extractIncremental(since: Date): Promise<DataExtractionResult> {
    // TripAdvisor doesn't typically support incremental updates via public API
    // Fall back to full extraction
    this.logger.info(`TripAdvisor incremental extraction since ${since.toISOString()} - using full extraction`);
    return this.extractRestaurantData();
  }

  private async normalizeTripAdvisorData(restaurant: any): Promise<RawRestaurantData> {
    const coordinates = this.parseCoordinates(restaurant.latitude, restaurant.longitude);
    
    // Extract detailed reviews from TripAdvisor
    const reviews: RawReviewData[] = [];
    if (restaurant.reviews) {
      for (const review of restaurant.reviews.slice(0, 15)) { // TripAdvisor has extensive reviews
        reviews.push({
          externalId: review.id?.toString() || `${restaurant.location_id}_${Date.now()}`,
          rating: this.normalizeRating(review.rating),
          content: this.cleanText(review.text || review.review_text || ''),
          authorName: this.cleanText(review.user?.username || review.author || ''),
          visitDate: review.travel_date ? new Date(review.travel_date) : undefined,
          photos: review.photos?.map((photo: any) => photo.images?.large?.url || photo.url).filter(Boolean) || [],
          isVerified: review.user?.member_id ? true : false,
          helpfulCount: review.helpful_votes || 0,
          source: 'tripadvisor'
        });
      }
    }

    // Extract TripAdvisor-specific features
    const features = this.extractFeatures(restaurant.amenities || []);
    
    if (restaurant.awards) {
      for (const award of restaurant.awards) {
        if (award.display_name) {
          features.push(`Award: ${award.display_name}`);
        }
      }
    }
    
    if (restaurant.ranking_data) {
      features.push(`Ranking: #${restaurant.ranking_data.ranking_position} in ${restaurant.ranking_data.ranking_category}`);
    }

    if (restaurant.certificate_of_excellence) {
      features.push('Certificate of Excellence');
    }

    const rawData: RawRestaurantData = {
      sourceId: 'tripadvisor',
      externalId: restaurant.location_id?.toString() || '',
      name: this.cleanText(restaurant.name || ''),
      address: this.cleanText(restaurant.address_obj?.address_string || restaurant.address || ''),
      latitude: coordinates?.latitude,
      longitude: coordinates?.longitude,
      cuisineType: this.normalizeCuisineTypes(restaurant.cuisine || []),
      priceRange: this.normalizePriceRange(restaurant.price_level),
      rating: this.normalizeRating(restaurant.rating),
      reviewCount: restaurant.num_reviews || 0,
      operatingHours: this.normalizeOperatingHours(restaurant.hours || restaurant.open_now_text),
      phone: this.cleanText(restaurant.phone || ''),
      website: restaurant.website || restaurant.web_url || '',
      menuItems: this.extractMenuItems(restaurant.menu || []),
      features,
      photos: this.extractPhotos(restaurant.photos || []),
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

  private normalizePriceRange(priceLevel: any): number {
    if (!priceLevel) return 2;
    
    if (typeof priceLevel === 'string') {
      const level = priceLevel.toLowerCase();
      if (level.includes('$$$') || level.includes('expensive')) return 4;
      if (level.includes('$$') || level.includes('moderate')) return 3;
      if (level.includes('$') || level.includes('inexpensive')) return 1;
      return 2;
    }
    
    if (typeof priceLevel === 'number') {
      return Math.max(1, Math.min(4, priceLevel));
    }
    
    return 2;
  }

  private normalizeCuisineTypes(cuisines: any[]): string[] {
    if (!Array.isArray(cuisines)) return [];
    
    return cuisines
      .map(cuisine => {
        if (typeof cuisine === 'string') return cuisine;
        return cuisine.name || cuisine.localized_name || '';
      })
      .filter(Boolean)
      .map(cuisine => this.cleanText(cuisine));
  }

  private normalizeOperatingHours(hours: any): Record<string, string> {
    if (!hours) return {};
    
    const normalizedHours: Record<string, string> = {};
    
    if (typeof hours === 'string') {
      // Simple text like "Open now" or "Closed"
      normalizedHours['general'] = this.cleanText(hours);
      return normalizedHours;
    }
    
    if (typeof hours === 'object' && hours.week_ranges) {
      for (const dayRange of hours.week_ranges) {
        for (let day = dayRange[0].open_day; day <= dayRange[0].close_day; day++) {
          const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
          const dayName = dayNames[day];
          if (dayName) {
            const openTime = this.formatTime(dayRange[0].open_time);
            const closeTime = this.formatTime(dayRange[0].close_time);
            normalizedHours[dayName] = `${openTime} - ${closeTime}`;
          }
        }
      }
    }

    return normalizedHours;
  }

  private formatTime(time: number): string {
    if (!time) return '00:00';
    const hours = Math.floor(time / 100);
    const minutes = time % 100;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  private extractMenuItems(menu: any[]): string[] {
    if (!Array.isArray(menu)) return [];
    
    const items: string[] = [];
    
    for (const section of menu) {
      if (section.menu_sections) {
        for (const menuSection of section.menu_sections) {
          if (menuSection.menu_items) {
            for (const item of menuSection.menu_items) {
              if (item.name) {
                items.push(this.cleanText(item.name));
              }
            }
          }
        }
      }
    }
    
    return items.slice(0, 20);
  }

  private extractFeatures(features: any[]): string[] {
    if (!Array.isArray(features)) return [];
    
    return features
      .map(feature => {
        if (typeof feature === 'string') return feature;
        return feature.name || feature.amenity_type || '';
      })
      .filter(Boolean)
      .map(feature => this.cleanText(feature));
  }

  private extractPhotos(photos: any[]): string[] {
    if (!Array.isArray(photos)) return [];
    
    return photos
      .map(photo => {
        if (typeof photo === 'string') return photo;
        return photo.images?.large?.url || photo.images?.medium?.url || photo.url || '';
      })
      .filter(Boolean)
      .slice(0, 25); // TripAdvisor typically has many photos
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/api/partner/2.0/search?location=Hong Kong&limit=1');
      return response.status === 200;
    } catch (error) {
      this.logger.error('TripAdvisor health check failed:', error);
      return false;
    }
  }
}