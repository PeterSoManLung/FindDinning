export interface DataSource {
  id: string;
  name: string;
  type: DataSourceType;
  baseUrl: string;
  isActive: boolean;
  rateLimitMs: number;
  maxRetries: number;
  timeout: number;
  headers?: Record<string, string>;
  authentication?: AuthenticationConfig;
}

export enum DataSourceType {
  API = 'api',
  WEB_SCRAPING = 'web_scraping',
  GOVERNMENT = 'government',
  SOCIAL = 'social'
}

export interface AuthenticationConfig {
  type: 'api_key' | 'bearer_token' | 'basic_auth' | 'oauth';
  credentials: Record<string, string>;
}

export interface RawRestaurantData {
  sourceId: string;
  externalId: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  cuisineType?: string[];
  priceRange?: number;
  rating?: number;
  reviewCount?: number;
  operatingHours?: Record<string, string>;
  phone?: string;
  website?: string;
  menuItems?: string[];
  features?: string[];
  photos?: string[];
  reviews?: RawReviewData[];
  lastUpdated: Date;
  dataQuality: number;
}

export interface RawReviewData {
  externalId: string;
  rating: number;
  content: string;
  authorName?: string;
  visitDate?: Date;
  photos?: string[];
  isVerified?: boolean;
  helpfulCount?: number;
  source: string;
}

export interface NormalizedRestaurantData {
  externalId: string;
  name: string;
  address: string;
  location: {
    latitude: number;
    longitude: number;
    district: string;
  };
  cuisineType: string[];
  priceRange: number;
  rating: number;
  reviewCount: number;
  operatingHours: Record<string, string>;
  contactInfo: {
    phone?: string;
    website?: string;
  };
  menuHighlights: string[];
  features: string[];
  photos: string[];
  reviews: NormalizedReviewData[];
  sourceMetadata: SourceMetadata;
  dataQuality: DataQualityScore;
}

export interface NormalizedReviewData {
  externalId: string;
  rating: number;
  content: string;
  authorName?: string;
  visitDate?: Date;
  photos: string[];
  isVerified: boolean;
  helpfulCount: number;
  sentimentScore: number;
  authenticityScore: number;
  negativeCategories: string[];
}

export interface SourceMetadata {
  sourceId: string;
  sourceName: string;
  extractedAt: Date;
  lastUpdated: Date;
  reliability: number;
  completeness: number;
}

export interface DataQualityScore {
  overall: number;
  completeness: number;
  accuracy: number;
  freshness: number;
  consistency: number;
}

export interface DataExtractionResult {
  success: boolean;
  data?: RawRestaurantData[];
  errors: string[];
  metadata: {
    totalExtracted: number;
    processingTime: number;
    sourceReliability: number;
  };
}

export interface DataValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  qualityScore: number;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'major' | 'minor';
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

// Additional enums and types for scheduled sync
export enum DataSourceEnum {
  HK_GOV = 'hk-gov',
  OPENRICE = 'openrice',
  TRIPADVISOR = 'tripadvisor',
  EATIGO = 'eatigo',
  CHOPE = 'chope',
  KEETA = 'keeta',
  FOODPANDA = 'foodpanda',
  BISTROCHAT = 'bistrochat'
}

export enum SyncStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  COMPLETED_WITH_ERRORS = 'completed_with_errors',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface SyncJob {
  id: string;
  name: string;
  sources: DataSourceEnum[];
  schedule: string;
  status: SyncStatus;
  lastRun?: Date;
  nextRun?: Date;
  enabled: boolean;
}

export interface ConflictResolution {
  recordId: string;
  source: DataSourceEnum;
  conflicts: string[];
  resolutions: Record<string, any>;
  timestamp: Date;
  status: 'pending' | 'auto-resolved' | 'manual-resolved';
}