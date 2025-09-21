# GDPR Compliance Infrastructure

# Lambda function for data deletion
resource "aws_lambda_function" "gdpr_data_deletion" {
  filename         = "gdpr_data_deletion.zip"
  function_name    = "${var.project_name}-gdpr-data-deletion"
  role            = aws_iam_role.gdpr_lambda_role.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.gdpr_data_deletion_zip.output_base64sha256
  runtime         = "python3.9"
  timeout         = 300

  environment {
    variables = {
      USER_DB_ENDPOINT     = aws_db_instance.user_db.endpoint
      RESTAURANT_DB_ENDPOINT = aws_db_instance.restaurant_db.endpoint
      S3_REVIEWS_BUCKET    = aws_s3_bucket.reviews_media.bucket
      S3_PLATFORM_BUCKET   = aws_s3_bucket.platform_data_archive.bucket
      KMS_KEY_ID          = aws_kms_key.app_encryption_key.key_id
    }
  }

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda_sg.id]
  }

  tags = var.common_tags
}

# Lambda function for data export
resource "aws_lambda_function" "gdpr_data_export" {
  filename         = "gdpr_data_export.zip"
  function_name    = "${var.project_name}-gdpr-data-export"
  role            = aws_iam_role.gdpr_lambda_role.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.gdpr_data_export_zip.output_base64sha256
  runtime         = "python3.9"
  timeout         = 300

  environment {
    variables = {
      USER_DB_ENDPOINT     = aws_db_instance.user_db.endpoint
      RESTAURANT_DB_ENDPOINT = aws_db_instance.restaurant_db.endpoint
      S3_REVIEWS_BUCKET    = aws_s3_bucket.reviews_media.bucket
      S3_EXPORT_BUCKET     = aws_s3_bucket.gdpr_exports.bucket
      KMS_KEY_ID          = aws_kms_key.app_encryption_key.key_id
    }
  }

  vpc_config {
    subnet_ids         = aws_subnet.private[*].id
    security_group_ids = [aws_security_group.lambda_sg.id]
  }

  tags = var.common_tags
}

# S3 bucket for GDPR data exports
resource "aws_s3_bucket" "gdpr_exports" {
  bucket = "${var.project_name}-gdpr-exports-${random_string.bucket_suffix.result}"

  tags = var.common_tags
}

resource "aws_s3_bucket_encryption_configuration" "gdpr_exports_encryption" {
  bucket = aws_s3_bucket.gdpr_exports.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.s3_encryption_key.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "gdpr_exports_lifecycle" {
  bucket = aws_s3_bucket.gdpr_exports.id

  rule {
    id     = "gdpr_export_cleanup"
    status = "Enabled"

    expiration {
      days = 30
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }
}

resource "aws_s3_bucket_public_access_block" "gdpr_exports_pab" {
  bucket = aws_s3_bucket.gdpr_exports.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# IAM Role for GDPR Lambda functions
resource "aws_iam_role" "gdpr_lambda_role" {
  name = "${var.project_name}-gdpr-lambda-role"

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

resource "aws_iam_policy" "gdpr_lambda_policy" {
  name = "${var.project_name}-gdpr-lambda-policy"

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
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "rds:DescribeDBInstances"
        ]
        Resource = [
          aws_db_instance.user_db.arn,
          aws_db_instance.restaurant_db.arn
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
          aws_s3_bucket.reviews_media.arn,
          "${aws_s3_bucket.reviews_media.arn}/*",
          aws_s3_bucket.platform_data_archive.arn,
          "${aws_s3_bucket.platform_data_archive.arn}/*",
          aws_s3_bucket.gdpr_exports.arn,
          "${aws_s3_bucket.gdpr_exports.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:Encrypt"
        ]
        Resource = [
          aws_kms_key.app_encryption_key.arn,
          aws_kms_key.s3_encryption_key.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "gdpr_lambda_policy_attachment" {
  role       = aws_iam_role.gdpr_lambda_role.name
  policy_arn = aws_iam_policy.gdpr_lambda_policy.arn
}

# Security Group for Lambda functions
resource "aws_security_group" "lambda_sg" {
  name_prefix = "${var.project_name}-lambda-"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-lambda-sg"
  })
}

# API Gateway endpoints for GDPR requests
resource "aws_api_gateway_resource" "gdpr" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "gdpr"
}

resource "aws_api_gateway_resource" "gdpr_export" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.gdpr.id
  path_part   = "export"
}

resource "aws_api_gateway_resource" "gdpr_delete" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.gdpr.id
  path_part   = "delete"
}

resource "aws_api_gateway_method" "gdpr_export_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.gdpr_export.id
  http_method   = "POST"
  authorization = "AWS_IAM"
}

resource "aws_api_gateway_method" "gdpr_delete_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.gdpr_delete.id
  http_method   = "POST"
  authorization = "AWS_IAM"
}

resource "aws_api_gateway_integration" "gdpr_export_integration" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.gdpr_export.id
  http_method = aws_api_gateway_method.gdpr_export_post.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.gdpr_data_export.invoke_arn
}

resource "aws_api_gateway_integration" "gdpr_delete_integration" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.gdpr_delete.id
  http_method = aws_api_gateway_method.gdpr_delete_post.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.gdpr_data_deletion.invoke_arn
}

# Lambda permissions for API Gateway
resource "aws_lambda_permission" "gdpr_export_api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.gdpr_data_export.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

resource "aws_lambda_permission" "gdpr_delete_api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.gdpr_data_deletion.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# Data retention policies for GDPR compliance
resource "aws_cloudwatch_log_group" "gdpr_audit_logs" {
  name              = "/aws/lambda/${var.project_name}-gdpr-audit"
  retention_in_days = 2555 # 7 years for audit logs
  kms_key_id        = aws_kms_key.app_encryption_key.arn

  tags = var.common_tags
}

# Archive files for Lambda functions (these would be created by build process)
data "archive_file" "gdpr_data_deletion_zip" {
  type        = "zip"
  output_path = "gdpr_data_deletion.zip"
  source {
    content = templatefile("${path.module}/../lambda/gdpr_data_deletion.py", {
      # Template variables if needed
    })
    filename = "index.py"
  }
}

data "archive_file" "gdpr_data_export_zip" {
  type        = "zip"
  output_path = "gdpr_data_export.zip"
  source {
    content = templatefile("${path.module}/../lambda/gdpr_data_export.py", {
      # Template variables if needed
    })
    filename = "index.py"
  }
}