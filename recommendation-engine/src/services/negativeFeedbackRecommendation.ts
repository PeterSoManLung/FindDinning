import { Restaurant } from '../../../shared/src/types/restaurant.types';
import { User } from '../../../shared/src/types/user.types';
import { RecommendedRestaurant } from '../../../shared/src/types/recommendation.types';
import { NegativeFeedbackAnalysisService, UserNegativeFeedbackSensitivity } from './negativeFeedbackAnalysis';
import { RestaurantMatchingService } from './restaurantMatching';

export interface NegativeFeedbackAwareWeights {
  preferenceMatch: number;
  negativeFeedbackPenalty: number;
  trendAnalysis: number;
  authenticityBonus: number;
  qualityDeclineRisk: number;
}

export interface NegativeFeedbackFilterCriteria {
  maxNegativeScore: number;
  excludeHighRiskRestaurants: boolean;
  minAuthenticityScore: number;
  categoryThresholds: Map<string, number>;
}

export class NegativeFeedbackRecommendationService {
  private negativeFeedbackAnalysis: NegativeFeedbackAnalysisService;
  private restaurantMatching: RestaurantMatchingService;

  private static readonly DEFAULT_WEIGHTS: NegativeFeedbackAwareWeights = {
    preferenceMatch: 0.4,
    negativeFeedbackPenalty: 0.3,
    trendAnalysis: 0.15,
    authenticityBonus: 0.1,
    qualityDeclineRisk: 0.05
  };

  private static readonly DEFAULT_FILTER_CRITERIA: NegativeFeedbackFilterCriteria = {
    maxNegativeScore: 0.6,
    excludeHighRiskRestaurants: true,
    minAuthenticityScore: 0.3,
    categoryThresholds: new Map([
      ['food_quality', 0.7],
      ['cleanliness', 0.8],
      ['service', 0.6]
    ])
  };

  constructor() {
    this.negativeFeedbackAnalysis = new NegativeFeedbackAnalysisService();
    this.restaurantMatching = new RestaurantMatchingService();
  }

  /**
   * Generate recommendations with negative feedback awareness
   */
  public async generateNegativeFeedbackAwareRecommendations(
    user: User,
    availableRestaurants: Restaurant[],
    weights: NegativeFeedbackAwareWeights = NegativeFeedbackRecommendationService.DEFAULT_WEIGHTS,
    filterCriteria: NegativeFeedbackFilterCriteria = NegativeFeedbackRecommendationService.DEFAULT_FILTER_CRITERIA,
    limit: number = 10
  ): Promise<RecommendedRestaurant[]> {
    // First, filter restaurants based on negative feedback criteria
    const filteredRestaurants = this.filterRestaurantsByNegativeFeedback(
      availableRestaurants,
      user,
      filterCriteria
    );

    // Get user's negative feedback sensitivity
    const userSensitivity = this.negativeFeedbackAnalysis.getUserSensitivity(user);

    // Calculate negative feedback-aware scores for each restaurant
    const scoredRestaurants = filteredRestaurants.map(restaurant => {
      const matchScore = this.calculateNegativeFeedbackAwareScore(
        restaurant,
        user,
        userSensitivity,
        weights
      );

      const reasons = this.generateNegativeFeedbackAwareReasons(restaurant, user);

      return {
        restaurant,
        matchScore,
        reasonsForRecommendation: reasons,
        emotionalAlignment: 0.5 // Will be enhanced by emotional recommendation service
      };
    });

    // Sort by match score and return top recommendations
    return scoredRestaurants
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  }

  /**
   * Filter restaurants to avoid those with consistent negative feedback in user's concern areas
   */
  public filterRestaurantsByNegativeFeedback(
    restaurants: Restaurant[],
    user: User,
    criteria: NegativeFeedbackFilterCriteria
  ): Restaurant[] {
    const userSensitivity = this.negativeFeedbackAnalysis.getUserSensitivity(user);

    return restaurants.filter(restaurant => {
      // Basic negative score filter
      if (restaurant.negativeScore > criteria.maxNegativeScore) {
        return false;
      }

      // Authenticity filter
      if (restaurant.authenticityScore < criteria.minAuthenticityScore) {
        return false;
      }

      // Quality decline risk filter
      if (criteria.excludeHighRiskRestaurants) {
        const riskAnalysis = this.negativeFeedbackAnalysis.predictQualityDecline(restaurant);
        if (riskAnalysis.riskLevel === 'high' && riskAnalysis.confidence > 0.7) {
          return false;
        }
      }

      // Category-specific thresholds
      const negativeFeedback = this.negativeFeedbackAnalysis.analyzeNegativeFeedback(restaurant);
      for (const [category, threshold] of criteria.categoryThresholds) {
        const categoryScore = negativeFeedback.categoryScores.get(category) || 0;
        const userWeight = this.getCategoryWeight(category, userSensitivity);
        
        // If user cares about this category and restaurant has high negative feedback
        if (userWeight > 0.15 && categoryScore > threshold) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Analyze negative feedback trends to predict restaurant quality decline
   */
  public analyzeNegativeFeedbackTrends(restaurants: Restaurant[]): {
    restaurant: Restaurant;
    riskAnalysis: any;
    recommendation: 'avoid' | 'caution' | 'monitor' | 'safe';
  }[] {
    return restaurants.map(restaurant => {
      const riskAnalysis = this.negativeFeedbackAnalysis.predictQualityDecline(restaurant);
      
      let recommendation: 'avoid' | 'caution' | 'monitor' | 'safe';
      if (riskAnalysis.riskLevel === 'high' && riskAnalysis.confidence > 0.8) {
        recommendation = 'avoid';
      } else if (riskAnalysis.riskLevel === 'high' || 
                (riskAnalysis.riskLevel === 'medium' && riskAnalysis.confidence > 0.7)) {
        recommendation = 'caution';
      } else if (riskAnalysis.riskLevel === 'medium') {
        recommendation = 'monitor';
      } else {
        recommendation = 'safe';
      }

      return { restaurant, riskAnalysis, recommendation };
    });
  }

  /**
   * Build user-specific negative feedback sensitivity profile
   */
  public buildUserNegativeFeedbackSensitivity(
    user: User,
    feedbackHistory?: any[] // This would come from user's past feedback
  ): UserNegativeFeedbackSensitivity {
    let sensitivity = this.negativeFeedbackAnalysis.getUserSensitivity(user);

    // Enhance with feedback history analysis if available
    if (feedbackHistory && feedbackHistory.length > 0) {
      // Analyze what categories the user complains about most
      const categoryComplaints = new Map<string, number>();
      
      feedbackHistory.forEach(feedback => {
        // This would analyze the user's past negative feedback
        // For now, we'll use the base sensitivity
      });
    }

    return sensitivity;
  }

  private calculateNegativeFeedbackAwareScore(
    restaurant: Restaurant,
    user: User,
    userSensitivity: UserNegativeFeedbackSensitivity,
    weights: NegativeFeedbackAwareWeights
  ): number {
    let totalScore = 0;

    // Base preference match (using existing restaurant matching service)
    // This would ideally call the restaurant matching service, but for simplicity:
    const basePreferenceScore = this.calculateBasicPreferenceMatch(restaurant, user);
    totalScore += basePreferenceScore * weights.preferenceMatch;

    // Negative feedback penalty
    const penalty = this.negativeFeedbackAnalysis.calculateRestaurantPenalty(restaurant, userSensitivity);
    const negativeFeedbackScore = Math.max(0, 1.0 - penalty);
    totalScore += negativeFeedbackScore * weights.negativeFeedbackPenalty;

    // Trend analysis bonus/penalty
    const negativeFeedback = this.negativeFeedbackAnalysis.analyzeNegativeFeedback(restaurant);
    const trendScore = negativeFeedback.trendAnalysis.isImproving ? 0.8 : 
                      negativeFeedback.trendAnalysis.isDeclining ? 0.2 : 0.5;
    totalScore += trendScore * weights.trendAnalysis;

    // Authenticity bonus
    const authenticityScore = negativeFeedback.authenticity;
    totalScore += authenticityScore * weights.authenticityBonus;

    // Quality decline risk penalty
    const riskAnalysis = this.negativeFeedbackAnalysis.predictQualityDecline(restaurant);
    const riskScore = riskAnalysis.riskLevel === 'low' ? 1.0 : 
                     riskAnalysis.riskLevel === 'medium' ? 0.6 : 0.2;
    totalScore += riskScore * weights.qualityDeclineRisk;

    return Math.min(totalScore, 1.0);
  }

  private generateNegativeFeedbackAwareReasons(restaurant: Restaurant, user: User): string[] {
    const reasons: string[] = [];
    const negativeFeedback = this.negativeFeedbackAnalysis.analyzeNegativeFeedback(restaurant);

    // Low negative feedback reasons
    if (restaurant.negativeScore <= 0.3) {
      reasons.push('Consistently positive customer feedback with minimal complaints');
    }

    // Authenticity reasons
    if (negativeFeedback.authenticity >= 0.8) {
      reasons.push('Authentic reviews indicate genuine quality');
    }

    // Trend reasons
    if (negativeFeedback.trendAnalysis.isImproving) {
      reasons.push('Recent improvements in customer satisfaction');
    }

    // Quality decline warning
    const riskAnalysis = this.negativeFeedbackAnalysis.predictQualityDecline(restaurant);
    if (riskAnalysis.riskLevel === 'low') {
      reasons.push('Low risk of quality decline based on feedback patterns');
    }

    // Category-specific reasons
    const userSensitivity = this.negativeFeedbackAnalysis.getUserSensitivity(user);
    negativeFeedback.categoryScores.forEach((score, category) => {
      const userWeight = this.getCategoryWeight(category, userSensitivity);
      if (userWeight > 0.2 && score <= 0.3) {
        reasons.push(`Excellent ${category.replace('_', ' ')} based on customer feedback`);
      }
    });

    return reasons.slice(0, 4); // Limit to top 4 reasons
  }

  private calculateBasicPreferenceMatch(restaurant: Restaurant, user: User): number {
    // Simplified preference matching - in real implementation, this would use RestaurantMatchingService
    let score = 0.5; // Base score

    // Cuisine match
    const matchingCuisines = restaurant.cuisineType.filter(cuisine => 
      user.preferences.cuisineTypes.includes(cuisine)
    );
    if (matchingCuisines.length > 0) {
      score += 0.3;
    }

    // Price range match
    const [minPrice, maxPrice] = user.preferences.priceRange;
    if (restaurant.priceRange >= minPrice && restaurant.priceRange <= maxPrice) {
      score += 0.2;
    }

    return Math.min(score, 1.0);
  }

  private getCategoryWeight(category: string, sensitivity: UserNegativeFeedbackSensitivity): number {
    switch (category.toLowerCase()) {
      case 'service': return sensitivity.serviceWeight;
      case 'food_quality': return sensitivity.foodQualityWeight;
      case 'cleanliness': return sensitivity.cleanlinessWeight;
      case 'value': return sensitivity.valueWeight;
      case 'atmosphere': return sensitivity.atmosphereWeight;
      case 'wait_time': return sensitivity.waitTimeWeight;
      default: return 0.1;
    }
  }
}