import { Restaurant } from './restaurant.types';

export interface Recommendation {
  id: string;
  userId: string;
  restaurants: RecommendedRestaurant[];
  emotionalContext?: string;
  generatedAt: Date;
  confidence: number;
  reasoning: string;
}

export interface RecommendedRestaurant {
  restaurant: Restaurant;
  matchScore: number;
  reasonsForRecommendation: string[];
  emotionalAlignment: number;
}

export interface RecommendationRequest {
  userId: string;
  emotionalState?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  preferences?: {
    cuisineTypes?: string[];
    priceRange?: [number, number];
    maxDistance?: number;
  };
  context?: {
    timeOfDay?: string;
    occasion?: string;
    groupSize?: number;
  };
}

export interface RecommendationFeedback {
  recommendationId: string;
  restaurantId: string;
  userId: string;
  feedback: 'liked' | 'disliked' | 'visited' | 'not_interested';
  rating?: number;
  notes?: string;
  createdAt: Date;
}

export interface EmotionBasedRecommendationRequest {
  userId: string;
  emotionalState: string;
  intensity?: number; // 1-5 scale
  context?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface TrendingRestaurantsRequest {
  location?: {
    latitude: number;
    longitude: number;
    radius?: number;
  };
  timeframe?: 'day' | 'week' | 'month';
  cuisineType?: string;
  limit?: number;
}