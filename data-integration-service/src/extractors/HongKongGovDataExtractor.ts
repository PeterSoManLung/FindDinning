import { BaseDataExtractor } from './BaseDataExtractor';
import { RawRestaurantData, DataExtractionResult, DataSource } from '../types/dataSource.types';

interface GovHKLicenseData {
  'licence_no': string;
  'name_of_licensee': string;
  'name_of_premises': string;
  'address_of_premises': string;
  'type_of_licence': string;
  'licence_status': string;
  'issue_date': string;
  'expiry_date': string;
  'district': string;
  'latitude'?: string;
  'longitude'?: string;
}

interface GovHKInspectionData {
  'licence_no': string;
  'inspection_date': string;
  'inspection_result': string;
  'violations': string;
  'score'?: string;
}

export class HongKongGovDataExtractor extends BaseDataExtractor {
  private readonly RESTAURANT_LICENSE_ENDPOINT = '/api/action/datastore_search';
  private readonly INSPECTION_ENDPOINT = '/api/action/datastore_search';
  
  // Resource IDs for different datasets on data.gov.hk
  private readonly RESTAURANT_LICENSE_RESOURCE_ID = 'restaurant-licenses'; // This would be the actual resource ID
  private readonly FOOD_INSPECTION_RESOURCE_ID = 'food-inspections'; // This would be the actual resource ID

  constructor() {
    const dataSource = {
      id: 'hk-gov',
      name: 'Hong Kong Government',
      type: 'government' as any,
      baseUrl: 'https://data.gov.hk',
      isActive: true,
      rateLimitMs: 2000, // Be respectful to government APIs
      maxRetries: 3,
      timeout: 15000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'FindDining-DataIntegration/1.0'
      }
    };
    
    super(dataSource);
  }

  /**
   * Extract restaurant license data from data.gov.hk
   */
  async extractRestaurantData(params?: { limit?: number; offset?: number }): Promise<DataExtractionResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const restaurants: RawRestaurantData[] = [];

    try {
      this.logger.info('Starting extraction from Hong Kong Government data sources');

      // Extract restaurant license data
      const licenseData = await this.extractRestaurantLicenses(params);
      
      // Extract inspection data for correlation
      const inspectionData = await this.extractInspectionData();
      
      // Process and combine the data
      for (const license of licenseData) {
        try {
          const restaurant = await this.processLicenseData(license, inspectionData);
          if (restaurant) {
            restaurants.push(restaurant);
          }
        } catch (error) {
          const errorMsg = `Failed to process license ${license.licence_no}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errors.push(errorMsg);
          this.logger.warn(errorMsg);
        }
      }

      const processingTime = Date.now() - startTime;
      
      this.logger.info(`Extracted ${restaurants.length} restaurants from Hong Kong Government data in ${processingTime}ms`);

      return {
        success: true,
        data: restaurants,
        errors,
        metadata: {
          totalExtracted: restaurants.length,
          processingTime,
          sourceReliability: 1.0 // Government data is highly reliable
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMsg = `Hong Kong Government data extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      this.logger.error(errorMsg);
      
      return {
        success: false,
        data: [],
        errors: [errorMsg, ...errors],
        metadata: {
          totalExtracted: 0,
          processingTime,
          sourceReliability: 1.0
        }
      };
    }
  }

  /**
   * Extract specific restaurant by license number
   */
  async extractRestaurantById(licenseNo: string): Promise<RawRestaurantData | null> {
    try {
      const licenseData = await this.extractRestaurantLicenses({ 
        filters: { licence_no: licenseNo },
        limit: 1 
      });

      if (licenseData.length === 0) {
        return null;
      }

      const inspectionData = await this.extractInspectionData({ licence_no: licenseNo });
      return await this.processLicenseData(licenseData[0], inspectionData);

    } catch (error) {
      this.logger.error(`Failed to extract restaurant by license ${licenseNo}:`, error);
      return null;
    }
  }

  /**
   * Extract restaurant license data from data.gov.hk
   */
  private async extractRestaurantLicenses(params?: any): Promise<GovHKLicenseData[]> {
    const requestParams = {
      resource_id: this.RESTAURANT_LICENSE_RESOURCE_ID,
      limit: params?.limit || 1000,
      offset: params?.offset || 0,
      ...params?.filters
    };

    try {
      const response = await this.makeRequest<{
        success: boolean;
        result: {
          records: GovHKLicenseData[];
          total: number;
        };
      }>({
        method: 'GET',
        url: this.RESTAURANT_LICENSE_ENDPOINT,
        params: requestParams
      });

      if (!response.success) {
        throw new Error('API returned unsuccessful response');
      }

      // Filter for active restaurant licenses
      const restaurantLicenses = response.result.records.filter(record => {
        const isRestaurant = this.isRestaurantLicense(record);
        const isActive = this.isActiveLicense(record);
        this.logger.debug(`License ${record.licence_no}: type="${record.type_of_licence}", status="${record.licence_status}", isRestaurant=${isRestaurant}, isActive=${isActive}`);
        return isRestaurant && isActive;
      });

      this.logger.info(`Retrieved ${restaurantLicenses.length} restaurant licenses from government data`);
      return restaurantLicenses;

    } catch (error) {
      this.logger.error('Failed to extract restaurant licenses:', error);
      throw error;
    }
  }

  /**
   * Extract food inspection data
   */
  private async extractInspectionData(filters?: any): Promise<GovHKInspectionData[]> {
    const requestParams = {
      resource_id: this.FOOD_INSPECTION_RESOURCE_ID,
      limit: 5000, // Get more inspection records
      ...filters
    };

    try {
      const response = await this.makeRequest<{
        success: boolean;
        result: {
          records: GovHKInspectionData[];
          total: number;
        };
      }>({
        method: 'GET',
        url: this.INSPECTION_ENDPOINT,
        params: requestParams
      });

      if (!response.success) {
        this.logger.warn('Failed to retrieve inspection data, continuing without it');
        return [];
      }

      this.logger.info(`Retrieved ${response.result.records.length} inspection records`);
      return response.result.records;

    } catch (error) {
      this.logger.warn('Failed to extract inspection data, continuing without it:', error);
      return [];
    }
  }

  /**
   * Process license data into restaurant format
   */
  private async processLicenseData(
    license: GovHKLicenseData, 
    inspectionData: GovHKInspectionData[]
  ): Promise<RawRestaurantData | null> {
    // Skip if missing essential data
    if (!license.name_of_premises || !license.address_of_premises) {
      return null;
    }

    // Find related inspection data
    const relatedInspections = inspectionData.filter(
      inspection => inspection.licence_no === license.licence_no
    );

    // Calculate health score from inspections
    const healthScore = this.calculateHealthScore(relatedInspections);
    // this.logger.debug(`License ${license.licence_no}: found ${relatedInspections.length} inspections, health score: ${healthScore}, rating: ${this.convertHealthScoreToRating(healthScore)}`);
    
    // Parse coordinates if available
    const coordinates = this.parseCoordinates(license.latitude, license.longitude);

    const restaurant: RawRestaurantData = {
      sourceId: 'gov_hk',
      externalId: license.licence_no,
      name: this.cleanText(license.name_of_premises),
      address: this.cleanText(license.address_of_premises),
      latitude: coordinates?.latitude,
      longitude: coordinates?.longitude,
      cuisineType: this.inferCuisineFromName(license.name_of_premises),
      priceRange: 2, // Default, as government data doesn't include pricing
      rating: this.convertHealthScoreToRating(healthScore),
      reviewCount: 0, // Government data doesn't include reviews
      operatingHours: {}, // Not available in license data
      phone: undefined, // Not available in license data
      website: undefined, // Not available in license data
      menuItems: [],
      features: this.extractFeaturesFromLicense(license),
      photos: [],
      reviews: [],
      lastUpdated: this.parseDate(license.issue_date) || new Date(),
      dataQuality: this.calculateGovernmentDataQuality(license, coordinates !== null)
    };

    return restaurant;
  }

  /**
   * Check if license is for a restaurant/food establishment
   */
  private isRestaurantLicense(license: GovHKLicenseData): boolean {
    const restaurantTypes = [
      'restaurant',
      'food establishment',
      'eating house',
      'cafe',
      'canteen',
      'food premises'
    ];

    const licenseType = license.type_of_licence?.toLowerCase() || '';
    const isRestaurant = restaurantTypes.some(type => licenseType.includes(type));
    // this.logger.debug(`License ${license.licence_no} type "${licenseType}" is restaurant: ${isRestaurant}`);
    return isRestaurant;
  }

  /**
   * Check if license is currently active
   */
  private isActiveLicense(license: GovHKLicenseData): boolean {
    const status = license.licence_status?.toLowerCase() || '';
    
    this.logger.debug(`Checking license ${license.licence_no} status: "${status}"`);
    
    // Check for expired status first
    if (status.includes('expired') || status.includes('cancelled') || status.includes('revoked')) {
      this.logger.debug(`License ${license.licence_no} is inactive due to status`);
      return false;
    }
    
    const activeStatuses = ['active', 'valid', 'current'];
    
    // Check status
    const hasActiveStatus = activeStatuses.some(s => status.includes(s));
    this.logger.debug(`License ${license.licence_no} has active status: ${hasActiveStatus} (status: "${status}")`);
    
    if (!hasActiveStatus) {
      // If status is not explicitly inactive and not in active list, check expiry date
      if (license.expiry_date) {
        const expiryDate = this.parseDate(license.expiry_date);
        this.logger.debug(`License ${license.licence_no} expiry date: ${expiryDate}`);
        if (expiryDate && expiryDate < new Date()) {
          this.logger.debug(`License ${license.licence_no} is expired`);
          return false;
        }
        // If not expired, consider it active
        this.logger.debug(`License ${license.licence_no} is active (not expired)`);
        return true;
      }
      // If no expiry date and status is unclear, be conservative
      this.logger.debug(`License ${license.licence_no} status unclear, marking inactive`);
      return false;
    }

    // Check expiry date if available
    if (license.expiry_date) {
      const expiryDate = this.parseDate(license.expiry_date);
      if (expiryDate && expiryDate < new Date()) {
        this.logger.debug(`License ${license.licence_no} is expired despite active status`);
        return false;
      }
    }

    this.logger.debug(`License ${license.licence_no} is active`);
    return true;
  }

  /**
   * Calculate health score from inspection data
   */
  private calculateHealthScore(inspections: GovHKInspectionData[]): number {
    if (inspections.length === 0) {
      return 0.8; // Default score when no inspection data
    }

    // Get recent inspections (last 2 years)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const recentInspections = inspections.filter(inspection => {
      const inspectionDate = this.parseDate(inspection.inspection_date);
      return inspectionDate && inspectionDate >= twoYearsAgo;
    });

    if (recentInspections.length === 0) {
      return 0.7; // Lower score for old inspection data
    }

    // Calculate average score
    let totalScore = 0;
    let validScores = 0;

    for (const inspection of recentInspections) {
      if (inspection.score) {
        const score = parseFloat(inspection.score);
        if (!isNaN(score)) {
          totalScore += score / 100; // Normalize to 0-1 scale
          validScores++;
        }
      } else {
        // Infer score from result
        const result = inspection.inspection_result?.toLowerCase() || '';
        if (result.includes('satisfactory') || result.includes('pass')) {
          totalScore += 0.85;
          validScores++;
        } else if (result.includes('unsatisfactory') || result.includes('fail')) {
          totalScore += 0.35;
          validScores++;
        }
      }
    }

    return validScores > 0 ? totalScore / validScores : 0.7;
  }

  /**
   * Convert health score to restaurant rating (1-5 scale)
   */
  private convertHealthScoreToRating(healthScore: number): number {
    // Convert 0-1 health score to 1-5 rating scale
    // Government health scores are more conservative, so we adjust the scale
    if (healthScore >= 0.9) return 5.0;
    if (healthScore >= 0.8) return 4.5;
    if (healthScore >= 0.75) return 4.0;
    if (healthScore >= 0.65) return 3.5;
    if (healthScore >= 0.5) return 3.0;
    if (healthScore >= 0.4) return 2.5;
    return 2.0;
  }

  /**
   * Infer cuisine type from restaurant name
   */
  private inferCuisineFromName(name: string): string[] {
    const nameLC = name.toLowerCase();
    const cuisineKeywords = {
      'Chinese': ['chinese', 'dim sum', 'tea house', 'noodle', 'dumpling', 'wonton'],
      'Cantonese': ['cantonese', 'yum cha', 'char siu'],
      'Japanese': ['japanese', 'sushi', 'ramen', 'yakitori', 'tempura'],
      'Korean': ['korean', 'bbq', 'kimchi', 'bulgogi'],
      'Thai': ['thai', 'pad thai', 'tom yum'],
      'Vietnamese': ['vietnamese', 'pho', 'banh mi'],
      'Indian': ['indian', 'curry', 'tandoor', 'biryani'],
      'Western': ['western', 'steak', 'burger', 'pizza', 'pasta'],
      'Italian': ['italian', 'pizza', 'pasta', 'risotto'],
      'Fast Food': ['fast food', 'quick service', 'takeaway'],
      'Cafe': ['cafe', 'coffee', 'bakery', 'dessert']
    };

    const matchedCuisines: string[] = [];
    
    for (const [cuisine, keywords] of Object.entries(cuisineKeywords)) {
      if (keywords.some(keyword => nameLC.includes(keyword))) {
        matchedCuisines.push(cuisine);
      }
    }

    // Default to Chinese if no specific cuisine detected (common in HK)
    return matchedCuisines.length > 0 ? matchedCuisines : ['Chinese'];
  }

  /**
   * Extract features from license data
   */
  private extractFeaturesFromLicense(license: GovHKLicenseData): string[] {
    const features: string[] = [];
    
    // Add government verification as a feature
    features.push('Government Licensed');
    
    // Infer features from license type
    const licenseType = license.type_of_licence?.toLowerCase() || '';
    
    if (licenseType.includes('liquor')) {
      features.push('Alcohol License');
    }
    
    if (licenseType.includes('outdoor')) {
      features.push('Outdoor Seating');
    }
    
    if (licenseType.includes('catering')) {
      features.push('Catering Services');
    }

    return features;
  }

  /**
   * Calculate data quality for government data
   */
  private calculateGovernmentDataQuality(license: GovHKLicenseData, hasCoordinates: boolean): number {
    let score = 0.9; // Start high for government data

    // Check completeness
    if (!license.name_of_premises) score -= 0.2;
    if (!license.address_of_premises) score -= 0.2;
    if (!hasCoordinates) score -= 0.1;
    if (!license.district) score -= 0.05;
    if (!license.type_of_licence) score -= 0.05;

    // Check data freshness
    const issueDate = this.parseDate(license.issue_date);
    if (issueDate) {
      const daysSinceIssue = (Date.now() - issueDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceIssue > 365) score -= 0.1; // Older licenses might have outdated info
    }

    return Math.max(0.5, score); // Minimum score for government data
  }

  /**
   * Parse date string in various formats
   */
  private parseDate(dateStr?: string): Date | null {
    if (!dateStr) return null;

    try {
      // Handle DD/MM/YYYY format specifically
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const [day, month, year] = dateStr.split('/');
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          return date;
        }
      }

      // Handle YYYY/MM/DD format
      if (/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) {
        const [year, month, day] = dateStr.split('/');
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          return date;
        }
      }

      // Handle YYYY-MM-DD format (ISO format)
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const date = new Date(dateStr + 'T00:00:00.000Z');
        if (!isNaN(date.getTime())) {
          return date;
        }
      }

      // Fallback to direct parsing
      const date = new Date(dateStr);
      return !isNaN(date.getTime()) ? date : null;

    } catch (error) {
      this.logger.debug(`Failed to parse date: ${dateStr}`);
      return null;
    }
  }

  /**
   * Verify restaurant license with government database
   */
  async verifyRestaurantLicense(licenseNo: string): Promise<{
    isValid: boolean;
    status: string;
    expiryDate?: Date;
    violations: string[];
  }> {
    try {
      const restaurant = await this.extractRestaurantById(licenseNo);
      
      if (!restaurant) {
        return {
          isValid: false,
          status: 'Not Found',
          violations: []
        };
      }

      // Get inspection data for violations
      const inspectionData = await this.extractInspectionData({ licence_no: licenseNo });
      const violations = inspectionData
        .filter(inspection => inspection.violations)
        .map(inspection => inspection.violations)
        .filter(violation => violation.trim().length > 0);

      return {
        isValid: true,
        status: 'Active',
        violations: [...new Set(violations)] // Remove duplicates
      };

    } catch (error) {
      this.logger.error(`Failed to verify license ${licenseNo}:`, error);
      return {
        isValid: false,
        status: 'Verification Failed',
        violations: []
      };
    }
  }

  /**
   * Get health inspection scores for restaurants
   */
  async getHealthInspectionScores(licenseNumbers: string[]): Promise<Record<string, {
    score: number;
    lastInspection: Date;
    violations: string[];
  }>> {
    const results: Record<string, any> = {};

    try {
      for (const licenseNo of licenseNumbers) {
        const inspectionData = await this.extractInspectionData({ licence_no: licenseNo });
        
        if (inspectionData.length > 0) {
          // Get most recent inspection
          const sortedInspections = inspectionData.sort((a, b) => {
            const dateA = this.parseDate(a.inspection_date);
            const dateB = this.parseDate(b.inspection_date);
            return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
          });

          const latestInspection = sortedInspections[0];
          const score = this.calculateHealthScore([latestInspection]);
          const violations = inspectionData
            .map(inspection => inspection.violations)
            .filter(violation => violation && violation.trim().length > 0);

          results[licenseNo] = {
            score,
            lastInspection: this.parseDate(latestInspection.inspection_date) || new Date(),
            violations: [...new Set(violations)]
          };
        }
      }

      return results;

    } catch (error) {
      this.logger.error('Failed to get health inspection scores:', error);
      return {};
    }
  }
}