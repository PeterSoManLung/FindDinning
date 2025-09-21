import { Restaurant } from '../../../shared/src/types/restaurant.types';
import { User } from '../../../shared/src/types/user.types';
import { RecommendedRestaurant } from '../../../shared/src/types/recommendation.types';
import { PreferenceAnalysisService, PreferenceAnalysisResult } from './preferenceAnalysis';
import { DistanceUtils } from '../../../shared/src/utils/distance.utils';

export interface MatchingCriteria {
  maxDistance?: number; // in kilometers
  minRating?: number;
  maxNegativeScore?: number;
  requireOpen?: boolean;
  currentTime?: Date;
}

export interface MatchingWeights {
  preferenceMatch: number;
  distance: number;
  rating: number;
  negativeScore: number;
  popularity: number;
}

export class RestaurantMatchingService {
  private preferenceAnalysis: PreferenceAnalysisService;

  private static readonly DEFAULT_WEIGHTS: MatchingWeights = {
    preferenceMatch: 0.4,
    distance: 0.2,
    rating: 0.15,
    negativeScore: 0.15,
    popularity: 0.1
  };

  private static readonly DEFAULT_CRITERIA: MatchingCriteria = {
    maxDistance: 10, // 10km
    minRating: 2.0,
    maxNegativeScore: 0.7,
    requireOpen: false
  };

  constructor() {
    this.preferenceAnalysis = new PreferenceAnalysisService();
  }

  /**
   * Generate restaurant recommendations based on user preferences
   */
  public async generateRecommendations(
    user: User,
    availableRestaurants: Restaurant[],
    criteria: MatchingCriteria = RestaurantMatchingService.DEFAULT_CRITERIA,
    weights: MatchingWeights = RestaurantMatchingService.DEFAULT_WEIGHTS,
    limit: number = 10
  ): Promise<RecommendedRestaurant[]> {
    // Analyze user preferences
    const userAnalysis = this.preferenceAnalysis.analyzeUserPreferences(user);

    // Filter restaurants based on criteria
    const filteredRestaurants = this.filterRestaurants(availableRestaurants, user, criteria);

    // Calculate match scores for each restaurant
    const scoredRestaurants = filteredRestaurants.map(restaurant => {
      const matchScore = this.calculateOverallMatchScore(
        userAnalysis,
        restaurant,
        user,
        weights
      );

      const reasons = this.generateRecommendationReasons(userAnalysis, restaurant, matchScore);

      return {
        restaurant,
        matchScore,
        reasonsForRecommendation: reasons,
        emotionalAlignment: 0.5 // Will be enhanced in emotional recommendation service
      };
    });

    // Sort by match score and return top recommendations
    return scoredRestaurants
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  }

  /**
   * Calculate overall match score combining multiple factors
   */
  private calculateOverallMatchScore(
    userAnalysis: PreferenceAnalysisResult,
    restaurant: Restaurant,
    user: User,
    weights: MatchingWeights
  ): number {
    let totalScore = 0;

    // Preference match score
    const preferenceScore = this.preferenceAnalysis.calculatePreferenceMatch(userAnalysis, restaurant);
    totalScore += preferenceScore * weights.preferenceMatch;

    // Distance score (closer is better)
    const distanceScore = this.calculateDistanceScore(user.location, restaurant.location);
    totalScore += distanceScore * weights.distance;

    // Rating score (normalized)
    const ratingScore = Math.min(restaurant.rating / 5.0, 1.0);
    totalScore += ratingScore * weights.rating;

    // Negative score (lower negative score is better)
    const negativeScore = Math.max(0, 1.0 - restaurant.negativeScore);
    totalScore += negativeScore * weights.negativeScore;

    // Popularity score (based on platform data)
    const popularityScore = this.calculatePopularityScore(restaurant);
    totalScore += popularityScore * weights.popularity;

    return Math.min(totalScore, 1.0);
  }

  /**
   * Filter restaurants based on matching criteria
   */
  private filterRestaurants(
    restaurants: Restaurant[],
    user: User,
    criteria: MatchingCriteria
  ): Restaurant[] {
    return restaurants.filter(restaurant => {
      // Distance filter
      if (criteria.maxDistance) {
        const distance = DistanceUtils.calculateDistance(
          { latitude: user.location.latitude, longitude: user.location.longitude },
          { latitude: restaurant.location.latitude, longitude: restaurant.location.longitude }
        );
        if (distance > criteria.maxDistance) return false;
      }

      // Rating filter
      if (criteria.minRating && restaurant.rating < criteria.minRating) {
        return false;
      }

      // Negative score filter
      if (criteria.maxNegativeScore && restaurant.negativeScore > criteria.maxNegativeScore) {
        return false;
      }

      // Operating hours filter
      if (criteria.requireOpen && criteria.currentTime) {
        if (!this.isRestaurantOpen(restaurant, criteria.currentTime)) {
          return false;
        }
      }

      // Dietary restrictions filter
      if (user.preferences.dietaryRestrictions.length > 0) {
        const hasCompatibleOptions = this.checkDietaryCompatibility(
          restaurant,
          user.preferences.dietaryRestrictions
        );
        if (!hasCompatibleOptions) return false;
      }

      return true;
    });
  }

  /**
   * Calculate distance-based score (closer restaurants get higher scores)
   */
  private calculateDistanceScore(userLocation: any, restaurantLocation: any): number {
    const distance = DistanceUtils.calculateDistance(
      { latitude: userLocation.latitude, longitude: userLocation.longitude },
      { latitude: restaurantLocation.latitude, longitude: restaurantLocation.longitude }
    );

    // Score decreases with distance, with 0km = 1.0 and 10km+ = 0.1
    return Math.max(0.1, 1.0 - (distance / 10.0));
  }

  /**
   * Calculate popularity score based on platform data
   */
  private calculatePopularityScore(restaurant: Restaurant): number {
    if (restaurant.platformData.length === 0) return 0.3; // Default score

    const totalReviews = restaurant.platformData.reduce((sum, data) => sum + data.reviewCount, 0);
    const avgRating = restaurant.platformData.reduce((sum, data) => sum + data.rating, 0) / restaurant.platformData.length;

    // Normalize based on review count and average rating
    const reviewScore = Math.min(totalReviews / 100, 1.0); // 100+ reviews = max score
    const ratingScore = avgRating / 5.0;

    return (reviewScore * 0.6 + ratingScore * 0.4);
  }

  /**
   * Check if restaurant is currently open
   */
  private isRestaurantOpen(restaurant: Restaurant, currentTime: Date): boolean {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = dayNames[currentTime.getDay()] as keyof typeof restaurant.operatingHours;
    const dayHours = restaurant.operatingHours[dayOfWeek];

    if (!dayHours.isOpen) return false;

    const currentTimeStr = currentTime.toTimeString().slice(0, 5); // HH:mm format
    
    if (dayHours.openTime && dayHours.closeTime) {
      return currentTimeStr >= dayHours.openTime && currentTimeStr <= dayHours.closeTime;
    }

    return true; // Assume open if no specific hours
  }

  /**
   * Check if restaurant can accommodate dietary restrictions
   */
  private checkDietaryCompatibility(restaurant: Restaurant, dietaryRestrictions: string[]): boolean {
    // Check menu highlights for dietary information
    const availableDietaryOptions = new Set<string>();
    
    restaurant.menuHighlights.forEach(item => {
      item.dietaryInfo.forEach(info => availableDietaryOptions.add(info.toLowerCase()));
    });

    // Check if restaurant can accommodate at least some dietary restrictions
    return dietaryRestrictions.some(restriction => 
      availableDietaryOptions.has(restriction.toLowerCase()) ||
      restaurant.specialFeatures.some(feature => 
        feature.toLowerCase().includes(restriction.toLowerCase())
      )
    );
  }

  /**
   * Generate human-readable reasons for recommendation
   */
  private generateRecommendationReasons(
    userAnalysis: PreferenceAnalysisResult,
    restaurant: Restaurant,
    matchScore: number
  ): string[] {
    const reasons: string[] = [];

    // Cuisine match reasons
    const matchingCuisines = restaurant.cuisineType.filter(cuisine => 
      userAnalysis.preferredCuisines.has(cuisine)
    );
    if (matchingCuisines.length > 0) {
      reasons.push(`Matches your preference for ${matchingCuisines.join(', ')} cuisine`);
    }

    // Price range reasons
    const [minPrice, maxPrice] = userAnalysis.preferredPriceRange;
    if (restaurant.priceRange >= minPrice && restaurant.priceRange <= maxPrice) {
      reasons.push(`Within your preferred price range`);
    }

    // High rating reasons
    if (restaurant.rating >= 4.0) {
      reasons.push(`Highly rated (${restaurant.rating}/5.0)`);
    }

    // Low negative feedback reasons
    if (restaurant.negativeScore <= 0.3) {
      reasons.push(`Consistently positive customer feedback`);
    }

    // Local gem reasons
    if (restaurant.isLocalGem) {
      reasons.push(`Hidden local gem with authentic experience`);
    }

    // Special features
    if (restaurant.specialFeatures.length > 0) {
      reasons.push(`Special features: ${restaurant.specialFeatures.slice(0, 2).join(', ')}`);
    }

    // High match score
    if (matchScore >= 0.8) {
      reasons.push(`Excellent match for your preferences`);
    }

    return reasons.slice(0, 4); // Limit to top 4 reasons
  }
}