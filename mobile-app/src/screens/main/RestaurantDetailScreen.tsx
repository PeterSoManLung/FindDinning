import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {RouteProp} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {MainStackParamList} from '../../navigation/MainNavigator';
import {restaurantService} from '../../services/restaurantService';
import LoadingSpinner from '../../components/LoadingSpinner';

type RestaurantDetailScreenRouteProp = RouteProp<MainStackParamList, 'RestaurantDetail'>;

interface Props {
  route: RestaurantDetailScreenRouteProp;
}

interface RestaurantDetail {
  id: string;
  name: string;
  cuisineType: string[];
  location: {
    address: string;
    district: string;
  };
  priceRange: number;
  rating: number;
  atmosphere: string[];
  menuHighlights: string[];
  specialFeatures: string[];
  isLocalGem: boolean;
  operatingHours: {
    [key: string]: string;
  };
}

const RestaurantDetailScreen: React.FC<Props> = ({route}) => {
  const {restaurantId} = route.params;
  const [restaurant, setRestaurant] = useState<RestaurantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRestaurantDetails();
  }, [restaurantId]);

  const loadRestaurantDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await restaurantService.getRestaurantDetails(restaurantId);
      setRestaurant(data);
    } catch (err) {
      setError('Failed to load restaurant details');
      console.error('Error loading restaurant details:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPriceRangeText = (priceRange: number) => {
    const ranges = ['$', '$$', '$$$', '$$$$'];
    return ranges[priceRange - 1] || '$';
  };

  const handleCallRestaurant = () => {
    Alert.alert('Call Restaurant', 'This feature will be available soon!');
  };

  const handleGetDirections = () => {
    Alert.alert('Get Directions', 'This feature will be available soon!');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner />
      </View>
    );
  }

  if (error || !restaurant) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Restaurant not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadRestaurantDetails}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header Section */}
      <View style={styles.header}>
        <Text style={styles.restaurantName}>{restaurant.name}</Text>
        {restaurant.isLocalGem && (
          <View style={styles.gemBadge}>
            <Icon name="star" size={16} color="#FFD700" />
            <Text style={styles.gemText}>Local Gem</Text>
          </View>
        )}
        
        <View style={styles.basicInfo}>
          <Text style={styles.cuisineText}>
            {restaurant.cuisineType.join(', ')}
          </Text>
          <View style={styles.ratingPriceRow}>
            <View style={styles.rating}>
              <Icon name="star" size={16} color="#FFD700" />
              <Text style={styles.ratingText}>{restaurant.rating.toFixed(1)}</Text>
            </View>
            <Text style={styles.priceRange}>
              {getPriceRangeText(restaurant.priceRange)}
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.actionButton} onPress={handleCallRestaurant}>
          <Icon name="phone" size={24} color="#FF6B35" />
          <Text style={styles.actionButtonText}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleGetDirections}>
          <Icon name="directions" size={24} color="#FF6B35" />
          <Text style={styles.actionButtonText}>Directions</Text>
        </TouchableOpacity>
      </View>

      {/* Location Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <View style={styles.locationInfo}>
          <Icon name="location-on" size={20} color="#666" />
          <View style={styles.locationText}>
            <Text style={styles.address}>{restaurant.location.address}</Text>
            <Text style={styles.district}>{restaurant.location.district}</Text>
          </View>
        </View>
      </View>

      {/* Menu Highlights */}
      {restaurant.menuHighlights.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Menu Highlights</Text>
          {restaurant.menuHighlights.map((item, index) => (
            <View key={index} style={styles.menuItem}>
              <Icon name="restaurant" size={16} color="#FF6B35" />
              <Text style={styles.menuItemText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Atmosphere */}
      {restaurant.atmosphere.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Atmosphere</Text>
          <View style={styles.tagContainer}>
            {restaurant.atmosphere.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Special Features */}
      {restaurant.specialFeatures.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Special Features</Text>
          {restaurant.specialFeatures.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Icon name="check-circle" size={16} color="#4CAF50" />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Operating Hours */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Operating Hours</Text>
        {Object.entries(restaurant.operatingHours).map(([day, hours]) => (
          <View key={day} style={styles.hoursRow}>
            <Text style={styles.dayText}>{day}</Text>
            <Text style={styles.hoursText}>{hours}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
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
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  header: {
    padding: 20,
    backgroundColor: '#f9f9f9',
  },
  restaurantName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  gemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8DC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  gemText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#B8860B',
    fontWeight: 'bold',
  },
  basicInfo: {
    marginTop: 10,
  },
  cuisineText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  ratingPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  priceRange: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 20,
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actionButton: {
    alignItems: 'center',
    padding: 10,
  },
  actionButtonText: {
    marginTop: 5,
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationText: {
    marginLeft: 10,
    flex: 1,
  },
  address: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  district: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  menuItemText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 14,
    color: '#1976d2',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dayText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  hoursText: {
    fontSize: 16,
    color: '#666',
  },
});

export default RestaurantDetailScreen;