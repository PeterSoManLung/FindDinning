import json
import boto3
import logging
import os
from datetime import datetime
from typing import Dict, Any, Optional
import uuid

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
sagemaker = boto3.client('sagemaker')
s3 = boto3.client('s3')

# Environment variables
MODEL_VERSIONS_TABLE = os.getenv('MODEL_VERSIONS_TABLE')
S3_BUCKET = os.getenv('S3_BUCKET')
SAGEMAKER_ROLE_ARN = os.getenv('SAGEMAKER_ROLE_ARN')

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for model version management
    Handles model deployment, versioning, and lifecycle management
    """
    try:
        # Determine the action based on event source
        if 'Records' in event:
            # S3 event - new model uploaded
            return handle_s3_model_upload(event)
        elif 'action' in event:
            # Direct invocation with specific action
            action = event['action']
            if action == 'deploy_model':
                return deploy_model_version(event)
            elif action == 'rollback_model':
                return rollback_model(event)
            elif action == 'list_versions':
                return list_model_versions(event)
            elif action == 'delete_version':
                return delete_model_version(event)
            else:
                return create_error_response(400, f"Unknown action: {action}")
        else:
            return create_error_response(400, "Invalid event format")
            
    except Exception as e:
        logger.error(f"Error in model version manager: {str(e)}")
        return create_error_response(500, "Internal server error")

def handle_s3_model_upload(event: Dict[str, Any]) -> Dict[str, Any]:
    """Handle new model upload to S3"""
    try:
        results = []
        
        for record in event['Records']:
            bucket = record['s3']['bucket']['name']
            key = record['s3']['object']['key']
            
            # Parse model information from S3 key
            # Expected format: models/{model_name}/{version}/model.tar.gz
            path_parts = key.split('/')
            if len(path_parts) >= 4 and path_parts[0] == 'models':
                model_name = path_parts[1]
                version = path_parts[2]
                
                # Create new model version record
                version_record = create_model_version_record(model_name, version, key)
                
                # Auto-deploy if this is a production model
                if should_auto_deploy(model_name, version):
                    deployment_result = deploy_model_to_sagemaker(model_name, version, key)
                    version_record['deployment_status'] = deployment_result['status']
                    version_record['endpoint_name'] = deployment_result.get('endpoint_name')
                
                results.append(version_record)
        
        return create_success_response({
            'processed_models': results,
            'count': len(results)
        })
        
    except Exception as e:
        logger.error(f"Error handling S3 model upload: {str(e)}")
        return create_error_response(500, f"Failed to process model upload: {str(e)}")

def create_model_version_record(model_name: str, version: str, s3_key: str) -> Dict[str, Any]:
    """Create a new model version record in DynamoDB"""
    table = dynamodb.Table(MODEL_VERSIONS_TABLE)
    
    timestamp = datetime.utcnow().isoformat()
    version_record = {
        'model_name': model_name,
        'version': version,
        's3_key': s3_key,
        'status': 'uploaded',
        'created_at': timestamp,
        'updated_at': timestamp,
        'deployment_status': 'pending',
        'metadata': {
            'upload_timestamp': timestamp,
            'file_size': get_s3_object_size(s3_key)
        }
    }
    
    table.put_item(Item=version_record)
    logger.info(f"Created version record for {model_name} v{version}")
    
    return version_record

def should_auto_deploy(model_name: str, version: str) -> bool:
    """Determine if a model version should be auto-deployed"""
    # Auto-deploy production versions (semantic versioning like 1.0.0)
    # Skip auto-deploy for experimental versions (like exp-*, dev-*, etc.)
    if version.startswith(('exp-', 'dev-', 'test-')):
        return False
    
    # Auto-deploy if version follows semantic versioning pattern
    import re
    semantic_version_pattern = r'^\d+\.\d+\.\d+$'
    return bool(re.match(semantic_version_pattern, version))

def deploy_model_to_sagemaker(model_name: str, version: str, s3_key: str) -> Dict[str, Any]:
    """Deploy model to SageMaker endpoint"""
    try:
        # Create unique names for SageMaker resources
        model_id = f"{model_name}-{version}-{uuid.uuid4().hex[:8]}"
        endpoint_config_name = f"{model_name}-config-{version}"
        endpoint_name = f"{model_name}-endpoint-{version}"
        
        # Determine container image based on model type
        container_image = get_container_image(model_name)
        
        # Create SageMaker model
        sagemaker.create_model(
            ModelName=model_id,
            ExecutionRoleArn=SAGEMAKER_ROLE_ARN,
            PrimaryContainer={
                'Image': container_image,
                'ModelDataUrl': f"s3://{S3_BUCKET}/{s3_key}",
                'Environment': get_model_environment(model_name)
            },
            Tags=[
                {'Key': 'ModelName', 'Value': model_name},
                {'Key': 'Version', 'Value': version},
                {'Key': 'Environment', 'Value': 'production'}
            ]
        )
        
        # Create endpoint configuration
        sagemaker.create_endpoint_config(
            EndpointConfigName=endpoint_config_name,
            ProductionVariants=[
                {
                    'VariantName': 'primary',
                    'ModelName': model_id,
                    'InitialInstanceCount': 1,
                    'InstanceType': get_instance_type(model_name),
                    'InitialVariantWeight': 1
                }
            ],
            Tags=[
                {'Key': 'ModelName', 'Value': model_name},
                {'Key': 'Version', 'Value': version}
            ]
        )
        
        # Create or update endpoint
        try:
            # Try to update existing endpoint
            sagemaker.update_endpoint(
                EndpointName=endpoint_name,
                EndpointConfigName=endpoint_config_name
            )
            logger.info(f"Updated existing endpoint {endpoint_name}")
        except sagemaker.exceptions.ClientError as e:
            if 'ValidationException' in str(e):
                # Endpoint doesn't exist, create new one
                sagemaker.create_endpoint(
                    EndpointName=endpoint_name,
                    EndpointConfigName=endpoint_config_name,
                    Tags=[
                        {'Key': 'ModelName', 'Value': model_name},
                        {'Key': 'Version', 'Value': version}
                    ]
                )
                logger.info(f"Created new endpoint {endpoint_name}")
            else:
                raise
        
        # Update model version record
        update_model_version_status(model_name, version, 'deployed', {
            'endpoint_name': endpoint_name,
            'model_id': model_id,
            'endpoint_config_name': endpoint_config_name
        })
        
        return {
            'status': 'deployed',
            'endpoint_name': endpoint_name,
            'model_id': model_id
        }
        
    except Exception as e:
        logger.error(f"Error deploying model {model_name} v{version}: {str(e)}")
        update_model_version_status(model_name, version, 'deployment_failed', {
            'error': str(e)
        })
        return {
            'status': 'deployment_failed',
            'error': str(e)
        }

def get_container_image(model_name: str) -> str:
    """Get appropriate container image for model type"""
    if model_name == 'recommendation':
        return "763104351884.dkr.ecr.us-east-1.amazonaws.com/pytorch-inference:1.12.0-cpu-py38-ubuntu20.04-sagemaker"
    elif model_name == 'sentiment':
        return "763104351884.dkr.ecr.us-east-1.amazonaws.com/huggingface-pytorch-inference:1.10.2-transformers4.17.0-cpu-py38-ubuntu20.04"
    else:
        # Default to PyTorch
        return "763104351884.dkr.ecr.us-east-1.amazonaws.com/pytorch-inference:1.12.0-cpu-py38-ubuntu20.04-sagemaker"

def get_model_environment(model_name: str) -> Dict[str, str]:
    """Get environment variables for model container"""
    if model_name == 'recommendation':
        return {
            'SAGEMAKER_PROGRAM': 'inference.py',
            'SAGEMAKER_SUBMIT_DIRECTORY': '/opt/ml/code'
        }
    elif model_name == 'sentiment':
        return {
            'HF_MODEL_ID': 'cardiffnlp/twitter-roberta-base-sentiment-latest',
            'HF_TASK': 'text-classification'
        }
    else:
        return {}

def get_instance_type(model_name: str) -> str:
    """Get appropriate instance type for model"""
    # Start with smaller instances for cost optimization
    return "ml.t2.medium"

def update_model_version_status(model_name: str, version: str, status: str, metadata: Dict[str, Any] = None):
    """Update model version status in DynamoDB"""
    table = dynamodb.Table(MODEL_VERSIONS_TABLE)
    
    update_expression = "SET #status = :status, updated_at = :updated_at"
    expression_attribute_names = {'#status': 'status'}
    expression_attribute_values = {
        ':status': status,
        ':updated_at': datetime.utcnow().isoformat()
    }
    
    if metadata:
        update_expression += ", metadata = :metadata"
        expression_attribute_values[':metadata'] = metadata
    
    table.update_item(
        Key={'model_name': model_name, 'version': version},
        UpdateExpression=update_expression,
        ExpressionAttributeNames=expression_attribute_names,
        ExpressionAttributeValues=expression_attribute_values
    )

def get_s3_object_size(s3_key: str) -> int:
    """Get size of S3 object"""
    try:
        response = s3.head_object(Bucket=S3_BUCKET, Key=s3_key)
        return response['ContentLength']
    except Exception:
        return 0

def deploy_model_version(event: Dict[str, Any]) -> Dict[str, Any]:
    """Deploy a specific model version"""
    model_name = event.get('model_name')
    version = event.get('version')
    
    if not model_name or not version:
        return create_error_response(400, "model_name and version are required")
    
    # Get model version record
    table = dynamodb.Table(MODEL_VERSIONS_TABLE)
    response = table.get_item(Key={'model_name': model_name, 'version': version})
    
    if 'Item' not in response:
        return create_error_response(404, f"Model version {model_name} v{version} not found")
    
    version_record = response['Item']
    s3_key = version_record['s3_key']
    
    deployment_result = deploy_model_to_sagemaker(model_name, version, s3_key)
    
    return create_success_response(deployment_result)

def list_model_versions(event: Dict[str, Any]) -> Dict[str, Any]:
    """List all versions for a model"""
    model_name = event.get('model_name')
    
    if not model_name:
        return create_error_response(400, "model_name is required")
    
    table = dynamodb.Table(MODEL_VERSIONS_TABLE)
    response = table.query(
        KeyConditionExpression='model_name = :model_name',
        ExpressionAttributeValues={':model_name': model_name},
        ScanIndexForward=False  # Sort by version descending
    )
    
    return create_success_response({
        'model_name': model_name,
        'versions': response['Items']
    })

def rollback_model(event: Dict[str, Any]) -> Dict[str, Any]:
    """Rollback to a previous model version"""
    model_name = event.get('model_name')
    target_version = event.get('target_version')
    
    if not model_name or not target_version:
        return create_error_response(400, "model_name and target_version are required")
    
    # Deploy the target version
    deployment_result = deploy_model_version({
        'model_name': model_name,
        'version': target_version
    })
    
    if deployment_result['statusCode'] == 200:
        logger.info(f"Successfully rolled back {model_name} to version {target_version}")
    
    return deployment_result

def delete_model_version(event: Dict[str, Any]) -> Dict[str, Any]:
    """Delete a model version"""
    model_name = event.get('model_name')
    version = event.get('version')
    
    if not model_name or not version:
        return create_error_response(400, "model_name and version are required")
    
    # Delete from DynamoDB
    table = dynamodb.Table(MODEL_VERSIONS_TABLE)
    table.delete_item(Key={'model_name': model_name, 'version': version})
    
    return create_success_response({
        'message': f"Deleted model version {model_name} v{version}"
    })

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