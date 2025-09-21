import { Restaurant, RestaurantCreateRequest, RestaurantSearchRequest } from '../../../shared/src/types/restaurant.types';
import { restaurantModel } from '../models/Restaurant';

export class RestaurantRepository {
  /**
   * Create a new restaurant
   */
  async create(data: RestaurantCreateRequest): Promise<Restaurant> {
    return restaurantModel.create(data);
  }

  /**
   * Find restaurant by ID
   */
  async findById(id: string): Promise<Restaurant | null> {
    return restaurantModel.findById(id);
  }

  /**
   * Find all restaurants
   */
  async findAll(): Promise<Restaurant[]> {
    return restaurantModel.findAll();
  }

  /**
   * Update restaurant
   */
  async update(id: string, updates: Partial<Restaurant>): Promise<Restaurant | null> {
    return restaurantModel.update(id, updates);
  }

  /**
   * Delete restaurant
   */
  async delete(id: string): Promise<boolean> {
    return restaurantModel.delete(id);
  }

  /**
   * Search restaurants based on criteria
   */
  async search(criteria: RestaurantSearchRequest): Promise<Restaurant[]> {
    let results = restaurantModel.findAll();

    // Filter by location if provided
    if (criteria.location) {
      const { latitude, longitude, radius = 5 } = criteria.location;
      results = restaurantModel.findByLocation(latitude, longitude, radius);
    }

    // Filter by cuisine types
    if (criteria.cuisineTypes && criteria.cuisineTypes.length > 0) {
      const cuisineResults = restaurantModel.findByCuisine(criteria.cuisineTypes);
      results = results.filter(restaurant =>
        cuisineResults.some(cr => cr.id === restaurant.id)
      );
    }

    // Filter by price range
    if (criteria.priceRange) {
      const [minPrice, maxPrice] = criteria.priceRange;
      results = results.filter(restaurant =>
        restaurant.priceRange >= minPrice && restaurant.priceRange <= maxPrice
      );
    }

    // Filter by availability (open now)
    if (criteria.isOpen) {
      results = results.filter(restaurant =>
        restaurantModel.isRestaurantOpen(restaurant)
      );
    }

    // Filter by special features
    if (criteria.features && criteria.features.length > 0) {
      results = results.filter(restaurant =>
        criteria.features!.some(feature =>
          restaurant.specialFeatures.includes(feature) ||
          restaurant.atmosphere.includes(feature)
        )
      );
    }

    // Sort results
    if (criteria.sortBy) {
      results = this.sortRestaurants(results, criteria.sortBy, criteria.location);
    }

    return results;
  }

  /**
   * Find restaurants by cuisine type
   */
  async findByCuisine(cuisineTypes: string[]): Promise<Restaurant[]> {
    return restaurantModel.findByCuisine(cuisineTypes);
  }

  /**
   * Find restaurants within location radius
   */
  async findByLocation(latitude: number, longitude: number, radiusKm: number = 5): Promise<Restaurant[]> {
    return restaurantModel.findByLocation(latitude, longitude, radiusKm);
  }

  /**
   * Check if restaurant is currently open
   */
  async isOpen(restaurantId: string, checkTime?: Date): Promise<boolean> {
    const restaurant = await this.findById(restaurantId);
    if (!restaurant) {
      return false;
    }
    return restaurantModel.isRestaurantOpen(restaurant, checkTime);
  }

  /**
   * Get restaurants that are currently open
   */
  async findOpenRestaurants(): Promise<Restaurant[]> {
    const allRestaurants = await this.findAll();
    return allRestaurants.filter(restaurant =>
      restaurantModel.isRestaurantOpen(restaurant)
    );
  }

  /**
   * Sort restaurants based on criteria
   */
  private sortRestaurants(
    restaurants: Restaurant[],
    sortBy: 'distance' | 'rating' | 'negativeScore' | 'popularity',
    location?: { latitude: number; longitude: number }
  ): Restaurant[] {
    switch (sortBy) {
      case 'distance':
        if (!location) return restaurants;
        return restaurants.sort((a, b) => {
          const distanceA = this.calculateDistance(
            location.latitude,
            location.longitude,
            a.location.latitude,
            a.location.longitude
          );
          const distanceB = this.calculateDistance(
            location.latitude,
            location.longitude,
            b.location.latitude,
            b.location.longitude
          );
          return distanceA - distanceB;
        });

      case 'rating':
        return restaurants.sort((a, b) => b.rating - a.rating);

      case 'negativeScore':
        // Lower negative score is better (fewer complaints)
        return restaurants.sort((a, b) => a.negativeScore - b.negativeScore);

      case 'popularity':
        // Sort by combination of rating and review count from platform data
        return restaurants.sort((a, b) => {
          const popularityA = this.calculatePopularity(a);
          const popularityB = this.calculatePopularity(b);
          return popularityB - popularityA;
        });

      default:
        return restaurants;
    }
  }

  /**
   * Calculate popularity score based on rating and review count
   */
  private calculatePopularity(restaurant: Restaurant): number {
    const totalReviews = restaurant.platformData.reduce((sum, data) => sum + data.reviewCount, 0);
    const avgRating = restaurant.rating;
    
    // Popularity = rating * log(review count + 1) to balance quality and quantity
    return avgRating * Math.log(totalReviews + 1);
  }

  /**
   * Calculate distance between two coordinates
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

export const restaurantRepository = new RestaurantRepository();