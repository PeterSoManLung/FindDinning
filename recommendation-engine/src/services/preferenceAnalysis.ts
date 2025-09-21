import { User, DiningHistory, UserPreferences } from '../../../shared/src/types/user.types';
import { Restaurant } from '../../../shared/src/types/restaurant.types';

export interface PreferenceWeights {
  cuisineMatch: number;
  priceMatch: number;
  atmosphereMatch: number;
  spiceLevelMatch: number;
  dietaryMatch: number;
  historyBonus: number;
}

export interface PreferenceAnalysisResult {
  preferredCuisines: Map<string, number>;
  preferredPriceRange: [number, number];
  preferredAtmosphere: Map<string, number>;
  preferredSpiceLevel: number;
  visitFrequency: Map<string, number>;
  recentTrends: string[];
}

export class PreferenceAnalysisService {
  private static readonly DEFAULT_WEIGHTS: PreferenceWeights = {
    cuisineMatch: 0.3,
    priceMatch: 0.2,
    atmosphereMatch: 0.15,
    spiceLevelMatch: 0.1,
    dietaryMatch: 0.15,
    historyBonus: 0.1
  };

  /**
   * Analyze user preferences from their dining history and explicit preferences
   */
  public analyzeUserPreferences(user: User): PreferenceAnalysisResult {
    const { preferences, diningHistory } = user;
    
    // Start with explicit preferences
    const preferredCuisines = new Map<string, number>();
    preferences.cuisineTypes.forEach(cuisine => {
      preferredCuisines.set(cuisine, 1.0);
    });

    // Analyze dining history to enhance preferences
    const historyAnalysis = this.analyzeDiningHistory(diningHistory);
    
    // Merge explicit preferences with history-based preferences
    historyAnalysis.cuisineFrequency.forEach((frequency, cuisine) => {
      const currentWeight = preferredCuisines.get(cuisine) || 0;
      preferredCuisines.set(cuisine, Math.max(currentWeight, frequency));
    });

    // Analyze atmosphere preferences from history
    const preferredAtmosphere = new Map<string, number>();
    preferences.atmospherePreferences.forEach(atmosphere => {
      preferredAtmosphere.set(atmosphere, 1.0);
    });

    return {
      preferredCuisines,
      preferredPriceRange: preferences.priceRange,
      preferredAtmosphere,
      preferredSpiceLevel: preferences.spiceLevel,
      visitFrequency: historyAnalysis.cuisineFrequency,
      recentTrends: historyAnalysis.recentTrends
    };
  }

  /**
   * Calculate preference match score between user and restaurant
   */
  public calculatePreferenceMatch(
    userAnalysis: PreferenceAnalysisResult,
    restaurant: Restaurant,
    weights: PreferenceWeights = PreferenceAnalysisService.DEFAULT_WEIGHTS
  ): number {
    let totalScore = 0;

    // Cuisine match score
    const cuisineScore = this.calculateCuisineMatch(userAnalysis.preferredCuisines, restaurant.cuisineType);
    totalScore += cuisineScore * weights.cuisineMatch;

    // Price range match score
    const priceScore = this.calculatePriceMatch(userAnalysis.preferredPriceRange, restaurant.priceRange);
    totalScore += priceScore * weights.priceMatch;

    // Atmosphere match score
    const atmosphereScore = this.calculateAtmosphereMatch(userAnalysis.preferredAtmosphere, restaurant.atmosphere);
    totalScore += atmosphereScore * weights.atmosphereMatch;

    // Spice level match (if available in menu highlights)
    const spiceScore = this.calculateSpiceMatch(userAnalysis.preferredSpiceLevel, restaurant.menuHighlights);
    totalScore += spiceScore * weights.spiceLevelMatch;

    // History bonus for familiar cuisine types
    const historyBonus = this.calculateHistoryBonus(userAnalysis.visitFrequency, restaurant.cuisineType);
    totalScore += historyBonus * weights.historyBonus;

    return Math.min(totalScore, 1.0); // Cap at 1.0
  }

  /**
   * Learn from user feedback to update preference weights
   */
  public updatePreferencesFromFeedback(
    user: User,
    restaurant: Restaurant,
    feedback: 'liked' | 'disliked' | 'visited',
    rating?: number
  ): Partial<UserPreferences> {
    const updates: Partial<UserPreferences> = {};

    if (feedback === 'liked' || (feedback === 'visited' && rating && rating >= 4)) {
      // Boost preference for this restaurant's characteristics
      const updatedCuisines = [...user.preferences.cuisineTypes];
      restaurant.cuisineType.forEach(cuisine => {
        if (!updatedCuisines.includes(cuisine)) {
          updatedCuisines.push(cuisine);
        }
      });
      updates.cuisineTypes = updatedCuisines;

      // Adjust atmosphere preferences
      const updatedAtmosphere = [...user.preferences.atmospherePreferences];
      restaurant.atmosphere.forEach(atmosphere => {
        if (!updatedAtmosphere.includes(atmosphere)) {
          updatedAtmosphere.push(atmosphere);
        }
      });
      updates.atmospherePreferences = updatedAtmosphere;
    }

    if (feedback === 'disliked' || (feedback === 'visited' && rating && rating <= 2)) {
      // Reduce preference for this restaurant's characteristics
      const filteredCuisines = user.preferences.cuisineTypes.filter(cuisine => 
        !restaurant.cuisineType.includes(cuisine) || 
        user.preferences.cuisineTypes.filter(c => c === cuisine).length > 1
      );
      if (filteredCuisines.length > 0) {
        updates.cuisineTypes = filteredCuisines;
      }
    }

    return updates;
  }

  private analyzeDiningHistory(diningHistory: DiningHistory[]): {
    cuisineFrequency: Map<string, number>;
    recentTrends: string[];
  } {
    const cuisineFrequency = new Map<string, number>();
    const recentVisits = diningHistory
      .filter(visit => {
        const daysSinceVisit = (Date.now() - visit.visitDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceVisit <= 90; // Last 3 months
      })
      .sort((a, b) => b.visitDate.getTime() - a.visitDate.getTime());

    // This would require restaurant data to get cuisine types
    // For now, we'll use a simplified approach
    const recentTrends: string[] = [];

    return { cuisineFrequency, recentTrends };
  }

  private calculateCuisineMatch(preferredCuisines: Map<string, number>, restaurantCuisines: string[]): number {
    if (preferredCuisines.size === 0) return 0.5; // Neutral score if no preferences

    let maxMatch = 0;
    restaurantCuisines.forEach(cuisine => {
      const preference = preferredCuisines.get(cuisine) || 0;
      maxMatch = Math.max(maxMatch, preference);
    });

    return maxMatch;
  }

  private calculatePriceMatch(preferredRange: [number, number], restaurantPrice: number): number {
    const [minPrice, maxPrice] = preferredRange;
    
    if (restaurantPrice >= minPrice && restaurantPrice <= maxPrice) {
      return 1.0; // Perfect match
    }
    
    // Calculate penalty for being outside range
    const distance = Math.min(
      Math.abs(restaurantPrice - minPrice),
      Math.abs(restaurantPrice - maxPrice)
    );
    
    return Math.max(0, 1.0 - (distance * 0.3)); // 30% penalty per price level difference
  }

  private calculateAtmosphereMatch(preferredAtmosphere: Map<string, number>, restaurantAtmosphere: string[]): number {
    if (preferredAtmosphere.size === 0) return 0.5; // Neutral score

    let totalMatch = 0;
    let matchCount = 0;

    restaurantAtmosphere.forEach(atmosphere => {
      const preference = preferredAtmosphere.get(atmosphere);
      if (preference !== undefined) {
        totalMatch += preference;
        matchCount++;
      }
    });

    return matchCount > 0 ? totalMatch / matchCount : 0.2; // Low score if no matches
  }

  private calculateSpiceMatch(preferredSpiceLevel: number, menuHighlights: any[]): number {
    // Simplified spice matching - would need more sophisticated analysis
    return 0.5; // Neutral score for now
  }

  private calculateHistoryBonus(visitFrequency: Map<string, number>, restaurantCuisines: string[]): number {
    let maxFrequency = 0;
    restaurantCuisines.forEach(cuisine => {
      const frequency = visitFrequency.get(cuisine) || 0;
      maxFrequency = Math.max(maxFrequency, frequency);
    });

    return Math.min(maxFrequency * 0.5, 0.3); // Cap bonus at 30%
  }
}