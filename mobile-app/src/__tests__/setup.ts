// Mock React Native components and modules
jest.mock("react-native", () => ({
  Alert: {
    alert: jest.fn(),
  },
  Platform: {
    OS: "ios",
    select: jest.fn((obj) => obj.ios),
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
  },
  StyleSheet: {
    create: jest.fn((styles) => styles),
  },
  ActivityIndicator: "ActivityIndicator",
  View: "View",
  Text: "Text",
  TextInput: "TextInput",
  TouchableOpacity: "TouchableOpacity",
  ScrollView: "ScrollView",
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Modal: "Modal",
  RefreshControl: "RefreshControl",
}));

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock react-native-vector-icons
jest.mock("react-native-vector-icons/MaterialIcons", () => "Icon");

// Mock navigation
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  NavigationContainer: ({ children }: any) => children,
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
}));

// Mock redux-persist
jest.mock("redux-persist/integration/react", () => ({
  PersistGate: ({ children }: any) => children,
}));

// Mock safe area context
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: any) => children,
  SafeAreaView: ({ children }: any) => children,
}));

// Mock gesture handler
jest.mock("react-native-gesture-handler", () => ({
  TouchableOpacity: "TouchableOpacity",
  PanGestureHandler: "PanGestureHandler",
  State: {},
}));

// Mock screens
jest.mock("react-native-screens", () => ({}));

// Mock permissions
jest.mock("react-native-permissions", () => ({
  request: jest.fn(),
  check: jest.fn(),
  PERMISSIONS: {
    IOS: {
      LOCATION_WHEN_IN_USE: "ios.permission.LOCATION_WHEN_IN_USE",
    },
    ANDROID: {
      ACCESS_FINE_LOCATION: "android.permission.ACCESS_FINE_LOCATION",
    },
  },
  RESULTS: {
    GRANTED: "granted",
    DENIED: "denied",
  },
}));

// Mock geolocation service
jest.mock("react-native-geolocation-service", () => ({
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
}));
