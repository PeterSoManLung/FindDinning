export interface User {
  id: string;
  email: string;
  name: string;
  preferences: UserPreferences;
  diningHistory: DiningHistory[];
  emotionalProfile: EmotionalProfile;
  location: UserLocation;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  cuisineTypes: string[];
  priceRange: [number, number];
  dietaryRestrictions: string[];
  atmospherePreferences: string[];
  spiceLevel: number;
}

export interface DiningHistory {
  id: string;
  restaurantId: string;
  visitDate: Date;
  rating?: number;
  notes?: string;
  moodContext?: string;
}

export interface EmotionalProfile {
  preferredMoodCuisines: Record<string, string[]>;
  comfortFoodPreferences: string[];
  celebratoryPreferences: string[];
  lastEmotionalState?: string;
  emotionalPatterns: EmotionalPattern[];
}

export interface EmotionalPattern {
  emotion: string;
  frequency: number;
  associatedCuisines: string[];
  timeOfDay?: string;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  district: string;
}

export interface UserRegistrationRequest {
  email: string;
  password: string;
  name: string;
  preferences?: Partial<UserPreferences>;
}

export interface UserLoginRequest {
  email: string;
  password: string;
}

export interface UserUpdateRequest {
  name?: string;
  preferences?: Partial<UserPreferences>;
  location?: Partial<UserLocation>;
}