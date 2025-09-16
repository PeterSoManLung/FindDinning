# 搵食 (Find Dining) - Restaurant Recommendation Platform

An AI-powered restaurant recommendation application designed for Hong Kong diners, focusing on personalized suggestions based on user preferences, emotional state, and authentic negative feedback analysis.

## Project Structure

```
find-dining-app/
├── shared/                     # Shared utilities and types
│   ├── src/
│   │   ├── types/             # TypeScript interfaces
│   │   │   ├── user.types.ts
│   │   │   ├── restaurant.types.ts
│   │   │   ├── recommendation.types.ts
│   │   │   ├── review.types.ts
│   │   │   ├── emotion.types.ts
│   │   │   └── api.types.ts
│   │   └── utils/             # Common utilities
│   │       ├── response.utils.ts
│   │       ├── validation.utils.ts
│   │       └── distance.utils.ts
│   └── package.json
├── user-service/              # User management microservice
│   ├── src/
│   │   └── index.ts
│   └── package.json
├── restaurant-service/        # Restaurant data management
│   ├── src/
│   │   └── index.ts
│   └── package.json
├── recommendation-engine/     # AI-powered recommendation engine
│   ├── src/
│   │   └── index.ts
│   └── package.json
├── review-service/           # Review and negative feedback analysis
│   ├── src/
│   │   └── index.ts
│   └── package.json
├── emotion-service/          # Emotion analysis service
│   ├── src/
│   │   └── index.ts
│   └── package.json
└── package.json              # Root workspace configuration
```

## Microservices Architecture

### 1. User Service (Port 3001)
- User authentication and authorization
- User profile and preference management
- Dining history tracking

### 2. Restaurant Service (Port 3002)
- Restaurant data management
- Menu and cuisine information
- Location and operating hours

### 3. Recommendation Engine (Port 3003)
- AI-powered personalized recommendations
- Emotion-aware suggestions
- Caching and optimization

### 4. Review Service (Port 3004)
- Authentic review management
- Negative feedback analysis
- Multi-platform review aggregation

### 5. Emotion Service (Port 3005)
- Emotional state analysis
- Mood-to-cuisine mapping
- Context-aware recommendations

## Shared Package

The `shared` package contains:
- **TypeScript Interfaces**: Common data models and API contracts
- **Utility Functions**: Response builders, validation helpers, distance calculations
- **Error Handling**: Standardized error codes and response formats

## Getting Started

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation
```bash
# Install all dependencies
npm run install:all

# Build shared package first
npm run build:shared

# Build all services
npm run build
```

### Development
```bash
# Run individual services
npm run dev:user
npm run dev:restaurant
npm run dev:recommendation
npm run dev:review
npm run dev:emotion
```

### Testing
```bash
# Run tests for all services
npm run test
```

## Key Features

- **Personalized Recommendations**: AI-driven suggestions based on user preferences and dining history
- **Emotion-Aware Dining**: Recommendations that consider user's emotional state
- **Negative Feedback Focus**: Restaurant rankings based on authentic criticism rather than paid reviews
- **Local Hong Kong Focus**: Emphasis on authentic local establishments and hidden gems
- **Multi-Platform Integration**: Data aggregation from major Hong Kong food platforms

## Technology Stack

- **Backend**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: Amazon RDS (PostgreSQL)
- **Caching**: Amazon ElastiCache (Redis)
- **AI/ML**: Amazon SageMaker, Amazon Bedrock
- **Infrastructure**: AWS (EKS, API Gateway, S3)
- **Container**: Docker with Kubernetes

## API Documentation

Each service exposes RESTful APIs with standardized response formats. Health check endpoints are available at `/health` for all services.

## Contributing

This project follows microservices architecture principles with shared TypeScript interfaces and utilities to ensure consistency across services.