import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, AppStateStatus, Platform } from 'react-native';
import CodePush from 'react-native-code-push';
import { store, persistor } from './store/store';
import AppNavigator from './navigation/AppNavigator';
import LoadingScreen from './components/LoadingScreen';
import { analyticsService } from './services/analyticsService';
import { crashReportingService } from './services/crashReportingService';
import { codePushService } from './services/codePushService';
import { securityService } from './services/securityService';
import { performanceMonitoringService } from './services/performanceMonitoringService';

const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [appLaunchTime] = useState(Date.now());

  useEffect(() => {
    initializeApp();
    
    // Handle app state changes
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        analyticsService.recordEvent({
          name: 'app_foreground',
          attributes: {
            platform: Platform.OS
          }
        });
        
        // Check for updates when app becomes active
        codePushService.checkForUpdate(false);
      } else if (nextAppState === 'background') {
        analyticsService.recordEvent({
          name: 'app_background',
          attributes: {
            platform: Platform.OS
          }
        });
        
        // Flush analytics events before backgrounding
        analyticsService.flushEvents();
        
        // Clean up performance metrics
        performanceMonitoringService.cleanup();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
      analyticsService.endSession();
    };
  }, [initializeApp]);

  const initializeApp = async () => {
    const initStartTime = Date.now();
    
    try {
      // Initialize services in parallel where possible
      await Promise.all([
        crashReportingService.initialize(),
        performanceMonitoringService.initialize(),
        securityService.initialize()
      ]);
      
      // Initialize CodePush after other services
      await codePushService.initializeAutoUpdate();
      await codePushService.notifyAppReady();
      
      const initEndTime = Date.now();
      const totalLaunchTime = initEndTime - appLaunchTime;
      
      // Record app launch performance
      performanceMonitoringService.recordAppLaunch(totalLaunchTime);
      
      setIsInitialized(true);
      
      console.log(`App initialized successfully in ${totalLaunchTime}ms`);
    } catch (error) {
      console.error('Failed to initialize app:', error);
      crashReportingService.recordError(error as Error, {
        screen: 'app_initialization',
        action: 'initialize_services'
      });
      
      // Still allow app to continue even if some services fail
      setIsInitialized(true);
    }
  };

  if (!isInitialized) {
    return <LoadingScreen />;
  }

  return (
    <Provider store={store}>
      <PersistGate loading={<LoadingScreen />} persistor={persistor}>
        <SafeAreaProvider>
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </PersistGate>
    </Provider>
  );
};

// CodePush configuration
const codePushOptions = {
  checkFrequency: CodePush.CheckFrequency.ON_APP_START,
  installMode: CodePush.InstallMode.ON_NEXT_RESTART,
  mandatoryInstallMode: CodePush.InstallMode.IMMEDIATE,
  updateDialog: {
    title: 'Update Available',
    optionalUpdateMessage: 'An update is available. Would you like to install it?',
    optionalIgnoreButtonLabel: 'Later',
    optionalInstallButtonLabel: 'Install',
    mandatoryUpdateMessage: 'A mandatory update is available and must be installed.',
    mandatoryContinueButtonLabel: 'Continue'
  }
};

export default CodePush(codePushOptions)(App);