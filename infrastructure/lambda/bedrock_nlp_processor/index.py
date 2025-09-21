import json
import boto3
import logging
import os
from typing import Dict, Any, List

# Configure logging
logger = logging.getLogger()
logger.setLevel(os.getenv('LOG_LEVEL', 'INFO'))

# Initialize Bedrock client
bedrock_runtime = boto3.client('bedrock-runtime', region_name=os.getenv('BEDROCK_REGION', 'us-east-1'))

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for Bedrock NLP processing
    Supports emotion analysis, sentiment analysis, and text classification
    """
    try:
        # Parse request body
        if 'body' in event:
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            body = event
        
        text = body.get('text', '')
        analysis_type = body.get('analysis_type', 'sentiment')
        
        if not text:
            return create_error_response(400, "Text is required")
        
        # Route to appropriate analysis function
        if analysis_type == 'emotion':
            result = analyze_emotion(text)
        elif analysis_type == 'sentiment':
            result = analyze_sentiment(text)
        elif analysis_type == 'negative_feedback':
            result = analyze_negative_feedback(text)
        else:
            return create_error_response(400, f"Unsupported analysis type: {analysis_type}")
        
        return create_success_response(result)
        
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return create_error_response(500, "Internal server error")

def analyze_emotion(text: str) -> Dict[str, Any]:
    """Analyze emotional state from text using Claude"""
    prompt = f"""
    Analyze the emotional state expressed in the following text and categorize it into one of these emotions:
    - happy (celebratory, excited, joyful)
    - sad (disappointed, down, melancholy)
    - stressed (anxious, overwhelmed, tense)
    - neutral (calm, content, balanced)
    - angry (frustrated, irritated, upset)
    - tired (exhausted, weary, drained)
    
    Text: "{text}"
    
    Respond with a JSON object containing:
    - emotion: the primary emotion category
    - confidence: confidence score (0-1)
    - reasoning: brief explanation of the analysis
    - mood_intensity: intensity level (1-5)
    """
    
    try:
        response = bedrock_runtime.invoke_model(
            modelId='anthropic.claude-3-sonnet-20240229-v1:0',
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 300,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            })
        )
        
        response_body = json.loads(response['body'].read())
        content = response_body['content'][0]['text']
        
        # Parse JSON response from Claude
        try:
            emotion_analysis = json.loads(content)
        except json.JSONDecodeError:
            # Fallback parsing if Claude doesn't return valid JSON
            emotion_analysis = {
                "emotion": "neutral",
                "confidence": 0.5,
                "reasoning": "Unable to parse detailed analysis",
                "mood_intensity": 3
            }
        
        return emotion_analysis
        
    except Exception as e:
        logger.error(f"Error in emotion analysis: {str(e)}")
        return {
            "emotion": "neutral",
            "confidence": 0.0,
            "reasoning": "Analysis failed",
            "mood_intensity": 3
        }

def analyze_sentiment(text: str) -> Dict[str, Any]:
    """Analyze sentiment with focus on authenticity"""
    prompt = f"""
    Analyze the sentiment of this restaurant review text with focus on authenticity:
    
    Text: "{text}"
    
    Provide analysis as JSON with:
    - sentiment: positive, negative, or neutral
    - confidence: confidence score (0-1)
    - authenticity_score: how authentic the review seems (0-1)
    - key_aspects: list of specific aspects mentioned (food, service, atmosphere, etc.)
    - negative_indicators: specific complaints or issues mentioned
    - positive_indicators: specific praise or highlights mentioned
    """
    
    try:
        response = bedrock_runtime.invoke_model(
            modelId='anthropic.claude-3-sonnet-20240229-v1:0',
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 400,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            })
        )
        
        response_body = json.loads(response['body'].read())
        content = response_body['content'][0]['text']
        
        try:
            sentiment_analysis = json.loads(content)
        except json.JSONDecodeError:
            sentiment_analysis = {
                "sentiment": "neutral",
                "confidence": 0.5,
                "authenticity_score": 0.5,
                "key_aspects": [],
                "negative_indicators": [],
                "positive_indicators": []
            }
        
        return sentiment_analysis
        
    except Exception as e:
        logger.error(f"Error in sentiment analysis: {str(e)}")
        return {
            "sentiment": "neutral",
            "confidence": 0.0,
            "authenticity_score": 0.0,
            "key_aspects": [],
            "negative_indicators": [],
            "positive_indicators": []
        }

def analyze_negative_feedback(text: str) -> Dict[str, Any]:
    """Specialized analysis for negative feedback authenticity and categorization"""
    prompt = f"""
    Analyze this negative restaurant feedback for authenticity and categorization:
    
    Text: "{text}"
    
    Provide detailed analysis as JSON:
    - is_authentic: boolean indicating if this seems like genuine criticism
    - authenticity_confidence: confidence in authenticity assessment (0-1)
    - complaint_categories: list of categories (service, food_quality, cleanliness, value, atmosphere, wait_time)
    - severity_score: how severe the complaints are (1-5)
    - specific_issues: list of specific problems mentioned
    - constructive_feedback: boolean indicating if feedback is constructive vs just complaining
    - fake_review_indicators: list of potential signs this might be fake
    """
    
    try:
        response = bedrock_runtime.invoke_model(
            modelId='anthropic.claude-3-sonnet-20240229-v1:0',
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 500,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            })
        )
        
        response_body = json.loads(response['body'].read())
        content = response_body['content'][0]['text']
        
        try:
            negative_analysis = json.loads(content)
        except json.JSONDecodeError:
            negative_analysis = {
                "is_authentic": True,
                "authenticity_confidence": 0.5,
                "complaint_categories": [],
                "severity_score": 3,
                "specific_issues": [],
                "constructive_feedback": True,
                "fake_review_indicators": []
            }
        
        return negative_analysis
        
    except Exception as e:
        logger.error(f"Error in negative feedback analysis: {str(e)}")
        return {
            "is_authentic": True,
            "authenticity_confidence": 0.0,
            "complaint_categories": [],
            "severity_score": 3,
            "specific_issues": [],
            "constructive_feedback": True,
            "fake_review_indicators": []
        }

def create_success_response(data: Dict[str, Any]) -> Dict[str, Any]:
    """Create successful API response"""
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        'body': json.dumps({
            'success': True,
            'data': data
        })
    }

def create_error_response(status_code: int, message: str) -> Dict[str, Any]:
    """Create error API response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        'body': json.dumps({
            'success': False,
            'error': {
                'message': message,
                'code': status_code
            }
        })
    }