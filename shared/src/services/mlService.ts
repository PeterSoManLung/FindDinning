import AWS from 'aws-sdk';
import { logger } from '../utils/logger';

// Configure AWS SDK
const sagemaker = new AWS.SageMakerRuntime({
  region: process.env.AWS_REGION || 'us-east-1'
});

const lambda = new AWS.Lambda({
  region: process.env.AWS_REGION || 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

export interface MLPredictionRequest {
  modelName: string;
  inputData: any;
  userId?: string;
  context?: Record<string, any>;
}

export interface MLPredictionResponse {
  predictions: any;
  confidence: number;
  modelVersion: string;
  processingTime: number;
}

export interface EmotionAnalysisRequest {
  text: string;
  analysisType: 'emotion' | 'sentiment' | 'negative_feedback';
}

export interface EmotionAnalysisResponse {
  emotion?: string;
  sentiment?: string;
  confidence: number;
  reasoning: string;
  authenticityScore?: number;
  negativeIndicators?: string[];
  positiveIndicators?: string[];
}

export interface ABTestAssignment {
  testId: string;
  variant: 'control' | 'treatment';
  modelVersion: string;
}

export class MLService {
  private static instance: MLService;
  private endpointCache: Map<string, string> = new Map();

  public static getInstance(): MLService {
    if (!MLService.instance) {
      MLService.instance = new MLService();
    }
    return MLService.instance;
  }

  /**
   * Get model prediction from SageMaker endpoint
   */
  async getPrediction(request: MLPredictionRequest): Promise<MLPredictionResponse> {
    const startTime = Date.now();
    
    try {
      // Get A/B test assignment if user ID is provided
      let endpointName = await this.getEndpointName(request.modelName);
      let modelVersion = 'production';
      
      if (request.userId) {
        const abTestAssignment = await this.getABTestAssignment(request.userId, request.modelName);
        if (abTestAssignment) {
          endpointName = await this.getEndpointName(request.modelName, abTestAssignment.variant);
          modelVersion = abTestAssignment.modelVersion;
        }
      }

      // Prepare input data
      const inputPayload = JSON.stringify({
        instances: [request.inputData],
        configuration: request.context || {}
      });

      // Call SageMaker endpoint
      const params = {
        EndpointName: endpointName,
        ContentType: 'application/json',
        Body: inputPayload
      };

      const result = await sagemaker.invokeEndpoint(params).promise();
      const predictions = JSON.parse(result.Body.toString());

      const processingTime = Date.now() - startTime;

      // Record A/B test result if applicable
      if (request.userId && predictions.confidence) {
        await this.recordABTestResult(request.userId, request.modelName, {
          metric_name: 'prediction_confidence',
          metric_value: predictions.confidence,
          context: request.context
        });
      }

      return {
        predictions: predictions.predictions || predictions,
        confidence: predictions.confidence || 0.5,
        modelVersion,
        processingTime
      };

    } catch (error) {
      logger.error('Error getting ML prediction:', error);
      throw new Error(`ML prediction failed: ${error.message}`);
    }
  }

  /**
   * Analyze emotion/sentiment using Bedrock
   */
  async analyzeEmotion(request: EmotionAnalysisRequest): Promise<EmotionAnalysisResponse> {
    try {
      const params = {
        FunctionName: process.env.BEDROCK_NLP_FUNCTION_NAME || 'ai-restaurant-recommendation-bedrock-nlp-processor',
        Payload: JSON.stringify({
          text: request.text,
          analysis_type: request.analysisType
        })
      };

      const result = await lambda.invoke(params).promise();
      const response = JSON.parse(result.Payload as string);

      if (!response.success) {
        throw new Error(response.error?.message || 'Emotion analysis failed');
      }

      return response.data;

    } catch (error) {
      logger.error('Error analyzing emotion:', error);
      throw new Error(`Emotion analysis failed: ${error.message}`);
    }
  }

  /**
   * Get A/B test assignment for user
   */
  async getABTestAssignment(userId: string, modelName: string): Promise<ABTestAssignment | null> {
    try {
      const params = {
        FunctionName: process.env.AB_TEST_MANAGER_FUNCTION_NAME || 'ai-restaurant-recommendation-ab-test-manager',
        Payload: JSON.stringify({
          action: 'assign_user',
          user_id: userId,
          model_name: modelName
        })
      };

      const result = await lambda.invoke(params).promise();
      const response = JSON.parse(result.Payload as string);

      if (!response.success || !response.data.test_id) {
        return null; // No active test
      }

      return {
        testId: response.data.test_id,
        variant: response.data.variant,
        modelVersion: response.data.model_version
      };

    } catch (error) {
      logger.error('Error getting A/B test assignment:', error);
      return null; // Fallback to production model
    }
  }

  /**
   * Record A/B test result
   */
  async recordABTestResult(userId: string, modelName: string, result: {
    metric_name: string;
    metric_value: number;
    context?: Record<string, any>;
  }): Promise<void> {
    try {
      // Get current test assignment
      const assignment = await this.getABTestAssignment(userId, modelName);
      if (!assignment) {
        return; // No active test
      }

      const params = {
        FunctionName: process.env.AB_TEST_MANAGER_FUNCTION_NAME || 'ai-restaurant-recommendation-ab-test-manager',
        Payload: JSON.stringify({
          action: 'record_result',
          test_id: assignment.testId,
          user_id: userId,
          metric_name: result.metric_name,
          metric_value: result.metric_value,
          context: result.context
        })
      };

      await lambda.invoke(params).promise();

    } catch (error) {
      logger.error('Error recording A/B test result:', error);
      // Don't throw error - this is non-critical
    }
  }

  /**
   * Get recommendation predictions with emotion context
   */
  async getRecommendations(userId: string, preferences: any, emotionalState?: string): Promise<any[]> {
    try {
      const inputData = {
        user_id: userId,
        preferences,
        emotional_state: emotionalState,
        timestamp: new Date().toISOString()
      };

      const prediction = await this.getPrediction({
        modelName: 'recommendation',
        inputData,
        userId,
        context: { emotional_state: emotionalState }
      });

      return prediction.predictions;

    } catch (error) {
      logger.error('Error getting recommendations:', error);
      throw new Error(`Recommendation generation failed: ${error.message}`);
    }
  }

  /**
   * Analyze review sentiment and authenticity
   */
  async analyzeReview(reviewText: string): Promise<{
    sentiment: string;
    authenticity_score: number;
    negative_indicators: string[];
    positive_indicators: string[];
  }> {
    try {
      const analysis = await this.analyzeEmotion({
        text: reviewText,
        analysisType: 'sentiment'
      });

      return {
        sentiment: analysis.sentiment || 'neutral',
        authenticity_score: analysis.authenticityScore || 0.5,
        negative_indicators: analysis.negativeIndicators || [],
        positive_indicators: analysis.positiveIndicators || []
      };

    } catch (error) {
      logger.error('Error analyzing review:', error);
      throw new Error(`Review analysis failed: ${error.message}`);
    }
  }

  /**
   * Analyze negative feedback for authenticity
   */
  async analyzeNegativeFeedback(feedbackText: string): Promise<{
    is_authentic: boolean;
    authenticity_confidence: number;
    complaint_categories: string[];
    severity_score: number;
    specific_issues: string[];
  }> {
    try {
      const analysis = await this.analyzeEmotion({
        text: feedbackText,
        analysisType: 'negative_feedback'
      });

      return {
        is_authentic: analysis.is_authentic || true,
        authenticity_confidence: analysis.authenticity_confidence || 0.5,
        complaint_categories: analysis.complaint_categories || [],
        severity_score: analysis.severity_score || 3,
        specific_issues: analysis.specific_issues || []
      };

    } catch (error) {
      logger.error('Error analyzing negative feedback:', error);
      throw new Error(`Negative feedback analysis failed: ${error.message}`);
    }
  }

  /**
   * Get model performance metrics
   */
  async getModelPerformance(modelName: string, days: number = 7): Promise<any> {
    try {
      const params = {
        FunctionName: process.env.MODEL_PERFORMANCE_MONITOR_FUNCTION_NAME || 'ai-restaurant-recommendation-model-performance-monitor',
        Payload: JSON.stringify({
          action: 'generate_report',
          days_back: days
        })
      };

      const result = await lambda.invoke(params).promise();
      const response = JSON.parse(result.Payload as string);

      if (!response.success) {
        throw new Error(response.error?.message || 'Performance monitoring failed');
      }

      return response.data;

    } catch (error) {
      logger.error('Error getting model performance:', error);
      throw new Error(`Model performance monitoring failed: ${error.message}`);
    }
  }

  /**
   * Trigger model retraining
   */
  async triggerRetraining(modelName: string, reason: string): Promise<void> {
    try {
      const params = {
        FunctionName: process.env.MODEL_RETRAINING_TRIGGER_FUNCTION_NAME || 'ai-restaurant-recommendation-model-retraining-trigger',
        Payload: JSON.stringify({
          action: 'trigger_retraining',
          model_name: modelName,
          reason
        })
      };

      const result = await lambda.invoke(params).promise();
      const response = JSON.parse(result.Payload as string);

      if (!response.success) {
        throw new Error(response.error?.message || 'Retraining trigger failed');
      }

      logger.info(`Triggered retraining for model ${modelName}: ${reason}`);

    } catch (error) {
      logger.error('Error triggering model retraining:', error);
      throw new Error(`Model retraining trigger failed: ${error.message}`);
    }
  }

  /**
   * Get endpoint name for model (with optional variant for A/B testing)
   */
  private async getEndpointName(modelName: string, variant?: string): Promise<string> {
    const cacheKey = `${modelName}-${variant || 'production'}`;
    
    if (this.endpointCache.has(cacheKey)) {
      return this.endpointCache.get(cacheKey)!;
    }

    // Default endpoint names
    const endpointNames = {
      recommendation: process.env.RECOMMENDATION_ENDPOINT_NAME || 'ai-restaurant-recommendation-recommendation-endpoint',
      sentiment: process.env.SENTIMENT_ENDPOINT_NAME || 'ai-restaurant-recommendation-sentiment-endpoint'
    };

    let endpointName = endpointNames[modelName as keyof typeof endpointNames];
    
    if (!endpointName) {
      throw new Error(`Unknown model: ${modelName}`);
    }

    // For A/B testing, append variant to endpoint name
    if (variant && variant !== 'control') {
      endpointName = `${endpointName}-${variant}`;
    }

    this.endpointCache.set(cacheKey, endpointName);
    return endpointName;
  }

  /**
   * Clear endpoint cache (useful for testing or configuration changes)
   */
  clearEndpointCache(): void {
    this.endpointCache.clear();
  }

  /**
   * Health check for ML services
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, boolean>;
    timestamp: string;
  }> {
    const services: Record<string, boolean> = {};
    let healthyCount = 0;
    const totalServices = 3; // SageMaker, Bedrock, Lambda

    try {
      // Test SageMaker endpoint
      try {
        await this.getPrediction({
          modelName: 'recommendation',
          inputData: { test: true }
        });
        services.sagemaker = true;
        healthyCount++;
      } catch {
        services.sagemaker = false;
      }

      // Test Bedrock NLP
      try {
        await this.analyzeEmotion({
          text: 'test',
          analysisType: 'sentiment'
        });
        services.bedrock = true;
        healthyCount++;
      } catch {
        services.bedrock = false;
      }

      // Test Lambda functions
      try {
        await this.getModelPerformance('recommendation', 1);
        services.lambda = true;
        healthyCount++;
      } catch {
        services.lambda = false;
      }

      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (healthyCount === totalServices) {
        status = 'healthy';
      } else if (healthyCount > 0) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      return {
        status,
        services,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error in ML service health check:', error);
      return {
        status: 'unhealthy',
        services,
        timestamp: new Date().toISOString()
      };
    }
  }
}

export const mlService = MLService.getInstance();