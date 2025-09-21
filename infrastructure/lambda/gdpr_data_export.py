import json
import os
import boto3
import psycopg2
import logging
from datetime import datetime
from typing import Dict, Any, List
import uuid

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    GDPR Data Export Lambda Function
    Handles user data export requests in compliance with GDPR Article 15 (Right of Access)
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
        
        # Collect all user data
        user_data = {}
        
        # Export user profile data
        user_data['profile'] = export_user_profile(user_db_conn, user_id)
        
        # Export user preferences
        user_data['preferences'] = export_user_preferences(user_db_conn, user_id)
        
        # Export dining history
        user_data['dining_history'] = export_dining_history(user_db_conn, user_id)
        
        # Export emotional profile
        user_data['emotional_profile'] = export_emotional_profile(user_db_conn, user_id)
        
        # Export reviews and ratings
        user_data['reviews'] = export_user_reviews(restaurant_db_conn, user_id)
        
        # Export recommendation history
        user_data['recommendations'] = export_recommendation_history(restaurant_db_conn, user_id)
        
        # Create export package
        export_id = str(uuid.uuid4())
        export_data = {
            'export_id': export_id,
            'user_id': user_id,
            'export_timestamp': datetime.utcnow().isoformat(),
            'data_categories': list(user_data.keys()),
            'user_data': user_data,
            'gdpr_notice': {
                'purpose': 'Data export in compliance with GDPR Article 15 (Right of Access)',
                'retention_period': 'This export will be automatically deleted after 30 days',
                'contact': 'For questions about your data, contact privacy@findining.com'
            }
        }
        
        # Upload to S3
        s3_key = f"gdpr_exports/{user_id}/{export_id}.json"
        s3_client.put_object(
            Bucket=os.environ['S3_EXPORT_BUCKET'],
            Key=s3_key,
            Body=json.dumps(export_data, indent=2, default=str),
            ContentType='application/json',
            ServerSideEncryption='aws:kms',
            SSEKMSKeyId=os.environ['KMS_KEY_ID']
        )
        
        # Generate presigned URL for download
        download_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': os.environ['S3_EXPORT_BUCKET'], 'Key': s3_key},
            ExpiresIn=86400  # 24 hours
        )
        
        # Log export for audit purposes
        log_gdpr_export(user_id, export_id, list(user_data.keys()))
        
        # Close database connections
        user_db_conn.close()
        restaurant_db_conn.close()
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'User data export completed successfully',
                'export_id': export_id,
                'download_url': download_url,
                'expires_at': (datetime.utcnow().timestamp() + 86400),
                'data_categories': list(user_data.keys()),
                'timestamp': datetime.utcnow().isoformat()
            })
        }
        
    except Exception as e:
        logger.error(f"Error in GDPR data export: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'Internal server error during data export',
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

def export_user_profile(conn, user_id: str) -> Dict[str, Any]:
    """Export user profile data"""
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT id, email, name, created_at, updated_at, last_login,
                   location_latitude, location_longitude, location_district
            FROM users WHERE id = %s
        """, (user_id,))
        
        row = cursor.fetchone()
        if row:
            return {
                'user_id': row[0],
                'email': row[1],
                'name': row[2],
                'account_created': row[3],
                'last_updated': row[4],
                'last_login': row[5],
                'location': {
                    'latitude': row[6],
                    'longitude': row[7],
                    'district': row[8]
                }
            }
        return {}
        
    except Exception as e:
        logger.error(f"Error exporting user profile: {str(e)}")
        raise
    finally:
        cursor.close()

def export_user_preferences(conn, user_id: str) -> Dict[str, Any]:
    """Export user preferences"""
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT cuisine_types, price_range_min, price_range_max,
                   dietary_restrictions, atmosphere_preferences, spice_level,
                   created_at, updated_at
            FROM user_preferences WHERE user_id = %s
        """, (user_id,))
        
        row = cursor.fetchone()
        if row:
            return {
                'cuisine_types': row[0],
                'price_range': {
                    'min': row[1],
                    'max': row[2]
                },
                'dietary_restrictions': row[3],
                'atmosphere_preferences': row[4],
                'spice_level': row[5],
                'preferences_set': row[6],
                'last_updated': row[7]
            }
        return {}
        
    except Exception as e:
        logger.error(f"Error exporting user preferences: {str(e)}")
        raise
    finally:
        cursor.close()

def export_dining_history(conn, user_id: str) -> List[Dict[str, Any]]:
    """Export user dining history"""
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT restaurant_id, visit_date, rating, notes, created_at
            FROM dining_history WHERE user_id = %s
            ORDER BY visit_date DESC
        """, (user_id,))
        
        rows = cursor.fetchall()
        return [
            {
                'restaurant_id': row[0],
                'visit_date': row[1],
                'rating': row[2],
                'notes': row[3],
                'recorded_at': row[4]
            }
            for row in rows
        ]
        
    except Exception as e:
        logger.error(f"Error exporting dining history: {str(e)}")
        raise
    finally:
        cursor.close()

def export_emotional_profile(conn, user_id: str) -> Dict[str, Any]:
    """Export user emotional profile"""
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT emotion_preferences, mood_history, created_at, updated_at
            FROM emotional_profiles WHERE user_id = %s
        """, (user_id,))
        
        row = cursor.fetchone()
        if row:
            return {
                'emotion_preferences': row[0],
                'mood_history': row[1],
                'profile_created': row[2],
                'last_updated': row[3]
            }
        return {}
        
    except Exception as e:
        logger.error(f"Error exporting emotional profile: {str(e)}")
        raise
    finally:
        cursor.close()

def export_user_reviews(conn, user_id: str) -> List[Dict[str, Any]]:
    """Export user reviews and ratings"""
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT r.id, r.restaurant_id, r.rating, r.content, r.visit_date,
                   r.is_verified, r.authenticity_score, r.helpful_count,
                   r.created_at, array_agg(rp.photo_url) as photos
            FROM reviews r
            LEFT JOIN review_photos rp ON r.id = rp.review_id
            WHERE r.user_id = %s
            GROUP BY r.id, r.restaurant_id, r.rating, r.content, r.visit_date,
                     r.is_verified, r.authenticity_score, r.helpful_count, r.created_at
            ORDER BY r.created_at DESC
        """, (user_id,))
        
        rows = cursor.fetchall()
        return [
            {
                'review_id': row[0],
                'restaurant_id': row[1],
                'rating': row[2],
                'content': row[3],
                'visit_date': row[4],
                'is_verified': row[5],
                'authenticity_score': row[6],
                'helpful_count': row[7],
                'created_at': row[8],
                'photos': [url for url in row[9] if url]
            }
            for row in rows
        ]
        
    except Exception as e:
        logger.error(f"Error exporting user reviews: {str(e)}")
        raise
    finally:
        cursor.close()

def export_recommendation_history(conn, user_id: str) -> List[Dict[str, Any]]:
    """Export user recommendation history"""
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT r.id, r.restaurants, r.emotional_context, r.generated_at,
                   r.confidence, rf.feedback_type, rf.feedback_value, rf.created_at as feedback_date
            FROM recommendations r
            LEFT JOIN recommendation_feedback rf ON r.id = rf.recommendation_id
            WHERE r.user_id = %s
            ORDER BY r.generated_at DESC
        """, (user_id,))
        
        rows = cursor.fetchall()
        return [
            {
                'recommendation_id': row[0],
                'recommended_restaurants': row[1],
                'emotional_context': row[2],
                'generated_at': row[3],
                'confidence_score': row[4],
                'user_feedback': {
                    'type': row[5],
                    'value': row[6],
                    'provided_at': row[7]
                } if row[5] else None
            }
            for row in rows
        ]
        
    except Exception as e:
        logger.error(f"Error exporting recommendation history: {str(e)}")
        raise
    finally:
        cursor.close()

def log_gdpr_export(user_id: str, export_id: str, data_categories: List[str]):
    """Log GDPR export for audit purposes"""
    audit_log = {
        'event_type': 'gdpr_data_export',
        'user_id': user_id,
        'export_id': export_id,
        'timestamp': datetime.utcnow().isoformat(),
        'data_categories': data_categories,
        'compliance_note': 'Data exported in compliance with GDPR Article 15 (Right of Access)'
    }
    
    logger.info(f"GDPR Audit Log: {json.dumps(audit_log)}")