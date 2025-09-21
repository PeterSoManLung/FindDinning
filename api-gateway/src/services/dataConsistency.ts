import { ServiceClient } from './serviceClient';
import { TransactionManager, TransactionStep } from './transactionManager';
import { ApiError } from '../middleware/errorHandler';
import { ErrorCode, HttpStatusCode } from 'shared/src/types/api.types';

export interface ConsistencyRule {
  name: string;
  description: string;
  services: string[];
  validator: (data: any) => Promise<boolean>;
  resolver: (data: any, requestId?: string) => Promise<void>;
}

export interface DataSyncOperation {
  sourceService: string;
  targetServices: string[];
  dataPath: string;
  syncPath: string;
  transformData?: (data: any) => any;
}

export class DataConsistencyManager {
  private static instance: DataConsistencyManager;
  private serviceClient: ServiceClient;
  private transactionManager: TransactionManager;
  private consistencyRules: Map<string, ConsistencyRule> = new Map();

  private constructor() {
    this.serviceClient = ServiceClient.getInstance();
    this.transactionManager = TransactionManager.getInstance();
    this.initializeConsistencyRules();
  }

  public static getInstance(): DataConsistencyManager {
    if (!DataConsistencyManager.instance) {
      DataConsistencyManager.instance = new DataConsistencyManager();
    }
    return DataConsistencyManager.instance;
  }

  private initializeConsistencyRules(): void {
    // User profile consistency across services
    this.addConsistencyRule({
      name: 'user-profile-consistency',
      description: 'Ensure user profile data is consistent across all services',
      services: ['USER_SERVICE', 'RECOMMENDATION_ENGINE', 'REVIEW_SERVICE'],
      validator: async (userData: any) => {
        // Validate user data structure and required fields
        return userData && userData.id && userData.email && userData.preferences;
      },
      resolver: async (userData: any, requestId?: string) => {
        const steps: TransactionStep[] = [
          {
            serviceKey: 'RECOMMENDATION_ENGINE',
            operation: 'update',
            path: `/users/${userData.id}/profile`,
            data: { preferences: userData.preferences },
            compensationPath: `/users/${userData.id}/profile`,
            compensationData: userData.previousPreferences
          },
          {
            serviceKey: 'REVIEW_SERVICE',
            operation: 'update',
            path: `/users/${userData.id}/profile`,
            data: { name: userData.name, email: userData.email },
            compensationPath: `/users/${userData.id}/profile`,
            compensationData: { name: userData.previousName, email: userData.previousEmail }
          }
        ];

        await this.transactionManager.executeTransaction(steps, requestId);
      }
    });

    // Restaurant data consistency
    this.addConsistencyRule({
      name: 'restaurant-data-consistency',
      description: 'Ensure restaurant data is consistent across services',
      services: ['RESTAURANT_SERVICE', 'RECOMMENDATION_ENGINE', 'REVIEW_SERVICE'],
      validator: async (restaurantData: any) => {
        return restaurantData && restaurantData.id && restaurantData.name && restaurantData.location;
      },
      resolver: async (restaurantData: any, requestId?: string) => {
        const steps: TransactionStep[] = [
          {
            serviceKey: 'RECOMMENDATION_ENGINE',
            operation: 'update',
            path: `/restaurants/${restaurantData.id}`,
            data: restaurantData,
            compensationPath: `/restaurants/${restaurantData.id}`,
            compensationData: restaurantData.previousData
          },
          {
            serviceKey: 'REVIEW_SERVICE',
            operation: 'update',
            path: `/restaurants/${restaurantData.id}`,
            data: {
              name: restaurantData.name,
              location: restaurantData.location,
              cuisineType: restaurantData.cuisineType
            },
            compensationPath: `/restaurants/${restaurantData.id}`,
            compensationData: restaurantData.previousData
          }
        ];

        await this.transactionManager.executeTransaction(steps, requestId);
      }
    });

    // Review aggregation consistency
    this.addConsistencyRule({
      name: 'review-aggregation-consistency',
      description: 'Ensure review aggregations are consistent across services',
      services: ['REVIEW_SERVICE', 'RESTAURANT_SERVICE', 'RECOMMENDATION_ENGINE'],
      validator: async (reviewData: any) => {
        return reviewData && reviewData.restaurantId && reviewData.rating;
      },
      resolver: async (reviewData: any, requestId?: string) => {
        // Update restaurant rating and review count
        const steps: TransactionStep[] = [
          {
            serviceKey: 'RESTAURANT_SERVICE',
            operation: 'update',
            path: `/restaurants/${reviewData.restaurantId}/rating`,
            data: { 
              rating: reviewData.newAverageRating,
              reviewCount: reviewData.newReviewCount,
              negativeScore: reviewData.newNegativeScore
            },
            compensationPath: `/restaurants/${reviewData.restaurantId}/rating`,
            compensationData: {
              rating: reviewData.previousAverageRating,
              reviewCount: reviewData.previousReviewCount,
              negativeScore: reviewData.previousNegativeScore
            }
          },
          {
            serviceKey: 'RECOMMENDATION_ENGINE',
            operation: 'update',
            path: `/restaurants/${reviewData.restaurantId}/metrics`,
            data: {
              rating: reviewData.newAverageRating,
              negativeScore: reviewData.newNegativeScore,
              lastUpdated: new Date().toISOString()
            },
            compensationPath: `/restaurants/${reviewData.restaurantId}/metrics`,
            compensationData: {
              rating: reviewData.previousAverageRating,
              negativeScore: reviewData.previousNegativeScore,
              lastUpdated: reviewData.previousLastUpdated
            }
          }
        ];

        await this.transactionManager.executeTransaction(steps, requestId);
      }
    });
  }

  public addConsistencyRule(rule: ConsistencyRule): void {
    this.consistencyRules.set(rule.name, rule);
  }

  public async enforceConsistency(
    ruleName: string,
    data: any,
    requestId?: string
  ): Promise<void> {
    const rule = this.consistencyRules.get(ruleName);
    if (!rule) {
      throw new ApiError(
        HttpStatusCode.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
        `Consistency rule not found: ${ruleName}`
      );
    }

    const isValid = await rule.validator(data);
    if (!isValid) {
      throw new ApiError(
        HttpStatusCode.BAD_REQUEST,
        ErrorCode.DATA_QUALITY_ERROR,
        `Data validation failed for consistency rule: ${ruleName}`
      );
    }

    try {
      await rule.resolver(data, requestId);
    } catch (error) {
      throw new ApiError(
        HttpStatusCode.INTERNAL_SERVER_ERROR,
        ErrorCode.DATA_SYNC_ERROR,
        `Failed to enforce consistency rule: ${ruleName}`,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  public async syncData(
    operation: DataSyncOperation,
    requestId?: string
  ): Promise<void> {
    try {
      // Get data from source service
      const sourceResponse = await this.serviceClient.get(
        operation.sourceService,
        operation.dataPath,
        requestId
      );

      let dataToSync = sourceResponse.data;
      
      // Transform data if transformer is provided
      if (operation.transformData) {
        dataToSync = operation.transformData(dataToSync);
      }

      // Sync to all target services
      const syncSteps: TransactionStep[] = operation.targetServices.map(serviceKey => ({
        serviceKey,
        operation: 'update' as const,
        path: operation.syncPath,
        data: dataToSync
      }));

      const result = await this.transactionManager.executeTransaction(syncSteps, requestId);
      
      if (!result.success) {
        throw new ApiError(
          HttpStatusCode.INTERNAL_SERVER_ERROR,
          ErrorCode.DATA_SYNC_ERROR,
          'Data synchronization failed',
          { errors: result.errors.map(e => e.message) }
        );
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        HttpStatusCode.INTERNAL_SERVER_ERROR,
        ErrorCode.DATA_SYNC_ERROR,
        'Failed to sync data across services',
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // Eventual consistency checker
  public async checkConsistency(
    ruleName: string,
    requestId?: string
  ): Promise<{ consistent: boolean; issues: string[] }> {
    const rule = this.consistencyRules.get(ruleName);
    if (!rule) {
      throw new ApiError(
        HttpStatusCode.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
        `Consistency rule not found: ${ruleName}`
      );
    }

    const issues: string[] = [];

    try {
      // This would typically involve checking data across services
      // For now, we'll return a basic implementation
      return {
        consistent: true,
        issues: []
      };
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
      return {
        consistent: false,
        issues
      };
    }
  }

  // Get all consistency rules
  public getConsistencyRules(): ConsistencyRule[] {
    return Array.from(this.consistencyRules.values());
  }

  // Remove a consistency rule
  public removeConsistencyRule(ruleName: string): boolean {
    return this.consistencyRules.delete(ruleName);
  }
}