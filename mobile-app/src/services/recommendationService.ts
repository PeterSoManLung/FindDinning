import {apiClient} from './apiClient';

interface Restaurant {
  id: string;
  name: string;
  cuisineType: string[];
  location: {
    address: string;
    latitude: number;
    longitude: number;
    district: string;
  };
  priceRange: number;
  rating: number;
  atmosphere: string[];
  menuHighlights: string[];
  isLocalGem: boolean;
}

interface RecommendedRestaurant {
  restaurant: Restaurant;
  matchScore: number;
  reasonsForRecommendation: string[];
  emotionalAlignment: number;
}

interface RecommendationResponse {
  recommendations: RecommendedRestaurant[];
  generatedAt: string;
  confidence: number;
}

interface RecommendationParams {
  emotionalState?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  limit?: number;
}

interface FeedbackData {
  restaurantId: string;
  liked: boolean;
  visited: boolean;
  rating?: number;
  notes?: string;
}

class RecommendationService {
  async getRecommendations(params?: RecommendationParams): Promise<RecommendationResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params?.emotionalState) {
        queryParams.append('emotionalState', params.emotionalState);
      }
      
      if (params?.location) {
        queryParams.append('latitude', params.location.latitude.toString());
        queryParams.append('longitude', params.location.longitude.toString());
      }
      
      if (params?.limit) {
        queryParams.append('limit', params.limit.toString());
      }

      const url = `/recommendations/generate${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      return await apiClient.get<RecommendationResponse>(url);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch recommendations');
    }
  }

  async getEmotionBasedRecommendations(emotionalState: string, location?: {latitude: number; longitude: number}): Promise<RecommendationResponse> {
    try {
      return await apiClient.post<RecommendationResponse>('/recommendations/emotion-based', {
        emotionalState,
        location,
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch emotion-based recommendations');
    }
  }

  async submitFeedback(feedback: FeedbackData): Promise<void> {
    try {
      await apiClient.post('/recommendations/feedback', feedback);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to submit feedback');
    }
  }

  async getTrendingRestaurants(location?: {latitude: number; longitude: number}): Promise<Restaurant[]> {
    try {
      const params = location ? {
        latitude: location.latitude,
        longitude: location.longitude,
      } : {};
      
      return await apiClient.get<Restaurant[]>('/recommendations/trending', {params});
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch trending restaurants');
    }
  }

  async getRecommendationHistory(): Promise<RecommendationResponse[]> {
    try {
      return await apiClient.get<RecommendationResponse[]>('/recommendations/history');
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch recommendation history');
    }
  }
}

export const recommendationService = new RecommendationService();