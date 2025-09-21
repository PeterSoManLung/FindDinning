import { NormalizedRestaurantData } from '../types/dataSource.types';
import { Logger } from 'winston';
import { createLogger } from '../utils/logger';
import * as _ from 'lodash';

export interface DuplicateGroup {
  restaurants: NormalizedRestaurantData[];
  confidence: number;
  mergedRestaurant: NormalizedRestaurantData;
}

export class DeduplicationService {
  private logger: Logger;

  constructor() {
    this.logger = createLogger('DeduplicationService');
  }

  /**
   * Deduplicate restaurants from multiple sources
   */
  async deduplicateRestaurants(restaurants: NormalizedRestaurantData[]): Promise<NormalizedRestaurantData[]> {
    this.logger.info(`Starting deduplication for ${restaurants.length} restaurants`);

    const duplicateGroups = await this.findDuplicateGroups(restaurants);
    const deduplicatedRestaurants: NormalizedRestaurantData[] = [];
    const processedIds = new Set<string>();

    // Process duplicate groups
    for (const group of duplicateGroups) {
      if (group.restaurants.some(r => processedIds.has(r.externalId))) {
        continue; // Skip if already processed
      }

      const mergedRestaurant = await this.mergeRestaurants(group.restaurants);
      deduplicatedRestaurants.push(mergedRestaurant);

      // Mark all restaurants in group as processed
      group.restaurants.forEach(r => processedIds.add(r.externalId));
    }

    // Add unique restaurants that weren't part of any duplicate group
    for (const restaurant of restaurants) {
      if (!processedIds.has(restaurant.externalId)) {
        deduplicatedRestaurants.push(restaurant);
      }
    }

    this.logger.info(`Deduplication complete: ${restaurants.length} -> ${deduplicatedRestaurants.length} restaurants`);
    return deduplicatedRestaurants;
  }

  /**
   * Find groups of duplicate restaurants
   */
  private async findDuplicateGroups(restaurants: NormalizedRestaurantData[]): Promise<DuplicateGroup[]> {
    const duplicateGroups: DuplicateGroup[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < restaurants.length; i++) {
      if (processed.has(restaurants[i].externalId)) continue;

      const currentRestaurant = restaurants[i];
      const duplicates = [currentRestaurant];

      // Find all duplicates of current restaurant
      for (let j = i + 1; j < restaurants.length; j++) {
        if (processed.has(restaurants[j].externalId)) continue;

        const similarity = await this.calculateSimilarity(currentRestaurant, restaurants[j]);
        
        if (similarity.isDuplicate) {
          duplicates.push(restaurants[j]);
          processed.add(restaurants[j].externalId);
        }
      }

      if (duplicates.length > 1) {
        const mergedRestaurant = await this.mergeRestaurants(duplicates);
        duplicateGroups.push({
          restaurants: duplicates,
          confidence: this.calculateGroupConfidence(duplicates),
          mergedRestaurant
        });
      }

      processed.add(currentRestaurant.externalId);
    }

    return duplicateGroups;
  }

  /**
   * Calculate similarity between two restaurants
   */
  private async calculateSimilarity(
    restaurant1: NormalizedRestaurantData, 
    restaurant2: NormalizedRestaurantData
  ): Promise<{ isDuplicate: boolean; confidence: number; reasons: string[] }> {
    const scores: { [key: string]: number } = {};
    const reasons: string[] = [];

    // Name similarity (most important)
    const nameScore = this.calculateNameSimilarity(restaurant1.name, restaurant2.name);
    scores.name = nameScore;
    if (nameScore > 0.8) {
      reasons.push(`Similar names: "${restaurant1.name}" vs "${restaurant2.name}"`);
    }

    // Location similarity
    const locationScore = this.calculateLocationSimilarity(restaurant1.location, restaurant2.location);
    scores.location = locationScore;
    if (locationScore > 0.9) {
      reasons.push(`Very close locations (${this.calculateDistance(restaurant1.location, restaurant2.location).toFixed(0)}m apart)`);
    }

    // Address similarity
    const addressScore = this.calculateAddressSimilarity(restaurant1.address, restaurant2.address);
    scores.address = addressScore;
    if (addressScore > 0.7) {
      reasons.push(`Similar addresses`);
    }

    // Phone similarity
    const phoneScore = this.calculatePhoneSimilarity(
      restaurant1.contactInfo.phone, 
      restaurant2.contactInfo.phone
    );
    scores.phone = phoneScore;
    if (phoneScore === 1.0 && restaurant1.contactInfo.phone) {
      reasons.push(`Identical phone numbers`);
    }

    // Calculate weighted overall score
    const weights = {
      name: 0.4,
      location: 0.3,
      address: 0.2,
      phone: 0.1
    };

    const overallScore = Object.entries(weights).reduce((sum, [key, weight]) => {
      return sum + (scores[key] || 0) * weight;
    }, 0);

    // Determine if it's a duplicate based on multiple criteria
    const isDuplicate = this.isDuplicateBasedOnCriteria(scores, overallScore);

    return {
      isDuplicate,
      confidence: overallScore,
      reasons
    };
  }

  /**
   * Determine if restaurants are duplicates based on multiple criteria
   */
  private isDuplicateBasedOnCriteria(scores: { [key: string]: number }, overallScore: number): boolean {
    // High confidence duplicate
    if (overallScore > 0.85) return true;

    // Perfect phone match with decent name/location similarity
    if (scores.phone === 1.0 && scores.name > 0.6 && scores.location > 0.8) return true;

    // Very similar names with close location
    if (scores.name > 0.9 && scores.location > 0.9) return true;

    // Identical address with similar name
    if (scores.address > 0.95 && scores.name > 0.7) return true;

    return false;
  }

  /**
   * Calculate name similarity using multiple algorithms
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const normalized1 = this.normalizeNameForComparison(name1);
    const normalized2 = this.normalizeNameForComparison(name2);

    // Exact match
    if (normalized1 === normalized2) return 1.0;

    // Levenshtein distance
    const levenshteinScore = 1 - (this.levenshteinDistance(normalized1, normalized2) / Math.max(normalized1.length, normalized2.length));

    // Jaccard similarity (word-based)
    const jaccardScore = this.calculateJaccardSimilarity(normalized1, normalized2);

    // Longest common subsequence
    const lcsScore = this.longestCommonSubsequence(normalized1, normalized2) / Math.max(normalized1.length, normalized2.length);

    // Return weighted average
    return (levenshteinScore * 0.4 + jaccardScore * 0.4 + lcsScore * 0.2);
  }

  /**
   * Normalize name for comparison
   */
  private normalizeNameForComparison(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\b(restaurant|cafe|kitchen|dining|house|room|bar|grill)\b/g, '') // Remove common words
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate location similarity based on distance
   */
  private calculateLocationSimilarity(
    location1: { latitude: number; longitude: number }, 
    location2: { latitude: number; longitude: number }
  ): number {
    const distance = this.calculateDistance(location1, location2);
    
    // Same location (within 10 meters)
    if (distance <= 10) return 1.0;
    
    // Very close (within 50 meters)
    if (distance <= 50) return 0.95;
    
    // Close (within 100 meters)
    if (distance <= 100) return 0.9;
    
    // Nearby (within 200 meters)
    if (distance <= 200) return 0.8;
    
    // Same block (within 500 meters)
    if (distance <= 500) return 0.6;
    
    // Different locations
    return Math.max(0, 1 - (distance / 1000)); // Decrease score based on distance
  }

  /**
   * Calculate distance between two coordinates in meters
   */
  private calculateDistance(
    location1: { latitude: number; longitude: number }, 
    location2: { latitude: number; longitude: number }
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = location1.latitude * Math.PI / 180;
    const φ2 = location2.latitude * Math.PI / 180;
    const Δφ = (location2.latitude - location1.latitude) * Math.PI / 180;
    const Δλ = (location2.longitude - location1.longitude) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Calculate address similarity
   */
  private calculateAddressSimilarity(address1: string, address2: string): number {
    const normalized1 = this.normalizeAddressForComparison(address1);
    const normalized2 = this.normalizeAddressForComparison(address2);

    if (normalized1 === normalized2) return 1.0;

    const levenshteinScore = 1 - (this.levenshteinDistance(normalized1, normalized2) / Math.max(normalized1.length, normalized2.length));
    const jaccardScore = this.calculateJaccardSimilarity(normalized1, normalized2);

    return (levenshteinScore + jaccardScore) / 2;
  }

  /**
   * Normalize address for comparison
   */
  private normalizeAddressForComparison(address: string): string {
    return address
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\b(floor|f|ground|g|shop|unit|suite|room)\b/g, '')
      .replace(/\b\d+(st|nd|rd|th)\b/g, '') // Remove ordinal numbers
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate phone similarity
   */
  private calculatePhoneSimilarity(phone1?: string, phone2?: string): number {
    if (!phone1 || !phone2) return 0;

    const normalized1 = phone1.replace(/[^\d]/g, '');
    const normalized2 = phone2.replace(/[^\d]/g, '');

    if (normalized1 === normalized2) return 1.0;

    // Check if one is a subset of the other (different formats)
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return 0.9;
    }

    return 0;
  }

  /**
   * Merge multiple restaurants into one
   */
  private async mergeRestaurants(restaurants: NormalizedRestaurantData[]): Promise<NormalizedRestaurantData> {
    if (restaurants.length === 1) return restaurants[0];

    // Sort by data quality to prioritize better data
    const sortedRestaurants = restaurants.sort((a, b) => b.dataQuality.overall - a.dataQuality.overall);
    const primary = sortedRestaurants[0];

    const merged: NormalizedRestaurantData = {
      ...primary,
      // Merge cuisine types
      cuisineType: this.mergeArrays(restaurants.map(r => r.cuisineType)),
      
      // Use best rating (highest with most reviews)
      rating: this.selectBestRating(restaurants),
      reviewCount: restaurants.reduce((sum, r) => sum + r.reviewCount, 0),
      
      // Merge contact info
      contactInfo: {
        phone: this.selectBestValue(restaurants.map(r => r.contactInfo.phone)),
        website: this.selectBestValue(restaurants.map(r => r.contactInfo.website))
      },
      
      // Merge features and menu highlights
      features: this.mergeArrays(restaurants.map(r => r.features)),
      menuHighlights: this.mergeArrays(restaurants.map(r => r.menuHighlights)),
      photos: this.mergeArrays(restaurants.map(r => r.photos)),
      
      // Merge reviews
      reviews: this.mergeReviews(restaurants),
      
      // Update source metadata to reflect merge
      sourceMetadata: {
        ...primary.sourceMetadata,
        sourceName: `Merged from ${restaurants.length} sources`,
        extractedAt: new Date()
      },
      
      // Recalculate data quality
      dataQuality: this.calculateMergedDataQuality(restaurants)
    };

    this.logger.debug(`Merged ${restaurants.length} restaurants into one: ${merged.name}`);
    return merged;
  }

  /**
   * Merge arrays and remove duplicates
   */
  private mergeArrays(arrays: string[][]): string[] {
    const merged = arrays.flat();
    return [...new Set(merged)].slice(0, 20); // Limit and deduplicate
  }

  /**
   * Select best rating based on review count and quality
   */
  private selectBestRating(restaurants: NormalizedRestaurantData[]): number {
    // Weight ratings by review count and data quality
    let totalWeightedRating = 0;
    let totalWeight = 0;

    for (const restaurant of restaurants) {
      const weight = Math.sqrt(restaurant.reviewCount) * restaurant.dataQuality.overall;
      totalWeightedRating += restaurant.rating * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalWeightedRating / totalWeight : restaurants[0].rating;
  }

  /**
   * Select best non-null value
   */
  private selectBestValue<T>(values: (T | undefined)[]): T | undefined {
    return values.find(value => value !== undefined && value !== null && value !== '');
  }

  /**
   * Merge reviews from multiple sources
   */
  private mergeReviews(restaurants: NormalizedRestaurantData[]): any[] {
    const allReviews = restaurants.flatMap(r => r.reviews);
    
    // Remove duplicate reviews based on content similarity
    const uniqueReviews = [];
    const processedContent = new Set();

    for (const review of allReviews) {
      const contentHash = this.hashContent(review.content);
      if (!processedContent.has(contentHash)) {
        uniqueReviews.push(review);
        processedContent.add(contentHash);
      }
    }

    return uniqueReviews.slice(0, 100); // Limit to 100 reviews
  }

  /**
   * Calculate merged data quality
   */
  private calculateMergedDataQuality(restaurants: NormalizedRestaurantData[]): any {
    const qualities = restaurants.map(r => r.dataQuality);
    
    return {
      overall: qualities.reduce((sum, q) => sum + q.overall, 0) / qualities.length,
      completeness: Math.max(...qualities.map(q => q.completeness)),
      accuracy: qualities.reduce((sum, q) => sum + q.accuracy, 0) / qualities.length,
      freshness: Math.max(...qualities.map(q => q.freshness)),
      consistency: qualities.reduce((sum, q) => sum + q.consistency, 0) / qualities.length
    };
  }

  /**
   * Calculate group confidence
   */
  private calculateGroupConfidence(restaurants: NormalizedRestaurantData[]): number {
    if (restaurants.length < 2) return 0;

    let totalConfidence = 0;
    let comparisons = 0;

    for (let i = 0; i < restaurants.length; i++) {
      for (let j = i + 1; j < restaurants.length; j++) {
        const similarity = this.calculateSimilarity(restaurants[i], restaurants[j]);
        totalConfidence += similarity.then(s => s.confidence);
        comparisons++;
      }
    }

    return comparisons > 0 ? totalConfidence / comparisons : 0;
  }

  /**
   * Utility functions
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private calculateJaccardSimilarity(str1: string, str2: string): number {
    const set1 = new Set(str1.split(' '));
    const set2 = new Set(str2.split(' '));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  private longestCommonSubsequence(str1: string, str2: string): number {
    const matrix = Array(str1.length + 1).fill(null).map(() => Array(str2.length + 1).fill(0));

    for (let i = 1; i <= str1.length; i++) {
      for (let j = 1; j <= str2.length; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1] + 1;
        } else {
          matrix[i][j] = Math.max(matrix[i - 1][j], matrix[i][j - 1]);
        }
      }
    }

    return matrix[str1.length][str2.length];
  }

  private hashContent(content: string): string {
    // Simple hash function for content deduplication
    return content.toLowerCase().replace(/[^\w]/g, '').substring(0, 100);
  }
}