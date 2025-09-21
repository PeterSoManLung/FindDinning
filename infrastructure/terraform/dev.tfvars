# Development environment configuration for Find Dining application

# AWS Configuration
aws_region = "ap-southeast-1"
environment = "dev"
project_name = "find-dining"

# Network Configuration
vpc_cidr = "10.0.0.0/16"
private_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
public_subnet_cidrs = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
database_subnet_cidrs = ["10.0.201.0/24", "10.0.202.0/24", "10.0.203.0/24"]

# EKS Configuration - smaller instances for dev
eks_node_instance_types = ["t3.small", "t3.medium"]
eks_node_desired_capacity = 2
eks_node_max_capacity = 5
eks_node_min_capacity = 1

# RDS Configuration - smaller instances for dev
rds_instance_class = "db.t3.micro"
rds_allocated_storage = 20

# ElastiCache Configuration - smaller instances for dev
redis_node_type = "cache.t3.micro"
redis_num_cache_nodes = 1

# Network Configuration
enable_nat_gateway = true
enable_vpn_gateway = false

# Security Configuration - more permissive for dev
allowed_cidr_blocks = ["0.0.0.0/0"]