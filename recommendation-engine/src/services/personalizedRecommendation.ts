import { User } from '../../../shared/src/types/user.types';
import { Restaurant } from '../../../shared/src/types/restaurant.types';
import { RecommendedRestaurant, RecommendationRequest } from '../../../shared/src/types/recommendation.types';
import { PreferenceAnalysisService } from './preferenceAnalysis';
import { RestaurantMatchingService } from './restaurantMatching';
import { NegativeFeedbackRecommendationService } from './negativeFeedbackRecommendation';
import { MLIntegrationService, MLIntegrationConfig } from './mlIntegrationService';

export interface PersonalizedRecommendationWeights {
  userPreferences: number;
  emotionalAlignment: number;
  negativeFeedbackAwareness: number;
  contextualFactors: number;
  personalHistory: number;
}

export interface RecommendationConfidence {
  overall: number;
  preferenceMatch: number;
  emotionalAlignment: number;
  dataQuality: number;
  historicalAccuracy: number;
}

export interface RecommendationReasoning {
  primaryReasons: string[];
  emotionalReasons: string[];
  contextualReasons: string[];
  confidenceFactors: string[];
}

export interface CachedRecommendation {
  userId: string;
  recommendations: RecommendedRestaurant[];
  generatedAt: Date;
  context: {
    emotionalState?: string;
    location?: { latitude: number; longitude: number };
    timeOfDay?: string;
  };
  ttl: number; // Time to live in minutes
}

export class PersonalizedRecommendationService {
  private preferenceAnalysis: PreferenceAnalysisService;
  private restaurantMatching: RestaurantMatchingService;
  private negativeFeedbackRecommendation: NegativeFeedbackRecommendationService;
  private mlIntegrationService?: MLIntegrationService;
  private recommendationCache: Map<string, CachedRecommendation>;

  private static readonly DEFAULT_WEIGHTS: PersonalizedRecommendationWeights = {
    userPreferences: 0.25, // Reduced to make room for ML
    emotionalAlignment: 0.2,
    negativeFeedbackAwareness: 0.2,
    contextualFactors: 0.1,
    personalHistory: 0.05
  };

  private static readonly ML_WEIGHT = 0.2; // Weight for ML predictions
  private static readonly CACHE_TTL_MINUTES = 30;

  constructor(mlConfig?: MLIntegrationConfig) {
    this.preferenceAnalysis = new PreferenceAnalysisService();
    this.restaurantMatching = new RestaurantMatchingService();
    this.negativeFeedbackRecommendation = new NegativeFeedbackRecommendationService();
    this.recommendationCache = new Map();
    
    // Initialize ML integration if config provided
    if (mlConfig) {
      this.mlIntegrationService = new MLIntegrationService(mlConfig);
    }
  }

  /**
   * Generate personalized recommendations integrating preferences, emotional state, and ML models
   */
  public async generatePersonalizedRecommendations(
    user: User,
    availableRestaurants: Restaurant[],
    request: RecommendationRequest,
    weights: PersonalizedRecommendationWeights = PersonalizedRecommendationService.DEFAULT_WEIGHTS,
    limit: number = 10
  ): Promise<RecommendedRestaurant[]> {
    // Check cache first
    const cachedRecommendations = this.getCachedRecommendations(user.id, request);
    if (cachedRecommendations) {
      return cachedRecommendations.slice(0, limit);
    }

    // Generate fresh recommendations with ML integration
    const recommendations = await this.generateFreshRecommendationsWithML(
      user,
      availableRestaurants,
      request,
      weights,
      limit
    );

    // Cache the results
    this.cacheRecommendations(user.id, recommendations, request);

    return recommendations;
  }

  /**
   * Calculate recommendation confidence and reasoning
   */
  public calculateRecommendationConfidence(
    user: User,
    restaurant: Restaurant,
    emotionalState?: string
  ): { confidence: RecommendationConfidence; reasoning: RecommendationReasoning } {
    const userAnalysis = this.preferenceAnalysis.analyzeUserPreferences(user);
    
    // Calculate individual confidence components
    const preferenceMatch = this.preferenceAnalysis.calculatePreferenceMatch(userAnalysis, restaurant);
    const emotionalAlignment = this.calculateEmotionalAlignment(user, restaurant, emotionalState);
    const dataQuality = this.calculateDataQualityScore(restaurant);
    const historicalAccuracy = this.calculateHistoricalAccuracy(user);

    const overall = (
      preferenceMatch * 0.3 +
      emotionalAlignment * 0.25 +
      dataQuality * 0.25 +
      historicalAccuracy * 0.2
    );

    const confidence: RecommendationConfidence = {
      overall,
      preferenceMatch,
      emotionalAlignment,
      dataQuality,
      historicalAccuracy
    };

    const reasoning = this.generateRecommendationReasoning(
      user,
      restaurant,
      confidence,
      emotionalState
    );

    return { confidence, reasoning };
  }

  /**
   * Get cached recommendations if available and valid
   */
  public getCachedRecommendations(
    userId: string,
    request: RecommendationRequest
  ): RecommendedRestaurant[] | null {
    const cacheKey = this.generateCacheKey(userId, request);
    const cached = this.recommendationCache.get(cacheKey);

    if (!cached) return null;

    // Check if cache is still valid
    const now = new Date();
    const ageMinutes = (now.getTime() - cached.generatedAt.getTime()) / (1000 * 60);
    
    if (ageMinutes > cached.ttl) {
      this.recommendationCache.delete(cacheKey);
      return null;
    }

    return cached.recommendations;
  }

  /**
   * Cache recommendations for performance optimization
   */
  public cacheRecommendations(
    userId: string,
    recommendations: RecommendedRestaurant[],
    request: RecommendationRequest,
    ttlMinutes: number = PersonalizedRecommendationService.CACHE_TTL_MINUTES
  ): void {
    const cacheKey = this.generateCacheKey(userId, request);
    
    const cachedRecommendation: CachedRecommendation = {
      userId,
      recommendations,
      generatedAt: new Date(),
      context: {
        emotionalState: request.emotionalState,
        location: request.location,
        timeOfDay: request.context?.timeOfDay
      },
      ttl: ttlMinutes
    };

    this.recommendationCache.set(cacheKey, cachedRecommendation);

    // Clean up old cache entries periodically
    this.cleanupCache();
  }

  /**
   * Clear cache for a specific user (useful after preference updates)
   */
  public clearUserCache(userId: string): void {
    const keysToDelete: string[] = [];
    
    this.recommendationCache.forEach((cached, key) => {
      if (cached.userId === userId) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.recommendationCache.delete(key));
  }

  /**
   * Generate fresh recommendations with ML integration
   */
  private async generateFreshRecommendationsWithML(
    user: User,
    availableRestaurants: Restaurant[],
    request: RecommendationRequest,
    weights: PersonalizedRecommendationWeights,
    limit: number
  ): Promise<RecommendedRestaurant[]> {
    try {
      // Try ML-powered recommendations first
      if (this.mlIntegrationService) {
        const mlResult = await this.mlIntegrationService.generateMLRecommendations(
          user,
          availableRestaurants,
          request,
          Math.ceil(limit * 1.5) // Get more candidates for better selection
        );

        // If ML recommendations are high confidence, use them as primary source
        if (mlResult.modelMetadata.overallConfidence > 0.7 && !mlResult.modelMetadata.fallbackUsed) {
          return await this.enhanceMLRecommendations(
            mlResult.recommendations,
            user,
            request,
            weights,
            limit
          );
        }

        // If ML has medium confidence, blend with traditional recommendations
        if (mlResult.modelMetadata.overallConfidence > 0.4) {
          return await this.blendMLWithTraditionalRecommendations(
            mlResult.recommendations,
            user,
            availableRestaurants,
            request,
            weights,
            limit
          );
        }
      }

      // Fallback to traditional recommendations if ML is unavailable or low confidence
      return await this.generateFreshRecommendations(
        user,
        availableRestaurants,
        request,
        weights,
        limit
      );

    } catch (error) {
      console.error('ML-enhanced recommendation generation failed:', error);
      
      // Fallback to traditional recommendations
      return await this.generateFreshRecommendations(
        user,
        availableRestaurants,
        request,
        weights,
        limit
      );
    }
  }

  /**
   * Original recommendation generation method (now used as fallback)
   */
  private async generateFreshRecommendations(
    user: User,
    availableRestaurants: Restaurant[],
    request: RecommendationRequest,
    weights: PersonalizedRecommendationWeights,
    limit: number
  ): Promise<RecommendedRestaurant[]> {
    // Get base recommendations from different services
    const preferenceRecommendations = await this.restaurantMatching.generateRecommendations(
      user,
      availableRestaurants,
      undefined,
      undefined,
      limit * 2 // Get more candidates for better selection
    );

    const negativeFeedbackRecommendations = await this.negativeFeedbackRecommendation
      .generateNegativeFeedbackAwareRecommendations(
        user,
        availableRestaurants,
        undefined,
        undefined,
        limit * 2
      );

    // Merge and score recommendations
    const mergedRecommendations = this.mergeRecommendations(
      preferenceRecommendations,
      negativeFeedbackRecommendations
    );

    // Apply personalized scoring
    const personalizedRecommendations = mergedRecommendations.map(rec => {
      const personalizedScore = this.calculatePersonalizedScore(
        user,
        rec.restaurant,
        request,
        weights
      );

      const { confidence, reasoning } = this.calculateRecommendationConfidence(
        user,
        rec.restaurant,
        request.emotionalState
      );

      return {
        ...rec,
        matchScore: personalizedScore,
        emotionalAlignment: this.calculateEmotionalAlignment(
          user,
          rec.restaurant,
          request.emotionalState
        ),
        reasonsForRecommendation: [
          ...reasoning.primaryReasons,
          ...reasoning.emotionalReasons,
          ...reasoning.contextualReasons
        ].slice(0, 4)
      };
    });

    // Sort by personalized score and return top recommendations
    return personalizedRecommendations
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  }

  private calculatePersonalizedScore(
    user: User,
    restaurant: Restaurant,
    request: RecommendationRequest,
    weights: PersonalizedRecommendationWeights
  ): number {
    let totalScore = 0;

    // User preferences score
    const userAnalysis = this.preferenceAnalysis.analyzeUserPreferences(user);
    const preferenceScore = this.preferenceAnalysis.calculatePreferenceMatch(userAnalysis, restaurant);
    totalScore += preferenceScore * weights.userPreferences;

    // Emotional alignment score
    const emotionalScore = this.calculateEmotionalAlignment(user, restaurant, request.emotionalState);
    totalScore += emotionalScore * weights.emotionalAlignment;

    // Negative feedback awareness score
    const negativeFeedbackScore = Math.max(0, 1.0 - restaurant.negativeScore);
    totalScore += negativeFeedbackScore * weights.negativeFeedbackAwareness;

    // Contextual factors score
    const contextualScore = this.calculateContextualScore(restaurant, request);
    totalScore += contextualScore * weights.contextualFactors;

    // Personal history score
    const historyScore = this.calculatePersonalHistoryScore(user, restaurant);
    totalScore += historyScore * weights.personalHistory;

    return Math.min(totalScore, 1.0);
  }

  private calculateEmotionalAlignment(
    user: User,
    restaurant: Restaurant,
    emotionalState?: string
  ): number {
    if (!emotionalState) return 0.5; // Neutral score if no emotional state

    // Check if restaurant's cuisine matches user's emotional preferences
    const emotionalCuisines = user.emotionalProfile.preferredMoodCuisines[emotionalState] || [];
    const matchingCuisines = restaurant.cuisineType.filter(cuisine => 
      emotionalCuisines.includes(cuisine)
    );

    if (matchingCuisines.length > 0) {
      return 0.9; // High alignment
    }

    // Check atmosphere alignment with emotional state
    const atmosphereAlignment = this.calculateAtmosphereEmotionalAlignment(
      restaurant.atmosphere,
      emotionalState
    );

    return atmosphereAlignment;
  }

  private calculateAtmosphereEmotionalAlignment(
    atmosphere: string[],
    emotionalState: string
  ): number {
    const emotionalAtmosphereMap: Record<string, string[]> = {
      'happy': ['lively', 'vibrant', 'casual', 'fun'],
      'sad': ['cozy', 'quiet', 'intimate', 'warm'],
      'celebrating': ['upscale', 'elegant', 'festive', 'special'],
      'stressed': ['calm', 'peaceful', 'quiet', 'relaxing'],
      'romantic': ['intimate', 'romantic', 'cozy', 'elegant'],
      'social': ['lively', 'social', 'vibrant', 'casual']
    };

    const preferredAtmospheres = emotionalAtmosphereMap[emotionalState] || [];
    const matchingAtmospheres = atmosphere.filter(atm => 
      preferredAtmospheres.includes(atm.toLowerCase())
    );

    return matchingAtmospheres.length > 0 ? 0.7 : 0.3;
  }

  private calculateContextualScore(restaurant: Restaurant, request: RecommendationRequest): number {
    let score = 0.5; // Base score

    // Time of day considerations
    if (request.context?.timeOfDay) {
      const timeScore = this.calculateTimeOfDayScore(restaurant, request.context.timeOfDay);
      score = (score + timeScore) / 2;
    }

    // Group size considerations
    if (request.context?.groupSize) {
      const groupScore = this.calculateGroupSizeScore(restaurant, request.context.groupSize);
      score = (score + groupScore) / 2;
    }

    // Occasion considerations
    if (request.context?.occasion) {
      const occasionScore = this.calculateOccasionScore(restaurant, request.context.occasion);
      score = (score + occasionScore) / 2;
    }

    return score;
  }

  private calculateTimeOfDayScore(restaurant: Restaurant, timeOfDay: string): number {
    // This would check if restaurant is suitable for the time of day
    // For now, return neutral score
    return 0.5;
  }

  private calculateGroupSizeScore(restaurant: Restaurant, groupSize: number): number {
    // Larger groups might prefer restaurants with more space
    if (groupSize > 4) {
      if (restaurant.atmosphere.includes('spacious') || restaurant.atmosphere.includes('casual')) {
        return 0.9;
      }
      if (restaurant.atmosphere.includes('intimate') || restaurant.atmosphere.includes('cozy')) {
        return 0.2; // Penalty for intimate places with large groups
      }
    }
    if (groupSize <= 2) {
      if (restaurant.atmosphere.includes('intimate') || restaurant.atmosphere.includes('cozy')) {
        return 0.9;
      }
      if (restaurant.atmosphere.includes('lively') || restaurant.atmosphere.includes('casual')) {
        return 0.7;
      }
    }
    return 0.5;
  }

  private calculateOccasionScore(restaurant: Restaurant, occasion: string): number {
    const occasionRestaurantMap: Record<string, string[]> = {
      'date': ['romantic', 'intimate', 'upscale', 'cozy'],
      'business': ['quiet', 'professional', 'upscale', 'formal'],
      'family': ['family-friendly', 'casual', 'spacious', 'lively'],
      'celebration': ['upscale', 'special', 'festive', 'elegant'],
      'casual': ['casual', 'lively', 'relaxed', 'informal']
    };

    const preferredFeatures = occasionRestaurantMap[occasion] || [];
    const matchingFeatures = restaurant.atmosphere.filter(atm => 
      preferredFeatures.includes(atm.toLowerCase())
    );

    if (matchingFeatures.length > 0) {
      return 0.9;
    }

    // Penalty for mismatched occasions
    if (occasion === 'business' && restaurant.atmosphere.includes('lively')) {
      return 0.2;
    }
    if (occasion === 'casual' && restaurant.atmosphere.includes('formal')) {
      return 0.3;
    }

    return 0.5;
  }

  private calculatePersonalHistoryScore(user: User, restaurant: Restaurant): number {
    // Check if user has visited similar restaurants before
    const visitedCuisines = user.diningHistory.map(visit => {
      // This would require restaurant data to get cuisine types
      // For now, return neutral score
      return 'unknown';
    });

    // Simple implementation - could be enhanced with actual history analysis
    return 0.5;
  }

  private calculateDataQualityScore(restaurant: Restaurant): number {
    let score = restaurant.dataQualityScore || 0.5;
    
    // Boost score for restaurants with government license
    if (restaurant.governmentLicense.isValid) {
      score += 0.1;
    }

    // Boost score for local gems (often have authentic data)
    if (restaurant.isLocalGem) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  private calculateHistoricalAccuracy(user: User): number {
    // This would analyze how accurate past recommendations were for this user
    // For now, return a score based on dining history length
    const historyLength = user.diningHistory.length;
    return Math.min(historyLength / 20, 0.8) + 0.2; // 0.2 to 1.0 scale
  }

  private generateRecommendationReasoning(
    user: User,
    restaurant: Restaurant,
    confidence: RecommendationConfidence,
    emotionalState?: string
  ): RecommendationReasoning {
    const primaryReasons: string[] = [];
    const emotionalReasons: string[] = [];
    const contextualReasons: string[] = [];
    const confidenceFactors: string[] = [];

    // Primary reasons based on preferences
    const userAnalysis = this.preferenceAnalysis.analyzeUserPreferences(user);
    const matchingCuisines = restaurant.cuisineType.filter(cuisine => 
      userAnalysis.preferredCuisines.has(cuisine)
    );
    
    if (matchingCuisines.length > 0) {
      primaryReasons.push(`Matches your preference for ${matchingCuisines.join(', ')} cuisine`);
    }

    if (restaurant.priceRange >= user.preferences.priceRange[0] && 
        restaurant.priceRange <= user.preferences.priceRange[1]) {
      primaryReasons.push('Within your preferred price range');
    }

    // Emotional reasons
    if (emotionalState) {
      const emotionalAlignment = this.calculateEmotionalAlignment(user, restaurant, emotionalState);
      if (emotionalAlignment > 0.7) {
        emotionalReasons.push(`Perfect atmosphere for when you're feeling ${emotionalState}`);
      }
    }

    // Contextual reasons
    if (restaurant.isLocalGem) {
      contextualReasons.push('Hidden local gem with authentic experience');
    }

    if (restaurant.negativeScore <= 0.3) {
      contextualReasons.push('Consistently positive customer feedback');
    }

    // Confidence factors
    if (confidence.overall > 0.8) {
      confidenceFactors.push('High confidence match based on your preferences');
    }

    if (confidence.dataQuality > 0.8) {
      confidenceFactors.push('Reliable data from multiple verified sources');
    }

    return {
      primaryReasons,
      emotionalReasons,
      contextualReasons,
      confidenceFactors
    };
  }

  private mergeRecommendations(
    preferenceRecs: RecommendedRestaurant[],
    negativeFeedbackRecs: RecommendedRestaurant[]
  ): RecommendedRestaurant[] {
    const merged = new Map<string, RecommendedRestaurant>();

    // Add preference-based recommendations
    preferenceRecs.forEach(rec => {
      merged.set(rec.restaurant.id, rec);
    });

    // Merge negative feedback recommendations, combining scores
    negativeFeedbackRecs.forEach(rec => {
      const existing = merged.get(rec.restaurant.id);
      if (existing) {
        // Average the scores
        existing.matchScore = (existing.matchScore + rec.matchScore) / 2;
        // Combine reasons
        existing.reasonsForRecommendation = [
          ...existing.reasonsForRecommendation,
          ...rec.reasonsForRecommendation
        ].slice(0, 6); // Limit total reasons
      } else {
        merged.set(rec.restaurant.id, rec);
      }
    });

    return Array.from(merged.values());
  }

  private generateCacheKey(userId: string, request: RecommendationRequest): string {
    const keyParts = [
      userId,
      request.emotionalState || 'neutral',
      request.location ? `${request.location.latitude},${request.location.longitude}` : 'no-location',
      request.context?.timeOfDay || 'any-time',
      request.context?.occasion || 'casual'
    ];
    
    return keyParts.join('|');
  }

  private cleanupCache(): void {
    const now = new Date();
    const keysToDelete: string[] = [];

    this.recommendationCache.forEach((cached, key) => {
      const ageMinutes = (now.getTime() - cached.generatedAt.getTime()) / (1000 * 60);
      if (ageMinutes > cached.ttl) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.recommendationCache.delete(key));
  }

  /**
   * Enhance ML recommendations with additional business logic and confidence scoring
   */
  private async enhanceMLRecommendations(
    mlRecommendations: RecommendedRestaurant[],
    user: User,
    request: RecommendationRequest,
    weights: PersonalizedRecommendationWeights,
    limit: number
  ): Promise<RecommendedRestaurant[]> {
    const enhancedRecommendations = await Promise.all(
      mlRecommendations.map(async (rec) => {
        // Get ML confidence score
        let mlConfidence = 0.7; // Default
        if (this.mlIntegrationService) {
          try {
            const confidenceResult = await this.mlIntegrationService.getMLConfidenceScore(
              user,
              rec.restaurant,
              request
            );
            mlConfidence = confidenceResult.confidence;
          } catch (error) {
            console.warn('Failed to get ML confidence:', error instanceof Error ? error.message : String(error));
          }
        }

        // Calculate traditional confidence for comparison
        const { confidence: traditionalConfidence, reasoning } = this.calculateRecommendationConfidence(
          user,
          rec.restaurant,
          request.emotionalState
        );

        // Blend ML and traditional scores
        const blendedScore = (rec.matchScore * PersonalizedRecommendationService.ML_WEIGHT) + 
                           (traditionalConfidence.overall * (1 - PersonalizedRecommendationService.ML_WEIGHT));

        // Enhance reasons with ML insights
        const enhancedReasons = [
          ...rec.reasonsForRecommendation,
          ...reasoning.primaryReasons.slice(0, 2),
          ...reasoning.emotionalReasons.slice(0, 1)
        ].slice(0, 4);

        return {
          ...rec,
          matchScore: blendedScore,
          reasonsForRecommendation: enhancedReasons
        };
      })
    );

    return enhancedRecommendations
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  }

  /**
   * Blend ML recommendations with traditional recommendations
   */
  private async blendMLWithTraditionalRecommendations(
    mlRecommendations: RecommendedRestaurant[],
    user: User,
    availableRestaurants: Restaurant[],
    request: RecommendationRequest,
    weights: PersonalizedRecommendationWeights,
    limit: number
  ): Promise<RecommendedRestaurant[]> {
    // Get traditional recommendations
    const traditionalRecommendations = await this.generateFreshRecommendations(
      user,
      availableRestaurants,
      request,
      weights,
      Math.ceil(limit * 1.2)
    );

    // Create a map for easy lookup
    const mlMap = new Map(mlRecommendations.map(rec => [rec.restaurant.id, rec]));
    const traditionalMap = new Map(traditionalRecommendations.map(rec => [rec.restaurant.id, rec]));

    // Blend recommendations
    const blendedRecommendations: RecommendedRestaurant[] = [];
    const processedIds = new Set<string>();

    // First, process restaurants that appear in both ML and traditional recommendations
    mlRecommendations.forEach(mlRec => {
      const traditionalRec = traditionalMap.get(mlRec.restaurant.id);
      if (traditionalRec && !processedIds.has(mlRec.restaurant.id)) {
        // Blend scores
        const blendedScore = (mlRec.matchScore * 0.6) + (traditionalRec.matchScore * 0.4);
        
        // Combine reasons
        const combinedReasons = [
          ...mlRec.reasonsForRecommendation.slice(0, 2),
          ...traditionalRec.reasonsForRecommendation.slice(0, 2)
        ].slice(0, 4);

        blendedRecommendations.push({
          restaurant: mlRec.restaurant,
          matchScore: blendedScore,
          emotionalAlignment: Math.max(mlRec.emotionalAlignment, traditionalRec.emotionalAlignment),
          reasonsForRecommendation: combinedReasons
        });

        processedIds.add(mlRec.restaurant.id);
      }
    });

    // Add remaining ML recommendations (not in traditional)
    mlRecommendations.forEach(mlRec => {
      if (!processedIds.has(mlRec.restaurant.id)) {
        blendedRecommendations.push({
          ...mlRec,
          matchScore: mlRec.matchScore * 0.9, // Slight penalty for not being in traditional
          reasonsForRecommendation: [
            ...mlRec.reasonsForRecommendation,
            'AI-discovered recommendation'
          ].slice(0, 4)
        });
        processedIds.add(mlRec.restaurant.id);
      }
    });

    // Add top traditional recommendations (not in ML)
    traditionalRecommendations.slice(0, Math.ceil(limit * 0.3)).forEach(traditionalRec => {
      if (!processedIds.has(traditionalRec.restaurant.id)) {
        blendedRecommendations.push({
          ...traditionalRec,
          matchScore: traditionalRec.matchScore * 0.85, // Penalty for not being in ML
          reasonsForRecommendation: [
            ...traditionalRec.reasonsForRecommendation,
            'Traditional preference match'
          ].slice(0, 4)
        });
        processedIds.add(traditionalRec.restaurant.id);
      }
    });

    return blendedRecommendations
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  }

  /**
   * Get ML model health status
   */
  public async getMLHealthStatus(): Promise<{
    available: boolean;
    health?: { overall: boolean; models: Record<string, boolean>; details: Record<string, string> };
  }> {
    if (!this.mlIntegrationService) {
      return { available: false };
    }

    try {
      const health = await this.mlIntegrationService.checkMLModelsHealth();
      return { available: true, health };
    } catch (error) {
      console.error('ML health check failed:', error);
      return { available: false };
    }
  }
}