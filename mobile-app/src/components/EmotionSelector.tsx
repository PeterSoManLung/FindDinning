import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';

interface Props {
  selectedEmotion: string | null;
  onEmotionSelect: (emotion: string | null) => void;
}

const emotions = [
  {key: 'happy', label: '😊 Happy', color: '#FFE082'},
  {key: 'sad', label: '😢 Sad', color: '#B39DDB'},
  {key: 'stressed', label: '😰 Stressed', color: '#FFAB91'},
  {key: 'celebrating', label: '🎉 Celebrating', color: '#A5D6A7'},
  {key: 'romantic', label: '💕 Romantic', color: '#F8BBD9'},
  {key: 'adventurous', label: '🌟 Adventurous', color: '#81C784'},
  {key: 'comfort', label: '🤗 Need Comfort', color: '#BCAAA4'},
];

const EmotionSelector: React.FC<Props> = ({selectedEmotion, onEmotionSelect}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>How are you feeling?</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.emotionsContainer}
      >
        <TouchableOpacity
          style={[
            styles.emotionButton,
            !selectedEmotion && styles.emotionButtonSelected,
          ]}
          onPress={() => onEmotionSelect(null)}
        >
          <Text style={[
            styles.emotionText,
            !selectedEmotion && styles.emotionTextSelected,
          ]}>
            🍽️ Surprise Me
          </Text>
        </TouchableOpacity>
        
        {emotions.map((emotion) => (
          <TouchableOpacity
            key={emotion.key}
            style={[
              styles.emotionButton,
              selectedEmotion === emotion.key && styles.emotionButtonSelected,
              {backgroundColor: emotion.color},
            ]}
            onPress={() => onEmotionSelect(emotion.key)}
          >
            <Text style={[
              styles.emotionText,
              selectedEmotion === emotion.key && styles.emotionTextSelected,
            ]}>
              {emotion.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    paddingLeft: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  emotionsContainer: {
    paddingRight: 20,
  },
  emotionButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emotionButtonSelected: {
    borderColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  emotionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  emotionTextSelected: {
    color: '#FF6B35',
    fontWeight: 'bold',
  },
});

export default EmotionSelector;