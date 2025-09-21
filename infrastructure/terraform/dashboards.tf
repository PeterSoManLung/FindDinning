# Main System Health Dashboard
resource "aws_cloudwatch_dashboard" "system_health" {
  dashboard_name = "AI-Restaurant-Recommendation-System-Health"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", aws_ecs_cluster.main.name],
            [".", "MemoryUtilization", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "ECS Cluster Resource Utilization"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", aws_lb.main.arn_suffix],
            [".", "ResponseTime", ".", "."],
            [".", "HTTPCode_ELB_5XX_Count", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Load Balancer Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["AI-Restaurant-Recommendation", "RecommendationAccuracy", "Service", "recommendation-engine"],
            [".", "RecommendationLatency", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Recommendation Engine Performance"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 6
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["AI-Restaurant-Recommendation", "NegativeFeedbackAnalysisAccuracy", "Service", "review-service"],
            [".", "NegativeFeedbackAnalysisLatency", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Negative Feedback Analysis Performance"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 6
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["AI-Restaurant-Recommendation", "UserEngagement", "Service", "mobile-app"],
            [".", "SessionDuration", ".", "."],
            [".", "RecommendationClickRate", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "User Engagement Metrics"
          period  = 300
        }
      }
    ]
  })
}

# Business Metrics Dashboard
resource "aws_cloudwatch_dashboard" "business_metrics" {
  dashboard_name = "AI-Restaurant-Recommendation-Business-Metrics"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AI-Restaurant-Recommendation", "DailyActiveUsers", "Service", "user-service"],
            [".", "NewUserRegistrations", ".", "."],
            [".", "UserRetentionRate", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "User Metrics"
          period  = 3600
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AI-Restaurant-Recommendation", "RecommendationsGenerated", "Service", "recommendation-engine"],
            [".", "RecommendationsAccepted", ".", "."],
            [".", "RecommendationConversionRate", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Recommendation Metrics"
          period  = 3600
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AI-Restaurant-Recommendation", "RestaurantDataFreshness", "Service", "data-integration-service"],
            [".", "DataSyncSuccessRate", ".", "."],
            [".", "DataQualityScore", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Data Quality Metrics"
          period  = 3600
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AI-Restaurant-Recommendation", "NegativeFeedbackDetected", "Service", "review-service"],
            [".", "AuthenticityScore", ".", "."],
            [".", "ReviewProcessingRate", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Review Analysis Metrics"
          period  = 3600
        }
      }
    ]
  })
}

# Infrastructure Monitoring Dashboard
resource "aws_cloudwatch_dashboard" "infrastructure" {
  dashboard_name = "AI-Restaurant-Recommendation-Infrastructure"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", aws_db_instance.user_db.id],
            [".", "DatabaseConnections", ".", "."],
            [".", "ReadLatency", ".", "."],
            [".", "WriteLatency", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "User Database Performance"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 0
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", aws_db_instance.restaurant_db.id],
            [".", "DatabaseConnections", ".", "."],
            [".", "ReadLatency", ".", "."],
            [".", "WriteLatency", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Restaurant Database Performance"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 0
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["AWS/ElastiCache", "CPUUtilization", "CacheClusterId", aws_elasticache_cluster.redis.cluster_id],
            [".", "CacheHitRate", ".", "."],
            [".", "Evictions", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Redis Cache Performance"
          period  = 300
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 6
        width  = 24
        height = 6

        properties = {
          query   = "SOURCE '/aws/ecs/recommendation-engine' | fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 100"
          region  = var.aws_region
          title   = "Recent Errors Across Services"
        }
      }
    ]
  })
}