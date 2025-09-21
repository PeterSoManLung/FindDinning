# Security Configuration Variables for Find Dining Application

# Project Configuration
project_name = "find-dining"
environment  = "prod"
aws_region   = "ap-southeast-1"

# Security Settings
enable_deletion_protection = true
enable_backup_encryption   = true
backup_retention_days      = 30
log_retention_days         = 90

# KMS Configuration
enable_key_rotation = true
key_deletion_window = 7

# WAF Configuration
waf_rate_limit = 2000
allowed_countries = ["HK", "CN", "TW", "SG", "JP", "KR", "US", "CA", "GB", "AU"]

# Monitoring Configuration
enable_guardduty    = true
enable_security_hub = true
enable_config       = true
enable_inspector    = true

# GDPR Configuration
gdpr_data_retention_days = 2555  # 7 years
gdpr_export_expiry_hours = 24

# Security Scanning
security_scan_schedule = "cron(0 2 * * ? *)"  # Daily at 2 AM UTC
vulnerability_scan_schedule = "cron(0 3 * * ? *)"  # Daily at 3 AM UTC

# Backup Configuration
backup_schedule_daily  = "cron(0 5 ? * * *)"     # Daily at 5 AM UTC
backup_schedule_weekly = "cron(0 5 ? * SUN *)"   # Weekly on Sunday at 5 AM UTC

# Database Security
db_backup_retention_period = 7
db_backup_window          = "03:00-04:00"
db_maintenance_window     = "sun:04:00-sun:05:00"
enable_db_monitoring      = true

# Network Security
enable_vpc_flow_logs = true
flow_logs_retention  = 14

# S3 Security
s3_lifecycle_ia_days      = 30
s3_lifecycle_glacier_days = 90
s3_lifecycle_deep_archive_days = 365

# Common Tags
common_tags = {
  Project     = "find-dining"
  Environment = "prod"
  Owner       = "platform-team"
  CostCenter  = "engineering"
  Compliance  = "gdpr"
  Security    = "high"
  Backup      = "required"
  Monitoring  = "enabled"
}