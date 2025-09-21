import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {AppDispatch, RootState} from '../store/store';
import {updateUserPreferences} from '../store/slices/userSlice';

const cuisineOptions = [
  'Cantonese', 'Sichuan', 'Japanese', 'Korean', 'Thai', 'Vietnamese',
  'Italian', 'French', 'American', 'Indian', 'Mexican', 'Local Hong Kong'
];

const atmosphereOptions = [
  'Casual', 'Fine Dining', 'Cozy', 'Lively', 'Quiet', 'Romantic',
  'Family-friendly', 'Business', 'Outdoor Seating', 'Traditional'
];

const dietaryOptions = [
  'Vegetarian', 'Vegan', 'Halal', 'Kosher', 'Gluten-free',
  'Dairy-free', 'Nut-free', 'Low-sodium', 'Keto', 'Paleo'
];

const PreferenceSection: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {profile, loading} = useSelector((state: RootState) => state.user);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPreferences, setEditingPreferences] = useState({
    cuisineTypes: profile?.preferences?.cuisineTypes || [],
    priceRange: profile?.preferences?.priceRange || [1, 3] as [number, number],
    dietaryRestrictions: profile?.preferences?.dietaryRestrictions || [],
    atmospherePreferences: profile?.preferences?.atmospherePreferences || [],
    spiceLevel: profile?.preferences?.spiceLevel || 3,
  });

  const openPreferencesModal = () => {
    setEditingPreferences({
      cuisineTypes: profile?.preferences?.cuisineTypes || [],
      priceRange: profile?.preferences?.priceRange || [1, 3] as [number, number],
      dietaryRestrictions: profile?.preferences?.dietaryRestrictions || [],
      atmospherePreferences: profile?.preferences?.atmospherePreferences || [],
      spiceLevel: profile?.preferences?.spiceLevel || 3,
    });
    setModalVisible(true);
  };

  const toggleSelection = (array: string[], item: string) => {
    return array.includes(item)
      ? array.filter(i => i !== item)
      : [...array, item];
  };

  const handleSavePreferences = async () => {
    try {
      await dispatch(updateUserPreferences(editingPreferences)).unwrap();
      setModalVisible(false);
      Alert.alert('Success', 'Preferences updated successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update preferences');
    }
  };

  const getPriceRangeText = (range: [number, number]) => {
    const priceLabels = ['$', '$$', '$$$', '$$$$'];
    return `${priceLabels[range[0] - 1]} - ${priceLabels[range[1] - 1]}`;
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Dining Preferences</Text>
      
      <TouchableOpacity style={styles.preferenceItem} onPress={openPreferencesModal}>
        <Icon name="restaurant-menu" size={24} color="#666" />
        <View style={styles.preferenceContent}>
          <Text style={styles.preferenceTitle}>Cuisine & Preferences</Text>
          <Text style={styles.preferenceSubtitle}>
            {profile?.preferences?.cuisineTypes?.length || 0} cuisines selected
          </Text>
        </View>
        <Icon name="chevron-right" size={24} color="#ccc" />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Dining Preferences</Text>
            <TouchableOpacity onPress={handleSavePreferences} disabled={loading}>
              <Text style={[styles.saveButton, loading && styles.saveButtonDisabled]}>
                Save
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Cuisine Types */}
            <View style={styles.preferenceGroup}>
              <Text style={styles.groupTitle}>Favorite Cuisines</Text>
              <View style={styles.optionsGrid}>
                {cuisineOptions.map((cuisine) => (
                  <TouchableOpacity
                    key={cuisine}
                    style={[
                      styles.optionChip,
                      editingPreferences.cuisineTypes.includes(cuisine) && styles.optionChipSelected,
                    ]}
                    onPress={() => setEditingPreferences({
                      ...editingPreferences,
                      cuisineTypes: toggleSelection(editingPreferences.cuisineTypes, cuisine),
                    })}
                  >
                    <Text style={[
                      styles.optionText,
                      editingPreferences.cuisineTypes.includes(cuisine) && styles.optionTextSelected,
                    ]}>
                      {cuisine}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Price Range */}
            <View style={styles.preferenceGroup}>
              <Text style={styles.groupTitle}>Price Range</Text>
              <Text style={styles.currentValue}>
                Current: {getPriceRangeText(editingPreferences.priceRange)}
              </Text>
              <View style={styles.priceOptions}>
                {[1, 2, 3, 4].map((price) => (
                  <TouchableOpacity
                    key={price}
                    style={[
                      styles.priceOption,
                      price >= editingPreferences.priceRange[0] && 
                      price <= editingPreferences.priceRange[1] && 
                      styles.priceOptionSelected,
                    ]}
                    onPress={() => {
                      const newRange: [number, number] = price <= editingPreferences.priceRange[0]
                        ? [price, editingPreferences.priceRange[1]]
                        : [editingPreferences.priceRange[0], price];
                      setEditingPreferences({
                        ...editingPreferences,
                        priceRange: newRange,
                      });
                    }}
                  >
                    <Text style={[
                      styles.priceText,
                      price >= editingPreferences.priceRange[0] && 
                      price <= editingPreferences.priceRange[1] && 
                      styles.priceTextSelected,
                    ]}>
                      {'$'.repeat(price)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Atmosphere */}
            <View style={styles.preferenceGroup}>
              <Text style={styles.groupTitle}>Preferred Atmosphere</Text>
              <View style={styles.optionsGrid}>
                {atmosphereOptions.map((atmosphere) => (
                  <TouchableOpacity
                    key={atmosphere}
                    style={[
                      styles.optionChip,
                      editingPreferences.atmospherePreferences.includes(atmosphere) && styles.optionChipSelected,
                    ]}
                    onPress={() => setEditingPreferences({
                      ...editingPreferences,
                      atmospherePreferences: toggleSelection(editingPreferences.atmospherePreferences, atmosphere),
                    })}
                  >
                    <Text style={[
                      styles.optionText,
                      editingPreferences.atmospherePreferences.includes(atmosphere) && styles.optionTextSelected,
                    ]}>
                      {atmosphere}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Dietary Restrictions */}
            <View style={styles.preferenceGroup}>
              <Text style={styles.groupTitle}>Dietary Restrictions</Text>
              <View style={styles.optionsGrid}>
                {dietaryOptions.map((dietary) => (
                  <TouchableOpacity
                    key={dietary}
                    style={[
                      styles.optionChip,
                      editingPreferences.dietaryRestrictions.includes(dietary) && styles.optionChipSelected,
                    ]}
                    onPress={() => setEditingPreferences({
                      ...editingPreferences,
                      dietaryRestrictions: toggleSelection(editingPreferences.dietaryRestrictions, dietary),
                    })}
                  >
                    <Text style={[
                      styles.optionText,
                      editingPreferences.dietaryRestrictions.includes(dietary) && styles.optionTextSelected,
                    ]}>
                      {dietary}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Spice Level */}
            <View style={styles.preferenceGroup}>
              <Text style={styles.groupTitle}>Spice Tolerance</Text>
              <Text style={styles.currentValue}>
                Current: {editingPreferences.spiceLevel}/5
              </Text>
              <View style={styles.spiceLevelContainer}>
                {[1, 2, 3, 4, 5].map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.spiceLevel,
                      level <= editingPreferences.spiceLevel && styles.spiceLevelSelected,
                    ]}
                    onPress={() => setEditingPreferences({
                      ...editingPreferences,
                      spiceLevel: level,
                    })}
                  >
                    <Text style={styles.spiceLevelText}>🌶️</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    marginTop: 10,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  preferenceContent: {
    flex: 1,
    marginLeft: 15,
  },
  preferenceTitle: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  preferenceSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  saveButton: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  saveButtonDisabled: {
    color: '#ccc',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  preferenceGroup: {
    marginBottom: 30,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  currentValue: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  optionChip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionChipSelected: {
    backgroundColor: '#fff5f0',
    borderColor: '#FF6B35',
  },
  optionText: {
    fontSize: 14,
    color: '#666',
  },
  optionTextSelected: {
    color: '#FF6B35',
    fontWeight: 'bold',
  },
  priceOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  priceOption: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  priceOptionSelected: {
    backgroundColor: '#fff5f0',
    borderColor: '#FF6B35',
  },
  priceText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },
  priceTextSelected: {
    color: '#FF6B35',
  },
  spiceLevelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  spiceLevel: {
    padding: 10,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
  },
  spiceLevelSelected: {
    backgroundColor: '#ffebee',
  },
  spiceLevelText: {
    fontSize: 20,
  },
});

export default PreferenceSection;