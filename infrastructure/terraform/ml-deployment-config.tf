# ML Deployment Configuration
# This file contains configuration for ML model deployment and management

# Random string for unique resource naming
resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

# Local values for ML configuration
locals {
  ml_config = {
    # Model configurations
    models = {
      recommendation = {
        container_image = "763104351884.dkr.ecr.${var.aws_region}.amazonaws.com/pytorch-inference:1.12.0-cpu-py38-ubuntu20.04-sagemaker"
        instance_type   = "ml.t2.medium"
        environment = {
          SAGEMAKER_PROGRAM           = "inference.py"
          SAGEMAKER_SUBMIT_DIRECTORY = "/opt/ml/code"
        }
      }
      sentiment = {
        container_image = "763104351884.dkr.ecr.${var.aws_region}.amazonaws.com/huggingface-pytorch-inference:1.10.2-transformers4.17.0-cpu-py38-ubuntu20.04"
        instance_type   = "ml.t2.medium"
        environment = {
          HF_MODEL_ID = "cardiffnlp/twitter-roberta-base-sentiment-latest"
          HF_TASK     = "text-classification"
        }
      }
    }
    
    # Auto-scaling configuration
    auto_scaling = {
      min_capacity = 1
      max_capacity = 10
      target_value = 70.0
    }
    
    # Monitoring configuration
    monitoring = {
      log_retention_days = 14
      metric_period     = 300
      alarm_thresholds = {
        latency_ms     = 5000
        error_rate_pct = 5
        cpu_util_pct   = 80
        memory_util_pct = 85
      }
    }
    
    # A/B testing configuration
    ab_testing = {
      default_traffic_split = 50
      min_sample_size      = 100
      significance_level   = 0.05
    }
    
    # Retraining configuration
    retraining = {
      check_interval_hours = 24
      performance_window_days = 7
      drift_threshold_pct = 20
      max_model_age_days = 30
    }
  }
}

# Output ML configuration for use by other modules
output "ml_config" {
  description = "ML deployment configuration"
  value       = local.ml_config
}

# Output SageMaker endpoints information
output "sagemaker_endpoints" {
  description = "SageMaker endpoint information"
  value = {
    recommendation = {
      endpoint_name = aws_sagemaker_endpoint.recommendation_endpoint.name
      endpoint_arn  = aws_sagemaker_endpoint.recommendation_endpoint.arn
    }
    sentiment = {
      endpoint_name = aws_sagemaker_endpoint.sentiment_endpoint.name
      endpoint_arn  = aws_sagemaker_endpoint.sentiment_endpoint.arn
    }
  }
}

# Output Lambda function information
output "ml_lambda_functions" {
  description = "ML Lambda function information"
  value = {
    bedrock_nlp_processor = {
      function_name = aws_lambda_function.bedrock_nlp_processor.function_name
      function_arn  = aws_lambda_function.bedrock_nlp_processor.arn
    }
    model_version_manager = {
      function_name = aws_lambda_function.model_version_manager.function_name
      function_arn  = aws_lambda_function.model_version_manager.arn
    }
    ab_test_manager = {
      function_name = aws_lambda_function.ab_test_manager.function_name
      function_arn  = aws_lambda_function.ab_test_manager.arn
    }
    model_performance_monitor = {
      function_name = aws_lambda_function.model_performance_monitor.function_name
      function_arn  = aws_lambda_function.model_performance_monitor.arn
    }
    model_retraining_trigger = {
      function_name = aws_lambda_function.model_retraining_trigger.function_name
      function_arn  = aws_lambda_function.model_retraining_trigger.arn
    }
  }
}

# Output DynamoDB tables information
output "ml_dynamodb_tables" {
  description = "ML DynamoDB table information"
  value = {
    model_versions = {
      table_name = aws_dynamodb_table.model_versions.name
      table_arn  = aws_dynamodb_table.model_versions.arn
    }
    ab_test_configs = {
      table_name = aws_dynamodb_table.ab_test_configs.name
      table_arn  = aws_dynamodb_table.ab_test_configs.arn
    }
    ab_test_results = {
      table_name = aws_dynamodb_table.ab_test_results.name
      table_arn  = aws_dynamodb_table.ab_test_results.arn
    }
    model_performance_metrics = {
      table_name = aws_dynamodb_table.model_performance_metrics.name
      table_arn  = aws_dynamodb_table.model_performance_metrics.arn
    }
  }
}

# Output S3 bucket information
output "ml_s3_buckets" {
  description = "ML S3 bucket information"
  value = {
    ml_models = {
      bucket_name = aws_s3_bucket.ml_models.bucket
      bucket_arn  = aws_s3_bucket.ml_models.arn
    }
  }
}

# Output CloudWatch dashboard information
output "ml_monitoring" {
  description = "ML monitoring information"
  value = {
    dashboard_name = aws_cloudwatch_dashboard.ml_monitoring_dashboard.dashboard_name
    sns_topic_arn  = aws_sns_topic.ml_alerts.arn
  }
}