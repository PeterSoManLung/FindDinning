import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { Platform } from 'react-native';
import { store } from '@store/store';
import App from '../../App';
import HomeScreen from '@screens/main/HomeScreen';
import LoginScreen from '@screens/auth/LoginScreen';

// Mock platform-specific modules
jest.mock('react-native-permissions', () => ({
  request: jest.fn(),
  check: jest.fn(),
  PERMISSIONS: {
    IOS: {
      LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE',
    },
    ANDROID: {
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
    },
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
  },
}));

describe('Cross-Platform Consistency Tests', () => {
  describe('iOS Platform Tests', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
      Platform.select = jest.fn((obj) => obj.ios);
    });

    it('should render iOS-specific components correctly', () => {
      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      // Test iOS-specific styling and components
      expect(getByTestId('home-screen')).toBeTruthy();
      
      // Verify iOS-specific safe area handling
      const safeAreaView = getByTestId('safe-area-view');
      expect(safeAreaView).toBeTruthy();
    });

    it('should handle iOS location permissions correctly', async () => {
      const mockPermissions = require('react-native-permissions');
      mockPermissions.check.mockResolvedValue('granted');

      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      fireEvent.press(getByTestId('location-button'));

      await waitFor(() => {
        expect(mockPermissions.check).toHaveBeenCalledWith(
          mockPermissions.PERMISSIONS.IOS.LOCATION_WHEN_IN_USE
        );
      });
    });

    it('should display iOS-specific navigation elements', () => {
      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <LoginScreen />
          </NavigationContainer>
        </Provider>
      );

      // iOS typically uses different navigation patterns
      const backButton = getByTestId('back-button');
      expect(backButton).toBeTruthy();
    });
  });

  describe('Android Platform Tests', () => {
    beforeEach(() => {
      Platform.OS = 'android';
      Platform.select = jest.fn((obj) => obj.android);
    });

    it('should render Android-specific components correctly', () => {
      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      expect(getByTestId('home-screen')).toBeTruthy();
      
      // Verify Android-specific status bar handling
      const statusBar = getByTestId('status-bar');
      expect(statusBar).toBeTruthy();
    });

    it('should handle Android location permissions correctly', async () => {
      const mockPermissions = require('react-native-permissions');
      mockPermissions.check.mockResolvedValue('granted');

      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      fireEvent.press(getByTestId('location-button'));

      await waitFor(() => {
        expect(mockPermissions.check).toHaveBeenCalledWith(
          mockPermissions.PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION
        );
      });
    });

    it('should display Android-specific navigation elements', () => {
      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <LoginScreen />
          </NavigationContainer>
        </Provider>
      );

      // Android typically uses hardware back button
      const hardwareBackHandler = getByTestId('hardware-back-handler');
      expect(hardwareBackHandler).toBeTruthy();
    });
  });

  describe('Platform-Agnostic Functionality', () => {
    it('should maintain consistent user experience across platforms', () => {
      const testPlatforms = ['ios', 'android'];

      testPlatforms.forEach((platform) => {
        Platform.OS = platform as any;
        Platform.select = jest.fn((obj) => obj[platform]);

        const { getByTestId, getByText } = render(
          <Provider store={store}>
            <NavigationContainer>
              <HomeScreen />
            </NavigationContainer>
          </Provider>
        );

        // Core functionality should work the same
        expect(getByTestId('home-screen')).toBeTruthy();
        expect(getByText('Find Dining')).toBeTruthy();
        expect(getByTestId('recommendation-list')).toBeTruthy();
      });
    });

    it('should handle network requests consistently across platforms', async () => {
      const testPlatforms = ['ios', 'android'];

      for (const platform of testPlatforms) {
        Platform.OS = platform as any;
        Platform.select = jest.fn((obj) => obj[platform]);

        const { getByTestId } = render(
          <Provider store={store}>
            <NavigationContainer>
              <HomeScreen />
            </NavigationContainer>
          </Provider>
        );

        fireEvent.press(getByTestId('refresh-recommendations'));

        await waitFor(() => {
          expect(getByTestId('loading-indicator')).toBeTruthy();
        });

        // Network behavior should be consistent
        await waitFor(() => {
          expect(getByTestId('recommendation-list')).toBeTruthy();
        }, { timeout: 5000 });
      }
    });
  });

  describe('Responsive Design Tests', () => {
    it('should adapt to different screen sizes', () => {
      const screenSizes = [
        { width: 375, height: 812 }, // iPhone X
        { width: 414, height: 896 }, // iPhone 11 Pro Max
        { width: 360, height: 640 }, // Android Medium
        { width: 768, height: 1024 }, // Tablet
      ];

      screenSizes.forEach((size) => {
        require('react-native').Dimensions.get = jest.fn(() => size);

        const { getByTestId } = render(
          <Provider store={store}>
            <NavigationContainer>
              <HomeScreen />
            </NavigationContainer>
          </Provider>
        );

        expect(getByTestId('home-screen')).toBeTruthy();
        
        // Verify responsive layout
        const recommendationCard = getByTestId('recommendation-card-0');
        expect(recommendationCard).toBeTruthy();
      });
    });

    it('should handle orientation changes', () => {
      const orientations = [
        { width: 375, height: 812 }, // Portrait
        { width: 812, height: 375 }, // Landscape
      ];

      orientations.forEach((orientation) => {
        require('react-native').Dimensions.get = jest.fn(() => orientation);

        const { getByTestId } = render(
          <Provider store={store}>
            <NavigationContainer>
              <HomeScreen />
            </NavigationContainer>
          </Provider>
        );

        expect(getByTestId('home-screen')).toBeTruthy();
        expect(getByTestId('recommendation-list')).toBeTruthy();
      });
    });
  });

  describe('Performance Consistency', () => {
    it('should maintain consistent performance across platforms', async () => {
      const testPlatforms = ['ios', 'android'];

      for (const platform of testPlatforms) {
        Platform.OS = platform as any;
        
        const startTime = Date.now();

        const { getByTestId } = render(
          <Provider store={store}>
            <NavigationContainer>
              <HomeScreen />
            </NavigationContainer>
          </Provider>
        );

        await waitFor(() => {
          expect(getByTestId('home-screen')).toBeTruthy();
        });

        const renderTime = Date.now() - startTime;
        
        // Should render within 2 seconds on both platforms
        expect(renderTime).toBeLessThan(2000);
      }
    });

    it('should handle large datasets consistently', async () => {
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        id: `rest-${i}`,
        name: `Restaurant ${i}`,
        cuisineType: ['Chinese'],
        rating: 4.0 + (i % 10) / 10,
      }));

      // Mock large recommendation dataset
      jest.doMock('@services/recommendationService', () => ({
        getRecommendations: jest.fn().mockResolvedValue({
          recommendations: largeDataset.map(restaurant => ({
            restaurant,
            matchScore: 0.8,
            reasonsForRecommendation: ['Good match'],
            emotionalAlignment: 0.7,
          })),
        }),
      }));

      const testPlatforms = ['ios', 'android'];

      for (const platform of testPlatforms) {
        Platform.OS = platform as any;

        const { getByTestId } = render(
          <Provider store={store}>
            <NavigationContainer>
              <HomeScreen />
            </NavigationContainer>
          </Provider>
        );

        await waitFor(() => {
          expect(getByTestId('recommendation-list')).toBeTruthy();
        }, { timeout: 5000 });

        // Should handle large datasets without crashing
        expect(getByTestId('recommendation-card-0')).toBeTruthy();
      }
    });
  });
});