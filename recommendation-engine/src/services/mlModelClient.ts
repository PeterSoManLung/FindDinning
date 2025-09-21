import { User } from '../../../shared/src/types/user.types';
import { Restaurant } from '../../../shared/src/types/restaurant.types';

export interface MLModelPrediction {
  restaurantId: string;
  score: number;
  confidence: number;
  features: Record<string, number>;
  modelVersion: string;
}

export interface MLModelRequest {
  userId: string;
  userFeatures: UserFeatures;
  restaurantFeatures: RestaurantFeatures[];
  context?: ContextFeatures;
}

export interface UserFeatures {
  cuisinePreferences: Record<string, number>;
  priceRangePreference: number;
  atmospherePreferences: Record<string, number>;
  diningHistoryLength: number;
  averageRating: number;
  diversityScore: number;
}

export interface RestaurantFeatures {
  restaurantId: string;
  cuisineTypes: Record<string, number>;
  priceRange: number;
  rating: number;
  negativeScore: number;
  authenticityScore: number;
  isLocalGem: boolean;
  atmosphereFeatures: Record<string, number>;
  popularityScore: number;
}

export interface ContextFeatures {
  timeOfDay: string;
  dayOfWeek: string;
  season: string;
  weather?: string;
  groupSize?: number;
  occasion?: string;
}

export interface MLModelResponse {
  predictions: MLModelPrediction[];
  modelMetadata: {
    modelId: string;
    version: string;
    timestamp: string;
    confidence: number;
  };
  fallbackUsed: boolean;
}

export interface MLModelConfig {
  sagemakerEndpoint: string;
  region: string;
  timeout: number;
  retryAttempts: number;
  fallbackEnabled: boolean;
}

export class MLModelClient {
  private config: MLModelConfig;
  private isHealthy: boolean = true;
  private lastHealthCheck: Date = new Date();
  private readonly HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor(config: MLModelConfig) {
    this.config = config;
  }

  /**
   * Get preference predictions from ML model
   */
  public async getPreferencePredictions(
    user: User,
    restaurants: Restaurant[],
    context?: ContextFeatures
  ): Promise<MLModelResponse> {
    try {
      // Check model health before making request
      await this.checkModelHealth();

      if (!this.isHealthy && this.config.fallbackEnabled) {
        return this.getFallbackPredictions(user, restaurants, context);
      }

      const request = this.buildMLRequest(user, restaurants, context);
      const response = await this.callSageMakerEndpoint(request);
      
      return {
        predictions: response.predictions,
        modelMetadata: response.modelMetadata,
        fallbackUsed: false
      };

    } catch (error) {
      console.error('ML Model prediction failed:', error);
      
      if (this.config.fallbackEnabled) {
        return this.getFallbackPredictions(user, restaurants, context);
      }
      
      throw new Error(`ML Model prediction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get confidence score for a specific user-restaurant pair
   */
  public async getConfidenceScore(
    user: User,
    restaurant: Restaurant,
    context?: ContextFeatures
  ): Promise<{ score: number; confidence: number; features: Record<string, number> }> {
    try {
      const predictions = await this.getPreferencePredictions(user, [restaurant], context);
      const prediction = predictions.predictions[0];
      
      if (!prediction) {
        throw new Error('No prediction returned for restaurant');
      }

      return {
        score: prediction.score,
        confidence: prediction.confidence,
        features: prediction.features
      };

    } catch (error) {
      console.error('Confidence score calculation failed:', error);
      
      // Return fallback confidence score
      return {
        score: 0.5,
        confidence: 0.3,
        features: { fallback: 1.0 }
      };
    }
  }

  /**
   * Process ML model results and apply business logic
   */
  public processModelResults(
    predictions: MLModelPrediction[],
    restaurants: Restaurant[],
    user: User
  ): Array<{ restaurant: Restaurant; mlScore: number; confidence: number; features: Record<string, number> }> {
    const restaurantMap = new Map(restaurants.map(r => [r.id, r]));
    
    return predictions
      .map(prediction => {
        const restaurant = restaurantMap.get(prediction.restaurantId);
        if (!restaurant) return null;

        // Apply business rules to ML score
        let adjustedScore = prediction.score;
        
        // Boost local gems
        if (restaurant.isLocalGem) {
          adjustedScore = Math.min(adjustedScore * 1.1, 1.0);
        }
        
        // Penalize high negative feedback
        if (restaurant.negativeScore > 0.7) {
          adjustedScore = adjustedScore * 0.8;
        }
        
        // Boost authentic restaurants
        if (restaurant.authenticityScore > 0.8) {
          adjustedScore = Math.min(adjustedScore * 1.05, 1.0);
        }

        return {
          restaurant,
          mlScore: adjustedScore,
          confidence: prediction.confidence,
          features: prediction.features
        };
      })
      .filter(result => result !== null)
      .sort((a, b) => b.mlScore - a.mlScore);
  }

  /**
   * Check if ML model is healthy and responsive
   */
  public async checkModelHealth(): Promise<boolean> {
    const now = new Date();
    
    // Skip health check if recently performed
    if (now.getTime() - this.lastHealthCheck.getTime() < this.HEALTH_CHECK_INTERVAL) {
      return this.isHealthy;
    }

    try {
      // Simple health check with minimal request
      const healthCheckRequest = this.buildHealthCheckRequest();
      const response = await this.callSageMakerEndpoint(healthCheckRequest, 5000); // 5 second timeout
      
      this.isHealthy = response && response.predictions && response.predictions.length > 0;
      this.lastHealthCheck = now;
      
      return this.isHealthy;

    } catch (error) {
      console.warn('ML Model health check failed:', error instanceof Error ? error.message : String(error));
      this.isHealthy = false;
      this.lastHealthCheck = now;
      return false;
    }
  }

  /**
   * Get fallback predictions when ML model is unavailable
   */
  private getFallbackPredictions(
    user: User,
    restaurants: Restaurant[],
    context?: ContextFeatures
  ): MLModelResponse {
    console.warn('Using fallback predictions - ML model unavailable');
    
    const predictions: MLModelPrediction[] = restaurants.map(restaurant => {
      // Simple rule-based scoring as fallback
      let score = 0.5; // Base score
      
      // Cuisine preference matching
      const matchingCuisines = restaurant.cuisineType.filter(cuisine => 
        user.preferences.cuisineTypes.includes(cuisine)
      );
      if (matchingCuisines.length > 0) {
        score += 0.2 * (matchingCuisines.length / restaurant.cuisineType.length);
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
      
      // Authenticity bonus
      score += restaurant.authenticityScore * 0.1;
      
      score = Math.max(0, Math.min(score, 1.0));
      
      return {
        restaurantId: restaurant.id,
        score,
        confidence: 0.4, // Lower confidence for fallback
        features: {
          cuisineMatch: matchingCuisines.length > 0 ? 1 : 0,
          priceMatch: (restaurant.priceRange >= user.preferences.priceRange[0] && 
                      restaurant.priceRange <= user.preferences.priceRange[1]) ? 1 : 0,
          negativeScore: restaurant.negativeScore,
          isLocalGem: restaurant.isLocalGem ? 1 : 0,
          authenticityScore: restaurant.authenticityScore,
          fallback: 1.0
        },
        modelVersion: 'fallback-v1.0'
      };
    });

    return {
      predictions,
      modelMetadata: {
        modelId: 'fallback-model',
        version: 'v1.0',
        timestamp: new Date().toISOString(),
        confidence: 0.4
      },
      fallbackUsed: true
    };
  }

  /**
   * Build ML request from user and restaurant data
   */
  private buildMLRequest(
    user: User,
    restaurants: Restaurant[],
    context?: ContextFeatures
  ): MLModelRequest {
    const userFeatures = this.extractUserFeatures(user);
    const restaurantFeatures = restaurants.map(r => this.extractRestaurantFeatures(r));
    
    return {
      userId: user.id,
      userFeatures,
      restaurantFeatures,
      context
    };
  }

  /**
   * Extract ML features from user data
   */
  private extractUserFeatures(user: User): UserFeatures {
    // Convert cuisine preferences to numerical features
    const cuisinePreferences: Record<string, number> = {};
    user.preferences.cuisineTypes.forEach(cuisine => {
      cuisinePreferences[cuisine] = 1.0;
    });

    // Convert atmosphere preferences to numerical features
    const atmospherePreferences: Record<string, number> = {};
    user.preferences.atmospherePreferences.forEach(atmosphere => {
      atmospherePreferences[atmosphere] = 1.0;
    });

    // Calculate average rating from dining history
    const averageRating = user.diningHistory.length > 0 
      ? user.diningHistory.reduce((sum, visit) => sum + (visit.rating || 0), 0) / user.diningHistory.length
      : 0;

    // Calculate diversity score (how varied user's dining history is)
    // Note: DiningHistory doesn't have cuisineType, so we'll use a simplified calculation
    const diversityScore = user.diningHistory.length > 0 
      ? Math.min(user.diningHistory.length / 10, 1.0) // Simple diversity based on history length
      : 0;

    return {
      cuisinePreferences,
      priceRangePreference: (user.preferences.priceRange[0] + user.preferences.priceRange[1]) / 2,
      atmospherePreferences,
      diningHistoryLength: user.diningHistory.length,
      averageRating,
      diversityScore
    };
  }

  /**
   * Extract ML features from restaurant data
   */
  private extractRestaurantFeatures(restaurant: Restaurant): RestaurantFeatures {
    // Convert cuisine types to numerical features
    const cuisineTypes: Record<string, number> = {};
    restaurant.cuisineType.forEach(cuisine => {
      cuisineTypes[cuisine] = 1.0;
    });

    // Convert atmosphere to numerical features
    const atmosphereFeatures: Record<string, number> = {};
    restaurant.atmosphere.forEach(atmosphere => {
      atmosphereFeatures[atmosphere] = 1.0;
    });

    // Calculate popularity score based on various factors
    const popularityScore = Math.min(
      (restaurant.rating * 0.4) + 
      ((1 - restaurant.negativeScore) * 0.3) + 
      (restaurant.authenticityScore * 0.3),
      1.0
    );

    return {
      restaurantId: restaurant.id,
      cuisineTypes,
      priceRange: restaurant.priceRange,
      rating: restaurant.rating,
      negativeScore: restaurant.negativeScore,
      authenticityScore: restaurant.authenticityScore,
      isLocalGem: restaurant.isLocalGem,
      atmosphereFeatures,
      popularityScore
    };
  }

  /**
   * Build minimal health check request
   */
  private buildHealthCheckRequest(): MLModelRequest {
    return {
      userId: 'health-check',
      userFeatures: {
        cuisinePreferences: { 'cantonese': 1.0 },
        priceRangePreference: 2,
        atmospherePreferences: { 'casual': 1.0 },
        diningHistoryLength: 1,
        averageRating: 4.0,
        diversityScore: 0.5
      },
      restaurantFeatures: [{
        restaurantId: 'health-check-restaurant',
        cuisineTypes: { 'cantonese': 1.0 },
        priceRange: 2,
        rating: 4.0,
        negativeScore: 0.2,
        authenticityScore: 0.8,
        isLocalGem: true,
        atmosphereFeatures: { 'casual': 1.0 },
        popularityScore: 0.8
      }]
    };
  }

  /**
   * Call SageMaker endpoint with retry logic
   */
  private async callSageMakerEndpoint(
    request: MLModelRequest,
    timeoutMs?: number
  ): Promise<{ predictions: MLModelPrediction[]; modelMetadata: any }> {
    const timeout = timeoutMs || this.config.timeout;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        // In a real implementation, this would call AWS SageMaker
        // For now, simulate the call with a mock response
        const response = await this.mockSageMakerCall(request, timeout);
        return response;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`SageMaker call attempt ${attempt} failed:`, error instanceof Error ? error.message : String(error));
        
        if (attempt < this.config.retryAttempts) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Mock SageMaker call for development/testing
   * In production, this would be replaced with actual AWS SDK calls
   */
  private async mockSageMakerCall(
    request: MLModelRequest,
    timeoutMs: number
  ): Promise<{ predictions: MLModelPrediction[]; modelMetadata: any }> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100));

    // Simulate occasional failures for testing
    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error('Simulated SageMaker endpoint failure');
    }

    const predictions: MLModelPrediction[] = request.restaurantFeatures.map(restaurant => ({
      restaurantId: restaurant.restaurantId,
      score: Math.random() * 0.4 + 0.4, // Random score between 0.4 and 0.8
      confidence: Math.random() * 0.3 + 0.6, // Random confidence between 0.6 and 0.9
      features: {
        cuisineMatch: Math.random(),
        priceMatch: Math.random(),
        atmosphereMatch: Math.random(),
        popularityScore: restaurant.popularityScore,
        authenticityBonus: restaurant.authenticityScore * 0.1
      },
      modelVersion: 'mock-v1.0'
    }));

    return {
      predictions,
      modelMetadata: {
        modelId: 'preference-prediction-model',
        version: 'v1.0',
        timestamp: new Date().toISOString(),
        confidence: 0.85
      }
    };
  }
}