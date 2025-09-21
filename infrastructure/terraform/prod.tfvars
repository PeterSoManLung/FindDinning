# Production environment configuration for Find Dining application

# AWS Configuration
aws_region = "ap-southeast-1"
environment = "prod"
project_name = "find-dining"

# Network Configuration
vpc_cidr = "10.0.0.0/16"
private_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
public_subnet_cidrs = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
database_subnet_cidrs = ["10.0.201.0/24", "10.0.202.0/24", "10.0.203.0/24"]

# EKS Configuration - production-ready instances
eks_node_instance_types = ["t3.large", "t3.xlarge"]
eks_node_desired_capacity = 5
eks_node_max_capacity = 20
eks_node_min_capacity = 3

# RDS Configuration - production-ready instances
rds_instance_class = "db.t3.small"
rds_allocated_storage = 100

# ElastiCache Configuration - production-ready instances
redis_node_type = "cache.t3.small"
redis_num_cache_nodes = 3

# Network Configuration
enable_nat_gateway = true
enable_vpn_gateway = false

# Security Configuration - restrictive for production
# Update these CIDR blocks to match your organization's IP ranges
allowed_cidr_blocks = ["0.0.0.0/0"]  # TODO: Restrict to specific IP ranges in production