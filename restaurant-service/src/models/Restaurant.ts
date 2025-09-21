import { Restaurant, RestaurantCreateRequest, OperatingHours, DayHours } from '../../../shared/src/types/restaurant.types';
import { v4 as uuidv4 } from 'uuid';

export class RestaurantModel {
  private restaurants: Map<string, Restaurant> = new Map();

  /**
   * Create a new restaurant
   */
  create(data: RestaurantCreateRequest): Restaurant {
    const now = new Date();
    const restaurant: Restaurant = {
      id: uuidv4(),
      name: data.name,
      cuisineType: data.cuisineType,
      location: data.location,
      priceRange: data.priceRange,
      rating: 0, // Initial rating
      negativeScore: 0, // Initial negative score
      atmosphere: data.atmosphere,
      operatingHours: data.operatingHours,
      menuHighlights: data.menuHighlights || [],
      specialFeatures: data.specialFeatures || [],
      isLocalGem: false, // Will be determined by analysis
      authenticityScore: 0, // Will be calculated
      governmentLicense: {
        licenseNumber: '',
        isValid: false,
        violations: []
      },
      dataQualityScore: 0.5, // Default score
      negativeFeedbackTrends: [],
      platformData: [],
      lastSyncDate: now,
      createdAt: now,
      updatedAt: now
    };

    this.restaurants.set(restaurant.id, restaurant);
    return restaurant;
  }

  /**
   * Find restaurant by ID
   */
  findById(id: string): Restaurant | null {
    return this.restaurants.get(id) || null;
  }

  /**
   * Find all restaurants
   */
  findAll(): Restaurant[] {
    return Array.from(this.restaurants.values());
  }

  /**
   * Update restaurant
   */
  update(id: string, updates: Partial<Restaurant>): Restaurant | null {
    const restaurant = this.restaurants.get(id);
    if (!restaurant) {
      return null;
    }

    const updatedRestaurant = {
      ...restaurant,
      ...updates,
      updatedAt: new Date()
    };

    this.restaurants.set(id, updatedRestaurant);
    return updatedRestaurant;
  }

  /**
   * Delete restaurant
   */
  delete(id: string): boolean {
    return this.restaurants.delete(id);
  }

  /**
   * Find restaurants by location within radius
   */
  findByLocation(latitude: number, longitude: number, radiusKm: number = 5): Restaurant[] {
    return this.findAll().filter(restaurant => {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        restaurant.location.latitude,
        restaurant.location.longitude
      );
      return distance <= radiusKm;
    });
  }

  /**
   * Find restaurants by cuisine type
   */
  findByCuisine(cuisineTypes: string[]): Restaurant[] {
    const lowerCaseCuisineTypes = cuisineTypes.map(c => c.toLowerCase());
    return this.findAll().filter(restaurant =>
      restaurant.cuisineType.some(cuisine =>
        lowerCaseCuisineTypes.includes(cuisine.toLowerCase())
      )
    );
  }

  /**
   * Find restaurants by price range
   */
  findByPriceRange(minPrice: number, maxPrice: number): Restaurant[] {
    return this.findAll().filter(restaurant =>
      restaurant.priceRange >= minPrice && restaurant.priceRange <= maxPrice
    );
  }

  /**
   * Check if restaurant is currently open
   */
  isRestaurantOpen(restaurant: Restaurant, checkTime?: Date): boolean {
    const now = checkTime || new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek] as keyof OperatingHours;
    const dayHours = restaurant.operatingHours[dayName];

    if (!dayHours.isOpen || !dayHours.openTime || !dayHours.closeTime) {
      return false;
    }

    // Check if current time is within operating hours
    const isWithinHours = currentTime >= dayHours.openTime && currentTime <= dayHours.closeTime;

    // Check if current time is during a break
    if (isWithinHours && dayHours.breaks) {
      const isDuringBreak = dayHours.breaks.some(breakTime =>
        currentTime >= breakTime.startTime && currentTime <= breakTime.endTime
      );
      return !isDuringBreak;
    }

    return isWithinHours;
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
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

  /**
   * Clear all restaurants (for testing)
   */
  clear(): void {
    this.restaurants.clear();
  }
}

export const restaurantModel = new RestaurantModel();