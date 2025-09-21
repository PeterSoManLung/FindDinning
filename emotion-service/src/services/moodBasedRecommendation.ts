import { 
  EmotionAnalysisResult,
  CuisineRecommendation,
  RecommendationAdjustment,
  EmotionContext
} from '../../../shared/src/types/emotion.types';

export interface MoodBasedRecommendationRequest {
  primaryEmotion: string;
  intensity: number;
  secondaryEmotions?: string[];
  context?: EmotionContext;
  userPreferences?: {
    cuisineTypes?: string[];
    dietaryRestrictions?: string[];
    priceRange?: [number, number];
  };
}

export interface MoodBasedRecommendationResult {
  recommendationType: 'comfort' | 'celebratory' | 'neutral' | 'therapeutic' | 'adventurous';
  primaryRecommendations: CuisineRecommendation[];
  fallbackRecommendations: CuisineRecommendation[];
  atmosphereAdjustments: RecommendationAdjustment[];
  priceAdjustments: RecommendationAdjustment[];
  reasoning: string;
  confidence: number;
}

export class MoodBasedRecommendationService {
  private comfortFoodCuisines: Map<string, CuisineRecommendation[]> = new Map();
  private celebratoryDiningOptions: Map<string, CuisineRecommendation[]> = new Map();
  private therapeuticCuisines: Map<string, CuisineRecommendation[]> = new Map();

  constructor() {
    this.initializeComfortFoodMappings();
    this.initializeCelebratoryDiningMappings();
    this.initializeTherapeuticCuisineMappings();
  }

  /**
   * Generates mood-based recommendations based on emotional state
   */
  public generateMoodBasedRecommendations(request: MoodBasedRecommendationRequest): MoodBasedRecommendationResult {
    const recommendationType = this.determineRecommendationType(request);
    
    let primaryRecommendations: CuisineRecommendation[];
    let fallbackRecommendations: CuisineRecommendation[];
    
    switch (recommendationType) {
      case 'comfort':
        primaryRecommendations = this.generateComfortFoodRecommendations(request);
        fallbackRecommendations = this.generateNeutralRecommendations(request);
        break;
      case 'celebratory':
        primaryRecommendations = this.generateCelebratoryRecommendations(request);
        fallbackRecommendations = this.generateNeutralRecommendations(request);
        break;
      case 'therapeutic':
        primaryRecommendations = this.generateTherapeuticRecommendations(request);
        fallbackRecommendations = this.generateComfortFoodRecommendations(request);
        break;
      case 'adventurous':
        primaryRecommendations = this.generateAdventurousRecommendations(request);
        fallbackRecommendations = this.generateNeutralRecommendations(request);
        break;
      default:
        primaryRecommendations = this.generateNeutralRecommendations(request);
        fallbackRecommendations = this.generateComfortFoodRecommendations(request);
    }

    const atmosphereAdjustments = this.generateAtmosphereAdjustments(request, recommendationType);
    const priceAdjustments = this.generatePriceAdjustments(request, recommendationType);
    const reasoning = this.generateRecommendationReasoning(request, recommendationType);
    const confidence = this.calculateRecommendationConfidence(request, recommendationType);

    return {
      recommendationType,
      primaryRecommendations: this.filterAndRankRecommendations(primaryRecommendations, request),
      fallbackRecommendations: this.filterAndRankRecommendations(fallbackRecommendations, request),
      atmosphereAdjustments,
      priceAdjustments,
      reasoning,
      confidence
    };
  }

  /**
   * Identifies comfort food for negative emotions
   */
  public identifyComfortFood(emotion: string, intensity: number, context?: EmotionContext): CuisineRecommendation[] {
    const baseComfortFoods = this.comfortFoodCuisines.get(emotion) || this.comfortFoodCuisines.get('general')!;
    
    // Adjust recommendations based on intensity
    let recommendations = [...baseComfortFoods];
    
    if (intensity >= 4) {
      // High intensity negative emotions need maximum comfort
      recommendations = recommendations.map(rec => ({
        ...rec,
        matchScore: Math.min(1, rec.matchScore + 0.2),
        reasoning: `${rec.reasoning} (enhanced for high emotional intensity)`
      }));
    }

    // Consider contextual factors
    if (context?.socialSetting === 'alone') {
      // Solo comfort dining
      recommendations = recommendations.filter(rec => 
        !rec.specificDishes?.some(dish => dish.toLowerCase().includes('sharing'))
      );
    }

    if (context?.timeOfDay === 'late_night') {
      // Late night comfort food
      recommendations = recommendations.map(rec => {
        if (rec.cuisineType.includes('24-hour') || rec.cuisineType === 'Congee') {
          return {
            ...rec,
            matchScore: Math.min(1, rec.matchScore + 0.15),
            reasoning: `${rec.reasoning} (perfect for late night comfort)`
          };
        }
        return rec;
      });
    }

    return recommendations.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Suggests celebratory dining options for positive emotions
   */
  public suggestCelebratoryDining(emotion: string, intensity: number, context?: EmotionContext): CuisineRecommendation[] {
    const baseCelebratory = this.celebratoryDiningOptions.get(emotion) || this.celebratoryDiningOptions.get('general')!;
    
    let recommendations = [...baseCelebratory];

    // Adjust based on celebration intensity
    if (intensity >= 4) {
      // Major celebration - suggest premium options
      recommendations = recommendations.map(rec => {
        if (rec.cuisineType.includes('Fine Dining') || rec.cuisineType === 'French') {
          return {
            ...rec,
            matchScore: Math.min(1, rec.matchScore + 0.25),
            reasoning: `${rec.reasoning} (perfect for major celebrations)`
          };
        }
        return rec;
      });
    }

    // Consider social context
    if (context?.socialSetting === 'friends') {
      recommendations = recommendations.map(rec => {
        if (rec.cuisineType.includes('Social') || rec.cuisineType === 'Korean BBQ') {
          return {
            ...rec,
            matchScore: Math.min(1, rec.matchScore + 0.2),
            reasoning: `${rec.reasoning} (great for celebrating with friends)`
          };
        }
        return rec;
      });
    }

    if (context?.socialSetting === 'date') {
      recommendations = recommendations.map(rec => {
        if (rec.cuisineType === 'French' || rec.cuisineType === 'Italian') {
          return {
            ...rec,
            matchScore: Math.min(1, rec.matchScore + 0.2),
            reasoning: `${rec.reasoning} (romantic celebration dining)`
          };
        }
        return rec;
      });
    }

    return recommendations.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Handles neutral emotional states with preference-based fallbacks
   */
  public handleNeutralState(userPreferences?: any, context?: EmotionContext): CuisineRecommendation[] {
    let recommendations: CuisineRecommendation[] = [
      {
        cuisineType: 'Chinese',
        matchScore: 0.8,
        reasoning: 'Versatile and familiar cuisine suitable for any mood',
        specificDishes: ['Fried Rice', 'Sweet and Sour Pork', 'Chow Mein']
      },
      {
        cuisineType: 'Japanese',
        matchScore: 0.75,
        reasoning: 'Healthy, balanced options with broad appeal',
        specificDishes: ['Teriyaki', 'Sushi', 'Bento Box']
      },
      {
        cuisineType: 'Italian',
        matchScore: 0.7,
        reasoning: 'Popular, accessible cuisine with familiar flavors',
        specificDishes: ['Pizza', 'Pasta', 'Caesar Salad']
      },
      {
        cuisineType: 'Casual Dining',
        matchScore: 0.65,
        reasoning: 'Comfortable, unpretentious dining experience',
        specificDishes: ['Burgers', 'Sandwiches', 'Salads']
      },
      {
        cuisineType: 'Local Hong Kong',
        matchScore: 0.6,
        reasoning: 'Authentic local flavors for everyday dining',
        specificDishes: ['Cha Chaan Teng', 'Dim Sum', 'Wonton Noodles']
      }
    ];

    // Boost user's preferred cuisines
    if (userPreferences?.cuisineTypes) {
      recommendations = recommendations.map(rec => {
        if (userPreferences.cuisineTypes.includes(rec.cuisineType)) {
          return {
            ...rec,
            matchScore: Math.min(1, rec.matchScore + 0.3),
            reasoning: `${rec.reasoning} (matches your preferences)`
          };
        }
        return rec;
      });
    }

    // Consider time-based context
    if (context?.timeOfDay === 'breakfast') {
      recommendations.unshift({
        cuisineType: 'Breakfast',
        matchScore: 0.9,
        reasoning: 'Perfect morning dining options',
        specificDishes: ['Hong Kong Breakfast', 'Congee', 'Toast']
      });
    }

    if (context?.timeOfDay === 'lunch') {
      recommendations = recommendations.map(rec => {
        if (rec.cuisineType === 'Casual Dining' || rec.cuisineType === 'Chinese') {
          return {
            ...rec,
            matchScore: Math.min(1, rec.matchScore + 0.15),
            reasoning: `${rec.reasoning} (ideal for lunch)`
          };
        }
        return rec;
      });
    }

    return recommendations.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Determines the type of recommendation based on emotional state
   */
  private determineRecommendationType(request: MoodBasedRecommendationRequest): 'comfort' | 'celebratory' | 'neutral' | 'therapeutic' | 'adventurous' {
    const { primaryEmotion, intensity } = request;

    // Negative emotions requiring comfort
    if (['sad', 'lonely', 'tired', 'disappointed', 'heartbroken'].includes(primaryEmotion)) {
      return 'comfort';
    }

    // Positive emotions suitable for celebration
    if (['happy', 'excited', 'celebrating', 'proud', 'accomplished'].includes(primaryEmotion)) {
      return 'celebratory';
    }

    // Emotions requiring therapeutic approach
    if (['stressed', 'anxious', 'overwhelmed', 'angry', 'frustrated'].includes(primaryEmotion)) {
      return 'therapeutic';
    }

    // Adventurous emotions
    if (['adventurous', 'curious', 'experimental'].includes(primaryEmotion)) {
      return 'adventurous';
    }

    // Default to neutral for unknown or neutral emotions
    return 'neutral';
  }

  /**
   * Generates comfort food recommendations for negative emotions
   */
  private generateComfortFoodRecommendations(request: MoodBasedRecommendationRequest): CuisineRecommendation[] {
    return this.identifyComfortFood(request.primaryEmotion, request.intensity, request.context);
  }

  /**
   * Generates celebratory dining recommendations for positive emotions
   */
  private generateCelebratoryRecommendations(request: MoodBasedRecommendationRequest): CuisineRecommendation[] {
    return this.suggestCelebratoryDining(request.primaryEmotion, request.intensity, request.context);
  }

  /**
   * Generates therapeutic recommendations for stressed/angry emotions
   */
  private generateTherapeuticRecommendations(request: MoodBasedRecommendationRequest): CuisineRecommendation[] {
    const therapeuticOptions = this.therapeuticCuisines.get(request.primaryEmotion) || this.therapeuticCuisines.get('general')!;
    
    return therapeuticOptions.map(rec => ({
      ...rec,
      matchScore: request.intensity >= 4 ? Math.min(1, rec.matchScore + 0.15) : rec.matchScore
    }));
  }

  /**
   * Generates adventurous recommendations for exploratory emotions
   */
  private generateAdventurousRecommendations(request: MoodBasedRecommendationRequest): CuisineRecommendation[] {
    return [
      {
        cuisineType: 'Fusion',
        matchScore: 0.9,
        reasoning: 'Creative combinations satisfy desire for new experiences',
        specificDishes: ['Asian Fusion', 'Modern Interpretations', 'Chef Specials']
      },
      {
        cuisineType: 'Street Food',
        matchScore: 0.85,
        reasoning: 'Authentic street food offers adventurous exploration',
        specificDishes: ['Night Market Food', 'Food Truck Fare', 'Local Specialties']
      },
      {
        cuisineType: 'International',
        matchScore: 0.8,
        reasoning: 'Global cuisines satisfy curiosity about world flavors',
        specificDishes: ['Ethiopian', 'Peruvian', 'Moroccan']
      },
      {
        cuisineType: 'Experimental',
        matchScore: 0.75,
        reasoning: 'Innovative cooking techniques and unusual ingredients',
        specificDishes: ['Molecular Gastronomy', 'Unusual Combinations', 'Tasting Menu']
      }
    ];
  }

  /**
   * Generates neutral recommendations with preference-based fallbacks
   */
  private generateNeutralRecommendations(request: MoodBasedRecommendationRequest): CuisineRecommendation[] {
    return this.handleNeutralState(request.userPreferences, request.context);
  }

  /**
   * Generates atmosphere adjustments based on mood and recommendation type
   */
  private generateAtmosphereAdjustments(request: MoodBasedRecommendationRequest, type: string): RecommendationAdjustment[] {
    const adjustments: RecommendationAdjustment[] = [];

    switch (type) {
      case 'comfort':
        adjustments.push(
          { factor: 'cozy_atmosphere', adjustment: 'increase', weight: 0.9, reasoning: 'Cozy environment provides emotional comfort' },
          { factor: 'quiet_atmosphere', adjustment: 'increase', weight: 0.7, reasoning: 'Quiet setting helps with emotional processing' },
          { factor: 'warm_lighting', adjustment: 'increase', weight: 0.6, reasoning: 'Warm lighting creates comforting ambiance' }
        );
        break;

      case 'celebratory':
        adjustments.push(
          { factor: 'festive_atmosphere', adjustment: 'increase', weight: 0.9, reasoning: 'Festive environment matches celebratory mood' },
          { factor: 'social_atmosphere', adjustment: 'increase', weight: 0.8, reasoning: 'Social setting enhances celebration' },
          { factor: 'upscale_atmosphere', adjustment: 'increase', weight: 0.7, reasoning: 'Special occasions warrant elevated dining' }
        );
        break;

      case 'therapeutic':
        adjustments.push(
          { factor: 'calm_atmosphere', adjustment: 'increase', weight: 0.9, reasoning: 'Calm environment helps reduce stress' },
          { factor: 'peaceful_atmosphere', adjustment: 'increase', weight: 0.8, reasoning: 'Peaceful setting promotes relaxation' },
          { factor: 'minimal_atmosphere', adjustment: 'increase', weight: 0.6, reasoning: 'Minimal design reduces overstimulation' }
        );
        break;

      case 'adventurous':
        adjustments.push(
          { factor: 'unique_atmosphere', adjustment: 'increase', weight: 0.9, reasoning: 'Unique setting matches adventurous spirit' },
          { factor: 'vibrant_atmosphere', adjustment: 'increase', weight: 0.8, reasoning: 'Vibrant environment stimulates exploration' },
          { factor: 'trendy_atmosphere', adjustment: 'increase', weight: 0.7, reasoning: 'Trendy venues offer new experiences' }
        );
        break;

      default:
        adjustments.push(
          { factor: 'comfortable_atmosphere', adjustment: 'increase', weight: 0.8, reasoning: 'Comfortable setting suits neutral mood' },
          { factor: 'casual_atmosphere', adjustment: 'increase', weight: 0.7, reasoning: 'Casual environment is versatile and welcoming' }
        );
    }

    return adjustments;
  }

  /**
   * Generates price adjustments based on emotional state and context
   */
  private generatePriceAdjustments(request: MoodBasedRecommendationRequest, type: string): RecommendationAdjustment[] {
    const adjustments: RecommendationAdjustment[] = [];

    switch (type) {
      case 'celebratory':
        adjustments.push({
          factor: 'price_increase_tolerance',
          adjustment: 'increase',
          weight: 0.6,
          reasoning: 'Willing to spend more for special celebrations'
        });
        break;

      case 'comfort':
        adjustments.push({
          factor: 'budget_friendly_preference',
          adjustment: 'increase',
          weight: 0.5,
          reasoning: 'Comfort food often associated with affordable, familiar options'
        });
        break;

      case 'therapeutic':
        adjustments.push({
          factor: 'value_focus',
          adjustment: 'increase',
          weight: 0.4,
          reasoning: 'Focus on value when dealing with stress'
        });
        break;
    }

    return adjustments;
  }

  /**
   * Filters and ranks recommendations based on user preferences and dietary restrictions
   */
  private filterAndRankRecommendations(recommendations: CuisineRecommendation[], request: MoodBasedRecommendationRequest): CuisineRecommendation[] {
    let filtered = [...recommendations];

    // Filter by dietary restrictions
    if (request.userPreferences?.dietaryRestrictions) {
      const restrictionMap: Record<string, string[]> = {
        'vegetarian': ['Korean BBQ', 'Steakhouse'],
        'vegan': ['Korean BBQ', 'Steakhouse', 'French', 'Fine Dining'],
        'halal': ['Korean BBQ', 'Wine Bar'],
        'kosher': ['Korean BBQ', 'Wine Bar'],
        'gluten-free': ['Noodles', 'Pasta'],
        'dairy-free': ['French', 'Italian', 'Fine Dining']
      };

      filtered = filtered.filter(rec => {
        return !request.userPreferences!.dietaryRestrictions!.some(restriction =>
          restrictionMap[restriction]?.includes(rec.cuisineType)
        );
      });
    }

    // Boost preferred cuisines
    if (request.userPreferences?.cuisineTypes) {
      filtered = filtered.map(rec => {
        if (request.userPreferences!.cuisineTypes!.includes(rec.cuisineType)) {
          return {
            ...rec,
            matchScore: Math.min(1, rec.matchScore + 0.2),
            reasoning: `${rec.reasoning} (matches your cuisine preferences)`
          };
        }
        return rec;
      });
    }

    return filtered.sort((a, b) => b.matchScore - a.matchScore).slice(0, 6);
  }

  /**
   * Generates reasoning for the recommendation approach
   */
  private generateRecommendationReasoning(request: MoodBasedRecommendationRequest, type: string): string {
    const { primaryEmotion, intensity } = request;
    const intensityText = intensity >= 4 ? 'strongly' : intensity <= 2 ? 'mildly' : 'moderately';

    let baseReasoning = `You appear to be ${intensityText} feeling ${primaryEmotion}.`;

    switch (type) {
      case 'comfort':
        baseReasoning += ' I\'ve focused on comfort food options that provide emotional warmth and familiar flavors to help you feel better.';
        break;
      case 'celebratory':
        baseReasoning += ' I\'ve selected celebratory dining options with festive atmospheres and special cuisines to match your positive mood.';
        break;
      case 'therapeutic':
        baseReasoning += ' I\'ve chosen calming cuisines and peaceful dining environments to help you relax and decompress.';
        break;
      case 'adventurous':
        baseReasoning += ' I\'ve recommended exciting and unique dining experiences to satisfy your adventurous spirit.';
        break;
      default:
        baseReasoning += ' I\'ve provided versatile dining options that work well for any mood, with fallbacks based on your preferences.';
    }

    if (request.context?.socialSetting) {
      baseReasoning += ` The recommendations are tailored for ${request.context.socialSetting === 'alone' ? 'solo' : request.context.socialSetting} dining.`;
    }

    return baseReasoning;
  }

  /**
   * Calculates confidence in the recommendation approach
   */
  private calculateRecommendationConfidence(request: MoodBasedRecommendationRequest, type: string): number {
    let confidence = 0.7; // Base confidence

    // Boost confidence for clear emotional states
    if (['sad', 'happy', 'stressed', 'excited'].includes(request.primaryEmotion)) {
      confidence += 0.2;
    }

    // Boost confidence for high intensity emotions
    if (request.intensity >= 4) {
      confidence += 0.1;
    }

    // Boost confidence if we have contextual information
    if (request.context && Object.keys(request.context).length > 0) {
      confidence += 0.1;
    }

    // Boost confidence if we have user preferences
    if (request.userPreferences && (request.userPreferences.cuisineTypes || request.userPreferences.dietaryRestrictions)) {
      confidence += 0.1;
    }

    return Math.min(0.95, confidence);
  }

  /**
   * Initialize comfort food mappings for different negative emotions
   */
  private initializeComfortFoodMappings(): void {
    this.comfortFoodCuisines.set('sad', [
      { cuisineType: 'Comfort Food', matchScore: 0.95, reasoning: 'Classic comfort dishes designed to soothe and nurture', specificDishes: ['Mac and Cheese', 'Chicken Soup', 'Grilled Cheese'] },
      { cuisineType: 'Chinese', matchScore: 0.9, reasoning: 'Familiar, warming dishes provide emotional comfort', specificDishes: ['Congee', 'Wonton Soup', 'Home-style Stir-fry'] },
      { cuisineType: 'Italian', matchScore: 0.85, reasoning: 'Rich, hearty pasta dishes provide warmth and satisfaction', specificDishes: ['Carbonara', 'Lasagna', 'Minestrone'] },
      { cuisineType: 'Japanese', matchScore: 0.8, reasoning: 'Simple, clean flavors and mindful eating can be therapeutic', specificDishes: ['Udon', 'Miso Soup', 'Onigiri'] }
    ]);

    this.comfortFoodCuisines.set('lonely', [
      { cuisineType: 'Comfort Food', matchScore: 0.9, reasoning: 'Familiar, nurturing dishes provide emotional warmth', specificDishes: ['Chicken Soup', 'Hot Chocolate', 'Comfort Classics'] },
      { cuisineType: 'Chinese', matchScore: 0.85, reasoning: 'Family-style dining culture provides sense of connection', specificDishes: ['Family Set Meals', 'Hot Pot', 'Dim Sum'] },
      { cuisineType: 'Cafe', matchScore: 0.8, reasoning: 'Social cafe atmosphere provides sense of community', specificDishes: ['Coffee', 'Pastries', 'Light Meals'] },
      { cuisineType: 'Local Hong Kong', matchScore: 0.75, reasoning: 'Familiar local flavors provide sense of belonging', specificDishes: ['Cha Chaan Teng', 'Milk Tea', 'Local Favorites'] }
    ]);

    this.comfortFoodCuisines.set('tired', [
      { cuisineType: 'Comfort Food', matchScore: 0.9, reasoning: 'Easy-to-eat, satisfying dishes require minimal effort', specificDishes: ['Sandwiches', 'Soup', 'Simple Pasta'] },
      { cuisineType: 'Congee', matchScore: 0.85, reasoning: 'Easy-to-digest, warming porridge is gentle on tired system', specificDishes: ['Plain Congee', 'Chicken Congee', 'Fish Congee'] },
      { cuisineType: 'Noodles', matchScore: 0.8, reasoning: 'Simple, carb-rich dishes provide quick energy boost', specificDishes: ['Ramen', 'Pho', 'Simple Noodle Soup'] },
      { cuisineType: 'Chinese', matchScore: 0.75, reasoning: 'Familiar, nourishing dishes provide energy and comfort', specificDishes: ['Fried Rice', 'Simple Stir-fry', 'Clear Soup'] }
    ]);

    this.comfortFoodCuisines.set('general', [
      { cuisineType: 'Comfort Food', matchScore: 0.9, reasoning: 'Universal comfort dishes that soothe and satisfy', specificDishes: ['Comfort Classics', 'Hearty Soups', 'Warm Dishes'] },
      { cuisineType: 'Chinese', matchScore: 0.85, reasoning: 'Versatile, familiar cuisine with comforting options', specificDishes: ['Congee', 'Fried Rice', 'Home-style Cooking'] },
      { cuisineType: 'Italian', matchScore: 0.8, reasoning: 'Hearty, satisfying dishes with universal appeal', specificDishes: ['Pasta', 'Pizza', 'Comfort Italian'] }
    ]);
  }

  /**
   * Initialize celebratory dining mappings for positive emotions
   */
  private initializeCelebratoryDiningMappings(): void {
    this.celebratoryDiningOptions.set('happy', [
      { cuisineType: 'French', matchScore: 0.9, reasoning: 'Elegant cuisine perfect for special occasions', specificDishes: ['Champagne', 'Fine French Cuisine', 'Celebration Menu'] },
      { cuisineType: 'Italian', matchScore: 0.85, reasoning: 'Vibrant flavors and social dining culture match celebratory mood', specificDishes: ['Celebration Pizza', 'Festive Pasta', 'Italian Wine'] },
      { cuisineType: 'Fine Dining', matchScore: 0.85, reasoning: 'Special occasion dining with exceptional experience', specificDishes: ['Tasting Menu', 'Premium Ingredients', 'Wine Pairing'] },
      { cuisineType: 'Japanese', matchScore: 0.8, reasoning: 'Beautiful presentation and premium options for celebration', specificDishes: ['Premium Sushi', 'Omakase', 'Sake Pairing'] }
    ]);

    this.celebratoryDiningOptions.set('excited', [
      { cuisineType: 'Korean BBQ', matchScore: 0.9, reasoning: 'Interactive, social dining perfect for excited energy', specificDishes: ['Premium BBQ', 'Group Dining', 'Soju'] },
      { cuisineType: 'Thai', matchScore: 0.85, reasoning: 'Bold, exciting flavors match energetic emotional state', specificDishes: ['Spicy Dishes', 'Tom Yum', 'Thai Feast'] },
      { cuisineType: 'Mexican', matchScore: 0.8, reasoning: 'Festive, colorful cuisine perfect for excitement', specificDishes: ['Celebration Tacos', 'Margaritas', 'Festive Mexican'] },
      { cuisineType: 'Fusion', matchScore: 0.75, reasoning: 'Creative, exciting combinations match adventurous excitement', specificDishes: ['Creative Fusion', 'Innovative Dishes', 'Unique Combinations'] }
    ]);

    this.celebratoryDiningOptions.set('general', [
      { cuisineType: 'Fine Dining', matchScore: 0.85, reasoning: 'Premium dining experience for special occasions', specificDishes: ['Celebration Menu', 'Premium Service', 'Special Occasion'] },
      { cuisineType: 'Italian', matchScore: 0.8, reasoning: 'Popular celebration cuisine with festive atmosphere', specificDishes: ['Celebration Pizza', 'Pasta', 'Italian Wine'] },
      { cuisineType: 'French', matchScore: 0.75, reasoning: 'Elegant option for sophisticated celebrations', specificDishes: ['French Cuisine', 'Wine', 'Elegant Dining'] }
    ]);
  }

  /**
   * Initialize therapeutic cuisine mappings for stressed/angry emotions
   */
  private initializeTherapeuticCuisineMappings(): void {
    this.therapeuticCuisines.set('stressed', [
      { cuisineType: 'Japanese', matchScore: 0.9, reasoning: 'Zen-like dining experience and clean flavors promote calm', specificDishes: ['Sashimi', 'Green Tea', 'Tofu Dishes'] },
      { cuisineType: 'Vietnamese', matchScore: 0.85, reasoning: 'Light, fresh pho and herbs have calming properties', specificDishes: ['Pho', 'Fresh Spring Rolls', 'Vietnamese Salad'] },
      { cuisineType: 'Healthy', matchScore: 0.8, reasoning: 'Nutritious, clean eating supports mental well-being', specificDishes: ['Salad Bowls', 'Smoothies', 'Grilled Vegetables'] },
      { cuisineType: 'Tea House', matchScore: 0.75, reasoning: 'Calming tea ceremony and light snacks promote relaxation', specificDishes: ['Tea', 'Light Dim Sum', 'Calming Atmosphere'] }
    ]);

    this.therapeuticCuisines.set('angry', [
      { cuisineType: 'Spicy Sichuan', matchScore: 0.85, reasoning: 'Intense spice can provide cathartic release for anger', specificDishes: ['Mapo Tofu', 'Spicy Hot Pot', 'Sichuan Pepper Dishes'] },
      { cuisineType: 'Korean', matchScore: 0.8, reasoning: 'Spicy, bold flavors can help process intense emotions', specificDishes: ['Kimchi Jjigae', 'Spicy Korean', 'Bold Flavors'] },
      { cuisineType: 'Indian', matchScore: 0.75, reasoning: 'Complex spices and bold flavors match intense emotions', specificDishes: ['Curry', 'Spicy Indian', 'Complex Flavors'] }
    ]);

    this.therapeuticCuisines.set('general', [
      { cuisineType: 'Japanese', matchScore: 0.85, reasoning: 'Calming, mindful dining experience', specificDishes: ['Simple Japanese', 'Tea', 'Zen Dining'] },
      { cuisineType: 'Healthy', matchScore: 0.8, reasoning: 'Clean, nutritious options support well-being', specificDishes: ['Healthy Options', 'Fresh Ingredients', 'Balanced Meals'] },
      { cuisineType: 'Vietnamese', matchScore: 0.75, reasoning: 'Light, fresh options with therapeutic herbs', specificDishes: ['Pho', 'Fresh Herbs', 'Light Vietnamese'] }
    ]);
  }
}