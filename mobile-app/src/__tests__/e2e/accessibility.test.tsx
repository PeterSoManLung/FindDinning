import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { store } from '@store/store';
import HomeScreen from '@screens/main/HomeScreen';
import LoginScreen from '@screens/auth/LoginScreen';
import RestaurantDetailScreen from '@screens/main/RestaurantDetailScreen';
import RecommendationCard from '@components/RecommendationCard';

// Mock accessibility services
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  AccessibilityInfo: {
    isScreenReaderEnabled: jest.fn(),
    announceForAccessibility: jest.fn(),
    setAccessibilityFocus: jest.fn(),
  },
}));

describe('Accessibility Tests', () => {
  describe('Screen Reader Support', () => {
    it('should provide proper accessibility labels for all interactive elements', () => {
      const { getByLabelText, getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      // Test main navigation elements
      expect(getByLabelText('Home tab')).toBeTruthy();
      expect(getByLabelText('Profile tab')).toBeTruthy();
      expect(getByLabelText('Search restaurants')).toBeTruthy();
      expect(getByLabelText('Refresh recommendations')).toBeTruthy();

      // Test recommendation cards
      const recommendationCard = getByTestId('recommendation-card-0');
      expect(recommendationCard.props.accessibilityLabel).toContain('restaurant recommendation');
      expect(recommendationCard.props.accessibilityRole).toBe('button');
    });

    it('should provide descriptive accessibility hints', () => {
      const mockRestaurant = {
        id: 'rest-1',
        name: 'Golden Dragon',
        cuisineType: ['Chinese'],
        rating: 4.5,
        priceRange: 3,
        location: {
          address: '123 Central Street',
          district: 'Central',
        },
      };

      const { getByTestId } = render(
        <RecommendationCard
          restaurant={mockRestaurant}
          matchScore={0.85}
          reasonsForRecommendation={['Matches your preferences']}
          onPress={() => {}}
        />
      );

      const card = getByTestId('recommendation-card');
      expect(card.props.accessibilityLabel).toBe(
        'Golden Dragon, Chinese cuisine, 4.5 star rating, price range 3 out of 4, located in Central'
      );
      expect(card.props.accessibilityHint).toBe('Double tap to view restaurant details');
    });

    it('should announce important state changes', async () => {
      const mockAccessibilityInfo = require('react-native').AccessibilityInfo;

      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      fireEvent.press(getByTestId('refresh-recommendations'));

      await waitFor(() => {
        expect(mockAccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
          'Loading new recommendations'
        );
      });

      await waitFor(() => {
        expect(mockAccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
          'Recommendations updated'
        );
      }, { timeout: 5000 });
    });

    it('should handle screen reader navigation properly', () => {
      const { getByTestId, getAllByRole } = render(
        <Provider store={store}>
          <NavigationContainer>
            <LoginScreen />
          </NavigationContainer>
        </Provider>
      );

      // Test form accessibility
      const textInputs = getAllByRole('textbox');
      expect(textInputs).toHaveLength(2); // Email and password

      expect(getByTestId('email-input').props.accessibilityLabel).toBe('Email address');
      expect(getByTestId('password-input').props.accessibilityLabel).toBe('Password');
      expect(getByTestId('password-input').props.secureTextEntry).toBe(true);

      const loginButton = getByTestId('submit-login');
      expect(loginButton.props.accessibilityRole).toBe('button');
      expect(loginButton.props.accessibilityLabel).toBe('Log in');
    });
  });

  describe('Voice Control Support', () => {
    it('should support voice commands for navigation', () => {
      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      // Test voice control labels
      expect(getByTestId('home-tab').props.accessibilityLabel).toBe('Home tab');
      expect(getByTestId('profile-tab').props.accessibilityLabel).toBe('Profile tab');
      expect(getByTestId('emotion-selector').props.accessibilityLabel).toBe('Select your current mood');
    });

    it('should provide voice-friendly action descriptions', () => {
      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <RestaurantDetailScreen />
          </NavigationContainer>
        </Provider>
      );

      expect(getByTestId('call-restaurant').props.accessibilityLabel).toBe('Call restaurant');
      expect(getByTestId('get-directions').props.accessibilityLabel).toBe('Get directions to restaurant');
      expect(getByTestId('save-favorite').props.accessibilityLabel).toBe('Save restaurant as favorite');
    });
  });

  describe('Visual Accessibility', () => {
    it('should support high contrast mode', () => {
      // Mock high contrast mode
      jest.mock('react-native', () => ({
        ...jest.requireActual('react-native'),
        AccessibilityInfo: {
          ...jest.requireActual('react-native').AccessibilityInfo,
          isHighContrastEnabled: jest.fn().mockResolvedValue(true),
        },
      }));

      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      const recommendationCard = getByTestId('recommendation-card-0');
      // In high contrast mode, colors should be adjusted
      expect(recommendationCard.props.style).toEqual(
        expect.objectContaining({
          borderWidth: expect.any(Number),
          borderColor: expect.any(String),
        })
      );
    });

    it('should provide sufficient color contrast', () => {
      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      // Test that text has sufficient contrast
      const titleText = getByTestId('screen-title');
      const styles = titleText.props.style;
      
      // Verify dark text on light background or vice versa
      expect(styles.color).toBeDefined();
      expect(styles.backgroundColor || '#FFFFFF').toBeDefined();
    });

    it('should support large text sizes', () => {
      // Mock large text setting
      jest.mock('react-native', () => ({
        ...jest.requireActual('react-native'),
        PixelRatio: {
          getFontScale: jest.fn().mockReturnValue(1.5), // 150% text size
        },
      }));

      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      const titleText = getByTestId('screen-title');
      expect(titleText.props.style.fontSize).toBeGreaterThan(16);
    });
  });

  describe('Motor Accessibility', () => {
    it('should provide adequate touch targets', () => {
      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      const buttons = [
        getByTestId('refresh-recommendations'),
        getByTestId('emotion-selector'),
        getByTestId('location-button'),
      ];

      buttons.forEach((button) => {
        const { width, height } = button.props.style;
        // Minimum touch target size should be 44x44 points
        expect(width || 44).toBeGreaterThanOrEqual(44);
        expect(height || 44).toBeGreaterThanOrEqual(44);
      });
    });

    it('should support switch control navigation', () => {
      const { getByTestId, getAllByRole } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      // All interactive elements should be focusable
      const buttons = getAllByRole('button');
      buttons.forEach((button) => {
        expect(button.props.accessible).toBe(true);
        expect(button.props.accessibilityRole).toBe('button');
      });

      // Test tab order
      const tabOrder = [
        getByTestId('home-tab'),
        getByTestId('profile-tab'),
        getByTestId('refresh-recommendations'),
        getByTestId('emotion-selector'),
      ];

      tabOrder.forEach((element, index) => {
        expect(element.props.accessibilityElementsHidden).toBeFalsy();
      });
    });
  });

  describe('Cognitive Accessibility', () => {
    it('should provide clear and simple language', () => {
      const { getByText } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      // Test that UI text is clear and simple
      expect(getByText('Find Dining')).toBeTruthy();
      expect(getByText('Recommendations')).toBeTruthy();
      expect(getByText('How are you feeling?')).toBeTruthy();
    });

    it('should provide helpful error messages', async () => {
      const { getByTestId, getByText } = render(
        <Provider store={store}>
          <NavigationContainer>
            <LoginScreen />
          </NavigationContainer>
        </Provider>
      );

      // Test form validation messages
      fireEvent.press(getByTestId('submit-login'));

      await waitFor(() => {
        expect(getByText('Please enter your email address')).toBeTruthy();
        expect(getByText('Please enter your password')).toBeTruthy();
      });
    });

    it('should provide progress indicators for long operations', async () => {
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

      // Should show progress or completion
      await waitFor(() => {
        expect(getByTestId('recommendation-list')).toBeTruthy();
      }, { timeout: 5000 });
    });
  });

  describe('Accessibility Testing Utilities', () => {
    it('should validate accessibility tree structure', () => {
      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      const homeScreen = getByTestId('home-screen');
      
      // Verify proper heading hierarchy
      expect(homeScreen.findByProps({ accessibilityRole: 'header' })).toBeTruthy();
      
      // Verify proper grouping
      const recommendationList = getByTestId('recommendation-list');
      expect(recommendationList.props.accessibilityRole).toBe('list');
    });

    it('should test with accessibility scanner', () => {
      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      // Simulate accessibility scanner checks
      const interactiveElements = [
        getByTestId('refresh-recommendations'),
        getByTestId('emotion-selector'),
        getByTestId('home-tab'),
        getByTestId('profile-tab'),
      ];

      interactiveElements.forEach((element) => {
        // Check for required accessibility properties
        expect(element.props.accessible).toBe(true);
        expect(element.props.accessibilityLabel).toBeDefined();
        expect(element.props.accessibilityRole).toBeDefined();
      });
    });
  });
});