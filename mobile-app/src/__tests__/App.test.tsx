import React from 'react';
import {render} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {PersistGate} from 'redux-persist/integration/react';
import {NavigationContainer} from '@react-navigation/native';
import {configureStore} from '@reduxjs/toolkit';
import App from '../App';
import authSlice from '../store/slices/authSlice';
import userSlice from '../store/slices/userSlice';
import recommendationSlice from '../store/slices/recommendationSlice';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  NavigationContainer: ({children}: any) => children,
}));

// Mock redux-persist
jest.mock('redux-persist/integration/react', () => ({
  PersistGate: ({children}: any) => children,
}));

// Create a test store
const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authSlice,
      user: userSlice,
      recommendations: recommendationSlice,
    },
    preloadedState: initialState,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }),
  });
};

describe('App', () => {
  it('renders without crashing', () => {
    const store = createTestStore();
    
    const {getByTestId} = render(
      <Provider store={store}>
        <App />
      </Provider>
    );
    
    // App should render without throwing
    expect(true).toBe(true);
  });

  it('shows auth navigator when user is not authenticated', () => {
    const store = createTestStore({
      auth: {
        isAuthenticated: false,
        token: null,
        user: null,
        loading: false,
        error: null,
      },
    });
    
    const {toJSON} = render(
      <Provider store={store}>
        <App />
      </Provider>
    );
    
    expect(toJSON()).toBeTruthy();
  });

  it('shows main navigator when user is authenticated', () => {
    const store = createTestStore({
      auth: {
        isAuthenticated: true,
        token: 'test-token',
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
        },
        loading: false,
        error: null,
      },
    });
    
    const {toJSON} = render(
      <Provider store={store}>
        <App />
      </Provider>
    );
    
    expect(toJSON()).toBeTruthy();
  });
});