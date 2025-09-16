export interface Restaurant {
  id: string;
  name: string;
  cuisineType: string[];
  location: RestaurantLocation;
  priceRange: number; // 1-4 scale
  rating: number;
  negativeScore: number; // Primary ranking metric based on negative feedback
  atmosphere: string[];
  operatingHours: OperatingHours;
  menuHighlights: MenuItem[];
  specialFeatures: string[];
  isLocalGem: boolean;
  authenticityScore: number;
  governmentLicense: GovernmentLicense;
  dataQualityScore: number;
  negativeFeedbackTrends: NegativeFeedbackTrend[];
  platformData: PlatformData[];
  lastSyncDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RestaurantLocation {
  address: string;
  latitude: number;
  longitude: number;
  district: string;
}

export interface OperatingHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export interface DayHours {
  isOpen: boolean;
  openTime?: string; // Format: "HH:mm"
  closeTime?: string; // Format: "HH:mm"
  breaks?: TimeBreak[];
}

export interface TimeBreak {
  startTime: string;
  endTime: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price?: number;
  category: string;
  isSignatureDish: boolean;
  dietaryInfo: string[];
  spiceLevel?: number;
}

export interface GovernmentLicense {
  licenseNumber: string;
  isValid: boolean;
  healthInspectionScore?: number;
  lastInspectionDate?: Date;
  violations: string[];
}

export interface NegativeFeedbackTrend {
  category: string;
  trend: 'improving' | 'declining' | 'stable';
  severity: number;
  frequency: number;
  timeframe: string;
}

export interface PlatformData {
  source: ReviewSource;
  externalId: string;
  rating: number;
  reviewCount: number;
  lastUpdated: Date;
  dataReliability: number;
}

export type ReviewSource = 'internal' | 'openrice' | 'tripadvisor' | 'eatigo' | 'chope' | 'foodpanda' | 'bistrochat' | 'keeta';

export interface RestaurantSearchRequest {
  location?: {
    latitude: number;
    longitude: number;
    radius?: number; // in kilometers
  };
  cuisineTypes?: string[];
  priceRange?: [number, number];
  isOpen?: boolean;
  features?: string[];
  sortBy?: 'distance' | 'rating' | 'negativeScore' | 'popularity';
}

export interface RestaurantCreateRequest {
  name: string;
  cuisineType: string[];
  location: RestaurantLocation;
  priceRange: number;
  atmosphere: string[];
  operatingHours: OperatingHours;
  menuHighlights?: MenuItem[];
  specialFeatures?: string[];
}