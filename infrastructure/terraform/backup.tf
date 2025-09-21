# AWS Backup Configuration for Disaster Recovery

# Backup Vault
resource "aws_backup_vault" "main" {
  name        = "${var.project_name}-backup-vault"
  kms_key_arn = aws_kms_key.app_encryption_key.arn

  tags = var.common_tags
}

# Backup Plan
resource "aws_backup_plan" "main" {
  name = "${var.project_name}-backup-plan"

  rule {
    rule_name         = "daily_backup"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 5 ? * * *)" # Daily at 5 AM UTC

    lifecycle {
      cold_storage_after = 30
      delete_after       = 120
    }

    recovery_point_tags = var.common_tags
  }

  rule {
    rule_name         = "weekly_backup"
    target_vault_name = aws_backup_vault.main.name
    schedule          = "cron(0 5 ? * SUN *)" # Weekly on Sunday at 5 AM UTC

    lifecycle {
      cold_storage_after = 30
      delete_after       = 365
    }

    recovery_point_tags = merge(var.common_tags, {
      BackupType = "weekly"
    })
  }

  tags = var.common_tags
}

# Backup Selection for RDS
resource "aws_backup_selection" "rds_backup" {
  iam_role_arn = aws_iam_role.backup_role.arn
  name         = "${var.project_name}-rds-backup"
  plan_id      = aws_backup_plan.main.id

  resources = [
    aws_db_instance.user_db.arn,
    aws_db_instance.restaurant_db.arn
  ]

  condition {
    string_equals {
      key   = "aws:ResourceTag/Environment"
      value = var.environment
    }
  }
}

# Backup Selection for S3
resource "aws_backup_selection" "s3_backup" {
  iam_role_arn = aws_iam_role.backup_role.arn
  name         = "${var.project_name}-s3-backup"
  plan_id      = aws_backup_plan.main.id

  resources = [
    aws_s3_bucket.reviews_media.arn,
    aws_s3_bucket.platform_data_archive.arn
  ]

  condition {
    string_equals {
      key   = "aws:ResourceTag/Environment"
      value = var.environment
    }
  }
}

# IAM Role for AWS Backup
resource "aws_iam_role" "backup_role" {
  name = "${var.project_name}-backup-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "backup.amazonaws.com"
        }
      }
    ]
  })

  tags = var.common_tags
}

resource "aws_iam_role_policy_attachment" "backup_policy" {
  role       = aws_iam_role.backup_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}

resource "aws_iam_role_policy_attachment" "restore_policy" {
  role       = aws_iam_role.backup_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForRestores"
}

resource "aws_iam_role_policy_attachment" "s3_backup_policy" {
  role       = aws_iam_role.backup_role.name
  policy_arn = "arn:aws:iam::aws:policy/AWSBackupServiceRolePolicyForS3Backup"
}

resource "aws_iam_role_policy_attachment" "s3_restore_policy" {
  role       = aws_iam_role.backup_role.name
  policy_arn = "arn:aws:iam::aws:policy/AWSBackupServiceRolePolicyForS3Restore"
}

# RDS Automated Backups Configuration (already in rds.tf, but ensuring proper settings)
resource "aws_db_parameter_group" "backup_optimized" {
  family = "postgres14"
  name   = "${var.project_name}-backup-optimized"

  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  tags = var.common_tags
}

# Point-in-time recovery settings are handled in rds.tf
# Snapshot settings are handled in rds.tf

# ElastiCache Backup Configuration
resource "aws_elasticache_parameter_group" "backup_enabled" {
  family = "redis7"
  name   = "${var.project_name}-redis-backup"

  parameter {
    name  = "save"
    value = "900 1 300 10 60 10000"
  }

  tags = var.common_tags
}

# CloudWatch Alarms for Backup Monitoring
resource "aws_cloudwatch_metric_alarm" "backup_failure" {
  alarm_name          = "${var.project_name}-backup-failure"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "NumberOfBackupJobsFailed"
  namespace           = "AWS/Backup"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors backup job failures"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    BackupVaultName = aws_backup_vault.main.name
  }

  tags = var.common_tags
}

# SNS Topic for Backup Alerts
resource "aws_sns_topic" "alerts" {
  name              = "${var.project_name}-backup-alerts"
  kms_master_key_id = aws_kms_key.app_encryption_key.id

  tags = var.common_tags
}