import { Review, NegativeFeedbackCategory, NegativeFeedbackAnalysisResult, CategoryAnalysis, TrendAnalysis } from '../../../shared/src/types/review.types';

export interface NegativeFeedbackPattern {
  category: NegativeFeedbackCategory['category'];
  frequency: number;
  averageSeverity: number;
  trend: 'improving' | 'declining' | 'stable';
  recentIncidents: number;
  totalIncidents: number;
}

export interface RestaurantNegativeScore {
  restaurantId: string;
  overallNegativeScore: number;
  categoryScores: Record<NegativeFeedbackCategory['category'], number>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  primaryIssues: string[];
  recommendationImpact: number; // 0-100, how much this should affect recommendations
}

/**
 * Analyze negative feedback patterns for a restaurant
 */
export function analyzeNegativeFeedbackPatterns(
  reviews: Review[],
  timeframeMonths: number = 6
): NegativeFeedbackPattern[] {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - timeframeMonths);
  
  const recentReviews = reviews.filter(review => 
    new Date(review.createdAt) >= cutoffDate
  );
  
  const categoryMap = new Map<NegativeFeedbackCategory['category'], {
    incidents: number[];
    severities: number[];
    recentCount: number;
    totalCount: number;
  }>();
  
  // Initialize categories
  const categories: NegativeFeedbackCategory['category'][] = [
    'service', 'food_quality', 'cleanliness', 'value', 'atmosphere', 'wait_time'
  ];
  
  categories.forEach(category => {
    categoryMap.set(category, {
      incidents: [],
      severities: [],
      recentCount: 0,
      totalCount: 0
    });
  });
  
  // Analyze all reviews
  reviews.forEach(review => {
    review.negativeFeedbackCategories.forEach(category => {
      const data = categoryMap.get(category.category);
      if (data) {
        data.incidents.push(new Date(review.createdAt).getTime());
        data.severities.push(category.severity);
        data.totalCount++;
        
        if (new Date(review.createdAt) >= cutoffDate) {
          data.recentCount++;
        }
      }
    });
  });
  
  // Calculate patterns
  const patterns: NegativeFeedbackPattern[] = [];
  
  categoryMap.forEach((data, category) => {
    if (data.totalCount === 0) return;
    
    const frequency = data.totalCount / Math.max(reviews.length, 1);
    const averageSeverity = data.severities.reduce((sum, s) => sum + s, 0) / data.severities.length;
    
    // Calculate trend
    const trend = calculateTrend(data.incidents, timeframeMonths);
    
    patterns.push({
      category,
      frequency,
      averageSeverity,
      trend,
      recentIncidents: data.recentCount,
      totalIncidents: data.totalCount
    });
  });
  
  return patterns.filter(pattern => pattern.totalIncidents > 0);
}

/**
 * Calculate trend direction for incidents over time
 */
function calculateTrend(
  incidents: number[],
  timeframeMonths: number
): 'improving' | 'declining' | 'stable' {
  if (incidents.length < 4) return 'stable';
  
  const now = Date.now();
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  const halfTimeframe = (timeframeMonths * monthMs) / 2;
  
  const recentIncidents = incidents.filter(time => 
    now - time <= halfTimeframe
  ).length;
  
  const olderIncidents = incidents.filter(time => 
    now - time > halfTimeframe && now - time <= timeframeMonths * monthMs
  ).length;
  
  const recentRate = recentIncidents / (timeframeMonths / 2);
  const olderRate = olderIncidents / (timeframeMonths / 2);
  
  const changeRatio = recentRate / Math.max(olderRate, 0.1);
  
  if (changeRatio > 1.2) return 'declining';
  if (changeRatio < 0.8) return 'improving';
  return 'stable';
}

/**
 * Calculate restaurant's overall negative score
 */
export function calculateRestaurantNegativeScore(
  reviews: Review[],
  patterns: NegativeFeedbackPattern[]
): RestaurantNegativeScore {
  const restaurantId = reviews[0]?.restaurantId || '';
  
  // Calculate category scores
  const categoryScores: Record<NegativeFeedbackCategory['category'], number> = {
    service: 0,
    food_quality: 0,
    cleanliness: 0,
    value: 0,
    atmosphere: 0,
    wait_time: 0
  };
  
  let overallNegativeScore = 0;
  const primaryIssues: string[] = [];
  
  patterns.forEach(pattern => {
    // Base score from frequency and severity
    let categoryScore = pattern.frequency * pattern.averageSeverity * 100;
    
    // Trend adjustment
    if (pattern.trend === 'declining') {
      categoryScore *= 1.5; // Penalize worsening trends
    } else if (pattern.trend === 'improving') {
      categoryScore *= 0.7; // Reward improving trends
    }
    
    // Critical categories get higher weight
    const criticalCategories = ['food_quality', 'cleanliness'];
    if (criticalCategories.includes(pattern.category)) {
      categoryScore *= 1.3;
    }
    
    categoryScores[pattern.category] = Math.min(100, categoryScore);
    overallNegativeScore += categoryScore * 0.16; // Average across 6 categories
    
    // Identify primary issues
    if (categoryScore > 30) {
      primaryIssues.push(pattern.category.replace('_', ' '));
    }
  });
  
  overallNegativeScore = Math.min(100, overallNegativeScore);
  
  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high' | 'critical';
  if (overallNegativeScore >= 80) riskLevel = 'critical';
  else if (overallNegativeScore >= 60) riskLevel = 'high';
  else if (overallNegativeScore >= 30) riskLevel = 'medium';
  else riskLevel = 'low';
  
  // Calculate recommendation impact (inverse of quality)
  const recommendationImpact = Math.min(100, overallNegativeScore * 1.2);
  
  return {
    restaurantId,
    overallNegativeScore,
    categoryScores,
    riskLevel,
    primaryIssues,
    recommendationImpact
  };
}

/**
 * Detect and filter fake negative reviews
 */
export function detectFakeNegativeReviews(reviews: Review[]): {
  authenticReviews: Review[];
  suspiciousReviews: Review[];
  fakeIndicators: Record<string, string[]>;
} {
  const authenticReviews: Review[] = [];
  const suspiciousReviews: Review[] = [];
  const fakeIndicators: Record<string, string[]> = {};
  
  reviews.forEach(review => {
    const indicators: string[] = [];
    
    // Check for competitor attack patterns
    if (review.rating <= 2) {
      // Very short negative reviews
      if (review.content.length < 30) {
        indicators.push('Extremely short negative review');
      }
      
      // Generic negative language without specifics
      const genericNegativePatterns = [
        /terrible|awful|worst|horrible/i,
        /never.*again|waste.*money|avoid.*place/i
      ];
      
      const hasGenericLanguage = genericNegativePatterns.some(pattern => 
        pattern.test(review.content)
      );
      
      const hasSpecificDetails = review.negativeFeedbackCategories.length > 0 ||
                                review.content.length > 100;
      
      if (hasGenericLanguage && !hasSpecificDetails) {
        indicators.push('Generic negative language without specific details');
      }
      
      // Check for suspicious timing (multiple negative reviews in short period)
      const sameTimeReviews = reviews.filter(r => 
        r.id !== review.id &&
        Math.abs(new Date(r.createdAt).getTime() - new Date(review.createdAt).getTime()) < 24 * 60 * 60 * 1000 &&
        r.rating <= 2
      );
      
      if (sameTimeReviews.length >= 2) {
        indicators.push('Multiple negative reviews in 24-hour period');
      }
      
      // Check for new user with only negative reviews
      if (!review.isVerified && review.source === 'internal') {
        indicators.push('Unverified user with negative review');
      }
    }
    
    // Check authenticity score
    if (review.authenticityScore < 30) {
      indicators.push('Low authenticity score');
    }
    
    // Determine if review is suspicious
    if (indicators.length >= 1) {
      suspiciousReviews.push(review);
      fakeIndicators[review.id] = indicators;
    } else {
      authenticReviews.push(review);
    }
  });
  
  return {
    authenticReviews,
    suspiciousReviews,
    fakeIndicators
  };
}

/**
 * Re-rank restaurants based on negative feedback analysis
 */
export function reRankRestaurantsByNegativeFeedback(
  restaurants: Array<{ id: string; currentRating: number; reviewCount: number }>,
  negativeScores: Map<string, RestaurantNegativeScore>
): Array<{ id: string; adjustedRating: number; negativeImpact: number; riskLevel: string }> {
  return restaurants.map(restaurant => {
    const negativeScore = negativeScores.get(restaurant.id);
    
    if (!negativeScore) {
      return {
        id: restaurant.id,
        adjustedRating: restaurant.currentRating,
        negativeImpact: 0,
        riskLevel: 'low'
      };
    }
    
    // Calculate negative impact on rating
    const negativeImpact = negativeScore.overallNegativeScore / 100;
    
    // Adjust rating based on negative feedback
    // Higher negative scores reduce the rating more significantly
    let adjustedRating = restaurant.currentRating;
    
    if (negativeScore.riskLevel === 'critical') {
      adjustedRating *= 0.6; // Reduce by 40%
    } else if (negativeScore.riskLevel === 'high') {
      adjustedRating *= 0.75; // Reduce by 25%
    } else if (negativeScore.riskLevel === 'medium') {
      adjustedRating *= 0.9; // Reduce by 10%
    }
    
    // Additional penalty for declining trends
    const decliningCategories = Object.entries(negativeScore.categoryScores)
      .filter(([_, score]) => score > 40).length;
    
    if (decliningCategories >= 2) {
      adjustedRating *= 0.85;
    }
    
    return {
      id: restaurant.id,
      adjustedRating: Math.max(1, adjustedRating),
      negativeImpact,
      riskLevel: negativeScore.riskLevel
    };
  }).sort((a, b) => b.adjustedRating - a.adjustedRating);
}

/**
 * Generate negative feedback analysis report
 */
export function generateNegativeFeedbackReport(
  restaurantId: string,
  reviews: Review[],
  timeframeMonths: number = 6
): NegativeFeedbackAnalysisResult {
  const patterns = analyzeNegativeFeedbackPatterns(reviews, timeframeMonths);
  const negativeScore = calculateRestaurantNegativeScore(reviews, patterns);
  const fakeAnalysis = detectFakeNegativeReviews(reviews);
  
  // Generate category breakdown
  const categoryBreakdown: CategoryAnalysis[] = patterns.map(pattern => ({
    category: pattern.category,
    averageSeverity: pattern.averageSeverity,
    frequency: pattern.frequency,
    trend: pattern.trend,
    commonIssues: extractCommonIssues(reviews, pattern.category)
  }));
  
  // Generate trend analysis
  const trends: TrendAnalysis[] = generateTrendAnalysis(reviews, timeframeMonths);
  
  // Generate recommendations
  const recommendations = generateRecommendations(negativeScore, patterns);
  
  return {
    restaurantId,
    overallNegativeScore: negativeScore.overallNegativeScore,
    categoryBreakdown,
    trends,
    recommendations,
    analysisDate: new Date()
  };
}

/**
 * Extract common issues for a category from reviews
 */
function extractCommonIssues(
  reviews: Review[],
  category: NegativeFeedbackCategory['category']
): string[] {
  const issues: string[] = [];
  
  reviews.forEach(review => {
    const categoryFeedback = review.negativeFeedbackCategories.find(
      c => c.category === category
    );
    
    if (categoryFeedback && categoryFeedback.severity >= 3) {
      // Extract specific issues based on category
      const content = review.content.toLowerCase();
      
      switch (category) {
        case 'service':
          if (content.includes('rude')) issues.push('Rude staff');
          if (content.includes('slow')) issues.push('Slow service');
          if (content.includes('ignored')) issues.push('Customers ignored');
          break;
        case 'food_quality':
          if (content.includes('cold')) issues.push('Cold food');
          if (content.includes('overcooked')) issues.push('Overcooked dishes');
          if (content.includes('bland')) issues.push('Bland taste');
          break;
        case 'cleanliness':
          if (content.includes('dirty')) issues.push('Dirty environment');
          if (content.includes('cockroach')) issues.push('Pest issues');
          break;
        case 'value':
          if (content.includes('expensive')) issues.push('Overpriced');
          if (content.includes('small portion')) issues.push('Small portions');
          break;
        case 'atmosphere':
          if (content.includes('noisy')) issues.push('Too noisy');
          if (content.includes('crowded')) issues.push('Overcrowded');
          break;
        case 'wait_time':
          if (content.includes('long wait')) issues.push('Long waiting times');
          if (content.includes('slow kitchen')) issues.push('Slow kitchen');
          break;
      }
    }
  });
  
  // Return unique issues, sorted by frequency
  const issueCount = new Map<string, number>();
  issues.forEach(issue => {
    issueCount.set(issue, (issueCount.get(issue) || 0) + 1);
  });
  
  return Array.from(issueCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([issue]) => issue);
}

/**
 * Generate trend analysis over time periods
 */
function generateTrendAnalysis(
  reviews: Review[],
  timeframeMonths: number
): TrendAnalysis[] {
  const trends: TrendAnalysis[] = [];
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  
  for (let i = 0; i < timeframeMonths; i++) {
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() - i);
    const startDate = new Date(endDate.getTime() - monthMs);
    
    const periodReviews = reviews.filter(review => {
      const reviewDate = new Date(review.createdAt);
      return reviewDate >= startDate && reviewDate < endDate;
    });
    
    if (periodReviews.length === 0) continue;
    
    const negativeReviews = periodReviews.filter(r => r.rating <= 3);
    const negativeScore = negativeReviews.length / periodReviews.length * 100;
    
    const majorIssues = extractMajorIssues(negativeReviews);
    
    trends.push({
      period: `${startDate.getMonth() + 1}/${startDate.getFullYear()}`,
      negativeScore,
      reviewCount: periodReviews.length,
      majorIssues
    });
  }
  
  return trends.reverse(); // Chronological order
}

/**
 * Extract major issues from negative reviews
 */
function extractMajorIssues(negativeReviews: Review[]): string[] {
  const issueCount = new Map<string, number>();
  
  negativeReviews.forEach(review => {
    review.negativeFeedbackCategories.forEach(category => {
      if (category.severity >= 4) {
        const issueName = category.category.replace('_', ' ');
        issueCount.set(issueName, (issueCount.get(issueName) || 0) + 1);
      }
    });
  });
  
  return Array.from(issueCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([issue]) => issue);
}

/**
 * Generate recommendations based on negative feedback analysis
 */
function generateRecommendations(
  negativeScore: RestaurantNegativeScore,
  patterns: NegativeFeedbackPattern[]
): string[] {
  const recommendations: string[] = [];
  
  if (negativeScore.riskLevel === 'critical') {
    recommendations.push('Consider removing from recommendations until issues are resolved');
  } else if (negativeScore.riskLevel === 'high') {
    recommendations.push('Show with warning about potential issues');
  }
  
  patterns.forEach(pattern => {
    if (pattern.frequency > 0.3 && pattern.averageSeverity >= 4) {
      switch (pattern.category) {
        case 'service':
          recommendations.push('Warn users about potential service issues');
          break;
        case 'food_quality':
          recommendations.push('Highlight food quality concerns in reviews');
          break;
        case 'cleanliness':
          recommendations.push('Alert users to cleanliness issues');
          break;
        case 'value':
          recommendations.push('Note that prices may not reflect value');
          break;
        case 'atmosphere':
          recommendations.push('Mention atmosphere concerns for sensitive diners');
          break;
        case 'wait_time':
          recommendations.push('Warn about potential long wait times');
          break;
      }
    }
  });
  
  if (recommendations.length === 0) {
    recommendations.push('Restaurant shows good negative feedback patterns');
  }
  
  return recommendations;
}