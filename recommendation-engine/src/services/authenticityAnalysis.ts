import { Restaurant, PlatformData } from '../../../shared/src/types/restaurant.types';

export interface AuthenticityScore {
  overall: number; // 0-1 scale, higher means more authentic
  localGemScore: number;
  chainPenalty: number;
  reviewAuthenticity: number;
  hongKongCuisineAuthenticity: number;
  hiddenGemBonus: number;
}

export interface LocalGemCriteria {
  maxReviewCount: number;
  minAuthenticityScore: number;
  preferredCuisines: string[];
  maxChainPresence: number;
  minLocalCharacteristics: number;
}

export interface ReviewAuthenticityAnalysis {
  artificialInflationScore: number; // 0-1 scale, higher means more artificial
  genuineQualityScore: number; // 0-1 scale, higher means more genuine
  reviewPatternSuspicion: number; // 0-1 scale, higher means more suspicious
  negativeReviewSuppression: number; // 0-1 scale, higher means more suppression
}

export class AuthenticityAnalysisService {
  private static readonly HONG_KONG_CUISINES = [
    'cantonese', 'dim_sum', 'cha_chaan_teng', 'hong_kong_style',
    'teochew', 'hakka', 'hong_kong_fusion'
  ];

  private static readonly CHAIN_INDICATORS = [
    'mcdonald', 'kfc', 'pizza_hut', 'starbucks', 'subway',
    'burger_king', 'domino', 'papa_john', 'yoshinoya'
  ];

  private static readonly LOCAL_CHARACTERISTICS = [
    'family_owned', 'traditional_recipe', 'local_favorite',
    'neighborhood_gem', 'authentic_ingredients', 'local_chef'
  ];

  /**
   * Analyze restaurant authenticity and local gem status
   */
  public analyzeAuthenticity(restaurant: Restaurant): AuthenticityScore {
    const localGemScore = this.calculateLocalGemScore(restaurant);
    const chainPenalty = this.calculateChainPenalty(restaurant);
    const reviewAuthenticity = this.analyzeReviewAuthenticity(restaurant);
    const hongKongCuisineAuthenticity = this.analyzeHongKongCuisineAuthenticity(restaurant);
    const hiddenGemBonus = this.calculateHiddenGemBonus(restaurant);

    // Calculate overall authenticity score
    const overall = Math.min(1.0, 
      localGemScore * 0.25 +
      (1 - chainPenalty) * 0.2 +
      reviewAuthenticity * 0.25 +
      hongKongCuisineAuthenticity * 0.2 +
      hiddenGemBonus * 0.1
    );

    return {
      overall,
      localGemScore,
      chainPenalty,
      reviewAuthenticity,
      hongKongCuisineAuthenticity,
      hiddenGemBonus
    };
  }

  /**
   * Prioritize authentic local establishments over chains
   */
  public prioritizeLocalEstablishments(restaurants: Restaurant[]): Restaurant[] {
    return restaurants.sort((a, b) => {
      const aAuthenticity = this.analyzeAuthenticity(a);
      const bAuthenticity = this.analyzeAuthenticity(b);

      // Primary sort by authenticity
      if (Math.abs(aAuthenticity.overall - bAuthenticity.overall) > 0.1) {
        return bAuthenticity.overall - aAuthenticity.overall;
      }

      // Secondary sort by local gem status
      if (a.isLocalGem !== b.isLocalGem) {
        return a.isLocalGem ? -1 : 1;
      }

      // Tertiary sort by rating
      return b.rating - a.rating;
    });
  }

  /**
   * Identify hidden gems based on low negative feedback despite lower marketing presence
   */
  public identifyHiddenGems(
    restaurants: Restaurant[],
    criteria: LocalGemCriteria = this.getDefaultLocalGemCriteria()
  ): Restaurant[] {
    return restaurants.filter(restaurant => {
      // Must have low negative feedback
      if (restaurant.negativeScore > 0.3) return false;

      // Must not be over-marketed (low review count relative to quality)
      const totalReviews = restaurant.platformData.reduce((sum, data) => sum + data.reviewCount, 0);
      if (totalReviews > criteria.maxReviewCount) return false;

      // Must have good authenticity score
      const authenticity = this.analyzeAuthenticity(restaurant);
      if (authenticity.overall < criteria.minAuthenticityScore) return false;

      // Must have local characteristics
      const localCharacteristics = this.countLocalCharacteristics(restaurant);
      if (localCharacteristics < criteria.minLocalCharacteristics) return false;

      // Must not be a chain
      const chainScore = this.calculateChainPenalty(restaurant);
      if (chainScore > criteria.maxChainPresence) return false;

      return true;
    }).sort((a, b) => {
      // Sort by authenticity score
      const aAuthenticity = this.analyzeAuthenticity(a);
      const bAuthenticity = this.analyzeAuthenticity(b);
      return bAuthenticity.overall - aAuthenticity.overall;
    });
  }

  /**
   * Analyze Hong Kong cuisine authenticity using negative feedback analysis
   */
  public analyzeHongKongCuisineAuthenticity(restaurant: Restaurant): number {
    let authenticityScore = 0.5; // Base score

    // Check if it's a Hong Kong cuisine
    const isHongKongCuisine = restaurant.cuisineType.some(cuisine => 
      AuthenticityAnalysisService.HONG_KONG_CUISINES.includes(cuisine.toLowerCase())
    );

    if (!isHongKongCuisine) {
      return 0.3; // Lower score for non-HK cuisines
    }

    // Boost for local gem status
    if (restaurant.isLocalGem) {
      authenticityScore += 0.3;
    }

    // Boost for traditional characteristics
    const traditionalFeatures = restaurant.specialFeatures.filter(feature =>
      ['traditional', 'authentic', 'family_recipe', 'local_style'].some(keyword =>
        feature.toLowerCase().includes(keyword)
      )
    );
    authenticityScore += traditionalFeatures.length * 0.1;

    // Analyze negative feedback for authenticity indicators
    const authenticityFromNegativeFeedback = this.analyzeAuthenticityFromNegativeFeedback(restaurant);
    authenticityScore += authenticityFromNegativeFeedback * 0.2;

    // Penalty for chain characteristics
    const chainPenalty = this.calculateChainPenalty(restaurant);
    authenticityScore -= chainPenalty * 0.3;

    return Math.min(Math.max(authenticityScore, 0), 1.0);
  }

  /**
   * Identify restaurants with artificially inflated positive reviews vs genuine quality
   */
  public analyzeReviewAuthenticity(restaurant: Restaurant): number {
    if (restaurant.platformData.length === 0) {
      return 0.5; // Neutral score if no platform data
    }

    const reviewAnalysis = this.analyzeReviewPatterns(restaurant);
    
    // Calculate authenticity based on multiple factors
    let authenticityScore = 0.5;

    // Penalty for artificial inflation
    authenticityScore -= reviewAnalysis.artificialInflationScore * 0.4;

    // Bonus for genuine quality indicators
    authenticityScore += reviewAnalysis.genuineQualityScore * 0.3;

    // Penalty for suspicious review patterns
    authenticityScore -= reviewAnalysis.reviewPatternSuspicion * 0.2;

    // Penalty for negative review suppression
    authenticityScore -= reviewAnalysis.negativeReviewSuppression * 0.1;

    return Math.min(Math.max(authenticityScore, 0), 1.0);
  }

  private calculateLocalGemScore(restaurant: Restaurant): number {
    let score = 0;

    // Base score for being marked as local gem
    if (restaurant.isLocalGem) {
      score += 0.6;
    }

    // Boost for local characteristics
    const localCharacteristics = this.countLocalCharacteristics(restaurant);
    score += localCharacteristics * 0.1;

    // Boost for authentic atmosphere
    const authenticAtmosphere = restaurant.atmosphere.filter(atm =>
      ['traditional', 'authentic', 'local', 'neighborhood'].some(keyword =>
        atm.toLowerCase().includes(keyword)
      )
    );
    score += authenticAtmosphere.length * 0.05;

    // Boost for government license (indicates legitimacy)
    if (restaurant.governmentLicense.isValid) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  private calculateChainPenalty(restaurant: Restaurant): number {
    const restaurantName = restaurant.name.toLowerCase();
    
    // Check if name matches known chains
    const isChain = AuthenticityAnalysisService.CHAIN_INDICATORS.some(chain =>
      restaurantName.includes(chain)
    );

    if (isChain) {
      return 0.8; // High penalty for obvious chains
    }

    // Check for chain-like characteristics
    let chainScore = 0;

    // Multiple locations indicator (would need additional data)
    // For now, use platform data consistency as proxy
    if (restaurant.platformData.length > 3) {
      const avgRating = restaurant.platformData.reduce((sum, data) => sum + data.rating, 0) / restaurant.platformData.length;
      const ratingVariance = restaurant.platformData.reduce((sum, data) => 
        sum + Math.pow(data.rating - avgRating, 2), 0) / restaurant.platformData.length;
      
      // Low variance might indicate standardized chain experience
      if (ratingVariance < 0.1) {
        chainScore += 0.3;
      }
    }

    // Generic atmosphere indicators
    const genericAtmosphere = restaurant.atmosphere.filter(atm =>
      ['corporate', 'standardized', 'franchise', 'chain'].some(keyword =>
        atm.toLowerCase().includes(keyword)
      )
    );
    chainScore += genericAtmosphere.length * 0.2;

    return Math.min(chainScore, 1.0);
  }

  private analyzeReviewPatterns(restaurant: Restaurant): ReviewAuthenticityAnalysis {
    let artificialInflationScore = 0;
    let genuineQualityScore = 0;
    let reviewPatternSuspicion = 0;
    let negativeReviewSuppression = 0;

    restaurant.platformData.forEach(data => {
      // Analyze artificial inflation
      if (data.rating > 4.5 && data.reviewCount > 1000) {
        // Very high rating with many reviews might be suspicious
        artificialInflationScore += 0.2;
      }

      // Analyze genuine quality
      if (data.rating >= 4.0 && data.rating <= 4.5 && data.reviewCount > 50) {
        // Moderate rating with decent review count suggests genuine quality
        genuineQualityScore += 0.3;
      }

      // Analyze review pattern suspicion
      if (data.dataReliability < 0.7) {
        reviewPatternSuspicion += 0.3;
      }

      // Analyze negative review suppression
      // This would require more detailed review analysis
      // For now, use negative score as proxy
      if (restaurant.negativeScore < 0.1 && data.rating > 4.7) {
        // Suspiciously low negative feedback with very high rating
        negativeReviewSuppression += 0.2;
      }
    });

    return {
      artificialInflationScore: Math.min(artificialInflationScore, 1.0),
      genuineQualityScore: Math.min(genuineQualityScore, 1.0),
      reviewPatternSuspicion: Math.min(reviewPatternSuspicion, 1.0),
      negativeReviewSuppression: Math.min(negativeReviewSuppression, 1.0)
    };
  }

  private analyzeAuthenticityFromNegativeFeedback(restaurant: Restaurant): number {
    // Analyze negative feedback trends for authenticity indicators
    let authenticityScore = 0;

    restaurant.negativeFeedbackTrends.forEach(trend => {
      // Complaints about "not authentic" or "westernized" reduce authenticity
      if (trend.category.includes('authenticity') || trend.category.includes('traditional')) {
        if (trend.trend === 'declining') {
          authenticityScore -= trend.severity * 0.3;
        } else if (trend.trend === 'improving') {
          authenticityScore += trend.severity * 0.2;
        }
      }

      // Complaints about service being "too commercial" might indicate chain-like behavior
      if (trend.category.includes('service') && trend.severity > 0.6) {
        authenticityScore -= 0.1;
      }
    });

    return Math.min(Math.max(authenticityScore + 0.5, 0), 1.0); // Normalize to 0-1
  }

  private calculateHiddenGemBonus(restaurant: Restaurant): number {
    let bonus = 0;

    // Low marketing presence but good quality
    const totalReviews = restaurant.platformData.reduce((sum, data) => sum + data.reviewCount, 0);
    if (totalReviews < 100 && restaurant.rating >= 4.0 && restaurant.negativeScore <= 0.3) {
      bonus += 0.5; // Hidden gem bonus
    }

    // Local gem with authentic characteristics
    if (restaurant.isLocalGem && this.countLocalCharacteristics(restaurant) >= 2) {
      bonus += 0.3;
    }

    // Government licensed but not over-commercialized
    if (restaurant.governmentLicense.isValid && totalReviews < 500) {
      bonus += 0.2;
    }

    return Math.min(bonus, 1.0);
  }

  private countLocalCharacteristics(restaurant: Restaurant): number {
    let count = 0;

    // Check special features for local characteristics
    restaurant.specialFeatures.forEach(feature => {
      if (AuthenticityAnalysisService.LOCAL_CHARACTERISTICS.some(characteristic =>
        feature.toLowerCase().includes(characteristic.replace('_', ' '))
      )) {
        count++;
      }
    });

    // Check atmosphere for local characteristics
    restaurant.atmosphere.forEach(atmosphere => {
      if (['traditional', 'authentic', 'local', 'family'].some(keyword =>
        atmosphere.toLowerCase().includes(keyword)
      )) {
        count++;
      }
    });

    return count;
  }

  private getDefaultLocalGemCriteria(): LocalGemCriteria {
    return {
      maxReviewCount: 200,
      minAuthenticityScore: 0.6,
      preferredCuisines: AuthenticityAnalysisService.HONG_KONG_CUISINES,
      maxChainPresence: 0.3,
      minLocalCharacteristics: 1
    };
  }
}