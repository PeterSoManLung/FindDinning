export interface EmotionAnalysisRequest {
  userId: string;
  textInput?: string;
  emotionalState?: string;
  context?: EmotionContext;
}

export interface EmotionContext {
  timeOfDay?: string;
  weather?: string;
  socialSetting?: 'alone' | 'friends' | 'family' | 'date' | 'business';
  occasion?: string;
  stressLevel?: number; // 1-5 scale
}

export interface EmotionAnalysisResult {
  primaryEmotion: string;
  secondaryEmotions: string[];
  intensity: number; // 1-5 scale
  confidence: number; // 0-1 scale
  recommendedCuisines: string[];
  recommendedAtmosphere: string[];
  reasoning: string;
  analysisDate: Date;
}

export interface MoodMapping {
  emotion: string;
  cuisineRecommendations: CuisineRecommendation[];
  atmospherePreferences: string[];
  priceRangeAdjustment?: number; // -1 to 1, adjusts user's normal price range
}

export interface CuisineRecommendation {
  cuisineType: string;
  matchScore: number;
  reasoning: string;
  specificDishes?: string[];
}

export interface EmotionToCuisineMappingRequest {
  emotion: string;
  intensity?: number;
  userPreferences?: {
    cuisineTypes?: string[];
    dietaryRestrictions?: string[];
  };
}

export interface EmotionContextRequest {
  textInput: string;
  additionalContext?: {
    recentEvents?: string[];
    timeOfDay?: string;
    location?: string;
  };
}

export interface EmotionContextResult {
  detectedEmotions: DetectedEmotion[];
  contextualFactors: string[];
  recommendationAdjustments: RecommendationAdjustment[];
  confidence: number;
}

export interface DetectedEmotion {
  emotion: string;
  confidence: number;
  triggers: string[];
}

export interface RecommendationAdjustment {
  factor: string;
  adjustment: 'increase' | 'decrease' | 'neutral';
  weight: number;
  reasoning: string;
}