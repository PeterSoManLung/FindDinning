import { User } from '../../../shared/src/types/user.types';
import { Restaurant } from '../../../shared/src/types/restaurant.types';
import { RecommendedRestaurant, RecommendationRequest } from '../../../shared/src/types/recommendation.types';
import { MLModelClient, MLModelConfig, ContextFeatures } from './mlModelClient';

export interface MLIntegrationConfig {
  modelConfigs: {
    preference: MLModelConfig;
    collaborative?: MLModelConfig;
    content?: MLModelConfig;
  };
  ensembleWeights: {
    preference: number;
    collaborative: number;
    content: number;
    fallback: number;
  };
  confidenceThreshold: number;
  fallbackEnabled: boolean;
}

export interface MLRecommendationResult {
  recommendations: RecommendedRestaurant[];
  modelMetadata: {
    modelsUsed: string[];
    overallConfidence: number;
    fallbackUsed: boolean;
    processingTime: number;
  };
}

export class MLIntegrationService {
  private preferenceModelClient: MLModelClient;
  private collaborativeModelClient?: MLModelClient;
  private contentModelClient?: MLModelClient;
  private config: MLIntegrationConfig;

  constructor(config: MLIntegrationConfig) {
    this.config = config;
    this.preferenceModelClient = new MLModelClient(config.modelConfigs.preference);
    
    if (config.modelConfigs.collaborative) {
      this.collaborativeModelClient = new MLModelClient(config.modelConfigs.collaborative);
    }
    
    if (config.modelConfigs.content) {
      this.contentModelClient = new MLModelClient(config.modelConfigs.content);
    }
  }

  /**
   * Generate ML-powered recommendations using ensemble of models
   */
  public async generateMLRecommendations(
    user: User,
    restaurants: Restaurant[],
    request: RecommendationRequest,
    limit: number = 10
  ): Promise<MLRecommendationResult> {
    const startTime = Date.now();
    const modelsUsed: string[] = [];
    let fallbackUsed = false;

    try {
      // Build context features from request
      const contextFeatures = this.buildContextFeatures(request);

      // Get predictions from available models
      const modelResults = await Promise.allSettled([
        this.getPreferenceModelPredictions(user, restaurants, contextFeatures),
        this.getCollaborativeModelPredictions(user, restaurants, contextFeatures),
        this.getContentModelPredictions(user, restaurants, contextFeatures)
      ]);

      // Process model results
      const preferenceResult = modelResults[0];
      const collaborativeResult = modelResults[1];
      const contentResult = modelResults[2];

      // Combine predictions using ensemble approach
      const ensemblePredictions = this.combineModelPredictions(
        preferenceResult.status === 'fulfilled' ? preferenceResult.value : null,
        collaborativeResult.status === 'fulfilled' ? collaborativeResult.value : null,
        contentResult.status === 'fulfilled' ? contentResult.value : null,
        restaurants
      );

      // Track which models were used successfully
      if (preferenceResult.status === 'fulfilled') {
        modelsUsed.push('preference');
        fallbackUsed = fallbackUsed || preferenceResult.value.fallbackUsed;
      }
      if (collaborativeResult.status === 'fulfilled') {
        modelsUsed.push('collaborative');
        fallbackUsed = fallbackUsed || collaborativeResult.value.fallbackUsed;
      }
      if (contentResult.status === 'fulfilled') {
        modelsUsed.push('content');
        fallbackUsed = fallbackUsed || contentResult.value.fallbackUsed;
      }

      // Convert to RecommendedRestaurant format
      const recommendations = this.convertToRecommendedRestaurants(
        ensemblePredictions,
        user,
        request,
        limit
      );

      const processingTime = Date.now() - startTime;
      const overallConfidence = this.calculateOverallConfidence(ensemblePredictions, modelsUsed);

      return {
        recommendations,
        modelMetadata: {
          modelsUsed,
          overallConfidence,
          fallbackUsed,
          processingTime
        }
      };

    } catch (error) {
      console.error('ML recommendation generation failed:', error);
      
      if (this.config.fallbackEnabled) {
        return this.generateFallbackRecommendations(user, restaurants, request, limit, startTime);
      }
      
      throw new Error(`ML recommendation generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get confidence score for a specific recommendation using ML models
   */
  public async getMLConfidenceScore(
    user: User,
    restaurant: Restaurant,
    request: RecommendationRequest
  ): Promise<{ score: number; confidence: number; modelBreakdown: Record<string, number> }> {
    try {
      const contextFeatures = this.buildContextFeatures(request);
      const modelBreakdown: Record<string, number> = {};

      // Get confidence from preference model
      try {
        const prefResult = await this.preferenceModelClient.getConfidenceScore(
          user,
          restaurant,
          contextFeatures
        );
        modelBreakdown.preference = prefResult.confidence;
      } catch (error) {
        console.warn('Preference model confidence failed:', error instanceof Error ? error.message : String(error));
        modelBreakdown.preference = 0.3;
      }

      // Get confidence from collaborative model if available
      if (this.collaborativeModelClient) {
        try {
          const collabResult = await this.collaborativeModelClient.getConfidenceScore(
            user,
            restaurant,
            contextFeatures
          );
          modelBreakdown.collaborative = collabResult.confidence;
        } catch (error) {
          console.warn('Collaborative model confidence failed:', error instanceof Error ? error.message : String(error));
          modelBreakdown.collaborative = 0.3;
        }
      }

      // Get confidence from content model if available
      if (this.contentModelClient) {
        try {
          const contentResult = await this.contentModelClient.getConfidenceScore(
            user,
            restaurant,
            contextFeatures
          );
          modelBreakdown.content = contentResult.confidence;
        } catch (error) {
          console.warn('Content model confidence failed:', error instanceof Error ? error.message : String(error));
          modelBreakdown.content = 0.3;
        }
      }

      // Calculate weighted average confidence
      const weights = this.config.ensembleWeights;
      let totalWeight = 0;
      let weightedSum = 0;

      if (modelBreakdown.preference !== undefined) {
        weightedSum += modelBreakdown.preference * weights.preference;
        totalWeight += weights.preference;
      }
      if (modelBreakdown.collaborative !== undefined) {
        weightedSum += modelBreakdown.collaborative * weights.collaborative;
        totalWeight += weights.collaborative;
      }
      if (modelBreakdown.content !== undefined) {
        weightedSum += modelBreakdown.content * weights.content;
        totalWeight += weights.content;
      }

      const overallConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0.3;

      // Calculate overall score (simplified for this implementation)
      const score = Math.min(overallConfidence * 1.2, 1.0);

      return {
        score,
        confidence: overallConfidence,
        modelBreakdown
      };

    } catch (error) {
      console.error('ML confidence calculation failed:', error);
      return {
        score: 0.5,
        confidence: 0.3,
        modelBreakdown: { fallback: 0.3 }
      };
    }
  }

  /**
   * Check health of all ML models
   */
  public async checkMLModelsHealth(): Promise<{
    overall: boolean;
    models: Record<string, boolean>;
    details: Record<string, string>;
  }> {
    const results: Record<string, boolean> = {};
    const details: Record<string, string> = {};

    // Check preference model
    try {
      results.preference = await this.preferenceModelClient.checkModelHealth();
      details.preference = results.preference ? 'Healthy' : 'Unhealthy';
    } catch (error) {
      results.preference = false;
      details.preference = `Error: ${error instanceof Error ? error.message : String(error)}`;
    }

    // Check collaborative model if available
    if (this.collaborativeModelClient) {
      try {
        results.collaborative = await this.collaborativeModelClient.checkModelHealth();
        details.collaborative = results.collaborative ? 'Healthy' : 'Unhealthy';
      } catch (error) {
        results.collaborative = false;
        details.collaborative = `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    // Check content model if available
    if (this.contentModelClient) {
      try {
        results.content = await this.contentModelClient.checkModelHealth();
        details.content = results.content ? 'Healthy' : 'Unhealthy';
      } catch (error) {
        results.content = false;
        details.content = `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    // Overall health is true if at least one model is healthy
    const overall = Object.values(results).some(healthy => healthy);

    return { overall, models: results, details };
  }

  private async getPreferenceModelPredictions(
    user: User,
    restaurants: Restaurant[],
    context?: ContextFeatures
  ) {
    return await this.preferenceModelClient.getPreferencePredictions(user, restaurants, context);
  }

  private async getCollaborativeModelPredictions(
    user: User,
    restaurants: Restaurant[],
    context?: ContextFeatures
  ) {
    if (!this.collaborativeModelClient) {
      throw new Error('Collaborative model not configured');
    }
    return await this.collaborativeModelClient.getPreferencePredictions(user, restaurants, context);
  }

  private async getContentModelPredictions(
    user: User,
    restaurants: Restaurant[],
    context?: ContextFeatures
  ) {
    if (!this.contentModelClient) {
      throw new Error('Content model not configured');
    }
    return await this.contentModelClient.getPreferencePredictions(user, restaurants, context);
  }

  private buildContextFeatures(request: RecommendationRequest): ContextFeatures {
    const now = new Date();
    
    return {
      timeOfDay: this.getTimeOfDay(now),
      dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(),
      season: this.getSeason(now),
      groupSize: request.context?.groupSize,
      occasion: request.context?.occasion
    };
  }

  private getTimeOfDay(date: Date): string {
    const hour = date.getHours();
    if (hour < 11) return 'morning';
    if (hour < 15) return 'lunch';
    if (hour < 18) return 'afternoon';
    if (hour < 22) return 'dinner';
    return 'late_night';
  }

  private getSeason(date: Date): string {
    const month = date.getMonth() + 1; // 1-12
    if (month >= 3 && month <= 5) return 'spring';
    if (month >= 6 && month <= 8) return 'summer';
    if (month >= 9 && month <= 11) return 'autumn';
    return 'winter';
  }

  private combineModelPredictions(
    preferenceResult: any,
    collaborativeResult: any,
    contentResult: any,
    restaurants: Restaurant[]
  ): Array<{ restaurant: Restaurant; score: number; confidence: number; features: Record<string, any> }> {
    const restaurantMap = new Map(restaurants.map(r => [r.id, r]));
    const combinedScores = new Map<string, { scores: number[]; confidences: number[]; features: Record<string, any>[] }>();

    // Process preference model results
    if (preferenceResult && preferenceResult.predictions) {
      preferenceResult.predictions.forEach((pred: any) => {
        if (!combinedScores.has(pred.restaurantId)) {
          combinedScores.set(pred.restaurantId, { scores: [], confidences: [], features: [] });
        }
        const entry = combinedScores.get(pred.restaurantId)!;
        entry.scores.push(pred.score * this.config.ensembleWeights.preference);
        entry.confidences.push(pred.confidence);
        entry.features.push({ ...pred.features, model: 'preference' });
      });
    }

    // Process collaborative model results
    if (collaborativeResult && collaborativeResult.predictions) {
      collaborativeResult.predictions.forEach((pred: any) => {
        if (!combinedScores.has(pred.restaurantId)) {
          combinedScores.set(pred.restaurantId, { scores: [], confidences: [], features: [] });
        }
        const entry = combinedScores.get(pred.restaurantId)!;
        entry.scores.push(pred.score * this.config.ensembleWeights.collaborative);
        entry.confidences.push(pred.confidence);
        entry.features.push({ ...pred.features, model: 'collaborative' });
      });
    }

    // Process content model results
    if (contentResult && contentResult.predictions) {
      contentResult.predictions.forEach((pred: any) => {
        if (!combinedScores.has(pred.restaurantId)) {
          combinedScores.set(pred.restaurantId, { scores: [], confidences: [], features: [] });
        }
        const entry = combinedScores.get(pred.restaurantId)!;
        entry.scores.push(pred.score * this.config.ensembleWeights.content);
        entry.confidences.push(pred.confidence);
        entry.features.push({ ...pred.features, model: 'content' });
      });
    }

    // Combine scores and create final results
    const results: Array<{ restaurant: Restaurant; score: number; confidence: number; features: Record<string, any> }> = [];

    combinedScores.forEach((data, restaurantId) => {
      const restaurant = restaurantMap.get(restaurantId);
      if (!restaurant) return;

      // Calculate ensemble score
      const totalScore = data.scores.reduce((sum, score) => sum + score, 0);
      const normalizedScore = Math.min(totalScore, 1.0);

      // Calculate average confidence
      const avgConfidence = data.confidences.reduce((sum, conf) => sum + conf, 0) / data.confidences.length;

      // Combine features
      const combinedFeatures: Record<string, any> = {};
      data.features.forEach(featureSet => {
        Object.entries(featureSet).forEach(([key, value]) => {
          if (typeof value === 'number') {
            combinedFeatures[key] = (combinedFeatures[key] || 0) + value;
          } else {
            combinedFeatures[key] = value;
          }
        });
      });

      results.push({
        restaurant,
        score: normalizedScore,
        confidence: avgConfidence,
        features: combinedFeatures
      });
    });

    return results.sort((a, b) => b.score - a.score);
  }

  private convertToRecommendedRestaurants(
    predictions: Array<{ restaurant: Restaurant; score: number; confidence: number; features: Record<string, any> }>,
    user: User,
    request: RecommendationRequest,
    limit: number
  ): RecommendedRestaurant[] {
    return predictions.slice(0, limit).map(prediction => {
      const reasons = this.generateMLReasons(prediction, user, request);
      
      return {
        restaurant: prediction.restaurant,
        matchScore: prediction.score,
        emotionalAlignment: this.calculateEmotionalAlignment(prediction.restaurant, request.emotionalState),
        reasonsForRecommendation: reasons
      };
    });
  }

  private generateMLReasons(
    prediction: { restaurant: Restaurant; score: number; confidence: number; features: Record<string, any> },
    user: User,
    request: RecommendationRequest
  ): string[] {
    const reasons: string[] = [];

    // High confidence reasons
    if (prediction.confidence > 0.8) {
      reasons.push('High AI confidence match based on your dining patterns');
    }

    // Feature-based reasons
    if (prediction.features.cuisineMatch > 0.7) {
      reasons.push('Strong cuisine preference match');
    }

    if (prediction.features.atmosphereMatch > 0.7) {
      reasons.push('Perfect atmosphere for your preferences');
    }

    if (prediction.features.popularityScore > 0.8) {
      reasons.push('Highly rated by similar users');
    }

    // Emotional alignment
    if (request.emotionalState && prediction.features.emotionalAlignment > 0.7) {
      reasons.push(`Great choice for when you're feeling ${request.emotionalState}`);
    }

    // Local gem bonus
    if (prediction.restaurant.isLocalGem) {
      reasons.push('Authentic local gem discovered by AI');
    }

    // Fallback reason
    if (reasons.length === 0) {
      reasons.push('Recommended based on your dining history');
    }

    return reasons.slice(0, 3); // Limit to top 3 reasons
  }

  private calculateEmotionalAlignment(restaurant: Restaurant, emotionalState?: string): number {
    if (!emotionalState) return 0.5;

    // Simple emotional alignment calculation
    const emotionalAtmosphereMap: Record<string, string[]> = {
      'happy': ['lively', 'vibrant', 'casual', 'fun'],
      'sad': ['cozy', 'quiet', 'intimate', 'warm'],
      'celebrating': ['upscale', 'elegant', 'festive', 'special'],
      'stressed': ['calm', 'peaceful', 'quiet', 'relaxing'],
      'romantic': ['intimate', 'romantic', 'cozy', 'elegant'],
      'social': ['lively', 'social', 'vibrant', 'casual']
    };

    const preferredAtmospheres = emotionalAtmosphereMap[emotionalState] || [];
    const matchingAtmospheres = restaurant.atmosphere.filter(atm => 
      preferredAtmospheres.includes(atm.toLowerCase())
    );

    return matchingAtmospheres.length > 0 ? 0.8 : 0.3;
  }

  private calculateOverallConfidence(
    predictions: Array<{ confidence: number }>,
    modelsUsed: string[]
  ): number {
    if (predictions.length === 0) return 0.3;

    const avgConfidence = predictions.reduce((sum, pred) => sum + pred.confidence, 0) / predictions.length;
    
    // Boost confidence if multiple models were used
    const modelBonus = Math.min(modelsUsed.length * 0.1, 0.2);
    
    return Math.min(avgConfidence + modelBonus, 1.0);
  }

  private generateFallbackRecommendations(
    user: User,
    restaurants: Restaurant[],
    request: RecommendationRequest,
    limit: number,
    startTime: number
  ): MLRecommendationResult {
    console.warn('Using complete fallback for ML recommendations');

    // Simple rule-based recommendations as fallback
    const recommendations: RecommendedRestaurant[] = restaurants
      .map(restaurant => {
        let score = 0.5;

        // Basic preference matching
        const matchingCuisines = restaurant.cuisineType.filter(cuisine => 
          user.preferences.cuisineTypes.includes(cuisine)
        );
        if (matchingCuisines.length > 0) {
          score += 0.2;
        }

        // Price range matching
        if (restaurant.priceRange >= user.preferences.priceRange[0] && 
            restaurant.priceRange <= user.preferences.priceRange[1]) {
          score += 0.15;
        }

        // Negative feedback penalty
        score -= restaurant.negativeScore * 0.2;

        // Local gem bonus
        if (restaurant.isLocalGem) {
          score += 0.1;
        }

        score = Math.max(0, Math.min(score, 1.0));

        return {
          restaurant,
          matchScore: score,
          emotionalAlignment: this.calculateEmotionalAlignment(restaurant, request.emotionalState),
          reasonsForRecommendation: ['Based on your basic preferences (fallback mode)']
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    const processingTime = Date.now() - startTime;

    return {
      recommendations,
      modelMetadata: {
        modelsUsed: ['fallback'],
        overallConfidence: 0.3,
        fallbackUsed: true,
        processingTime
      }
    };
  }
}