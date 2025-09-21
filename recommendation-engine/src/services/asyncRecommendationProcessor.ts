import { EventEmitter } from 'events';
import { RecommendationQuery, RecommendationCacheService } from './recommendationCacheService';
import { Recommendation, RecommendedRestaurant } from '@find-dining/shared/types/recommendation.types';
import { UserPreferences } from '@find-dining/shared/types/user.types';

export interface RecommendationJob {
  id: string;
  userId: string;
  query: RecommendationQuery;
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: Recommendation;
  error?: string;
}

export interface RecommendationProcessorConfig {
  maxConcurrentJobs: number;
  jobTimeoutMs: number;
  retryAttempts: number;
  priorityWeights: {
    high: number;
    medium: number;
    low: number;
  };
}

export class AsyncRecommendationProcessor extends EventEmitter {
  private jobs: Map<string, RecommendationJob> = new Map();
  private processingQueue: RecommendationJob[] = [];
  private activeJobs: Set<string> = new Set();
  private config: RecommendationProcessorConfig;

  constructor(
    private cacheService: RecommendationCacheService,
    config?: Partial<RecommendationProcessorConfig>
  ) {
    super();
    
    this.config = {
      maxConcurrentJobs: 10,
      jobTimeoutMs: 30000, // 30 seconds
      retryAttempts: 3,
      priorityWeights: {
        high: 3,
        medium: 2,
        low: 1
      },
      ...config
    };

    // Start processing jobs
    this.startProcessing();
  }

  async queueRecommendationJob(
    userId: string,
    query: RecommendationQuery,
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<string> {
    const jobId = `${userId}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    
    const job: RecommendationJob = {
      id: jobId,
      userId,
      query,
      priority,
      createdAt: new Date(),
      status: 'pending'
    };

    this.jobs.set(jobId, job);
    this.addToQueue(job);
    
    this.emit('jobQueued', job);
    
    return jobId;
  }

  async getJobStatus(jobId: string): Promise<RecommendationJob | null> {
    return this.jobs.get(jobId) || null;
  }

  async getJobResult(jobId: string): Promise<Recommendation | null> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'completed') {
      return null;
    }
    return job.result || null;
  }

  async waitForJob(jobId: string, timeoutMs: number = 30000): Promise<Recommendation> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Job ${jobId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const checkJob = () => {
        const job = this.jobs.get(jobId);
        if (!job) {
          clearTimeout(timeout);
          reject(new Error(`Job ${jobId} not found`));
          return;
        }

        if (job.status === 'completed' && job.result) {
          clearTimeout(timeout);
          resolve(job.result);
        } else if (job.status === 'failed') {
          clearTimeout(timeout);
          reject(new Error(job.error || 'Job failed'));
        } else {
          // Check again in 100ms
          setTimeout(checkJob, 100);
        }
      };

      checkJob();
    });
  }

  private addToQueue(job: RecommendationJob): void {
    // Insert job based on priority
    const weight = this.config.priorityWeights[job.priority];
    let insertIndex = this.processingQueue.length;
    
    for (let i = 0; i < this.processingQueue.length; i++) {
      const existingWeight = this.config.priorityWeights[this.processingQueue[i].priority];
      if (weight > existingWeight) {
        insertIndex = i;
        break;
      }
    }
    
    this.processingQueue.splice(insertIndex, 0, job);
  }

  private startProcessing(): void {
    setInterval(() => {
      this.processNextJobs();
    }, 100); // Check every 100ms
  }

  private async processNextJobs(): Promise<void> {
    const availableSlots = this.config.maxConcurrentJobs - this.activeJobs.size;
    
    if (availableSlots <= 0 || this.processingQueue.length === 0) {
      return;
    }

    const jobsToProcess = this.processingQueue.splice(0, availableSlots);
    
    for (const job of jobsToProcess) {
      this.processJob(job);
    }
  }

  private async processJob(job: RecommendationJob): Promise<void> {
    this.activeJobs.add(job.id);
    job.status = 'processing';
    
    this.emit('jobStarted', job);

    try {
      const timeout = setTimeout(() => {
        throw new Error(`Job ${job.id} timed out`);
      }, this.config.jobTimeoutMs);

      // Check cache first
      const cachedResult = await this.cacheService.getRecommendations(job.query);
      if (cachedResult) {
        job.result = cachedResult;
        job.status = 'completed';
        clearTimeout(timeout);
        this.completeJob(job);
        return;
      }

      // Generate recommendations asynchronously
      const result = await this.generateRecommendations(job.query);
      
      clearTimeout(timeout);
      
      // Cache the result
      await this.cacheService.setRecommendations(job.query, result);
      
      job.result = result;
      job.status = 'completed';
      
      this.completeJob(job);
      
    } catch (error) {
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.status = 'failed';
      
      this.emit('jobFailed', job, error);
      this.completeJob(job);
    }
  }

  private completeJob(job: RecommendationJob): void {
    this.activeJobs.delete(job.id);
    
    if (job.status === 'completed') {
      this.emit('jobCompleted', job);
    }
    
    // Clean up old jobs (keep for 1 hour)
    setTimeout(() => {
      this.jobs.delete(job.id);
    }, 3600000);
  }

  private async generateRecommendations(query: RecommendationQuery): Promise<Recommendation> {
    // This would integrate with the actual recommendation generation logic
    // For now, we'll simulate the process
    
    const startTime = Date.now();
    
    // Simulate complex recommendation calculation
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    
    const mockRecommendation: Recommendation = {
      id: `rec-${Date.now()}`,
      userId: query.userId,
      restaurants: [], // Would be populated by actual recommendation logic
      emotionalContext: query.emotionalState || 'neutral',
      generatedAt: new Date(),
      confidence: 0.85,
      reasoning: 'Generated through async processing'
    };
    
    const processingTime = Date.now() - startTime;
    this.emit('recommendationGenerated', {
      userId: query.userId,
      processingTime,
      recommendationCount: mockRecommendation.restaurants.length
    });
    
    return mockRecommendation;
  }

  // Precomputation methods for frequent users
  async precomputeRecommendations(userId: string, scenarios: string[]): Promise<void> {
    const jobs = scenarios.map(scenario => {
      const query: RecommendationQuery = {
        userId,
        emotionalState: scenario,
        limit: 10
      };
      
      return this.queueRecommendationJob(userId, query, 'low');
    });

    // Wait for all precomputation jobs to complete
    await Promise.allSettled(
      jobs.map(jobId => this.waitForJob(jobId, 60000))
    );
  }

  async precomputeForFrequentUsers(userIds: string[]): Promise<void> {
    const commonScenarios = ['happy', 'sad', 'celebrating', 'stressed', 'neutral'];
    
    const precomputationPromises = userIds.map(userId => 
      this.precomputeRecommendations(userId, commonScenarios)
    );

    await Promise.allSettled(precomputationPromises);
    
    this.emit('precomputationCompleted', {
      userCount: userIds.length,
      scenarioCount: commonScenarios.length
    });
  }

  getQueueStats(): {
    queueLength: number;
    activeJobs: number;
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
  } {
    const allJobs = Array.from(this.jobs.values());
    
    return {
      queueLength: this.processingQueue.length,
      activeJobs: this.activeJobs.size,
      totalJobs: allJobs.length,
      completedJobs: allJobs.filter(job => job.status === 'completed').length,
      failedJobs: allJobs.filter(job => job.status === 'failed').length
    };
  }
}