import { User, UserPreferences, DiningHistory } from '../../../shared/src/types/user.types';
import { Restaurant } from '../../../shared/src/types/restaurant.types';
import { RecommendationFeedback } from '../../../shared/src/types/recommendation.types';

export interface LearningWeights {
  positiveWeight: number;
  negativeWeight: number;
  visitWeight: number;
  ratingWeight: number;
  recencyWeight: number;
}

export interface PreferenceLearningResult {
  updatedPreferences: Partial<UserPreferences>;
  confidence: number;
  learningInsights: string[];
}

export class PreferenceLearningService {
  private static readonly DEFAULT_WEIGHTS: LearningWeights = {
    positiveWeight: 0.3,
    negativeWeight: 0.4, // Negative feedback has higher impact
    visitWeight: 0.2,
    ratingWeight: 0.3,
    recencyWeight: 0.2
  };

  /**
   * Learn from user feedback and update preferences
   */
  public learnFromFeedback(
    user: User,
    restaurant: Restaurant,
    feedback: RecommendationFeedback,
    weights: LearningWeights = PreferenceLearningService.DEFAULT_WEIGHTS
  ): PreferenceLearningResult {
    const insights: string[] = [];
    const updatedPreferences: Partial<UserPreferences> = {};

    // Calculate feedback strength based on type and rating
    const feedbackStrength = this.calculateFeedbackStrength(feedback, weights);
    
    // Learn cuisine preferences
    const cuisineLearning = this.learnCuisinePreferences(
      user.preferences,
      restaurant,
      feedback,
      feedbackStrength
    );
    if (cuisineLearning.updated) {
      updatedPreferences.cuisineTypes = cuisineLearning.cuisines;
      insights.push(...cuisineLearning.insights);
    }

    // Learn atmosphere preferences
    const atmosphereLearning = this.learnAtmospherePreferences(
      user.preferences,
      restaurant,
      feedback,
      feedbackStrength
    );
    if (atmosphereLearning.updated) {
      updatedPreferences.atmospherePreferences = atmosphereLearning.atmospheres;
      insights.push(...atmosphereLearning.insights);
    }

    // Learn price range preferences
    const priceLearning = this.learnPricePreferences(
      user.preferences,
      restaurant,
      feedback,
      feedbackStrength
    );
    if (priceLearning.updated) {
      updatedPreferences.priceRange = priceLearning.priceRange;
      insights.push(...priceLearning.insights);
    }

    // Learn spice level preferences
    const spiceLearning = this.learnSpicePreferences(
      user.preferences,
      restaurant,
      feedback,
      feedbackStrength
    );
    if (spiceLearning.updated) {
      updatedPreferences.spiceLevel = spiceLearning.spiceLevel;
      insights.push(...spiceLearning.insights);
    }

    const confidence = this.calculateLearningConfidence(feedback, user.diningHistory.length);

    // Ensure we always have at least one insight
    if (insights.length === 0) {
      insights.push(`Processed ${feedback.feedback} feedback with ${(confidence * 100).toFixed(0)}% confidence`);
    }

    return {
      updatedPreferences,
      confidence,
      learningInsights: insights
    };
  }

  /**
   * Analyze dining history patterns to suggest preference updates
   */
  public analyzeDiningPatterns(user: User): PreferenceLearningResult {
    const insights: string[] = [];
    const updatedPreferences: Partial<UserPreferences> = {};

    // Analyze recent dining trends (last 3 months)
    const recentHistory = user.diningHistory.filter(visit => {
      const daysSince = (Date.now() - visit.visitDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 90;
    });

    if (recentHistory.length < 3) {
      return {
        updatedPreferences: {},
        confidence: 0.1,
        learningInsights: ['Insufficient dining history for pattern analysis']
      };
    }

    // This would require restaurant data to analyze patterns
    // For now, we'll provide a framework for future implementation
    insights.push('Pattern analysis requires integration with restaurant service');

    return {
      updatedPreferences,
      confidence: 0.5,
      learningInsights: insights
    };
  }

  /**
   * Calculate feedback strength based on type and rating
   */
  private calculateFeedbackStrength(feedback: RecommendationFeedback, weights: LearningWeights): number {
    let strength = 0;

    switch (feedback.feedback) {
      case 'liked':
        strength = weights.positiveWeight;
        break;
      case 'disliked':
        strength = -weights.negativeWeight; // Make negative for disliked
        break;
      case 'visited':
        strength = weights.visitWeight;
        if (feedback.rating) {
          // Adjust strength based on rating
          const ratingAdjustment = (feedback.rating - 3) / 2; // -1 to +1 scale
          strength += ratingAdjustment * weights.ratingWeight;
        }
        break;
      case 'not_interested':
        strength = -weights.negativeWeight * 0.5; // Less strong than disliked, but negative
        break;
    }

    // Apply recency weight (more recent feedback has higher impact)
    const daysSinceFeedback = (Date.now() - feedback.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const recencyMultiplier = Math.max(0.5, 1.0 - (daysSinceFeedback / 30)); // Decay over 30 days
    
    return strength * (1 + weights.recencyWeight * recencyMultiplier);
  }

  /**
   * Learn cuisine preferences from feedback
   */
  private learnCuisinePreferences(
    currentPreferences: UserPreferences,
    restaurant: Restaurant,
    feedback: RecommendationFeedback,
    strength: number
  ): { updated: boolean; cuisines: string[]; insights: string[] } {
    const insights: string[] = [];
    let cuisines = [...currentPreferences.cuisineTypes];
    let updated = false;

    if (strength > 0.2) { // Positive feedback
      restaurant.cuisineType.forEach(cuisine => {
        if (!cuisines.includes(cuisine)) {
          cuisines.push(cuisine);
          insights.push(`Added ${cuisine} to preferred cuisines based on positive feedback`);
          updated = true;
        }
      });
    } else if (strength < -0.2) { // Negative feedback
      // Only remove cuisines if user has multiple preferences
      if (cuisines.length > 1) {
        restaurant.cuisineType.forEach(cuisine => {
          const index = cuisines.indexOf(cuisine);
          if (index > -1) {
            cuisines.splice(index, 1);
            insights.push(`Reduced preference for ${cuisine} based on negative feedback`);
            updated = true;
          }
        });
      }
    }

    return { updated, cuisines, insights };
  }

  /**
   * Learn atmosphere preferences from feedback
   */
  private learnAtmospherePreferences(
    currentPreferences: UserPreferences,
    restaurant: Restaurant,
    feedback: RecommendationFeedback,
    strength: number
  ): { updated: boolean; atmospheres: string[]; insights: string[] } {
    const insights: string[] = [];
    let atmospheres = [...currentPreferences.atmospherePreferences];
    let updated = false;

    if (strength > 0.2) { // Positive feedback
      restaurant.atmosphere.forEach(atmosphere => {
        if (!atmospheres.includes(atmosphere)) {
          atmospheres.push(atmosphere);
          insights.push(`Added ${atmosphere} to preferred atmospheres`);
          updated = true;
        }
      });
    } else if (strength < -0.2) { // Negative feedback
      restaurant.atmosphere.forEach(atmosphere => {
        const index = atmospheres.indexOf(atmosphere);
        if (index > -1) {
          atmospheres.splice(index, 1);
          insights.push(`Reduced preference for ${atmosphere} atmosphere`);
          updated = true;
        }
      });
    }

    // Always provide some insight for feedback processing
    if (!updated && insights.length === 0) {
      insights.push(`Processed ${feedback.feedback} feedback for ${restaurant.name}`);
    }

    return { updated, atmospheres, insights };
  }

  /**
   * Learn price range preferences from feedback
   */
  private learnPricePreferences(
    currentPreferences: UserPreferences,
    restaurant: Restaurant,
    feedback: RecommendationFeedback,
    strength: number
  ): { updated: boolean; priceRange: [number, number]; insights: string[] } {
    const insights: string[] = [];
    let priceRange: [number, number] = [...currentPreferences.priceRange];
    let updated = false;

    if (strength > 0.3) { // Strong positive feedback
      const [currentMin, currentMax] = priceRange;
      
      // Expand range to include this restaurant's price if it's outside
      if (restaurant.priceRange < currentMin) {
        priceRange[0] = restaurant.priceRange;
        insights.push(`Expanded price range to include lower-priced options`);
        updated = true;
      } else if (restaurant.priceRange > currentMax) {
        priceRange[1] = restaurant.priceRange;
        insights.push(`Expanded price range to include higher-priced options`);
        updated = true;
      }
    }

    return { updated, priceRange, insights };
  }

  /**
   * Learn spice level preferences from feedback
   */
  private learnSpicePreferences(
    currentPreferences: UserPreferences,
    restaurant: Restaurant,
    feedback: RecommendationFeedback,
    strength: number
  ): { updated: boolean; spiceLevel: number; insights: string[] } {
    const insights: string[] = [];
    let spiceLevel = currentPreferences.spiceLevel;
    let updated = false;

    // This would require menu analysis to determine restaurant's spice level
    // For now, we'll provide a framework for future implementation
    
    return { updated, spiceLevel, insights };
  }

  /**
   * Calculate confidence in learning based on feedback quality and history
   */
  private calculateLearningConfidence(feedback: RecommendationFeedback, historyLength: number): number {
    let confidence = 0.4; // Base confidence

    // Feedback type affects confidence
    switch (feedback.feedback) {
      case 'visited':
        confidence += 0.25;
        if (feedback.rating) {
          confidence += 0.15; // Rating provides more certainty
        }
        break;
      case 'liked':
      case 'disliked':
        confidence += 0.15;
        break;
      case 'not_interested':
        confidence += 0.05;
        break;
    }

    // More dining history increases confidence
    const historyBonus = Math.min(historyLength / 20, 0.2); // Max 20% bonus for 20+ visits
    confidence += historyBonus;

    // Detailed feedback increases confidence
    if (feedback.notes && feedback.notes.length > 10) {
      confidence += 0.1;
    }

    return Math.min(confidence, 0.9); // Cap at 90% to leave room for uncertainty
  }
}