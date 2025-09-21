import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Image,
  Dimensions
} from 'react-native';

const { width, height } = Dimensions.get('window');

interface LoadingScreenProps {
  message?: string;
  showLogo?: boolean;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = 'Loading...', 
  showLogo = true 
}) => {
  return (
    <View style={styles.container}>
      {showLogo && (
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>搵食</Text>
          <Text style={styles.logoSubtext}>Find Dining</Text>
        </View>
      )}
      
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>{message}</Text>
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Discovering the best restaurants in Hong Kong
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 8
  },
  logoSubtext: {
    fontSize: 18,
    color: '#666666',
    fontWeight: '300'
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 40
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 16,
    textAlign: 'center'
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center'
  },
  footerText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20
  }
});

export default LoadingScreen;