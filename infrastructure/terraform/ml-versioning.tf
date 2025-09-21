# ML Model Versioning and A/B Testing Infrastructure

# DynamoDB Table for Model Versions
resource "aws_dynamodb_table" "model_versions" {
  name           = "${var.project_name}-model-versions"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "model_name"
  range_key      = "version"

  attribute {
    name = "model_name"
    type = "S"
  }

  attribute {
    name = "version"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "created_at"
    type = "S"
  }

  global_secondary_index {
    name     = "status-index"
    hash_key = "status"
    range_key = "created_at"
  }

  tags = var.common_tags
}

# DynamoDB Table for A/B Test Configurations
resource "aws_dynamodb_table" "ab_test_configs" {
  name           = "${var.project_name}-ab-test-configs"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "test_id"

  attribute {
    name = "test_id"
    type = "S"
  }

  attribute {
    name = "status"
    type = "S"
  }

  attribute {
    name = "start_date"
    type = "S"
  }

  global_secondary_index {
    name     = "status-start-date-index"
    hash_key = "status"
    range_key = "start_date"
  }

  tags = var.common_tags
}

# DynamoDB Table for A/B Test Results
resource "aws_dynamodb_table" "ab_test_results" {
  name           = "${var.project_name}-ab-test-results"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "test_id"
  range_key      = "user_id"

  attribute {
    name = "test_id"
    type = "S"
  }

  attribute {
    name = "user_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  global_secondary_index {
    name     = "test-timestamp-index"
    hash_key = "test_id"
    range_key = "timestamp"
  }

  tags = var.common_tags
}

# Lambda Function for Model Version Management
resource "aws_lambda_function" "model_version_manager" {
  filename         = "model_version_manager.zip"
  function_name    = "${var.project_name}-model-version-manager"
  role            = aws_iam_role.ml_management_role.arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 300

  environment {
    variables = {
      MODEL_VERSIONS_TABLE = aws_dynamodb_table.model_versions.name
      S3_BUCKET = aws_s3_bucket.ml_models.bucket
      SAGEMAKER_ROLE_ARN = aws_iam_role.sagemaker_execution_role.arn
    }
  }

  tags = var.common_tags
}

# Lambda Function for A/B Test Management
resource "aws_lambda_function" "ab_test_manager" {
  filename         = "ab_test_manager.zip"
  function_name    = "${var.project_name}-ab-test-manager"
  role            = aws_iam_role.ml_management_role.arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 300

  environment {
    variables = {
      AB_TEST_CONFIGS_TABLE = aws_dynamodb_table.ab_test_configs.name
      AB_TEST_RESULTS_TABLE = aws_dynamodb_table.ab_test_results.name
      MODEL_VERSIONS_TABLE = aws_dynamodb_table.model_versions.name
    }
  }

  tags = var.common_tags
}

# IAM Role for ML Management Functions
resource "aws_iam_role" "ml_management_role" {
  name = "${var.project_name}-ml-management-role"

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

# IAM Policy for ML Management
resource "aws_iam_role_policy" "ml_management_policy" {
  name = "${var.project_name}-ml-management-policy"
  role = aws_iam_role.ml_management_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.model_versions.arn,
          aws_dynamodb_table.ab_test_configs.arn,
          aws_dynamodb_table.ab_test_results.arn,
          "${aws_dynamodb_table.model_versions.arn}/index/*",
          "${aws_dynamodb_table.ab_test_configs.arn}/index/*",
          "${aws_dynamodb_table.ab_test_results.arn}/index/*"
        ]
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
          aws_s3_bucket.ml_models.arn,
          "${aws_s3_bucket.ml_models.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sagemaker:CreateModel",
          "sagemaker:CreateEndpointConfig",
          "sagemaker:CreateEndpoint",
          "sagemaker:UpdateEndpoint",
          "sagemaker:DeleteModel",
          "sagemaker:DeleteEndpointConfig",
          "sagemaker:DeleteEndpoint",
          "sagemaker:DescribeModel",
          "sagemaker:DescribeEndpointConfig",
          "sagemaker:DescribeEndpoint"
        ]
        Resource = "*"
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

# EventBridge Rule for Model Deployment
resource "aws_cloudwatch_event_rule" "model_deployment_rule" {
  name        = "${var.project_name}-model-deployment-rule"
  description = "Trigger model deployment on S3 upload"

  event_pattern = jsonencode({
    source      = ["aws.s3"]
    detail-type = ["Object Created"]
    detail = {
      bucket = {
        name = [aws_s3_bucket.ml_models.bucket]
      }
      object = {
        key = [{
          prefix = "models/"
        }]
      }
    }
  })

  tags = var.common_tags
}

# EventBridge Target for Model Deployment
resource "aws_cloudwatch_event_target" "model_deployment_target" {
  rule      = aws_cloudwatch_event_rule.model_deployment_rule.name
  target_id = "ModelVersionManagerTarget"
  arn       = aws_lambda_function.model_version_manager.arn
}

# Lambda Permission for EventBridge
resource "aws_lambda_permission" "model_deployment_permission" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.model_version_manager.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.model_deployment_rule.arn
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "model_version_manager_logs" {
  name              = "/aws/lambda/${aws_lambda_function.model_version_manager.function_name}"
  retention_in_days = 14
  tags              = var.common_tags
}

resource "aws_cloudwatch_log_group" "ab_test_manager_logs" {
  name              = "/aws/lambda/${aws_lambda_function.ab_test_manager.function_name}"
  retention_in_days = 14
  tags              = var.common_tags
}