# Find Dining Infrastructure

This directory contains the infrastructure as code (IaC) and deployment scripts for the 搵食 (Find Dining) application. The infrastructure is built on AWS using Terraform for resource provisioning and Kubernetes for container orchestration.

## Architecture Overview

The Find Dining application follows a microservices architecture deployed on Amazon EKS with the following components:

### AWS Services Used

- **Amazon EKS**: Kubernetes cluster for container orchestration
- **Amazon RDS**: PostgreSQL databases for user and restaurant data
- **Amazon ElastiCache**: Redis clusters for caching and session storage
- **Amazon S3**: Object storage for reviews, media, and platform data
- **AWS API Gateway**: API management and routing
- **Amazon SageMaker**: ML models for recommendations
- **Amazon Bedrock**: Natural language processing
- **AWS Secrets Manager**: Secure credential storage
- **Amazon CloudWatch**: Monitoring and logging
- **AWS KMS**: Encryption key management

### Microservices

1. **API Gateway** (Port 3000): Main entry point and request routing
2. **User Service** (Port 3001): User management and authentication
3. **Restaurant Service** (Port 3002): Restaurant data and search
4. **Recommendation Engine** (Port 3003): AI-powered recommendations
5. **Review Service** (Port 3004): Review management and analysis
6. **Emotion Service** (Port 3005): Emotion analysis and mood mapping
7. **Data Integration Service** (Port 3006): External data synchronization

## Directory Structure

```
infrastructure/
├── terraform/                 # Terraform infrastructure code
│   ├── main.tf               # Main Terraform configuration
│   ├── variables.tf          # Variable definitions
│   ├── vpc.tf                # VPC and networking
│   ├── security-groups.tf    # Security group configurations
│   ├── eks.tf                # EKS cluster configuration
│   ├── rds.tf                # RDS database configuration
│   ├── s3.tf                 # S3 bucket configuration
│   ├── elasticache.tf        # ElastiCache Redis configuration
│   ├── api-gateway.tf        # API Gateway configuration
│   ├── outputs.tf            # Terraform outputs
│   ├── dev.tfvars            # Development environment variables
│   ├── prod.tfvars           # Production environment variables
│   └── terraform.tfvars.example # Example variables file
├── k8s/                      # Kubernetes manifests
│   ├── namespace.yaml        # Kubernetes namespace
│   ├── configmap.yaml        # Configuration data
│   ├── secrets.yaml          # Secret templates
│   ├── rbac.yaml             # Role-based access control
│   ├── api-gateway-deployment.yaml # API Gateway deployment
│   ├── microservices-deployments.yaml # All microservice deployments
│   └── ingress.yaml          # Ingress configuration
├── scripts/                  # Deployment scripts
│   ├── deploy-infrastructure.sh # Deploy AWS infrastructure
│   ├── deploy-k8s.sh         # Deploy Kubernetes resources
│   └── build-and-push-images.sh # Build and push Docker images
└── README.md                 # This file
```

## Prerequisites

Before deploying the infrastructure, ensure you have the following tools installed:

### Required Tools

1. **Terraform** (>= 1.0)
   ```bash
   # Install using package manager or download from https://terraform.io
   terraform --version
   ```

2. **AWS CLI** (>= 2.0)
   ```bash
   # Install and configure
   aws --version
   aws configure
   ```

3. **kubectl** (>= 1.28)
   ```bash
   # Install kubectl
   kubectl version --client
   ```

4. **Docker** (>= 20.0)
   ```bash
   # Install Docker
   docker --version
   ```

5. **Helm** (>= 3.0)
   ```bash
   # Install Helm
   helm version
   ```

6. **eksctl** (optional, for easier EKS management)
   ```bash
   # Install eksctl
   eksctl version
   ```

### AWS Permissions

Your AWS user/role needs the following permissions:
- EC2 (VPC, Security Groups, Key Pairs)
- EKS (Cluster and Node Group management)
- RDS (Database instances and parameter groups)
- ElastiCache (Redis clusters)
- S3 (Bucket creation and management)
- IAM (Role and policy management)
- Secrets Manager (Secret creation and access)
- KMS (Key management)
- CloudWatch (Logging and monitoring)
- API Gateway (REST API management)

## Deployment Guide

### Step 1: Deploy AWS Infrastructure

1. **Clone the repository and navigate to the infrastructure directory:**
   ```bash
   cd infrastructure
   ```

2. **Copy and customize the Terraform variables:**
   ```bash
   cp terraform/terraform.tfvars.example terraform/terraform.tfvars
   # Edit terraform.tfvars with your specific values
   ```

3. **Deploy the infrastructure:**
   ```bash
   # For development environment
   ./scripts/deploy-infrastructure.sh dev

   # For production environment
   ./scripts/deploy-infrastructure.sh prod
   ```

   This script will:
   - Initialize Terraform
   - Create a deployment plan
   - Deploy AWS resources (VPC, EKS, RDS, ElastiCache, S3, etc.)
   - Update kubeconfig for EKS access
   - Install necessary Kubernetes controllers

### Step 2: Build and Push Docker Images

1. **Build and push all microservice images to ECR:**
   ```bash
   # Build with latest tag
   ./scripts/build-and-push-images.sh dev

   # Build with specific version tag
   ./scripts/build-and-push-images.sh dev ap-southeast-1 v1.0.0
   ```

   This script will:
   - Build Docker images for all microservices
   - Push images to Amazon ECR repositories
   - Update Kubernetes manifests with correct image tags

### Step 3: Deploy Kubernetes Resources

1. **Deploy the application to Kubernetes:**
   ```bash
   # Deploy to development environment
   ./scripts/deploy-k8s.sh dev

   # Deploy to production environment
   ./scripts/deploy-k8s.sh prod
   ```

   This script will:
   - Create Kubernetes namespace and RBAC
   - Deploy ConfigMaps and Secrets
   - Deploy all microservices
   - Configure ingress and load balancer

### Step 4: Verify Deployment

1. **Check the status of your deployment:**
   ```bash
   # Check pods
   kubectl get pods -n find-dining

   # Check services
   kubectl get services -n find-dining

   # Check ingress
   kubectl get ingress -n find-dining

   # Get load balancer URL
   kubectl get ingress find-dining-ingress -n find-dining -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
   ```

2. **Test the API endpoints:**
   ```bash
   # Get the load balancer URL
   LB_URL=$(kubectl get ingress find-dining-ingress -n find-dining -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

   # Test health endpoints
   curl http://$LB_URL/health
   curl http://$LB_URL/api/users/health
   curl http://$LB_URL/api/restaurants/health
   ```

## Environment Configuration

### Development Environment

The development environment uses smaller instance sizes and relaxed security settings:

- **EKS Nodes**: t3.small, t3.medium (2-5 nodes)
- **RDS**: db.t3.micro (20GB storage)
- **ElastiCache**: cache.t3.micro (1 node)
- **Security**: More permissive CIDR blocks for testing

### Production Environment

The production environment uses production-ready configurations:

- **EKS Nodes**: t3.large, t3.xlarge (3-20 nodes)
- **RDS**: db.t3.small (100GB storage, Multi-AZ)
- **ElastiCache**: cache.t3.small (3 nodes with failover)
- **Security**: Restricted access, encryption enabled
- **Backup**: Automated backups and snapshots

## Security Considerations

### Network Security

- **VPC**: Isolated network with public, private, and database subnets
- **Security Groups**: Restrictive rules for each service
- **Network Policies**: Kubernetes network policies for pod-to-pod communication
- **NAT Gateways**: Secure outbound internet access for private subnets

### Data Security

- **Encryption at Rest**: All databases and S3 buckets encrypted with KMS
- **Encryption in Transit**: TLS/SSL for all communications
- **Secrets Management**: AWS Secrets Manager for sensitive data
- **IAM Roles**: Least privilege access with service-specific roles

### Application Security

- **Container Security**: Non-root containers with security contexts
- **Image Scanning**: ECR vulnerability scanning enabled
- **RBAC**: Kubernetes role-based access control
- **Network Policies**: Pod-to-pod communication restrictions

## Monitoring and Logging

### CloudWatch Integration

- **Application Logs**: Centralized logging for all microservices
- **Infrastructure Metrics**: EKS, RDS, ElastiCache metrics
- **Custom Metrics**: Business metrics and performance indicators
- **Alerting**: Automated alerts for failures and performance issues

### Health Checks

- **Kubernetes Probes**: Liveness and readiness probes for all services
- **Load Balancer Health Checks**: ALB health check configuration
- **Database Monitoring**: RDS Enhanced Monitoring enabled

## Scaling and Performance

### Auto Scaling

- **EKS Cluster Autoscaler**: Automatic node scaling based on demand
- **Horizontal Pod Autoscaler**: Pod scaling based on CPU/memory usage
- **RDS Auto Scaling**: Storage auto-scaling for databases

### Performance Optimization

- **Caching**: Redis caching for frequently accessed data
- **CDN**: CloudFront for static content delivery (optional)
- **Connection Pooling**: Database connection pooling
- **Resource Limits**: Proper CPU and memory limits for containers

## Backup and Disaster Recovery

### Database Backups

- **Automated Backups**: Daily RDS backups with 7-day retention
- **Point-in-Time Recovery**: RDS PITR enabled
- **Cross-Region Backups**: Optional for production environments

### Application Data

- **S3 Versioning**: Object versioning for data protection
- **Cross-Region Replication**: Optional for critical data
- **Lifecycle Policies**: Automated data archival

## Cost Optimization

### Resource Optimization

- **Right-Sizing**: Appropriate instance sizes for workloads
- **Spot Instances**: Use spot instances for non-critical workloads
- **Reserved Instances**: Reserved capacity for predictable workloads
- **Storage Optimization**: Lifecycle policies for S3 data

### Monitoring Costs

- **Cost Explorer**: Regular cost analysis and optimization
- **Budgets**: AWS budgets with alerts
- **Resource Tagging**: Comprehensive tagging for cost allocation

## Troubleshooting

### Common Issues

1. **EKS Node Group Issues**
   ```bash
   # Check node status
   kubectl get nodes
   
   # Describe problematic nodes
   kubectl describe node <node-name>
   ```

2. **Pod Startup Issues**
   ```bash
   # Check pod logs
   kubectl logs <pod-name> -n find-dining
   
   # Describe pod for events
   kubectl describe pod <pod-name> -n find-dining
   ```

3. **Database Connection Issues**
   ```bash
   # Check database security groups
   aws ec2 describe-security-groups --group-ids <sg-id>
   
   # Test database connectivity from pod
   kubectl exec -it <pod-name> -n find-dining -- nc -zv <db-host> 5432
   ```

4. **Load Balancer Issues**
   ```bash
   # Check ingress status
   kubectl describe ingress find-dining-ingress -n find-dining
   
   # Check AWS Load Balancer Controller logs
   kubectl logs -n kube-system deployment/aws-load-balancer-controller
   ```

### Useful Commands

```bash
# Get all resources in namespace
kubectl get all -n find-dining

# Port forward to service for testing
kubectl port-forward service/api-gateway 8080:3000 -n find-dining

# Execute shell in pod
kubectl exec -it <pod-name> -n find-dining -- /bin/bash

# View resource usage
kubectl top pods -n find-dining
kubectl top nodes

# Check cluster info
kubectl cluster-info
kubectl get componentstatuses
```

## Cleanup

To destroy the infrastructure and avoid ongoing costs:

```bash
# Delete Kubernetes resources
kubectl delete namespace find-dining

# Destroy Terraform infrastructure
cd terraform
terraform destroy -var-file="dev.tfvars"
```

**Warning**: This will permanently delete all resources and data. Make sure to backup any important data before running cleanup commands.

## Support

For issues and questions:

1. Check the troubleshooting section above
2. Review AWS CloudWatch logs
3. Check Kubernetes events and pod logs
4. Consult the AWS and Kubernetes documentation

## Contributing

When making changes to the infrastructure:

1. Test changes in development environment first
2. Update documentation for any new components
3. Follow security best practices
4. Use proper resource tagging
5. Update cost estimates for new resources