import {
  analyzeNegativeFeedbackPatterns,
  calculateRestaurantNegativeScore,
  detectFakeNegativeReviews,
  reRankRestaurantsByNegativeFeedback,
  generateNegativeFeedbackReport
} from '../services/negativeFeedbackAnalysis';
import { Review, NegativeFeedbackCategory } from '../../../shared/src/types/review.types';

describe('Negative Feedback Analysis', () => {
  const createMockReview = (
    rating: number,
    content: string,
    categories: NegativeFeedbackCategory[],
    createdAt: Date = new Date(),
    authenticityScore: number = 80
  ): Review => ({
    id: `review_${Math.random()}`,
    userId: 'user123',
    restaurantId: 'restaurant456',
    rating,
    content,
    photos: [],
    visitDate: new Date(),
    isVerified: true,
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

  describe('analyzeNegativeFeedbackPatterns', () => {
    it('should analyze patterns from multiple reviews', () => {
      const reviews: Review[] = [
        createMockReview(2, 'Terrible service, very rude staff', [
          { category: 'service', severity: 5, confidence: 90 }
        ], new Date('2024-01-15')),
        createMockReview(1, 'Food was cold and tasteless', [
          { category: 'food_quality', severity: 4, confidence: 85 }
        ], new Date('2024-01-10')),
        createMockReview(2, 'Slow service again, waited forever', [
          { category: 'service', severity: 4, confidence: 80 }
        ], new Date('2024-01-05')),
      ];

      const patterns = analyzeNegativeFeedbackPatterns(reviews, 6);

      expect(patterns.length).toBeGreaterThan(0);
      
      const servicePattern = patterns.find(p => p.category === 'service');
      expect(servicePattern).toBeDefined();
      expect(servicePattern?.frequency).toBeGreaterThan(0);
      expect(servicePattern?.totalIncidents).toBe(2);
      
      const foodPattern = patterns.find(p => p.category === 'food_quality');
      expect(foodPattern).toBeDefined();
      expect(foodPattern?.totalIncidents).toBe(1);
    });

    it('should calculate trends correctly', () => {
      const oldDate = new Date();
      oldDate.setMonth(oldDate.getMonth() - 5);
      
      const recentDate = new Date();
      recentDate.setMonth(recentDate.getMonth() - 1);

      const reviews: Review[] = [
        // Old incidents (fewer)
        createMockReview(2, 'Bad service', [
          { category: 'service', severity: 3, confidence: 80 }
        ], oldDate),
        // Recent incidents (much more frequent)
        createMockReview(1, 'Terrible service', [
          { category: 'service', severity: 5, confidence: 90 }
        ], recentDate),
        createMockReview(2, 'Poor service again', [
          { category: 'service', severity: 4, confidence: 85 }
        ], new Date()),
        createMockReview(1, 'Awful service', [
          { category: 'service', severity: 5, confidence: 90 }
        ], new Date()),
        createMockReview(2, 'Bad service continues', [
          { category: 'service', severity: 4, confidence: 85 }
        ], new Date()),
      ];

      const patterns = analyzeNegativeFeedbackPatterns(reviews, 6);
      const servicePattern = patterns.find(p => p.category === 'service');
      
      expect(servicePattern?.trend).toBe('declining');
    });

    it('should filter out categories with no incidents', () => {
      const reviews: Review[] = [
        createMockReview(4, 'Good food, nice atmosphere', [])
      ];

      const patterns = analyzeNegativeFeedbackPatterns(reviews, 6);
      
      expect(patterns).toHaveLength(0);
    });
  });

  describe('calculateRestaurantNegativeScore', () => {
    it('should calculate higher scores for frequent severe issues', () => {
      const reviews: Review[] = [
        createMockReview(1, 'Terrible food', [
          { category: 'food_quality', severity: 5, confidence: 95 }
        ]),
        createMockReview(2, 'Bad service', [
          { category: 'service', severity: 4, confidence: 90 }
        ])
      ];

      const patterns = analyzeNegativeFeedbackPatterns(reviews, 6);
      const score = calculateRestaurantNegativeScore(reviews, patterns);

      expect(score.overallNegativeScore).toBeGreaterThan(30);
      expect(score.riskLevel).not.toBe('low');
      expect(score.primaryIssues.length).toBeGreaterThan(0);
    });

    it('should penalize critical categories more heavily', () => {
      const foodQualityReviews: Review[] = [
        createMockReview(1, 'Terrible food quality', [
          { category: 'food_quality', severity: 5, confidence: 95 }
        ])
      ];

      const atmosphereReviews: Review[] = [
        createMockReview(2, 'Noisy atmosphere', [
          { category: 'atmosphere', severity: 5, confidence: 95 }
        ])
      ];

      const foodPatterns = analyzeNegativeFeedbackPatterns(foodQualityReviews, 6);
      const atmospherePatterns = analyzeNegativeFeedbackPatterns(atmosphereReviews, 6);

      const foodScore = calculateRestaurantNegativeScore(foodQualityReviews, foodPatterns);
      const atmosphereScore = calculateRestaurantNegativeScore(atmosphereReviews, atmospherePatterns);

      expect(foodScore.overallNegativeScore).toBeGreaterThan(atmosphereScore.overallNegativeScore);
    });

    it('should adjust scores based on trends', () => {
      const decliningReviews: Review[] = [
        createMockReview(2, 'Service getting worse', [
          { category: 'service', severity: 4, confidence: 90 }
        ])
      ];

      const patterns = analyzeNegativeFeedbackPatterns(decliningReviews, 6);
      // Manually set trend to declining for test
      patterns.forEach(p => { p.trend = 'declining'; });

      const improvingPatterns = patterns.map(p => ({ ...p, trend: 'improving' as const }));

      const decliningScore = calculateRestaurantNegativeScore(decliningReviews, patterns);
      const improvingScore = calculateRestaurantNegativeScore(decliningReviews, improvingPatterns);

      expect(decliningScore.overallNegativeScore).toBeGreaterThan(improvingScore.overallNegativeScore);
    });

    it('should determine correct risk levels', () => {
      const lowRiskReviews: Review[] = [
        createMockReview(5, 'Great experience', [])
      ];

      const highRiskReviews: Review[] = [
        createMockReview(1, 'Multiple severe issues', [
          { category: 'food_quality', severity: 5, confidence: 95 },
          { category: 'service', severity: 5, confidence: 90 },
          { category: 'cleanliness', severity: 5, confidence: 85 }
        ]),
        createMockReview(1, 'More severe issues', [
          { category: 'food_quality', severity: 5, confidence: 95 },
          { category: 'service', severity: 5, confidence: 90 }
        ]),
        createMockReview(2, 'Still bad', [
          { category: 'food_quality', severity: 4, confidence: 85 }
        ])
      ];

      const lowPatterns = analyzeNegativeFeedbackPatterns(lowRiskReviews, 6);
      const highPatterns = analyzeNegativeFeedbackPatterns(highRiskReviews, 6);

      const lowScore = calculateRestaurantNegativeScore(lowRiskReviews, lowPatterns);
      const highScore = calculateRestaurantNegativeScore(highRiskReviews, highPatterns);

      expect(lowScore.riskLevel).toBe('low');
      expect(highScore.riskLevel).toMatch(/high|critical/);
    });
  });

  describe('detectFakeNegativeReviews', () => {
    it('should detect extremely short negative reviews', () => {
      const reviews: Review[] = [
        createMockReview(1, 'Bad', [], new Date(), 20),
        createMockReview(2, 'Terrible', [], new Date(), 25),
        createMockReview(4, 'Had a wonderful experience with great food and excellent service', [], new Date(), 85)
      ];

      const result = detectFakeNegativeReviews(reviews);

      expect(result.suspiciousReviews.length).toBeGreaterThan(0);
      expect(result.authenticReviews.length).toBeGreaterThan(0);
      expect(result.fakeIndicators).toBeDefined();
    });

    it('should detect generic negative language without specifics', () => {
      const reviews: Review[] = [
        createMockReview(1, 'Terrible awful worst place ever', [], new Date(), 30),
        createMockReview(2, 'The service was slow and the food was cold. The waiter seemed overwhelmed and our order took 45 minutes to arrive.', [
          { category: 'service', severity: 4, confidence: 85 }
        ], new Date(), 75)
      ];

      const result = detectFakeNegativeReviews(reviews);

      const suspiciousIds = result.suspiciousReviews.map(r => r.id);
      const authenticIds = result.authenticReviews.map(r => r.id);

      expect(suspiciousIds).toContain(reviews[0].id);
      expect(authenticIds).toContain(reviews[1].id);
    });

    it('should detect multiple negative reviews in short period', () => {
      const baseDate = new Date();
      const reviews: Review[] = [
        createMockReview(1, 'Bad experience', [], baseDate, 40),
        createMockReview(2, 'Terrible service', [], new Date(baseDate.getTime() + 2 * 60 * 60 * 1000), 35), // 2 hours later
        createMockReview(1, 'Awful food', [], new Date(baseDate.getTime() + 4 * 60 * 60 * 1000), 30), // 4 hours later
      ];

      const result = detectFakeNegativeReviews(reviews);

      expect(result.suspiciousReviews.length).toBeGreaterThan(0);
      expect(Object.keys(result.fakeIndicators).length).toBeGreaterThan(0);
    });

    it('should flag low authenticity scores', () => {
      const reviews: Review[] = [
        createMockReview(1, 'This restaurant is bad and I hate it', [], new Date(), 25),
        createMockReview(4, 'Great experience with detailed description of the food and service', [], new Date(), 85)
      ];

      const result = detectFakeNegativeReviews(reviews);

      expect(result.suspiciousReviews.some(r => r.authenticityScore < 30)).toBe(true);
      expect(result.authenticReviews.some(r => r.authenticityScore > 80)).toBe(true);
    });
  });

  describe('reRankRestaurantsByNegativeFeedback', () => {
    it('should adjust ratings based on negative scores', () => {
      const restaurants = [
        { id: 'restaurant1', currentRating: 4.5, reviewCount: 100 },
        { id: 'restaurant2', currentRating: 4.2, reviewCount: 80 },
        { id: 'restaurant3', currentRating: 4.0, reviewCount: 60 }
      ];

      const negativeScores = new Map([
        ['restaurant1', {
          restaurantId: 'restaurant1',
          overallNegativeScore: 80,
          categoryScores: {
            service: 70,
            food_quality: 60,
            cleanliness: 90,
            value: 40,
            atmosphere: 30,
            wait_time: 50
          },
          riskLevel: 'high' as const,
          primaryIssues: ['cleanliness', 'service'],
          recommendationImpact: 85
        }],
        ['restaurant2', {
          restaurantId: 'restaurant2',
          overallNegativeScore: 20,
          categoryScores: {
            service: 10,
            food_quality: 15,
            cleanliness: 5,
            value: 25,
            atmosphere: 20,
            wait_time: 30
          },
          riskLevel: 'low' as const,
          primaryIssues: [],
          recommendationImpact: 20
        }]
      ]);

      const reranked = reRankRestaurantsByNegativeFeedback(restaurants, negativeScores);

      // Restaurant with high negative score should be ranked lower
      const restaurant1 = reranked.find(r => r.id === 'restaurant1');
      const restaurant2 = reranked.find(r => r.id === 'restaurant2');

      expect(restaurant1?.adjustedRating).toBeLessThan(4.5);
      expect(restaurant2?.adjustedRating).toBeCloseTo(4.2, 1);
      
      // Should be sorted by adjusted rating
      expect(reranked[0].adjustedRating).toBeGreaterThanOrEqual(reranked[1].adjustedRating);
    });

    it('should handle restaurants without negative scores', () => {
      const restaurants = [
        { id: 'restaurant1', currentRating: 4.5, reviewCount: 100 }
      ];

      const negativeScores = new Map();

      const reranked = reRankRestaurantsByNegativeFeedback(restaurants, negativeScores);

      expect(reranked[0].adjustedRating).toBe(4.5);
      expect(reranked[0].negativeImpact).toBe(0);
      expect(reranked[0].riskLevel).toBe('low');
    });

    it('should apply different penalties based on risk level', () => {
      const restaurants = [
        { id: 'critical', currentRating: 4.0, reviewCount: 100 },
        { id: 'high', currentRating: 4.0, reviewCount: 100 },
        { id: 'medium', currentRating: 4.0, reviewCount: 100 },
        { id: 'low', currentRating: 4.0, reviewCount: 100 }
      ];

      const negativeScores = new Map([
        ['critical', { restaurantId: 'critical', overallNegativeScore: 90, categoryScores: {} as any, riskLevel: 'critical' as const, primaryIssues: [], recommendationImpact: 90 }],
        ['high', { restaurantId: 'high', overallNegativeScore: 70, categoryScores: {} as any, riskLevel: 'high' as const, primaryIssues: [], recommendationImpact: 70 }],
        ['medium', { restaurantId: 'medium', overallNegativeScore: 40, categoryScores: {} as any, riskLevel: 'medium' as const, primaryIssues: [], recommendationImpact: 40 }],
        ['low', { restaurantId: 'low', overallNegativeScore: 10, categoryScores: {} as any, riskLevel: 'low' as const, primaryIssues: [], recommendationImpact: 10 }]
      ]);

      const reranked = reRankRestaurantsByNegativeFeedback(restaurants, negativeScores);

      const criticalRating = reranked.find(r => r.id === 'critical')?.adjustedRating || 0;
      const highRating = reranked.find(r => r.id === 'high')?.adjustedRating || 0;
      const mediumRating = reranked.find(r => r.id === 'medium')?.adjustedRating || 0;
      const lowRating = reranked.find(r => r.id === 'low')?.adjustedRating || 0;

      expect(criticalRating).toBeLessThan(highRating);
      expect(highRating).toBeLessThan(mediumRating);
      expect(mediumRating).toBeLessThan(lowRating);
    });
  });

  describe('generateNegativeFeedbackReport', () => {
    it('should generate comprehensive analysis report', () => {
      const reviews: Review[] = [
        createMockReview(2, 'Service was terrible and food was cold', [
          { category: 'service', severity: 5, confidence: 90 },
          { category: 'food_quality', severity: 4, confidence: 85 }
        ], new Date('2024-01-15')),
        createMockReview(1, 'Dirty restaurant with rude staff', [
          { category: 'cleanliness', severity: 5, confidence: 95 },
          { category: 'service', severity: 4, confidence: 80 }
        ], new Date('2024-01-10'))
      ];

      const report = generateNegativeFeedbackReport('restaurant456', reviews, 6);

      expect(report.restaurantId).toBe('restaurant456');
      expect(report.overallNegativeScore).toBeGreaterThan(0);
      expect(report.categoryBreakdown.length).toBeGreaterThan(0);
      expect(report.trends.length).toBeGreaterThanOrEqual(0);
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.analysisDate).toBeInstanceOf(Date);

      // Check category breakdown
      const serviceCategory = report.categoryBreakdown.find(c => c.category === 'service');
      expect(serviceCategory).toBeDefined();
      expect(serviceCategory?.commonIssues.length).toBeGreaterThanOrEqual(0);
    });

    it('should include appropriate recommendations based on issues', () => {
      const reviews: Review[] = [
        createMockReview(1, 'Food quality is terrible, always cold and tasteless', [
          { category: 'food_quality', severity: 5, confidence: 95 }
        ])
      ];

      const report = generateNegativeFeedbackReport('restaurant456', reviews, 6);

      expect(report.recommendations.some(r => 
        r.includes('food quality') || r.includes('quality concerns')
      )).toBe(true);
    });

    it('should handle restaurants with no negative feedback', () => {
      const reviews: Review[] = [
        createMockReview(5, 'Excellent food and service', [])
      ];

      const report = generateNegativeFeedbackReport('restaurant456', reviews, 6);

      expect(report.overallNegativeScore).toBe(0);
      expect(report.categoryBreakdown).toHaveLength(0);
      expect(report.recommendations).toContain('Restaurant shows good negative feedback patterns');
    });
  });
});