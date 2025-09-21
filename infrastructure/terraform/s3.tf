# S3 Configuration for Find Dining application

# S3 Bucket for Reviews and Media
resource "aws_s3_bucket" "reviews_media" {
  bucket = "${var.project_name}-${var.environment}-reviews-media-${random_string.bucket_suffix.result}"

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-reviews-media"
    Purpose = "reviews-and-media-storage"
  })
}

resource "aws_s3_bucket_versioning" "reviews_media" {
  bucket = aws_s3_bucket.reviews_media.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_encryption" "reviews_media" {
  bucket = aws_s3_bucket.reviews_media.id

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        kms_master_key_id = aws_kms_key.s3.arn
        sse_algorithm     = "aws:kms"
      }
    }
  }
}

resource "aws_s3_bucket_public_access_block" "reviews_media" {
  bucket = aws_s3_bucket.reviews_media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "reviews_media" {
  bucket = aws_s3_bucket.reviews_media.id

  rule {
    id     = "reviews_media_lifecycle"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    transition {
      days          = 365
      storage_class = "DEEP_ARCHIVE"
    }
  }
}

# S3 Bucket for Platform Data Archive
resource "aws_s3_bucket" "platform_data" {
  bucket = "${var.project_name}-${var.environment}-platform-data-${random_string.bucket_suffix.result}"

  tags = merge(local.common_tags, {
    Name = "${var.project_name}-${var.environment}-platform-data"
    Purpose = "platform-data-archive"
  })
}

resource "aws_s3_bucket_versioning" "platform_data" {
  bucket = aws_s3_bucket.platform_data.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_encryption" "platform_data" {
  bucket = aws_s3_bucket.platform_data.id

  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        kms_master_key_id = aws_kms_key.s3.arn
        sse_algorithm     = "aws:kms"
      }
    }
  }
}

resource "aws_s3_bucket_public_access_block" "platform_data" {
  bucket = aws_s3_bucket.platform_data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "platform_data" {
  bucket = aws_s3_bucket.platform_data.id

  rule {
    id     = "platform_data_lifecycle"
    status = "Enabled"

    transition {
      days          = 7
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 30
      storage_class = "GLACIER"
    }

    transition {
      days          = 90
      storage_class = "DEEP_ARCHIVE"
    }
  }
}

# S3 Bucket for Terraform State (commented out as it should be created manually first)
# resource "aws_s3_bucket" "terraform_state" {
#   bucket = "${var.project_name}-${var.environment}-terraform-state-${random_string.bucket_suffix.result}"
#   
#   tags = merge(local.common_tags, {
#     Name = "${var.project_name}-${var.environment}-terraform-state"
#     Purpose = "terraform-state-storage"
#   })
# }

# Random string for bucket suffix to ensure uniqueness
resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

# KMS Key for S3 encryption
resource "aws_kms_key" "s3" {
  description             = "S3 encryption key"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = local.common_tags
}

resource "aws_kms_alias" "s3" {
  name          = "alias/${var.project_name}-${var.environment}-s3"
  target_key_id = aws_kms_key.s3.key_id
}

# IAM Policy for S3 access
resource "aws_iam_policy" "s3_access" {
  name        = "${var.project_name}-${var.environment}-s3-access"
  description = "IAM policy for S3 access"

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
          aws_s3_bucket.reviews_media.arn,
          "${aws_s3_bucket.reviews_media.arn}/*",
          aws_s3_bucket.platform_data.arn,
          "${aws_s3_bucket.platform_data.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = [
          aws_kms_key.s3.arn
        ]
      }
    ]
  })

  tags = local.common_tags
}