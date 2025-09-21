import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useDispatch} from 'react-redux';
import {AppDispatch} from '../store/store';
import {submitFeedback} from '../store/slices/recommendationSlice';

interface Restaurant {
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
  isLocalGem: boolean;
}

interface RecommendedRestaurant {
  restaurant: Restaurant;
  matchScore: number;
  reasonsForRecommendation: string[];
  emotionalAlignment: number;
}

interface Props {
  recommendation: RecommendedRestaurant;
  onPress: () => void;
}

const RecommendationCard: React.FC<Props> = ({recommendation, onPress}) => {
  const dispatch = useDispatch<AppDispatch>();
  const {restaurant, matchScore, reasonsForRecommendation} = recommendation;

  const getPriceRangeText = (priceRange: number) => {
    const ranges = ['$', '$$', '$$$', '$$$$'];
    return ranges[priceRange - 1] || '$';
  };

  const handleLike = (event: any) => {
    event.stopPropagation();
    dispatch(submitFeedback({
      restaurantId: restaurant.id,
      liked: true,
      visited: false,
    }));
  };

  const handleDislike = (event: any) => {
    event.stopPropagation();
    dispatch(submitFeedback({
      restaurantId: restaurant.id,
      liked: false,
      visited: false,
    }));
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.restaurantName} numberOfLines={1}>
            {restaurant.name}
          </Text>
          {restaurant.isLocalGem && (
            <View style={styles.gemBadge}>
              <Icon name="star" size={12} color="#FFD700" />
            </View>
          )}
        </View>
        
        <View style={styles.basicInfo}>
          <Text style={styles.cuisineText} numberOfLines={1}>
            {restaurant.cuisineType.join(', ')}
          </Text>
          <View style={styles.ratingPriceRow}>
            <View style={styles.rating}>
              <Icon name="star" size={14} color="#FFD700" />
              <Text style={styles.ratingText}>{restaurant.rating.toFixed(1)}</Text>
            </View>
            <Text style={styles.priceRange}>
              {getPriceRangeText(restaurant.priceRange)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.location}>
        <Icon name="location-on" size={14} color="#666" />
        <Text style={styles.locationText} numberOfLines={1}>
          {restaurant.location.district}
        </Text>
      </View>

      {/* Match Score */}
      <View style={styles.matchScore}>
        <Text style={styles.matchScoreText}>
          {Math.round(matchScore * 100)}% match
        </Text>
      </View>

      {/* Reasons for Recommendation */}
      {reasonsForRecommendation.length > 0 && (
        <View style={styles.reasons}>
          <Text style={styles.reasonsTitle}>Why we recommend:</Text>
          <Text style={styles.reasonsText} numberOfLines={2}>
            {reasonsForRecommendation.join(', ')}
          </Text>
        </View>
      )}

      {/* Menu Highlights */}
      {restaurant.menuHighlights.length > 0 && (
        <View style={styles.menuHighlights}>
          <Text style={styles.menuTitle}>Must try:</Text>
          <Text style={styles.menuText} numberOfLines={1}>
            {restaurant.menuHighlights.slice(0, 2).join(', ')}
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleDislike}>
          <Icon name="thumb-down" size={20} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.likeButton]} onPress={handleLike}>
          <Icon name="thumb-up" size={20} color="#FF6B35" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  gemBadge: {
    marginLeft: 8,
    backgroundColor: '#FFF8DC',
    borderRadius: 10,
    padding: 4,
  },
  basicInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cuisineText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  ratingPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  ratingText: {
    marginLeft: 2,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  priceRange: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  matchScore: {
    alignSelf: 'flex-start',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  matchScoreText: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: 'bold',
  },
  reasons: {
    marginBottom: 12,
  },
  reasonsTitle: {
    fontSize: 12,
    color: '#666',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  reasonsText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 18,
  },
  menuHighlights: {
    marginBottom: 16,
  },
  menuTitle: {
    fontSize: 12,
    color: '#FF6B35',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  menuText: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  actionButton: {
    padding: 8,
    marginLeft: 12,
  },
  likeButton: {
    backgroundColor: '#fff5f0',
    borderRadius: 20,
  },
});

export default RecommendationCard;