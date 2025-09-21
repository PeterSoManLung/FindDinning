import { 
  DataSource, 
  DataSourceEnum,
  RawRestaurantData, 
  NormalizedRestaurantData, 
  DataExtractionResult,
  DataValidationResult 
} from '../types/dataSource.types';
import { BaseDataExtractor } from '../extractors/BaseDataExtractor';
import { DataNormalizationService } from './DataNormalizationService';
import { DeduplicationService } from './DeduplicationService';
import { DataValidationService } from './DataValidationService';
import { Logger } from 'winston';
import { createLogger } from '../utils/logger';

export interface IntegrationResult {
  success: boolean;
  totalExtracted: number;
  totalNormalized: number;
  totalDeduplicated: number;
  validationResults: DataValidationResult[];
  errors: string[];
  processingTime: number;
  restaurants: NormalizedRestaurantData[];
}

export class DataIntegrationFramework {
  private logger: Logger;
  private extractors: Map<string, BaseDataExtractor>;
  private normalizationService: DataNormalizationService;
  private deduplicationService: DeduplicationService;
  private validationService: DataValidationService;

  constructor() {
    this.logger = createLogger('DataIntegrationFramework');
    this.extractors = new Map();
    this.normalizationService = new DataNormalizationService();
    this.deduplicationService = new DeduplicationService();
    this.validationService = new DataValidationService();
  }

  /**
   * Register a data extractor for a specific source
   */
  registerExtractor(sourceId: string, extractor: BaseDataExtractor): void {
    this.extractors.set(sourceId, extractor);
    this.logger.info(`Registered extractor for source: ${sourceId}`);
  }

  /**
   * Get all registered extractors
   */
  getRegisteredExtractors(): string[] {
    return Array.from(this.extractors.keys());
  }

  /**
   * Run full data integration pipeline for all sources
   */
  async runFullIntegration(params?: any): Promise<IntegrationResult> {
    const startTime = Date.now();
    this.logger.info('Starting full data integration pipeline');

    try {
      // Step 1: Extract data from all sources
      const extractionResults = await this.extractFromAllSources(params);
      const allRawData = extractionResults.flatMap(result => result.data || []);
      
      this.logger.info(`Extracted ${allRawData.length} restaurants from ${extractionResults.length} sources`);

      // Step 2: Validate raw data
      const rawValidationResults = await this.validationService.validateRawData(allRawData);
      const validRawData = allRawData.filter((_, index) => rawValidationResults[index].isValid);
      
      this.logger.info(`${validRawData.length} out of ${allRawData.length} raw records passed validation`);

      // Step 3: Normalize data
      const normalizedData = await this.normalizeAllData(validRawData);
      
      this.logger.info(`Normalized ${normalizedData.length} restaurants`);

      // Step 4: Validate normalized data
      const normalizedValidationResults = await this.validationService.validateNormalizedData(normalizedData);
      const validNormalizedData = normalizedData.filter((_, index) => normalizedValidationResults[index].isValid);
      
      this.logger.info(`${validNormalizedData.length} out of ${normalizedData.length} normalized records passed validation`);

      // Step 5: Deduplicate
      const deduplicatedData = await this.deduplicationService.deduplicateRestaurants(validNormalizedData);
      
      this.logger.info(`Deduplicated to ${deduplicatedData.length} unique restaurants`);

      const processingTime = Date.now() - startTime;
      const errors = extractionResults.flatMap(result => result.errors);

      const result: IntegrationResult = {
        success: true,
        totalExtracted: allRawData.length,
        totalNormalized: normalizedData.length,
        totalDeduplicated: deduplicatedData.length,
        validationResults: [...rawValidationResults, ...normalizedValidationResults],
        errors,
        processingTime,
        restaurants: deduplicatedData
      };

      this.logger.info(`Data integration completed successfully in ${processingTime}ms`);
      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Data integration pipeline failed:', error);

      return {
        success: false,
        totalExtracted: 0,
        totalNormalized: 0,
        totalDeduplicated: 0,
        validationResults: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        processingTime,
        restaurants: []
      };
    }
  }

  /**
   * Run integration for specific sources
   */
  async runIntegrationForSources(sourceIds: string[], params?: any): Promise<IntegrationResult> {
    const startTime = Date.now();
    this.logger.info(`Starting data integration for sources: ${sourceIds.join(', ')}`);

    try {
      const extractionResults = await this.extractFromSources(sourceIds, params);
      const allRawData = extractionResults.flatMap(result => result.data || []);

      // Continue with the same pipeline as full integration
      const rawValidationResults = await this.validationService.validateRawData(allRawData);
      const validRawData = allRawData.filter((_, index) => rawValidationResults[index].isValid);

      const normalizedData = await this.normalizeAllData(validRawData);
      const normalizedValidationResults = await this.validationService.validateNormalizedData(normalizedData);
      const validNormalizedData = normalizedData.filter((_, index) => normalizedValidationResults[index].isValid);

      const deduplicatedData = await this.deduplicationService.deduplicateRestaurants(validNormalizedData);

      const processingTime = Date.now() - startTime;
      const errors = extractionResults.flatMap(result => result.errors);

      return {
        success: true,
        totalExtracted: allRawData.length,
        totalNormalized: normalizedData.length,
        totalDeduplicated: deduplicatedData.length,
        validationResults: [...rawValidationResults, ...normalizedValidationResults],
        errors,
        processingTime,
        restaurants: deduplicatedData
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`Integration failed for sources ${sourceIds.join(', ')}:`, error);

      return {
        success: false,
        totalExtracted: 0,
        totalNormalized: 0,
        totalDeduplicated: 0,
        validationResults: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        processingTime,
        restaurants: []
      };
    }
  }

  /**
   * Extract data from all registered sources
   */
  private async extractFromAllSources(params?: any): Promise<DataExtractionResult[]> {
    const sourceIds = Array.from(this.extractors.keys());
    return this.extractFromSources(sourceIds, params);
  }

  /**
   * Extract incremental data from a specific source since a given date
   */
  async extractIncrementalData(source: DataSourceEnum, since: Date): Promise<any[]> {
    const sourceId = source.toString();
    const extractor = this.extractors.get(sourceId);
    if (!extractor) {
      throw new Error(`No extractor found for source: ${sourceId}`);
    }

    try {
      // Check if extractor supports incremental extraction
      if (typeof extractor.extractIncremental === 'function') {
        const result = await extractor.extractIncremental(since);
        const rawData = result.data || [];
        
        // Apply validation and normalization
        const validationResults = await this.validationService.validateRawData(rawData);
        const validRawData = rawData.filter((_, index) => validationResults[index].isValid);
        
        const normalizedData = await this.normalizationService.normalizeRestaurantData(validRawData, sourceId);
        const deduplicatedData = await this.deduplicationService.deduplicateRestaurants(normalizedData);
        
        return deduplicatedData;
      } else {
        // Fallback to full extraction if incremental not supported
        this.logger.warn(`Incremental extraction not supported for ${sourceId}, falling back to full extraction`);
        const result = await extractor.extractRestaurantData();
        return result.data || [];
      }
    } catch (error) {
      this.logger.error(`Error extracting incremental data from ${sourceId}:`, error);
      throw error;
    }
  }

  /**
   * Extract data from specific sources
   */
  private async extractFromSources(sourceIds: string[], params?: any): Promise<DataExtractionResult[]> {
    const results: DataExtractionResult[] = [];

    // Run extractions in parallel with concurrency limit
    const concurrencyLimit = 3;
    const chunks = this.chunkArray(sourceIds, concurrencyLimit);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (sourceId) => {
        const extractor = this.extractors.get(sourceId);
        if (!extractor) {
          this.logger.warn(`No extractor found for source: ${sourceId}`);
          return {
            success: false,
            data: [],
            errors: [`No extractor registered for source: ${sourceId}`],
            metadata: {
              totalExtracted: 0,
              processingTime: 0,
              sourceReliability: 0
            }
          };
        }

        try {
          this.logger.info(`Starting extraction from source: ${sourceId}`);
          const result = await extractor.extractRestaurantData(params);
          this.logger.info(`Completed extraction from ${sourceId}: ${result.data?.length || 0} restaurants`);
          return result;
        } catch (error) {
          this.logger.error(`Extraction failed for source ${sourceId}:`, error);
          return {
            success: false,
            data: [],
            errors: [error instanceof Error ? error.message : 'Unknown extraction error'],
            metadata: {
              totalExtracted: 0,
              processingTime: 0,
              sourceReliability: 0
            }
          };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);

      // Add delay between chunks to avoid overwhelming sources
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await this.delay(2000);
      }
    }

    return results;
  }

  /**
   * Normalize data from all sources
   */
  private async normalizeAllData(rawData: RawRestaurantData[]): Promise<NormalizedRestaurantData[]> {
    // Group data by source for better normalization
    const dataBySource = this.groupDataBySource(rawData);
    const normalizedResults: NormalizedRestaurantData[] = [];

    for (const [sourceId, sourceData] of dataBySource.entries()) {
      try {
        this.logger.info(`Normalizing ${sourceData.length} restaurants from source: ${sourceId}`);
        const normalized = await this.normalizationService.normalizeRestaurantData(sourceData, sourceId);
        normalizedResults.push(...normalized);
      } catch (error) {
        this.logger.error(`Normalization failed for source ${sourceId}:`, error);
      }
    }

    return normalizedResults;
  }

  /**
   * Group raw data by source
   */
  private groupDataBySource(rawData: RawRestaurantData[]): Map<string, RawRestaurantData[]> {
    const grouped = new Map<string, RawRestaurantData[]>();

    for (const restaurant of rawData) {
      const sourceId = restaurant.sourceId;
      if (!grouped.has(sourceId)) {
        grouped.set(sourceId, []);
      }
      grouped.get(sourceId)!.push(restaurant);
    }

    return grouped;
  }

  /**
   * Check health of all registered extractors
   */
  async checkExtractorHealth(): Promise<Record<string, boolean>> {
    const healthResults: Record<string, boolean> = {};

    const healthChecks = Array.from(this.extractors.entries()).map(async ([sourceId, extractor]) => {
      try {
        const isHealthy = await extractor.healthCheck();
        healthResults[sourceId] = isHealthy;
        this.logger.info(`Health check for ${sourceId}: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
      } catch (error) {
        healthResults[sourceId] = false;
        this.logger.error(`Health check failed for ${sourceId}:`, error);
      }
    });

    await Promise.all(healthChecks);
    return healthResults;
  }

  /**
   * Get integration statistics
   */
  async getIntegrationStats(): Promise<{
    registeredSources: number;
    healthySources: number;
    lastIntegrationTime?: Date;
    totalRestaurantsProcessed: number;
  }> {
    const healthResults = await this.checkExtractorHealth();
    const healthySources = Object.values(healthResults).filter(Boolean).length;

    return {
      registeredSources: this.extractors.size,
      healthySources,
      totalRestaurantsProcessed: 0 // This would be tracked in a real implementation
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up data integration framework');

    const cleanupPromises = Array.from(this.extractors.values()).map(async (extractor) => {
      try {
        if ('cleanup' in extractor && typeof extractor.cleanup === 'function') {
          await extractor.cleanup();
        }
      } catch (error) {
        this.logger.error('Error during extractor cleanup:', error);
      }
    });

    await Promise.all(cleanupPromises);
    this.logger.info('Cleanup completed');
  }

  /**
   * Utility: Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Utility: Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}