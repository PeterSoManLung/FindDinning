import {apiClient} from './apiClient';

interface UserPreferences {
  cuisineTypes: string[];
  priceRange: [number, number];
  dietaryRestrictions: string[];
  atmospherePreferences: string[];
  spiceLevel: number;
}

interface UserLocation {
  latitude: number;
  longitude: number;
  district: string;
}

interface UserProfile {
  id: string;
  email: string;
  name: string;
  preferences: UserPreferences;
  location: UserLocation | null;
}

class UserService {
  async getProfile(): Promise<UserProfile> {
    try {
      return await apiClient.get<UserProfile>('/users/profile');
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch profile');
    }
  }

  async updateProfile(profileData: Partial<UserProfile>): Promise<UserProfile> {
    try {
      return await apiClient.put<UserProfile>('/users/profile', profileData);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to update profile');
    }
  }

  async updatePreferences(preferences: UserPreferences): Promise<{preferences: UserPreferences}> {
    try {
      return await apiClient.put<{preferences: UserPreferences}>('/users/preferences', {
        preferences,
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to update preferences');
    }
  }

  async updateLocation(location: UserLocation): Promise<{location: UserLocation}> {
    try {
      return await apiClient.put<{location: UserLocation}>('/users/location', {
        location,
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to update location');
    }
  }

  async getDiningHistory(): Promise<any[]> {
    try {
      return await apiClient.get<any[]>('/users/history');
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch dining history');
    }
  }

  async addDiningHistory(restaurantId: string, rating?: number, notes?: string): Promise<void> {
    try {
      await apiClient.post('/users/history', {
        restaurantId,
        rating,
        notes,
        visitDate: new Date().toISOString(),
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to add dining history');
    }
  }
}

export const userService = new UserService();