import React, {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {StackNavigationProp} from '@react-navigation/stack';
import {AppDispatch, RootState} from '../../store/store';
import {fetchRecommendations} from '../../store/slices/recommendationSlice';
import {fetchUserProfile} from '../../store/slices/userSlice';
import {MainStackParamList} from '../../navigation/MainNavigator';
import RecommendationCard from '../../components/RecommendationCard';
import EmotionSelector from '../../components/EmotionSelector';
import LoadingSpinner from '../../components/LoadingSpinner';

type HomeScreenNavigationProp = StackNavigationProp<MainStackParamList, 'MainTabs'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

const HomeScreen: React.FC<Props> = ({navigation}) => {
  const dispatch = useDispatch<AppDispatch>();
  const {recommendations, loading, error} = useSelector((state: RootState) => state.recommendations);
  const {profile} = useSelector((state: RootState) => state.user);
  const [refreshing, setRefreshing] = React.useState(false);
  const [selectedEmotion, setSelectedEmotion] = React.useState<string | null>(null);

  useEffect(() => {
    // Fetch user profile and initial recommendations
    dispatch(fetchUserProfile());
    loadRecommendations();
  }, [dispatch]);

  const loadRecommendations = async (emotionalState?: string) => {
    const params = {
      emotionalState,
      location: profile?.location || undefined,
    };
    await dispatch(fetchRecommendations(params));
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadRecommendations(selectedEmotion || undefined);
    setRefreshing(false);
  }, [selectedEmotion, profile]);

  const handleEmotionSelect = (emotion: string | null) => {
    setSelectedEmotion(emotion);
    loadRecommendations(emotion || undefined);
  };

  const handleRestaurantPress = (restaurantId: string) => {
    navigation.navigate('RestaurantDetail', {restaurantId});
  };

  if (loading && recommendations.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner />
        <Text style={styles.loadingText}>Finding perfect restaurants for you...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>搵食</Text>
        <Text style={styles.subtitle}>
          {profile?.name ? `Welcome back, ${profile.name}!` : 'Welcome!'}
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <EmotionSelector
          selectedEmotion={selectedEmotion}
          onEmotionSelect={handleEmotionSelect}
        />

        <View style={styles.recommendationsSection}>
          <Text style={styles.sectionTitle}>
            {selectedEmotion 
              ? `Recommendations for your ${selectedEmotion} mood`
              : 'Personalized Recommendations'
            }
          </Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {recommendations.length === 0 && !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No recommendations available. Pull to refresh!
              </Text>
            </View>
          ) : (
            recommendations.map((recommendation, index) => (
              <RecommendationCard
                key={`${recommendation.restaurant.id}-${index}`}
                recommendation={recommendation}
                onPress={() => handleRestaurantPress(recommendation.restaurant.id)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#FF6B35',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginTop: 5,
    opacity: 0.9,
  },
  content: {
    flex: 1,
  },
  recommendationsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default HomeScreen;