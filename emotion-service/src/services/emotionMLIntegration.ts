import { 
  EmotionAnalysisRequest, 
  EmotionAnalysisResult, 
  DetectedEmotion,
  EmotionContext 
} from '../../../shared/src/types/emotion.types';
import { EmotionAnalysisService } from './emotionAnalysis';
import { MoodBasedRecommendationService } from './moodBasedRecommendation';

export interface SentimentAnalysisConfig {
  bedrockEndpoint?: string;
  region: string;
  timeout: number;
  retryAttempts: number;
  fallbackEnabled: boolean;
}

export interface NLPAnalysisResult {
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  confidence: number;
  emotions: Array<{
    emotion: string;
    confidence: number;
    intensity: number;
  }>;
  keywords: string[];
  context: {
    timeIndicators?: string[];
    socialIndicators?: string[];
    intensityIndicators?: string[];
  };
}

export interface EmotionMLResult {
  emotionAnalysis: EmotionAnalysisResult;
  nlpAnalysis: NLPAnalysisResult;
  enhancedRecommendations: {
    cuisines: string[];
    atmospheres: string[];
    confidence: number;
    reasoning: string;
  };
  modelMetadata: {
    modelsUsed: string[];
    processingTime: number;
    fallbackUsed: boolean;
  };
}

export class EmotionMLIntegrationService {
  private emotionAnalysisService: EmotionAnalysisService;
  private moodBasedRecommendationService: MoodBasedRecommendationService;
  private sentimentConfig: SentimentAnalysisConfig;

  constructor(sentimentConfig: SentimentAnalysisConfig) {
    this.emotionAnalysisService = new EmotionAnalysisService();
    this.moodBasedRecommendationService = new MoodBasedRecommendationService();
    this.sentimentConfig = sentimentConfig;
  }

  /**
   * Analyze emotion with ML-enhanced sentiment analysis and NLP
   */
  public async analyzeEmotionWithML(request: EmotionAnalysisRequest): Promise<EmotionMLResult> {
    const startTime = Date.now();
    const modelsUsed: string[] = [];
    let fallbackUsed = false;

    try {
      // Get base emotion analysis
      const emotionAnalysis = this.emotionAnalysisService.analyzeEmotion(request);
      modelsUsed.push('rule-based-emotion');

      // Enhance with NLP analysis if text input is provided
      let nlpAnalysis: NLPAnalysisResult;
      if (request.textInput && request.textInput.trim().length > 0) {
        try {
          nlpAnalysis = await this.performNLPAnalysis(request.textInput, request.context);
          modelsUsed.push('nlp-sentiment');
        } catch (error) {
          console.warn('NLP analysis failed, using fallback:', error instanceof Error ? error.message : String(error));
          nlpAnalysis = this.getFallbackNLPAnalysis(request.textInput);
          fallbackUsed = true;
          modelsUsed.push('fallback-nlp');
        }
      } else {
        nlpAnalysis = this.getEmptyNLPAnalysis();
      }

      // Combine emotion analysis with NLP insights
      const enhancedEmotionAnalysis = this.combineEmotionAndNLP(emotionAnalysis, nlpAnalysis);

      // Generate enhanced recommendations
      const enhancedRecommendations = this.generateEnhancedRecommendations(
        enhancedEmotionAnalysis,
        nlpAnalysis,
        request
      );

      const processingTime = Date.now() - startTime;

      return {
        emotionAnalysis: enhancedEmotionAnalysis,
        nlpAnalysis,
        enhancedRecommendations,
        modelMetadata: {
          modelsUsed,
          processingTime,
          fallbackUsed
        }
      };

    } catch (error) {
      console.error('Emotion ML analysis failed:', error instanceof Error ? error.message : String(error));
      
      if (this.sentimentConfig.fallbackEnabled) {
        return this.getFallbackEmotionAnalysis(request, startTime);
      }
      
      throw new Error(`Emotion ML analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Detect mood from text input using natural language processing
   */
  public async detectMoodFromText(textInput: string, context?: EmotionContext): Promise<{
    detectedMood: string;
    confidence: number;
    intensity: number;
    supportingEvidence: string[];
  }> {
    try {
      const nlpResult = await this.performNLPAnalysis(textInput, context);
      
      // Find the highest confidence emotion
      const primaryEmotion = nlpResult.emotions.length > 0 
        ? nlpResult.emotions.reduce((prev, current) => 
            current.confidence > prev.confidence ? current : prev
          )
        : { emotion: 'neutral', confidence: 0.5, intensity: 3 };

      return {
        detectedMood: primaryEmotion.emotion,
        confidence: primaryEmotion.confidence,
        intensity: primaryEmotion.intensity,
        supportingEvidence: [
          ...nlpResult.keywords,
          ...Object.values(nlpResult.context).flat()
        ].filter(Boolean)
      };

    } catch (error) {
      console.warn('NLP mood detection failed, using fallback:', error instanceof Error ? error.message : String(error));
      
      // Fallback to rule-based analysis
      const emotionRequest: EmotionAnalysisRequest = {
        userId: 'fallback-user',
        textInput,
        context
      };
      
      const fallbackResult = this.emotionAnalysisService.analyzeEmotion(emotionRequest);
      
      return {
        detectedMood: fallbackResult.primaryEmotion,
        confidence: fallbackResult.confidence * 0.7, // Reduce confidence for fallback
        intensity: fallbackResult.intensity,
        supportingEvidence: ['fallback_analysis']
      };
    }
  }

  /**
   * Generate emotion-aware recommendations using ML insights
   */
  public async generateEmotionAwareRecommendations(
    emotionAnalysis: EmotionAnalysisResult,
    userPreferences?: any,
    context?: EmotionContext
  ): Promise<{
    cuisineRecommendations: Array<{
      cuisine: string;
      matchScore: number;
      emotionalAlignment: number;
      reasoning: string;
    }>;
    atmosphereRecommendations: Array<{
      atmosphere: string;
      matchScore: number;
      emotionalAlignment: number;
      reasoning: string;
    }>;
    overallConfidence: number;
  }> {
    try {
      // Get mood-based recommendations
      const moodRecommendations = this.moodBasedRecommendationService.generateMoodBasedRecommendations({
        primaryEmotion: emotionAnalysis.primaryEmotion,
        intensity: emotionAnalysis.intensity,
        secondaryEmotions: emotionAnalysis.secondaryEmotions,
        context,
        userPreferences
      });

      // Convert to the expected format with emotional alignment scores
      const cuisineRecommendations = moodRecommendations.primaryRecommendations.map(rec => ({
        cuisine: rec.cuisineType,
        matchScore: rec.matchScore,
        emotionalAlignment: this.calculateEmotionalAlignment(rec.cuisineType, emotionAnalysis.primaryEmotion),
        reasoning: rec.reasoning
      }));

      const atmosphereRecommendations = emotionAnalysis.recommendedAtmosphere.map(atmosphere => ({
        atmosphere,
        matchScore: this.calculateAtmosphereMatchScore(atmosphere, emotionAnalysis.primaryEmotion, emotionAnalysis.intensity),
        emotionalAlignment: this.calculateAtmosphereEmotionalAlignment(atmosphere, emotionAnalysis.primaryEmotion),
        reasoning: `${atmosphere} atmosphere aligns with your ${emotionAnalysis.primaryEmotion} mood`
      }));

      return {
        cuisineRecommendations: cuisineRecommendations.slice(0, 5),
        atmosphereRecommendations: atmosphereRecommendations.slice(0, 5),
        overallConfidence: moodRecommendations.confidence
      };

    } catch (error) {
      console.error('Emotion-aware recommendation generation failed:', error instanceof Error ? error.message : String(error));
      
      // Fallback to basic recommendations
      return {
        cuisineRecommendations: emotionAnalysis.recommendedCuisines.map(cuisine => ({
          cuisine,
          matchScore: 0.6,
          emotionalAlignment: 0.5,
          reasoning: `${cuisine} cuisine selected based on your ${emotionAnalysis.primaryEmotion} mood`
        })),
        atmosphereRecommendations: emotionAnalysis.recommendedAtmosphere.map(atmosphere => ({
          atmosphere,
          matchScore: 0.6,
          emotionalAlignment: 0.5,
          reasoning: `${atmosphere} atmosphere matches your emotional state`
        })),
        overallConfidence: emotionAnalysis.confidence * 0.7
      };
    }
  }

  /**
   * Perform NLP analysis using AWS Bedrock or fallback methods
   */
  private async performNLPAnalysis(textInput: string, context?: EmotionContext): Promise<NLPAnalysisResult> {
    // In a real implementation, this would call AWS Bedrock for NLP analysis
    // For now, we'll simulate the analysis with enhanced rule-based processing
    
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100)); // Simulate API call

    // Simulate occasional failures for testing
    if (Math.random() < 0.05) { // 5% failure rate
      throw new Error('Simulated NLP service failure');
    }

    return this.simulateNLPAnalysis(textInput, context);
  }

  /**
   * Simulate NLP analysis for development/testing
   */
  private simulateNLPAnalysis(textInput: string, context?: EmotionContext): NLPAnalysisResult {
    const input = textInput.toLowerCase();
    
    // Analyze sentiment
    const positiveWords = ['happy', 'great', 'amazing', 'wonderful', 'excited', 'love', 'fantastic', 'perfect'];
    const negativeWords = ['sad', 'terrible', 'awful', 'hate', 'disappointed', 'frustrated', 'angry', 'upset'];
    
    const positiveCount = positiveWords.filter(word => input.includes(word)).length;
    const negativeCount = negativeWords.filter(word => input.includes(word)).length;
    
    let sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
    let sentimentConfidence: number;
    
    if (positiveCount > negativeCount) {
      sentiment = 'positive';
      sentimentConfidence = Math.min(0.9, 0.6 + (positiveCount * 0.1));
    } else if (negativeCount > positiveCount) {
      sentiment = 'negative';
      sentimentConfidence = Math.min(0.9, 0.6 + (negativeCount * 0.1));
    } else if (positiveCount > 0 && negativeCount > 0) {
      sentiment = 'mixed';
      sentimentConfidence = 0.7;
    } else {
      sentiment = 'neutral';
      sentimentConfidence = 0.5;
    }

    // Detect emotions with confidence and intensity
    const emotions = this.detectEmotionsFromNLP(input);
    
    // Extract keywords
    const keywords = this.extractKeywords(input);
    
    // Analyze context indicators
    const contextAnalysis = this.analyzeContextIndicators(input);

    return {
      sentiment,
      confidence: sentimentConfidence,
      emotions,
      keywords,
      context: contextAnalysis
    };
  }

  /**
   * Detect emotions from NLP analysis
   */
  private detectEmotionsFromNLP(input: string): Array<{ emotion: string; confidence: number; intensity: number }> {
    const emotionPatterns = {
      'happy': ['happy', 'joy', 'excited', 'cheerful', 'delighted', 'thrilled'],
      'sad': ['sad', 'down', 'depressed', 'blue', 'melancholy', 'upset'],
      'angry': ['angry', 'mad', 'furious', 'irritated', 'annoyed', 'frustrated'],
      'stressed': ['stressed', 'anxious', 'overwhelmed', 'pressure', 'tense', 'worried'],
      'tired': ['tired', 'exhausted', 'drained', 'weary', 'fatigued', 'sleepy'],
      'romantic': ['romantic', 'love', 'date', 'intimate', 'valentine', 'special'],
      'adventurous': ['adventurous', 'explore', 'try new', 'experiment', 'bold', 'curious']
    };

    const detectedEmotions: Array<{ emotion: string; confidence: number; intensity: number }> = [];

    for (const [emotion, patterns] of Object.entries(emotionPatterns)) {
      const matches = patterns.filter(pattern => input.includes(pattern));
      if (matches.length > 0) {
        const confidence = Math.min(0.9, matches.length * 0.3 + 0.4);
        const intensity = this.calculateIntensityFromText(input, matches);
        
        detectedEmotions.push({
          emotion,
          confidence,
          intensity
        });
      }
    }

    // Sort by confidence and return top emotions
    return detectedEmotions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
  }

  /**
   * Calculate emotion intensity from text analysis
   */
  private calculateIntensityFromText(input: string, matches: string[]): number {
    let intensity = 3; // Base intensity

    // Check for intensity modifiers
    const intensityModifiers = {
      'extremely': 5, 'very': 4, 'really': 4, 'quite': 3, 'somewhat': 2, 'slightly': 1,
      'incredibly': 5, 'super': 4, 'pretty': 3, 'a bit': 2, 'mildly': 1
    };

    for (const [modifier, value] of Object.entries(intensityModifiers)) {
      if (input.includes(modifier)) {
        intensity = Math.max(intensity, value);
      }
    }

    // Adjust based on punctuation
    if (input.includes('!!!')) intensity = Math.min(5, intensity + 1);
    if (input.includes('!!')) intensity = Math.min(5, intensity + 0.5);

    // Multiple matches indicate higher intensity
    if (matches.length > 1) {
      intensity = Math.min(5, intensity + 0.5);
    }

    return Math.round(intensity);
  }

  /**
   * Extract relevant keywords from text
   */
  private extractKeywords(input: string): string[] {
    const keywords: string[] = [];
    
    // Food-related keywords
    const foodKeywords = ['food', 'eat', 'hungry', 'craving', 'taste', 'flavor', 'spicy', 'sweet', 'comfort'];
    foodKeywords.forEach(keyword => {
      if (input.includes(keyword)) keywords.push(keyword);
    });

    // Mood-related keywords
    const moodKeywords = ['feeling', 'mood', 'emotion', 'state', 'vibe', 'energy'];
    moodKeywords.forEach(keyword => {
      if (input.includes(keyword)) keywords.push(keyword);
    });

    // Social context keywords
    const socialKeywords = ['alone', 'friends', 'family', 'date', 'business', 'celebration'];
    socialKeywords.forEach(keyword => {
      if (input.includes(keyword)) keywords.push(keyword);
    });

    return keywords;
  }

  /**
   * Analyze context indicators from text
   */
  private analyzeContextIndicators(input: string): {
    timeIndicators?: string[];
    socialIndicators?: string[];
    intensityIndicators?: string[];
  } {
    const context: any = {};

    // Time indicators
    const timeWords = ['morning', 'lunch', 'dinner', 'evening', 'night', 'late', 'early', 'now', 'today'];
    const foundTimeWords = timeWords.filter(word => input.includes(word));
    if (foundTimeWords.length > 0) {
      context.timeIndicators = foundTimeWords;
    }

    // Social indicators
    const socialWords = ['alone', 'solo', 'friends', 'family', 'date', 'partner', 'colleagues', 'group'];
    const foundSocialWords = socialWords.filter(word => input.includes(word));
    if (foundSocialWords.length > 0) {
      context.socialIndicators = foundSocialWords;
    }

    // Intensity indicators
    const intensityWords = ['very', 'extremely', 'really', 'quite', 'somewhat', 'slightly', 'incredibly', 'super'];
    const foundIntensityWords = intensityWords.filter(word => input.includes(word));
    if (foundIntensityWords.length > 0) {
      context.intensityIndicators = foundIntensityWords;
    }

    return context;
  }

  /**
   * Combine emotion analysis with NLP insights
   */
  private combineEmotionAndNLP(emotionAnalysis: EmotionAnalysisResult, nlpAnalysis: NLPAnalysisResult): EmotionAnalysisResult {
    // If NLP detected emotions, blend with rule-based analysis
    if (nlpAnalysis.emotions.length > 0) {
      const nlpPrimaryEmotion = nlpAnalysis.emotions[0];
      
      // If NLP and rule-based agree, boost confidence
      if (nlpPrimaryEmotion.emotion === emotionAnalysis.primaryEmotion) {
        return {
          ...emotionAnalysis,
          confidence: Math.min(0.95, emotionAnalysis.confidence + 0.2),
          intensity: Math.round((emotionAnalysis.intensity + nlpPrimaryEmotion.intensity) / 2),
          reasoning: `${emotionAnalysis.reasoning} (confirmed by advanced sentiment analysis)`
        };
      }
      
      // If they disagree but NLP has high confidence, use NLP result
      if (nlpPrimaryEmotion.confidence > 0.8 && nlpPrimaryEmotion.confidence > emotionAnalysis.confidence) {
        return {
          ...emotionAnalysis,
          primaryEmotion: nlpPrimaryEmotion.emotion,
          intensity: nlpPrimaryEmotion.intensity,
          confidence: nlpPrimaryEmotion.confidence,
          reasoning: `Advanced sentiment analysis detected ${nlpPrimaryEmotion.emotion} with high confidence`
        };
      }
    }

    // Default: return original analysis with slight confidence boost for having NLP data
    return {
      ...emotionAnalysis,
      confidence: Math.min(0.95, emotionAnalysis.confidence + 0.1),
      reasoning: `${emotionAnalysis.reasoning} (enhanced with sentiment analysis)`
    };
  }

  /**
   * Generate enhanced recommendations combining emotion and NLP insights
   */
  private generateEnhancedRecommendations(
    emotionAnalysis: EmotionAnalysisResult,
    nlpAnalysis: NLPAnalysisResult,
    request: EmotionAnalysisRequest
  ): {
    cuisines: string[];
    atmospheres: string[];
    confidence: number;
    reasoning: string;
  } {
    let cuisines = [...emotionAnalysis.recommendedCuisines];
    let atmospheres = [...emotionAnalysis.recommendedAtmosphere];
    let confidence = emotionAnalysis.confidence;

    // Enhance recommendations based on NLP keywords
    if (nlpAnalysis.keywords.includes('spicy')) {
      cuisines = ['Sichuan', 'Thai', 'Korean', 'Indian', ...cuisines.filter(c => !['Sichuan', 'Thai', 'Korean', 'Indian'].includes(c))];
    }

    if (nlpAnalysis.keywords.includes('comfort')) {
      cuisines = ['Comfort Food', 'Chinese', 'Italian', ...cuisines.filter(c => !['Comfort Food', 'Chinese', 'Italian'].includes(c))];
      atmospheres = ['cozy', 'warm', 'familiar', ...atmospheres.filter(a => !['cozy', 'warm', 'familiar'].includes(a))];
    }

    // Adjust based on social context
    if (nlpAnalysis.context.socialIndicators?.includes('date')) {
      atmospheres = ['romantic', 'intimate', 'elegant', ...atmospheres.filter(a => !['romantic', 'intimate', 'elegant'].includes(a))];
      cuisines = ['French', 'Italian', 'Fine Dining', ...cuisines.filter(c => !['French', 'Italian', 'Fine Dining'].includes(c))];
    }

    if (nlpAnalysis.context.socialIndicators?.includes('friends')) {
      atmospheres = ['social', 'lively', 'fun', ...atmospheres.filter(a => !['social', 'lively', 'fun'].includes(a))];
      cuisines = ['Korean BBQ', 'Hot Pot', 'Sharing Plates', ...cuisines.filter(c => !['Korean BBQ', 'Hot Pot', 'Sharing Plates'].includes(c))];
    }

    // Boost confidence if we have rich NLP data
    if (nlpAnalysis.keywords.length > 2 || Object.keys(nlpAnalysis.context).length > 1) {
      confidence = Math.min(0.95, confidence + 0.15);
    }

    const reasoning = `Enhanced recommendations based on ${emotionAnalysis.primaryEmotion} emotion analysis` +
      (nlpAnalysis.keywords.length > 0 ? ` and detected preferences: ${nlpAnalysis.keywords.join(', ')}` : '') +
      (nlpAnalysis.context.socialIndicators ? ` for ${nlpAnalysis.context.socialIndicators.join(', ')} dining` : '');

    return {
      cuisines: cuisines.slice(0, 5),
      atmospheres: atmospheres.slice(0, 5),
      confidence,
      reasoning
    };
  }

  /**
   * Calculate emotional alignment score for cuisine
   */
  private calculateEmotionalAlignment(cuisine: string, emotion: string): number {
    const alignmentMap: Record<string, Record<string, number>> = {
      'happy': { 'Italian': 0.9, 'Japanese': 0.8, 'Thai': 0.85, 'Mexican': 0.8 },
      'sad': { 'Comfort Food': 0.95, 'Chinese': 0.9, 'Italian': 0.8 },
      'stressed': { 'Japanese': 0.9, 'Vietnamese': 0.85, 'Healthy': 0.8 },
      'romantic': { 'French': 0.95, 'Italian': 0.9, 'Fine Dining': 0.85 },
      'adventurous': { 'Fusion': 0.9, 'Street Food': 0.85, 'International': 0.8 }
    };

    return alignmentMap[emotion]?.[cuisine] || 0.5;
  }

  /**
   * Calculate atmosphere match score
   */
  private calculateAtmosphereMatchScore(atmosphere: string, emotion: string, intensity: number): number {
    const baseScore = this.calculateAtmosphereEmotionalAlignment(atmosphere, emotion);
    
    // Adjust based on intensity
    if (intensity >= 4) {
      return Math.min(1.0, baseScore + 0.2);
    } else if (intensity <= 2) {
      return Math.max(0.3, baseScore - 0.1);
    }
    
    return baseScore;
  }

  /**
   * Calculate atmosphere emotional alignment
   */
  private calculateAtmosphereEmotionalAlignment(atmosphere: string, emotion: string): number {
    const alignmentMap: Record<string, Record<string, number>> = {
      'happy': { 'lively': 0.9, 'social': 0.85, 'bright': 0.8, 'festive': 0.9 },
      'sad': { 'cozy': 0.9, 'quiet': 0.85, 'intimate': 0.8, 'warm': 0.85 },
      'stressed': { 'calm': 0.95, 'peaceful': 0.9, 'quiet': 0.85, 'zen': 0.9 },
      'romantic': { 'intimate': 0.95, 'romantic': 0.9, 'elegant': 0.85, 'dim lighting': 0.8 },
      'tired': { 'comfortable': 0.9, 'casual': 0.8, 'relaxed': 0.85 }
    };

    return alignmentMap[emotion]?.[atmosphere] || 0.5;
  }

  /**
   * Get fallback NLP analysis when ML services fail
   */
  private getFallbackNLPAnalysis(textInput: string): NLPAnalysisResult {
    return {
      sentiment: 'neutral',
      confidence: 0.3,
      emotions: [{
        emotion: 'neutral',
        confidence: 0.3,
        intensity: 3
      }],
      keywords: [],
      context: {}
    };
  }

  /**
   * Get empty NLP analysis when no text input is provided
   */
  private getEmptyNLPAnalysis(): NLPAnalysisResult {
    return {
      sentiment: 'neutral',
      confidence: 0.5,
      emotions: [],
      keywords: [],
      context: {}
    };
  }

  /**
   * Get fallback emotion analysis when all ML services fail
   */
  private getFallbackEmotionAnalysis(request: EmotionAnalysisRequest, startTime: number): EmotionMLResult {
    console.warn('Using complete fallback for emotion analysis');

    const fallbackEmotionAnalysis = this.emotionAnalysisService.analyzeEmotion(request);
    const fallbackNLP = this.getFallbackNLPAnalysis(request.textInput || '');
    
    return {
      emotionAnalysis: {
        ...fallbackEmotionAnalysis,
        confidence: fallbackEmotionAnalysis.confidence * 0.7,
        reasoning: `${fallbackEmotionAnalysis.reasoning} (fallback mode)`
      },
      nlpAnalysis: fallbackNLP,
      enhancedRecommendations: {
        cuisines: fallbackEmotionAnalysis.recommendedCuisines,
        atmospheres: fallbackEmotionAnalysis.recommendedAtmosphere,
        confidence: fallbackEmotionAnalysis.confidence * 0.7,
        reasoning: 'Basic emotion analysis (fallback mode)'
      },
      modelMetadata: {
        modelsUsed: ['fallback'],
        processingTime: Date.now() - startTime,
        fallbackUsed: true
      }
    };
  }
}