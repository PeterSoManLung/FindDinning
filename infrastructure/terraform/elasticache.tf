# ElastiCache Configuration for Find Dining application

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-cache-subnet"
  subnet_ids = aws_subnet.private[*].id

  tags = local.common_tags
}

# ElastiCache Parameter Group
resource "aws_elasticache_parameter_group" "redis" {
  family = "redis7.x"
  name   = "${var.project_name}-${var.environment}-redis-params"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  tags = local.common_tags
}

# ElastiCache Redis Cluster for Caching
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id         = "${var.project_name}-${var.environment}-redis"
  description                  = "Redis cluster for Find Dining application caching"
  
  node_type                    = var.redis_node_type
  port                         = 6379
  parameter_group_name         = aws_elasticache_parameter_group.redis.name
  
  num_cache_clusters           = var.redis_num_cache_nodes
  
  engine_version               = "7.0"
  
  subnet_group_name            = aws_elasticache_subnet_group.main.name
  security_group_ids           = [aws_security_group.elasticache.id]
  
  at_rest_encryption_enabled   = true
  transit_encryption_enabled   = true
  auth_token                   = random_password.redis_auth_token.result
  
  # Backup configuration
  snapshot_retention_limit     = 5
  snapshot_window              = "03:00-05:00"
  
  # Maintenance window
  maintenance_window           = "sun:05:00-sun:07:00"
  
  # Auto failover
  automatic_failover_enabled   = var.redis_num_cache_nodes > 1 ? true : false
  multi_az_enabled            = var.redis_num_cache_nodes > 1 ? true : false
  
  # Logging
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "text"
    log_type         = "slow-log"
  }

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-redis"
  })
}

# Random password for Redis authentication
resource "random_password" "redis_auth_token" {
  length  = 32
  special = true
}

# CloudWatch Log Group for Redis slow logs
resource "aws_cloudwatch_log_group" "redis_slow_log" {
  name              = "/aws/elasticache/redis/${var.project_name}-${var.environment}"
  retention_in_days = 7

  tags = local.common_tags
}

# Store Redis credentials in Secrets Manager
resource "aws_secretsmanager_secret" "redis_credentials" {
  name = "${var.project_name}-${var.environment}-redis-credentials"
  description = "Redis credentials for Find Dining application"

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "redis_credentials" {
  secret_id = aws_secretsmanager_secret.redis_credentials.id
  secret_string = jsonencode({
    auth_token = random_password.redis_auth_token.result
    endpoint = aws_elasticache_replication_group.redis.primary_endpoint_address
    port = aws_elasticache_replication_group.redis.port
  })
}

# ElastiCache Redis Cluster for Session Storage (separate cluster)
resource "aws_elasticache_replication_group" "sessions" {
  replication_group_id         = "${var.project_name}-${var.environment}-sessions"
  description                  = "Redis cluster for session storage"
  
  node_type                    = "cache.t3.micro"
  port                         = 6379
  parameter_group_name         = aws_elasticache_parameter_group.redis.name
  
  num_cache_clusters           = 1
  
  engine_version               = "7.0"
  
  subnet_group_name            = aws_elasticache_subnet_group.main.name
  security_group_ids           = [aws_security_group.elasticache.id]
  
  at_rest_encryption_enabled   = true
  transit_encryption_enabled   = true
  auth_token                   = random_password.redis_sessions_auth_token.result
  
  # Backup configuration
  snapshot_retention_limit     = 1
  snapshot_window              = "03:00-05:00"
  
  # Maintenance window
  maintenance_window           = "sun:05:00-sun:07:00"
  
  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-sessions"
    Purpose = "session-storage"
  })
}

# Random password for Redis sessions authentication
resource "random_password" "redis_sessions_auth_token" {
  length  = 32
  special = true
}

# Store Redis sessions credentials in Secrets Manager
resource "aws_secretsmanager_secret" "redis_sessions_credentials" {
  name = "${var.project_name}-${var.environment}-redis-sessions-credentials"
  description = "Redis sessions credentials for Find Dining application"

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "redis_sessions_credentials" {
  secret_id = aws_secretsmanager_secret.redis_sessions_credentials.id
  secret_string = jsonencode({
    auth_token = random_password.redis_sessions_auth_token.result
    endpoint = aws_elasticache_replication_group.sessions.primary_endpoint_address
    port = aws_elasticache_replication_group.sessions.port
  })
}