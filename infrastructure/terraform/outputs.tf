# Outputs for Find Dining infrastructure

# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "database_subnet_ids" {
  description = "IDs of the database subnets"
  value       = aws_subnet.database[*].id
}

# EKS Outputs
output "cluster_id" {
  description = "EKS cluster ID"
  value       = aws_eks_cluster.main.id
}

output "cluster_arn" {
  description = "EKS cluster ARN"
  value       = aws_eks_cluster.main.arn
}

output "cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_security_group_id" {
  description = "Security group ids attached to the cluster control plane"
  value       = aws_eks_cluster.main.vpc_config[0].cluster_security_group_id
}

output "cluster_iam_role_name" {
  description = "IAM role name associated with EKS cluster"
  value       = aws_iam_role.eks_cluster.name
}

output "cluster_iam_role_arn" {
  description = "IAM role ARN associated with EKS cluster"
  value       = aws_iam_role.eks_cluster.arn
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required to communicate with the cluster"
  value       = aws_eks_cluster.main.certificate_authority[0].data
}

output "cluster_primary_security_group_id" {
  description = "Cluster security group that was created by Amazon EKS for the cluster"
  value       = aws_eks_cluster.main.vpc_config[0].cluster_security_group_id
}

output "node_groups" {
  description = "EKS node groups"
  value       = aws_eks_node_group.main.arn
}

# RDS Outputs
output "user_db_endpoint" {
  description = "RDS instance endpoint for user database"
  value       = aws_db_instance.user_db.endpoint
  sensitive   = true
}

output "restaurant_db_endpoint" {
  description = "RDS instance endpoint for restaurant database"
  value       = aws_db_instance.restaurant_db.endpoint
  sensitive   = true
}

output "user_db_port" {
  description = "RDS instance port for user database"
  value       = aws_db_instance.user_db.port
}

output "restaurant_db_port" {
  description = "RDS instance port for restaurant database"
  value       = aws_db_instance.restaurant_db.port
}

# ElastiCache Outputs
output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.redis.port
}

output "redis_sessions_endpoint" {
  description = "Redis sessions endpoint"
  value       = aws_elasticache_replication_group.sessions.primary_endpoint_address
  sensitive   = true
}

# S3 Outputs
output "reviews_media_bucket_name" {
  description = "Name of the S3 bucket for reviews and media"
  value       = aws_s3_bucket.reviews_media.bucket
}

output "reviews_media_bucket_arn" {
  description = "ARN of the S3 bucket for reviews and media"
  value       = aws_s3_bucket.reviews_media.arn
}

output "platform_data_bucket_name" {
  description = "Name of the S3 bucket for platform data"
  value       = aws_s3_bucket.platform_data.bucket
}

output "platform_data_bucket_arn" {
  description = "ARN of the S3 bucket for platform data"
  value       = aws_s3_bucket.platform_data.arn
}

# API Gateway Outputs
output "api_gateway_url" {
  description = "URL of the API Gateway"
  value       = "https://${aws_api_gateway_rest_api.main.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}"
}

output "api_gateway_id" {
  description = "ID of the API Gateway"
  value       = aws_api_gateway_rest_api.main.id
}

output "api_gateway_stage" {
  description = "API Gateway stage name"
  value       = aws_api_gateway_stage.main.stage_name
}

# Load Balancer Outputs
output "load_balancer_dns_name" {
  description = "DNS name of the load balancer"
  value       = aws_lb.main.dns_name
}

output "load_balancer_zone_id" {
  description = "Zone ID of the load balancer"
  value       = aws_lb.main.zone_id
}

# Secrets Manager Outputs
output "db_credentials_secret_arn" {
  description = "ARN of the database credentials secret"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "redis_credentials_secret_arn" {
  description = "ARN of the Redis credentials secret"
  value       = aws_secretsmanager_secret.redis_credentials.arn
}

output "api_keys_secret_arn" {
  description = "ARN of the API keys secret"
  value       = aws_secretsmanager_secret.api_keys.arn
}

# KMS Key Outputs
output "eks_kms_key_arn" {
  description = "ARN of the KMS key used for EKS encryption"
  value       = aws_kms_key.eks.arn
}

output "rds_kms_key_arn" {
  description = "ARN of the KMS key used for RDS encryption"
  value       = aws_kms_key.rds.arn
}

output "s3_kms_key_arn" {
  description = "ARN of the KMS key used for S3 encryption"
  value       = aws_kms_key.s3.arn
}

# Security Group Outputs
output "eks_cluster_security_group_id" {
  description = "Security group ID for EKS cluster"
  value       = aws_security_group.eks_cluster.id
}

output "eks_nodes_security_group_id" {
  description = "Security group ID for EKS nodes"
  value       = aws_security_group.eks_nodes.id
}

output "rds_security_group_id" {
  description = "Security group ID for RDS"
  value       = aws_security_group.rds.id
}

output "elasticache_security_group_id" {
  description = "Security group ID for ElastiCache"
  value       = aws_security_group.elasticache.id
}

output "alb_security_group_id" {
  description = "Security group ID for Application Load Balancer"
  value       = aws_security_group.alb.id
}# CI/CD Out
puts
output "codepipeline_name" {
  description = "Name of the CodePipeline"
  value       = aws_codepipeline.main_pipeline.name
}

output "codepipeline_arn" {
  description = "ARN of the CodePipeline"
  value       = aws_codepipeline.main_pipeline.arn
}

output "codebuild_projects" {
  description = "CodeBuild project names"
  value = {
    build_and_test     = aws_codebuild_project.build_and_test.name
    security_scan      = aws_codebuild_project.security_scan.name
    deploy_staging     = aws_codebuild_project.deploy_staging.name
    deploy_production  = aws_codebuild_project.deploy_production.name
  }
}

output "ecr_repositories" {
  description = "ECR repository URLs"
  value = {
    for service, repo in aws_ecr_repository.microservice_repos :
    service => repo.repository_url
  }
}

output "artifacts_bucket" {
  description = "S3 bucket for CodePipeline artifacts"
  value       = aws_s3_bucket.codepipeline_artifacts.bucket
}

output "pipeline_notifications_topic" {
  description = "SNS topic for pipeline notifications"
  value       = aws_sns_topic.pipeline_notifications.arn
}#
 ML/AI Infrastructure Outputs
output "ml_models_bucket" {
  description = "S3 bucket for ML models"
  value       = aws_s3_bucket.ml_models.bucket
}

output "sagemaker_recommendation_endpoint" {
  description = "SageMaker recommendation model endpoint"
  value       = aws_sagemaker_endpoint.recommendation_endpoint.name
}

output "sagemaker_sentiment_endpoint" {
  description = "SageMaker sentiment analysis endpoint"
  value       = aws_sagemaker_endpoint.sentiment_endpoint.name
}

output "bedrock_nlp_api_url" {
  description = "Bedrock NLP API Gateway URL"
  value       = "https://${aws_api_gateway_rest_api.bedrock_nlp_api.id}.execute-api.${var.aws_region}.amazonaws.com/${var.environment}"
}

output "ml_lambda_functions" {
  description = "ML Lambda function names"
  value = {
    bedrock_nlp_processor      = aws_lambda_function.bedrock_nlp_processor.function_name
    model_version_manager      = aws_lambda_function.model_version_manager.function_name
    ab_test_manager           = aws_lambda_function.ab_test_manager.function_name
    model_performance_monitor = aws_lambda_function.model_performance_monitor.function_name
    model_retraining_trigger  = aws_lambda_function.model_retraining_trigger.function_name
  }
}

output "ml_dynamodb_tables" {
  description = "ML DynamoDB table names"
  value = {
    model_versions           = aws_dynamodb_table.model_versions.name
    ab_test_configs         = aws_dynamodb_table.ab_test_configs.name
    ab_test_results         = aws_dynamodb_table.ab_test_results.name
    model_performance_metrics = aws_dynamodb_table.model_performance_metrics.name
  }
}

output "ml_monitoring_dashboard" {
  description = "CloudWatch dashboard for ML monitoring"
  value       = aws_cloudwatch_dashboard.ml_monitoring_dashboard.dashboard_name
}

output "ml_alerts_topic" {
  description = "SNS topic for ML alerts"
  value       = aws_sns_topic.ml_alerts.arn
}

output "sagemaker_execution_role_arn" {
  description = "SageMaker execution role ARN"
  value       = aws_iam_role.sagemaker_execution_role.arn
}

output "bedrock_access_role_arn" {
  description = "Bedrock access role ARN"
  value       = aws_iam_role.bedrock_access_role.arn
}