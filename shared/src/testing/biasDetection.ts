import { Recommendation } from '../types/recommendation.types';
import { User } from '../types/user.types';
import { Restaurant } from '../types/restaurant.types';

export interface BiasTestConfig {
  testId: string;
  name: string;
  description: string;
  protectedAttributes: string[];
  fairnessMetrics: FairnessMetric[];
  thresholds: Record<string, number>;
}

export interface FairnessMetric {
  name: string;
  type: 'demographic_parity' | 'equalized_odds' | 'calibration' | 'individual_fairness';
  description: string;
}

export interface BiasTestResult {
  testId: string;
  timestamp: Date;
  overallBiasScore: number;
  metricResults: MetricResult[];
  recommendations: string[];
  flaggedIssues: BiasIssue[];
}

export interface MetricResult {
  metricName: string;
  score: number;
  threshold: number;
  passed: boolean;
  details: Record<string, any>;
}

export interface BiasIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  affectedGroups: string[];
  suggestedActions: string[];
}

export interface DemographicBiasResult {
  demographic: string;
  groups: DemographicGroup[];
  biasScore: number;
  statisticalSignificance: number;
  recommendations: string[];
}

export interface DemographicGroup {
  name: string;
  size: number;
  averageScore: number;
  standardDeviation: number;
  recommendationDistribution: Record<string, number>;
}

export interface BiasMitigationStrategy {
  name: string;
  type: 'preprocessing' | 'inprocessing' | 'postprocessing';
  description: string;
  applicableMetrics: string[];
  implementation: (data: any) => any;
}

export interface BiasMonitoringDashboard {
  timestamp: Date;
  overallFairnessScore: number;
  trendData: BiasMetricTrend[];
  alerts: BiasAlert[];
  recommendations: string[];
}

export interface BiasMetricTrend {
  metricName: string;
  values: { timestamp: Date; value: number }[];
  trend: 'improving' | 'declining' | 'stable';
}

export interface BiasAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

export interface UserGroup {
  name: string;
  users: User[];
  recommendations: Recommendation[][];
}

export class BiasDetectionFramework {
  private testConfigs: Map<string, BiasTestConfig> = new Map();
  private mitigationStrategies: Map<string, BiasMitigationStrategy> = new Map();
  private historicalResults: BiasTestResult[] = [];
  private alerts: BiasAlert[] = [];

  /**
   * Register a bias detection test
   */
  registerTest(config: BiasTestConfig): void {
    this.testConfigs.set(config.testId, config);
    console.log(`Bias detection test "${config.name}" registered`);
  }

  /**
   * Register a bias mitigation strategy
   */
  registerMitigationStrategy(strategy: BiasMitigationStrategy): void {
    this.mitigationStrategies.set(strategy.name, strategy);
    console.log(`Bias mitigation strategy "${strategy.name}" registered`);
  }

  /**
   * Detect demographic bias across different user groups
   */
  async detectDemographicBias(
    users: User[],
    recommendations: Recommendation[][],
    demographics: string[]
  ): Promise<DemographicBiasResult[]> {
    const results: DemographicBiasResult[] = [];

    for (const demographic of demographics) {
      const groups = this.groupUsersByDemographic(users, recommendations, demographic);
      const biasScore = this.calculateDemographicBiasScore(groups);
      const significance = this.calculateStatisticalSignificance(groups);
      const recommendationsText = this.generateDemographicRecommendations(groups, biasScore);

      results.push({
        demographic,
        groups,
        biasScore,
        statisticalSignificance: significance,
        recommendations: recommendationsText
      });
    }

    return results;
  }

  /**
   * Group users by demographic attribute
   */
  private groupUsersByDemographic(
    users: User[],
    recommendations: Recommendation[][],
    demographic: string
  ): DemographicGroup[] {
    const groupMap = new Map<string, { users: User[], recs: Recommendation[][] }>();

    users.forEach((user, index) => {
      const groupValue = this.extractDemographicValue(user, demographic);
      
      if (!groupMap.has(groupValue)) {
        groupMap.set(groupValue, { users: [], recs: [] });
      }
      
      const group = groupMap.get(groupValue)!;
      group.users.push(user);
      group.recs.push(recommendations[index] || []);
    });

    return Array.from(groupMap.entries()).map(([name, data]) => {
      const allScores = data.recs.flat().map(rec => rec.matchScore);
      const avgScore = allScores.length > 0 
        ? allScores.reduce((sum, score) => sum + score, 0) / allScores.length 
        : 0;
      
      const variance = allScores.length > 0
        ? allScores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / allScores.length
        : 0;
      
      const stdDev = Math.sqrt(variance);

      // Calculate recommendation distribution by cuisine type
      const cuisineDistribution: Record<string, number> = {};
      data.recs.flat().forEach(rec => {
        const cuisine = rec.restaurant.cuisineType[0] || 'unknown';
        cuisineDistribution[cuisine] = (cuisineDistribution[cuisine] || 0) + 1;
      });

      return {
        name,
        size: data.users.length,
        averageScore: avgScore,
        standardDeviation: stdDev,
        recommendationDistribution: cuisineDistribution
      };
    });
  }

  /**
   * Extract demographic value from user
   */
  private extractDemographicValue(user: User, demographic: string): string {
    switch (demographic) {
      case 'age_group':
        // Calculate age group from user data if available
        // This is a placeholder - in real implementation, you'd calculate from birthdate
        return 'unknown';
      case 'location_district':
        return user.location?.district || 'unknown';
      case 'primary_cuisine_preference':
        return user.preferences?.cuisineTypes?.[0] || 'unknown';
      case 'price_sensitivity':
        const priceRange = user.preferences?.priceRange;
        if (!priceRange) return 'unknown';
        const avgPrice = (priceRange[0] + priceRange[1]) / 2;
        if (avgPrice <= 1.5) return 'budget_conscious';
        if (avgPrice <= 2.5) return 'moderate';
        if (avgPrice <= 3.5) return 'premium';
        return 'luxury';
      case 'dietary_restrictions':
        const restrictions = user.preferences?.dietaryRestrictions || [];
        return restrictions.length > 0 ? 'has_restrictions' : 'no_restrictions';
      default:
        return 'unknown';
    }
  }

  /**
   * Calculate demographic bias score
   */
  private calculateDemographicBiasScore(groups: DemographicGroup[]): number {
    if (groups.length < 2) return 1.0;

    const scores = groups.map(g => g.averageScore).filter(s => s > 0);
    if (scores.length < 2) return 1.0;

    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    
    // Bias score is the ratio of min to max (1.0 = no bias, 0.0 = maximum bias)
    return maxScore > 0 ? minScore / maxScore : 1.0;
  }

  /**
   * Calculate statistical significance of bias
   */
  private calculateStatisticalSignificance(groups: DemographicGroup[]): number {
    if (groups.length < 2) return 0;

    // Simplified statistical significance calculation
    // In a real implementation, you'd use proper statistical tests like t-test or ANOVA
    const totalSampleSize = groups.reduce((sum, g) => sum + g.size, 0);
    const minGroupSize = Math.min(...groups.map(g => g.size));
    
    // Significance increases with sample size and decreases with variance
    const avgVariance = groups.reduce((sum, g) => sum + Math.pow(g.standardDeviation, 2), 0) / groups.length;
    const significance = Math.min(1, (minGroupSize / 30) * (1 / (1 + avgVariance)));
    
    return significance;
  }

  /**
   * Generate recommendations for demographic bias
   */
  private generateDemographicRecommendations(groups: DemographicGroup[], biasScore: number): string[] {
    const recommendations: string[] = [];

    if (biasScore >= 0.9) {
      recommendations.push('✅ Low demographic bias detected');
      recommendations.push('Continue monitoring for bias drift');
    } else if (biasScore >= 0.8) {
      recommendations.push('⚠️ Moderate demographic bias detected');
      recommendations.push('Review training data for representation balance');
      recommendations.push('Consider implementing fairness constraints');
    } else {
      recommendations.push('🚨 High demographic bias detected');
      recommendations.push('Immediate action required to address bias');
      recommendations.push('Implement bias mitigation strategies');
      recommendations.push('Audit data collection and labeling processes');
    }

    // Group-specific recommendations
    const sortedGroups = groups.sort((a, b) => a.averageScore - b.averageScore);
    const lowestGroup = sortedGroups[0];
    const highestGroup = sortedGroups[sortedGroups.length - 1];

    if (sortedGroups.length >= 2) {
      recommendations.push(`📊 Lowest performing group: ${lowestGroup.name} (avg: ${lowestGroup.averageScore.toFixed(3)})`);
      recommendations.push(`📊 Highest performing group: ${highestGroup.name} (avg: ${highestGroup.averageScore.toFixed(3)})`);
      
      if (lowestGroup.size < highestGroup.size * 0.5) {
        recommendations.push('🔍 Underrepresented group detected - increase data collection');
      }
    }

    return recommendations;
  }

  /**
   * Run bias detection on recommendation results
   */
  async detectBias(
    testId: string,
    users: User[],
    recommendations: Recommendation[][],
    restaurants: Restaurant[]
  ): Promise<BiasTestResult> {
    const config = this.testConfigs.get(testId);
    if (!config) {
      throw new Error(`Bias test ${testId} not found`);
    }

    const userGroups = this.segmentUsersByAttributes(users, recommendations, config.protectedAttributes);
    const metricResults = await this.calculateFairnessMetrics(config, userGroups, restaurants);
    const overallBiasScore = this.calculateOverallBiasScore(metricResults);
    const flaggedIssues = this.identifyBiasIssues(metricResults, config);
    const recommendationsText = this.generateBiasRecommendations(metricResults, flaggedIssues);

    return {
      testId,
      timestamp: new Date(),
      overallBiasScore,
      metricResults,
      recommendations: recommendationsText,
      flaggedIssues,
    };
  }

  /**
   * Test for demographic parity
   */
  private calculateDemographicParity(groups: UserGroup[]): MetricResult {
    if (groups.length < 2) {
      return {
        metricName: 'demographic_parity',
        score: 1.0,
        threshold: 0.8,
        passed: true,
        details: { reason: 'Insufficient groups for comparison' },
      };
    }

    // Calculate positive outcome rates for each group
    const groupRates = groups.map(group => {
      const totalRecommendations = group.recommendations.flat().length;
      const highQualityRecommendations = group.recommendations
        .flat()
        .filter(rec => rec.matchScore > 0.8).length;
      
      return {
        groupName: group.name,
        rate: totalRecommendations > 0 ? highQualityRecommendations / totalRecommendations : 0,
        sampleSize: totalRecommendations,
      };
    });

    // Calculate parity score (minimum ratio between groups)
    const rates = groupRates.map(g => g.rate).filter(r => r > 0);
    const minRate = Math.min(...rates);
    const maxRate = Math.max(...rates);
    const parityScore = rates.length > 0 ? minRate / maxRate : 1.0;

    return {
      metricName: 'demographic_parity',
      score: parityScore,
      threshold: 0.8,
      passed: parityScore >= 0.8,
      details: {
        groupRates,
        minRate,
        maxRate,
        interpretation: 'Higher scores indicate better demographic parity',
      },
    };
  }

  /**
   * Test for equalized odds
   */
  private calculateEqualizedOdds(groups: UserGroup[]): MetricResult {
    const groupMetrics = groups.map(group => {
      const allRecommendations = group.recommendations.flat();
      const truePositives = allRecommendations.filter(rec => 
        rec.matchScore > 0.8 && rec.emotionalAlignment > 0.7
      ).length;
      const falsePositives = allRecommendations.filter(rec => 
        rec.matchScore > 0.8 && rec.emotionalAlignment <= 0.7
      ).length;
      const trueNegatives = allRecommendations.filter(rec => 
        rec.matchScore <= 0.8 && rec.emotionalAlignment <= 0.7
      ).length;
      const falseNegatives = allRecommendations.filter(rec => 
        rec.matchScore <= 0.8 && rec.emotionalAlignment > 0.7
      ).length;

      const tpr = truePositives + falseNegatives > 0 
        ? truePositives / (truePositives + falseNegatives) 
        : 0;
      const fpr = falsePositives + trueNegatives > 0 
        ? falsePositives / (falsePositives + trueNegatives) 
        : 0;

      return {
        groupName: group.name,
        truePositiveRate: tpr,
        falsePositiveRate: fpr,
        sampleSize: allRecommendations.length,
      };
    });

    // Calculate equalized odds score
    const tprDifference = this.calculateMaxDifference(groupMetrics.map(g => g.truePositiveRate));
    const fprDifference = this.calculateMaxDifference(groupMetrics.map(g => g.falsePositiveRate));
    const equalizedOddsScore = 1 - Math.max(tprDifference, fprDifference);

    return {
      metricName: 'equalized_odds',
      score: equalizedOddsScore,
      threshold: 0.8,
      passed: equalizedOddsScore >= 0.8,
      details: {
        groupMetrics,
        tprDifference,
        fprDifference,
        interpretation: 'Measures equality of true positive and false positive rates across groups',
      },
    };
  }

  /**
   * Test for calibration
   */
  private calculateCalibration(groups: UserGroup[]): MetricResult {
    const groupCalibrations = groups.map(group => {
      const allRecommendations = group.recommendations.flat();
      
      // Group recommendations by predicted score ranges
      const scoreRanges = [
        { min: 0.0, max: 0.2, predictions: [] as Recommendation[] },
        { min: 0.2, max: 0.4, predictions: [] as Recommendation[] },
        { min: 0.4, max: 0.6, predictions: [] as Recommendation[] },
        { min: 0.6, max: 0.8, predictions: [] as Recommendation[] },
        { min: 0.8, max: 1.0, predictions: [] as Recommendation[] },
      ];

      allRecommendations.forEach(rec => {
        const range = scoreRanges.find(r => 
          rec.matchScore >= r.min && rec.matchScore < r.max
        );
        if (range) {
          range.predictions.push(rec);
        }
      });

      // Calculate calibration error for each range
      const calibrationErrors = scoreRanges.map(range => {
        if (range.predictions.length === 0) return 0;
        
        const avgPredicted = range.predictions.reduce((sum, rec) => sum + rec.matchScore, 0) / range.predictions.length;
        const actualPositives = range.predictions.filter(rec => rec.emotionalAlignment > 0.7).length;
        const actualRate = actualPositives / range.predictions.length;
        
        return Math.abs(avgPredicted - actualRate);
      });

      const avgCalibrationError = calibrationErrors.reduce((sum, error) => sum + error, 0) / calibrationErrors.length;

      return {
        groupName: group.name,
        calibrationError: avgCalibrationError,
        sampleSize: allRecommendations.length,
      };
    });

    const maxCalibrationError = Math.max(...groupCalibrations.map(g => g.calibrationError));
    const calibrationScore = 1 - maxCalibrationError;

    return {
      metricName: 'calibration',
      score: calibrationScore,
      threshold: 0.8,
      passed: calibrationScore >= 0.8,
      details: {
        groupCalibrations,
        maxCalibrationError,
        interpretation: 'Measures how well predicted probabilities match actual outcomes',
      },
    };
  }

  /**
   * Test for individual fairness
   */
  private calculateIndividualFairness(groups: UserGroup[]): MetricResult {
    const similarityThreshold = 0.9;
    const fairnessViolations: any[] = [];

    // Compare similar users across different groups
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const group1 = groups[i];
        const group2 = groups[j];

        group1.users.forEach((user1, idx1) => {
          group2.users.forEach((user2, idx2) => {
            const similarity = this.calculateUserSimilarity(user1, user2);
            
            if (similarity >= similarityThreshold) {
              const recs1 = group1.recommendations[idx1] || [];
              const recs2 = group2.recommendations[idx2] || [];
              
              const avgScore1 = recs1.length > 0 
                ? recs1.reduce((sum, rec) => sum + rec.matchScore, 0) / recs1.length 
                : 0;
              const avgScore2 = recs2.length > 0 
                ? recs2.reduce((sum, rec) => sum + rec.matchScore, 0) / recs2.length 
                : 0;
              
              const scoreDifference = Math.abs(avgScore1 - avgScore2);
              
              if (scoreDifference > 0.2) { // Threshold for unfair treatment
                fairnessViolations.push({
                  user1: user1.id,
                  user2: user2.id,
                  similarity,
                  scoreDifference,
                  group1: group1.name,
                  group2: group2.name,
                });
              }
            }
          });
        });
      }
    }

    const totalComparisons = groups.reduce((sum, group) => sum + group.users.length, 0);
    const violationRate = fairnessViolations.length / Math.max(totalComparisons, 1);
    const individualFairnessScore = 1 - violationRate;

    return {
      metricName: 'individual_fairness',
      score: individualFairnessScore,
      threshold: 0.9,
      passed: individualFairnessScore >= 0.9,
      details: {
        violations: fairnessViolations.slice(0, 10), // Show first 10 violations
        totalViolations: fairnessViolations.length,
        violationRate,
        interpretation: 'Similar individuals should receive similar treatment',
      },
    };
  }

  private segmentUsersByAttributes(
    users: User[],
    recommendations: Recommendation[][],
    protectedAttributes: string[]
  ): UserGroup[] {
    const groups: Map<string, { users: User[], recommendations: Recommendation[][] }> = new Map();

    users.forEach((user, index) => {
      protectedAttributes.forEach(attribute => {
        const attributeValue = this.extractAttributeValue(user, attribute);
        const groupKey = `${attribute}:${attributeValue}`;
        
        if (!groups.has(groupKey)) {
          groups.set(groupKey, { users: [], recommendations: [] });
        }
        
        const group = groups.get(groupKey)!;
        group.users.push(user);
        group.recommendations.push(recommendations[index] || []);
      });
    });

    return Array.from(groups.entries()).map(([name, data]) => ({
      name,
      users: data.users,
      recommendations: data.recommendations,
    }));
  }

  private extractAttributeValue(user: User, attribute: string): string {
    // Extract attribute value from user object
    switch (attribute) {
      case 'location':
        return user.location?.district || 'unknown';
      case 'age_group':
        // Calculate age group from user data if available
        return 'unknown'; // Placeholder
      case 'cuisine_preference':
        return user.preferences?.cuisineTypes?.[0] || 'unknown';
      default:
        return 'unknown';
    }
  }

  private async calculateFairnessMetrics(
    config: BiasTestConfig,
    groups: UserGroup[],
    restaurants: Restaurant[]
  ): Promise<MetricResult[]> {
    const results: MetricResult[] = [];

    for (const metric of config.fairnessMetrics) {
      let result: MetricResult;

      switch (metric.type) {
        case 'demographic_parity':
          result = this.calculateDemographicParity(groups);
          break;
        case 'equalized_odds':
          result = this.calculateEqualizedOdds(groups);
          break;
        case 'calibration':
          result = this.calculateCalibration(groups);
          break;
        case 'individual_fairness':
          result = this.calculateIndividualFairness(groups);
          break;
        default:
          result = {
            metricName: metric.name,
            score: 0,
            threshold: 0.8,
            passed: false,
            details: { error: 'Unknown metric type' },
          };
      }

      results.push(result);
    }

    return results;
  }

  private calculateOverallBiasScore(metricResults: MetricResult[]): number {
    if (metricResults.length === 0) return 1.0;
    
    const totalScore = metricResults.reduce((sum, result) => sum + result.score, 0);
    return totalScore / metricResults.length;
  }

  private identifyBiasIssues(metricResults: MetricResult[], config: BiasTestConfig): BiasIssue[] {
    const issues: BiasIssue[] = [];

    metricResults.forEach(result => {
      if (!result.passed) {
        const severity = this.determineSeverity(result.score, result.threshold);
        
        issues.push({
          severity,
          category: result.metricName,
          description: `${result.metricName} score (${result.score.toFixed(3)}) below threshold (${result.threshold})`,
          affectedGroups: this.extractAffectedGroups(result.details),
          suggestedActions: this.generateSuggestedActions(result.metricName, result.details),
        });
      }
    });

    return issues;
  }

  private determineSeverity(score: number, threshold: number): 'low' | 'medium' | 'high' | 'critical' {
    const gap = threshold - score;
    
    if (gap >= 0.3) return 'critical';
    if (gap >= 0.2) return 'high';
    if (gap >= 0.1) return 'medium';
    return 'low';
  }

  private extractAffectedGroups(details: any): string[] {
    if (details.groupRates) {
      return details.groupRates.map((g: any) => g.groupName);
    }
    if (details.groupMetrics) {
      return details.groupMetrics.map((g: any) => g.groupName);
    }
    return ['unknown'];
  }

  private generateSuggestedActions(metricName: string, details: any): string[] {
    const actions: string[] = [];

    switch (metricName) {
      case 'demographic_parity':
        actions.push('Review recommendation algorithm for group-specific biases');
        actions.push('Ensure training data represents all demographic groups equally');
        actions.push('Consider post-processing techniques to improve parity');
        break;
      case 'equalized_odds':
        actions.push('Analyze feature importance across different groups');
        actions.push('Implement group-specific threshold optimization');
        actions.push('Review data collection practices for systematic biases');
        break;
      case 'calibration':
        actions.push('Retrain model with better calibration techniques');
        actions.push('Apply post-hoc calibration methods');
        actions.push('Ensure sufficient training data for all groups');
        break;
      case 'individual_fairness':
        actions.push('Review similarity metrics for fairness');
        actions.push('Implement individual fairness constraints in model training');
        actions.push('Audit feature selection for discriminatory variables');
        break;
    }

    return actions;
  }

  private generateBiasRecommendations(metricResults: MetricResult[], issues: BiasIssue[]): string[] {
    const recommendations: string[] = [];

    if (issues.length === 0) {
      recommendations.push('✅ No significant bias detected in current model');
      recommendations.push('Continue monitoring with regular bias audits');
      return recommendations;
    }

    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const highIssues = issues.filter(i => i.severity === 'high');

    if (criticalIssues.length > 0) {
      recommendations.push('🚨 CRITICAL: Immediate action required to address bias issues');
      recommendations.push('Consider temporarily disabling affected model components');
    }

    if (highIssues.length > 0) {
      recommendations.push('⚠️ HIGH PRIORITY: Address bias issues in next model iteration');
    }

    recommendations.push(`📊 Overall bias score: ${this.calculateOverallBiasScore(metricResults).toFixed(3)}`);
    recommendations.push('🔍 Review training data for representation gaps');
    recommendations.push('🛠️ Implement bias mitigation techniques');
    recommendations.push('📈 Increase monitoring frequency for affected groups');

    return recommendations;
  }

  private calculateMaxDifference(values: number[]): number {
    if (values.length < 2) return 0;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return max - min;
  }

  private calculateUserSimilarity(user1: User, user2: User): number {
    // Simple similarity calculation based on preferences
    const prefs1 = user1.preferences;
    const prefs2 = user2.preferences;
    
    if (!prefs1 || !prefs2) return 0;

    // Calculate cuisine similarity
    const cuisineOverlap = prefs1.cuisineTypes.filter(c => 
      prefs2.cuisineTypes.includes(c)
    ).length;
    const cuisineSimilarity = cuisineOverlap / Math.max(prefs1.cuisineTypes.length, prefs2.cuisineTypes.length, 1);

    // Calculate price range similarity
    const priceRange1 = prefs1.priceRange;
    const priceRange2 = prefs2.priceRange;
    const priceSimilarity = 1 - Math.abs(priceRange1[0] - priceRange2[0]) / 4 - Math.abs(priceRange1[1] - priceRange2[1]) / 4;

    // Calculate atmosphere similarity
    const atmosphereOverlap = prefs1.atmospherePreferences.filter(a => 
      prefs2.atmospherePreferences.includes(a)
    ).length;
    const atmosphereSimilarity = atmosphereOverlap / Math.max(prefs1.atmospherePreferences.length, prefs2.atmospherePreferences.length, 1);

    // Weighted average
    return (cuisineSimilarity * 0.4 + priceSimilarity * 0.3 + atmosphereSimilarity * 0.3);
  }

  /**
   * Apply bias mitigation strategy
   */
  async applyMitigationStrategy(
    strategyName: string,
    data: any
  ): Promise<any> {
    const strategy = this.mitigationStrategies.get(strategyName);
    if (!strategy) {
      throw new Error(`Mitigation strategy ${strategyName} not found`);
    }

    console.log(`Applying bias mitigation strategy: ${strategy.name}`);
    return strategy.implementation(data);
  }

  /**
   * Initialize default mitigation strategies
   */
  initializeDefaultStrategies(): void {
    // Preprocessing strategy: Data augmentation
    this.registerMitigationStrategy({
      name: 'data_augmentation',
      type: 'preprocessing',
      description: 'Augment underrepresented groups in training data',
      applicableMetrics: ['demographic_parity', 'equalized_odds'],
      implementation: (data: any) => {
        // Identify underrepresented groups and augment data
        console.log('Applying data augmentation for underrepresented groups');
        return data; // Placeholder implementation
      }
    });

    // Inprocessing strategy: Fairness constraints
    this.registerMitigationStrategy({
      name: 'fairness_constraints',
      type: 'inprocessing',
      description: 'Add fairness constraints during model training',
      applicableMetrics: ['demographic_parity', 'equalized_odds', 'individual_fairness'],
      implementation: (data: any) => {
        console.log('Applying fairness constraints during training');
        return data; // Placeholder implementation
      }
    });

    // Postprocessing strategy: Threshold optimization
    this.registerMitigationStrategy({
      name: 'threshold_optimization',
      type: 'postprocessing',
      description: 'Optimize decision thresholds for different groups',
      applicableMetrics: ['equalized_odds', 'calibration'],
      implementation: (data: any) => {
        console.log('Optimizing thresholds for fairness');
        return data; // Placeholder implementation
      }
    });

    // Postprocessing strategy: Score adjustment
    this.registerMitigationStrategy({
      name: 'score_adjustment',
      type: 'postprocessing',
      description: 'Adjust recommendation scores to improve fairness',
      applicableMetrics: ['demographic_parity', 'individual_fairness'],
      implementation: (data: any) => {
        console.log('Adjusting scores for fairness');
        return data; // Placeholder implementation
      }
    });
  }

  /**
   * Generate bias monitoring dashboard
   */
  generateMonitoringDashboard(): BiasMonitoringDashboard {
    const recentResults = this.historicalResults.slice(-10); // Last 10 results
    const overallScore = recentResults.length > 0
      ? recentResults.reduce((sum, result) => sum + result.overallBiasScore, 0) / recentResults.length
      : 1.0;

    const trendData = this.calculateMetricTrends(recentResults);
    const activeAlerts = this.alerts.filter(alert => !alert.acknowledged);
    const recommendations = this.generateDashboardRecommendations(overallScore, activeAlerts);

    return {
      timestamp: new Date(),
      overallFairnessScore: overallScore,
      trendData,
      alerts: activeAlerts,
      recommendations
    };
  }

  /**
   * Calculate metric trends over time
   */
  private calculateMetricTrends(results: BiasTestResult[]): BiasMetricTrend[] {
    const metricMap = new Map<string, { timestamp: Date; value: number }[]>();

    results.forEach(result => {
      result.metricResults.forEach(metric => {
        if (!metricMap.has(metric.metricName)) {
          metricMap.set(metric.metricName, []);
        }
        metricMap.get(metric.metricName)!.push({
          timestamp: result.timestamp,
          value: metric.score
        });
      });
    });

    return Array.from(metricMap.entries()).map(([metricName, values]) => {
      const trend = this.calculateTrend(values.map(v => v.value));
      return {
        metricName,
        values,
        trend
      };
    });
  }

  /**
   * Calculate trend direction
   */
  private calculateTrend(values: number[]): 'improving' | 'declining' | 'stable' {
    if (values.length < 2) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;

    const difference = secondAvg - firstAvg;
    
    if (difference > 0.05) return 'improving';
    if (difference < -0.05) return 'declining';
    return 'stable';
  }

  /**
   * Generate dashboard recommendations
   */
  private generateDashboardRecommendations(
    overallScore: number,
    alerts: BiasAlert[]
  ): string[] {
    const recommendations: string[] = [];

    if (overallScore >= 0.9) {
      recommendations.push('✅ Excellent fairness performance');
      recommendations.push('Continue current monitoring practices');
    } else if (overallScore >= 0.8) {
      recommendations.push('⚠️ Good fairness with room for improvement');
      recommendations.push('Consider implementing additional mitigation strategies');
    } else if (overallScore >= 0.7) {
      recommendations.push('🔶 Moderate fairness concerns detected');
      recommendations.push('Implement bias mitigation strategies immediately');
      recommendations.push('Increase monitoring frequency');
    } else {
      recommendations.push('🚨 Significant fairness issues detected');
      recommendations.push('Immediate intervention required');
      recommendations.push('Consider model retraining with fairness constraints');
    }

    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      recommendations.push(`🚨 ${criticalAlerts.length} critical alerts require immediate attention`);
    }

    const highAlerts = alerts.filter(a => a.severity === 'high');
    if (highAlerts.length > 0) {
      recommendations.push(`⚠️ ${highAlerts.length} high-priority alerts need review`);
    }

    return recommendations;
  }

  /**
   * Add bias alert
   */
  addAlert(alert: Omit<BiasAlert, 'id' | 'timestamp' | 'acknowledged'>): void {
    const newAlert: BiasAlert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: new Date(),
      acknowledged: false
    };

    this.alerts.push(newAlert);
    console.log(`Bias alert added: ${newAlert.message}`);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      console.log(`Alert acknowledged: ${alertId}`);
    }
  }

  /**
   * Store test result for historical tracking
   */
  storeTestResult(result: BiasTestResult): void {
    this.historicalResults.push(result);
    
    // Keep only last 100 results
    if (this.historicalResults.length > 100) {
      this.historicalResults = this.historicalResults.slice(-100);
    }

    // Check for new alerts
    this.checkForNewAlerts(result);
  }

  /**
   * Check for new alerts based on test results
   */
  private checkForNewAlerts(result: BiasTestResult): void {
    // Critical bias score alert
    if (result.overallBiasScore < 0.7) {
      this.addAlert({
        severity: 'critical',
        message: `Overall bias score dropped to ${result.overallBiasScore.toFixed(3)} - immediate action required`
      });
    }

    // Individual metric alerts
    result.metricResults.forEach(metric => {
      if (!metric.passed && metric.score < 0.6) {
        this.addAlert({
          severity: metric.score < 0.5 ? 'critical' : 'high',
          message: `${metric.metricName} score (${metric.score.toFixed(3)}) significantly below threshold`
        });
      }
    });

    // Flagged issues alerts
    const criticalIssues = result.flaggedIssues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      this.addAlert({
        severity: 'critical',
        message: `${criticalIssues.length} critical bias issues detected in latest test`
      });
    }
  }

  /**
   * Get fairness metrics summary
   */
  getFairnessMetricsSummary(): Record<string, any> {
    const recentResults = this.historicalResults.slice(-5);
    if (recentResults.length === 0) {
      return { message: 'No recent test results available' };
    }

    const metricSummary: Record<string, any> = {};
    
    recentResults.forEach(result => {
      result.metricResults.forEach(metric => {
        if (!metricSummary[metric.metricName]) {
          metricSummary[metric.metricName] = {
            scores: [],
            passRate: 0,
            averageScore: 0
          };
        }
        
        metricSummary[metric.metricName].scores.push(metric.score);
        if (metric.passed) {
          metricSummary[metric.metricName].passRate++;
        }
      });
    });

    // Calculate averages and pass rates
    Object.keys(metricSummary).forEach(metricName => {
      const metric = metricSummary[metricName];
      metric.averageScore = metric.scores.reduce((sum: number, score: number) => sum + score, 0) / metric.scores.length;
      metric.passRate = metric.passRate / recentResults.length;
    });

    return metricSummary;
  }
}