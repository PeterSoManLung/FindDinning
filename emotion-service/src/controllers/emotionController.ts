import { Request, Response } from 'express';
import { EmotionAnalysisService } from '../services/emotionAnalysis';
import { EmotionCuisineMappingService } from '../services/emotionCuisineMapping';
import { ContextualMoodProcessingService } from '../services/contextualMoodProcessing';
import { MoodBasedRecommendationService, MoodBasedRecommendationRequest } from '../services/moodBasedRecommendation';
import { EmotionMLIntegrationService, SentimentAnalysisConfig } from '../services/emotionMLIntegration';
import { 
  EmotionAnalysisRequest, 
  EmotionToCuisineMappingRequest,
  EmotionContextRequest 
} from '../../../shared/src/types/emotion.types';
import { ResponseBuilder } from '../../../shared/src/utils/response.utils';

export class EmotionController {
  private emotionAnalysisService: EmotionAnalysisService;
  private cuisineMappingService: EmotionCuisineMappingService;
  private contextualMoodService: ContextualMoodProcessingService;
  private moodBasedRecommendationService: MoodBasedRecommendationService;
  private emotionMLService?: EmotionMLIntegrationService;

  constructor(mlConfig?: SentimentAnalysisConfig) {
    this.emotionAnalysisService = new EmotionAnalysisService();
    this.cuisineMappingService = new EmotionCuisineMappingService();
    this.contextualMoodService = new ContextualMoodProcessingService();
    this.moodBasedRecommendationService = new MoodBasedRecommendationService();
    
    // Initialize ML integration if config provided
    if (mlConfig) {
      this.emotionMLService = new EmotionMLIntegrationService(mlConfig);
    }
  }

  /**
   * Analyzes user emotional state and provides dining recommendations
   * POST /api/emotion/analyze
   */
  public analyzeEmotion = async (req: Request, res: Response): Promise<void> => {
    try {
      const request: EmotionAnalysisRequest = req.body;

      // Validate required fields
      if (!request.userId) {
        res.status(400).json(ResponseBuilder.error(
          'VALIDATION_ERROR',
          'User ID is required',
          { field: 'userId' }
        ));
        return;
      }

      // Validate that we have some input to analyze
      if (!request.textInput && !request.emotionalState) {
        res.status(400).json(ResponseBuilder.error(
          'VALIDATION_ERROR',
          'Either textInput or emotionalState is required',
          { fields: ['textInput', 'emotionalState'] }
        ));
        return;
      }

      const result = this.emotionAnalysisService.analyzeEmotion(request);

      res.json(ResponseBuilder.success(result));
    } catch (error) {
      console.error('Error in analyzeEmotion:', error);
      res.status(500).json(ResponseBuilder.error(
        'INTERNAL_ERROR',
        'Failed to analyze emotion',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  };

  /**
   * Gets cuisine recommendations based on emotion
   * GET /api/emotion/mood-mapping
   */
  public getMoodMapping = async (req: Request, res: Response): Promise<void> => {
    try {
      const { emotion, intensity, cuisineTypes, dietaryRestrictions } = req.query;

      if (!emotion || typeof emotion !== 'string') {
        res.status(400).json(ResponseBuilder.error(
          'VALIDATION_ERROR',
          'Emotion parameter is required',
          { field: 'emotion' }
        ));
        return;
      }

      const request: EmotionToCuisineMappingRequest = {
        emotion: emotion as string,
        intensity: intensity ? parseInt(intensity as string) : undefined,
        userPreferences: (cuisineTypes || dietaryRestrictions) ? {
          cuisineTypes: cuisineTypes ? (cuisineTypes as string).split(',') : [],
          dietaryRestrictions: dietaryRestrictions ? (dietaryRestrictions as string).split(',') : []
        } : undefined
      };

      // Validate intensity if provided
      if (request.intensity && (request.intensity < 1 || request.intensity > 5)) {
        res.status(400).json(ResponseBuilder.error(
          'VALIDATION_ERROR',
          'Intensity must be between 1 and 5',
          { field: 'intensity', value: request.intensity }
        ));
        return;
      }

      const cuisineRecommendations = this.cuisineMappingService.getCuisineRecommendations(request);
      const moodMapping = this.cuisineMappingService.getMoodMapping(emotion as string);

      const result = {
        emotion: emotion as string,
        cuisineRecommendations,
        atmospherePreferences: moodMapping?.atmospherePreferences || [],
        priceRangeAdjustment: moodMapping?.priceRangeAdjustment || 0
      };

      res.json(ResponseBuilder.success(result));
    } catch (error) {
      console.error('Error in getMoodMapping:', error);
      res.status(500).json(ResponseBuilder.error(
        'INTERNAL_ERROR',
        'Failed to get mood mapping',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  };

  /**
   * Processes contextual emotional cues
   * POST /api/emotion/context
   */
  public processEmotionContext = async (req: Request, res: Response): Promise<void> => {
    try {
      const request: EmotionContextRequest = req.body;

      // Validate required fields
      if (!request.textInput || typeof request.textInput !== 'string') {
        res.status(400).json(ResponseBuilder.error(
          'VALIDATION_ERROR',
          'Text input is required',
          { field: 'textInput' }
        ));
        return;
      }

      if (request.textInput.trim().length === 0) {
        res.status(400).json(ResponseBuilder.error(
          'VALIDATION_ERROR',
          'Text input cannot be empty',
          { field: 'textInput' }
        ));
        return;
      }

      const result = this.contextualMoodService.processEmotionContext(request);

      res.json(ResponseBuilder.success(result));
    } catch (error) {
      console.error('Error in processEmotionContext:', error);
      res.status(500).json(ResponseBuilder.error(
        'INTERNAL_ERROR',
        'Failed to process emotion context',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  };

  /**
   * Gets all available mood mappings
   * GET /api/emotion/mappings
   */
  public getAllMoodMappings = async (req: Request, res: Response): Promise<void> => {
    try {
      const mappings = this.cuisineMappingService.getAllMoodMappings();
      const result = Object.fromEntries(mappings);

      res.json(ResponseBuilder.success(result));
    } catch (error) {
      console.error('Error in getAllMoodMappings:', error);
      res.status(500).json(ResponseBuilder.error(
        'INTERNAL_ERROR',
        'Failed to get mood mappings',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  };

  /**
   * Gets contextual recommendations for specific situations
   * GET /api/emotion/contextual-recommendations/:context
   */
  public getContextualRecommendations = async (req: Request, res: Response): Promise<void> => {
    try {
      const { context } = req.params;

      if (!context) {
        res.status(400).json(ResponseBuilder.error(
          'VALIDATION_ERROR',
          'Context parameter is required',
          { field: 'context' }
        ));
        return;
      }

      const recommendations = this.contextualMoodService.getContextualRecommendations(context);

      if (recommendations.length === 0) {
        res.status(404).json(ResponseBuilder.error(
          'NOT_FOUND',
          'No recommendations found for the specified context',
          { context }
        ));
        return;
      }

      res.json(ResponseBuilder.success({ context, recommendations }));
    } catch (error) {
      console.error('Error in getContextualRecommendations:', error);
      res.status(500).json(ResponseBuilder.error(
        'INTERNAL_ERROR',
        'Failed to get contextual recommendations',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  };

  /**
   * Generates mood-based recommendations
   * POST /api/emotion/mood-recommendations
   */
  public generateMoodRecommendations = async (req: Request, res: Response): Promise<void> => {
    try {
      const request: MoodBasedRecommendationRequest = req.body;

      // Validate required fields
      if (!request.primaryEmotion) {
        res.status(400).json(ResponseBuilder.error(
          'VALIDATION_ERROR',
          'Primary emotion is required',
          { field: 'primaryEmotion' }
        ));
        return;
      }

      if (!request.intensity || request.intensity < 1 || request.intensity > 5) {
        res.status(400).json(ResponseBuilder.error(
          'VALIDATION_ERROR',
          'Intensity must be between 1 and 5',
          { field: 'intensity', value: request.intensity }
        ));
        return;
      }

      const result = this.moodBasedRecommendationService.generateMoodBasedRecommendations(request);

      res.json(ResponseBuilder.success(result));
    } catch (error) {
      console.error('Error in generateMoodRecommendations:', error);
      res.status(500).json(ResponseBuilder.error(
        'INTERNAL_ERROR',
        'Failed to generate mood-based recommendations',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  };

  /**
   * Identifies comfort food for negative emotions
   * POST /api/emotion/comfort-food
   */
  public identifyComfortFood = async (req: Request, res: Response): Promise<void> => {
    try {
      const { emotion, intensity, context } = req.body;

      if (!emotion) {
        res.status(400).json(ResponseBuilder.error(
          'VALIDATION_ERROR',
          'Emotion is required',
          { field: 'emotion' }
        ));
        return;
      }

      if (!intensity || intensity < 1 || intensity > 5) {
        res.status(400).json(ResponseBuilder.error(
          'VALIDATION_ERROR',
          'Intensity must be between 1 and 5',
          { field: 'intensity', value: intensity }
        ));
        return;
      }

      const result = this.moodBasedRecommendationService.identifyComfortFood(emotion, intensity, context);

      res.json(ResponseBuilder.success({ 
        emotion, 
        intensity, 
        comfortFoodRecommendations: result 
      }));
    } catch (error) {
      console.error('Error in identifyComfortFood:', error);
      res.status(500).json(ResponseBuilder.error(
        'INTERNAL_ERROR',
        'Failed to identify comfort food',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  };

  /**
   * Suggests celebratory dining options
   * POST /api/emotion/celebratory-dining
   */
  public suggestCelebratoryDining = async (req: Request, res: Response): Promise<void> => {
    try {
      const { emotion, intensity, context } = req.body;

      if (!emotion) {
        res.status(400).json(ResponseBuilder.error(
          'VALIDATION_ERROR',
          'Emotion is required',
          { field: 'emotion' }
        ));
        return;
      }

      if (!intensity || intensity < 1 || intensity > 5) {
        res.status(400).json(ResponseBuilder.error(
          'VALIDATION_ERROR',
          'Intensity must be between 1 and 5',
          { field: 'intensity', value: intensity }
        ));
        return;
      }

      const result = this.moodBasedRecommendationService.suggestCelebratoryDining(emotion, intensity, context);

      res.json(ResponseBuilder.success({ 
        emotion, 
        intensity, 
        celebratoryRecommendations: result 
      }));
    } catch (error) {
      console.error('Error in suggestCelebratoryDining:', error);
      res.status(500).json(ResponseBuilder.error(
        'INTERNAL_ERROR',
        'Failed to suggest celebratory dining',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  };

  /**
   * Handles neutral emotional state with preference-based fallbacks
   * POST /api/emotion/neutral-recommendations
   */
  public handleNeutralState = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userPreferences, context } = req.body;

      const result = this.moodBasedRecommendationService.handleNeutralState(userPreferences, context);

      res.json(ResponseBuilder.success({ 
        recommendationType: 'neutral',
        recommendations: result,
        reasoning: 'Versatile dining options suitable for any mood with preference-based customization'
      }));
    } catch (error) {
      console.error('Error in handleNeutralState:', error);
      res.status(500).json(ResponseBuilder.error(
        'INTERNAL_ERROR',
        'Failed to handle neutral state',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  };

  /**
   * ML-enhanced emotion analysis with sentiment analysis and NLP
   * POST /api/emotion/analyze-ml
   */
  public analyzeEmotionWithML = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.emotionMLService) {
        res.status(503).json(ResponseBuilder.error(
          'SERVICE_UNAVAILABLE',
          'ML emotion analysis service is not configured',
          { feature: 'ml-emotion-analysis' }
        ));
        return;
      }

      const request: EmotionAnalysisRequest = req.body;

      // Validate required fields
      if (!request.userId) {
        res.status(400).json(ResponseBuilder.error(
          'VALIDATION_ERROR',
          'User ID is required',
          { field: 'userId' }
        ));
        return;
      }

      // Validate that we have some input to analyze
      if (!request.textInput && !request.emotionalState) {
        res.status(400).json(ResponseBuilder.error(
          'VALIDATION_ERROR',
          'Either textInput or emotionalState is required',
          { fields: ['textInput', 'emotionalState'] }
        ));
        return;
      }

      const result = await this.emotionMLService.analyzeEmotionWithML(request);

      res.json(ResponseBuilder.success(result));
    } catch (error) {
      console.error('Error in analyzeEmotionWithML:', error);
      res.status(500).json(ResponseBuilder.error(
        'INTERNAL_ERROR',
        'Failed to analyze emotion with ML',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  };

  /**
   * Detect mood from text using natural language processing
   * POST /api/emotion/detect-mood
   */
  public detectMoodFromText = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.emotionMLService) {
        res.status(503).json(ResponseBuilder.error(
          'SERVICE_UNAVAILABLE',
          'ML emotion analysis service is not configured',
          { feature: 'nlp-mood-detection' }
        ));
        return;
      }

      const { textInput, context } = req.body;

      if (!textInput || typeof textInput !== 'string') {
        res.status(400).json(ResponseBuilder.error(
          'VALIDATION_ERROR',
          'Text input is required',
          { field: 'textInput' }
        ));
        return;
      }

      if (textInput.trim().length === 0) {
        res.status(400).json(ResponseBuilder.error(
          'VALIDATION_ERROR',
          'Text input cannot be empty',
          { field: 'textInput' }
        ));
        return;
      }

      const result = await this.emotionMLService.detectMoodFromText(textInput, context);

      res.json(ResponseBuilder.success(result));
    } catch (error) {
      console.error('Error in detectMoodFromText:', error);
      res.status(500).json(ResponseBuilder.error(
        'INTERNAL_ERROR',
        'Failed to detect mood from text',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  };

  /**
   * Generate emotion-aware recommendations using ML insights
   * POST /api/emotion/ml-recommendations
   */
  public generateMLRecommendations = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.emotionMLService) {
        res.status(503).json(ResponseBuilder.error(
          'SERVICE_UNAVAILABLE',
          'ML emotion analysis service is not configured',
          { feature: 'ml-recommendations' }
        ));
        return;
      }

      const { emotionAnalysis, userPreferences, context } = req.body;

      if (!emotionAnalysis || !emotionAnalysis.primaryEmotion) {
        res.status(400).json(ResponseBuilder.error(
          'VALIDATION_ERROR',
          'Emotion analysis with primary emotion is required',
          { field: 'emotionAnalysis.primaryEmotion' }
        ));
        return;
      }

      const result = await this.emotionMLService.generateEmotionAwareRecommendations(
        emotionAnalysis,
        userPreferences,
        context
      );

      res.json(ResponseBuilder.success(result));
    } catch (error) {
      console.error('Error in generateMLRecommendations:', error);
      res.status(500).json(ResponseBuilder.error(
        'INTERNAL_ERROR',
        'Failed to generate ML recommendations',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  };

  /**
   * Health check endpoint
   * GET /api/emotion/health
   */
  public healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = {
        status: 'healthy',
        service: 'emotion-service',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        features: {
          emotionAnalysis: true,
          cuisineMapping: true,
          contextualProcessing: true,
          moodBasedRecommendations: true,
          comfortFoodIdentification: true,
          celebratoryDining: true,
          neutralStateHandling: true,
          mlEmotionAnalysis: !!this.emotionMLService,
          nlpMoodDetection: !!this.emotionMLService,
          mlRecommendations: !!this.emotionMLService
        }
      };

      res.json(ResponseBuilder.success(result));
    } catch (error) {
      console.error('Error in healthCheck:', error);
      res.status(500).json(ResponseBuilder.error(
        'INTERNAL_ERROR',
        'Health check failed',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  };
}