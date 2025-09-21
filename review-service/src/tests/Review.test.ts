import { ReviewModel } from '../models/Review';
import { Review, NegativeFeedbackCategory, SentimentAnalysis } from '../../../shared/src/types/review.types';

describe('ReviewModel', () => {
  const mockReviewData: Partial<Review> = {
    userId: 'user123',
    restaurantId: 'restaurant456',
    rating: 4,
    content: 'Great food and excellent service. The pasta was perfectly cooked and the staff was very friendly.',
    photos: ['photo1.jpg', 'photo2.jpg'],
    visitDate: new Date('2024-01-15'),
    isVerified: true
  };

  describe('constructor', () => {
    it('should create a review with provided data', () => {
      const review = new ReviewModel(mockReviewData);
      
      expect(review.userId).toBe('user123');
      expect(review.restaurantId).toBe('restaurant456');
      expect(review.rating).toBe(4);
      expect(review.content).toBe(mockReviewData.content);
      expect(review.photos).toEqual(['photo1.jpg', 'photo2.jpg']);
      expect(review.isVerified).toBe(true);
    });

    it('should generate ID if not provided', () => {
      const review = new ReviewModel(mockReviewData);
      expect(review.id).toMatch(/^review_\d+_[a-z0-9]+$/);
    });

    it('should set default values for optional fields', () => {
      const minimalData = {
        userId: 'user123',
        restaurantId: 'restaurant456',
        rating: 3,
        content: 'Average experience'
      };
      
      const review = new ReviewModel(minimalData);
      
      expect(review.photos).toEqual([]);
      expect(review.isVerified).toBe(false);
      expect(review.authenticityScore).toBe(0);
      expect(review.helpfulCount).toBe(0);
      expect(review.negativeScore).toBe(0);
      expect(review.source).toBe('internal');
    });
  });

  describe('calculateAuthenticityScore', () => {
    it('should calculate higher score for detailed reviews', () => {
      const detailedReview = new ReviewModel({
        ...mockReviewData,
        content: 'This is a very detailed review with more than 100 characters describing the food, service, and atmosphere in great detail. The pasta was al dente, the sauce was rich and flavorful, and the waitstaff was attentive throughout our meal.',
        photos: ['photo1.jpg', 'photo2.jpg', 'photo3.jpg'],
        isVerified: true,
        rating: 4
      });
      
      const score = detailedReview.calculateAuthenticityScore();
      expect(score).toBeGreaterThan(70);
    });

    it('should calculate lower score for short reviews', () => {
      const shortReview = new ReviewModel({
        ...mockReviewData,
        content: 'Good food',
        photos: [],
        isVerified: false,
        rating: 5
      });
      
      const score = shortReview.calculateAuthenticityScore();
      expect(score).toBeLessThan(50);
    });

    it('should give bonus for verified users', () => {
      const verifiedReview = new ReviewModel({
        ...mockReviewData,
        isVerified: true
      });
      
      const unverifiedReview = new ReviewModel({
        ...mockReviewData,
        isVerified: false
      });
      
      const verifiedScore = verifiedReview.calculateAuthenticityScore();
      const unverifiedScore = unverifiedReview.calculateAuthenticityScore();
      
      expect(verifiedScore).toBeGreaterThan(unverifiedScore);
    });

    it('should give bonus for balanced ratings', () => {
      const balancedReview = new ReviewModel({
        ...mockReviewData,
        rating: 3
      });
      
      const extremeReview = new ReviewModel({
        ...mockReviewData,
        rating: 5
      });
      
      const balancedScore = balancedReview.calculateAuthenticityScore();
      const extremeScore = extremeReview.calculateAuthenticityScore();
      
      expect(balancedScore).toBeGreaterThanOrEqual(extremeScore);
    });
  });

  describe('calculateNegativeScore', () => {
    it('should calculate higher negative score for low ratings', () => {
      const negativeReview = new ReviewModel({
        ...mockReviewData,
        rating: 1,
        content: 'Terrible food and awful service',
        sentimentAnalysis: {
          overallSentiment: 'negative',
          negativeAspects: ['food quality', 'service'],
          positiveAspects: [],
          authenticityScore: 80
        },
        negativeFeedbackCategories: [
          { category: 'food_quality', severity: 5, confidence: 90 },
          { category: 'service', severity: 4, confidence: 85 }
        ]
      });
      
      negativeReview.calculateAuthenticityScore(); // Calculate authenticity first
      const negativeScore = negativeReview.calculateNegativeScore();
      
      expect(negativeScore).toBeGreaterThan(50);
    });

    it('should calculate lower negative score for positive ratings', () => {
      const positiveReview = new ReviewModel({
        ...mockReviewData,
        rating: 5,
        sentimentAnalysis: {
          overallSentiment: 'positive',
          negativeAspects: [],
          positiveAspects: ['food quality', 'service'],
          authenticityScore: 80
        }
      });
      
      positiveReview.calculateAuthenticityScore();
      const negativeScore = positiveReview.calculateNegativeScore();
      
      expect(negativeScore).toBeLessThan(30);
    });

    it('should weight negative score by authenticity', () => {
      const authenticReview = new ReviewModel({
        ...mockReviewData,
        rating: 1,
        content: 'Very detailed negative review with specific complaints about the food quality and service issues',
        isVerified: true,
        photos: ['evidence.jpg']
      });
      
      const suspiciousReview = new ReviewModel({
        ...mockReviewData,
        rating: 1,
        content: 'Bad',
        isVerified: false,
        photos: []
      });
      
      authenticReview.calculateAuthenticityScore();
      suspiciousReview.calculateAuthenticityScore();
      
      const authenticNegativeScore = authenticReview.calculateNegativeScore();
      const suspiciousNegativeScore = suspiciousReview.calculateNegativeScore();
      
      expect(authenticNegativeScore).toBeGreaterThan(suspiciousNegativeScore);
    });
  });

  describe('updateHelpfulCount', () => {
    it('should increment helpful count', () => {
      const review = new ReviewModel(mockReviewData);
      review.updateHelpfulCount(true);
      
      expect(review.helpfulCount).toBe(1);
    });

    it('should decrement helpful count', () => {
      const review = new ReviewModel({ ...mockReviewData, helpfulCount: 5 });
      review.updateHelpfulCount(false);
      
      expect(review.helpfulCount).toBe(4);
    });

    it('should not go below zero', () => {
      const review = new ReviewModel(mockReviewData);
      review.updateHelpfulCount(false);
      
      expect(review.helpfulCount).toBe(0);
    });
  });

  describe('isPromotionalContent', () => {
    it('should detect sponsored content', () => {
      const promotionalReview = new ReviewModel({
        ...mockReviewData,
        content: 'This is a sponsored review for this amazing restaurant'
      });
      
      expect(promotionalReview.isPromotionalContent()).toBe(true);
    });

    it('should detect promotional offers', () => {
      const promotionalReview = new ReviewModel({
        ...mockReviewData,
        content: 'Great food! Use discount code SAVE20 for free meal'
      });
      
      expect(promotionalReview.isPromotionalContent()).toBe(true);
    });

    it('should not flag genuine reviews', () => {
      const genuineReview = new ReviewModel({
        ...mockReviewData,
        content: 'Had a wonderful dinner here. The food was delicious and service was excellent.'
      });
      
      expect(genuineReview.isPromotionalContent()).toBe(false);
    });
  });

  describe('validate', () => {
    it('should validate correct review data', () => {
      const review = new ReviewModel(mockReviewData);
      const validation = review.validate();
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject missing required fields', () => {
      const invalidReview = new ReviewModel({
        rating: 4,
        content: 'Good food'
      });
      
      const validation = invalidReview.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('User ID is required');
      expect(validation.errors).toContain('Restaurant ID is required');
    });

    it('should reject invalid rating', () => {
      const invalidReview = new ReviewModel({
        ...mockReviewData,
        rating: 6
      });
      
      const validation = invalidReview.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Rating must be between 1 and 5');
    });

    it('should reject short content', () => {
      const invalidReview = new ReviewModel({
        ...mockReviewData,
        content: 'Good'
      });
      
      const validation = invalidReview.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Review content must be at least 10 characters long');
    });

    it('should reject future visit dates', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      
      const invalidReview = new ReviewModel({
        ...mockReviewData,
        visitDate: futureDate
      });
      
      const validation = invalidReview.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Visit date cannot be in the future');
    });

    it('should reject overly long content', () => {
      const longContent = 'a'.repeat(2001);
      const invalidReview = new ReviewModel({
        ...mockReviewData,
        content: longContent
      });
      
      const validation = invalidReview.validate();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Review content cannot exceed 2000 characters');
    });
  });

  describe('toJSON', () => {
    it('should return proper JSON representation', () => {
      const review = new ReviewModel(mockReviewData);
      const json = review.toJSON();
      
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('userId', 'user123');
      expect(json).toHaveProperty('restaurantId', 'restaurant456');
      expect(json).toHaveProperty('rating', 4);
      expect(json).toHaveProperty('content');
      expect(json).toHaveProperty('createdAt');
    });
  });
});