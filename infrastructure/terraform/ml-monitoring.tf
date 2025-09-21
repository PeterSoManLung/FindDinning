# ML Model Monitoring and Automatic Retraining Infrastructure

# CloudWatch Dashboard for ML Model Monitoring
resource "aws_cloudwatch_dashboard" "ml_monitoring_dashboard" {
  dashboard_name = "${var.project_name}-ml-monitoring"

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
            ["AWS/SageMaker", "ModelLatency", "EndpointName", aws_sagemaker_endpoint.recommendation_endpoint.name],
            [".", "ModelInvocations", ".", "."],
            [".", "ModelInvocation4XXErrors", ".", "."],
            [".", "ModelInvocation5XXErrors", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Recommendation Model Performance"
          period  = 300
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
            ["AWS/SageMaker", "ModelLatency", "EndpointName", aws_sagemaker_endpoint.sentiment_endpoint.name],
            [".", "ModelInvocations", ".", "."],
            [".", "ModelInvocation4XXErrors", ".", "."],
            [".", "ModelInvocation5XXErrors", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Sentiment Analysis Model Performance"
          period  = 300
        }
      }
    ]
  })
}

# CloudWatch Alarms for Model Performance
resource "aws_cloudwatch_metric_alarm" "recommendation_model_latency" {
  alarm_name          = "${var.project_name}-recommendation-model-high-latency"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ModelLatency"
  namespace           = "AWS/SageMaker"
  period              = "300"
  statistic           = "Average"
  threshold           = "5000"
  alarm_description   = "This metric monitors recommendation model latency"
  alarm_actions       = [aws_sns_topic.ml_alerts.arn]

  dimensions = {
    EndpointName = aws_sagemaker_endpoint.recommendation_endpoint.name
  }

  tags = var.common_tags
}

resource "aws_cloudwatch_metric_alarm" "recommendation_model_errors" {
  alarm_name          = "${var.project_name}-recommendation-model-high-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ModelInvocation4XXErrors"
  namespace           = "AWS/SageMaker"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors recommendation model errors"
  alarm_actions       = [aws_sns_topic.ml_alerts.arn]

  dimensions = {
    EndpointName = aws_sagemaker_endpoint.recommendation_endpoint.name
  }

  tags = var.common_tags
}

# SNS Topic for ML Alerts
resource "aws_sns_topic" "ml_alerts" {
  name = "${var.project_name}-ml-alerts"
  tags = var.common_tags
}

# DynamoDB Table for Model Performance Metrics
resource "aws_dynamodb_table" "model_performance_metrics" {
  name           = "${var.project_name}-model-performance-metrics"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "model_name"
  range_key      = "timestamp"

  attribute {
    name = "model_name"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  attribute {
    name = "metric_type"
    type = "S"
  }

  global_secondary_index {
    name     = "metric-type-timestamp-index"
    hash_key = "metric_type"
    range_key = "timestamp"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = var.common_tags
}

# Lambda Function for Model Performance Monitoring
resource "aws_lambda_function" "model_performance_monitor" {
  filename         = "model_performance_monitor.zip"
  function_name    = "${var.project_name}-model-performance-monitor"
  role            = aws_iam_role.ml_monitoring_role.arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 300

  environment {
    variables = {
      PERFORMANCE_METRICS_TABLE = aws_dynamodb_table.model_performance_metrics.name
      SNS_TOPIC_ARN = aws_sns_topic.ml_alerts.arn
      RECOMMENDATION_ENDPOINT = aws_sagemaker_endpoint.recommendation_endpoint.name
      SENTIMENT_ENDPOINT = aws_sagemaker_endpoint.sentiment_endpoint.name
    }
  }

  tags = var.common_tags
}

# Lambda Function for Automatic Model Retraining
resource "aws_lambda_function" "model_retraining_trigger" {
  filename         = "model_retraining_trigger.zip"
  function_name    = "${var.project_name}-model-retraining-trigger"
  role            = aws_iam_role.ml_monitoring_role.arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 900

  environment {
    variables = {
      PERFORMANCE_METRICS_TABLE = aws_dynamodb_table.model_performance_metrics.name
      TRAINING_JOB_ROLE_ARN = aws_iam_role.sagemaker_execution_role.arn
      S3_BUCKET = aws_s3_bucket.ml_models.bucket
      SNS_TOPIC_ARN = aws_sns_topic.ml_alerts.arn
    }
  }

  tags = var.common_tags
}

# IAM Role for ML Monitoring Functions
resource "aws_iam_role" "ml_monitoring_role" {
  name = "${var.project_name}-ml-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.common_tags
}

# IAM Policy for ML Monitoring
resource "aws_iam_role_policy" "ml_monitoring_policy" {
  name = "${var.project_name}-ml-monitoring-policy"
  role = aws_iam_role.ml_monitoring_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.model_performance_metrics.arn,
          "${aws_dynamodb_table.model_performance_metrics.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics",
          "cloudwatch:PutMetricData"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sagemaker:DescribeEndpoint",
          "sagemaker:InvokeEndpoint",
          "sagemaker:CreateTrainingJob",
          "sagemaker:DescribeTrainingJob",
          "sagemaker:StopTrainingJob"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.ml_alerts.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.ml_models.arn,
          "${aws_s3_bucket.ml_models.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "iam:PassRole"
        ]
        Resource = aws_iam_role.sagemaker_execution_role.arn
      }
    ]
  })
}

# EventBridge Rule for Scheduled Model Performance Check
resource "aws_cloudwatch_event_rule" "model_performance_check" {
  name                = "${var.project_name}-model-performance-check"
  description         = "Trigger model performance monitoring every hour"
  schedule_expression = "rate(1 hour)"
  tags                = var.common_tags
}

# EventBridge Target for Model Performance Check
resource "aws_cloudwatch_event_target" "model_performance_check_target" {
  rule      = aws_cloudwatch_event_rule.model_performance_check.name
  target_id = "ModelPerformanceMonitorTarget"
  arn       = aws_lambda_function.model_performance_monitor.arn
}

# Lambda Permission for EventBridge (Performance Monitor)
resource "aws_lambda_permission" "model_performance_monitor_permission" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.model_performance_monitor.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.model_performance_check.arn
}

# EventBridge Rule for Model Retraining (Daily)
resource "aws_cloudwatch_event_rule" "model_retraining_check" {
  name                = "${var.project_name}-model-retraining-check"
  description         = "Check if model retraining is needed daily"
  schedule_expression = "rate(1 day)"
  tags                = var.common_tags
}

# EventBridge Target for Model Retraining Check
resource "aws_cloudwatch_event_target" "model_retraining_check_target" {
  rule      = aws_cloudwatch_event_rule.model_retraining_check.name
  target_id = "ModelRetrainingTriggerTarget"
  arn       = aws_lambda_function.model_retraining_trigger.arn
}

# Lambda Permission for EventBridge (Retraining Trigger)
resource "aws_lambda_permission" "model_retraining_trigger_permission" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.model_retraining_trigger.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.model_retraining_check.arn
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "model_performance_monitor_logs" {
  name              = "/aws/lambda/${aws_lambda_function.model_performance_monitor.function_name}"
  retention_in_days = 14
  tags              = var.common_tags
}

resource "aws_cloudwatch_log_group" "model_retraining_trigger_logs" {
  name              = "/aws/lambda/${aws_lambda_function.model_retraining_trigger.function_name}"
  retention_in_days = 14
  tags              = var.common_tags
}