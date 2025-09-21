import { ExtractorFactory } from '../extractors/ExtractorFactory';
import { DataSourceEnum, DataExtractionResult, RawRestaurantData } from '../types/dataSource.types';
import { createLogger } from '../utils/logger';
import { Logger } from 'winston';

export interface ExtractionJobConfig {
  sources: DataSourceEnum[];
  batchSize: number;
  maxConcurrency: number;
  retryFailedSources: boolean;
  skipHealthCheck: boolean;
}

export interface ExtractionJobResult {
  jobId: string;
  success: boolean;
  totalRestaurants: number;
  sourceResults: Map<DataSourceEnum, DataExtractionResult>;
  errors: string[];
  processingTime: number;
  startTime: Date;
  endTime: Date;
}

export class PlatformDataExtractionService {
  private logger: Logger;
  private activeJobs: Map<string, boolean> = new Map();

  constructor() {
    this.logger = createLogger('PlatformDataExtractionService');
  }

  /**
   * Extract data from all Hong Kong platforms
   */
  async extractFromAllPlatforms(config?: Partial<ExtractionJobConfig>): Promise<ExtractionJobResult> {
    const jobConfig: ExtractionJobConfig = {
      sources: Object.values(DataSourceEnum),
      batchSize: 50,
      maxConcurrency: 3,
      retryFailedSources: true,
      skipHealthCheck: false,
      ...config
    };

    return this.executeExtractionJob(jobConfig);
  }

  /**
   * Extract data from specific platforms
   */
  async extractFromPlatforms(
    sources: DataSourceEnum[], 
    config?: Partial<ExtractionJobConfig>
  ): Promise<ExtractionJobResult> {
    const jobConfig: ExtractionJobConfig = {
      sources,
      batchSize: 50,
      maxConcurrency: 3,
      retryFailedSources: true,
      skipHealthCheck: false,
      ...config
    };

    return this.executeExtractionJob(jobConfig);
  }

  /**
   * Extract data from a single platform
   */
  async extractFromPlatform(
    source: DataSourceEnum,
    params?: any
  ): Promise<DataExtractionResult> {
    this.logger.info(`Starting extraction from ${source}`);
    
    try {
      const extractor = ExtractorFactory.getExtractor(source);
      
      // Health check
      const isHealthy = await extractor.healthCheck();
      if (!isHealthy) {
        this.logger.warn(`Health check failed for ${source}, proceeding anyway`);
      }

      const result = await extractor.extractRestaurantData(params);
      
      this.logger.info(`Extraction from ${source} completed: ${result.data?.length || 0} restaurants`);
      return result;
      
    } catch (error: any) {
      this.logger.error(`Extraction from ${source} failed:`, error);
      return {
        success: false,
        errors: [error.message],
        metadata: {
          totalExtracted: 0,
          processingTime: 0,
          sourceReliability: 0
        }
      };
    }
  }

  /**
   * Extract specific restaurant from all platforms
   */
  async extractRestaurantFromAllPlatforms(
    restaurantName: string,
    location?: string
  ): Promise<Map<DataSourceEnum, RawRestaurantData | null>> {
    this.logger.info(`Extracting restaurant "${restaurantName}" from all platforms`);
    
    const results = new Map<DataSourceEnum, RawRestaurantData | null>();
    const extractors = ExtractorFactory.getAllExtractors();
    
    const extractionPromises = Array.from(extractors.entries()).map(async ([source, extractor]) => {
      try {
        // For restaurant-specific extraction, we'd need to search first
        // This is a simplified implementation
        const searchResult = await extractor.extractRestaurantData({
          name: restaurantName,
          location,
          limit: 10
        });
        
        if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
          // Find the best match
          const bestMatch = this.findBestRestaurantMatch(searchResult.data, restaurantName);
          results.set(source, bestMatch);
        } else {
          results.set(source, null);
        }
      } catch (error: any) {
        this.logger.warn(`Failed to extract restaurant from ${source}:`, error.message);
        results.set(source, null);
      }
    });
    
    await Promise.all(extractionPromises);
    return results;
  }

  /**
   * Get extraction job status
   */
  getJobStatus(jobId: string): boolean {
    return this.activeJobs.get(jobId) || false;
  }

  /**
   * Cancel extraction job
   */
  cancelJob(jobId: string): boolean {
    if (this.activeJobs.has(jobId)) {
      this.activeJobs.set(jobId, false);
      this.logger.info(`Extraction job ${jobId} cancelled`);
      return true;
    }
    return false;
  }

  /**
   * Get platform health status
   */
  async getPlatformHealthStatus(): Promise<Map<DataSourceEnum, boolean>> {
    this.logger.info('Checking health status of all platforms');
    return ExtractorFactory.checkAllExtractorsHealth();
  }

  /**
   * Get platform reliability scores
   */
  getPlatformReliabilityScores(): Map<DataSourceEnum, number> {
    return ExtractorFactory.getExtractorReliabilityScores();
  }

  /**
   * Execute extraction job with configuration
   */
  private async executeExtractionJob(config: ExtractionJobConfig): Promise<ExtractionJobResult> {
    const jobId = this.generateJobId();
    const startTime = new Date();
    
    this.activeJobs.set(jobId, true);
    this.logger.info(`Starting extraction job ${jobId} with ${config.sources.length} sources`);
    
    const sourceResults = new Map<DataSourceEnum, DataExtractionResult>();
    const errors: string[] = [];
    let totalRestaurants = 0;
    
    try {
      // Health check phase
      if (!config.skipHealthCheck) {
        const healthStatus = await ExtractorFactory.checkExtractorsHealth(config.sources);
        const unhealthySources = Array.from(healthStatus.entries())
          .filter(([, isHealthy]) => !isHealthy)
          .map(([source]) => source);
        
        if (unhealthySources.length > 0) {
          this.logger.warn(`Unhealthy sources detected: ${unhealthySources.join(', ')}`);
          errors.push(`Unhealthy sources: ${unhealthySources.join(', ')}`);
        }
      }
      
      // Extraction phase with concurrency control
      const extractionPromises: Promise<void>[] = [];
      const semaphore = new Array(config.maxConcurrency).fill(null);
      
      for (const source of config.sources) {
        if (!this.activeJobs.get(jobId)) {
          this.logger.info(`Job ${jobId} was cancelled`);
          break;
        }
        
        const extractionPromise = this.extractWithSemaphore(
          semaphore,
          source,
          config.batchSize,
          sourceResults,
          errors
        );
        
        extractionPromises.push(extractionPromise);
      }
      
      await Promise.all(extractionPromises);
      
      // Calculate total restaurants
      for (const result of sourceResults.values()) {
        if (result.success && result.data) {
          totalRestaurants += result.data.length;
        }
      }
      
      // Retry failed sources if configured
      if (config.retryFailedSources) {
        await this.retryFailedSources(sourceResults, config.batchSize, errors);
      }
      
    } catch (error: any) {
      this.logger.error(`Extraction job ${jobId} failed:`, error);
      errors.push(`Job execution failed: ${error.message}`);
    } finally {
      this.activeJobs.delete(jobId);
    }
    
    const endTime = new Date();
    const processingTime = endTime.getTime() - startTime.getTime();
    
    const result: ExtractionJobResult = {
      jobId,
      success: errors.length === 0,
      totalRestaurants,
      sourceResults,
      errors,
      processingTime,
      startTime,
      endTime
    };
    
    this.logger.info(`Extraction job ${jobId} completed: ${totalRestaurants} restaurants extracted in ${processingTime}ms`);
    return result;
  }

  /**
   * Extract data with semaphore for concurrency control
   */
  private async extractWithSemaphore(
    semaphore: any[],
    source: DataSourceEnum,
    batchSize: number,
    results: Map<DataSourceEnum, DataExtractionResult>,
    errors: string[]
  ): Promise<void> {
    // Wait for available slot
    await new Promise<void>((resolve) => {
      const checkSlot = () => {
        const availableIndex = semaphore.findIndex(slot => slot === null);
        if (availableIndex !== -1) {
          semaphore[availableIndex] = source;
          resolve();
        } else {
          setTimeout(checkSlot, 100);
        }
      };
      checkSlot();
    });
    
    try {
      const extractor = ExtractorFactory.getExtractor(source);
      const result = await extractor.extractRestaurantData({ limit: batchSize });
      results.set(source, result);
      
      if (!result.success) {
        errors.push(`${source}: ${result.errors.join(', ')}`);
      }
    } catch (error: any) {
      const failedResult: DataExtractionResult = {
        success: false,
        errors: [error.message],
        metadata: {
          totalExtracted: 0,
          processingTime: 0,
          sourceReliability: 0
        }
      };
      results.set(source, failedResult);
      errors.push(`${source}: ${error.message}`);
    } finally {
      // Release semaphore slot
      const slotIndex = semaphore.findIndex(slot => slot === source);
      if (slotIndex !== -1) {
        semaphore[slotIndex] = null;
      }
    }
  }

  /**
   * Retry failed sources
   */
  private async retryFailedSources(
    results: Map<DataSourceEnum, DataExtractionResult>,
    batchSize: number,
    errors: string[]
  ): Promise<void> {
    const failedSources = Array.from(results.entries())
      .filter(([, result]) => !result.success)
      .map(([source]) => source);
    
    if (failedSources.length === 0) return;
    
    this.logger.info(`Retrying ${failedSources.length} failed sources`);
    
    for (const source of failedSources) {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before retry
        
        const extractor = ExtractorFactory.getExtractor(source);
        const retryResult = await extractor.extractRestaurantData({ limit: batchSize });
        
        if (retryResult.success) {
          results.set(source, retryResult);
          this.logger.info(`Retry successful for ${source}`);
          
          // Remove error from errors array
          const errorIndex = errors.findIndex(error => error.startsWith(`${source}:`));
          if (errorIndex !== -1) {
            errors.splice(errorIndex, 1);
          }
        }
      } catch (error: any) {
        this.logger.warn(`Retry failed for ${source}:`, error.message);
      }
    }
  }

  /**
   * Find best restaurant match by name similarity
   */
  private findBestRestaurantMatch(restaurants: RawRestaurantData[], targetName: string): RawRestaurantData | null {
    if (restaurants.length === 0) return null;
    
    let bestMatch = restaurants[0];
    let bestScore = this.calculateNameSimilarity(bestMatch.name, targetName);
    
    for (const restaurant of restaurants.slice(1)) {
      const score = this.calculateNameSimilarity(restaurant.name, targetName);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = restaurant;
      }
    }
    
    return bestScore > 0.6 ? bestMatch : null; // Minimum similarity threshold
  }

  /**
   * Calculate name similarity score
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const normalize = (str: string) => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
    
    const n1 = normalize(name1);
    const n2 = normalize(name2);
    
    if (n1 === n2) return 1.0;
    if (n1.includes(n2) || n2.includes(n1)) return 0.8;
    
    // Simple word overlap calculation
    const words1 = n1.split(/\s+/);
    const words2 = n2.split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word));
    
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `extraction_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}