# Amazon Bedrock Configuration for Natural Language Processing

# IAM Role for Bedrock Access
resource "aws_iam_role" "bedrock_access_role" {
  name = "${var.project_name}-bedrock-access-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = [
            "lambda.amazonaws.com",
            "ecs-tasks.amazonaws.com"
          ]
        }
      }
    ]
  })

  tags = var.common_tags
}

# Bedrock Access Policy
resource "aws_iam_role_policy" "bedrock_access_policy" {
  name = "${var.project_name}-bedrock-access-policy"
  role = aws_iam_role.bedrock_access_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          "bedrock:ListFoundationModels",
          "bedrock:GetFoundationModel"
        ]
        Resource = [
          "arn:aws:bedrock:${var.aws_region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0",
          "arn:aws:bedrock:${var.aws_region}::foundation-model/amazon.titan-text-express-v1",
          "arn:aws:bedrock:${var.aws_region}::foundation-model/cohere.command-text-v14"
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
      }
    ]
  })
}

# Lambda Function for Bedrock NLP Processing
resource "aws_lambda_function" "bedrock_nlp_processor" {
  filename         = "bedrock_nlp_processor.zip"
  function_name    = "${var.project_name}-bedrock-nlp-processor"
  role            = aws_iam_role.bedrock_access_role.arn
  handler         = "index.handler"
  runtime         = "python3.9"
  timeout         = 30

  environment {
    variables = {
      BEDROCK_REGION = var.aws_region
      LOG_LEVEL = "INFO"
    }
  }

  tags = var.common_tags
}

# API Gateway for Bedrock NLP Service
resource "aws_api_gateway_rest_api" "bedrock_nlp_api" {
  name        = "${var.project_name}-bedrock-nlp-api"
  description = "API for Bedrock NLP processing"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = var.common_tags
}

resource "aws_api_gateway_resource" "bedrock_nlp_resource" {
  rest_api_id = aws_api_gateway_rest_api.bedrock_nlp_api.id
  parent_id   = aws_api_gateway_rest_api.bedrock_nlp_api.root_resource_id
  path_part   = "analyze"
}

resource "aws_api_gateway_method" "bedrock_nlp_method" {
  rest_api_id   = aws_api_gateway_rest_api.bedrock_nlp_api.id
  resource_id   = aws_api_gateway_resource.bedrock_nlp_resource.id
  http_method   = "POST"
  authorization = "AWS_IAM"
}

resource "aws_api_gateway_integration" "bedrock_nlp_integration" {
  rest_api_id = aws_api_gateway_rest_api.bedrock_nlp_api.id
  resource_id = aws_api_gateway_resource.bedrock_nlp_resource.id
  http_method = aws_api_gateway_method.bedrock_nlp_method.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.bedrock_nlp_processor.invoke_arn
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "bedrock_nlp_api_permission" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.bedrock_nlp_processor.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.bedrock_nlp_api.execution_arn}/*/*"
}

# CloudWatch Log Group for Bedrock Lambda
resource "aws_cloudwatch_log_group" "bedrock_lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.bedrock_nlp_processor.function_name}"
  retention_in_days = 14
  tags              = var.common_tags
}