# Security and Compliance Configuration

This document outlines the comprehensive security and compliance measures implemented for the AI Restaurant Recommendation system in accordance with GDPR requirements and AWS security best practices.

## 🔒 Security Architecture Overview

The security architecture follows a defense-in-depth approach with multiple layers of protection:

1. **Network Security**: VPC with proper segmentation and security groups
2. **Identity and Access Management**: Least privilege IAM roles and policies
3. **Data Encryption**: End-to-end encryption at rest and in transit
4. **API Protection**: AWS WAF with comprehensive rule sets
5. **Monitoring and Threat Detection**: GuardDuty, Security Hub, and Config
6. **Backup and Recovery**: Automated backups with encryption
7. **GDPR Compliance**: Data export and deletion capabilities
8. **Vulnerability Management**: Automated security scanning

## 🛡️ Security Components

### 1. IAM Roles and Policies (Least Privilege)

#### Service-Specific Roles
- **EKS Cluster Role**: Minimal permissions for cluster management
- **User Service Role**: Access only to user database and cache
- **Restaurant Service Role**: Access only to restaurant database and cache
- **Recommendation Service Role**: Access to ML services and cache
- **Data Integration Service Role**: Access to S3 platform data archive
- **Security Lambda Role**: Permissions for security scanning functions
- **GDPR Lambda Role**: Permissions for data export/deletion operations
- **Backup Role**: Permissions for AWS Backup operations

#### Key Security Features
- No wildcard permissions
- Resource-specific access controls
- Cross-service access restrictions
- Regular access reviews through AWS Config

### 2. Data Encryption

#### KMS Key Management
- **Application Encryption Key**: General application data encryption
- **RDS Encryption Key**: Database-specific encryption
- **S3 Encryption Key**: Object storage encryption
- **Key Rotation**: Automatic annual key rotation enabled
- **Key Policies**: Restrictive policies with service-specific access

#### Encryption Implementation
- **RDS**: Encrypted at rest using customer-managed KMS keys
- **S3**: Server-side encryption with KMS keys
- **ElastiCache**: Encryption at rest and in transit
- **Lambda**: Environment variables encrypted with KMS
- **Secrets Manager**: Database credentials encrypted

### 3. Network Security

#### VPC Configuration
- **Private Subnets**: All application components in private subnets
- **Database Subnets**: Isolated database subnet group
- **Security Groups**: Restrictive ingress/egress rules
- **NACLs**: Additional network-level access controls
- **VPC Flow Logs**: Network traffic monitoring

#### Security Group Rules
- **Database SG**: Only port 5432 from application subnets
- **Application SG**: Only necessary ports between services
- **Lambda SG**: Outbound HTTPS and database access only
- **Load Balancer SG**: HTTPS traffic from internet

### 4. AWS WAF Protection

#### Web ACL Rules
1. **Rate Limiting**: 2000 requests per 5 minutes per IP
2. **SQL Injection Protection**: AWS managed SQL injection rule set
3. **XSS Protection**: Cross-site scripting prevention
4. **Known Bad Inputs**: Protection against known attack patterns
5. **IP Reputation**: Block requests from known malicious IPs
6. **Bot Control**: Advanced bot detection and mitigation
7. **API Endpoint Protection**: Enhanced rate limiting for API endpoints

#### Geographic Restrictions
- Allowed countries: HK, CN, TW, SG, JP, KR, US, CA, GB, AU
- Automatic blocking of requests from other regions

### 5. Security Monitoring

#### AWS GuardDuty
- **Threat Detection**: Malicious activity and unauthorized behavior
- **DNS Monitoring**: Suspicious DNS queries
- **VPC Flow Log Analysis**: Network traffic anomalies
- **S3 Protection**: Bucket compromise detection

#### AWS Security Hub
- **Centralized Findings**: Aggregated security findings
- **Compliance Standards**: CIS, PCI DSS, AWS Foundational Security
- **Custom Insights**: Project-specific security metrics
- **Automated Remediation**: Integration with Lambda for auto-response

#### AWS Config
- **Compliance Monitoring**: Continuous compliance assessment
- **Configuration Drift**: Detection of unauthorized changes
- **Resource Inventory**: Complete infrastructure tracking
- **Remediation**: Automatic correction of non-compliant resources

### 6. Backup and Disaster Recovery

#### AWS Backup Configuration
- **Daily Backups**: All RDS instances and S3 buckets
- **Weekly Backups**: Long-term retention (1 year)
- **Cross-Region Replication**: Disaster recovery preparation
- **Encryption**: All backups encrypted with KMS
- **Lifecycle Management**: Automatic transition to cold storage

#### Recovery Procedures
- **RTO**: 4 hours for critical services
- **RPO**: 1 hour maximum data loss
- **Testing**: Monthly disaster recovery drills
- **Documentation**: Detailed recovery procedures

### 7. GDPR Compliance

#### Data Subject Rights Implementation

##### Right of Access (Article 15)
- **Data Export Lambda**: Automated user data export
- **Export Format**: JSON with complete user data
- **Secure Delivery**: Presigned S3 URLs with 24-hour expiry
- **Data Categories**: Profile, preferences, reviews, recommendations

##### Right to Erasure (Article 17)
- **Data Deletion Lambda**: Complete user data removal
- **Cross-Service Deletion**: User, restaurant, and review databases
- **S3 Cleanup**: User-generated content removal
- **Audit Logging**: Complete deletion audit trail

#### Data Processing Compliance
- **Lawful Basis**: Consent and legitimate interest
- **Data Minimization**: Only necessary data collection
- **Purpose Limitation**: Data used only for stated purposes
- **Retention Limits**: Automatic data deletion after 7 years
- **Privacy by Design**: Built-in privacy protections

#### GDPR Technical Measures
- **Pseudonymization**: User IDs instead of personal identifiers
- **Access Controls**: Role-based data access
- **Audit Trails**: Complete data processing logs
- **Data Breach Response**: Automated incident response

### 8. Vulnerability Management

#### Automated Security Scanning
- **AWS Inspector V2**: Container and EC2 vulnerability scanning
- **Daily Scans**: Automated security assessment
- **Critical Alert Threshold**: Immediate notification for high/critical findings
- **Remediation Tracking**: Vulnerability lifecycle management

#### Security Scanner Lambda
- **Multi-Service Scanning**: Inspector, GuardDuty, Security Hub, Config
- **Automated Reporting**: Daily security status reports
- **Alert Integration**: SNS notifications for critical issues
- **Trend Analysis**: Security posture improvement tracking

## 🔧 Implementation Guide

### 1. Deploy Security Infrastructure

```bash
# Deploy security components
cd infrastructure/terraform
terraform init
terraform plan -var-file="security.tfvars"
terraform apply -var-file="security.tfvars"
```

### 2. Configure Security Services

```bash
# Enable security services
aws guardduty create-detector --enable
aws securityhub enable-security-hub --enable-default-standards
aws inspector2 enable --resource-types ECR EC2
```

### 3. Validate Security Configuration

```bash
# Run security validation
./infrastructure/scripts/validate-security-compliance.sh
```

### 4. Set Up Monitoring

```bash
# Configure CloudWatch alarms
aws cloudwatch put-metric-alarm --alarm-name "SecurityFindings" \
  --alarm-description "Monitor security findings" \
  --metric-name "Findings" --namespace "AWS/SecurityHub" \
  --statistic Sum --period 300 --threshold 1 \
  --comparison-operator GreaterThanThreshold
```

## 📊 Security Metrics and KPIs

### Security Posture Metrics
- **Mean Time to Detection (MTTD)**: < 15 minutes
- **Mean Time to Response (MTTR)**: < 1 hour
- **Vulnerability Remediation**: 95% within 30 days
- **Security Training Completion**: 100% annually

### Compliance Metrics
- **Config Rule Compliance**: > 95%
- **Security Hub Score**: > 80%
- **GDPR Request Response Time**: < 30 days
- **Data Breach Notification**: < 72 hours

## 🚨 Incident Response

### Security Incident Classification
1. **Critical**: Data breach, system compromise
2. **High**: Unauthorized access, service disruption
3. **Medium**: Policy violations, suspicious activity
4. **Low**: Configuration drift, minor vulnerabilities

### Response Procedures
1. **Detection**: Automated alerts and monitoring
2. **Assessment**: Severity and impact evaluation
3. **Containment**: Immediate threat isolation
4. **Eradication**: Root cause elimination
5. **Recovery**: Service restoration
6. **Lessons Learned**: Post-incident review

## 📋 Security Checklist

### Pre-Production Security Review
- [ ] All IAM roles follow least privilege principle
- [ ] Data encryption enabled for all services
- [ ] WAF rules configured and tested
- [ ] Security monitoring services enabled
- [ ] Backup and recovery procedures tested
- [ ] GDPR compliance functions deployed
- [ ] Vulnerability scanning automated
- [ ] Security documentation complete
- [ ] Incident response plan tested
- [ ] Security training completed

### Ongoing Security Maintenance
- [ ] Monthly security reviews
- [ ] Quarterly penetration testing
- [ ] Annual security audits
- [ ] Regular backup testing
- [ ] Security patch management
- [ ] Access review and cleanup
- [ ] Security metrics monitoring
- [ ] Compliance reporting

## 📞 Security Contacts

### Internal Team
- **Security Lead**: security@findining.com
- **DevOps Team**: devops@findining.com
- **Privacy Officer**: privacy@findining.com

### External Partners
- **AWS Support**: Enterprise support plan
- **Security Consultant**: Third-party security firm
- **Legal Counsel**: GDPR compliance specialist

## 📚 Additional Resources

- [AWS Security Best Practices](https://aws.amazon.com/security/security-resources/)
- [GDPR Compliance Guide](https://gdpr.eu/)
- [OWASP Security Guidelines](https://owasp.org/)
- [CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks/)

---

**Last Updated**: $(date)
**Version**: 1.0
**Review Date**: $(date -d "+3 months")