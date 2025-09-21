import {apiClient} from './apiClient';

interface RestaurantDetail {
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
  specialFeatures: string[];
  isLocalGem: boolean;
  operatingHours: {
    [key: string]: string;
  };
  photos?: string[];
  phone?: string;
  website?: string;
}

interface SearchParams {
  query?: string;
  cuisineType?: string[];
  priceRange?: [number, number];
  location?: {
    latitude: number;
    longitude: number;
    radius?: number; // in km
  };
  atmosphere?: string[];
  isLocalGem?: boolean;
  limit?: number;
  offset?: number;
}

interface SearchResponse {
  restaurants: RestaurantDetail[];
  total: number;
  hasMore: boolean;
}

class RestaurantService {
  async getRestaurantDetails(restaurantId: string): Promise<RestaurantDetail> {
    try {
      return await apiClient.get<RestaurantDetail>(`/restaurants/${restaurantId}`);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch restaurant details');
    }
  }

  async searchRestaurants(params: SearchParams): Promise<SearchResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.query) {
        queryParams.append('query', params.query);
      }
      
      if (params.cuisineType && params.cuisineType.length > 0) {
        params.cuisineType.forEach(cuisine => {
          queryParams.append('cuisineType', cuisine);
        });
      }
      
      if (params.priceRange) {
        queryParams.append('minPrice', params.priceRange[0].toString());
        queryParams.append('maxPrice', params.priceRange[1].toString());
      }
      
      if (params.location) {
        queryParams.append('latitude', params.location.latitude.toString());
        queryParams.append('longitude', params.location.longitude.toString());
        if (params.location.radius) {
          queryParams.append('radius', params.location.radius.toString());
        }
      }
      
      if (params.atmosphere && params.atmosphere.length > 0) {
        params.atmosphere.forEach(atm => {
          queryParams.append('atmosphere', atm);
        });
      }
      
      if (params.isLocalGem !== undefined) {
        queryParams.append('isLocalGem', params.isLocalGem.toString());
      }
      
      if (params.limit) {
        queryParams.append('limit', params.limit.toString());
      }
      
      if (params.offset) {
        queryParams.append('offset', params.offset.toString());
      }

      const url = `/restaurants/search?${queryParams.toString()}`;
      return await apiClient.get<SearchResponse>(url);
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to search restaurants');
    }
  }

  async getNearbyRestaurants(latitude: number, longitude: number, radius: number = 5): Promise<RestaurantDetail[]> {
    try {
      return await apiClient.get<RestaurantDetail[]>('/restaurants/nearby', {
        params: {
          latitude,
          longitude,
          radius,
        },
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch nearby restaurants');
    }
  }

  async getLocalGems(location?: {latitude: number; longitude: number}): Promise<RestaurantDetail[]> {
    try {
      const params = location ? {
        latitude: location.latitude,
        longitude: location.longitude,
      } : {};
      
      return await apiClient.get<RestaurantDetail[]>('/restaurants/local-gems', {params});
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch local gems');
    }
  }

  async getRestaurantReviews(restaurantId: string, limit: number = 10, offset: number = 0): Promise<any[]> {
    try {
      return await apiClient.get<any[]>(`/restaurants/${restaurantId}/reviews`, {
        params: {
          limit,
          offset,
        },
      });
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch restaurant reviews');
    }
  }

  async checkRestaurantAvailability(restaurantId: string, dateTime?: string): Promise<{isOpen: boolean; nextOpenTime?: string}> {
    try {
      const params = dateTime ? {dateTime} : {};
      return await apiClient.get<{isOpen: boolean; nextOpenTime?: string}>(`/restaurants/${restaurantId}/availability`, {params});
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to check restaurant availability');
    }
  }
}

export const restaurantService = new RestaurantService();