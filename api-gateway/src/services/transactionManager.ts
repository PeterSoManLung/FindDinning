import { ServiceClient } from './serviceClient';
import { ApiError } from '../middleware/errorHandler';
import { ErrorCode, HttpStatusCode } from 'shared/src/types/api.types';
import { v4 as uuidv4 } from 'uuid';

export interface TransactionStep {
  serviceKey: string;
  operation: 'create' | 'update' | 'delete';
  path: string;
  data?: any;
  compensationPath?: string;
  compensationData?: any;
}

export interface TransactionResult {
  success: boolean;
  results: any[];
  errors: Error[];
  compensated: boolean;
}

export class TransactionManager {
  private static instance: TransactionManager;
  private serviceClient: ServiceClient;
  private activeTransactions: Map<string, TransactionStep[]> = new Map();

  private constructor() {
    this.serviceClient = ServiceClient.getInstance();
  }

  public static getInstance(): TransactionManager {
    if (!TransactionManager.instance) {
      TransactionManager.instance = new TransactionManager();
    }
    return TransactionManager.instance;
  }

  public async executeTransaction(
    steps: TransactionStep[],
    requestId?: string
  ): Promise<TransactionResult> {
    const transactionId = uuidv4();
    const executedSteps: TransactionStep[] = [];
    const results: any[] = [];
    const errors: Error[] = [];

    try {
      // Store transaction for potential compensation
      this.activeTransactions.set(transactionId, []);

      // Execute each step
      for (const step of steps) {
        try {
          const result = await this.executeStep(step, requestId);
          results.push(result);
          executedSteps.push(step);
          this.activeTransactions.get(transactionId)?.push(step);
        } catch (error) {
          errors.push(error instanceof Error ? error : new Error(String(error)));
          
          // If a step fails, compensate all executed steps
          const compensated = await this.compensateTransaction(executedSteps, requestId);
          
          this.activeTransactions.delete(transactionId);
          
          return {
            success: false,
            results,
            errors,
            compensated
          };
        }
      }

      // All steps succeeded
      this.activeTransactions.delete(transactionId);
      
      return {
        success: true,
        results,
        errors: [],
        compensated: false
      };
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
      
      // Attempt compensation
      const compensated = await this.compensateTransaction(executedSteps, requestId);
      
      this.activeTransactions.delete(transactionId);
      
      return {
        success: false,
        results,
        errors,
        compensated
      };
    }
  }

  private async executeStep(step: TransactionStep, requestId?: string): Promise<any> {
    switch (step.operation) {
      case 'create':
        return await this.serviceClient.post(
          step.serviceKey,
          step.path,
          step.data,
          requestId
        );
      
      case 'update':
        return await this.serviceClient.put(
          step.serviceKey,
          step.path,
          step.data,
          requestId
        );
      
      case 'delete':
        return await this.serviceClient.delete(
          step.serviceKey,
          step.path,
          requestId
        );
      
      default:
        throw new ApiError(
          HttpStatusCode.BAD_REQUEST,
          ErrorCode.VALIDATION_ERROR,
          `Unsupported transaction operation: ${step.operation}`
        );
    }
  }

  private async compensateTransaction(
    executedSteps: TransactionStep[],
    requestId?: string
  ): Promise<boolean> {
    let allCompensated = true;

    // Execute compensation in reverse order
    for (let i = executedSteps.length - 1; i >= 0; i--) {
      const step = executedSteps[i];
      
      try {
        await this.compensateStep(step, requestId);
      } catch (error) {
        console.error(`Failed to compensate step ${i}:`, error);
        allCompensated = false;
      }
    }

    return allCompensated;
  }

  private async compensateStep(step: TransactionStep, requestId?: string): Promise<void> {
    if (!step.compensationPath) {
      // No compensation defined, skip
      return;
    }

    try {
      switch (step.operation) {
        case 'create':
          // Compensate create with delete
          await this.serviceClient.delete(
            step.serviceKey,
            step.compensationPath,
            requestId
          );
          break;
        
        case 'update':
          // Compensate update with restore
          if (step.compensationData) {
            await this.serviceClient.put(
              step.serviceKey,
              step.compensationPath,
              step.compensationData,
              requestId
            );
          }
          break;
        
        case 'delete':
          // Compensate delete with recreate
          if (step.compensationData) {
            await this.serviceClient.post(
              step.serviceKey,
              step.compensationPath,
              step.compensationData,
              requestId
            );
          }
          break;
      }
    } catch (error) {
      console.error(`Compensation failed for step:`, step, error);
      throw error;
    }
  }

  // Saga pattern implementation for complex workflows
  public async executeSaga(
    steps: TransactionStep[],
    requestId?: string
  ): Promise<TransactionResult> {
    return this.executeTransaction(steps, requestId);
  }

  // Get active transactions (for monitoring)
  public getActiveTransactions(): Map<string, TransactionStep[]> {
    return new Map(this.activeTransactions);
  }

  // Force compensation of a transaction (for emergency scenarios)
  public async forceCompensation(
    transactionId: string,
    requestId?: string
  ): Promise<boolean> {
    const steps = this.activeTransactions.get(transactionId);
    if (!steps) {
      return false;
    }

    const compensated = await this.compensateTransaction(steps, requestId);
    this.activeTransactions.delete(transactionId);
    
    return compensated;
  }
}