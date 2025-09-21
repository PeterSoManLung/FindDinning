import json
import boto3
import logging
import os
from datetime import datetime, timedelta
from typing import Dict, Any, List
import uuid
import hashlib

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')

# Environment variables
AB_TEST_CONFIGS_TABLE = os.getenv('AB_TEST_CONFIGS_TABLE')
AB_TEST_RESULTS_TABLE = os.getenv('AB_TEST_RESULTS_TABLE')
MODEL_VERSIONS_TABLE = os.getenv('MODEL_VERSIONS_TABLE')

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for A/B test management
    Handles test creation, user assignment, result collection, and analysis
    """
    try:
        action = event.get('action')
        
        if action == 'create_test':
            return create_ab_test(event)
        elif action == 'assign_user':
            return assign_user_to_test(event)
        elif action == 'record_result':
            return record_test_result(event)
        elif action == 'analyze_test':
            return analyze_test_results(event)
        elif action == 'end_test':
            return end_ab_test(event)
        elif action == 'list_tests':
            return list_ab_tests(event)
        else:
            return create_error_response(400, f"Unknown action: {action}")
            
    except Exception as e:
        logger.error(f"Error in A/B test manager: {str(e)}")
        return create_error_response(500, "Internal server error")

def create_ab_test(event: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new A/B test configuration"""
    try:
        test_name = event.get('test_name')
        model_name = event.get('model_name')
        control_version = event.get('control_version')
        treatment_version = event.get('treatment_version')
        traffic_split = event.get('traffic_split', 50)  # Default 50/50 split
        duration_days = event.get('duration_days', 7)
        success_metrics = event.get('success_metrics', ['recommendation_accuracy', 'user_satisfaction'])
        
        if not all([test_name, model_name, control_version, treatment_version]):
            return create_error_response(400, "Missing required parameters")
        
        test_id = str(uuid.uuid4())
        start_date = datetime.utcnow()
        end_date = start_date + timedelta(days=duration_days)
        
        test_config = {
            'test_id': test_id,
            'test_name': test_name,
            'model_name': model_name,
            'control_version': control_version,
            'treatment_version': treatment_version,
            'traffic_split': traffic_split,
            'status': 'active',
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'success_metrics': success_metrics,
            'created_at': start_date.isoformat(),
            'updated_at': start_date.isoformat(),
            'metadata': {
                'created_by': event.get('created_by', 'system'),
                'description': event.get('description', ''),
                'hypothesis': event.get('hypothesis', '')
            }
        }
        
        # Save test configuration
        table = dynamodb.Table(AB_TEST_CONFIGS_TABLE)
        table.put_item(Item=test_config)
        
        logger.info(f"Created A/B test {test_id} for model {model_name}")
        
        return create_success_response({
            'test_id': test_id,
            'test_config': test_config
        })
        
    except Exception as e:
        logger.error(f"Error creating A/B test: {str(e)}")
        return create_error_response(500, f"Failed to create A/B test: {str(e)}")

def assign_user_to_test(event: Dict[str, Any]) -> Dict[str, Any]:
    """Assign a user to a test variant (control or treatment)"""
    try:
        user_id = event.get('user_id')
        model_name = event.get('model_name')
        
        if not user_id or not model_name:
            return create_error_response(400, "user_id and model_name are required")
        
        # Find active test for this model
        active_test = get_active_test_for_model(model_name)
        
        if not active_test:
            # No active test, use production model
            return create_success_response({
                'variant': 'production',
                'model_version': 'latest',
                'test_id': None
            })
        
        # Determine variant assignment using consistent hashing
        variant = determine_user_variant(user_id, active_test['test_id'], active_test['traffic_split'])
        
        # Get the appropriate model version
        if variant == 'control':
            model_version = active_test['control_version']
        else:
            model_version = active_test['treatment_version']
        
        # Record the assignment
        assignment_record = {
            'test_id': active_test['test_id'],
            'user_id': user_id,
            'variant': variant,
            'model_version': model_version,
            'assigned_at': datetime.utcnow().isoformat(),
            'timestamp': datetime.utcnow().isoformat()
        }
        
        results_table = dynamodb.Table(AB_TEST_RESULTS_TABLE)
        results_table.put_item(Item=assignment_record)
        
        return create_success_response({
            'test_id': active_test['test_id'],
            'variant': variant,
            'model_version': model_version
        })
        
    except Exception as e:
        logger.error(f"Error assigning user to test: {str(e)}")
        return create_error_response(500, f"Failed to assign user to test: {str(e)}")

def get_active_test_for_model(model_name: str) -> Dict[str, Any]:
    """Get active A/B test for a specific model"""
    table = dynamodb.Table(AB_TEST_CONFIGS_TABLE)
    
    # Query for active tests
    response = table.scan(
        FilterExpression='#status = :status AND model_name = :model_name',
        ExpressionAttributeNames={'#status': 'status'},
        ExpressionAttributeValues={
            ':status': 'active',
            ':model_name': model_name
        }
    )
    
    active_tests = response['Items']
    
    # Check if tests are still within their time window
    current_time = datetime.utcnow()
    
    for test in active_tests:
        end_date = datetime.fromisoformat(test['end_date'])
        if current_time <= end_date:
            return test
    
    return None

def determine_user_variant(user_id: str, test_id: str, traffic_split: int) -> str:
    """Determine user variant using consistent hashing"""
    # Create a hash of user_id + test_id for consistent assignment
    hash_input = f"{user_id}:{test_id}"
    hash_value = int(hashlib.md5(hash_input.encode()).hexdigest(), 16)
    
    # Convert to percentage (0-99)
    percentage = hash_value % 100
    
    # Assign based on traffic split
    if percentage < traffic_split:
        return 'treatment'
    else:
        return 'control'

def record_test_result(event: Dict[str, Any]) -> Dict[str, Any]:
    """Record a test result/metric"""
    try:
        test_id = event.get('test_id')
        user_id = event.get('user_id')
        metric_name = event.get('metric_name')
        metric_value = event.get('metric_value')
        
        if not all([test_id, user_id, metric_name, metric_value is not None]):
            return create_error_response(400, "Missing required parameters")
        
        # Create result record
        result_record = {
            'test_id': test_id,
            'user_id': user_id,
            'metric_name': metric_name,
            'metric_value': metric_value,
            'timestamp': datetime.utcnow().isoformat(),
            'recorded_at': datetime.utcnow().isoformat()
        }
        
        # Add any additional context
        if 'context' in event:
            result_record['context'] = event['context']
        
        # Save result
        table = dynamodb.Table(AB_TEST_RESULTS_TABLE)
        table.put_item(Item=result_record)
        
        return create_success_response({
            'message': 'Result recorded successfully',
            'result_id': f"{test_id}:{user_id}:{metric_name}"
        })
        
    except Exception as e:
        logger.error(f"Error recording test result: {str(e)}")
        return create_error_response(500, f"Failed to record test result: {str(e)}")

def analyze_test_results(event: Dict[str, Any]) -> Dict[str, Any]:
    """Analyze A/B test results and provide statistical summary"""
    try:
        test_id = event.get('test_id')
        
        if not test_id:
            return create_error_response(400, "test_id is required")
        
        # Get test configuration
        config_table = dynamodb.Table(AB_TEST_CONFIGS_TABLE)
        config_response = config_table.get_item(Key={'test_id': test_id})
        
        if 'Item' not in config_response:
            return create_error_response(404, f"Test {test_id} not found")
        
        test_config = config_response['Item']
        
        # Get all results for this test
        results_table = dynamodb.Table(AB_TEST_RESULTS_TABLE)
        results_response = results_table.query(
            KeyConditionExpression='test_id = :test_id',
            ExpressionAttributeValues={':test_id': test_id}
        )
        
        results = results_response['Items']
        
        # Analyze results by variant
        analysis = analyze_results_by_variant(results, test_config['success_metrics'])
        
        # Calculate statistical significance
        significance_results = calculate_statistical_significance(analysis)
        
        # Generate recommendations
        recommendations = generate_test_recommendations(analysis, significance_results, test_config)
        
        return create_success_response({
            'test_id': test_id,
            'test_config': test_config,
            'analysis': analysis,
            'statistical_significance': significance_results,
            'recommendations': recommendations,
            'total_participants': len(set(r['user_id'] for r in results))
        })
        
    except Exception as e:
        logger.error(f"Error analyzing test results: {str(e)}")
        return create_error_response(500, f"Failed to analyze test results: {str(e)}")

def analyze_results_by_variant(results: List[Dict[str, Any]], success_metrics: List[str]) -> Dict[str, Any]:
    """Analyze results grouped by variant"""
    variant_data = {'control': {}, 'treatment': {}}
    
    # Group results by variant and metric
    for result in results:
        # Find user's variant assignment (look for assignment records)
        if 'variant' in result:
            variant = result['variant']
            metric_name = result.get('metric_name')
            metric_value = result.get('metric_value')
            
            if metric_name and metric_value is not None:
                if metric_name not in variant_data[variant]:
                    variant_data[variant][metric_name] = []
                variant_data[variant][metric_name].append(float(metric_value))
    
    # Calculate statistics for each variant and metric
    analysis = {}
    for variant in ['control', 'treatment']:
        analysis[variant] = {}
        for metric in success_metrics:
            if metric in variant_data[variant]:
                values = variant_data[variant][metric]
                analysis[variant][metric] = {
                    'count': len(values),
                    'mean': sum(values) / len(values) if values else 0,
                    'min': min(values) if values else 0,
                    'max': max(values) if values else 0,
                    'values': values
                }
            else:
                analysis[variant][metric] = {
                    'count': 0,
                    'mean': 0,
                    'min': 0,
                    'max': 0,
                    'values': []
                }
    
    return analysis

def calculate_statistical_significance(analysis: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate statistical significance between variants"""
    significance_results = {}
    
    for metric in analysis.get('control', {}):
        control_values = analysis['control'][metric]['values']
        treatment_values = analysis['treatment'][metric]['values']
        
        if len(control_values) > 0 and len(treatment_values) > 0:
            # Simple t-test approximation (for production, use proper statistical libraries)
            control_mean = analysis['control'][metric]['mean']
            treatment_mean = analysis['treatment'][metric]['mean']
            
            # Calculate improvement percentage
            if control_mean != 0:
                improvement = ((treatment_mean - control_mean) / control_mean) * 100
            else:
                improvement = 0
            
            # Simple significance check (for demo purposes)
            # In production, use proper statistical tests like scipy.stats.ttest_ind
            sample_size_adequate = len(control_values) >= 30 and len(treatment_values) >= 30
            effect_size_meaningful = abs(improvement) >= 5  # 5% improvement threshold
            
            significance_results[metric] = {
                'control_mean': control_mean,
                'treatment_mean': treatment_mean,
                'improvement_percentage': improvement,
                'sample_size_adequate': sample_size_adequate,
                'effect_size_meaningful': effect_size_meaningful,
                'is_significant': sample_size_adequate and effect_size_meaningful,
                'control_sample_size': len(control_values),
                'treatment_sample_size': len(treatment_values)
            }
        else:
            significance_results[metric] = {
                'control_mean': 0,
                'treatment_mean': 0,
                'improvement_percentage': 0,
                'sample_size_adequate': False,
                'effect_size_meaningful': False,
                'is_significant': False,
                'control_sample_size': len(control_values),
                'treatment_sample_size': len(treatment_values)
            }
    
    return significance_results

def generate_test_recommendations(analysis: Dict[str, Any], significance: Dict[str, Any], test_config: Dict[str, Any]) -> Dict[str, Any]:
    """Generate recommendations based on test results"""
    recommendations = {
        'action': 'continue',  # continue, deploy_treatment, deploy_control, extend_test
        'confidence': 'low',   # low, medium, high
        'reasons': [],
        'next_steps': []
    }
    
    significant_improvements = 0
    significant_degradations = 0
    
    for metric, sig_data in significance.items():
        if sig_data['is_significant']:
            if sig_data['improvement_percentage'] > 0:
                significant_improvements += 1
                recommendations['reasons'].append(f"Significant improvement in {metric}: {sig_data['improvement_percentage']:.1f}%")
            else:
                significant_degradations += 1
                recommendations['reasons'].append(f"Significant degradation in {metric}: {sig_data['improvement_percentage']:.1f}%")
        elif not sig_data['sample_size_adequate']:
            recommendations['reasons'].append(f"Insufficient sample size for {metric}")
    
    # Determine recommendation
    if significant_improvements > 0 and significant_degradations == 0:
        recommendations['action'] = 'deploy_treatment'
        recommendations['confidence'] = 'high'
        recommendations['next_steps'].append("Deploy treatment version to production")
    elif significant_degradations > 0:
        recommendations['action'] = 'deploy_control'
        recommendations['confidence'] = 'high'
        recommendations['next_steps'].append("Keep control version, treatment shows degradation")
    elif any(not sig['sample_size_adequate'] for sig in significance.values()):
        recommendations['action'] = 'extend_test'
        recommendations['confidence'] = 'low'
        recommendations['next_steps'].append("Extend test duration to gather more data")
    else:
        recommendations['action'] = 'continue'
        recommendations['confidence'] = 'medium'
        recommendations['next_steps'].append("Continue monitoring, no clear winner yet")
    
    return recommendations

def end_ab_test(event: Dict[str, Any]) -> Dict[str, Any]:
    """End an A/B test"""
    try:
        test_id = event.get('test_id')
        
        if not test_id:
            return create_error_response(400, "test_id is required")
        
        # Update test status
        table = dynamodb.Table(AB_TEST_CONFIGS_TABLE)
        table.update_item(
            Key={'test_id': test_id},
            UpdateExpression='SET #status = :status, updated_at = :updated_at',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':status': 'completed',
                ':updated_at': datetime.utcnow().isoformat()
            }
        )
        
        return create_success_response({
            'message': f'Test {test_id} has been ended',
            'test_id': test_id
        })
        
    except Exception as e:
        logger.error(f"Error ending A/B test: {str(e)}")
        return create_error_response(500, f"Failed to end A/B test: {str(e)}")

def list_ab_tests(event: Dict[str, Any]) -> Dict[str, Any]:
    """List all A/B tests"""
    try:
        status_filter = event.get('status')  # active, completed, all
        
        table = dynamodb.Table(AB_TEST_CONFIGS_TABLE)
        
        if status_filter and status_filter != 'all':
            response = table.scan(
                FilterExpression='#status = :status',
                ExpressionAttributeNames={'#status': 'status'},
                ExpressionAttributeValues={':status': status_filter}
            )
        else:
            response = table.scan()
        
        tests = response['Items']
        
        # Sort by creation date (newest first)
        tests.sort(key=lambda x: x['created_at'], reverse=True)
        
        return create_success_response({
            'tests': tests,
            'count': len(tests)
        })
        
    except Exception as e:
        logger.error(f"Error listing A/B tests: {str(e)}")
        return create_error_response(500, f"Failed to list A/B tests: {str(e)}")

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