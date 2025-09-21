import json
import os
import boto3
import psycopg2
import logging
from datetime import datetime
from typing import Dict, Any

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    GDPR Data Deletion Lambda Function
    Handles user data deletion requests in compliance with GDPR Article 17 (Right to Erasure)
    """
    try:
        # Parse request
        body = json.loads(event.get('body', '{}'))
        user_id = body.get('user_id')
        
        if not user_id:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': 'user_id is required'
                })
            }
        
        # Initialize AWS clients
        s3_client = boto3.client('s3')
        
        # Database connections
        user_db_conn = get_db_connection(os.environ['USER_DB_ENDPOINT'])
        restaurant_db_conn = get_db_connection(os.environ['RESTAURANT_DB_ENDPOINT'])
        
        deletion_results = {}
        
        # Delete user data from user database
        deletion_results['user_data'] = delete_user_data(user_db_conn, user_id)
        
        # Delete user reviews and ratings from restaurant database
        deletion_results['review_data'] = delete_user_reviews(restaurant_db_conn, user_id)
        
        # Delete user-generated content from S3
        deletion_results['s3_data'] = delete_user_s3_data(s3_client, user_id)
        
        # Log deletion for audit purposes
        log_gdpr_deletion(user_id, deletion_results)
        
        # Close database connections
        user_db_conn.close()
        restaurant_db_conn.close()
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'User data deletion completed successfully',
                'user_id': user_id,
                'deletion_summary': deletion_results,
                'timestamp': datetime.utcnow().isoformat()
            })
        }
        
    except Exception as e:
        logger.error(f"Error in GDPR data deletion: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Internal server error during data deletion',
                'message': str(e)
            })
        }

def get_db_connection(endpoint: str):
    """Create database connection"""
    return psycopg2.connect(
        host=endpoint.split(':')[0],
        port=5432,
        database=os.environ.get('DB_NAME', 'postgres'),
        user=os.environ.get('DB_USER', 'postgres'),
        password=os.environ.get('DB_PASSWORD')
    )

def delete_user_data(conn, user_id: str) -> Dict[str, int]:
    """Delete user data from user database"""
    cursor = conn.cursor()
    results = {}
    
    try:
        # Delete user preferences
        cursor.execute("DELETE FROM user_preferences WHERE user_id = %s", (user_id,))
        results['preferences_deleted'] = cursor.rowcount
        
        # Delete dining history
        cursor.execute("DELETE FROM dining_history WHERE user_id = %s", (user_id,))
        results['dining_history_deleted'] = cursor.rowcount
        
        # Delete emotional profile
        cursor.execute("DELETE FROM emotional_profiles WHERE user_id = %s", (user_id,))
        results['emotional_profile_deleted'] = cursor.rowcount
        
        # Delete user sessions
        cursor.execute("DELETE FROM user_sessions WHERE user_id = %s", (user_id,))
        results['sessions_deleted'] = cursor.rowcount
        
        # Delete main user record (cascade should handle related data)
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        results['user_record_deleted'] = cursor.rowcount
        
        conn.commit()
        logger.info(f"User data deletion completed for user {user_id}: {results}")
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Error deleting user data: {str(e)}")
        raise
    finally:
        cursor.close()
    
    return results

def delete_user_reviews(conn, user_id: str) -> Dict[str, int]:
    """Delete user reviews and ratings from restaurant database"""
    cursor = conn.cursor()
    results = {}
    
    try:
        # Delete review photos first (foreign key constraint)
        cursor.execute("""
            DELETE FROM review_photos 
            WHERE review_id IN (SELECT id FROM reviews WHERE user_id = %s)
        """, (user_id,))
        results['review_photos_deleted'] = cursor.rowcount
        
        # Delete review helpfulness votes
        cursor.execute("""
            DELETE FROM review_helpfulness 
            WHERE review_id IN (SELECT id FROM reviews WHERE user_id = %s)
        """, (user_id,))
        results['helpfulness_votes_deleted'] = cursor.rowcount
        
        # Delete reviews
        cursor.execute("DELETE FROM reviews WHERE user_id = %s", (user_id,))
        results['reviews_deleted'] = cursor.rowcount
        
        # Delete recommendation feedback
        cursor.execute("DELETE FROM recommendation_feedback WHERE user_id = %s", (user_id,))
        results['recommendation_feedback_deleted'] = cursor.rowcount
        
        conn.commit()
        logger.info(f"User review data deletion completed for user {user_id}: {results}")
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Error deleting user review data: {str(e)}")
        raise
    finally:
        cursor.close()
    
    return results

def delete_user_s3_data(s3_client, user_id: str) -> Dict[str, int]:
    """Delete user-generated content from S3 buckets"""
    results = {}
    
    try:
        # Delete from reviews media bucket
        reviews_bucket = os.environ['S3_REVIEWS_BUCKET']
        results['reviews_media_deleted'] = delete_s3_objects_by_prefix(
            s3_client, reviews_bucket, f"users/{user_id}/"
        )
        
        # Delete from platform data archive (user-specific cached data)
        platform_bucket = os.environ['S3_PLATFORM_BUCKET']
        results['platform_data_deleted'] = delete_s3_objects_by_prefix(
            s3_client, platform_bucket, f"user_cache/{user_id}/"
        )
        
        logger.info(f"S3 data deletion completed for user {user_id}: {results}")
        
    except Exception as e:
        logger.error(f"Error deleting S3 data: {str(e)}")
        raise
    
    return results

def delete_s3_objects_by_prefix(s3_client, bucket: str, prefix: str) -> int:
    """Delete all S3 objects with given prefix"""
    deleted_count = 0
    
    try:
        # List objects with prefix
        paginator = s3_client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=bucket, Prefix=prefix)
        
        for page in pages:
            if 'Contents' in page:
                objects_to_delete = [{'Key': obj['Key']} for obj in page['Contents']]
                
                if objects_to_delete:
                    response = s3_client.delete_objects(
                        Bucket=bucket,
                        Delete={'Objects': objects_to_delete}
                    )
                    deleted_count += len(response.get('Deleted', []))
                    
    except Exception as e:
        logger.error(f"Error deleting S3 objects with prefix {prefix}: {str(e)}")
        raise
    
    return deleted_count

def log_gdpr_deletion(user_id: str, deletion_results: Dict[str, Any]):
    """Log GDPR deletion for audit purposes"""
    audit_log = {
        'event_type': 'gdpr_data_deletion',
        'user_id': user_id,
        'timestamp': datetime.utcnow().isoformat(),
        'deletion_results': deletion_results,
        'compliance_note': 'Data deleted in compliance with GDPR Article 17 (Right to Erasure)'
    }
    
    logger.info(f"GDPR Audit Log: {json.dumps(audit_log)}")