import React from 'react';
import {View, ActivityIndicator, StyleSheet} from 'react-native';

interface Props {
  size?: 'small' | 'large';
  color?: string;
}

const LoadingSpinner: React.FC<Props> = ({
  size = 'large',
  color = '#FF6B35',
}) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default LoadingSpinner;