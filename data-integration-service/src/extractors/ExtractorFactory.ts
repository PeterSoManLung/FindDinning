import { BaseDataExtractor } from './BaseDataExtractor';
import { OpenRiceExtractor } from './OpenRiceExtractor';
import { EatigoExtractor } from './EatigoExtractor';
import { ChopeExtractor } from './ChopeExtractor';
import { KeetaExtractor } from './KeetaExtractor';
import { FoodpandaExtractor } from './FoodpandaExtractor';
import { BistroChatExtractor } from './BistroChatExtractor';
import { TripAdvisorExtractor } from './TripAdvisorExtractor';
import { HongKongGovDataExtractor } from './HongKongGovDataExtractor';
import { DataSourceEnum } from '../types/dataSource.types';

export class ExtractorFactory {
  private static extractors: Map<DataSourceEnum, BaseDataExtractor> = new Map();

  /**
   * Get extractor instance for a specific data source
   */
  static getExtractor(source: DataSourceEnum): BaseDataExtractor {
    if (!this.extractors.has(source)) {
      this.extractors.set(source, this.createExtractor(source));
    }
    
    return this.extractors.get(source)!;
  }

  /**
   * Get all available extractors
   */
  static getAllExtractors(): Map<DataSourceEnum, BaseDataExtractor> {
    // Initialize all extractors if not already done
    for (const source of Object.values(DataSourceEnum)) {
      if (!this.extractors.has(source)) {
        this.extractors.set(source, this.createExtractor(source));
      }
    }
    
    return this.extractors;
  }

  /**
   * Get extractors for specific sources
   */
  static getExtractors(sources: DataSourceEnum[]): Map<DataSourceEnum, BaseDataExtractor> {
    const extractors = new Map<DataSourceEnum, BaseDataExtractor>();
    
    for (const source of sources) {
      extractors.set(source, this.getExtractor(source));
    }
    
    return extractors;
  }

  /**
   * Check health of all extractors
   */
  static async checkAllExtractorsHealth(): Promise<Map<DataSourceEnum, boolean>> {
    const healthStatus = new Map<DataSourceEnum, boolean>();
    const extractors = this.getAllExtractors();
    
    const healthChecks = Array.from(extractors.entries()).map(async ([source, extractor]) => {
      try {
        const isHealthy = await extractor.healthCheck();
        healthStatus.set(source, isHealthy);
      } catch (error) {
        console.error(`Health check failed for ${source}:`, error);
        healthStatus.set(source, false);
      }
    });
    
    await Promise.all(healthChecks);
    return healthStatus;
  }

  /**
   * Check health of specific extractors
   */
  static async checkExtractorsHealth(sources: DataSourceEnum[]): Promise<Map<DataSourceEnum, boolean>> {
    const healthStatus = new Map<DataSourceEnum, boolean>();
    
    const healthChecks = sources.map(async (source) => {
      try {
        const extractor = this.getExtractor(source);
        const isHealthy = await extractor.healthCheck();
        healthStatus.set(source, isHealthy);
      } catch (error) {
        console.error(`Health check failed for ${source}:`, error);
        healthStatus.set(source, false);
      }
    });
    
    await Promise.all(healthChecks);
    return healthStatus;
  }

  /**
   * Get extractor reliability scores
   */
  static getExtractorReliabilityScores(): Map<DataSourceEnum, number> {
    return new Map([
      [DataSourceEnum.HK_GOV, 0.95],        // Government data is most reliable
      [DataSourceEnum.TRIPADVISOR, 0.88],   // High-quality reviews
      [DataSourceEnum.OPENRICE, 0.85],      // Good local data
      [DataSourceEnum.CHOPE, 0.82],         // Good reservation data
      [DataSourceEnum.EATIGO, 0.80],        // Good promotional data
      [DataSourceEnum.FOODPANDA, 0.78],     // Good delivery data
      [DataSourceEnum.KEETA, 0.75],         // Decent delivery data
      [DataSourceEnum.BISTROCHAT, 0.70]     // Social data, less comprehensive
    ]);
  }

  /**
   * Get recommended extraction order (most reliable first)
   */
  static getRecommendedExtractionOrder(): DataSourceEnum[] {
    const reliabilityScores = this.getExtractorReliabilityScores();
    
    return Array.from(reliabilityScores.entries())
      .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
      .map(([source]) => source);
  }

  /**
   * Create extractor instance based on source type
   */
  private static createExtractor(source: DataSourceEnum): BaseDataExtractor {
    switch (source) {
      case DataSourceEnum.HK_GOV:
        return new HongKongGovDataExtractor();
      case DataSourceEnum.OPENRICE:
        return new OpenRiceExtractor();
      case DataSourceEnum.EATIGO:
        return new EatigoExtractor();
      case DataSourceEnum.CHOPE:
        return new ChopeExtractor();
      case DataSourceEnum.KEETA:
        return new KeetaExtractor();
      case DataSourceEnum.FOODPANDA:
        return new FoodpandaExtractor();
      case DataSourceEnum.BISTROCHAT:
        return new BistroChatExtractor();
      case DataSourceEnum.TRIPADVISOR:
        return new TripAdvisorExtractor();
      default:
        throw new Error(`Unknown data source: ${source}`);
    }
  }

  /**
   * Clear all cached extractors (useful for testing or configuration changes)
   */
  static clearCache(): void {
    this.extractors.clear();
  }

  /**
   * Get extractor configuration summary
   */
  static getExtractorSummary(): Array<{
    source: DataSourceEnum;
    name: string;
    reliability: number;
    rateLimitMs: number;
    isActive: boolean;
  }> {
    const extractors = this.getAllExtractors();
    const reliabilityScores = this.getExtractorReliabilityScores();
    
    return Array.from(extractors.entries()).map(([source, extractor]) => ({
      source,
      name: (extractor as any).dataSource.name,
      reliability: reliabilityScores.get(source) || 0,
      rateLimitMs: (extractor as any).dataSource.rateLimitMs,
      isActive: (extractor as any).dataSource.isActive
    }));
  }
}