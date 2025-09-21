import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { store } from '@store/store';
import App from '../../App';
import * as authService from '@services/authService';
import * as userService from '@services/userService';
import * as recommendationService from '@services/recommendationService';
import * as restaurantService from '@services/restaurantService';

// Mock services
jest.mock('@services/authService');
jest.mock('@services/userService');
jest.mock('@services/recommendationService');
jest.mock('@services/restaurantService');

const mockedAuthService = authService as jest.Mocked<typeof authService>;
const mockedUserService = userService as jest.Mocked<typeof userService>;
const mockedRecommendationService = recommendationService as jest.Mocked<typeof recommendationService>;
const mockedRestaurantService = restaurantService as jest.Mocked<typeof restaurantService>;

// Test data
const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  preferences: {
    cuisineTypes: ['Chinese', 'Italian'],
    priceRange: [2, 4] as [number, number],
    dietaryRestrictions: [],
    atmospherePreferences: ['casual'],
    spiceLevel: 3,
  },
  diningHistory: [],
  emotionalProfile: {
    preferredComfortFoods: ['Chinese'],
    celebratoryPreferences: ['Italian'],
  },
  location: {
    latitude: 22.3193,
    longitude: 114.1694,
    district: 'Central',
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRecommendations = [
  {
    restaurant: {
      id: 'rest-1',
      name: 'Golden Dragon',
      cuisineType: ['Chinese'],
      location: {
        address: '123 Central Street',
        latitude: 22.3193,
        longitude: 114.1694,
        district: 'Central',
      },
      priceRange: 3,
      rating: 4.5,
      negativeScore: 0.2,
      atmosphere: ['casual', 'family-friendly'],
      operatingHours: {
        monday: { open: '11:00', close: '22:00' },
        tuesday: { open: '11:00', close: '22:00' },
        wednesday: { open: '11:00', close: '22:00' },
        thursday: { open: '11:00', close: '22:00' },
        friday: { open: '11:00', close: '22:00' },
        saturday: { open: '11:00', close: '22:00' },
        sunday: { open: '11:00', close: '22:00' },
      },
      menuHighlights: [
        { name: 'Dim Sum', price: 80, description: 'Traditional dim sum' },
      ],
      specialFeatures: ['outdoor seating'],
      isLocalGem: true,
      authenticityScore: 0.9,
      governmentLicense: {
        licenseNumber: 'HK123456',
        isValid: true,
        violations: [],
      },
      dataQualityScore: 0.95,
      negativeFeedbackTrends: [],
      platformData: [],
      lastSyncDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    matchScore: 0.85,
    reasonsForRecommendation: ['Matches your Chinese cuisine preference', 'Local gem'],
    emotionalAlignment: 0.8,
  },
];

describe('End-to-End User Journey Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete User Registration to Restaurant Discovery Flow', () => {
    it('should complete full user journey from registration to restaurant recommendation', async () => {
      // Mock API responses
      mockedAuthService.register.mockResolvedValue({
        user: mockUser,
        token: 'mock-token',
      });
      
      mockedAuthService.login.mockResolvedValue({
        user: mockUser,
        token: 'mock-token',
      });

      mockedUserService.updatePreferences.mockResolvedValue(mockUser);
      
      mockedRecommendationService.getRecommendations.mockResolvedValue({
        recommendations: mockRecommendations,
        emotionalContext: 'neutral',
        generatedAt: new Date(),
        confidence: 0.85,
        reasoning: 'Based on your preferences',
      });

      mockedRestaurantService.getRestaurantDetails.mockResolvedValue(mockRecommendations[0].restaurant);

      const { getByTestId, getByText, queryByText } = render(
        <Provider store={store}>
          <NavigationContainer>
            <App />
          </NavigationContainer>
        </Provider>
      );

      // Step 1: User Registration
      await waitFor(() => {
        expect(getByTestId('register-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('register-button'));

      await waitFor(() => {
        expect(getByTestId('register-form')).toBeTruthy();
      });

      // Fill registration form
      fireEvent.changeText(getByTestId('name-input'), 'Test User');
      fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
      fireEvent.changeText(getByTestId('password-input'), 'password123');

      fireEvent.press(getByTestId('submit-register'));

      // Step 2: Preference Setup
      await waitFor(() => {
        expect(getByTestId('preference-setup')).toBeTruthy();
      }, { timeout: 5000 });

      // Select cuisine preferences
      fireEvent.press(getByTestId('cuisine-chinese'));
      fireEvent.press(getByTestId('cuisine-italian'));

      // Set price range
      fireEvent.press(getByTestId('price-range-3'));

      // Select atmosphere
      fireEvent.press(getByTestId('atmosphere-casual'));

      fireEvent.press(getByTestId('save-preferences'));

      // Step 3: Home Screen with Recommendations
      await waitFor(() => {
        expect(getByTestId('home-screen')).toBeTruthy();
      }, { timeout: 5000 });

      await waitFor(() => {
        expect(getByText('Golden Dragon')).toBeTruthy();
      }, { timeout: 3000 });

      // Verify recommendation display
      expect(getByText('Chinese')).toBeTruthy();
      expect(getByText('Local gem')).toBeTruthy();

      // Step 4: Restaurant Detail View
      fireEvent.press(getByTestId('recommendation-card-rest-1'));

      await waitFor(() => {
        expect(getByTestId('restaurant-detail-screen')).toBeTruthy();
      });

      expect(getByText('Golden Dragon')).toBeTruthy();
      expect(getByText('123 Central Street')).toBeTruthy();
      expect(getByText('Traditional dim sum')).toBeTruthy();

      // Verify all API calls were made
      expect(mockedAuthService.register).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      expect(mockedUserService.updatePreferences).toHaveBeenCalled();
      expect(mockedRecommendationService.getRecommendations).toHaveBeenCalled();
      expect(mockedRestaurantService.getRestaurantDetails).toHaveBeenCalledWith('rest-1');
    });

    it('should handle emotion-based recommendation flow', async () => {
      // Mock authenticated user state
      mockedAuthService.getCurrentUser.mockResolvedValue(mockUser);
      
      const emotionRecommendations = [
        {
          ...mockRecommendations[0],
          restaurant: {
            ...mockRecommendations[0].restaurant,
            name: 'Comfort Kitchen',
            cuisineType: ['Chinese', 'Comfort Food'],
          },
          emotionalAlignment: 0.95,
          reasonsForRecommendation: ['Perfect for comfort food', 'Cozy atmosphere'],
        },
      ];

      mockedRecommendationService.getEmotionBasedRecommendations.mockResolvedValue({
        recommendations: emotionRecommendations,
        emotionalContext: 'sad',
        generatedAt: new Date(),
        confidence: 0.9,
        reasoning: 'Comfort food recommendations for your current mood',
      });

      const { getByTestId, getByText } = render(
        <Provider store={store}>
          <NavigationContainer>
            <App />
          </NavigationContainer>
        </Provider>
      );

      // Navigate to home screen (assuming user is logged in)
      await waitFor(() => {
        expect(getByTestId('home-screen')).toBeTruthy();
      });

      // Select emotion
      fireEvent.press(getByTestId('emotion-selector'));
      fireEvent.press(getByTestId('emotion-sad'));

      // Wait for emotion-based recommendations
      await waitFor(() => {
        expect(getByText('Comfort Kitchen')).toBeTruthy();
      }, { timeout: 3000 });

      expect(getByText('Perfect for comfort food')).toBeTruthy();
      expect(mockedRecommendationService.getEmotionBasedRecommendations).toHaveBeenCalledWith(
        expect.objectContaining({
          emotion: 'sad',
        })
      );
    });
  });

  describe('User Authentication Flow', () => {
    it('should handle login flow correctly', async () => {
      mockedAuthService.login.mockResolvedValue({
        user: mockUser,
        token: 'mock-token',
      });

      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <App />
          </NavigationContainer>
        </Provider>
      );

      // Navigate to login
      fireEvent.press(getByTestId('login-button'));

      await waitFor(() => {
        expect(getByTestId('login-form')).toBeTruthy();
      });

      fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
      fireEvent.changeText(getByTestId('password-input'), 'password123');
      fireEvent.press(getByTestId('submit-login'));

      await waitFor(() => {
        expect(getByTestId('home-screen')).toBeTruthy();
      }, { timeout: 5000 });

      expect(mockedAuthService.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should handle authentication errors gracefully', async () => {
      mockedAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

      const { getByTestId, getByText } = render(
        <Provider store={store}>
          <NavigationContainer>
            <App />
          </NavigationContainer>
        </Provider>
      );

      fireEvent.press(getByTestId('login-button'));

      await waitFor(() => {
        expect(getByTestId('login-form')).toBeTruthy();
      });

      fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
      fireEvent.changeText(getByTestId('password-input'), 'wrongpassword');
      fireEvent.press(getByTestId('submit-login'));

      await waitFor(() => {
        expect(getByText('Invalid credentials')).toBeTruthy();
      });
    });
  });

  describe('Preference Management Flow', () => {
    it('should update user preferences and reflect in recommendations', async () => {
      const updatedUser = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          cuisineTypes: ['Japanese', 'Korean'],
        },
      };

      mockedUserService.updatePreferences.mockResolvedValue(updatedUser);
      mockedRecommendationService.getRecommendations.mockResolvedValue({
        recommendations: [
          {
            ...mockRecommendations[0],
            restaurant: {
              ...mockRecommendations[0].restaurant,
              name: 'Sushi Master',
              cuisineType: ['Japanese'],
            },
          },
        ],
        emotionalContext: 'neutral',
        generatedAt: new Date(),
        confidence: 0.8,
        reasoning: 'Based on your updated preferences',
      });

      const { getByTestId, getByText } = render(
        <Provider store={store}>
          <NavigationContainer>
            <App />
          </NavigationContainer>
        </Provider>
      );

      // Navigate to profile
      fireEvent.press(getByTestId('profile-tab'));

      await waitFor(() => {
        expect(getByTestId('profile-screen')).toBeTruthy();
      });

      // Update preferences
      fireEvent.press(getByTestId('edit-preferences'));
      fireEvent.press(getByTestId('cuisine-japanese'));
      fireEvent.press(getByTestId('cuisine-korean'));
      fireEvent.press(getByTestId('save-preferences'));

      // Navigate back to home
      fireEvent.press(getByTestId('home-tab'));

      await waitFor(() => {
        expect(getByText('Sushi Master')).toBeTruthy();
      }, { timeout: 3000 });

      expect(mockedUserService.updatePreferences).toHaveBeenCalled();
    });
  });
});