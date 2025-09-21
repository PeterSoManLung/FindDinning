# CloudWatch Log Groups for all microservices
resource "aws_cloudwatch_log_group" "api_gateway_logs" {
  name              = "/aws/apigateway/ai-restaurant-recommendation"
  retention_in_days = 30
  
  tags = {
    Environment = var.environment
    Service     = "api-gateway"
  }
}

resource "aws_cloudwatch_log_group" "user_service_logs" {
  name              = "/aws/ecs/user-service"
  retention_in_days = 30
  
  tags = {
    Environment = var.environment
    Service     = "user-service"
  }
}

resource "aws_cloudwatch_log_group" "restaurant_service_logs" {
  name              = "/aws/ecs/restaurant-service"
  retention_in_days = 30
  
  tags = {
    Environment = var.environment
    Service     = "restaurant-service"
  }
}

resource "aws_cloudwatch_log_group" "recommendation_engine_logs" {
  name              = "/aws/ecs/recommendation-engine"
  retention_in_days = 30
  
  tags = {
    Environment = var.environment
    Service     = "recommendation-engine"
  }
}

resource "aws_cloudwatch_log_group" "review_service_logs" {
  name              = "/aws/ecs/review-service"
  retention_in_days = 30
  
  tags = {
    Environment = var.environment
    Service     = "review-service"
  }
}

resource "aws_cloudwatch_log_group" "emotion_service_logs" {
  name              = "/aws/ecs/emotion-service"
  retention_in_days = 30
  
  tags = {
    Environment = var.environment
    Service     = "emotion-service"
  }
}

resource "aws_cloudwatch_log_group" "data_integration_service_logs" {
  name              = "/aws/ecs/data-integration-service"
  retention_in_days = 30
  
  tags = {
    Environment = var.environment
    Service     = "data-integration-service"
  }
}

# Custom CloudWatch Metrics
resource "aws_cloudwatch_metric_alarm" "recommendation_accuracy" {
  alarm_name          = "recommendation-accuracy-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "RecommendationAccuracy"
  namespace           = "AI-Restaurant-Recommendation"
  period              = "300"
  statistic           = "Average"
  threshold           = "0.7"
  alarm_description   = "This metric monitors recommendation accuracy"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    Service = "recommendation-engine"
  }
}

resource "aws_cloudwatch_metric_alarm" "negative_feedback_analysis_errors" {
  alarm_name          = "negative-feedback-analysis-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "NegativeFeedbackAnalysisErrors"
  namespace           = "AI-Restaurant-Recommendation"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors negative feedback analysis errors"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    Service = "review-service"
  }
}

resource "aws_cloudwatch_metric_alarm" "user_engagement_low" {
  alarm_name          = "user-engagement-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "UserEngagement"
  namespace           = "AI-Restaurant-Recommendation"
  period              = "900"
  statistic           = "Average"
  threshold           = "0.3"
  alarm_description   = "This metric monitors user engagement rates"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    Service = "mobile-app"
  }
}

# System Performance Alarms
resource "aws_cloudwatch_metric_alarm" "high_cpu_utilization" {
  alarm_name          = "high-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS CPU utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
  }
}

resource "aws_cloudwatch_metric_alarm" "high_memory_utilization" {
  alarm_name          = "high-memory-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "85"
  alarm_description   = "This metric monitors ECS memory utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
  }
}

# Data Sync Monitoring
resource "aws_cloudwatch_metric_alarm" "data_sync_failures" {
  alarm_name          = "data-sync-failures"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "DataSyncFailures"
  namespace           = "AI-Restaurant-Recommendation"
  period              = "3600"
  statistic           = "Sum"
  threshold           = "3"
  alarm_description   = "This metric monitors data synchronization failures"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    Service = "data-integration-service"
  }
}

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name = "ai-restaurant-recommendation-alerts"
}

resource "aws_sns_topic_subscription" "email_alerts" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# X-Ray Tracing
resource "aws_xray_sampling_rule" "recommendation_sampling" {
  rule_name      = "RecommendationSampling"
  priority       = 9000
  version        = 1
  reservoir_size = 1
  fixed_rate     = 0.1
  url_path       = "/api/recommendations/*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "*"
  resource_arn   = "*"
}

resource "aws_xray_sampling_rule" "high_priority_sampling" {
  rule_name      = "HighPrioritySampling"
  priority       = 5000
  version        = 1
  reservoir_size = 2
  fixed_rate     = 0.5
  url_path       = "/api/auth/*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "*"
  resource_arn   = "*"
}