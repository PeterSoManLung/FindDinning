import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {recommendationService} from '../../services/recommendationService';

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

interface RecommendationState {
  recommendations: RecommendedRestaurant[];
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

const initialState: RecommendationState = {
  recommendations: [],
  loading: false,
  error: null,
  lastUpdated: null,
};

// Async thunks
export const fetchRecommendations = createAsyncThunk(
  'recommendations/fetch',
  async (params?: {emotionalState?: string; location?: {latitude: number; longitude: number}}) => {
    const response = await recommendationService.getRecommendations(params);
    return response;
  }
);

export const submitFeedback = createAsyncThunk(
  'recommendations/feedback',
  async (feedback: {restaurantId: string; liked: boolean; visited: boolean}) => {
    await recommendationService.submitFeedback(feedback);
    return feedback;
  }
);

const recommendationSlice = createSlice({
  name: 'recommendations',
  initialState,
  reducers: {
    clearRecommendationError: (state) => {
      state.error = null;
    },
    clearRecommendations: (state) => {
      state.recommendations = [];
      state.lastUpdated = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch recommendations
      .addCase(fetchRecommendations.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRecommendations.fulfilled, (state, action) => {
        state.loading = false;
        state.recommendations = action.payload.recommendations;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(fetchRecommendations.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch recommendations';
      })
      // Submit feedback
      .addCase(submitFeedback.fulfilled, (state, action) => {
        // Update the recommendation with feedback
        const index = state.recommendations.findIndex(
          rec => rec.restaurant.id === action.payload.restaurantId
        );
        if (index !== -1) {
          // Mark as processed for UI feedback
          state.recommendations[index] = {
            ...state.recommendations[index],
            // Add feedback indicator if needed
          };
        }
      });
  },
});

export const {clearRecommendationError, clearRecommendations} = recommendationSlice.actions;
export default recommendationSlice.reducer;