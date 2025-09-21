import json
import boto3
import logging
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List
import statistics

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
cloudwatch = boto3.client('cloudwatch')
dynamodb = boto3.resource('dynamodb')
sns = boto3.client('sns')
sagemaker = boto3.client('sagemaker')

# Environment variables
PERFORMANCE_METRICS_TABLE = os.getenv('PERFORMANCE_METRICS_TABLE')
SNS_TOPIC_ARN = os.getenv('SNS_TOPIC_ARN')
RECOMMENDATION_ENDPOINT = os.getenv('RECOMMENDATION_ENDPOINT')
SENTIMENT_ENDPOINT = os.getenv('SENTIMENT_ENDPOINT')

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for model performance monitoring
    Collects metrics, analyzes performance, and triggers alerts
    """
    try:
        action = event.get('action', 'monitor_all')
        
        if action == 'monitor_all':
            return monitor_all_models()
        elif action == 'monitor_model':
            return monitor_specific_model(event)
        elif action == 'check_drift':
            return check_model_drift(event)
        elif action == 'generate_report':
            return generate_performance_report(event)
        else:
            return create_error_response(400, f"Unknown action: {action}")
            
    except Exception as e:
        logger.error(f"Error in model performance monitor: {str(e)}")
        return create_error_response(500, "Internal server error")

def monitor_all_models() -> Dict[str, Any]:
    """Monitor performance of all deployed models"""
    try:
        results = {}
        
        # Monitor recommendation model
        if RECOMMENDATION_ENDPOINT:
            rec_metrics = collect_model_metrics('recommendation', RECOMMENDATION_ENDPOINT)
            results['recommendation'] = rec_metrics
            
            # Check for performance issues
            rec_issues = analyze_performance_metrics(rec_metrics, 'recommendation')
            if rec_issues:
                send_performance_alert('recommendation', rec_issues)
        
        # Monitor sentiment analysis model
        if SENTIMENT_ENDPOINT:
            sent_metrics = collect_model_metrics('sentiment', SENTIMENT_ENDPOINT)
            results['sentiment'] = sent_metrics
            
            # Check for performance issues
            sent_issues = analyze_performance_metrics(sent_metrics, 'sentiment')
            if sent_issues:
                send_performance_alert('sentiment', sent_issues)
        
        # Store metrics in DynamoDB
        store_performance_metrics(results)
        
        return create_success_response({
            'monitored_models': list(results.keys()),
            'metrics': results,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error monitoring all models: {str(e)}")
        return create_error_response(500, f"Failed to monitor models: {str(e)}")

def collect_model_metrics(model_name: str, endpoint_name: str) -> Dict[str, Any]:
    """Collect CloudWatch metrics for a specific model endpoint"""
    try:
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=1)
        
        metrics = {}
        
        # Define metrics to collect
        metric_queries = [
            ('ModelLatency', 'Average'),
            ('ModelInvocations', 'Sum'),
            ('ModelInvocation4XXErrors', 'Sum'),
            ('ModelInvocation5XXErrors', 'Sum'),
            ('CPUUtilization', 'Average'),
            ('MemoryUtilization', 'Average')
        ]
        
        for metric_name, statistic in metric_queries:
            try:
                response = cloudwatch.get_metric_statistics(
                    Namespace='AWS/SageMaker',
                    MetricName=metric_name,
                    Dimensions=[
                        {
                            'Name': 'EndpointName',
                            'Value': endpoint_name
                        }
                    ],
                    StartTime=start_time,
                    EndTime=end_time,
                    Period=300,  # 5 minutes
                    Statistics=[statistic]
                )
                
                datapoints = response['Datapoints']
                if datapoints:
                    # Get the latest value
                    latest_datapoint = max(datapoints, key=lambda x: x['Timestamp'])
                    metrics[metric_name] = {
                        'value': latest_datapoint[statistic],
                        'timestamp': latest_datapoint['Timestamp'].isoformat(),
                        'unit': latest_datapoint.get('Unit', 'None')
                    }
                    
                    # Calculate trend if we have multiple datapoints
                    if len(datapoints) > 1:
                        values = [dp[statistic] for dp in sorted(datapoints, key=lambda x: x['Timestamp'])]
                        metrics[metric_name]['trend'] = calculate_trend(values)
                else:
                    metrics[metric_name] = {
                        'value': 0,
                        'timestamp': end_time.isoformat(),
                        'unit': 'None',
                        'trend': 'no_data'
                    }
                    
            except Exception as e:
                logger.warning(f"Failed to collect metric {metric_name} for {model_name}: {str(e)}")
                metrics[metric_name] = {
                    'value': 0,
                    'timestamp': end_time.isoformat(),
                    'unit': 'None',
                    'error': str(e)
                }
        
        # Get endpoint status
        try:
            endpoint_response = sagemaker.describe_endpoint(EndpointName=endpoint_name)
            metrics['endpoint_status'] = {
                'status': endpoint_response['EndpointStatus'],
                'creation_time': endpoint_response['CreationTime'].isoformat(),
                'last_modified_time': endpoint_response['LastModifiedTime'].isoformat()
            }
        except Exception as e:
            logger.warning(f"Failed to get endpoint status for {endpoint_name}: {str(e)}")
            metrics['endpoint_status'] = {
                'status': 'Unknown',
                'error': str(e)
            }
        
        return metrics
        
    except Exception as e:
        logger.error(f"Error collecting metrics for {model_name}: {str(e)}")
        return {}

def calculate_trend(values: List[float]) -> str:
    """Calculate trend direction from a list of values"""
    if len(values) < 2:
        return 'insufficient_data'
    
    # Simple linear trend calculation
    n = len(values)
    x = list(range(n))
    
    # Calculate slope
    x_mean = statistics.mean(x)
    y_mean = statistics.mean(values)
    
    numerator = sum((x[i] - x_mean) * (values[i] - y_mean) for i in range(n))
    denominator = sum((x[i] - x_mean) ** 2 for i in range(n))
    
    if denominator == 0:
        return 'stable'
    
    slope = numerator / denominator
    
    # Classify trend
    if slope > 0.1:
        return 'increasing'
    elif slope < -0.1:
        return 'decreasing'
    else:
        return 'stable'

def analyze_performance_metrics(metrics: Dict[str, Any], model_name: str) -> List[Dict[str, Any]]:
    """Analyze metrics and identify performance issues"""
    issues = []
    
    # Check latency
    if 'ModelLatency' in metrics:
        latency = metrics['ModelLatency']['value']
        if latency > 5000:  # 5 seconds
            issues.append({
                'type': 'high_latency',
                'severity': 'high' if latency > 10000 else 'medium',
                'message': f"High latency detected: {latency:.0f}ms",
                'metric': 'ModelLatency',
                'value': latency,
                'threshold': 5000
            })
    
    # Check error rates
    if 'ModelInvocation4XXErrors' in metrics and 'ModelInvocations' in metrics:
        errors_4xx = metrics['ModelInvocation4XXErrors']['value']
        total_invocations = metrics['ModelInvocations']['value']
        
        if total_invocations > 0:
            error_rate = (errors_4xx / total_invocations) * 100
            if error_rate > 5:  # 5% error rate
                issues.append({
                    'type': 'high_error_rate',
                    'severity': 'high' if error_rate > 10 else 'medium',
                    'message': f"High 4XX error rate: {error_rate:.1f}%",
                    'metric': 'ErrorRate4XX',
                    'value': error_rate,
                    'threshold': 5
                })
    
    # Check 5XX errors
    if 'ModelInvocation5XXErrors' in metrics:
        errors_5xx = metrics['ModelInvocation5XXErrors']['value']
        if errors_5xx > 0:
            issues.append({
                'type': 'server_errors',
                'severity': 'high',
                'message': f"Server errors detected: {errors_5xx} 5XX errors",
                'metric': 'ModelInvocation5XXErrors',
                'value': errors_5xx,
                'threshold': 0
            })
    
    # Check CPU utilization
    if 'CPUUtilization' in metrics:
        cpu_util = metrics['CPUUtilization']['value']
        if cpu_util > 80:  # 80% CPU utilization
            issues.append({
                'type': 'high_cpu_utilization',
                'severity': 'medium' if cpu_util < 90 else 'high',
                'message': f"High CPU utilization: {cpu_util:.1f}%",
                'metric': 'CPUUtilization',
                'value': cpu_util,
                'threshold': 80
            })
    
    # Check memory utilization
    if 'MemoryUtilization' in metrics:
        memory_util = metrics['MemoryUtilization']['value']
        if memory_util > 85:  # 85% memory utilization
            issues.append({
                'type': 'high_memory_utilization',
                'severity': 'medium' if memory_util < 95 else 'high',
                'message': f"High memory utilization: {memory_util:.1f}%",
                'metric': 'MemoryUtilization',
                'value': memory_util,
                'threshold': 85
            })
    
    # Check endpoint status
    if 'endpoint_status' in metrics:
        status = metrics['endpoint_status']['status']
        if status not in ['InService']:
            issues.append({
                'type': 'endpoint_not_in_service',
                'severity': 'high',
                'message': f"Endpoint not in service: {status}",
                'metric': 'EndpointStatus',
                'value': status,
                'threshold': 'InService'
            })
    
    return issues

def send_performance_alert(model_name: str, issues: List[Dict[str, Any]]) -> None:
    """Send performance alert via SNS"""
    try:
        high_severity_issues = [issue for issue in issues if issue['severity'] == 'high']
        medium_severity_issues = [issue for issue in issues if issue['severity'] == 'medium']
        
        if not issues:
            return
        
        # Create alert message
        subject = f"Model Performance Alert: {model_name}"
        
        message_parts = [
            f"Performance issues detected for model: {model_name}",
            f"Timestamp: {datetime.utcnow().isoformat()}",
            ""
        ]
        
        if high_severity_issues:
            message_parts.append("HIGH SEVERITY ISSUES:")
            for issue in high_severity_issues:
                message_parts.append(f"- {issue['message']}")
            message_parts.append("")
        
        if medium_severity_issues:
            message_parts.append("MEDIUM SEVERITY ISSUES:")
            for issue in medium_severity_issues:
                message_parts.append(f"- {issue['message']}")
            message_parts.append("")
        
        message_parts.extend([
            "Please investigate and take appropriate action.",
            "",
            "This alert was generated automatically by the ML monitoring system."
        ])
        
        message = "\n".join(message_parts)
        
        # Send SNS notification
        sns.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject=subject,
            Message=message
        )
        
        logger.info(f"Sent performance alert for {model_name} with {len(issues)} issues")
        
    except Exception as e:
        logger.error(f"Failed to send performance alert: {str(e)}")

def store_performance_metrics(metrics_data: Dict[str, Any]) -> None:
    """Store performance metrics in DynamoDB"""
    try:
        table = dynamodb.Table(PERFORMANCE_METRICS_TABLE)
        timestamp = datetime.utcnow().isoformat()
        
        for model_name, metrics in metrics_data.items():
            # Store each metric as a separate record
            for metric_name, metric_data in metrics.items():
                if isinstance(metric_data, dict) and 'value' in metric_data:
                    record = {
                        'model_name': model_name,
                        'timestamp': timestamp,
                        'metric_type': metric_name,
                        'metric_value': metric_data['value'],
                        'metric_unit': metric_data.get('unit', 'None'),
                        'trend': metric_data.get('trend', 'unknown'),
                        'ttl': int((datetime.utcnow() + timedelta(days=30)).timestamp())  # 30 days retention
                    }
                    
                    table.put_item(Item=record)
        
        logger.info(f"Stored performance metrics for {len(metrics_data)} models")
        
    except Exception as e:
        logger.error(f"Failed to store performance metrics: {str(e)}")

def monitor_specific_model(event: Dict[str, Any]) -> Dict[str, Any]:
    """Monitor a specific model"""
    try:
        model_name = event.get('model_name')
        endpoint_name = event.get('endpoint_name')
        
        if not model_name or not endpoint_name:
            return create_error_response(400, "model_name and endpoint_name are required")
        
        metrics = collect_model_metrics(model_name, endpoint_name)
        issues = analyze_performance_metrics(metrics, model_name)
        
        if issues:
            send_performance_alert(model_name, issues)
        
        # Store metrics
        store_performance_metrics({model_name: metrics})
        
        return create_success_response({
            'model_name': model_name,
            'metrics': metrics,
            'issues': issues,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error monitoring specific model: {str(e)}")
        return create_error_response(500, f"Failed to monitor model: {str(e)}")

def check_model_drift(event: Dict[str, Any]) -> Dict[str, Any]:
    """Check for model drift by analyzing performance trends"""
    try:
        model_name = event.get('model_name')
        days_back = event.get('days_back', 7)
        
        if not model_name:
            return create_error_response(400, "model_name is required")
        
        # Get historical metrics
        table = dynamodb.Table(PERFORMANCE_METRICS_TABLE)
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=days_back)
        
        response = table.query(
            KeyConditionExpression='model_name = :model_name AND #ts BETWEEN :start_time AND :end_time',
            ExpressionAttributeNames={'#ts': 'timestamp'},
            ExpressionAttributeValues={
                ':model_name': model_name,
                ':start_time': start_time.isoformat(),
                ':end_time': end_time.isoformat()
            }
        )
        
        historical_metrics = response['Items']
        
        # Analyze drift
        drift_analysis = analyze_drift(historical_metrics)
        
        return create_success_response({
            'model_name': model_name,
            'analysis_period_days': days_back,
            'drift_analysis': drift_analysis,
            'data_points': len(historical_metrics)
        })
        
    except Exception as e:
        logger.error(f"Error checking model drift: {str(e)}")
        return create_error_response(500, f"Failed to check model drift: {str(e)}")

def analyze_drift(historical_metrics: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyze historical metrics for drift patterns"""
    drift_analysis = {}
    
    # Group metrics by type
    metrics_by_type = {}
    for metric in historical_metrics:
        metric_type = metric['metric_type']
        if metric_type not in metrics_by_type:
            metrics_by_type[metric_type] = []
        metrics_by_type[metric_type].append({
            'timestamp': metric['timestamp'],
            'value': float(metric['metric_value'])
        })
    
    # Analyze each metric type
    for metric_type, values in metrics_by_type.items():
        if len(values) < 5:  # Need at least 5 data points
            drift_analysis[metric_type] = {
                'drift_detected': False,
                'reason': 'insufficient_data',
                'data_points': len(values)
            }
            continue
        
        # Sort by timestamp
        values.sort(key=lambda x: x['timestamp'])
        metric_values = [v['value'] for v in values]
        
        # Calculate statistics
        mean_value = statistics.mean(metric_values)
        std_dev = statistics.stdev(metric_values) if len(metric_values) > 1 else 0
        
        # Check for significant changes
        recent_values = metric_values[-3:]  # Last 3 values
        older_values = metric_values[:-3]   # All but last 3 values
        
        if older_values:
            recent_mean = statistics.mean(recent_values)
            older_mean = statistics.mean(older_values)
            
            # Calculate percentage change
            if older_mean != 0:
                change_percentage = ((recent_mean - older_mean) / older_mean) * 100
            else:
                change_percentage = 0
            
            # Detect drift (significant change)
            drift_threshold = 20  # 20% change threshold
            drift_detected = abs(change_percentage) > drift_threshold
            
            drift_analysis[metric_type] = {
                'drift_detected': drift_detected,
                'change_percentage': change_percentage,
                'recent_mean': recent_mean,
                'historical_mean': older_mean,
                'standard_deviation': std_dev,
                'data_points': len(values),
                'trend': calculate_trend(metric_values)
            }
        else:
            drift_analysis[metric_type] = {
                'drift_detected': False,
                'reason': 'insufficient_historical_data',
                'data_points': len(values)
            }
    
    return drift_analysis

def generate_performance_report(event: Dict[str, Any]) -> Dict[str, Any]:
    """Generate a comprehensive performance report"""
    try:
        days_back = event.get('days_back', 7)
        
        # Get all models' performance data
        table = dynamodb.Table(PERFORMANCE_METRICS_TABLE)
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=days_back)
        
        response = table.scan(
            FilterExpression='#ts BETWEEN :start_time AND :end_time',
            ExpressionAttributeNames={'#ts': 'timestamp'},
            ExpressionAttributeValues={
                ':start_time': start_time.isoformat(),
                ':end_time': end_time.isoformat()
            }
        )
        
        all_metrics = response['Items']
        
        # Generate report
        report = generate_report_summary(all_metrics, days_back)
        
        return create_success_response(report)
        
    except Exception as e:
        logger.error(f"Error generating performance report: {str(e)}")
        return create_error_response(500, f"Failed to generate report: {str(e)}")

def generate_report_summary(metrics: List[Dict[str, Any]], days_back: int) -> Dict[str, Any]:
    """Generate summary report from metrics data"""
    # Group by model
    models_data = {}
    for metric in metrics:
        model_name = metric['model_name']
        if model_name not in models_data:
            models_data[model_name] = []
        models_data[model_name].append(metric)
    
    report = {
        'report_period_days': days_back,
        'generated_at': datetime.utcnow().isoformat(),
        'models_analyzed': len(models_data),
        'total_data_points': len(metrics),
        'model_summaries': {}
    }
    
    for model_name, model_metrics in models_data.items():
        # Calculate summary statistics
        latency_values = [float(m['metric_value']) for m in model_metrics if m['metric_type'] == 'ModelLatency']
        invocation_values = [float(m['metric_value']) for m in model_metrics if m['metric_type'] == 'ModelInvocations']
        error_values = [float(m['metric_value']) for m in model_metrics if m['metric_type'] == 'ModelInvocation4XXErrors']
        
        model_summary = {
            'data_points': len(model_metrics),
            'avg_latency': statistics.mean(latency_values) if latency_values else 0,
            'max_latency': max(latency_values) if latency_values else 0,
            'total_invocations': sum(invocation_values) if invocation_values else 0,
            'total_errors': sum(error_values) if error_values else 0,
            'error_rate': (sum(error_values) / sum(invocation_values) * 100) if invocation_values and sum(invocation_values) > 0 else 0,
            'health_status': 'healthy'  # Default
        }
        
        # Determine health status
        if model_summary['error_rate'] > 5:
            model_summary['health_status'] = 'unhealthy'
        elif model_summary['avg_latency'] > 5000:
            model_summary['health_status'] = 'degraded'
        
        report['model_summaries'][model_name] = model_summary
    
    return report

def create_success_response(data: Dict[str, Any]) -> Dict[str, Any]:
    """Create successful response"""
    return {
        'statusCode': 200,
        'body': json.dumps({
            'success': True,
            'data': data
        })
    }

def create_error_response(status_code: int, message: str) -> Dict[str, Any]:
    """Create error response"""
    return {
        'statusCode': status_code,
        'body': json.dumps({
            'success': False,
            'error': {
                'message': message,
                'code': status_code
            }
        })
    }