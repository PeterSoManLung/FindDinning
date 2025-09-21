import {
  calculateAuthenticRating,
  compareRestaurantsByAuthenticRating,
  generateRatingExplanation
} from '../services/authenticRatingCalculation';
import { Review, NegativeFeedbackCategory } from '../../../shared/src/types/review.types';

describe('Authentic Rating Calculation', () => {
  const createMockReview = (
    rating: number,
    content: string,
    authenticityScore: number = 80,
    categories: NegativeFeedbackCategory[] = [],
    createdAt: Date = new Date(),
    isVerified: boolean = true,
    photos: string[] = []
  ): Review => ({
    id: `review_${Math.random()}`,
    userId: 'user123',
    restaurantId: 'restaurant456',
    rating,
    content,
    photos,
    visitDate: new Date(),
    isVerified,
    authenticityScore,
    helpfulCount: 0,
    negativeScore: rating <= 3 ? 50 : 10,
    negativeFeedbackCategories: categories,
    sentimentAnalysis: {
      overallSentiment: rating <= 3 ? 'negative' : 'positive',
      negativeAspects: rating <= 3 ? ['service'] : [],
      positiveAspects: rating > 3 ? ['food'] : [],
      authenticityScore
    },
    source: 'internal',
    createdAt
  });

  describe('calculateAuthenticRating', () => {
    it('should calculate authentic rating for restaurant with mixed reviews', () => {
      const reviews: Review[] = [
        createMockReview(5, 'Excellent food and service', 90, [], new Date(), true, ['photo1.jpg']),
        createMockReview(4, 'Good experience overall', 85, [], new Date(), true),
        createMockReview(2, 'Service was terrible and food was cold', 80, [
          { category: 'service', severity: 5, confidence: 90 },
          { category: 'food_quality', severity: 4, confidence: 85 }
        ], new Date(), true, ['evidence.jpg']),
        createMockReview(1, 'Worst dining experience ever', 75, [
          { category: 'service', severity: 5, confidence: 95 },
          { category: 'cleanliness', severity: 4, confidence: 80 }
        ], new Date(), true)
      ];

      const result = calculateAuthenticRating('restaurant123', reviews);

      expect(result.restaurantId).toBe('restaurant123');
      expect(result.authenticRating).toBeGreaterThan(0);
      expect(result.authenticRating).toBeLessThan(5);
      expect(result.traditionalRating).toBeCloseTo(3, 0); // (5+4+2+1)/4 = 3
      expect(result.confidenceLevel).toBeGreaterThan(50);
      expect(result.ratingBreakdown).toBeDefined();
      expect(result.comparisonMetrics).toBeDefined();
    });

    it('should prioritize negative feedback over positive reviews', () => {
      const positiveHeavyReviews: Review[] = [
        createMockReview(5, 'Great!', 60), // Low authenticity
        createMockReview(5, 'Amazing!', 55), // Low authenticity
        createMockReview(5, 'Perfect!', 50), // Low authenticity
        createMockReview(2, 'Service was terrible, food was cold, and the place was dirty. Very disappointing experience.', 90, [
          { category: 'service', severity: 5, confidence: 95 },
          { category: 'food_quality', severity: 4, confidence: 90 },
          { category: 'cleanliness', severity: 4, confidence: 85 }
        ], new Date(), true, ['evidence.jpg'])
      ];

      const result = calculateAuthenticRating('restaurant123', positiveHeavyReviews);
      const traditionalRating = (5 + 5 + 5 + 2) / 4; // 4.25

      // Authentic rating should be significantly lower than traditional due to high-quality negative feedback
      expect(result.authenticRating).toBeLessThan(traditionalRating);
      expect(result.negativeWeightedScore).toBeGreaterThan(0);
    });

    it('should handle restaurants with only positive reviews', () => {
      const positiveReviews: Review[] = [
        createMockReview(5, 'Excellent food and service, highly recommend', 90, [], new Date(), true, ['photo1.jpg']),
        createMockReview(4, 'Good experience, will come back', 85, [], new Date(), true),
        createMockReview(5, 'Outstanding quality and atmosphere', 88, [], new Date(), true, ['photo2.jpg'])
      ];

      const result = calculateAuthenticRating('restaurant123', positiveReviews);

      expect(result.authenticRating).toBeGreaterThan(4);
      expect(result.negativeWeightedScore).toBe(0);
      expect(result.temporalTrend).toBe('stable');
    });

    it('should handle restaurants with only negative reviews', () => {
      const negativeReviews: Review[] = [
        createMockReview(1, 'Terrible service and food quality', 85, [
          { category: 'service', severity: 5, confidence: 90 },
          { category: 'food_quality', severity: 5, confidence: 95 }
        ], new Date(), true, ['evidence.jpg']),
        createMockReview(2, 'Poor experience, would not recommend', 80, [
          { category: 'service', severity: 4, confidence: 85 }
        ], new Date(), true)
      ];

      const result = calculateAuthenticRating('restaurant123', negativeReviews);

      expect(result.authenticRating).toBeLessThan(3);
      expect(result.negativeWeightedScore).toBeGreaterThan(50);
      expect(result.ratingBreakdown.negativeReviewsWeight).toBeGreaterThan(0);
    });

    it('should handle empty review list', () => {
      const result = calculateAuthenticRating('restaurant123', []);

      expect(result.authenticRating).toBe(3);
      expect(result.traditionalRating).toBe(0);
      expect(result.confidenceLevel).toBe(0);
      expect(result.temporalTrend).toBe('stable');
    });

    it('should handle temporal analysis', () => {
      const oldDate = new Date();
      oldDate.setMonth(oldDate.getMonth() - 6);
      
      const recentDate = new Date();
      recentDate.setMonth(recentDate.getMonth() - 1);

      const temporalReviews: Review[] = [
        // Old positive reviews
        createMockReview(5, 'Great experience', 85, [], oldDate, true),
        createMockReview(4, 'Good food', 80, [], oldDate, true),
        // Recent negative reviews
        createMockReview(2, 'Service has declined significantly', 85, [
          { category: 'service', severity: 4, confidence: 90 }
        ], recentDate, true),
        createMockReview(1, 'Quality is much worse now', 80, [
          { category: 'food_quality', severity: 5, confidence: 95 }
        ], new Date(), true)
      ];

      const result = calculateAuthenticRating('restaurant123', temporalReviews);

      // Should handle temporal data and produce valid results
      expect(result.temporalTrend).toMatch(/improving|declining|stable/);
      expect(typeof result.ratingBreakdown.temporalAdjustment).toBe('number');
      expect(result.authenticRating).toBeGreaterThan(0);
      expect(result.authenticRating).toBeLessThan(5);
    });

    it('should calculate higher confidence for verified reviews with photos', () => {
      const highConfidenceReviews: Review[] = [
        createMockReview(4, 'Detailed review with specific observations about the food quality and service', 90, [], new Date(), true, ['photo1.jpg', 'photo2.jpg']),
        createMockReview(3, 'Mixed experience with some good points and areas for improvement', 85, [], new Date(), true, ['photo3.jpg']),
        createMockReview(5, 'Exceptional dining experience with outstanding attention to detail', 95, [], new Date(), true, ['photo4.jpg'])
      ];

      const lowConfidenceReviews: Review[] = [
        createMockReview(4, 'Good', 40, [], new Date(), false),
        createMockReview(3, 'OK', 35, [], new Date(), false),
        createMockReview(5, 'Great', 45, [], new Date(), false)
      ];

      const highResult = calculateAuthenticRating('restaurant1', highConfidenceReviews);
      const lowResult = calculateAuthenticRating('restaurant2', lowConfidenceReviews);

      expect(highResult.confidenceLevel).toBeGreaterThan(lowResult.confidenceLevel);
    });

    it('should apply authenticity adjustments correctly', () => {
      const highAuthenticityReviews: Review[] = [
        createMockReview(4, 'Detailed authentic review', 95, [], new Date(), true, ['photo.jpg']),
        createMockReview(3, 'Honest balanced review', 90, [], new Date(), true)
      ];

      const lowAuthenticityReviews: Review[] = [
        createMockReview(4, 'Promotional content', 30, [], new Date(), false),
        createMockReview(3, 'Generic review', 25, [], new Date(), false)
      ];

      const highResult = calculateAuthenticRating('restaurant1', highAuthenticityReviews);
      const lowResult = calculateAuthenticRating('restaurant2', lowAuthenticityReviews);

      expect(highResult.ratingBreakdown.authenticityAdjustment).toBeGreaterThan(
        lowResult.ratingBreakdown.authenticityAdjustment
      );
    });

    it('should weight critical categories more heavily', () => {
      const criticalIssuesReviews: Review[] = [
        createMockReview(1, 'Food quality and cleanliness issues', 85, [
          { category: 'food_quality', severity: 5, confidence: 95 },
          { category: 'cleanliness', severity: 5, confidence: 90 }
        ], new Date(), true, ['evidence.jpg']),
        createMockReview(2, 'More food quality problems', 80, [
          { category: 'food_quality', severity: 4, confidence: 85 }
        ], new Date(), true)
      ];

      const nonCriticalIssuesReviews: Review[] = [
        createMockReview(2, 'Atmosphere and wait time issues', 85, [
          { category: 'atmosphere', severity: 5, confidence: 95 },
          { category: 'wait_time', severity: 5, confidence: 90 }
        ], new Date(), true, ['evidence.jpg']),
        createMockReview(3, 'More atmosphere problems', 80, [
          { category: 'atmosphere', severity: 4, confidence: 85 }
        ], new Date(), true)
      ];

      const criticalResult = calculateAuthenticRating('restaurant1', criticalIssuesReviews);
      const nonCriticalResult = calculateAuthenticRating('restaurant2', nonCriticalIssuesReviews);

      expect(criticalResult.authenticRating).toBeLessThan(nonCriticalResult.authenticRating);
    });
  });

  describe('compareRestaurantsByAuthenticRating', () => {
    it('should rank restaurants by authentic rating', () => {
      const restaurants = [
        {
          id: 'restaurant1',
          reviews: [
            createMockReview(5, 'Excellent', 90, [], new Date(), true, ['photo.jpg']),
            createMockReview(4, 'Good', 85, [], new Date(), true)
          ]
        },
        {
          id: 'restaurant2',
          reviews: [
            createMockReview(2, 'Poor service and food quality', 85, [
              { category: 'service', severity: 5, confidence: 90 },
              { category: 'food_quality', severity: 4, confidence: 85 }
            ], new Date(), true, ['evidence.jpg'])
          ]
        },
        {
          id: 'restaurant3',
          reviews: [
            createMockReview(4, 'Decent experience', 80, [], new Date(), true),
            createMockReview(3, 'Average', 75, [], new Date(), true)
          ]
        }
      ];

      const results = compareRestaurantsByAuthenticRating(restaurants);

      expect(results).toHaveLength(3);
      expect(results[0].result.authenticRating).toBeGreaterThanOrEqual(results[1].result.authenticRating);
      expect(results[1].result.authenticRating).toBeGreaterThanOrEqual(results[2].result.authenticRating);
      
      // Restaurant with excellent reviews should rank highest
      expect(results[0].id).toBe('restaurant1');
      
      // Restaurant with poor authentic negative feedback should rank lowest
      expect(results[2].id).toBe('restaurant2');
    });

    it('should handle peer group comparison', () => {
      const restaurants = [
        {
          id: 'restaurant1',
          reviews: [createMockReview(4, 'Good', 80, [], new Date(), true)]
        }
      ];

      const peerGroupReviews = [
        [createMockReview(3, 'Average', 75, [], new Date(), true)],
        [createMockReview(3.5, 'OK', 70, [], new Date(), true)]
      ];

      const results = compareRestaurantsByAuthenticRating(restaurants, peerGroupReviews);

      expect(results[0].result.comparisonMetrics.relativePerformance).toBe('above_average');
    });
  });

  describe('generateRatingExplanation', () => {
    it('should generate explanations for rating adjustments', () => {
      const result = {
        restaurantId: 'restaurant123',
        authenticRating: 3.2,
        traditionalRating: 4.0,
        negativeWeightedScore: 65,
        temporalTrend: 'declining' as const,
        confidenceLevel: 85,
        ratingBreakdown: {
          positiveReviewsWeight: 4.2,
          negativeReviewsWeight: 2.1,
          authenticityAdjustment: -0.1,
          temporalAdjustment: -0.2
        },
        comparisonMetrics: {
          peerGroupAverage: 3.5,
          relativePerformance: 'below_average' as const
        }
      };

      const explanations = generateRatingExplanation(result);

      expect(explanations.length).toBeGreaterThan(0);
      expect(explanations.some(exp => exp.includes('adjusted downward'))).toBe(true);
      expect(explanations.some(exp => exp.includes('negative feedback'))).toBe(true);
      expect(explanations.some(exp => exp.includes('declining'))).toBe(true);
      expect(explanations.some(exp => exp.includes('below average'))).toBe(true);
    });

    it('should generate positive explanations for high-quality restaurants', () => {
      const result = {
        restaurantId: 'restaurant123',
        authenticRating: 4.6,
        traditionalRating: 4.2,
        negativeWeightedScore: 15,
        temporalTrend: 'improving' as const,
        confidenceLevel: 92,
        ratingBreakdown: {
          positiveReviewsWeight: 4.5,
          negativeReviewsWeight: 0,
          authenticityAdjustment: 0.2,
          temporalAdjustment: 0.1
        },
        comparisonMetrics: {
          peerGroupAverage: 3.8,
          relativePerformance: 'above_average' as const
        }
      };

      const explanations = generateRatingExplanation(result);

      expect(explanations.some(exp => exp.includes('adjusted upward'))).toBe(true);
      expect(explanations.some(exp => exp.includes('improving'))).toBe(true);
      expect(explanations.some(exp => exp.includes('High confidence'))).toBe(true);
      expect(explanations.some(exp => exp.includes('above average'))).toBe(true);
    });

    it('should handle low confidence scenarios', () => {
      const result = {
        restaurantId: 'restaurant123',
        authenticRating: 3.5,
        traditionalRating: 3.5,
        negativeWeightedScore: 25,
        temporalTrend: 'stable' as const,
        confidenceLevel: 35,
        ratingBreakdown: {
          positiveReviewsWeight: 3.5,
          negativeReviewsWeight: 0,
          authenticityAdjustment: 0,
          temporalAdjustment: 0
        },
        comparisonMetrics: {
          peerGroupAverage: 3.5,
          relativePerformance: 'average' as const
        }
      };

      const explanations = generateRatingExplanation(result);

      expect(explanations.some(exp => exp.includes('confidence is low'))).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle restaurants with single review', () => {
      const singleReview = [
        createMockReview(4, 'Good experience', 80, [], new Date(), true)
      ];

      const result = calculateAuthenticRating('restaurant123', singleReview);

      expect(result.authenticRating).toBeGreaterThan(0);
      expect(result.authenticRating).toBeLessThan(5);
      expect(result.confidenceLevel).toBeLessThan(70); // Lower confidence due to single review
    });

    it('should handle reviews with extreme authenticity scores', () => {
      const extremeReviews = [
        createMockReview(5, 'Fake positive review', 5, [], new Date(), false), // Very low authenticity
        createMockReview(1, 'Detailed authentic negative review with specific issues', 95, [
          { category: 'service', severity: 5, confidence: 95 }
        ], new Date(), true, ['evidence.jpg']) // Very high authenticity
      ];

      const result = calculateAuthenticRating('restaurant123', extremeReviews);

      // Should heavily favor the authentic negative review
      expect(result.authenticRating).toBeLessThan(2.5);
      expect(result.ratingBreakdown.authenticityAdjustment).toBeGreaterThan(-0.5);
    });

    it('should handle reviews spanning long time periods', () => {
      const veryOldDate = new Date();
      veryOldDate.setFullYear(veryOldDate.getFullYear() - 2);
      
      const oldDate = new Date();
      oldDate.setMonth(oldDate.getMonth() - 8);
      
      const longTermReviews = [
        createMockReview(5, 'Great back then', 80, [], veryOldDate, true),
        createMockReview(4, 'Still good', 85, [], oldDate, true),
        createMockReview(2, 'Recent decline', 90, [
          { category: 'service', severity: 4, confidence: 85 }
        ], new Date(), true),
        createMockReview(1, 'Much worse now', 85, [
          { category: 'food_quality', severity: 5, confidence: 90 }
        ], new Date(), true)
      ];

      const result = calculateAuthenticRating('restaurant123', longTermReviews);

      // Should handle long-term data and produce valid results
      expect(result.temporalTrend).toMatch(/improving|declining|stable/);
      expect(result.authenticRating).toBeGreaterThan(0);
      expect(result.authenticRating).toBeLessThan(5);
      expect(result.confidenceLevel).toBeGreaterThan(0);
    });
  });
});