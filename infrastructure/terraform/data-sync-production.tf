# Production Data Synchronization Infrastructure

# EventBridge for scheduled sync jobs
resource "aws_cloudwatch_event_rule" "monthly_sync" {
  name                = "monthly-hk-platforms-sync"
  description         = "Monthly synchronization of Hong Kong platform data"
  schedule_expression = "cron(0 2 1 * ? *)" # 2 AM on 1st of every month
  
  tags = {
    Environment = var.environment
    Service     = "data-integration"
    Purpose     = "scheduled-sync"
  }
}

resource "aws_cloudwatch_event_rule" "weekly_gov_sync" {
  name                = "weekly-gov-data-sync"
  description         = "Weekly government data synchronization"
  schedule_expression = "cron(0 3 ? * SUN *)" # 3 AM every Sunday
  
  tags = {
    Environment = var.environment
    Service     = "data-integration"
    Purpose     = "scheduled-sync"
  }
}

# Lambda function for sync orchestration
resource "aws_lambda_function" "sync_orchestrator" {
  filename         = "sync-orchestrator.zip"
  function_name    = "data-sync-orchestrator-${var.environment}"
  role            = aws_iam_role.sync_orchestrator_role.arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 900 # 15 minutes
  memory_size     = 1024

  environment {
    variables = {
      ENVIRONMENT = var.environment
      EKS_CLUSTER_NAME = aws_eks_cluster.main.name
      DATA_INTEGRATION_SERVICE_URL = "http://data-integration-service.default.svc.cluster.local:3000"
      SNS_TOPIC_ARN = aws_sns_topic.sync_alerts.arn
      S3_BACKUP_BUCKET = aws_s3_bucket.data_backup.bucket
      CLOUDWATCH_LOG_GROUP = aws_cloudwatch_log_group.sync_logs.name
    }
  }

  tags = {
    Environment = var.environment
    Service     = "data-integration"
    Purpose     = "sync-orchestration"
  }
}

# IAM role for sync orchestrator
resource "aws_iam_role" "sync_orchestrator_role" {
  name = "sync-orchestrator-role-${var.environment}"

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
}

resource "aws_iam_role_policy" "sync_orchestrator_policy" {
  name = "sync-orchestrator-policy-${var.environment}"
  role = aws_iam_role.sync_orchestrator_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "eks:DescribeCluster",
          "eks:ListClusters"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.sync_alerts.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.data_backup.arn,
          "${aws_s3_bucket.data_backup.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData",
          "cloudwatch:GetMetricStatistics"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/data-sync/*"
      }
    ]
  })
}

# EventBridge targets
resource "aws_cloudwatch_event_target" "monthly_sync_target" {
  rule      = aws_cloudwatch_event_rule.monthly_sync.name
  target_id = "MonthlySync"
  arn       = aws_lambda_function.sync_orchestrator.arn

  input = jsonencode({
    jobType = "monthly-full-sync"
    sources = ["openrice", "eatigo", "chope", "keeta", "foodpanda", "bistrochat", "tripadvisor", "hk_gov"]
  })
}

resource "aws_cloudwatch_event_target" "weekly_gov_sync_target" {
  rule      = aws_cloudwatch_event_rule.weekly_gov_sync.name
  target_id = "WeeklyGovSync"
  arn       = aws_lambda_function.sync_orchestrator.arn

  input = jsonencode({
    jobType = "weekly-gov-sync"
    sources = ["hk_gov"]
  })
}

# Lambda permissions for EventBridge
resource "aws_lambda_permission" "allow_monthly_sync" {
  statement_id  = "AllowExecutionFromEventBridge-Monthly"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sync_orchestrator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.monthly_sync.arn
}

resource "aws_lambda_permission" "allow_weekly_sync" {
  statement_id  = "AllowExecutionFromEventBridge-Weekly"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.sync_orchestrator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.weekly_gov_sync.arn
}

# S3 bucket for data backup and archival
resource "aws_s3_bucket" "data_backup" {
  bucket = "find-dining-data-backup-${var.environment}-${random_string.bucket_suffix.result}"

  tags = {
    Environment = var.environment
    Service     = "data-integration"
    Purpose     = "backup-archival"
  }
}

resource "aws_s3_bucket_versioning" "data_backup_versioning" {
  bucket = aws_s3_bucket.data_backup.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "data_backup_lifecycle" {
  bucket = aws_s3_bucket.data_backup.id

  rule {
    id     = "backup_lifecycle"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data_backup_encryption" {
  bucket = aws_s3_bucket.data_backup.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.data_encryption.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

# SNS topic for sync alerts
resource "aws_sns_topic" "sync_alerts" {
  name = "data-sync-alerts-${var.environment}"

  tags = {
    Environment = var.environment
    Service     = "data-integration"
    Purpose     = "alerting"
  }
}

# CloudWatch Log Group for sync operations
resource "aws_cloudwatch_log_group" "sync_logs" {
  name              = "/aws/data-sync/${var.environment}"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Service     = "data-integration"
    Purpose     = "logging"
  }
}

# CloudWatch Alarms for sync monitoring
resource "aws_cloudwatch_metric_alarm" "sync_failure_alarm" {
  alarm_name          = "data-sync-failures-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "SyncFailures"
  namespace           = "DataIntegration"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors data sync failures"
  alarm_actions       = [aws_sns_topic.sync_alerts.arn]

  dimensions = {
    Environment = var.environment
  }

  tags = {
    Environment = var.environment
    Service     = "data-integration"
    Purpose     = "monitoring"
  }
}

resource "aws_cloudwatch_metric_alarm" "data_staleness_alarm" {
  alarm_name          = "data-staleness-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "DataStaleness"
  namespace           = "DataIntegration"
  period              = "3600"
  statistic           = "Maximum"
  threshold           = "0.7"
  alarm_description   = "This metric monitors data staleness"
  alarm_actions       = [aws_sns_topic.sync_alerts.arn]

  dimensions = {
    Environment = var.environment
  }

  tags = {
    Environment = var.environment
    Service     = "data-integration"
    Purpose     = "monitoring"
  }
}

# DynamoDB table for data lineage tracking
resource "aws_dynamodb_table" "data_lineage" {
  name           = "data-lineage-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "record_id"
  range_key      = "timestamp"

  attribute {
    name = "record_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  attribute {
    name = "source"
    type = "S"
  }

  global_secondary_index {
    name     = "source-timestamp-index"
    hash_key = "source"
    range_key = "timestamp"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.data_encryption.arn
  }

  tags = {
    Environment = var.environment
    Service     = "data-integration"
    Purpose     = "lineage-tracking"
  }
}

# Systems Manager parameters for sync configuration
resource "aws_ssm_parameter" "sync_config" {
  name  = "/data-sync/${var.environment}/config"
  type  = "String"
  value = jsonencode({
    retryAttempts = 3
    timeout = 7200000
    batchSize = 100
    maxConcurrentJobs = 5
    alertThresholds = {
      errorRate = 0.1
      staleness = 0.7
      performance = 300000
    }
    dataQualityThresholds = {
      validationScore = 0.8
      completenessScore = 0.9
      accuracyScore = 0.85
      consistencyScore = 0.9
    }
    complianceSettings = {
      gdprRetentionDays = 2555
      auditLogRetentionDays = 2555
      sensitiveDataEncryption = true
    }
  })

  tags = {
    Environment = var.environment
    Service     = "data-integration"
    Purpose     = "configuration"
  }
}

# Additional CloudWatch alarms for comprehensive monitoring
resource "aws_cloudwatch_metric_alarm" "data_quality_alarm" {
  alarm_name          = "data-quality-degradation-${var.environment}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DataQualityScore"
  namespace           = "DataIntegration"
  period              = "3600"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors data quality degradation"
  alarm_actions       = [aws_sns_topic.sync_alerts.arn]

  dimensions = {
    Environment = var.environment
  }

  tags = {
    Environment = var.environment
    Service     = "data-integration"
    Purpose     = "monitoring"
  }
}

resource "aws_cloudwatch_metric_alarm" "compliance_rate_alarm" {
  alarm_name          = "compliance-rate-low-${var.environment}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "ComplianceRate"
  namespace           = "DataIntegration"
  period              = "3600"
  statistic           = "Average"
  threshold           = "95"
  alarm_description   = "This metric monitors GDPR compliance rate"
  alarm_actions       = [aws_sns_topic.sync_alerts.arn]

  dimensions = {
    Environment = var.environment
  }

  tags = {
    Environment = var.environment
    Service     = "data-integration"
    Purpose     = "monitoring"
  }
}

# CloudWatch dashboard for production sync monitoring
resource "aws_cloudwatch_dashboard" "production_sync_dashboard" {
  dashboard_name = "DataSync-${var.environment}"

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
            ["DataIntegration", "SyncJobsExecuted", "Environment", var.environment],
            [".", "SyncFailures", ".", "."],
            [".", "RecordsProcessed", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Sync Operations Overview"
          period  = 300
          yAxis = {
            left = {
              min = 0
            }
          }
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
            ["DataIntegration", "SyncDuration", "Environment", var.environment, { stat = "Average" }],
            [".", "SyncDuration", ".", ".", { stat = "Maximum" }]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Sync Performance"
          period  = 300
          yAxis = {
            left = {
              min = 0
            }
          }
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
            ["DataIntegration", "DataStaleness", "Environment", var.environment, "Source", "openrice"],
            ["...", "eatigo"],
            ["...", "chope"],
            ["...", "keeta"],
            ["...", "foodpanda"],
            ["...", "bistrochat"],
            ["...", "tripadvisor"],
            ["...", "hk_gov"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Data Freshness by Source"
          period  = 3600
          yAxis = {
            left = {
              min = 0
              max = 1
            }
          }
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
            ["DataIntegration", "DataQualityScore", "Environment", var.environment],
            [".", "ComplianceRate", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Data Quality & Compliance"
          period  = 3600
          yAxis = {
            left = {
              min = 0
              max = 100
            }
          }
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 12
        width  = 24
        height = 6
        properties = {
          query  = "SOURCE '/aws/data-sync/${var.environment}' | fields @timestamp, @message, @logStream | filter @message like /ERROR/ or @message like /CRITICAL/ | sort @timestamp desc | limit 50"
          region = var.aws_region
          title  = "Recent Errors and Critical Events"
          view   = "table"
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
    Service     = "data-integration"
    Purpose     = "monitoring"
  }
}

# Random string for unique bucket naming
resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

# Data sources
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}