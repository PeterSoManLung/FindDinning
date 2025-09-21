import { Request, Response } from 'express';
import { PlatformDataExtractionService } from '../services/PlatformDataExtractionService';
import { ExtractorFactory } from '../extractors/ExtractorFactory';
import { DataSourceEnum } from '../types/dataSource.types';
import { createLogger } from '../utils/logger';

const logger = createLogger('PlatformExtractionController');
const extractionService = new PlatformDataExtractionService();

/**
 * Extract data from all Hong Kong platforms
 */
export const extractFromAllPlatforms = async (req: Request, res: Response) => {
  try {
    const { batchSize, maxConcurrency, retryFailedSources, skipHealthCheck } = req.body;
    
    const config = {
      batchSize: batchSize || 50,
      maxConcurrency: maxConcurrency || 3,
      retryFailedSources: retryFailedSources !== false,
      skipHealthCheck: skipHealthCheck === true
    };
    
    logger.info('Starting extraction from all platforms', config);
    
    const result = await extractionService.extractFromAllPlatforms(config);
    
    res.json({
      success: true,
      data: {
        jobId: result.jobId,
        totalRestaurants: result.totalRestaurants,
        processingTime: result.processingTime,
        sourceResults: Object.fromEntries(result.sourceResults),
        errors: result.errors
      }
    });
    
  } catch (error: any) {
    logger.error('Failed to extract from all platforms:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Extract data from specific platforms
 */
export const extractFromPlatforms = async (req: Request, res: Response) => {
  try {
    const { sources, batchSize, maxConcurrency, retryFailedSources, skipHealthCheck } = req.body;
    
    if (!sources || !Array.isArray(sources)) {
      return res.status(400).json({
        success: false,
        error: 'Sources array is required'
      });
    }
    
    // Validate sources
    const validSources = sources.filter(source => Object.values(DataSourceEnum).includes(source));
    if (validSources.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid sources provided'
      });
    }
    
    const config = {
      batchSize: batchSize || 50,
      maxConcurrency: maxConcurrency || 3,
      retryFailedSources: retryFailedSources !== false,
      skipHealthCheck: skipHealthCheck === true
    };
    
    logger.info(`Starting extraction from platforms: ${validSources.join(', ')}`, config);
    
    const result = await extractionService.extractFromPlatforms(validSources, config);
    
    res.json({
      success: true,
      data: {
        jobId: result.jobId,
        totalRestaurants: result.totalRestaurants,
        processingTime: result.processingTime,
        sourceResults: Object.fromEntries(result.sourceResults),
        errors: result.errors
      }
    });
    
  } catch (error: any) {
    logger.error('Failed to extract from platforms:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Extract data from a single platform
 */
export const extractFromPlatform = async (req: Request, res: Response) => {
  try {
    const { source } = req.params;
    const { limit, offset, district, city, location } = req.query;
    
    if (!Object.values(DataSourceEnum).includes(source as DataSourceEnum)) {
      return res.status(400).json({
        success: false,
        error: `Invalid source: ${source}`
      });
    }
    
    const params = {
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
      district: district as string,
      city: city as string,
      location: location as string
    };
    
    logger.info(`Starting extraction from ${source}`, params);
    
    const result = await extractionService.extractFromPlatform(source as DataSourceEnum, params);
    
    res.json({
      success: result.success,
      data: {
        restaurants: result.data || [],
        totalExtracted: result.metadata.totalExtracted,
        processingTime: result.metadata.processingTime,
        sourceReliability: result.metadata.sourceReliability
      },
      errors: result.errors
    });
    
  } catch (error: any) {
    logger.error(`Failed to extract from platform ${req.params.source}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Extract specific restaurant from all platforms
 */
export const extractRestaurantFromAllPlatforms = async (req: Request, res: Response) => {
  try {
    const { restaurantName, location } = req.body;
    
    if (!restaurantName) {
      return res.status(400).json({
        success: false,
        error: 'Restaurant name is required'
      });
    }
    
    logger.info(`Extracting restaurant "${restaurantName}" from all platforms`);
    
    const results = await extractionService.extractRestaurantFromAllPlatforms(restaurantName, location);
    
    const responseData: any = {};
    let totalFound = 0;
    
    for (const [source, restaurant] of results.entries()) {
      responseData[source] = restaurant;
      if (restaurant) totalFound++;
    }
    
    res.json({
      success: true,
      data: {
        restaurantName,
        location,
        totalPlatformsFound: totalFound,
        totalPlatformsSearched: results.size,
        results: responseData
      }
    });
    
  } catch (error: any) {
    logger.error('Failed to extract restaurant from all platforms:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get platform health status
 */
export const getPlatformHealthStatus = async (_req: Request, res: Response) => {
  try {
    logger.info('Checking platform health status');
    
    const healthStatus = await extractionService.getPlatformHealthStatus();
    const reliabilityScores = extractionService.getPlatformReliabilityScores();
    
    const platformStatus: any = {};
    let healthyCount = 0;
    
    for (const [source, isHealthy] of healthStatus.entries()) {
      platformStatus[source] = {
        healthy: isHealthy,
        reliability: reliabilityScores.get(source) || 0
      };
      if (isHealthy) healthyCount++;
    }
    
    res.json({
      success: true,
      data: {
        totalPlatforms: healthStatus.size,
        healthyPlatforms: healthyCount,
        unhealthyPlatforms: healthStatus.size - healthyCount,
        platforms: platformStatus
      }
    });
    
  } catch (error: any) {
    logger.error('Failed to get platform health status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get platform configuration summary
 */
export const getPlatformSummary = async (_req: Request, res: Response) => {
  try {
    logger.info('Getting platform configuration summary');
    
    const summary = ExtractorFactory.getExtractorSummary();
    const recommendedOrder = ExtractorFactory.getRecommendedExtractionOrder();
    
    res.json({
      success: true,
      data: {
        platforms: summary,
        recommendedExtractionOrder: recommendedOrder,
        totalPlatforms: summary.length,
        activePlatforms: summary.filter(p => p.isActive).length
      }
    });
    
  } catch (error: any) {
    logger.error('Failed to get platform summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get extraction job status
 */
export const getJobStatus = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    const isActive = extractionService.getJobStatus(jobId);
    
    res.json({
      success: true,
      data: {
        jobId,
        isActive,
        status: isActive ? 'running' : 'completed'
      }
    });
    
  } catch (error: any) {
    logger.error(`Failed to get job status for ${req.params.jobId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Cancel extraction job
 */
export const cancelJob = async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    const cancelled = extractionService.cancelJob(jobId);
    
    res.json({
      success: true,
      data: {
        jobId,
        cancelled,
        message: cancelled ? 'Job cancelled successfully' : 'Job not found or already completed'
      }
    });
    
  } catch (error: any) {
    logger.error(`Failed to cancel job ${req.params.jobId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};