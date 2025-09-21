# Production Data Synchronization System

## Overview

The Production Data Synchronization System is a comprehensive solution for managing data synchronization across all Hong Kong restaurant platforms with enterprise-grade monitoring, backup, and compliance features.

## Architecture

### Components

1. **Sync Orchestrator Lambda** - AWS Lambda function that orchestrates sync operations
2. **Data Integration Service** - Microservice handling platform data extraction and processing
3. **Data Lineage Service** - Tracks data provenance and changes for audit compliance
4. **Data Backup Service** - Manages automated backups and restore operations
5. **Monitoring & Alerting** - CloudWatch-based monitoring with SNS notifications

### Data Flow

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   EventBridge   │───▶│ Sync Orchestrator│───▶│ Data Integration│
│   (Scheduled)   │    │     Lambda       │    │    Service      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   S3 Backup     │    │  Platform APIs  │
                       │    Bucket       │    │ (OpenRice, etc) │
                       └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ Data Lineage    │    │   Restaurant    │
                       │   DynamoDB      │    │   Database      │
                       └─────────────────┘    └─────────────────┘
```

## Features

### 🔄 Automated Synchronization
- **Monthly Full Sync**: Complete data refresh from all Hong Kong platforms
- **Weekly Government Sync**: Regular updates from data.gov.hk
- **Emergency Manual Sync**: On-demand sync with enhanced monitoring
- **Incremental Updates**: Efficient delta synchronization

### 📊 Data Lineage Tracking
- **Complete Audit Trail**: Track every data change with source attribution
- **Compliance Reporting**: GDPR-compliant data lineage exports
- **Data Quality Metrics**: Validation, completeness, accuracy, and consistency scores
- **Change History**: Full historical record of data modifications

### 💾 Backup & Recovery
- **Automated Backups**: Scheduled full and incremental backups
- **Point-in-Time Recovery**: Restore data to any previous state
- **Data Integrity Validation**: Checksum verification for all backups
- **Retention Management**: Automated cleanup based on retention policies

### 🚨 Monitoring & Alerting
- **Real-time Health Monitoring**: System health dashboard with scoring
- **Proactive Alerting**: SNS notifications for failures and performance issues
- **Data Freshness Tracking**: Monitor data staleness across all sources
- **Performance Metrics**: Sync duration, throughput, and error rates

## Deployment

### Prerequisites

- AWS CLI configured with appropriate permissions
- Terraform >= 1.0
- Node.js >= 18.x
- Docker (for containerized deployment)

### Quick Start

1. **Deploy Infrastructure**
   ```bash
   ./infrastructure/scripts/deploy-production-sync.sh staging ap-southeast-1
   ```

2. **Configure Environment Variables**
   ```bash
   # Copy generated environment file
   cp data-integration-service/.env.production-sync data-integration-service/.env
   ```

3. **Deploy Services**
   ```bash
   # Build and deploy data integration service
   docker build -t data-integration-service data-integration-service/
   kubectl apply -f infrastructure/k8s/microservices-deployments.yaml
   ```

4. **Verify Deployment**
   ```bash
   # Test emergency sync functionality
   curl -X POST http://data-integration-service/api/production-sync/emergency \
     -H "Content-Type: application/json" \
     -d '{"reason":"Deployment verification","priority":"low"}'
   ```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENVIRONMENT` | Deployment environment | `development` |
| `AWS_REGION` | AWS region | `ap-southeast-1` |
| `S3_BACKUP_BUCKET` | S3 bucket for backups | - |
| `SNS_TOPIC_ARN` | SNS topic for alerts | - |
| `LINEAGE_TABLE_NAME` | DynamoDB table for lineage | - |
| `BACKUP_RETENTION_DAYS` | Backup retention period | `365` |
| `BACKUP_COMPRESSION` | Enable backup compression | `true` |
| `BACKUP_ENCRYPTION` | Enable backup encryption | `true` |

## API Reference

### Emergency Sync

Trigger emergency synchronization for all platforms:

```http
POST /api/production-sync/emergency
Content-Type: application/json

{
  "reason": "Data quality issue detected",
  "priority": "high"
}
```

### System Health

Get comprehensive system health status:

```http
GET /api/production-sync/health
```

Response:
```json
{
  "success": true,
  "data": {
    "overall": "healthy",
    "healthScore": 95,
    "activeAlerts": 0,
    "criticalAlerts": 0,
    "dataFreshness": [...],
    "recentSyncs": [...],
    "backup": {
      "lastBackup": {
        "timestamp": "2024-01-15T02:00:00Z",
        "recordCount": 15000,
        "sizeBytes": 2048576
      }
    }
  }
}
```

### Data Lineage

Get lineage report for a specific entity:

```http
GET /api/production-sync/lineage/restaurant/rest-123
```

Export lineage data for compliance:

```http
GET /api/production-sync/lineage/export/rest-123?format=csv
```

### Backup Management

Create manual backup:

```http
POST /api/production-sync/backup
Content-Type: application/json

{
  "type": "full",
  "sources": ["openrice", "eatigo"]
}
```

List available backups:

```http
GET /api/production-sync/backup?source=openrice&type=full
```

Restore from backup:

```http
POST /api/production-sync/backup/restore
Content-Type: application/json

{
  "backupId": "full-2024-01-15T02-00-00-000Z-abc123",
  "targetEnvironment": "staging",
  "validateIntegrity": true,
  "dryRun": false,
  "conflictResolution": "merge"
}
```

## Monitoring

### CloudWatch Dashboard

Access the monitoring dashboard at:
```
https://console.aws.amazon.com/cloudwatch/home?region=ap-southeast-1#dashboards:name=DataSync-{environment}
```

### Key Metrics

- **SyncJobsExecuted**: Number of sync jobs completed
- **SyncFailures**: Number of failed sync operations
- **SyncDuration**: Time taken for sync operations
- **DataStaleness**: Data freshness score (0-1, where 1 is completely stale)
- **RecordsProcessed**: Number of records processed per sync
- **BackupSuccess/Failures**: Backup operation outcomes
- **DataQualityScore**: Overall data quality percentage
- **ComplianceRate**: GDPR compliance percentage

### Alerts

The system generates alerts for:

- **Critical**: Sync failures, backup failures, system outages
- **High**: Data quality degradation, compliance violations
- **Medium**: Performance degradation, data staleness warnings
- **Low**: Informational events, successful operations

### Log Analysis

Query CloudWatch Logs for troubleshooting:

```sql
-- Recent errors
SOURCE '/aws/data-sync/production'
| fields @timestamp, @message, @logStream
| filter @message like /ERROR/ or @message like /CRITICAL/
| sort @timestamp desc
| limit 50

-- Emergency sync events
SOURCE '/aws/data-sync/production'
| fields @timestamp, @message
| filter @message like /Emergency sync triggered/
| sort @timestamp desc
| limit 20

-- Performance analysis
SOURCE '/aws/data-sync/production'
| fields @timestamp, @message
| filter @message like /Sync job completed/
| parse @message "processed: *, updated: *, created: *, errors: *" as processed, updated, created, errors
| stats avg(processed), avg(updated), avg(created), avg(errors) by bin(5m)
```

## Data Sources

The system synchronizes data from the following Hong Kong platforms:

| Platform | Type | Update Frequency | Priority |
|----------|------|------------------|----------|
| data.gov.hk | Government | Weekly | High |
| OpenRice | Reviews/Restaurants | Monthly | High |
| TripAdvisor | Reviews/Restaurants | Monthly | Medium |
| Eatigo | Restaurants/Promotions | Monthly | Medium |
| Chope | Reservations/Restaurants | Monthly | Medium |
| Foodpanda | Delivery/Restaurants | Monthly | Low |
| Keeta | Delivery/Restaurants | Monthly | Low |
| BistroCHAT | Social/Restaurants | Monthly | Low |

## Compliance & Security

### GDPR Compliance

- **Data Lineage**: Complete audit trail for all data processing
- **Right to be Forgotten**: Automated data deletion capabilities
- **Data Export**: Structured data export for subject access requests
- **Retention Management**: Automated cleanup based on retention policies

### Security Features

- **Encryption**: All data encrypted at rest and in transit
- **Access Control**: IAM-based access control with least privilege
- **Audit Logging**: Comprehensive audit logs for all operations
- **Network Security**: VPC isolation and security groups

### Data Retention

| Data Type | Retention Period | Cleanup Method |
|-----------|------------------|----------------|
| Sync Logs | 30 days | Automated |
| Lineage Records | 7 years | Automated |
| Backups | 1 year | Automated |
| Metrics | 15 months | CloudWatch |
| Alert History | 90 days | Automated |

## Troubleshooting

### Common Issues

#### Sync Failures

1. **Check external API status**
   ```bash
   curl -I https://api.openrice.com/health
   ```

2. **Verify IAM permissions**
   ```bash
   aws sts get-caller-identity
   aws iam simulate-principal-policy --policy-source-arn arn:aws:iam::account:role/sync-orchestrator-role --action-names s3:GetObject
   ```

3. **Review CloudWatch logs**
   ```bash
   aws logs filter-log-events --log-group-name /aws/data-sync/production --filter-pattern ERROR
   ```

#### Performance Issues

1. **Check resource utilization**
   - Monitor Lambda function duration and memory usage
   - Review EKS cluster resource consumption
   - Check RDS connection pool status

2. **Optimize batch sizes**
   - Reduce batch size for large datasets
   - Implement parallel processing where possible
   - Use incremental sync for frequent updates

#### Data Quality Issues

1. **Review validation rules**
   - Check data validation service configuration
   - Verify source data format consistency
   - Update validation rules for new data patterns

2. **Monitor data freshness**
   - Check sync schedules and execution times
   - Verify external API availability
   - Review data source reliability metrics

### Support Contacts

- **Technical Issues**: DevOps Team
- **Data Quality**: Data Engineering Team  
- **Compliance**: Legal/Compliance Team
- **Emergency**: On-call Engineer

## Changelog

### v1.0.0 (2024-01-15)
- Initial production release
- Automated sync orchestration
- Data lineage tracking
- Backup and recovery system
- Comprehensive monitoring and alerting

### Future Enhancements

- **Real-time Sync**: WebSocket-based real-time data updates
- **ML-based Anomaly Detection**: Automated data quality issue detection
- **Multi-region Deployment**: Cross-region backup and failover
- **Advanced Analytics**: Data usage and performance analytics dashboard