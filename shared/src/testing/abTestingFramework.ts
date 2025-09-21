import { Recommendation } from '../types/recommendation.types';
import { User } from '../types/user.types';

export interface ABTestConfig {
  testId: string;
  name: string;
  description: string;
  variants: ABTestVariant[];
  trafficAllocation: number; // Percentage of users to include in test
  startDate: Date;
  endDate: Date;
  successMetrics: string[];
  minimumSampleSize: number;
}

export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  allocation: number; // Percentage of test traffic
  modelConfig?: any;
  parameters?: Record<string, any>;
}

export interface ABTestResult {
  testId: string;
  variantId: string;
  userId: string;
  timestamp: Date;
  metrics: Record<string, number>;
  recommendations?: Recommendation[];
  userFeedback?: {
    rating?: number;
    clicked?: boolean;
    converted?: boolean;
    timeSpent?: number;
  };
}

export interface ABTestAnalysis {
  testId: string;
  status: 'running' | 'completed' | 'stopped';
  variants: VariantAnalysis[];
  statisticalSignificance: boolean;
  confidenceLevel: number;
  winner?: string;
  recommendations: string[];
}

export interface VariantAnalysis {
  variantId: string;
  sampleSize: number;
  conversionRate: number;
  averageRating: number;
  clickThroughRate: number;
  confidenceInterval: [number, number];
  pValue: number;
}

export class ABTestingFramework {
  private activeTests: Map<string, ABTestConfig> = new Map();
  private testResults: Map<string, ABTestResult[]> = new Map();

  /**
   * Create and start a new A/B test
   */
  createTest(config: ABTestConfig): void {
    // Validate test configuration
    this.validateTestConfig(config);
    
    // Store test configuration
    this.activeTests.set(config.testId, config);
    this.testResults.set(config.testId, []);
    
    console.log(`A/B Test "${config.name}" started with ${config.variants.length} variants`);
  }

  /**
   * Determine which variant a user should see
   */
  getVariantForUser(testId: string, userId: string): ABTestVariant | null {
    const test = this.activeTests.get(testId);
    if (!test) return null;

    // Check if test is active
    const now = new Date();
    if (now < test.startDate || now > test.endDate) {
      return null;
    }

    // Check if user should be included in test
    if (!this.shouldIncludeUser(userId, test.trafficAllocation)) {
      return null;
    }

    // Determine variant using consistent hashing
    const variantIndex = this.getConsistentVariantIndex(userId, testId, test.variants.length);
    return test.variants[variantIndex];
  }

  /**
   * Record test result
   */
  recordResult(result: ABTestResult): void {
    const results = this.testResults.get(result.testId);
    if (results) {
      results.push(result);
    }
  }

  /**
   * Analyze test results
   */
  analyzeTest(testId: string): ABTestAnalysis {
    const test = this.activeTests.get(testId);
    const results = this.testResults.get(testId);
    
    if (!test || !results) {
      throw new Error(`Test ${testId} not found`);
    }

    const variantAnalyses = test.variants.map(variant => 
      this.analyzeVariant(variant.id, results)
    );

    const statisticalSignificance = this.calculateStatisticalSignificance(variantAnalyses);
    const winner = this.determineWinner(variantAnalyses);

    return {
      testId,
      status: this.getTestStatus(test, results),
      variants: variantAnalyses,
      statisticalSignificance,
      confidenceLevel: 0.95,
      winner,
      recommendations: this.generateRecommendations(variantAnalyses, statisticalSignificance),
    };
  }

  /**
   * Stop a running test
   */
  stopTest(testId: string): void {
    const test = this.activeTests.get(testId);
    if (test) {
      test.endDate = new Date();
      console.log(`A/B Test "${test.name}" stopped`);
    }
  }

  private validateTestConfig(config: ABTestConfig): void {
    if (config.variants.length < 2) {
      throw new Error('A/B test must have at least 2 variants');
    }

    const totalAllocation = config.variants.reduce((sum, variant) => sum + variant.allocation, 0);
    if (Math.abs(totalAllocation - 100) > 0.01) {
      throw new Error('Variant allocations must sum to 100%');
    }

    if (config.trafficAllocation <= 0 || config.trafficAllocation > 100) {
      throw new Error('Traffic allocation must be between 0 and 100%');
    }

    if (config.startDate >= config.endDate) {
      throw new Error('Start date must be before end date');
    }
  }

  private shouldIncludeUser(userId: string, trafficAllocation: number): boolean {
    const hash = this.hashString(userId);
    const percentage = (hash % 100) + 1;
    return percentage <= trafficAllocation;
  }

  private getConsistentVariantIndex(userId: string, testId: string, variantCount: number): number {
    const hash = this.hashString(userId + testId);
    return hash % variantCount;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private analyzeVariant(variantId: string, results: ABTestResult[]): VariantAnalysis {
    const variantResults = results.filter(r => r.variantId === variantId);
    const sampleSize = variantResults.length;

    if (sampleSize === 0) {
      return {
        variantId,
        sampleSize: 0,
        conversionRate: 0,
        averageRating: 0,
        clickThroughRate: 0,
        confidenceInterval: [0, 0],
        pValue: 1,
      };
    }

    const conversions = variantResults.filter(r => r.userFeedback?.converted).length;
    const clicks = variantResults.filter(r => r.userFeedback?.clicked).length;
    const ratings = variantResults
      .map(r => r.userFeedback?.rating)
      .filter(rating => rating !== undefined) as number[];

    const conversionRate = conversions / sampleSize;
    const clickThroughRate = clicks / sampleSize;
    const averageRating = ratings.length > 0 
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length 
      : 0;

    const confidenceInterval = this.calculateConfidenceInterval(conversionRate, sampleSize);
    const pValue = this.calculatePValue(variantResults, results);

    return {
      variantId,
      sampleSize,
      conversionRate,
      averageRating,
      clickThroughRate,
      confidenceInterval,
      pValue,
    };
  }

  private calculateConfidenceInterval(rate: number, sampleSize: number): [number, number] {
    if (sampleSize === 0) return [0, 0];

    const z = 1.96; // 95% confidence level
    const standardError = Math.sqrt((rate * (1 - rate)) / sampleSize);
    const margin = z * standardError;

    return [
      Math.max(0, rate - margin),
      Math.min(1, rate + margin),
    ];
  }

  private calculatePValue(variantResults: ABTestResult[], allResults: ABTestResult[]): number {
    // Simplified p-value calculation using chi-square test
    // In a real implementation, you'd use a proper statistical library
    
    const variantConversions = variantResults.filter(r => r.userFeedback?.converted).length;
    const variantSample = variantResults.length;
    
    const totalConversions = allResults.filter(r => r.userFeedback?.converted).length;
    const totalSample = allResults.length;
    
    if (totalSample === 0 || variantSample === 0) return 1;
    
    const expectedConversions = (totalConversions / totalSample) * variantSample;
    const chiSquare = Math.pow(variantConversions - expectedConversions, 2) / expectedConversions;
    
    // Simplified p-value approximation
    return Math.exp(-chiSquare / 2);
  }

  private calculateStatisticalSignificance(variants: VariantAnalysis[]): boolean {
    // Check if any variant has p-value < 0.05 and sufficient sample size
    return variants.some(variant => 
      variant.pValue < 0.05 && variant.sampleSize >= 100
    );
  }

  private determineWinner(variants: VariantAnalysis[]): string | undefined {
    if (variants.length < 2) return undefined;

    // Find variant with highest conversion rate and statistical significance
    const significantVariants = variants.filter(v => v.pValue < 0.05 && v.sampleSize >= 100);
    
    if (significantVariants.length === 0) return undefined;

    return significantVariants.reduce((winner, current) => 
      current.conversionRate > winner.conversionRate ? current : winner
    ).variantId;
  }

  private getTestStatus(test: ABTestConfig, results: ABTestResult[]): 'running' | 'completed' | 'stopped' {
    const now = new Date();
    
    if (now > test.endDate) return 'completed';
    if (now < test.startDate) return 'stopped';
    
    // Check if minimum sample size reached
    const totalSamples = results.length;
    if (totalSamples >= test.minimumSampleSize) return 'completed';
    
    return 'running';
  }

  private generateRecommendations(variants: VariantAnalysis[], significant: boolean): string[] {
    const recommendations: string[] = [];

    if (!significant) {
      recommendations.push('Continue test - no statistically significant results yet');
      recommendations.push('Consider increasing sample size or test duration');
      return recommendations;
    }

    const winner = variants.reduce((best, current) => 
      current.conversionRate > best.conversionRate ? current : best
    );

    recommendations.push(`Variant ${winner.variantId} shows best performance`);
    recommendations.push(`Conversion rate: ${(winner.conversionRate * 100).toFixed(2)}%`);
    recommendations.push(`Average rating: ${winner.averageRating.toFixed(2)}`);

    if (winner.pValue < 0.01) {
      recommendations.push('Results are highly significant (p < 0.01)');
    } else if (winner.pValue < 0.05) {
      recommendations.push('Results are significant (p < 0.05)');
    }

    return recommendations;
  }
}