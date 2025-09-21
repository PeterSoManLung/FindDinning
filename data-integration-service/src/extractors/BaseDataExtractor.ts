import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { DataSource, RawRestaurantData, DataExtractionResult } from '../types/dataSource.types';
import { Logger } from 'winston';
import { createLogger } from '../utils/logger';

export abstract class BaseDataExtractor {
  protected dataSource: DataSource;
  protected httpClient: AxiosInstance;
  protected logger: Logger;
  protected lastRequestTime: number = 0;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
    this.logger = createLogger(`${dataSource.name}Extractor`);
    
    this.httpClient = axios.create({
      baseURL: dataSource.baseUrl,
      timeout: dataSource.timeout,
      headers: {
        'User-Agent': 'FindDining-DataIntegration/1.0',
        ...dataSource.headers
      }
    });

    this.setupAuthentication();
    this.setupInterceptors();
  }

  /**
   * Extract restaurant data from the source
   */
  abstract extractRestaurantData(params?: any): Promise<DataExtractionResult>;

  /**
   * Extract specific restaurant by external ID
   */
  abstract extractRestaurantById(externalId: string): Promise<RawRestaurantData | null>;

  /**
   * Extract incremental data since a specific date (optional)
   * If not implemented, falls back to full extraction
   */
  extractIncremental?(since: Date): Promise<DataExtractionResult>;

  /**
   * Check if the data source is available and responsive
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/');
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      this.logger.error(`Health check failed for ${this.dataSource.name}:`, error);
      return false;
    }
  }

  /**
   * Rate limiting implementation
   */
  protected async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.dataSource.rateLimitMs) {
      const waitTime = this.dataSource.rateLimitMs - timeSinceLastRequest;
      this.logger.debug(`Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Make HTTP request with retry logic
   */
  protected async makeRequest<T>(config: AxiosRequestConfig, retries: number = 0): Promise<T> {
    await this.enforceRateLimit();

    try {
      const response = await this.httpClient.request<T>(config);
      return response.data;
    } catch (error: any) {
      this.logger.warn(`Request failed (attempt ${retries + 1}):`, error.message);

      if (retries < this.dataSource.maxRetries) {
        const backoffDelay = Math.pow(2, retries) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        return this.makeRequest<T>(config, retries + 1);
      }

      throw error;
    }
  }

  /**
   * Setup authentication based on configuration
   */
  private setupAuthentication(): void {
    if (!this.dataSource.authentication) return;

    const { type, credentials } = this.dataSource.authentication;

    switch (type) {
      case 'api_key':
        this.httpClient.defaults.headers.common['X-API-Key'] = credentials.apiKey;
        break;
      case 'bearer_token':
        this.httpClient.defaults.headers.common['Authorization'] = `Bearer ${credentials.token}`;
        break;
      case 'basic_auth':
        this.httpClient.defaults.auth = {
          username: credentials.username,
          password: credentials.password
        };
        break;
      // OAuth implementation would go here
    }
  }

  /**
   * Setup request/response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor for logging
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug(`Making request to: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and error handling
    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug(`Response received: ${response.status} ${response.statusText}`);
        return response;
      },
      (error) => {
        if (error.response) {
          this.logger.error(`HTTP Error: ${error.response.status} ${error.response.statusText}`);
        } else if (error.request) {
          this.logger.error('Network Error: No response received');
        } else {
          this.logger.error('Request Error:', error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Calculate data quality score based on completeness and accuracy
   */
  protected calculateDataQuality(data: RawRestaurantData): number {
    const requiredFields = ['name', 'address', 'latitude', 'longitude'];
    const optionalFields = ['cuisineType', 'priceRange', 'rating', 'phone', 'website'];
    
    let score = 0;
    let totalFields = requiredFields.length + optionalFields.length;

    // Check required fields (weighted more heavily)
    for (const field of requiredFields) {
      if (data[field as keyof RawRestaurantData]) {
        score += 2; // Required fields worth 2 points each
      }
      totalFields += 1; // Add extra weight for required fields
    }

    // Check optional fields
    for (const field of optionalFields) {
      if (data[field as keyof RawRestaurantData]) {
        score += 1; // Optional fields worth 1 point each
      }
    }

    return Math.min(score / totalFields, 1.0);
  }

  /**
   * Clean and normalize text data
   */
  protected cleanText(text: string): string {
    if (!text) return '';
    
    return text
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[^\w\s\-.,()]/g, '') // Remove special characters except basic punctuation
      .substring(0, 500); // Limit length
  }

  /**
   * Parse and validate coordinates
   */
  protected parseCoordinates(lat: any, lng: any): { latitude: number; longitude: number } | null {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return null;
    }

    // Basic validation for Hong Kong coordinates
    if (latitude < 22.1 || latitude > 22.6 || longitude < 113.8 || longitude > 114.5) {
      this.logger.warn(`Coordinates outside Hong Kong bounds: ${latitude}, ${longitude}`);
      return null;
    }

    return { latitude, longitude };
  }

  /**
   * Parse price range from various formats
   */
  protected parsePriceRange(priceText: string): number {
    if (!priceText) return 2; // Default to medium price range

    const priceStr = priceText.toLowerCase();
    
    if (priceStr.includes('$$$') || priceStr.includes('expensive') || priceStr.includes('high-end')) {
      return 4;
    } else if (priceStr.includes('$$') || priceStr.includes('moderate') || priceStr.includes('mid-range')) {
      return 3;
    } else if (priceStr.includes('$') || priceStr.includes('cheap') || priceStr.includes('budget')) {
      return 1;
    }

    return 2; // Default
  }
}