import { ReviewSource } from './restaurant.types';

export interface Review {
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
}

export interface NegativeFeedbackCategory {
  category: 'service' | 'food_quality' | 'cleanliness' | 'value' | 'atmosphere' | 'wait_time';
  severity: number; // 1-5 scale
  confidence: number; // AI confidence in categorization
}

export interface SentimentAnalysis {
  overallSentiment: 'positive' | 'negative' | 'neutral';
  negativeAspects: string[];
  positiveAspects: string[];
  authenticityScore: number;
}

export interface ReviewCreateRequest {
  restaurantId: string;
  rating: number;
  content: string;
  photos?: string[];
  visitDate: Date;
}

export interface ReviewUpdateRequest {
  rating?: number;
  content?: string;
  photos?: string[];
}

export interface ReviewAnalysisRequest {
  restaurantId: string;
  timeframe?: 'week' | 'month' | 'quarter' | 'year';
  categories?: NegativeFeedbackCategory['category'][];
}

export interface NegativeFeedbackAnalysisResult {
  restaurantId: string;
  overallNegativeScore: number;
  categoryBreakdown: CategoryAnalysis[];
  trends: TrendAnalysis[];
  recommendations: string[];
  analysisDate: Date;
}

export interface CategoryAnalysis {
  category: NegativeFeedbackCategory['category'];
  averageSeverity: number;
  frequency: number;
  trend: 'improving' | 'declining' | 'stable';
  commonIssues: string[];
}

export interface TrendAnalysis {
  period: string;
  negativeScore: number;
  reviewCount: number;
  majorIssues: string[];
}

export interface ReviewHelpfulRequest {
  reviewId: string;
  userId: string;
  isHelpful: boolean;
}