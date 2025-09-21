# API Gateway

The API Gateway serves as the unified entry point for all microservices in the Find Dining application. It provides routing, authentication, rate limiting, request validation, and error handling.

## Features

- **Unified API Routing**: Routes requests to appropriate microservices
- **Request Validation**: Validates incoming requests using Joi schemas
- **Rate Limiting**: Implements different rate limits for different endpoint types
- **Error Handling**: Standardized error responses across all services
- **Health Checks**: Monitors the health of all connected microservices
- **Security**: CORS, Helmet security headers, and request sanitization
- **Logging**: Comprehensive request/response logging with request IDs

## Architecture

The API Gateway acts as a reverse proxy, forwarding requests to the appropriate microservices:

- **User Service** (`/api/users/*`) - User authentication and profile management
- **Restaurant Service** (`/api/restaurants/*`) - Restaurant data and search
- **Recommendation Engine** (`/api/recommendations/*`) - AI-powered recommendations
- **Review Service** (`/api/reviews/*`) - Review management and analysis
- **Emotion Service** (`/api/emotion/*`) - Emotion analysis and mood mapping

## Rate Limiting

Different endpoints have different rate limits:

- **General**: 100 requests per 15 minutes
- **Authentication**: 5 requests per 15 minutes
- **Recommendations**: 10 requests per minute
- **Data Operations**: 20 requests per minute

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
PORT=3000
NODE_ENV=development
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
CORS_ORIGINS=http://localhost:3000,http://localhost:19006

# Microservice URLs
USER_SERVICE_URL=http://localhost:3001
RESTAURANT_SERVICE_URL=http://localhost:3002
RECOMMENDATION_ENGINE_URL=http://localhost:3003
REVIEW_SERVICE_URL=http://localhost:3004
EMOTION_SERVICE_URL=http://localhost:3005
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Start production server
npm start
```

## API Documentation

### Health Checks

- `GET /health` - Overall system health
- `GET /health/:service` - Individual service health

### Error Responses

All errors follow a standardized format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {},
    "timestamp": "2023-09-20T10:00:00.000Z",
    "requestId": "uuid"
  }
}
```

### Request/Response Headers

- `x-request-id`: Unique request identifier (auto-generated if not provided)
- `x-service`: Identifies which service handled the request
- Standard security headers via Helmet

## Testing

The API Gateway includes comprehensive tests:

- Unit tests for middleware components
- Integration tests for API routing and validation
- Health check testing
- Error handling validation

Run tests with: `npm test`