"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmotionController = void 0;
const emotionAnalysis_1 = require("../services/emotionAnalysis");
const emotionCuisineMapping_1 = require("../services/emotionCuisineMapping");
const contextualMoodProcessing_1 = require("../services/contextualMoodProcessing");
const moodBasedRecommendation_1 = require("../services/moodBasedRecommendation");
const response_utils_1 = require("../../../shared/src/utils/response.utils");
class EmotionController {
    constructor() {
        /**
         * Analyzes user emotional state and provides dining recommendations
         * POST /api/emotion/analyze
         */
        this.analyzeEmotion = async (req, res) => {
            try {
                const request = req.body;
                // Validate required fields
                if (!request.userId) {
                    res.status(400).json(response_utils_1.ResponseBuilder.error('VALIDATION_ERROR', 'User ID is required', { field: 'userId' }));
                    return;
                }
                // Validate that we have some input to analyze
                if (!request.textInput && !request.emotionalState) {
                    res.status(400).json(response_utils_1.ResponseBuilder.error('VALIDATION_ERROR', 'Either textInput or emotionalState is required', { fields: ['textInput', 'emotionalState'] }));
                    return;
                }
                const result = this.emotionAnalysisService.analyzeEmotion(request);
                res.json(response_utils_1.ResponseBuilder.success(result));
            }
            catch (error) {
                console.error('Error in analyzeEmotion:', error);
                res.status(500).json(response_utils_1.ResponseBuilder.error('INTERNAL_ERROR', 'Failed to analyze emotion', { error: error instanceof Error ? error.message : 'Unknown error' }));
            }
        };
        /**
         * Gets cuisine recommendations based on emotion
         * GET /api/emotion/mood-mapping
         */
        this.getMoodMapping = async (req, res) => {
            try {
                const { emotion, intensity, cuisineTypes, dietaryRestrictions } = req.query;
                if (!emotion || typeof emotion !== 'string') {
                    res.status(400).json(response_utils_1.ResponseBuilder.error('VALIDATION_ERROR', 'Emotion parameter is required', { field: 'emotion' }));
                    return;
                }
                const request = {
                    emotion: emotion,
                    intensity: intensity ? parseInt(intensity) : undefined,
                    userPreferences: (cuisineTypes || dietaryRestrictions) ? {
                        cuisineTypes: cuisineTypes ? cuisineTypes.split(',') : [],
                        dietaryRestrictions: dietaryRestrictions ? dietaryRestrictions.split(',') : []
                    } : undefined
                };
                // Validate intensity if provided
                if (request.intensity && (request.intensity < 1 || request.intensity > 5)) {
                    res.status(400).json(response_utils_1.ResponseBuilder.error('VALIDATION_ERROR', 'Intensity must be between 1 and 5', { field: 'intensity', value: request.intensity }));
                    return;
                }
                const cuisineRecommendations = this.cuisineMappingService.getCuisineRecommendations(request);
                const moodMapping = this.cuisineMappingService.getMoodMapping(emotion);
                const result = {
                    emotion: emotion,
                    cuisineRecommendations,
                    atmospherePreferences: moodMapping?.atmospherePreferences || [],
                    priceRangeAdjustment: moodMapping?.priceRangeAdjustment || 0
                };
                res.json(response_utils_1.ResponseBuilder.success(result));
            }
            catch (error) {
                console.error('Error in getMoodMapping:', error);
                res.status(500).json(response_utils_1.ResponseBuilder.error('INTERNAL_ERROR', 'Failed to get mood mapping', { error: error instanceof Error ? error.message : 'Unknown error' }));
            }
        };
        /**
         * Processes contextual emotional cues
         * POST /api/emotion/context
         */
        this.processEmotionContext = async (req, res) => {
            try {
                const request = req.body;
                // Validate required fields
                if (!request.textInput || typeof request.textInput !== 'string') {
                    res.status(400).json(response_utils_1.ResponseBuilder.error('VALIDATION_ERROR', 'Text input is required', { field: 'textInput' }));
                    return;
                }
                if (request.textInput.trim().length === 0) {
                    res.status(400).json(response_utils_1.ResponseBuilder.error('VALIDATION_ERROR', 'Text input cannot be empty', { field: 'textInput' }));
                    return;
                }
                const result = this.contextualMoodService.processEmotionContext(request);
                res.json(response_utils_1.ResponseBuilder.success(result));
            }
            catch (error) {
                console.error('Error in processEmotionContext:', error);
                res.status(500).json(response_utils_1.ResponseBuilder.error('INTERNAL_ERROR', 'Failed to process emotion context', { error: error instanceof Error ? error.message : 'Unknown error' }));
            }
        };
        /**
         * Gets all available mood mappings
         * GET /api/emotion/mappings
         */
        this.getAllMoodMappings = async (req, res) => {
            try {
                const mappings = this.cuisineMappingService.getAllMoodMappings();
                const result = Object.fromEntries(mappings);
                res.json(response_utils_1.ResponseBuilder.success(result));
            }
            catch (error) {
                console.error('Error in getAllMoodMappings:', error);
                res.status(500).json(response_utils_1.ResponseBuilder.error('INTERNAL_ERROR', 'Failed to get mood mappings', { error: error instanceof Error ? error.message : 'Unknown error' }));
            }
        };
        /**
         * Gets contextual recommendations for specific situations
         * GET /api/emotion/contextual-recommendations/:context
         */
        this.getContextualRecommendations = async (req, res) => {
            try {
                const { context } = req.params;
                if (!context) {
                    res.status(400).json(response_utils_1.ResponseBuilder.error('VALIDATION_ERROR', 'Context parameter is required', { field: 'context' }));
                    return;
                }
                const recommendations = this.contextualMoodService.getContextualRecommendations(context);
                if (recommendations.length === 0) {
                    res.status(404).json(response_utils_1.ResponseBuilder.error('NOT_FOUND', 'No recommendations found for the specified context', { context }));
                    return;
                }
                res.json(response_utils_1.ResponseBuilder.success({ context, recommendations }));
            }
            catch (error) {
                console.error('Error in getContextualRecommendations:', error);
                res.status(500).json(response_utils_1.ResponseBuilder.error('INTERNAL_ERROR', 'Failed to get contextual recommendations', { error: error instanceof Error ? error.message : 'Unknown error' }));
            }
        };
        /**
         * Generates mood-based recommendations
         * POST /api/emotion/mood-recommendations
         */
        this.generateMoodRecommendations = async (req, res) => {
            try {
                const request = req.body;
                // Validate required fields
                if (!request.primaryEmotion) {
                    res.status(400).json(response_utils_1.ResponseBuilder.error('VALIDATION_ERROR', 'Primary emotion is required', { field: 'primaryEmotion' }));
                    return;
                }
                if (!request.intensity || request.intensity < 1 || request.intensity > 5) {
                    res.status(400).json(response_utils_1.ResponseBuilder.error('VALIDATION_ERROR', 'Intensity must be between 1 and 5', { field: 'intensity', value: request.intensity }));
                    return;
                }
                const result = this.moodBasedRecommendationService.generateMoodBasedRecommendations(request);
                res.json(response_utils_1.ResponseBuilder.success(result));
            }
            catch (error) {
                console.error('Error in generateMoodRecommendations:', error);
                res.status(500).json(response_utils_1.ResponseBuilder.error('INTERNAL_ERROR', 'Failed to generate mood-based recommendations', { error: error instanceof Error ? error.message : 'Unknown error' }));
            }
        };
        /**
         * Identifies comfort food for negative emotions
         * POST /api/emotion/comfort-food
         */
        this.identifyComfortFood = async (req, res) => {
            try {
                const { emotion, intensity, context } = req.body;
                if (!emotion) {
                    res.status(400).json(response_utils_1.ResponseBuilder.error('VALIDATION_ERROR', 'Emotion is required', { field: 'emotion' }));
                    return;
                }
                if (!intensity || intensity < 1 || intensity > 5) {
                    res.status(400).json(response_utils_1.ResponseBuilder.error('VALIDATION_ERROR', 'Intensity must be between 1 and 5', { field: 'intensity', value: intensity }));
                    return;
                }
                const result = this.moodBasedRecommendationService.identifyComfortFood(emotion, intensity, context);
                res.json(response_utils_1.ResponseBuilder.success({
                    emotion,
                    intensity,
                    comfortFoodRecommendations: result
                }));
            }
            catch (error) {
                console.error('Error in identifyComfortFood:', error);
                res.status(500).json(response_utils_1.ResponseBuilder.error('INTERNAL_ERROR', 'Failed to identify comfort food', { error: error instanceof Error ? error.message : 'Unknown error' }));
            }
        };
        /**
         * Suggests celebratory dining options
         * POST /api/emotion/celebratory-dining
         */
        this.suggestCelebratoryDining = async (req, res) => {
            try {
                const { emotion, intensity, context } = req.body;
                if (!emotion) {
                    res.status(400).json(response_utils_1.ResponseBuilder.error('VALIDATION_ERROR', 'Emotion is required', { field: 'emotion' }));
                    return;
                }
                if (!intensity || intensity < 1 || intensity > 5) {
                    res.status(400).json(response_utils_1.ResponseBuilder.error('VALIDATION_ERROR', 'Intensity must be between 1 and 5', { field: 'intensity', value: intensity }));
                    return;
                }
                const result = this.moodBasedRecommendationService.suggestCelebratoryDining(emotion, intensity, context);
                res.json(response_utils_1.ResponseBuilder.success({
                    emotion,
                    intensity,
                    celebratoryRecommendations: result
                }));
            }
            catch (error) {
                console.error('Error in suggestCelebratoryDining:', error);
                res.status(500).json(response_utils_1.ResponseBuilder.error('INTERNAL_ERROR', 'Failed to suggest celebratory dining', { error: error instanceof Error ? error.message : 'Unknown error' }));
            }
        };
        /**
         * Handles neutral emotional state with preference-based fallbacks
         * POST /api/emotion/neutral-recommendations
         */
        this.handleNeutralState = async (req, res) => {
            try {
                const { userPreferences, context } = req.body;
                const result = this.moodBasedRecommendationService.handleNeutralState(userPreferences, context);
                res.json(response_utils_1.ResponseBuilder.success({
                    recommendationType: 'neutral',
                    recommendations: result,
                    reasoning: 'Versatile dining options suitable for any mood with preference-based customization'
                }));
            }
            catch (error) {
                console.error('Error in handleNeutralState:', error);
                res.status(500).json(response_utils_1.ResponseBuilder.error('INTERNAL_ERROR', 'Failed to handle neutral state', { error: error instanceof Error ? error.message : 'Unknown error' }));
            }
        };
        /**
         * Health check endpoint
         * GET /api/emotion/health
         */
        this.healthCheck = async (req, res) => {
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
                        neutralStateHandling: true
                    }
                };
                res.json(response_utils_1.ResponseBuilder.success(result));
            }
            catch (error) {
                console.error('Error in healthCheck:', error);
                res.status(500).json(response_utils_1.ResponseBuilder.error('INTERNAL_ERROR', 'Health check failed', { error: error instanceof Error ? error.message : 'Unknown error' }));
            }
        };
        this.emotionAnalysisService = new emotionAnalysis_1.EmotionAnalysisService();
        this.cuisineMappingService = new emotionCuisineMapping_1.EmotionCuisineMappingService();
        this.contextualMoodService = new contextualMoodProcessing_1.ContextualMoodProcessingService();
        this.moodBasedRecommendationService = new moodBasedRecommendation_1.MoodBasedRecommendationService();
    }
}
exports.EmotionController = EmotionController;
//# sourceMappingURL=emotionController.js.map