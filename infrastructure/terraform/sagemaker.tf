# SageMaker Infrastructure for AI/ML Models

# SageMaker Execution Role
resource "aws_iam_role" "sagemaker_execution_role" {
  name = "${var.project_name}-sagemaker-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "sagemaker.amazonaws.com"
        }
      }
    ]
  })

  tags = var.common_tags
}

# SageMaker Execution Role Policy
resource "aws_iam_role_policy_attachment" "sagemaker_execution_policy" {
  role       = aws_iam_role.sagemaker_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSageMakerFullAccess"
}

# Additional policy for S3 access
resource "aws_iam_role_policy" "sagemaker_s3_policy" {
  name = "${var.project_name}-sagemaker-s3-policy"
  role = aws_iam_role.sagemaker_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.ml_models.arn,
          "${aws_s3_bucket.ml_models.arn}/*"
        ]
      }
    ]
  })
}

# S3 Bucket for ML Models
resource "aws_s3_bucket" "ml_models" {
  bucket = "${var.project_name}-ml-models-${random_string.bucket_suffix.result}"
  tags   = var.common_tags
}

resource "aws_s3_bucket_versioning" "ml_models_versioning" {
  bucket = aws_s3_bucket.ml_models.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "ml_models_encryption" {
  bucket = aws_s3_bucket.ml_models.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# SageMaker Model for Recommendation Engine
resource "aws_sagemaker_model" "recommendation_model" {
  name               = "${var.project_name}-recommendation-model"
  execution_role_arn = aws_iam_role.sagemaker_execution_role.arn

  primary_container {
    image          = "763104351884.dkr.ecr.${var.aws_region}.amazonaws.com/pytorch-inference:1.12.0-cpu-py38-ubuntu20.04-sagemaker"
    model_data_url = "s3://${aws_s3_bucket.ml_models.bucket}/models/recommendation/model.tar.gz"
    environment = {
      SAGEMAKER_PROGRAM = "inference.py"
      SAGEMAKER_SUBMIT_DIRECTORY = "/opt/ml/code"
    }
  }

  tags = var.common_tags
}

# SageMaker Endpoint Configuration for Recommendation Model
resource "aws_sagemaker_endpoint_configuration" "recommendation_endpoint_config" {
  name = "${var.project_name}-recommendation-endpoint-config"

  production_variants {
    variant_name           = "primary"
    model_name            = aws_sagemaker_model.recommendation_model.name
    initial_instance_count = 1
    instance_type         = "ml.t2.medium"
    initial_variant_weight = 1
  }

  # Auto-scaling configuration
  async_inference_config {
    output_config {
      s3_output_path = "s3://${aws_s3_bucket.ml_models.bucket}/async-inference-output/"
    }
  }

  tags = var.common_tags
}

# SageMaker Endpoint for Recommendation Model
resource "aws_sagemaker_endpoint" "recommendation_endpoint" {
  name                 = "${var.project_name}-recommendation-endpoint"
  endpoint_config_name = aws_sagemaker_endpoint_configuration.recommendation_endpoint_config.name

  tags = var.common_tags
}

# SageMaker Model for Sentiment Analysis
resource "aws_sagemaker_model" "sentiment_model" {
  name               = "${var.project_name}-sentiment-model"
  execution_role_arn = aws_iam_role.sagemaker_execution_role.arn

  primary_container {
    image          = "763104351884.dkr.ecr.${var.aws_region}.amazonaws.com/huggingface-pytorch-inference:1.10.2-transformers4.17.0-cpu-py38-ubuntu20.04"
    model_data_url = "s3://${aws_s3_bucket.ml_models.bucket}/models/sentiment/model.tar.gz"
    environment = {
      HF_MODEL_ID = "cardiffnlp/twitter-roberta-base-sentiment-latest"
      HF_TASK = "text-classification"
    }
  }

  tags = var.common_tags
}

# SageMaker Endpoint Configuration for Sentiment Analysis
resource "aws_sagemaker_endpoint_configuration" "sentiment_endpoint_config" {
  name = "${var.project_name}-sentiment-endpoint-config"

  production_variants {
    variant_name           = "primary"
    model_name            = aws_sagemaker_model.sentiment_model.name
    initial_instance_count = 1
    instance_type         = "ml.t2.medium"
    initial_variant_weight = 1
  }

  tags = var.common_tags
}

# SageMaker Endpoint for Sentiment Analysis
resource "aws_sagemaker_endpoint" "sentiment_endpoint" {
  name                 = "${var.project_name}-sentiment-endpoint"
  endpoint_config_name = aws_sagemaker_endpoint_configuration.sentiment_endpoint_config.name

  tags = var.common_tags
}

# Auto Scaling for Recommendation Endpoint
resource "aws_appautoscaling_target" "recommendation_endpoint_target" {
  max_capacity       = 10
  min_capacity       = 1
  resource_id        = "endpoint/${aws_sagemaker_endpoint.recommendation_endpoint.name}/variant/primary"
  scalable_dimension = "sagemaker:variant:DesiredInstanceCount"
  service_namespace  = "sagemaker"
}

resource "aws_appautoscaling_policy" "recommendation_endpoint_policy" {
  name               = "${var.project_name}-recommendation-scaling-policy"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.recommendation_endpoint_target.resource_id
  scalable_dimension = aws_appautoscaling_target.recommendation_endpoint_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.recommendation_endpoint_target.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = 70.0
    predefined_metric_specification {
      predefined_metric_type = "SageMakerVariantInvocationsPerInstance"
    }
  }
}

# CloudWatch Log Group for SageMaker
resource "aws_cloudwatch_log_group" "sagemaker_logs" {
  name              = "/aws/sagemaker/${var.project_name}"
  retention_in_days = 14
  tags              = var.common_tags
}