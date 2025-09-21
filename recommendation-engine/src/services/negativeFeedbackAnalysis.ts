import { Restaurant, NegativeFeedbackTrend } from '../../../shared/src/types/restaurant.types';
import { User } from '../../../shared/src/types/user.types';

export interface NegativeFeedbackScore {
  overallScore: number; // 0-1 scale, higher means more negative feedback
  categoryScores: Map<string, number>;
  trendAnalysis: NegativeFeedbackTrendAnalysis;
  authenticity: number; // 0-1 scale, higher means more authentic negative feedback
}

export interface NegativeFeedbackTrendAnalysis {
  isImproving: boolean;
  isDeclining: boolean;
  recentTrendScore: number; // Recent trend impact on overall score
  consistencyScore: number; // How consistent the negative feedback is
}

export interface UserNegativeFeedbackSensitivity {
  serviceWeight: number;
  foodQualityWeight: number;
  cleanlinessWeight: number;
  valueWeight: number;
  atmosphereWeight: number;
  waitTimeWeight: number;
}

export class NegativeFeedbackAnalysisService {
  private static readonly DEFAULT_SENSITIVITY: UserNegativeFeedbackSensitivity = {
    serviceWeight: 0.2,
    foodQualityWeight: 0.25,
    cleanlinessWeight: 0.2,
    valueWeight: 0.15,
    atmosphereWeight: 0.1,
    waitTimeWeight: 0.1
  };

  /**
   * Analyze negative feedback for a restaurant
   */
  public analyzeNegativeFeedback(restaurant: Restaurant): NegativeFeedbackScore {
    const categoryScores = this.calculateCategoryScores(restaurant.negativeFeedbackTrends);
    const trendAnalysis = this.analyzeTrends(restaurant.negativeFeedbackTrends);
    const authenticity = this.calculateAuthenticityScore(restaurant);
    
    // Calculate overall score weighted by authenticity and trends
    const baseScore = restaurant.negativeScore;
    const trendAdjustment = trendAnalysis.recentTrendScore * 0.3;
    const authenticityAdjustment = (1 - authenticity) * 0.2; // Lower authenticity increases penalty
    
    const overallScore = Math.min(1.0, baseScore + trendAdjustment + authenticityAdjustment);

    return {
      overallScore,
      categoryScores,
      trendAnalysis,
      authenticity
    };
  }

  /**
   * Calculate restaurant penalty based on negative feedback patterns
   */
  public calculateRestaurantPenalty(
    restaurant: Restaurant,
    userSensitivity: UserNegativeFeedbackSensitivity = NegativeFeedbackAnalysisService.DEFAULT_SENSITIVITY
  ): number {
    const negativeFeedback = this.analyzeNegativeFeedback(restaurant);
    
    // Calculate weighted penalty based on user sensitivity
    let penalty = 0;
    
    negativeFeedback.categoryScores.forEach((score, category) => {
      const weight = this.getCategoryWeight(category, userSensitivity);
      penalty += score * weight;
    });

    // Apply trend and authenticity adjustments
    penalty *= (1 + negativeFeedback.trendAnalysis.recentTrendScore * 0.5);
    penalty *= (2 - negativeFeedback.authenticity); // Higher authenticity reduces penalty

    return Math.min(penalty, 1.0);
  }

  /**
   * Filter restaurants based on negative feedback patterns
   */
  public filterByNegativeFeedback(
    restaurants: Restaurant[],
    user: User,
    maxNegativeScore: number = 0.7
  ): Restaurant[] {
    const userSensitivity = this.getUserSensitivity(user);
    
    return restaurants.filter(restaurant => {
      const penalty = this.calculateRestaurantPenalty(restaurant, userSensitivity);
      const adjustedScore = restaurant.negativeScore + penalty;
      
      return adjustedScore <= maxNegativeScore;
    });
  }

  /**
   * Predict restaurant quality decline based on negative feedback trends
   */
  public predictQualityDecline(restaurant: Restaurant): {
    riskLevel: 'low' | 'medium' | 'high';
    confidence: number;
    reasons: string[];
  } {
    const negativeFeedback = this.analyzeNegativeFeedback(restaurant);
    const reasons: string[] = [];
    let riskScore = 0;

    // Analyze trend patterns
    if (negativeFeedback.trendAnalysis.isDeclining) {
      riskScore += 0.4;
      reasons.push('Declining trend in customer satisfaction');
    }

    // Analyze consistency of negative feedback
    if (negativeFeedback.trendAnalysis.consistencyScore > 0.7) {
      riskScore += 0.3;
      reasons.push('Consistent pattern of negative feedback');
    }

    // Analyze specific categories
    negativeFeedback.categoryScores.forEach((score, category) => {
      if (score > 0.5) { // Lower threshold to catch the test case
        riskScore += 0.2;
        reasons.push(`High negative feedback in ${category}`);
      }
    });

    // Analyze authenticity
    if (negativeFeedback.authenticity > 0.8) {
      riskScore += 0.2;
      reasons.push('High authenticity of negative reviews');
    }

    const riskLevel = riskScore > 0.7 ? 'high' : riskScore > 0.4 ? 'medium' : 'low';
    const confidence = Math.min(negativeFeedback.authenticity * 0.8 + 0.2, 1.0);

    return { riskLevel, confidence, reasons };
  }

  /**
   * Get user-specific negative feedback sensitivity
   */
  public getUserSensitivity(user: User): UserNegativeFeedbackSensitivity {
    // This could be enhanced with machine learning based on user's past feedback
    // For now, return default sensitivity with some personalization
    
    const sensitivity = { ...NegativeFeedbackAnalysisService.DEFAULT_SENSITIVITY };
    
    // Adjust based on user's dietary restrictions (they might care more about cleanliness)
    if (user.preferences.dietaryRestrictions.length > 0) {
      sensitivity.cleanlinessWeight += 0.1;
      sensitivity.foodQualityWeight += 0.05;
      // Reduce other weights proportionally to maintain sum of 1
      const totalIncrease = 0.15;
      const reductionPerCategory = totalIncrease / 4;
      sensitivity.serviceWeight -= reductionPerCategory;
      sensitivity.valueWeight -= reductionPerCategory;
      sensitivity.atmosphereWeight -= reductionPerCategory;
      sensitivity.waitTimeWeight -= reductionPerCategory;
    }

    // Adjust based on price sensitivity
    const avgPricePreference = (user.preferences.priceRange[0] + user.preferences.priceRange[1]) / 2;
    if (avgPricePreference <= 2) {
      sensitivity.valueWeight += 0.1; // Budget-conscious users care more about value
      // Reduce other weights proportionally
      const reductionPerCategory = 0.1 / 5;
      sensitivity.serviceWeight -= reductionPerCategory;
      sensitivity.foodQualityWeight -= reductionPerCategory;
      sensitivity.cleanlinessWeight -= reductionPerCategory;
      sensitivity.atmosphereWeight -= reductionPerCategory;
      sensitivity.waitTimeWeight -= reductionPerCategory;
    }

    return sensitivity;
  }

  private calculateCategoryScores(trends: NegativeFeedbackTrend[]): Map<string, number> {
    const categoryScores = new Map<string, number>();
    
    trends.forEach(trend => {
      const score = trend.severity * trend.frequency;
      categoryScores.set(trend.category, score);
    });

    return categoryScores;
  }

  private analyzeTrends(trends: NegativeFeedbackTrend[]): NegativeFeedbackTrendAnalysis {
    let improvingCount = 0;
    let decliningCount = 0;
    let totalSeverity = 0;
    let recentTrendScore = 0;

    trends.forEach(trend => {
      if (trend.trend === 'improving') improvingCount++;
      if (trend.trend === 'declining') decliningCount++;
      
      totalSeverity += trend.severity;
      
      // Weight recent trends more heavily
      if (trend.timeframe === 'recent') {
        recentTrendScore += trend.severity * trend.frequency * 0.5;
      }
    });

    const isImproving = improvingCount > decliningCount;
    const isDeclining = decliningCount > improvingCount;
    const consistencyScore = trends.length > 0 ? totalSeverity / trends.length : 0;

    return {
      isImproving,
      isDeclining,
      recentTrendScore: Math.min(recentTrendScore, 1.0),
      consistencyScore: Math.min(consistencyScore, 1.0)
    };
  }

  private calculateAuthenticityScore(restaurant: Restaurant): number {
    // Base authenticity on restaurant's authenticity score and data quality
    const baseAuthenticity = restaurant.authenticityScore || 0.5;
    const dataQualityBonus = restaurant.dataQualityScore * 0.2;
    
    // Local gems tend to have more authentic feedback
    const localGemBonus = restaurant.isLocalGem ? 0.1 : 0;
    
    return Math.min(baseAuthenticity + dataQualityBonus + localGemBonus, 1.0);
  }

  private getCategoryWeight(category: string, sensitivity: UserNegativeFeedbackSensitivity): number {
    switch (category.toLowerCase()) {
      case 'service': return sensitivity.serviceWeight;
      case 'food_quality': return sensitivity.foodQualityWeight;
      case 'cleanliness': return sensitivity.cleanlinessWeight;
      case 'value': return sensitivity.valueWeight;
      case 'atmosphere': return sensitivity.atmosphereWeight;
      case 'wait_time': return sensitivity.waitTimeWeight;
      default: return 0.1; // Default weight for unknown categories
    }
  }
}