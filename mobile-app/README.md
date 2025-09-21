# 搵食 (Find Dining) Mobile App

A React Native mobile application for AI-powered restaurant recommendations in Hong Kong.

## Features

- **Personalized Recommendations**: Get restaurant suggestions based on your dining preferences and history
- **Emotion-Aware Suggestions**: Receive mood-appropriate dining recommendations
- **Local Gems Discovery**: Find authentic Hong Kong eateries and hidden gems
- **Quick Decision Making**: Get instant recommendations without complex search filters
- **User Authentication**: Secure login and registration system
- **Preference Management**: Customize your dining preferences and dietary restrictions

## Tech Stack

- **React Native 0.72.6**: Cross-platform mobile development
- **TypeScript**: Type-safe development
- **Redux Toolkit**: State management with RTK Query
- **React Navigation 6**: Navigation and routing
- **React Native Vector Icons**: Icon library
- **Axios**: HTTP client for API communication
- **Jest & React Native Testing Library**: Testing framework

## Project Structure

```
src/
├── components/          # Reusable UI components
├── screens/            # Screen components
│   ├── auth/          # Authentication screens
│   └── main/          # Main app screens
├── navigation/         # Navigation configuration
├── store/             # Redux store and slices
├── services/          # API service layer
├── types/             # TypeScript type definitions
└── __tests__/         # Test files
```

## Getting Started

### Prerequisites

- Node.js (>= 16)
- React Native CLI
- iOS Simulator (for iOS development)
- Android Studio & Android SDK (for Android development)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Install iOS dependencies (iOS only):
```bash
cd ios && pod install && cd ..
```

### Running the App

#### iOS
```bash
npm run ios
```

#### Android
```bash
npm run android
```

#### Start Metro Bundler
```bash
npm start
```

## Testing

Run unit tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm test -- --coverage
```

## Key Components

### Authentication
- **LoginScreen**: User login with email/password
- **RegisterScreen**: User registration with form validation

### Main App
- **HomeScreen**: Main recommendation display with emotion selector
- **ProfileScreen**: User profile and preferences management
- **RestaurantDetailScreen**: Detailed restaurant information

### Core Components
- **RecommendationCard**: Restaurant recommendation display
- **EmotionSelector**: Mood-based recommendation selector
- **LoadingButton**: Button with loading state
- **PreferenceSection**: User preference management

## State Management

The app uses Redux Toolkit with the following slices:

- **authSlice**: Authentication state and user session
- **userSlice**: User profile and preferences
- **recommendationSlice**: Restaurant recommendations and feedback

## API Integration

The app communicates with the backend API through service layers:

- **authService**: Authentication operations
- **userService**: User profile management
- **recommendationService**: Recommendation fetching and feedback
- **restaurantService**: Restaurant details and search

## Development Guidelines

### Code Style
- Use TypeScript for type safety
- Follow React Native best practices
- Use functional components with hooks
- Implement proper error handling
- Write unit tests for components and services

### Testing
- Unit tests for components using React Native Testing Library
- Redux slice testing with mock stores
- Service layer testing with mocked API calls
- Aim for 70%+ code coverage

### Performance
- Use React.memo for expensive components
- Implement proper loading states
- Cache API responses where appropriate
- Optimize image loading and rendering

## Environment Configuration

Create environment-specific configurations:

- Development: Local API endpoints
- Production: Production API endpoints
- Staging: Staging API endpoints

## Deployment

### iOS
1. Build for release: `npm run build:ios`
2. Archive in Xcode
3. Upload to App Store Connect

### Android
1. Build APK: `npm run build:android`
2. Generate signed APK
3. Upload to Google Play Console

## Contributing

1. Follow the established code style
2. Write tests for new features
3. Update documentation as needed
4. Submit pull requests for review

## License

This project is proprietary and confidential.