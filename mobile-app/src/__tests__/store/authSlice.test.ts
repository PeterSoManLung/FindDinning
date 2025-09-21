import {configureStore} from '@reduxjs/toolkit';
import authSlice, {loginUser, registerUser, logoutUser, clearError, setToken} from '../../store/slices/authSlice';

// Mock the auth service
jest.mock('../../services/authService', () => ({
  authService: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
  },
}));

const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authSlice,
    },
    preloadedState: {
      auth: {
        isAuthenticated: false,
        token: null,
        user: null,
        loading: false,
        error: null,
        ...initialState,
      },
    },
  });
};

describe('authSlice', () => {
  it('should handle initial state', () => {
    const store = createTestStore();
    const state = store.getState().auth;
    
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBe(null);
    expect(state.user).toBe(null);
    expect(state.loading).toBe(false);
    expect(state.error).toBe(null);
  });

  it('should handle clearError', () => {
    const store = createTestStore({error: 'Some error'});
    
    store.dispatch(clearError());
    
    const state = store.getState().auth;
    expect(state.error).toBe(null);
  });

  it('should handle setToken', () => {
    const store = createTestStore();
    const token = 'test-token';
    
    store.dispatch(setToken(token));
    
    const state = store.getState().auth;
    expect(state.token).toBe(token);
    expect(state.isAuthenticated).toBe(true);
  });

  it('should handle loginUser.pending', () => {
    const store = createTestStore();
    
    store.dispatch(loginUser.pending('', {email: 'test@example.com', password: 'password'}));
    
    const state = store.getState().auth;
    expect(state.loading).toBe(true);
    expect(state.error).toBe(null);
  });

  it('should handle loginUser.fulfilled', () => {
    const store = createTestStore();
    const mockResponse = {
      token: 'test-token',
      user: {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
      },
    };
    
    store.dispatch(loginUser.fulfilled(mockResponse, '', {email: 'test@example.com', password: 'password'}));
    
    const state = store.getState().auth;
    expect(state.loading).toBe(false);
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe(mockResponse.token);
    expect(state.user).toEqual(mockResponse.user);
  });

  it('should handle loginUser.rejected', () => {
    const store = createTestStore();
    const errorMessage = 'Login failed';
    
    store.dispatch(loginUser.rejected(new Error(errorMessage), '', {email: 'test@example.com', password: 'password'}));
    
    const state = store.getState().auth;
    expect(state.loading).toBe(false);
    expect(state.error).toBe(errorMessage);
    expect(state.isAuthenticated).toBe(false);
  });

  it('should handle registerUser.pending', () => {
    const store = createTestStore();
    
    store.dispatch(registerUser.pending('', {email: 'test@example.com', password: 'password', name: 'Test User'}));
    
    const state = store.getState().auth;
    expect(state.loading).toBe(true);
    expect(state.error).toBe(null);
  });

  it('should handle registerUser.fulfilled', () => {
    const store = createTestStore();
    const mockResponse = {
      token: 'test-token',
      user: {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
      },
    };
    
    store.dispatch(registerUser.fulfilled(mockResponse, '', {email: 'test@example.com', password: 'password', name: 'Test User'}));
    
    const state = store.getState().auth;
    expect(state.loading).toBe(false);
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe(mockResponse.token);
    expect(state.user).toEqual(mockResponse.user);
  });

  it('should handle logoutUser.fulfilled', () => {
    const store = createTestStore({
      isAuthenticated: true,
      token: 'test-token',
      user: {id: '1', email: 'test@example.com', name: 'Test User'},
    });
    
    store.dispatch(logoutUser.fulfilled(undefined, '', undefined));
    
    const state = store.getState().auth;
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBe(null);
    expect(state.user).toBe(null);
    expect(state.loading).toBe(false);
    expect(state.error).toBe(null);
  });
});