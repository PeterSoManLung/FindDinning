import { Analytics } from '@aws-amplify/analytics';
import { Amplify } from 'aws-amplify';
import awsconfig from '../aws-exports';

// Initialize Amplify with configuration
Amplify.configure(awsconfig);

export interface AnalyticsEvent {
  name: string;
  attributes?: Record<string, string>;
  metrics?: Record<string, number>;
}

export interface UserBehaviorEvent {
  screen: string;
  action: string;
  category?: string;
  value?: number;
  userId?: string;
  sessionId?: string;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp?: number;
  additionalData?: Record<string, any>;
}

class AnalyticsService {
  private sessionId: string;
  private userId?: string;
  private sessionStartTime: number;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
    this.initializeSession();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private initializeSession(): void {
    this.recordEvent({
      name: 'session_start',
      attributes: {
        sessionId: this.sessionId,
        platform: 'mobile',
        timestamp: new Date().toISOString()
      }
    });
  }

  setUserId(userId: string): void {
    this.userId = userId;
    Analytics.updateEndpoint({
      userId,
      userAttributes: {
        userId: [userId]
      }
    });
  }

  recordEvent(event: AnalyticsEvent): void {
    try {
      const enhancedEvent = {
        ...event,
        attributes: {
          ...event.attributes,
          sessionId: this.sessionId,
          userId: this.userId || 'anonymous',
          timestamp: new Date().toISOString()
        }
      };

      Analytics.record(enhancedEvent);
      console.log('Analytics event recorded:', enhancedEvent.name);
    } catch (error) {
      console.error('Failed to record analytics event:', error);
    }
  }

  recordUserBehavior(event: UserBehaviorEvent): void {
    this.recordEvent({
      name: 'user_behavior',
      attributes: {
        screen: event.screen,
        action: event.action,
        category: event.category || 'general',
        userId: event.userId || this.userId || 'anonymous',
        sessionId: event.sessionId || this.sessionId
      },
      metrics: {
        value: event.value || 1
      }
    });
  }

  recordPerformanceMetric(metric: PerformanceMetric): void {
    this.recordEvent({
      name: 'performance_metric',
      attributes: {
        metricName: metric.name,
        unit: metric.unit,
        timestamp: (metric.timestamp || Date.now()).toString(),
        ...metric.additionalData
      },
      metrics: {
        value: metric.value
      }
    });
  }

  recordScreenView(screenName: string, additionalData?: Record<string, string>): void {
    this.recordEvent({
      name: 'screen_view',
      attributes: {
        screen_name: screenName,
        ...additionalData
      }
    });
  }

  recordRecommendationInteraction(action: string, restaurantId: string, recommendationId?: string): void {
    this.recordEvent({
      name: 'recommendation_interaction',
      attributes: {
        action,
        restaurant_id: restaurantId,
        recommendation_id: recommendationId || 'unknown'
      }
    });
  }

  recordSearchEvent(query: string, filters: Record<string, any>, resultCount: number): void {
    this.recordEvent({
      name: 'search_performed',
      attributes: {
        query,
        filters: JSON.stringify(filters)
      },
      metrics: {
        result_count: resultCount
      }
    });
  }

  recordError(error: Error, context?: string): void {
    this.recordEvent({
      name: 'app_error',
      attributes: {
        error_message: error.message,
        error_stack: error.stack || 'No stack trace',
        context: context || 'unknown',
        error_name: error.name
      }
    });
  }

  recordAppLaunch(launchTime: number): void {
    this.recordEvent({
      name: 'app_launch',
      attributes: {
        launch_type: 'cold_start'
      },
      metrics: {
        launch_time_ms: launchTime
      }
    });
  }

  recordRecommendationGeneration(duration: number, count: number, emotionalContext?: string): void {
    this.recordEvent({
      name: 'recommendation_generated',
      attributes: {
        emotional_context: emotionalContext || 'none'
      },
      metrics: {
        generation_time_ms: duration,
        recommendation_count: count
      }
    });
  }

  endSession(): void {
    const sessionDuration = Date.now() - this.sessionStartTime;
    this.recordEvent({
      name: 'session_end',
      attributes: {
        sessionId: this.sessionId
      },
      metrics: {
        session_duration_ms: sessionDuration
      }
    });
  }

  // Flush pending events (useful before app backgrounding)
  async flushEvents(): Promise<void> {
    try {
      await Analytics.flushEvents();
      console.log('Analytics events flushed successfully');
    } catch (error) {
      console.error('Failed to flush analytics events:', error);
    }
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;