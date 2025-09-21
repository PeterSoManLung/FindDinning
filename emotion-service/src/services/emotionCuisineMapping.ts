import { 
  MoodMapping, 
  CuisineRecommendation, 
  EmotionToCuisineMappingRequest 
} from '../../../shared/src/types/emotion.types';

export class EmotionCuisineMappingService {
  private moodMappings: Map<string, MoodMapping> = new Map();

  constructor() {
    this.initializeMoodMappings();
  }

  /**
   * Gets cuisine recommendations based on emotion and user preferences
   */
  public getCuisineRecommendations(request: EmotionToCuisineMappingRequest): CuisineRecommendation[] {
    const moodMapping = this.moodMappings.get(request.emotion) || this.moodMappings.get('neutral')!;
    let recommendations = [...moodMapping.cuisineRecommendations];

    // Filter based on user dietary restrictions
    if (request.userPreferences?.dietaryRestrictions) {
      recommendations = this.filterByDietaryRestrictions(
        recommendations, 
        request.userPreferences.dietaryRestrictions
      );
    }

    // Boost recommendations that match user's preferred cuisines
    if (request.userPreferences?.cuisineTypes) {
      recommendations = this.boostPreferredCuisines(
        recommendations,
        request.userPreferences.cuisineTypes
      );
    }

    // Adjust match scores based on emotion intensity
    if (request.intensity) {
      recommendations = this.adjustForIntensity(recommendations, request.emotion, request.intensity);
    }

    return recommendations
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 8); // Return top 8 recommendations
  }

  /**
   * Gets mood mapping for a specific emotion
   */
  public getMoodMapping(emotion: string): MoodMapping | null {
    return this.moodMappings.get(emotion) || null;
  }

  /**
   * Gets all available mood mappings
   */
  public getAllMoodMappings(): Map<string, MoodMapping> {
    return new Map(this.moodMappings);
  }

  /**
   * Initializes the emotion-to-cuisine mappings
   */
  private initializeMoodMappings(): void {
    // Happy/Celebratory emotions
    this.moodMappings.set('happy', {
      emotion: 'happy',
      cuisineRecommendations: [
        { cuisineType: 'Italian', matchScore: 0.9, reasoning: 'Vibrant flavors and social dining culture match celebratory mood', specificDishes: ['Pizza', 'Pasta', 'Risotto'] },
        { cuisineType: 'Japanese', matchScore: 0.85, reasoning: 'Fresh, clean flavors and beautiful presentation enhance positive feelings', specificDishes: ['Sushi', 'Ramen', 'Tempura'] },
        { cuisineType: 'Mediterranean', matchScore: 0.8, reasoning: 'Light, fresh ingredients and healthy options complement upbeat mood', specificDishes: ['Greek Salad', 'Hummus', 'Grilled Fish'] },
        { cuisineType: 'Thai', matchScore: 0.75, reasoning: 'Bold, exciting flavors match energetic emotional state', specificDishes: ['Pad Thai', 'Green Curry', 'Tom Yum'] },
        { cuisineType: 'Mexican', matchScore: 0.7, reasoning: 'Festive, colorful cuisine perfect for celebration', specificDishes: ['Tacos', 'Guacamole', 'Enchiladas'] }
      ],
      atmospherePreferences: ['lively', 'social', 'bright', 'energetic', 'festive'],
      priceRangeAdjustment: 0.2 // Willing to spend a bit more when happy
    });

    // Sad/Down emotions
    this.moodMappings.set('sad', {
      emotion: 'sad',
      cuisineRecommendations: [
        { cuisineType: 'Chinese', matchScore: 0.95, reasoning: 'Comforting, familiar flavors provide emotional support', specificDishes: ['Congee', 'Wonton Soup', 'Fried Rice'] },
        { cuisineType: 'Comfort Food', matchScore: 0.9, reasoning: 'Classic comfort dishes designed to soothe and nurture', specificDishes: ['Mac and Cheese', 'Chicken Soup', 'Mashed Potatoes'] },
        { cuisineType: 'Italian', matchScore: 0.85, reasoning: 'Rich, hearty pasta dishes provide warmth and satisfaction', specificDishes: ['Carbonara', 'Lasagna', 'Minestrone'] },
        { cuisineType: 'Japanese', matchScore: 0.8, reasoning: 'Simple, clean flavors and mindful eating can be therapeutic', specificDishes: ['Udon', 'Miso Soup', 'Onigiri'] },
        { cuisineType: 'Korean', matchScore: 0.75, reasoning: 'Warm, spicy soups and stews provide comfort and warmth', specificDishes: ['Kimchi Jjigae', 'Bibimbap', 'Korean BBQ'] }
      ],
      atmospherePreferences: ['quiet', 'cozy', 'intimate', 'comforting', 'private'],
      priceRangeAdjustment: -0.1 // Might prefer more affordable comfort food
    });

    // Stressed/Anxious emotions
    this.moodMappings.set('stressed', {
      emotion: 'stressed',
      cuisineRecommendations: [
        { cuisineType: 'Japanese', matchScore: 0.9, reasoning: 'Zen-like dining experience and light, clean flavors promote calm', specificDishes: ['Sashimi', 'Green Tea', 'Tofu Dishes'] },
        { cuisineType: 'Vietnamese', matchScore: 0.85, reasoning: 'Light, fresh pho and herbs have calming, restorative properties', specificDishes: ['Pho', 'Fresh Spring Rolls', 'Vietnamese Salad'] },
        { cuisineType: 'Healthy', matchScore: 0.8, reasoning: 'Nutritious, clean eating supports mental well-being', specificDishes: ['Salad Bowls', 'Smoothies', 'Grilled Vegetables'] },
        { cuisineType: 'Light Asian', matchScore: 0.75, reasoning: 'Simple, balanced flavors without overwhelming complexity', specificDishes: ['Steamed Fish', 'Clear Soups', 'Rice Dishes'] },
        { cuisineType: 'Tea House', matchScore: 0.7, reasoning: 'Calming tea ceremony and light snacks promote relaxation', specificDishes: ['Dim Sum', 'Tea', 'Light Pastries'] }
      ],
      atmospherePreferences: ['calm', 'peaceful', 'quiet', 'relaxing', 'zen'],
      priceRangeAdjustment: 0 // Neutral price adjustment
    });

    // Angry/Frustrated emotions
    this.moodMappings.set('angry', {
      emotion: 'angry',
      cuisineRecommendations: [
        { cuisineType: 'Spicy Sichuan', matchScore: 0.9, reasoning: 'Intense spice can provide cathartic release for anger', specificDishes: ['Mapo Tofu', 'Kung Pao Chicken', 'Hot Pot'] },
        { cuisineType: 'Korean BBQ', matchScore: 0.85, reasoning: 'Interactive grilling provides physical outlet for frustration', specificDishes: ['Bulgogi', 'Galbi', 'Kimchi'] },
        { cuisineType: 'Indian', matchScore: 0.8, reasoning: 'Bold spices and complex flavors can match intense emotions', specificDishes: ['Vindaloo', 'Biryani', 'Curry'] },
        { cuisineType: 'Thai', matchScore: 0.75, reasoning: 'Fiery chilies and bold flavors provide emotional release', specificDishes: ['Som Tam', 'Larb', 'Spicy Basil Stir-fry'] },
        { cuisineType: 'Mexican', matchScore: 0.7, reasoning: 'Spicy salsas and bold flavors can channel anger constructively', specificDishes: ['Spicy Tacos', 'Jalapeño Dishes', 'Hot Sauce'] }
      ],
      atmospherePreferences: ['private', 'quiet', 'spacious', 'minimal', 'calm'],
      priceRangeAdjustment: 0 // Neutral price adjustment
    });

    // Tired/Exhausted emotions
    this.moodMappings.set('tired', {
      emotion: 'tired',
      cuisineRecommendations: [
        { cuisineType: 'Comfort Food', matchScore: 0.9, reasoning: 'Easy-to-eat, satisfying dishes require minimal effort', specificDishes: ['Sandwiches', 'Soup', 'Pasta'] },
        { cuisineType: 'Chinese', matchScore: 0.85, reasoning: 'Familiar, nourishing dishes provide energy and comfort', specificDishes: ['Fried Rice', 'Noodle Soup', 'Dim Sum'] },
        { cuisineType: 'Noodles', matchScore: 0.8, reasoning: 'Simple, carb-rich dishes provide quick energy boost', specificDishes: ['Ramen', 'Pho', 'Pasta'] },
        { cuisineType: 'Congee', matchScore: 0.75, reasoning: 'Easy-to-digest, warming porridge is gentle on tired system', specificDishes: ['Plain Congee', 'Chicken Congee', 'Fish Congee'] },
        { cuisineType: 'Simple Asian', matchScore: 0.7, reasoning: 'Uncomplicated, balanced meals without overwhelming choices', specificDishes: ['Rice Bowls', 'Simple Stir-fry', 'Clear Soups'] }
      ],
      atmospherePreferences: ['comfortable', 'casual', 'relaxed', 'easy-going', 'low-key'],
      priceRangeAdjustment: -0.2 // Prefer more affordable, simple options
    });

    // Lonely emotions
    this.moodMappings.set('lonely', {
      emotion: 'lonely',
      cuisineRecommendations: [
        { cuisineType: 'Comfort Food', matchScore: 0.9, reasoning: 'Familiar, nurturing dishes provide emotional warmth', specificDishes: ['Chicken Soup', 'Grilled Cheese', 'Hot Chocolate'] },
        { cuisineType: 'Familiar Cuisines', matchScore: 0.85, reasoning: 'Known flavors provide sense of connection and belonging', specificDishes: ['Home-style Cooking', 'Traditional Dishes'] },
        { cuisineType: 'Chinese', matchScore: 0.8, reasoning: 'Family-style dining and sharing culture combat loneliness', specificDishes: ['Family Set Meals', 'Hot Pot', 'Dim Sum'] },
        { cuisineType: 'Western', matchScore: 0.75, reasoning: 'Familiar Western comfort foods provide emotional support', specificDishes: ['Burgers', 'Pizza', 'Pasta'] },
        { cuisineType: 'Cafe', matchScore: 0.7, reasoning: 'Social cafe atmosphere provides sense of community', specificDishes: ['Coffee', 'Pastries', 'Light Meals'] }
      ],
      atmospherePreferences: ['welcoming', 'friendly', 'community', 'social', 'warm'],
      priceRangeAdjustment: 0 // Neutral price adjustment
    });

    // Romantic emotions
    this.moodMappings.set('romantic', {
      emotion: 'romantic',
      cuisineRecommendations: [
        { cuisineType: 'French', matchScore: 0.95, reasoning: 'Elegant, sophisticated cuisine perfect for romantic occasions', specificDishes: ['Coq au Vin', 'Bouillabaisse', 'Crème Brûlée'] },
        { cuisineType: 'Italian', matchScore: 0.9, reasoning: 'Romantic dining culture with wine and intimate atmosphere', specificDishes: ['Osso Buco', 'Risotto', 'Tiramisu'] },
        { cuisineType: 'Fine Dining', matchScore: 0.85, reasoning: 'Special occasion dining with exceptional service and ambiance', specificDishes: ['Tasting Menu', 'Premium Ingredients', 'Wine Pairing'] },
        { cuisineType: 'Japanese', matchScore: 0.8, reasoning: 'Artful presentation and intimate omakase experience', specificDishes: ['Omakase', 'Premium Sushi', 'Kaiseki'] },
        { cuisineType: 'Wine Bar', matchScore: 0.75, reasoning: 'Intimate setting with wine and small plates for sharing', specificDishes: ['Charcuterie', 'Cheese Plates', 'Wine'] }
      ],
      atmospherePreferences: ['intimate', 'romantic', 'dim lighting', 'private', 'elegant'],
      priceRangeAdjustment: 0.5 // Willing to spend more for special occasions
    });

    // Nostalgic emotions
    this.moodMappings.set('nostalgic', {
      emotion: 'nostalgic',
      cuisineRecommendations: [
        { cuisineType: 'Traditional Chinese', matchScore: 0.95, reasoning: 'Authentic traditional dishes evoke memories and heritage', specificDishes: ['Peking Duck', 'Traditional Stir-fry', 'Classic Soups'] },
        { cuisineType: 'Cantonese', matchScore: 0.9, reasoning: 'Classic Hong Kong cuisine connects to local heritage', specificDishes: ['Char Siu', 'Wonton Noodles', 'Milk Tea'] },
        { cuisineType: 'Local Hong Kong', matchScore: 0.85, reasoning: 'Authentic local dishes trigger nostalgic memories', specificDishes: ['Pineapple Bun', 'Egg Tart', 'Hong Kong Milk Tea'] },
        { cuisineType: 'Cha Chaan Teng', matchScore: 0.8, reasoning: 'Traditional tea restaurants represent Hong Kong culture', specificDishes: ['Hong Kong Style Breakfast', 'Milk Tea', 'Toast'] },
        { cuisineType: 'Dim Sum', matchScore: 0.75, reasoning: 'Traditional family dining experience evokes memories', specificDishes: ['Har Gow', 'Siu Mai', 'Char Siu Bao'] }
      ],
      atmospherePreferences: ['traditional', 'authentic', 'family-style', 'heritage', 'classic'],
      priceRangeAdjustment: 0 // Neutral price adjustment
    });

    // Adventurous emotions
    this.moodMappings.set('adventurous', {
      emotion: 'adventurous',
      cuisineRecommendations: [
        { cuisineType: 'Fusion', matchScore: 0.9, reasoning: 'Creative combinations satisfy desire for new experiences', specificDishes: ['Asian Fusion', 'Modern Interpretations', 'Creative Dishes'] },
        { cuisineType: 'Exotic', matchScore: 0.85, reasoning: 'Unusual cuisines provide exciting new flavor adventures', specificDishes: ['Ethiopian', 'Peruvian', 'Moroccan'] },
        { cuisineType: 'Street Food', matchScore: 0.8, reasoning: 'Authentic street food offers adventurous, casual exploration', specificDishes: ['Food Truck Fare', 'Night Market Food', 'Local Specialties'] },
        { cuisineType: 'International', matchScore: 0.75, reasoning: 'Global cuisines satisfy curiosity about world flavors', specificDishes: ['Regional Specialties', 'Authentic International'] },
        { cuisineType: 'Experimental', matchScore: 0.7, reasoning: 'Innovative cooking techniques and unusual ingredients', specificDishes: ['Molecular Gastronomy', 'Unusual Combinations', 'Chef Specials'] }
      ],
      atmospherePreferences: ['unique', 'trendy', 'experimental', 'vibrant', 'eclectic'],
      priceRangeAdjustment: 0.1 // Slightly willing to pay more for unique experiences
    });

    // Comfort-seeking emotions
    this.moodMappings.set('comfort', {
      emotion: 'comfort',
      cuisineRecommendations: [
        { cuisineType: 'Comfort Food', matchScore: 0.95, reasoning: 'Classic comfort dishes designed to soothe and satisfy', specificDishes: ['Mac and Cheese', 'Chicken and Waffles', 'Meatloaf'] },
        { cuisineType: 'Chinese', matchScore: 0.9, reasoning: 'Familiar, warming dishes provide emotional comfort', specificDishes: ['Congee', 'Home-style Stir-fry', 'Soup Noodles'] },
        { cuisineType: 'Cantonese', matchScore: 0.85, reasoning: 'Traditional Cantonese comfort foods', specificDishes: ['Congee', 'Steamed Dishes', 'Soup'] },
        { cuisineType: 'Congee', matchScore: 0.8, reasoning: 'Ultimate comfort food - warm, soothing, and nourishing', specificDishes: ['Plain Congee', 'Chicken Congee', 'Preserved Egg Congee'] },
        { cuisineType: 'Noodles', matchScore: 0.75, reasoning: 'Warm, satisfying noodle dishes provide comfort', specificDishes: ['Beef Noodle Soup', 'Wonton Noodles', 'Dan Dan Noodles'] }
      ],
      atmospherePreferences: ['cozy', 'homey', 'familiar', 'warm', 'welcoming'],
      priceRangeAdjustment: -0.1 // Prefer affordable comfort options
    });

    // Neutral emotions (default)
    this.moodMappings.set('neutral', {
      emotion: 'neutral',
      cuisineRecommendations: [
        { cuisineType: 'Chinese', matchScore: 0.8, reasoning: 'Versatile cuisine suitable for any mood', specificDishes: ['Fried Rice', 'Sweet and Sour', 'Chow Mein'] },
        { cuisineType: 'Japanese', matchScore: 0.75, reasoning: 'Balanced, healthy options with broad appeal', specificDishes: ['Teriyaki', 'Sushi', 'Bento'] },
        { cuisineType: 'Italian', matchScore: 0.7, reasoning: 'Popular, accessible cuisine with familiar flavors', specificDishes: ['Pizza', 'Pasta', 'Salad'] },
        { cuisineType: 'Casual Dining', matchScore: 0.65, reasoning: 'Comfortable, unpretentious dining experience', specificDishes: ['Burgers', 'Sandwiches', 'Salads'] },
        { cuisineType: 'Asian', matchScore: 0.6, reasoning: 'Broad category with something for everyone', specificDishes: ['Stir-fry', 'Rice Dishes', 'Noodles'] }
      ],
      atmospherePreferences: ['casual', 'comfortable', 'friendly', 'relaxed', 'versatile'],
      priceRangeAdjustment: 0 // No price adjustment
    });
  }

  /**
   * Filters cuisine recommendations based on dietary restrictions
   */
  private filterByDietaryRestrictions(
    recommendations: CuisineRecommendation[], 
    restrictions: string[]
  ): CuisineRecommendation[] {
    const restrictionMap: Record<string, string[]> = {
      'vegetarian': ['Korean BBQ', 'Spicy Sichuan'],
      'vegan': ['Korean BBQ', 'Spicy Sichuan', 'French', 'Fine Dining'],
      'halal': ['Korean BBQ', 'Wine Bar'],
      'kosher': ['Korean BBQ', 'Wine Bar'],
      'gluten-free': ['Noodles', 'Pasta'],
      'dairy-free': ['French', 'Italian', 'Fine Dining']
    };

    return recommendations.filter(rec => {
      return !restrictions.some(restriction => 
        restrictionMap[restriction]?.includes(rec.cuisineType)
      );
    });
  }

  /**
   * Boosts match scores for user's preferred cuisines
   */
  private boostPreferredCuisines(
    recommendations: CuisineRecommendation[],
    preferredCuisines: string[]
  ): CuisineRecommendation[] {
    return recommendations.map(rec => {
      if (preferredCuisines.includes(rec.cuisineType)) {
        return {
          ...rec,
          matchScore: Math.min(1, rec.matchScore + 0.2),
          reasoning: `${rec.reasoning} (matches your cuisine preferences)`
        };
      }
      return rec;
    });
  }

  /**
   * Adjusts recommendations based on emotion intensity
   */
  private adjustForIntensity(
    recommendations: CuisineRecommendation[],
    emotion: string,
    intensity: number
  ): CuisineRecommendation[] {
    return recommendations.map(rec => {
      let adjustment = 0;
      
      // High intensity emotions get more specific recommendations
      if (intensity >= 4) {
        if (['angry', 'stressed', 'sad'].includes(emotion)) {
          adjustment = 0.1; // Boost therapeutic cuisines
        }
      }
      
      // Low intensity emotions get broader recommendations
      if (intensity <= 2) {
        if (rec.cuisineType.includes('Comfort') || rec.cuisineType === 'Chinese') {
          adjustment = 0.1; // Boost safe, familiar options
        }
      }

      return {
        ...rec,
        matchScore: Math.min(1, rec.matchScore + adjustment)
      };
    });
  }
}