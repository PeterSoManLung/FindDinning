import json
import boto3
import logging
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List
import uuid

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
sagemaker = boto3.client('sagemaker')
s3 = boto3.client('s3')
sns = boto3.client('sns')

# Environment variables
PERFORMANCE_METRICS_TABLE = os.getenv('PERFORMANCE_METRICS_TABLE')
TRAINING_JOB_ROLE_ARN = os.getenv('TRAINING_JOB_ROLE_ARN')
S3_BUCKET = os.getenv('S3_BUCKET')
SNS_TOPIC_ARN = os.getenv('SNS_TOPIC_ARN')

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for automatic model retraining
    Analyzes model performance and triggers retraining when needed
    """
    try:
        action = event.get('action', 'check_retraining_needed')
        
        if action == 'check_retraining_needed':
            return check_all_models_for_retraining()
        elif action == 'trigger_retraining':
            return trigger_model_retraining(event)
        elif action == 'check_training_status':
            return check_training_job_status(event)
        elif action == 'schedule_retraining':
            return schedule_model_retraining(event)
        else:
            return create_error_response(400, f"Unknown action: {action}")
            
    except Exception as e:
        logger.error(f"Error in model retraining trigger: {str(e)}")
        return create_error_response(500, "Internal server error")

def check_all_models_for_retraining() -> Dict[str, Any]:
    """Check all models to determine if retraining is needed"""
    try:
        models_to_check = ['recommendation', 'sentiment']
        retraining_decisions = {}
        
        for model_name in models_to_check:
            decision = evaluate_retraining_need(model_name)
            retraining_decisions[model_name] = decision
            
            if decision['should_retrain']:
                logger.info(f"Retraining recommended for {model_name}: {decision['reason']}")
                
                # Trigger retraining if auto-retraining is enabled
                if decision.get('auto_retrain', False):
                    retraining_result = trigger_model_retraining({
                        'model_name': model_name,
                        'reason': decision['reason']
                    })
                    decision['retraining_triggered'] = retraining_result.get('statusCode') == 200
                else:
                    # Send notification for manual review
                    send_retraining_notification(model_name, decision)
        
        return create_success_response({
            'checked_models': models_to_check,
            'retraining_decisions': retraining_decisions,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error checking models for retraining: {str(e)}")
        return create_error_response(500, f"Failed to check models: {str(e)}")

def evaluate_retraining_need(model_name: str) -> Dict[str, Any]:
    """Evaluate if a model needs retraining based on performance metrics"""
    try:
        # Get recent performance metrics
        table = dynamodb.Table(PERFORMANCE_METRICS_TABLE)
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(days=7)  # Last 7 days
        
        response = table.query(
            KeyConditionExpression='model_name = :model_name AND #ts BETWEEN :start_time AND :end_time',
            ExpressionAttributeNames={'#ts': 'timestamp'},
            ExpressionAttributeValues={
                ':model_name': model_name,
                ':start_time': start_time.isoformat(),
                ':end_time': end_time.isoformat()
            }
        )
        
        recent_metrics = response['Items']
        
        if not recent_metrics:
            return {
                'should_retrain': False,
                'reason': 'No recent performance data available',
                'confidence': 0.0,
                'auto_retrain': False
            }
        
        # Analyze performance degradation
        degradation_analysis = analyze_performance_degradation(recent_metrics)
        
        # Check data drift indicators
        drift_analysis = check_data_drift_indicators(model_name)
        
        # Check model age
        age_analysis = check_model_age(model_name)
        
        # Make retraining decision
        decision = make_retraining_decision(
            model_name, 
            degradation_analysis, 
            drift_analysis, 
            age_analysis
        )
        
        return decision
        
    except Exception as e:
        logger.error(f"Error evaluating retraining need for {model_name}: {str(e)}")
        return {
            'should_retrain': False,
            'reason': f'Error in evaluation: {str(e)}',
            'confidence': 0.0,
            'auto_retrain': False
        }

def analyze_performance_degradation(metrics: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Analyze performance metrics for degradation patterns"""
    # Group metrics by type
    metrics_by_type = {}
    for metric in metrics:
        metric_type = metric['metric_type']
        if metric_type not in metrics_by_type:
            metrics_by_type[metric_type] = []
        metrics_by_type[metric_type].append({
            'timestamp': metric['timestamp'],
            'value': float(metric['metric_value'])
        })
    
    degradation_indicators = {}
    
    # Analyze latency trends
    if 'ModelLatency' in metrics_by_type:
        latency_values = [m['value'] for m in sorted(metrics_by_type['ModelLatency'], key=lambda x: x['timestamp'])]
        if len(latency_values) >= 5:
            recent_avg = sum(latency_values[-3:]) / 3
            historical_avg = sum(latency_values[:-3]) / len(latency_values[:-3]) if len(latency_values) > 3 else recent_avg
            
            if historical_avg > 0:
                latency_increase = ((recent_avg - historical_avg) / historical_avg) * 100
                degradation_indicators['latency_degradation'] = {
                    'increase_percentage': latency_increase,
                    'is_significant': latency_increase > 25,  # 25% increase threshold
                    'recent_avg': recent_avg,
                    'historical_avg': historical_avg
                }
    
    # Analyze error rate trends
    if 'ModelInvocation4XXErrors' in metrics_by_type and 'ModelInvocations' in metrics_by_type:
        error_metrics = sorted(metrics_by_type['ModelInvocation4XXErrors'], key=lambda x: x['timestamp'])
        invocation_metrics = sorted(metrics_by_type['ModelInvocations'], key=lambda x: x['timestamp'])
        
        if len(error_metrics) >= 3 and len(invocation_metrics) >= 3:
            # Calculate error rates
            error_rates = []
            for i in range(min(len(error_metrics), len(invocation_metrics))):
                if invocation_metrics[i]['value'] > 0:
                    error_rate = (error_metrics[i]['value'] / invocation_metrics[i]['value']) * 100
                    error_rates.append(error_rate)
            
            if error_rates:
                recent_error_rate = sum(error_rates[-2:]) / 2 if len(error_rates) >= 2 else error_rates[-1]
                historical_error_rate = sum(error_rates[:-2]) / len(error_rates[:-2]) if len(error_rates) > 2 else recent_error_rate
                
                degradation_indicators['error_rate_degradation'] = {
                    'recent_error_rate': recent_error_rate,
                    'historical_error_rate': historical_error_rate,
                    'is_significant': recent_error_rate > historical_error_rate + 2  # 2% increase threshold
                }
    
    return degradation_indicators

def check_data_drift_indicators(model_name: str) -> Dict[str, Any]:
    """Check for data drift indicators that might require retraining"""
    # This is a simplified implementation
    # In production, you would analyze actual prediction distributions, feature drift, etc.
    
    drift_indicators = {
        'feature_drift_detected': False,
        'prediction_drift_detected': False,
        'data_quality_issues': False,
        'confidence': 0.5  # Medium confidence without actual drift detection
    }
    
    # Placeholder for actual drift detection logic
    # You would implement:
    # 1. Feature distribution analysis
    # 2. Prediction distribution analysis
    # 3. Data quality checks
    # 4. Concept drift detection
    
    return drift_indicators

def check_model_age(model_name: str) -> Dict[str, Any]:
    """Check model age and determine if retraining is needed based on time"""
    try:
        # Get model deployment information from S3 or model registry
        # This is a simplified implementation
        
        # For now, assume models should be retrained every 30 days
        max_age_days = 30
        
        # In a real implementation, you would:
        # 1. Get actual model deployment date from model registry
        # 2. Calculate actual age
        # 3. Consider model-specific aging policies
        
        age_analysis = {
            'model_age_days': 15,  # Placeholder
            'max_age_days': max_age_days,
            'age_based_retraining_needed': False,  # 15 < 30
            'next_scheduled_retraining': (datetime.utcnow() + timedelta(days=15)).isoformat()
        }
        
        return age_analysis
        
    except Exception as e:
        logger.error(f"Error checking model age for {model_name}: {str(e)}")
        return {
            'model_age_days': 0,
            'max_age_days': 30,
            'age_based_retraining_needed': False,
            'error': str(e)
        }

def make_retraining_decision(
    model_name: str, 
    degradation_analysis: Dict[str, Any], 
    drift_analysis: Dict[str, Any], 
    age_analysis: Dict[str, Any]
) -> Dict[str, Any]:
    """Make final decision on whether to retrain the model"""
    
    reasons = []
    confidence = 0.0
    should_retrain = False
    auto_retrain = False
    
    # Check performance degradation
    if degradation_analysis.get('latency_degradation', {}).get('is_significant', False):
        reasons.append("Significant latency degradation detected")
        confidence += 0.3
        should_retrain = True
    
    if degradation_analysis.get('error_rate_degradation', {}).get('is_significant', False):
        reasons.append("Significant error rate increase detected")
        confidence += 0.4
        should_retrain = True
        auto_retrain = True  # Auto-retrain for error rate issues
    
    # Check data drift
    if drift_analysis.get('feature_drift_detected', False):
        reasons.append("Feature drift detected")
        confidence += 0.3
        should_retrain = True
    
    if drift_analysis.get('prediction_drift_detected', False):
        reasons.append("Prediction drift detected")
        confidence += 0.3
        should_retrain = True
    
    # Check age-based retraining
    if age_analysis.get('age_based_retraining_needed', False):
        reasons.append("Model age exceeds maximum threshold")
        confidence += 0.2
        should_retrain = True
        auto_retrain = True  # Auto-retrain for age-based policies
    
    # Model-specific rules
    if model_name == 'recommendation':
        # Recommendation models are more sensitive to performance
        if confidence >= 0.3:
            should_retrain = True
    elif model_name == 'sentiment':
        # Sentiment models are more stable
        if confidence >= 0.5:
            should_retrain = True
    
    decision = {
        'should_retrain': should_retrain,
        'auto_retrain': auto_retrain,
        'confidence': min(confidence, 1.0),
        'reason': '; '.join(reasons) if reasons else 'No retraining needed',
        'analysis': {
            'degradation': degradation_analysis,
            'drift': drift_analysis,
            'age': age_analysis
        }
    }
    
    return decision

def trigger_model_retraining(event: Dict[str, Any]) -> Dict[str, Any]:
    """Trigger model retraining job"""
    try:
        model_name = event.get('model_name')
        reason = event.get('reason', 'Automatic retraining triggered')
        
        if not model_name:
            return create_error_response(400, "model_name is required")
        
        # Generate unique training job name
        timestamp = datetime.utcnow().strftime('%Y%m%d-%H%M%S')
        training_job_name = f"{model_name}-retrain-{timestamp}"
        
        # Get training configuration for the model
        training_config = get_training_configuration(model_name)
        
        # Create SageMaker training job
        training_job_response = sagemaker.create_training_job(
            TrainingJobName=training_job_name,
            RoleArn=TRAINING_JOB_ROLE_ARN,
            AlgorithmSpecification=training_config['algorithm_specification'],
            InputDataConfig=training_config['input_data_config'],
            OutputDataConfig={
                'S3OutputPath': f"s3://{S3_BUCKET}/models/{model_name}/retraining/{timestamp}/"
            },
            ResourceConfig=training_config['resource_config'],
            StoppingCondition=training_config['stopping_condition'],
            Tags=[
                {'Key': 'ModelName', 'Value': model_name},
                {'Key': 'RetrainingReason', 'Value': reason},
                {'Key': 'AutoTriggered', 'Value': 'true'}
            ]
        )
        
        # Send notification
        send_retraining_started_notification(model_name, training_job_name, reason)
        
        logger.info(f"Started retraining job {training_job_name} for model {model_name}")
        
        return create_success_response({
            'training_job_name': training_job_name,
            'model_name': model_name,
            'reason': reason,
            'status': 'InProgress',
            'started_at': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error triggering model retraining: {str(e)}")
        return create_error_response(500, f"Failed to trigger retraining: {str(e)}")

def get_training_configuration(model_name: str) -> Dict[str, Any]:
    """Get training configuration for a specific model"""
    
    base_config = {
        'resource_config': {
            'InstanceType': 'ml.m5.large',
            'InstanceCount': 1,
            'VolumeSizeInGB': 30
        },
        'stopping_condition': {
            'MaxRuntimeInSeconds': 3600  # 1 hour
        }
    }
    
    if model_name == 'recommendation':
        return {
            **base_config,
            'algorithm_specification': {
                'TrainingImage': '763104351884.dkr.ecr.us-east-1.amazonaws.com/pytorch-training:1.12.0-cpu-py38-ubuntu20.04-sagemaker',
                'TrainingInputMode': 'File'
            },
            'input_data_config': [
                {
                    'ChannelName': 'training',
                    'DataSource': {
                        'S3DataSource': {
                            'S3DataType': 'S3Prefix',
                            'S3Uri': f"s3://{S3_BUCKET}/training-data/recommendation/",
                            'S3DataDistributionType': 'FullyReplicated'
                        }
                    },
                    'ContentType': 'application/json',
                    'CompressionType': 'None'
                }
            ]
        }
    elif model_name == 'sentiment':
        return {
            **base_config,
            'algorithm_specification': {
                'TrainingImage': '763104351884.dkr.ecr.us-east-1.amazonaws.com/huggingface-pytorch-training:1.10.2-transformers4.17.0-py38-gpu-py38-cu113-ubuntu20.04',
                'TrainingInputMode': 'File'
            },
            'input_data_config': [
                {
                    'ChannelName': 'training',
                    'DataSource': {
                        'S3DataSource': {
                            'S3DataType': 'S3Prefix',
                            'S3Uri': f"s3://{S3_BUCKET}/training-data/sentiment/",
                            'S3DataDistributionType': 'FullyReplicated'
                        }
                    },
                    'ContentType': 'text/csv',
                    'CompressionType': 'None'
                }
            ]
        }
    else:
        # Default configuration
        return {
            **base_config,
            'algorithm_specification': {
                'TrainingImage': '763104351884.dkr.ecr.us-east-1.amazonaws.com/pytorch-training:1.12.0-cpu-py38-ubuntu20.04-sagemaker',
                'TrainingInputMode': 'File'
            },
            'input_data_config': [
                {
                    'ChannelName': 'training',
                    'DataSource': {
                        'S3DataSource': {
                            'S3DataType': 'S3Prefix',
                            'S3Uri': f"s3://{S3_BUCKET}/training-data/{model_name}/",
                            'S3DataDistributionType': 'FullyReplicated'
                        }
                    },
                    'ContentType': 'application/json',
                    'CompressionType': 'None'
                }
            ]
        }

def check_training_job_status(event: Dict[str, Any]) -> Dict[str, Any]:
    """Check the status of a training job"""
    try:
        training_job_name = event.get('training_job_name')
        
        if not training_job_name:
            return create_error_response(400, "training_job_name is required")
        
        response = sagemaker.describe_training_job(TrainingJobName=training_job_name)
        
        status = response['TrainingJobStatus']
        
        result = {
            'training_job_name': training_job_name,
            'status': status,
            'creation_time': response['CreationTime'].isoformat(),
            'last_modified_time': response['LastModifiedTime'].isoformat()
        }
        
        if status == 'Completed':
            result['model_artifacts'] = response.get('ModelArtifacts', {})
            result['training_end_time'] = response.get('TrainingEndTime', '').isoformat() if response.get('TrainingEndTime') else None
        elif status == 'Failed':
            result['failure_reason'] = response.get('FailureReason', 'Unknown failure')
        
        return create_success_response(result)
        
    except Exception as e:
        logger.error(f"Error checking training job status: {str(e)}")
        return create_error_response(500, f"Failed to check training job status: {str(e)}")

def send_retraining_notification(model_name: str, decision: Dict[str, Any]) -> None:
    """Send notification about retraining recommendation"""
    try:
        subject = f"Model Retraining Recommended: {model_name}"
        
        message = f"""
Model retraining has been recommended for: {model_name}

Reason: {decision['reason']}
Confidence: {decision['confidence']:.2f}
Auto-retrain enabled: {decision.get('auto_retrain', False)}

Analysis Details:
{json.dumps(decision.get('analysis', {}), indent=2)}

Please review and take appropriate action.

Timestamp: {datetime.utcnow().isoformat()}
        """.strip()
        
        sns.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject=subject,
            Message=message
        )
        
        logger.info(f"Sent retraining notification for {model_name}")
        
    except Exception as e:
        logger.error(f"Failed to send retraining notification: {str(e)}")

def send_retraining_started_notification(model_name: str, training_job_name: str, reason: str) -> None:
    """Send notification that retraining has started"""
    try:
        subject = f"Model Retraining Started: {model_name}"
        
        message = f"""
Model retraining has been started for: {model_name}

Training Job Name: {training_job_name}
Reason: {reason}
Started At: {datetime.utcnow().isoformat()}

You can monitor the training job progress in the AWS SageMaker console.
        """.strip()
        
        sns.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject=subject,
            Message=message
        )
        
        logger.info(f"Sent retraining started notification for {model_name}")
        
    except Exception as e:
        logger.error(f"Failed to send retraining started notification: {str(e)}")

def schedule_model_retraining(event: Dict[str, Any]) -> Dict[str, Any]:
    """Schedule model retraining for a future time"""
    try:
        model_name = event.get('model_name')
        schedule_time = event.get('schedule_time')  # ISO format datetime
        reason = event.get('reason', 'Scheduled retraining')
        
        if not model_name or not schedule_time:
            return create_error_response(400, "model_name and schedule_time are required")
        
        # In a production system, you would:
        # 1. Store the schedule in DynamoDB
        # 2. Create a CloudWatch Events rule for the scheduled time
        # 3. Set up the rule to trigger this Lambda with the retraining action
        
        # For now, return success with the schedule information
        return create_success_response({
            'model_name': model_name,
            'scheduled_time': schedule_time,
            'reason': reason,
            'status': 'scheduled',
            'message': 'Retraining has been scheduled (implementation pending)'
        })
        
    except Exception as e:
        logger.error(f"Error scheduling model retraining: {str(e)}")
        return create_error_response(500, f"Failed to schedule retraining: {str(e)}")

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