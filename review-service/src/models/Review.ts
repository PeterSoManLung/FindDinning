import { Review, NegativeFeedbackCategory, SentimentAnalysis } from '../../../shared/src/types/review.types';
import { ReviewSource } from '../../../shared/src/types/restaurant.types';

export class ReviewModel implements Review {
  id: string;
  userId: string;
  restaurantId: string;
  rating: number;
  content: string;
  photos: string[];
  visitDate: Date;
  isVerified: boolean;
  authenticityScore: number;
  helpfulCount: number;
  negativeScore: number;
  negativeFeedbackCategories: NegativeFeedbackCategory[];
  sentimentAnalysis: SentimentAnalysis;
  source: ReviewSource;
  createdAt: Date;

  constructor(data: Partial<Review>) {
    this.id = data.id || this.generateId();
    this.userId = data.userId || '';
    this.restaurantId = data.restaurantId || '';
    this.rating = data.rating || 0;
    this.content = data.content || '';
    this.photos = data.photos || [];
    this.visitDate = data.visitDate || new Date();
    this.isVerified = data.isVerified || false;
    this.authenticityScore = data.authenticityScore || 0;
    this.helpfulCount = data.helpfulCount || 0;
    this.negativeScore = data.negativeScore || 0;
    this.negativeFeedbackCategories = data.negativeFeedbackCategories || [];
    this.sentimentAnalysis = data.sentimentAnalysis || this.getDefaultSentimentAnalysis();
    this.source = data.source || 'internal';
    this.createdAt = data.createdAt || new Date();
  }

  private generateId(): string {
    return `review_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private getDefaultSentimentAnalysis(): SentimentAnalysis {
    return {
      overallSentiment: 'neutral',
      negativeAspects: [],
      positiveAspects: [],
      authenticityScore: 0
    };
  }

  /**
   * Calculate authenticity score based on various factors
   */
  calculateAuthenticityScore(): number {
    let score = 0;
    
    // Content length factor (longer reviews tend to be more authentic)
    const contentLength = this.content.length;
    if (contentLength > 100) score += 20;
    if (contentLength > 300) score += 20;
    
    // Photo evidence factor
    if (this.photos.length > 0) score += 15;
    if (this.photos.length > 2) score += 10;
    
    // Verified user factor
    if (this.isVerified) score += 25;
    
    // Balanced review factor (not extremely positive or negative)
    if (this.rating >= 2 && this.rating <= 4) score += 10;
    
    // Specific feedback categories factor
    if (this.negativeFeedbackCategories.length > 0) score += 10;
    
    this.authenticityScore = Math.min(score, 100);
    return this.authenticityScore;
  }

  /**
   * Calculate negative score based on sentiment analysis and feedback categories
   */
  calculateNegativeScore(): number {
    let negativeScore = 0;
    
    // Base negative score from rating
    if (this.rating <= 2) negativeScore += 40;
    else if (this.rating === 3) negativeScore += 20;
    
    // Sentiment analysis factor
    if (this.sentimentAnalysis.overallSentiment === 'negative') {
      negativeScore += 30;
    }
    
    // Negative feedback categories factor
    this.negativeFeedbackCategories.forEach(category => {
      negativeScore += category.severity * category.confidence * 2;
    });
    
    // Weight by authenticity score
    negativeScore = negativeScore * (this.authenticityScore / 100);
    
    this.negativeScore = Math.min(negativeScore, 100);
    return this.negativeScore;
  }

  /**
   * Update helpful count
   */
  updateHelpfulCount(increment: boolean): void {
    if (increment) {
      this.helpfulCount++;
    } else if (this.helpfulCount > 0) {
      this.helpfulCount--;
    }
  }

  /**
   * Check if review is promotional content
   */
  isPromotionalContent(): boolean {
    const promotionalKeywords = [
      'sponsored', 'advertisement', 'promo', 'discount code',
      'free meal', 'complimentary', 'invited', 'collaboration',
      'partnership', 'brand ambassador', 'influencer'
    ];
    
    const contentLower = this.content.toLowerCase();
    return promotionalKeywords.some(keyword => contentLower.includes(keyword));
  }

  /**
   * Validate review data
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!this.userId) errors.push('User ID is required');
    if (!this.restaurantId) errors.push('Restaurant ID is required');
    if (this.rating < 1 || this.rating > 5) errors.push('Rating must be between 1 and 5');
    if (!this.content || this.content.trim().length < 10) {
      errors.push('Review content must be at least 10 characters long');
    }
    if (this.content.length > 2000) {
      errors.push('Review content cannot exceed 2000 characters');
    }
    if (this.visitDate > new Date()) {
      errors.push('Visit date cannot be in the future');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Convert to JSON representation
   */
  toJSON(): Review {
    return {
      id: this.id,
      userId: this.userId,
      restaurantId: this.restaurantId,
      rating: this.rating,
      content: this.content,
      photos: this.photos,
      visitDate: this.visitDate,
      isVerified: this.isVerified,
      authenticityScore: this.authenticityScore,
      helpfulCount: this.helpfulCount,
      negativeScore: this.negativeScore,
      negativeFeedbackCategories: this.negativeFeedbackCategories,
      sentimentAnalysis: this.sentimentAnalysis,
      source: this.source,
      createdAt: this.createdAt
    };
  }
}