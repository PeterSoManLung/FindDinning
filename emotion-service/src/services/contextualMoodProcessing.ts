import { 
  EmotionContextRequest, 
  EmotionContextResult, 
  DetectedEmotion, 
  RecommendationAdjustment 
} from '../../../shared/src/types/emotion.types';

interface WeatherCondition {
  condition: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  pressure: number;
}

interface LocationContext {
  type: 'busy' | 'quiet' | 'residential' | 'commercial' | 'tourist' | 'business';
  crowdLevel: number; // 0-1 scale
  noiseLevel: number; // 0-1 scale
  ambiance: string[];
}

interface SeasonalPattern {
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  month: number;
  emotionalTendencies: string[];
  foodPreferences: string[];
  atmospherePreferences: string[];
}

export class ContextualMoodProcessingService {
  private contextKeywords: Map<string, string[]> = new Map([
    ['work_stress', ['work', 'office', 'meeting', 'deadline', 'boss', 'project', 'overtime', 'presentation']],
    ['relationship', ['boyfriend', 'girlfriend', 'partner', 'date', 'anniversary', 'breakup', 'fight', 'love']],
    ['family', ['family', 'parents', 'mom', 'dad', 'siblings', 'kids', 'children', 'relatives']],
    ['health', ['sick', 'tired', 'headache', 'pain', 'doctor', 'medicine', 'recovery', 'wellness']],
    ['weather', ['rain', 'sunny', 'cold', 'hot', 'storm', 'cloudy', 'humid', 'weather']],
    ['social', ['friends', 'party', 'celebration', 'gathering', 'social', 'group', 'crowd']],
    ['achievement', ['promotion', 'success', 'win', 'achievement', 'accomplished', 'proud', 'victory']],
    ['loss', ['loss', 'death', 'goodbye', 'ended', 'finished', 'over', 'failed', 'disappointed']],
    ['travel', ['travel', 'trip', 'vacation', 'airport', 'hotel', 'tourist', 'exploring', 'sightseeing']],
    ['financial', ['money', 'expensive', 'cheap', 'budget', 'salary', 'pay', 'cost', 'afford']]
  ]);

  private weatherMoodMappings: Map<string, RecommendationAdjustment[]> = new Map([
    ['rainy', [
      { factor: 'comfort_food', adjustment: 'increase', weight: 0.8, reasoning: 'Rainy weather increases desire for comfort food' },
      { factor: 'indoor_seating', adjustment: 'increase', weight: 0.9, reasoning: 'Rain necessitates indoor dining' },
      { factor: 'warm_food', adjustment: 'increase', weight: 0.7, reasoning: 'Warm food preferred in rainy weather' },
      { factor: 'cozy_atmosphere', adjustment: 'increase', weight: 0.8, reasoning: 'Cozy atmosphere counters gloomy weather' }
    ]],
    ['sunny', [
      { factor: 'outdoor_seating', adjustment: 'increase', weight: 0.8, reasoning: 'Sunny weather encourages outdoor dining' },
      { factor: 'light_food', adjustment: 'increase', weight: 0.6, reasoning: 'Light food preferred in warm sunny weather' },
      { factor: 'fresh_ingredients', adjustment: 'increase', weight: 0.7, reasoning: 'Fresh food complements sunny mood' },
      { factor: 'refreshing_drinks', adjustment: 'increase', weight: 0.8, reasoning: 'Refreshing beverages needed in sun' }
    ]],
    ['cold', [
      { factor: 'hot_food', adjustment: 'increase', weight: 0.9, reasoning: 'Hot food essential in cold weather' },
      { factor: 'hearty_meals', adjustment: 'increase', weight: 0.8, reasoning: 'Hearty meals provide warmth and energy' },
      { factor: 'indoor_seating', adjustment: 'increase', weight: 0.9, reasoning: 'Indoor seating necessary in cold weather' },
      { factor: 'warm_atmosphere', adjustment: 'increase', weight: 0.7, reasoning: 'Warm atmosphere counters cold weather' }
    ]],
    ['hot', [
      { factor: 'cold_food', adjustment: 'increase', weight: 0.8, reasoning: 'Cold food preferred in hot weather' },
      { factor: 'air_conditioning', adjustment: 'increase', weight: 0.9, reasoning: 'Air conditioning essential in hot weather' },
      { factor: 'light_meals', adjustment: 'increase', weight: 0.7, reasoning: 'Light meals easier to digest in heat' },
      { factor: 'hydrating_options', adjustment: 'increase', weight: 0.8, reasoning: 'Hydration important in hot weather' }
    ]],
    ['stormy', [
      { factor: 'comfort_food', adjustment: 'increase', weight: 0.9, reasoning: 'Storms increase need for emotional comfort' },
      { factor: 'secure_location', adjustment: 'increase', weight: 0.8, reasoning: 'Secure indoor location during storms' },
      { factor: 'warm_atmosphere', adjustment: 'increase', weight: 0.8, reasoning: 'Warm atmosphere counters storm anxiety' }
    ]],
    ['humid', [
      { factor: 'light_food', adjustment: 'increase', weight: 0.7, reasoning: 'Light food preferred in humid conditions' },
      { factor: 'air_conditioning', adjustment: 'increase', weight: 0.8, reasoning: 'Air conditioning important in humidity' },
      { factor: 'refreshing_options', adjustment: 'increase', weight: 0.6, reasoning: 'Refreshing food helps with humidity discomfort' }
    ]]
  ]);

  private locationContextMappings: Map<string, RecommendationAdjustment[]> = new Map([
    ['busy', [
      { factor: 'quick_service', adjustment: 'increase', weight: 0.8, reasoning: 'Busy areas require efficient service' },
      { factor: 'takeaway_options', adjustment: 'increase', weight: 0.7, reasoning: 'Takeaway convenient in busy areas' },
      { factor: 'noise_tolerance', adjustment: 'increase', weight: 0.6, reasoning: 'Busy areas tend to be noisier' }
    ]],
    ['quiet', [
      { factor: 'relaxed_atmosphere', adjustment: 'increase', weight: 0.9, reasoning: 'Quiet areas allow for relaxed dining' },
      { factor: 'conversation_friendly', adjustment: 'increase', weight: 0.8, reasoning: 'Quiet areas good for conversation' },
      { factor: 'leisurely_dining', adjustment: 'increase', weight: 0.7, reasoning: 'Quiet areas support leisurely meals' }
    ]],
    ['tourist', [
      { factor: 'local_cuisine', adjustment: 'increase', weight: 0.8, reasoning: 'Tourist areas should showcase local food' },
      { factor: 'authentic_experience', adjustment: 'increase', weight: 0.9, reasoning: 'Tourists seek authentic experiences' },
      { factor: 'photo_worthy', adjustment: 'increase', weight: 0.6, reasoning: 'Tourist areas often photographed' }
    ]],
    ['business', [
      { factor: 'professional_atmosphere', adjustment: 'increase', weight: 0.9, reasoning: 'Business areas require professional setting' },
      { factor: 'quick_service', adjustment: 'increase', weight: 0.8, reasoning: 'Business people often time-constrained' },
      { factor: 'meeting_friendly', adjustment: 'increase', weight: 0.7, reasoning: 'Business areas used for meetings' }
    ]],
    ['residential', [
      { factor: 'family_friendly', adjustment: 'increase', weight: 0.8, reasoning: 'Residential areas serve families' },
      { factor: 'casual_atmosphere', adjustment: 'increase', weight: 0.7, reasoning: 'Residential dining tends to be casual' },
      { factor: 'neighborhood_feel', adjustment: 'increase', weight: 0.6, reasoning: 'Residential areas have community feel' }
    ]]
  ]);

  private seasonalPatterns: Map<string, SeasonalPattern> = new Map([
    ['spring', {
      season: 'spring',
      month: 3,
      emotionalTendencies: ['optimistic', 'energetic', 'renewal', 'fresh_start'],
      foodPreferences: ['fresh_ingredients', 'light_meals', 'seasonal_vegetables', 'detox_options'],
      atmospherePreferences: ['outdoor_seating', 'bright_lighting', 'fresh_air', 'garden_views']
    }],
    ['summer', {
      season: 'summer',
      month: 6,
      emotionalTendencies: ['social', 'adventurous', 'relaxed', 'vacation_mood'],
      foodPreferences: ['cold_dishes', 'grilled_food', 'fresh_fruits', 'light_meals', 'refreshing_drinks'],
      atmospherePreferences: ['outdoor_dining', 'beach_views', 'casual_setting', 'air_conditioning']
    }],
    ['autumn', {
      season: 'autumn',
      month: 9,
      emotionalTendencies: ['nostalgic', 'contemplative', 'cozy', 'harvest_gratitude'],
      foodPreferences: ['comfort_food', 'warm_dishes', 'seasonal_flavors', 'hearty_meals'],
      atmospherePreferences: ['warm_lighting', 'cozy_interior', 'fireplace', 'rustic_decor']
    }],
    ['winter', {
      season: 'winter',
      month: 12,
      emotionalTendencies: ['introspective', 'comfort_seeking', 'social_bonding', 'celebration'],
      foodPreferences: ['hot_food', 'comfort_food', 'rich_flavors', 'warming_spices'],
      atmospherePreferences: ['warm_interior', 'intimate_lighting', 'heated_spaces', 'festive_decor']
    }]
  ]);

  private timeContexts: Map<string, RecommendationAdjustment[]> = new Map([
    ['morning', [
      { factor: 'energy_boost', adjustment: 'increase', weight: 0.3, reasoning: 'Morning dining should provide energy for the day' },
      { factor: 'light_options', adjustment: 'increase', weight: 0.2, reasoning: 'Lighter options preferred in morning' }
    ]],
    ['lunch', [
      { factor: 'quick_service', adjustment: 'increase', weight: 0.4, reasoning: 'Lunch often requires quick service for busy schedules' },
      { factor: 'balanced_nutrition', adjustment: 'increase', weight: 0.3, reasoning: 'Midday meal should be nutritionally balanced' }
    ]],
    ['afternoon', [
      { factor: 'light_snacks', adjustment: 'increase', weight: 0.3, reasoning: 'Afternoon dining often involves lighter options' },
      { factor: 'social_atmosphere', adjustment: 'increase', weight: 0.2, reasoning: 'Afternoon dining can be more social' }
    ]],
    ['dinner', [
      { factor: 'substantial_meal', adjustment: 'increase', weight: 0.4, reasoning: 'Dinner is typically the main meal of the day' },
      { factor: 'relaxed_atmosphere', adjustment: 'increase', weight: 0.3, reasoning: 'Evening dining allows for more relaxed experience' }
    ]],
    ['late_night', [
      { factor: 'comfort_food', adjustment: 'increase', weight: 0.4, reasoning: 'Late night dining often seeks comfort and satisfaction' },
      { factor: 'casual_atmosphere', adjustment: 'increase', weight: 0.3, reasoning: 'Late night dining is typically more casual' }
    ]]
  ]);

  /**
   * Processes contextual information to enhance emotion analysis
   */
  public processEmotionContext(request: EmotionContextRequest): EmotionContextResult {
    const detectedEmotions = this.extractEmotionsFromText(request.textInput);
    const contextualFactors = this.identifyContextualFactors(request);
    
    // Enhanced contextual processing
    const weatherAdjustments = this.processWeatherContext(request.additionalContext?.weather);
    const timeAdjustments = this.processTimeOfDayContext(request.additionalContext?.timeOfDay);
    const locationAdjustments = this.processLocationContext(request.additionalContext?.location);
    const seasonalAdjustments = this.processSeasonalContext(new Date());
    
    const recommendationAdjustments = this.generateRecommendationAdjustments(
      detectedEmotions, 
      contextualFactors, 
      request.additionalContext,
      weatherAdjustments,
      timeAdjustments,
      locationAdjustments,
      seasonalAdjustments
    );
    
    const confidence = this.calculateContextualConfidence(detectedEmotions, contextualFactors);

    return {
      detectedEmotions,
      contextualFactors,
      recommendationAdjustments,
      confidence
    };
  }

  /**
   * Extracts emotions from text input using natural language processing
   */
  private extractEmotionsFromText(textInput: string): DetectedEmotion[] {
    const emotions: DetectedEmotion[] = [];
    const input = textInput.toLowerCase();

    // Emotion detection patterns
    const emotionPatterns: Record<string, { keywords: string[], intensity: number }> = {
      'excited': { keywords: ['excited', 'thrilled', 'pumped', 'can\'t wait', 'amazing'], intensity: 4 },
      'happy': { keywords: ['happy', 'good', 'great', 'wonderful', 'fantastic', 'awesome'], intensity: 3 },
      'sad': { keywords: ['sad', 'down', 'depressed', 'upset', 'disappointed', 'blue'], intensity: 3 },
      'angry': { keywords: ['angry', 'mad', 'furious', 'annoyed', 'frustrated', 'pissed'], intensity: 4 },
      'stressed': { keywords: ['stressed', 'overwhelmed', 'pressure', 'anxious', 'worried'], intensity: 3 },
      'tired': { keywords: ['tired', 'exhausted', 'drained', 'weary', 'sleepy'], intensity: 3 },
      'lonely': { keywords: ['lonely', 'alone', 'isolated', 'missing', 'empty'], intensity: 3 },
      'confused': { keywords: ['confused', 'lost', 'uncertain', 'don\'t know', 'unsure'], intensity: 2 },
      'grateful': { keywords: ['grateful', 'thankful', 'blessed', 'appreciate'], intensity: 3 },
      'nostalgic': { keywords: ['remember', 'miss', 'used to', 'back then', 'childhood'], intensity: 2 }
    };

    for (const [emotion, pattern] of Object.entries(emotionPatterns)) {
      const matchedKeywords = pattern.keywords.filter(keyword => input.includes(keyword));
      if (matchedKeywords.length > 0) {
        emotions.push({
          emotion,
          confidence: Math.min(0.9, matchedKeywords.length * 0.3 + 0.3),
          triggers: matchedKeywords
        });
      }
    }

    // Detect emotional intensity modifiers
    const intensityModifiers = ['very', 'extremely', 'really', 'super', 'incredibly'];
    const hasIntensityModifier = intensityModifiers.some(modifier => input.includes(modifier));
    
    if (hasIntensityModifier) {
      emotions.forEach(emotion => {
        emotion.confidence = Math.min(1, emotion.confidence + 0.2);
      });
    }

    return emotions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Identifies contextual factors from the input and additional context
   */
  private identifyContextualFactors(request: EmotionContextRequest): string[] {
    const factors: string[] = [];
    const input = request.textInput.toLowerCase();

    // Check for contextual keywords
    for (const [context, keywords] of this.contextKeywords) {
      if (keywords.some(keyword => input.includes(keyword))) {
        factors.push(context);
      }
    }

    // Add time-based context
    if (request.additionalContext?.timeOfDay) {
      factors.push(`time_${request.additionalContext.timeOfDay}`);
    }

    // Add location-based context
    if (request.additionalContext?.location) {
      factors.push(`location_${request.additionalContext.location.toLowerCase()}`);
    }

    // Add recent events context
    if (request.additionalContext?.recentEvents) {
      request.additionalContext.recentEvents.forEach(event => {
        const eventLower = event.toLowerCase();
        for (const [context, keywords] of this.contextKeywords) {
          if (keywords.some(keyword => eventLower.includes(keyword))) {
            factors.push(`recent_${context}`);
          }
        }
      });
    }

    return [...new Set(factors)]; // Remove duplicates
  }

  /**
   * Processes weather-based mood adjustments
   */
  private processWeatherContext(weather?: WeatherCondition): RecommendationAdjustment[] {
    if (!weather) return [];

    const adjustments: RecommendationAdjustment[] = [];

    // Temperature-based adjustments
    if (weather.temperature < 10) {
      adjustments.push(...(this.weatherMoodMappings.get('cold') || []));
    } else if (weather.temperature > 30) {
      adjustments.push(...(this.weatherMoodMappings.get('hot') || []));
    }

    // Condition-based adjustments
    const conditionAdjustments = this.weatherMoodMappings.get(weather.condition.toLowerCase());
    if (conditionAdjustments) {
      adjustments.push(...conditionAdjustments);
    }

    // Humidity adjustments
    if (weather.humidity > 0.8) {
      adjustments.push(...(this.weatherMoodMappings.get('humid') || []));
    }

    // Pressure-based mood adjustments (low pressure can affect mood)
    if (weather.pressure < 1000) {
      adjustments.push({
        factor: 'comfort_food',
        adjustment: 'increase',
        weight: 0.3,
        reasoning: 'Low atmospheric pressure can affect mood, comfort food helps'
      });
    }

    return adjustments;
  }

  /**
   * Processes time-of-day contextual adjustments
   */
  private processTimeOfDayContext(timeOfDay?: string): RecommendationAdjustment[] {
    if (!timeOfDay) {
      // Determine time of day from current time if not provided
      const hour = new Date().getHours();
      if (hour < 6) timeOfDay = 'late_night';
      else if (hour < 11) timeOfDay = 'morning';
      else if (hour < 14) timeOfDay = 'lunch';
      else if (hour < 17) timeOfDay = 'afternoon';
      else if (hour < 22) timeOfDay = 'dinner';
      else timeOfDay = 'late_night';
    }

    const adjustments: RecommendationAdjustment[] = [];
    const timeAdjustments = this.timeContexts.get(timeOfDay);
    
    if (timeAdjustments) {
      adjustments.push(...timeAdjustments);
    }

    // Additional time-specific adjustments
    const hour = new Date().getHours();
    
    // Early morning (5-7 AM)
    if (hour >= 5 && hour < 7) {
      adjustments.push({
        factor: 'caffeine_options',
        adjustment: 'increase',
        weight: 0.8,
        reasoning: 'Early morning requires caffeine boost'
      });
    }
    
    // Late night (10 PM - 2 AM)
    if (hour >= 22 || hour < 2) {
      adjustments.push({
        factor: 'late_night_friendly',
        adjustment: 'increase',
        weight: 0.9,
        reasoning: 'Late night dining requires appropriate venues'
      });
    }

    // Weekend vs weekday adjustments
    const isWeekend = [0, 6].includes(new Date().getDay());
    if (isWeekend) {
      adjustments.push({
        factor: 'leisurely_dining',
        adjustment: 'increase',
        weight: 0.6,
        reasoning: 'Weekend allows for more leisurely dining'
      });
    } else {
      adjustments.push({
        factor: 'efficient_service',
        adjustment: 'increase',
        weight: 0.7,
        reasoning: 'Weekday dining often requires efficiency'
      });
    }

    return adjustments;
  }

  /**
   * Processes location-based contextual adjustments
   */
  private processLocationContext(location?: string): RecommendationAdjustment[] {
    if (!location) return [];

    const adjustments: RecommendationAdjustment[] = [];
    
    // Determine location type from location string
    const locationLower = location.toLowerCase();
    let locationType: string = 'general';
    
    if (locationLower.includes('central') || locationLower.includes('downtown') || locationLower.includes('business district')) {
      locationType = 'business';
    } else if (locationLower.includes('tourist') || locationLower.includes('attraction') || locationLower.includes('temple') || locationLower.includes('museum')) {
      locationType = 'tourist';
    } else if (locationLower.includes('residential') || locationLower.includes('estate') || locationLower.includes('village')) {
      locationType = 'residential';
    } else if (locationLower.includes('busy') || locationLower.includes('crowded') || locationLower.includes('market')) {
      locationType = 'busy';
    } else if (locationLower.includes('quiet') || locationLower.includes('peaceful') || locationLower.includes('park')) {
      locationType = 'quiet';
    }

    const locationAdjustments = this.locationContextMappings.get(locationType);
    if (locationAdjustments) {
      adjustments.push(...locationAdjustments);
    }

    // Hong Kong specific location adjustments
    if (locationLower.includes('hong kong')) {
      adjustments.push({
        factor: 'local_hong_kong_cuisine',
        adjustment: 'increase',
        weight: 0.7,
        reasoning: 'Hong Kong location favors local cuisine'
      });
    }

    // MTR station proximity (common in Hong Kong)
    if (locationLower.includes('mtr') || locationLower.includes('station')) {
      adjustments.push({
        factor: 'convenient_location',
        adjustment: 'increase',
        weight: 0.6,
        reasoning: 'MTR proximity indicates convenience preference'
      });
    }

    return adjustments;
  }

  /**
   * Processes seasonal emotional pattern recognition
   */
  private processSeasonalContext(currentDate: Date): RecommendationAdjustment[] {
    const month = currentDate.getMonth() + 1; // JavaScript months are 0-indexed
    const adjustments: RecommendationAdjustment[] = [];

    let currentSeason: string;
    if (month >= 3 && month <= 5) currentSeason = 'spring';
    else if (month >= 6 && month <= 8) currentSeason = 'summer';
    else if (month >= 9 && month <= 11) currentSeason = 'autumn';
    else currentSeason = 'winter';

    const seasonalPattern = this.seasonalPatterns.get(currentSeason);
    if (!seasonalPattern) return adjustments;

    // Add seasonal food preferences
    seasonalPattern.foodPreferences.forEach(preference => {
      adjustments.push({
        factor: preference,
        adjustment: 'increase',
        weight: 0.5,
        reasoning: `${currentSeason} season favors ${preference.replace('_', ' ')}`
      });
    });

    // Add seasonal atmosphere preferences
    seasonalPattern.atmospherePreferences.forEach(atmosphere => {
      adjustments.push({
        factor: atmosphere,
        adjustment: 'increase',
        weight: 0.4,
        reasoning: `${currentSeason} season benefits from ${atmosphere.replace('_', ' ')}`
      });
    });

    // Special seasonal events and holidays
    const specialEvents = this.getSeasonalEvents(month);
    specialEvents.forEach(event => {
      adjustments.push({
        factor: event.factor,
        adjustment: 'increase',
        weight: event.weight,
        reasoning: event.reasoning
      });
    });

    // Hong Kong specific seasonal adjustments
    if (currentSeason === 'summer') {
      adjustments.push({
        factor: 'typhoon_shelter_style',
        adjustment: 'increase',
        weight: 0.3,
        reasoning: 'Summer in Hong Kong favors typhoon shelter style dining'
      });
    }

    return adjustments;
  }

  /**
   * Gets seasonal events and their dining implications
   */
  private getSeasonalEvents(month: number): RecommendationAdjustment[] {
    const events: RecommendationAdjustment[] = [];

    switch (month) {
      case 1: // January
        events.push({
          factor: 'new_year_celebration',
          adjustment: 'increase',
          weight: 0.6,
          reasoning: 'New Year period encourages celebratory dining'
        });
        break;
      case 2: // February
        events.push({
          factor: 'chinese_new_year',
          adjustment: 'increase',
          weight: 0.8,
          reasoning: 'Chinese New Year emphasizes traditional and festive dining'
        });
        break;
      case 10: // October
        events.push({
          factor: 'mid_autumn_festival',
          adjustment: 'increase',
          weight: 0.6,
          reasoning: 'Mid-Autumn Festival encourages family dining and mooncakes'
        });
        break;
      case 12: // December
        events.push({
          factor: 'christmas_atmosphere',
          adjustment: 'increase',
          weight: 0.7,
          reasoning: 'Christmas season encourages festive and warm dining'
        });
        break;
    }

    return events;
  }

  /**
   * Generates recommendation adjustments based on emotions and context
   */
  private generateRecommendationAdjustments(
    emotions: DetectedEmotion[],
    contextualFactors: string[],
    additionalContext?: any,
    weatherAdjustments: RecommendationAdjustment[] = [],
    timeAdjustments: RecommendationAdjustment[] = [],
    locationAdjustments: RecommendationAdjustment[] = [],
    seasonalAdjustments: RecommendationAdjustment[] = []
  ): RecommendationAdjustment[] {
    const adjustments: RecommendationAdjustment[] = [];

    // Emotion-based adjustments
    emotions.forEach(emotion => {
      switch (emotion.emotion) {
        case 'stressed':
          adjustments.push({
            factor: 'calm_atmosphere',
            adjustment: 'increase',
            weight: emotion.confidence * 0.8,
            reasoning: 'Stressed state requires calming dining environment'
          });
          adjustments.push({
            factor: 'spicy_food',
            adjustment: 'decrease',
            weight: emotion.confidence * 0.6,
            reasoning: 'Avoid overstimulating spicy foods when stressed'
          });
          break;

        case 'sad':
          adjustments.push({
            factor: 'comfort_food',
            adjustment: 'increase',
            weight: emotion.confidence * 0.9,
            reasoning: 'Comfort food provides emotional support when sad'
          });
          adjustments.push({
            factor: 'cozy_atmosphere',
            adjustment: 'increase',
            weight: emotion.confidence * 0.7,
            reasoning: 'Cozy environment helps when feeling down'
          });
          break;

        case 'excited':
          adjustments.push({
            factor: 'adventurous_cuisine',
            adjustment: 'increase',
            weight: emotion.confidence * 0.8,
            reasoning: 'Excitement pairs well with adventurous dining experiences'
          });
          adjustments.push({
            factor: 'social_atmosphere',
            adjustment: 'increase',
            weight: emotion.confidence * 0.7,
            reasoning: 'Excited mood benefits from social dining environments'
          });
          break;

        case 'tired':
          adjustments.push({
            factor: 'simple_food',
            adjustment: 'increase',
            weight: emotion.confidence * 0.8,
            reasoning: 'Simple, easy-to-eat food when tired'
          });
          adjustments.push({
            factor: 'quick_service',
            adjustment: 'increase',
            weight: emotion.confidence * 0.6,
            reasoning: 'Quick service preferred when energy is low'
          });
          break;

        case 'lonely':
          adjustments.push({
            factor: 'social_atmosphere',
            adjustment: 'increase',
            weight: emotion.confidence * 0.8,
            reasoning: 'Social environments help combat loneliness'
          });
          adjustments.push({
            factor: 'comfort_food',
            adjustment: 'increase',
            weight: emotion.confidence * 0.6,
            reasoning: 'Comfort food provides emotional warmth when lonely'
          });
          break;
      }
    });

    // Context-based adjustments
    contextualFactors.forEach(factor => {
      if (factor.startsWith('time_')) {
        const timeOfDay = factor.replace('time_', '');
        const timeAdjustments = this.timeContexts.get(timeOfDay);
        if (timeAdjustments) {
          adjustments.push(...timeAdjustments);
        }
      }

      switch (factor) {
        case 'work_stress':
          adjustments.push({
            factor: 'quick_service',
            adjustment: 'increase',
            weight: 0.7,
            reasoning: 'Work stress requires efficient dining experience'
          });
          adjustments.push({
            factor: 'healthy_options',
            adjustment: 'increase',
            weight: 0.5,
            reasoning: 'Healthy food helps manage work stress'
          });
          break;

        case 'relationship':
          adjustments.push({
            factor: 'romantic_atmosphere',
            adjustment: 'increase',
            weight: 0.8,
            reasoning: 'Relationship context suggests romantic dining preference'
          });
          break;

        case 'family':
          adjustments.push({
            factor: 'family_friendly',
            adjustment: 'increase',
            weight: 0.9,
            reasoning: 'Family context requires family-friendly environment'
          });
          adjustments.push({
            factor: 'sharing_dishes',
            adjustment: 'increase',
            weight: 0.6,
            reasoning: 'Family dining often involves sharing'
          });
          break;

        case 'weather':
          // Weather-specific adjustments would be added here
          // This is a placeholder for weather-based logic
          break;

        case 'financial':
          adjustments.push({
            factor: 'budget_friendly',
            adjustment: 'increase',
            weight: 0.8,
            reasoning: 'Financial concerns suggest budget-conscious dining'
          });
          break;
      }
    });

    // Combine all adjustments
    adjustments.push(...weatherAdjustments);
    adjustments.push(...timeAdjustments);
    adjustments.push(...locationAdjustments);
    adjustments.push(...seasonalAdjustments);

    // Remove duplicates and merge similar adjustments
    return this.mergeAndDeduplicateAdjustments(adjustments);
  }

  /**
   * Merges and deduplicates recommendation adjustments
   */
  private mergeAndDeduplicateAdjustments(adjustments: RecommendationAdjustment[]): RecommendationAdjustment[] {
    const mergedMap = new Map<string, RecommendationAdjustment>();

    adjustments.forEach(adjustment => {
      const key = `${adjustment.factor}_${adjustment.adjustment}`;
      
      if (mergedMap.has(key)) {
        const existing = mergedMap.get(key)!;
        // Combine weights and reasoning
        existing.weight = Math.min(1, existing.weight + adjustment.weight * 0.5);
        existing.reasoning += ` | ${adjustment.reasoning}`;
      } else {
        mergedMap.set(key, { ...adjustment });
      }
    });

    return Array.from(mergedMap.values()).sort((a, b) => b.weight - a.weight);
  }

  /**
   * Calculates confidence in contextual analysis
   */
  private calculateContextualConfidence(
    emotions: DetectedEmotion[],
    contextualFactors: string[]
  ): number {
    let confidence = 0.5; // Base confidence

    // Boost confidence based on number of detected emotions
    if (emotions.length > 0) {
      confidence += emotions[0].confidence * 0.3;
      if (emotions.length > 1) {
        confidence += 0.1;
      }
    }

    // Boost confidence based on contextual factors
    confidence += Math.min(0.3, contextualFactors.length * 0.1);

    // Reduce confidence if emotions are conflicting
    if (emotions.length > 1) {
      const conflictingEmotions = this.hasConflictingEmotions(emotions);
      if (conflictingEmotions) {
        confidence -= 0.2;
      }
    }

    return Math.max(0.1, Math.min(1, confidence));
  }

  /**
   * Checks if detected emotions are conflicting
   */
  private hasConflictingEmotions(emotions: DetectedEmotion[]): boolean {
    const conflictingPairs = [
      ['happy', 'sad'],
      ['excited', 'tired'],
      ['calm', 'stressed'],
      ['angry', 'grateful']
    ];

    const emotionNames = emotions.map(e => e.emotion);
    
    return conflictingPairs.some(([emotion1, emotion2]) =>
      emotionNames.includes(emotion1) && emotionNames.includes(emotion2)
    );
  }

  /**
   * Gets contextual recommendations for specific situations
   */
  public getContextualRecommendations(context: string): RecommendationAdjustment[] {
    const contextRecommendations: Record<string, RecommendationAdjustment[]> = {
      'first_date': [
        { factor: 'quiet_atmosphere', adjustment: 'increase', weight: 0.9, reasoning: 'First dates benefit from quiet environments for conversation' },
        { factor: 'moderate_pricing', adjustment: 'increase', weight: 0.7, reasoning: 'Moderate pricing appropriate for first dates' },
        { factor: 'familiar_cuisine', adjustment: 'increase', weight: 0.6, reasoning: 'Familiar cuisine reduces risk on first dates' }
      ],
      'business_lunch': [
        { factor: 'professional_atmosphere', adjustment: 'increase', weight: 0.9, reasoning: 'Business context requires professional environment' },
        { factor: 'quick_service', adjustment: 'increase', weight: 0.8, reasoning: 'Business lunches often have time constraints' },
        { factor: 'quiet_atmosphere', adjustment: 'increase', weight: 0.7, reasoning: 'Need quiet environment for business discussions' }
      ],
      'celebration': [
        { factor: 'festive_atmosphere', adjustment: 'increase', weight: 0.9, reasoning: 'Celebrations call for festive environments' },
        { factor: 'special_cuisine', adjustment: 'increase', weight: 0.8, reasoning: 'Special occasions warrant special cuisine' },
        { factor: 'higher_price_range', adjustment: 'increase', weight: 0.6, reasoning: 'Willing to spend more for celebrations' }
      ],
      'comfort_seeking': [
        { factor: 'comfort_food', adjustment: 'increase', weight: 0.9, reasoning: 'Comfort seeking requires familiar, soothing food' },
        { factor: 'cozy_atmosphere', adjustment: 'increase', weight: 0.8, reasoning: 'Cozy environment provides emotional comfort' },
        { factor: 'affordable_pricing', adjustment: 'increase', weight: 0.6, reasoning: 'Comfort food often associated with affordable options' }
      ]
    };

    return contextRecommendations[context] || [];
  }
}