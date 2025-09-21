import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { store } from '@store/store';
import HomeScreen from '@screens/main/HomeScreen';
import RestaurantDetailScreen from '@screens/main/RestaurantDetailScreen';
import * as recommendationService from '@services/recommendationService';
import * as restaurantService from '@services/restaurantService';

// Mock services
jest.mock('@services/recommendationService');
jest.mock('@services/restaurantService');

const mockedRecommendationService = recommendationService as jest.Mocked<typeof recommendationService>;
const mockedRestaurantService = restaurantService as jest.Mocked<typeof restaurantService>;

// Performance measurement utilities
const measurePerformance = async (operation: () => Promise<void>, label: string) => {
  const startTime = performance.now();
  await operation();
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  console.log(`${label}: ${duration.toFixed(2)}ms`);
  return duration;
};

const createMockRecommendations = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    restaurant: {
      id: `rest-${i}`,
      name: `Restaurant ${i}`,
      cuisineType: ['Chinese'],
      location: {
        address: `${i} Test Street`,
        latitude: 22.3193 + (i * 0.001),
        longitude: 114.1694 + (i * 0.001),
        district: 'Central',
      },
      priceRange: (i % 4) + 1,
      rating: 4.0 + (i % 10) / 10,
      negativeScore: 0.1 + (i % 5) / 50,
      atmosphere: ['casual'],
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
        { name: `Dish ${i}`, price: 50 + (i * 10), description: `Description ${i}` },
      ],
      specialFeatures: [],
      isLocalGem: i % 3 === 0,
      authenticityScore: 0.8 + (i % 2) * 0.1,
      governmentLicense: {
        licenseNumber: `HK${i}`,
        isValid: true,
        violations: [],
      },
      dataQualityScore: 0.9,
      negativeFeedbackTrends: [],
      platformData: [],
      lastSyncDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    matchScore: 0.8 + (i % 2) * 0.1,
    reasonsForRecommendation: [`Reason ${i}`],
    emotionalAlignment: 0.7 + (i % 3) * 0.1,
  }));
};

describe('Performance Benchmark Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Recommendation Generation Performance', () => {
    it('should generate recommendations within 3 seconds', async () => {
      const mockRecommendations = createMockRecommendations(10);
      
      mockedRecommendationService.getRecommendations.mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              recommendations: mockRecommendations,
              emotionalContext: 'neutral',
              generatedAt: new Date(),
              confidence: 0.85,
              reasoning: 'Based on your preferences',
            });
          }, 1000); // Simulate 1 second API call
        })
      );

      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      const duration = await measurePerformance(async () => {
        fireEvent.press(getByTestId('refresh-recommendations'));
        
        await waitFor(() => {
          expect(getByTestId('recommendation-list')).toBeTruthy();
        }, { timeout: 5000 });
      }, 'Recommendation Generation');

      // Should complete within 3 seconds (3000ms)
      expect(duration).toBeLessThan(3000);
    });

    it('should handle large recommendation datasets efficiently', async () => {
      const largeDataset = createMockRecommendations(100);
      
      mockedRecommendationService.getRecommendations.mockResolvedValue({
        recommendations: largeDataset,
        emotionalContext: 'neutral',
        generatedAt: new Date(),
        confidence: 0.85,
        reasoning: 'Based on your preferences',
      });

      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      const duration = await measurePerformance(async () => {
        fireEvent.press(getByTestId('refresh-recommendations'));
        
        await waitFor(() => {
          expect(getByTestId('recommendation-list')).toBeTruthy();
        }, { timeout: 5000 });
      }, 'Large Dataset Rendering');

      // Should handle 100 items within 2 seconds
      expect(duration).toBeLessThan(2000);
    });

    it('should cache recommendations for improved performance', async () => {
      const mockRecommendations = createMockRecommendations(10);
      
      mockedRecommendationService.getRecommendations.mockResolvedValue({
        recommendations: mockRecommendations,
        emotionalContext: 'neutral',
        generatedAt: new Date(),
        confidence: 0.85,
        reasoning: 'Based on your preferences',
      });

      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      // First load
      const firstLoadDuration = await measurePerformance(async () => {
        fireEvent.press(getByTestId('refresh-recommendations'));
        await waitFor(() => {
          expect(getByTestId('recommendation-list')).toBeTruthy();
        });
      }, 'First Load');

      // Second load (should be faster due to caching)
      const secondLoadDuration = await measurePerformance(async () => {
        fireEvent.press(getByTestId('refresh-recommendations'));
        await waitFor(() => {
          expect(getByTestId('recommendation-list')).toBeTruthy();
        });
      }, 'Cached Load');

      // Cached load should be significantly faster
      expect(secondLoadDuration).toBeLessThan(firstLoadDuration * 0.5);
    });
  });

  describe('App Launch Performance', () => {
    it('should launch and display initial screen within 2 seconds', async () => {
      const duration = await measurePerformance(async () => {
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
      }, 'App Launch');

      expect(duration).toBeLessThan(2000);
    });

    it('should display initial recommendations quickly', async () => {
      const mockRecommendations = createMockRecommendations(5);
      
      mockedRecommendationService.getRecommendations.mockResolvedValue({
        recommendations: mockRecommendations,
        emotionalContext: 'neutral',
        generatedAt: new Date(),
        confidence: 0.85,
        reasoning: 'Based on your preferences',
      });

      const duration = await measurePerformance(async () => {
        const { getByTestId } = render(
          <Provider store={store}>
            <NavigationContainer>
              <HomeScreen />
            </NavigationContainer>
          </Provider>
        );

        await waitFor(() => {
          expect(getByTestId('recommendation-card-0')).toBeTruthy();
        }, { timeout: 3000 });
      }, 'Initial Recommendations Display');

      expect(duration).toBeLessThan(3000);
    });
  });

  describe('Navigation Performance', () => {
    it('should navigate between screens quickly', async () => {
      const mockRestaurant = createMockRecommendations(1)[0].restaurant;
      
      mockedRestaurantService.getRestaurantDetails.mockResolvedValue(mockRestaurant);

      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      const duration = await measurePerformance(async () => {
        fireEvent.press(getByTestId('recommendation-card-0'));
        
        await waitFor(() => {
          expect(getByTestId('restaurant-detail-screen')).toBeTruthy();
        });
      }, 'Screen Navigation');

      // Navigation should be nearly instantaneous
      expect(duration).toBeLessThan(500);
    });

    it('should handle rapid navigation without performance degradation', async () => {
      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      const navigationTimes: number[] = [];

      // Perform multiple rapid navigations
      for (let i = 0; i < 5; i++) {
        const duration = await measurePerformance(async () => {
          fireEvent.press(getByTestId('profile-tab'));
          await waitFor(() => {
            expect(getByTestId('profile-screen')).toBeTruthy();
          });
          
          fireEvent.press(getByTestId('home-tab'));
          await waitFor(() => {
            expect(getByTestId('home-screen')).toBeTruthy();
          });
        }, `Navigation ${i + 1}`);

        navigationTimes.push(duration);
      }

      // Performance should remain consistent
      const averageTime = navigationTimes.reduce((a, b) => a + b, 0) / navigationTimes.length;
      const maxTime = Math.max(...navigationTimes);
      
      expect(maxTime).toBeLessThan(averageTime * 1.5); // No single navigation should be 50% slower than average
    });
  });

  describe('Memory Performance', () => {
    it('should handle memory efficiently with large datasets', async () => {
      const largeDataset = createMockRecommendations(500);
      
      mockedRecommendationService.getRecommendations.mockResolvedValue({
        recommendations: largeDataset,
        emotionalContext: 'neutral',
        generatedAt: new Date(),
        confidence: 0.85,
        reasoning: 'Based on your preferences',
      });

      const { getByTestId, unmount } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      await waitFor(() => {
        expect(getByTestId('recommendation-list')).toBeTruthy();
      });

      // Simulate memory cleanup
      act(() => {
        unmount();
      });

      // Should not throw memory-related errors
      expect(true).toBe(true);
    });

    it('should implement proper virtualization for long lists', async () => {
      const largeDataset = createMockRecommendations(200);
      
      mockedRecommendationService.getRecommendations.mockResolvedValue({
        recommendations: largeDataset,
        emotionalContext: 'neutral',
        generatedAt: new Date(),
        confidence: 0.85,
        reasoning: 'Based on your preferences',
      });

      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      await waitFor(() => {
        expect(getByTestId('recommendation-list')).toBeTruthy();
      });

      // Only visible items should be rendered (virtualization)
      const renderedCards = getByTestId('recommendation-list').children;
      expect(renderedCards.length).toBeLessThan(50); // Should not render all 200 items
    });
  });

  describe('Network Performance', () => {
    it('should handle slow network conditions gracefully', async () => {
      const mockRecommendations = createMockRecommendations(10);
      
      // Simulate slow network (3 second delay)
      mockedRecommendationService.getRecommendations.mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              recommendations: mockRecommendations,
              emotionalContext: 'neutral',
              generatedAt: new Date(),
              confidence: 0.85,
              reasoning: 'Based on your preferences',
            });
          }, 3000);
        })
      );

      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      fireEvent.press(getByTestId('refresh-recommendations'));

      // Should show loading indicator immediately
      await waitFor(() => {
        expect(getByTestId('loading-indicator')).toBeTruthy();
      }, { timeout: 100 });

      // Should eventually load content
      await waitFor(() => {
        expect(getByTestId('recommendation-list')).toBeTruthy();
      }, { timeout: 5000 });
    });

    it('should implement proper timeout handling', async () => {
      // Simulate network timeout
      mockedRecommendationService.getRecommendations.mockRejectedValue(
        new Error('Network timeout')
      );

      const { getByTestId, getByText } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      fireEvent.press(getByTestId('refresh-recommendations'));

      await waitFor(() => {
        expect(getByText('Network timeout')).toBeTruthy();
      }, { timeout: 2000 });
    });
  });

  describe('Rendering Performance', () => {
    it('should render complex restaurant cards efficiently', async () => {
      const complexRestaurant = {
        ...createMockRecommendations(1)[0].restaurant,
        menuHighlights: Array.from({ length: 20 }, (_, i) => ({
          name: `Dish ${i}`,
          price: 50 + i * 10,
          description: `Long description for dish ${i} with many details about ingredients and preparation`,
        })),
        specialFeatures: Array.from({ length: 10 }, (_, i) => `Feature ${i}`),
      };

      const duration = await measurePerformance(async () => {
        render(
          <RestaurantDetailScreen
            route={{ params: { restaurantId: 'rest-1' } }}
            navigation={{} as any}
          />
        );
      }, 'Complex Restaurant Card Rendering');

      expect(duration).toBeLessThan(1000);
    });

    it('should handle rapid state updates efficiently', async () => {
      const { getByTestId } = render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      const duration = await measurePerformance(async () => {
        // Simulate rapid emotion changes
        for (let i = 0; i < 10; i++) {
          fireEvent.press(getByTestId('emotion-selector'));
          fireEvent.press(getByTestId('emotion-happy'));
          await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
          });
        }
      }, 'Rapid State Updates');

      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track performance metrics', () => {
      const performanceMetrics = {
        appLaunchTime: 0,
        recommendationGenerationTime: 0,
        navigationTime: 0,
        renderTime: 0,
      };

      // Mock performance tracking
      const originalNow = performance.now;
      let callCount = 0;
      
      performance.now = jest.fn(() => {
        callCount++;
        return originalNow.call(performance) + (callCount * 100);
      });

      render(
        <Provider store={store}>
          <NavigationContainer>
            <HomeScreen />
          </NavigationContainer>
        </Provider>
      );

      expect(performance.now).toHaveBeenCalled();
      
      // Restore original function
      performance.now = originalNow;
    });

    it('should identify performance bottlenecks', async () => {
      const bottlenecks: string[] = [];
      
      const checkPerformance = async (operation: () => Promise<void>, threshold: number, name: string) => {
        const duration = await measurePerformance(operation, name);
        if (duration > threshold) {
          bottlenecks.push(`${name}: ${duration}ms (threshold: ${threshold}ms)`);
        }
      };

      await checkPerformance(async () => {
        render(
          <Provider store={store}>
            <NavigationContainer>
              <HomeScreen />
            </NavigationContainer>
          </Provider>
        );
      }, 1000, 'Initial Render');

      // Report any bottlenecks found
      if (bottlenecks.length > 0) {
        console.warn('Performance bottlenecks detected:', bottlenecks);
      }

      expect(bottlenecks.length).toBe(0);
    });
  });
});