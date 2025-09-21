# KMS Key for Data Encryption at Rest and in Transit

resource "aws_kms_key" "app_encryption_key" {
  description             = "KMS key for ${var.project_name} application encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow use of the key for application services"
        Effect = "Allow"
        Principal = {
          AWS = [
            aws_iam_role.user_service_role.arn,
            aws_iam_role.restaurant_service_role.arn,
            aws_iam_role.recommendation_service_role.arn,
            aws_iam_role.data_integration_service_role.arn
          ]
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-encryption-key"
  })
}

resource "aws_kms_alias" "app_encryption_key_alias" {
  name          = "alias/${var.project_name}-encryption-key"
  target_key_id = aws_kms_key.app_encryption_key.key_id
}

# KMS Key for RDS Encryption
resource "aws_kms_key" "rds_encryption_key" {
  description             = "KMS key for ${var.project_name} RDS encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow RDS to use the key"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-rds-encryption-key"
  })
}

resource "aws_kms_alias" "rds_encryption_key_alias" {
  name          = "alias/${var.project_name}-rds-encryption-key"
  target_key_id = aws_kms_key.rds_encryption_key.key_id
}

# KMS Key for S3 Encryption
resource "aws_kms_key" "s3_encryption_key" {
  description             = "KMS key for ${var.project_name} S3 encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow S3 to use the key"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-s3-encryption-key"
  })
}

resource "aws_kms_alias" "s3_encryption_key_alias" {
  name          = "alias/${var.project_name}-s3-encryption-key"
  target_key_id = aws_kms_key.s3_encryption_key.key_id
}