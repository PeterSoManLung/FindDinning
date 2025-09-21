import {createSlice, createAsyncThunk, PayloadAction} from '@reduxjs/toolkit';
import {userService} from '../../services/userService';

interface UserPreferences {
  cuisineTypes: string[];
  priceRange: [number, number];
  dietaryRestrictions: string[];
  atmospherePreferences: string[];
  spiceLevel: number;
}

interface UserProfile {
  id: string;
  email: string;
  name: string;
  preferences: UserPreferences;
  location: {
    latitude: number;
    longitude: number;
    district: string;
  } | null;
}

interface UserState {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

const initialState: UserState = {
  profile: null,
  loading: false,
  error: null,
};

// Async thunks
export const fetchUserProfile = createAsyncThunk(
  'user/fetchProfile',
  async () => {
    const response = await userService.getProfile();
    return response;
  }
);

export const updateUserPreferences = createAsyncThunk(
  'user/updatePreferences',
  async (preferences: UserPreferences) => {
    const response = await userService.updatePreferences(preferences);
    return response;
  }
);

export const updateUserLocation = createAsyncThunk(
  'user/updateLocation',
  async (location: {latitude: number; longitude: number; district: string}) => {
    const response = await userService.updateLocation(location);
    return response;
  }
);

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    clearUserError: (state) => {
      state.error = null;
    },
    setUserLocation: (state, action: PayloadAction<{latitude: number; longitude: number; district: string}>) => {
      if (state.profile) {
        state.profile.location = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch profile
      .addCase(fetchUserProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch profile';
      })
      // Update preferences
      .addCase(updateUserPreferences.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateUserPreferences.fulfilled, (state, action) => {
        state.loading = false;
        if (state.profile) {
          state.profile.preferences = action.payload.preferences;
        }
      })
      .addCase(updateUserPreferences.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update preferences';
      })
      // Update location
      .addCase(updateUserLocation.fulfilled, (state, action) => {
        if (state.profile) {
          state.profile.location = action.payload.location;
        }
      });
  },
});

export const {clearUserError, setUserLocation} = userSlice.actions;
export default userSlice.reducer;