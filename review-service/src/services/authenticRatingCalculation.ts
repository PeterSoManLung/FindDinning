import { Review, NegativeFeedbackCategory } from '../../../shared/src/types/review.types';
import { RestaurantNegativeScore, analyzeNegativeFeedbackPatterns, calculateRestaurantNegativeScore } from './negativeFeedbackAnalysis';

export interface AuthenticRatingResult {
  restaurantId: string;
  authenticRating: number;
  traditionalRating: number;
  negativeWeightedScore: number;
  temporalTrend: 'improving' | 'declining' | 'stable';
  confidenceLevel: number;
  ratingBreakdown: {
    positiveReviewsWeight: number;
    negativeReviewsWeight: number;
    authenticityAdjustment: number;
    temporalAdjustment: number;
  };
  comparisonMetrics: {
    peerGroupAverage: number;
    relativePerformance: 'above_average' | 'average' | 'below_average';
  };
}

export interface TemporalAnalysis {
  period: string;
  averageRating: number;
  negativeIncidents: number;
  authenticityScore: number;
  reviewCount: number;
}

/**
 * Calculate authentic rating that prioritizes negative feedback authenticity
 */
export function calculateAuthenticRating(
  restaurantId: string,
  reviews: Review[],
  peerGroupReviews?: Review[][]
): AuthenticRatingResult {
  if (reviews.length === 0) {
    return createEmptyRatingResult(restaurantId);
  }

  // Calculate traditional rating for comparison
  const traditionalRating = calculateTraditionalRating(reviews);
  
  // Analyze negative feedback patterns
  const negativePatterns = analyzeNegativeFeedbackPatterns(reviews, 12);
  const negativeScore = calculateRestaurantNegativeScore(reviews, negativePatterns);
  
  // Calculate weighted scores
  const positiveReviewsWeight = calculatePositiveReviewsWeight(reviews);
  const negativeReviewsWeight = calculateNegativeReviewsWeight(reviews);
  const authenticityAdjustment = calculateAuthenticityAdjustment(reviews);
  
  // Temporal analysis
  const temporalAnalysis = analyzeTemporalTrends(reviews, 12);
  const temporalTrend = determineOverallTrend(temporalAnalysis);
  const temporalAdjustment = calculateTemporalAdjustment(temporalTrend, temporalAnalysis);
  
  // Calculate base authentic rating
  let authenticRating = calculateBaseAuthenticRating(
    positiveReviewsWeight,
    negativeReviewsWeight,
    authenticityAdjustment
  );
  
  // Apply temporal adjustment
  authenticRating = applyTemporalAdjustment(authenticRating, temporalAdjustment);
  
  // Calculate confidence level
  const confidenceLevel = calculateConfidenceLevel(reviews, negativePatterns);
  
  // Peer comparison
  const comparisonMetrics = calculatePeerComparison(
    authenticRating,
    negativeScore,
    peerGroupReviews || []
  );
  
  return {
    restaurantId,
    authenticRating: Math.max(1, Math.min(5, authenticRating)),
    traditionalRating,
    negativeWeightedScore: negativeScore.overallNegativeScore,
    temporalTrend,
    confidenceLevel,
    ratingBreakdown: {
      positiveReviewsWeight,
      negativeReviewsWeight,
      authenticityAdjustment,
      temporalAdjustment
    },
    comparisonMetrics
  };
}

/**
 * Calculate traditional average rating
 */
function calculateTraditionalRating(reviews: Review[]): number {
  if (reviews.length === 0) return 0;
  
  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  return totalRating / reviews.length;
}

/**
 * Calculate weight for positive reviews with authenticity consideration
 */
function calculatePositiveReviewsWeight(reviews: Review[]): number {
  const positiveReviews = reviews.filter(review => review.rating >= 4);
  
  if (positiveReviews.length === 0) return 0;
  
  let totalWeight = 0;
  let weightedSum = 0;
  
  positiveReviews.forEach(review => {
    // Base weight from rating
    let weight = review.rating;
    
    // Authenticity multiplier (reduce weight for low authenticity)
    const authenticityMultiplier = Math.max(0.3, review.authenticityScore / 100);
    weight *= authenticityMultiplier;
    
    // Verified user bonus
    if (review.isVerified) {
      weight *= 1.1;
    }
    
    // Photo evidence bonus
    if (review.photos.length > 0) {
      weight *= 1.05;
    }
    
    // Detailed content bonus
    if (review.content.length > 150) {
      weight *= 1.05;
    }
    
    totalWeight += weight;
    weightedSum += weight * review.rating;
  });
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Calculate weight for negative reviews with higher authenticity priority
 */
function calculateNegativeReviewsWeight(reviews: Review[]): number {
  const negativeReviews = reviews.filter(review => review.rating <= 3);
  
  if (negativeReviews.length === 0) return 0;
  
  let totalWeight = 0;
  let weightedSum = 0;
  
  negativeReviews.forEach(review => {
    // Base weight from inverse rating (lower ratings get higher weight)
    let weight = (6 - review.rating) * 2; // 1-star = 10, 2-star = 8, 3-star = 6
    
    // Authenticity multiplier (much higher impact for negative reviews)
    const authenticityMultiplier = Math.max(0.5, review.authenticityScore / 100);
    weight *= authenticityMultiplier;
    
    // Specific feedback categories bonus
    if (review.negativeFeedbackCategories.length > 0) {
      weight *= 1.3;
    }
    
    // Critical categories get extra weight
    const criticalCategories = ['food_quality', 'cleanliness'];
    const hasCriticalIssues = review.negativeFeedbackCategories.some(
      cat => criticalCategories.includes(cat.category) && cat.severity >= 4
    );
    if (hasCriticalIssues) {
      weight *= 2.0; // Increased from 1.5 to 2.0
    }
    
    // Verified user bonus
    if (review.isVerified) {
      weight *= 1.2;
    }
    
    // Photo evidence bonus (more important for negative reviews)
    if (review.photos.length > 0) {
      weight *= 1.3;
    }
    
    // Detailed content bonus
    if (review.content.length > 100) {
      weight *= 1.2;
    }
    
    totalWeight += weight;
    weightedSum += weight * review.rating;
  });
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Calculate authenticity adjustment based on overall review authenticity
 */
function calculateAuthenticityAdjustment(reviews: Review[]): number {
  if (reviews.length === 0) return 0;
  
  const averageAuthenticity = reviews.reduce((sum, review) => 
    sum + review.authenticityScore, 0) / reviews.length;
  
  // Convert to adjustment factor (-1 to +1)
  return (averageAuthenticity - 50) / 100;
}

/**
 * Analyze temporal trends in reviews
 */
function analyzeTemporalTrends(reviews: Review[], months: number): TemporalAnalysis[] {
  const trends: TemporalAnalysis[] = [];
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  
  for (let i = 0; i < months; i++) {
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() - i);
    const startDate = new Date(endDate.getTime() - monthMs);
    
    const periodReviews = reviews.filter(review => {
      const reviewDate = new Date(review.createdAt);
      return reviewDate >= startDate && reviewDate < endDate;
    });
    
    if (periodReviews.length === 0) continue;
    
    const averageRating = periodReviews.reduce((sum, r) => sum + r.rating, 0) / periodReviews.length;
    const negativeIncidents = periodReviews.filter(r => r.rating <= 3).length;
    const authenticityScore = periodReviews.reduce((sum, r) => sum + r.authenticityScore, 0) / periodReviews.length;
    
    trends.push({
      period: `${startDate.getMonth() + 1}/${startDate.getFullYear()}`,
      averageRating,
      negativeIncidents,
      authenticityScore,
      reviewCount: periodReviews.length
    });
  }
  
  return trends.reverse(); // Chronological order
}

/**
 * Determine overall trend from temporal analysis
 */
function determineOverallTrend(trends: TemporalAnalysis[]): 'improving' | 'declining' | 'stable' {
  if (trends.length < 3) return 'stable';
  
  // Split into recent half and older half
  const midPoint = Math.floor(trends.length / 2);
  const recentTrends = trends.slice(midPoint);
  const olderTrends = trends.slice(0, midPoint);
  
  if (recentTrends.length === 0 || olderTrends.length === 0) return 'stable';
  
  const recentAvgRating = recentTrends.reduce((sum, t) => sum + t.averageRating, 0) / recentTrends.length;
  const olderAvgRating = olderTrends.reduce((sum, t) => sum + t.averageRating, 0) / olderTrends.length;
  
  const recentTotalReviews = recentTrends.reduce((sum, t) => sum + t.reviewCount, 0);
  const olderTotalReviews = olderTrends.reduce((sum, t) => sum + t.reviewCount, 0);
  
  const recentNegativeRate = recentTotalReviews > 0 ? 
    recentTrends.reduce((sum, t) => sum + t.negativeIncidents, 0) / recentTotalReviews : 0;
  const olderNegativeRate = olderTotalReviews > 0 ? 
    olderTrends.reduce((sum, t) => sum + t.negativeIncidents, 0) / olderTotalReviews : 0;
  
  const ratingChange = recentAvgRating - olderAvgRating;
  const negativeChange = recentNegativeRate - olderNegativeRate;
  
  // Prioritize negative feedback changes
  if (negativeChange > 0.05 || ratingChange < -0.2) return 'declining';
  if (negativeChange < -0.05 && ratingChange > 0.15) return 'improving';
  return 'stable';
}

/**
 * Calculate temporal adjustment factor
 */
function calculateTemporalAdjustment(
  trend: 'improving' | 'declining' | 'stable',
  trends: TemporalAnalysis[]
): number {
  if (trends.length < 2) return 0;
  
  const recent = trends.slice(-2);
  const avgRecentNegativeRate = recent.reduce((sum, t) => sum + t.negativeIncidents, 0) / 
                               recent.reduce((sum, t) => sum + t.reviewCount, 0);
  
  switch (trend) {
    case 'improving':
      return Math.min(0.3, 0.1 * (1 - avgRecentNegativeRate));
    case 'declining':
      return Math.max(-0.5, -0.2 * (1 + avgRecentNegativeRate));
    default:
      return 0;
  }
}

/**
 * Calculate base authentic rating from weighted components
 */
function calculateBaseAuthenticRating(
  positiveWeight: number,
  negativeWeight: number,
  authenticityAdjustment: number
): number {
  // Negative reviews have 3x impact on final rating
  const negativeImpact = negativeWeight * 3;
  const positiveImpact = positiveWeight;
  
  // Base calculation prioritizing negative feedback
  let baseRating: number;
  
  if (negativeWeight > 0 && positiveWeight > 0) {
    // Both positive and negative reviews exist
    baseRating = (positiveImpact + negativeImpact) / 4; // Weighted average
  } else if (negativeWeight > 0) {
    // Only negative reviews
    baseRating = negativeWeight;
  } else if (positiveWeight > 0) {
    // Only positive reviews
    baseRating = positiveWeight;
  } else {
    // No reviews
    baseRating = 3; // Neutral
  }
  
  // Apply authenticity adjustment
  baseRating += authenticityAdjustment;
  
  return baseRating;
}

/**
 * Apply temporal adjustment to rating
 */
function applyTemporalAdjustment(rating: number, adjustment: number): number {
  return rating + adjustment;
}

/**
 * Calculate confidence level in the rating
 */
function calculateConfidenceLevel(reviews: Review[], negativePatterns: any[]): number {
  let confidence = 50; // Base confidence
  
  // Review count factor
  if (reviews.length >= 20) confidence += 20;
  else if (reviews.length >= 10) confidence += 10;
  else if (reviews.length >= 5) confidence += 5;
  else if (reviews.length === 1) confidence -= 20; // Penalty for single review
  
  // Authenticity factor
  const avgAuthenticity = reviews.reduce((sum, r) => sum + r.authenticityScore, 0) / reviews.length;
  confidence += (avgAuthenticity - 50) / 5;
  
  // Verified reviews factor
  const verifiedRatio = reviews.filter(r => r.isVerified).length / reviews.length;
  confidence += verifiedRatio * 15;
  
  // Photo evidence factor
  const photoRatio = reviews.filter(r => r.photos.length > 0).length / reviews.length;
  confidence += photoRatio * 10;
  
  // Negative feedback specificity
  const specificNegativeReviews = reviews.filter(r => 
    r.rating <= 3 && r.negativeFeedbackCategories.length > 0
  ).length;
  const negativeReviews = reviews.filter(r => r.rating <= 3).length;
  
  if (negativeReviews > 0) {
    const specificityRatio = specificNegativeReviews / negativeReviews;
    confidence += specificityRatio * 10;
  }
  
  return Math.max(0, Math.min(100, confidence));
}

/**
 * Calculate peer comparison metrics
 */
function calculatePeerComparison(
  authenticRating: number,
  negativeScore: RestaurantNegativeScore,
  peerGroupReviews: Review[][]
): { peerGroupAverage: number; relativePerformance: 'above_average' | 'average' | 'below_average' } {
  if (peerGroupReviews.length === 0) {
    return {
      peerGroupAverage: 3.5,
      relativePerformance: 'average'
    };
  }
  
  // Calculate peer group authentic ratings
  const peerRatings = peerGroupReviews.map(peerReviews => {
    if (peerReviews.length === 0) return 3.5;
    
    const peerResult = calculateAuthenticRating('peer', peerReviews);
    return peerResult.authenticRating;
  });
  
  const peerGroupAverage = peerRatings.reduce((sum, rating) => sum + rating, 0) / peerRatings.length;
  
  let relativePerformance: 'above_average' | 'average' | 'below_average';
  const difference = authenticRating - peerGroupAverage;
  
  if (difference > 0.3) relativePerformance = 'above_average';
  else if (difference < -0.3) relativePerformance = 'below_average';
  else relativePerformance = 'average';
  
  return {
    peerGroupAverage,
    relativePerformance
  };
}

/**
 * Create empty rating result for restaurants with no reviews
 */
function createEmptyRatingResult(restaurantId: string): AuthenticRatingResult {
  return {
    restaurantId,
    authenticRating: 3,
    traditionalRating: 0,
    negativeWeightedScore: 0,
    temporalTrend: 'stable',
    confidenceLevel: 0,
    ratingBreakdown: {
      positiveReviewsWeight: 0,
      negativeReviewsWeight: 0,
      authenticityAdjustment: 0,
      temporalAdjustment: 0
    },
    comparisonMetrics: {
      peerGroupAverage: 3.5,
      relativePerformance: 'average'
    }
  };
}

/**
 * Compare restaurants using authentic rating system
 */
export function compareRestaurantsByAuthenticRating(
  restaurants: Array<{ id: string; reviews: Review[] }>,
  peerGroupReviews?: Review[][]
): Array<{ id: string; result: AuthenticRatingResult }> {
  const results = restaurants.map(restaurant => ({
    id: restaurant.id,
    result: calculateAuthenticRating(restaurant.id, restaurant.reviews, peerGroupReviews)
  }));
  
  // Sort by authentic rating (descending)
  return results.sort((a, b) => b.result.authenticRating - a.result.authenticRating);
}

/**
 * Generate rating explanation for transparency
 */
export function generateRatingExplanation(result: AuthenticRatingResult): string[] {
  const explanations: string[] = [];
  
  const ratingDiff = result.authenticRating - result.traditionalRating;
  
  if (Math.abs(ratingDiff) > 0.3) {
    if (ratingDiff > 0) {
      explanations.push(`Rating adjusted upward (+${ratingDiff.toFixed(1)}) due to high authenticity of reviews`);
    } else {
      explanations.push(`Rating adjusted downward (${ratingDiff.toFixed(1)}) due to authentic negative feedback`);
    }
  }
  
  if (result.negativeWeightedScore > 50) {
    explanations.push(`Significant negative feedback detected (${result.negativeWeightedScore.toFixed(0)}% negative score)`);
  }
  
  if (result.temporalTrend === 'declining') {
    explanations.push('Recent reviews show declining quality trends');
  } else if (result.temporalTrend === 'improving') {
    explanations.push('Recent reviews show improving quality trends');
  }
  
  if (result.confidenceLevel < 50) {
    explanations.push('Rating confidence is low due to limited authentic review data');
  } else if (result.confidenceLevel > 80) {
    explanations.push('High confidence rating based on substantial authentic review data');
  }
  
  if (result.comparisonMetrics.relativePerformance === 'above_average') {
    explanations.push('Performs above average compared to similar restaurants');
  } else if (result.comparisonMetrics.relativePerformance === 'below_average') {
    explanations.push('Performs below average compared to similar restaurants');
  }
  
  return explanations;
}