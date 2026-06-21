import type { EvalTask } from './flutter-eval-tasks';

export const REACT_NATIVE_EVAL_TASKS: EvalTask[] = [
  // ── Screens ────────────────────────────────────────────────────────────
  {
    id: 'rn-01-settings-screen',
    category: 'screen',
    prompt: 'Create a Settings screen with a dark mode toggle (Switch), font size slider, and notification toggle. Use FlatList for the settings items.',
    expectedFiles: ['src/screens/SettingsScreen.tsx'],
    checks: ['Switch', 'Slider', 'SettingsScreen', 'StyleSheet', 'FlatList'],
  },
  {
    id: 'rn-02-login-screen',
    category: 'screen',
    prompt: 'Create a LoginScreen with email and password TextInput fields, a Login button, and show error text on empty submission.',
    expectedFiles: ['src/screens/LoginScreen.tsx'],
    checks: ['TextInput', 'Pressable', 'LoginScreen', 'StyleSheet', 'useState'],
  },
  {
    id: 'rn-03-profile-screen',
    category: 'screen',
    prompt: 'Create a ProfileScreen with a circular avatar (Image with border-radius), name, bio text, and a row of stats (posts, followers, following).',
    expectedFiles: ['src/screens/ProfileScreen.tsx'],
    checks: ['ProfileScreen', 'Image', 'borderRadius', 'StyleSheet', 'View'],
  },
  {
    id: 'rn-04-detail-screen',
    category: 'screen',
    prompt: 'Create a ProductDetailScreen that accepts route params (name, price). Show them with a sticky "Add to Cart" button at the bottom.',
    expectedFiles: ['src/screens/ProductDetailScreen.tsx'],
    checks: ['ProductDetailScreen', 'route.params', 'Pressable', 'StyleSheet'],
  },
  {
    id: 'rn-05-list-screen',
    category: 'screen',
    prompt: 'Create a TodoScreen using FlatList with mock data. Each item has a checkbox-like Pressable and a strikethrough on completed items.',
    expectedFiles: ['src/screens/TodoScreen.tsx'],
    checks: ['FlatList', 'TodoScreen', 'StyleSheet', 'useState', 'textDecorationLine'],
  },

  // ── Components ─────────────────────────────────────────────────────────
  {
    id: 'rn-06-card-component',
    category: 'widget',
    prompt: 'Create a reusable ProductCard component accepting name, price, imageUrl props. Use View, Image, Text with proper StyleSheet.',
    expectedFiles: ['src/components/ProductCard.tsx'],
    checks: ['ProductCard', 'StyleSheet', 'Image', 'interface', 'Props'],
  },
  {
    id: 'rn-07-loading-component',
    category: 'widget',
    prompt: 'Create a LoadingOverlay component that renders a full-screen semi-transparent View with an ActivityIndicator in the center.',
    expectedFiles: ['src/components/LoadingOverlay.tsx'],
    checks: ['LoadingOverlay', 'ActivityIndicator', 'StyleSheet', 'position: absolute'],
  },
  {
    id: 'rn-08-empty-state-component',
    category: 'widget',
    prompt: 'Create an EmptyState component with icon (emoji text), title, message, and an optional onAction button.',
    expectedFiles: ['src/components/EmptyState.tsx'],
    checks: ['EmptyState', 'StyleSheet', 'Pressable', 'interface'],
  },
  {
    id: 'rn-09-bottom-sheet',
    category: 'widget',
    prompt: 'Create a FilterModal component using Modal from react-native. Show three filter buttons: All, Active, Completed.',
    expectedFiles: ['src/components/FilterModal.tsx'],
    checks: ['Modal', 'FilterModal', 'Pressable', 'All', 'Active', 'Completed'],
  },
  {
    id: 'rn-10-custom-header',
    category: 'widget',
    prompt: 'Create a CustomHeader component with a back button (using useNavigation), title prop, and optional right action.',
    expectedFiles: ['src/components/CustomHeader.tsx'],
    checks: ['CustomHeader', 'useNavigation', 'StyleSheet', 'Pressable', 'interface'],
  },

  // ── Fix ────────────────────────────────────────────────────────────────
  {
    id: 'rn-11-typescript-error-fix',
    category: 'fix',
    prompt: "Fix TypeScript error: 'Property does not exist on type'. Add the missing type definition or interface.",
    expectedFiles: [],
    checks: ['interface', 'type ', ': string', ': number'],
  },
  {
    id: 'rn-12-flatlist-performance-fix',
    category: 'fix',
    prompt: 'Refactor: replace the map() inside ScrollView with a FlatList and add keyExtractor for performance.',
    expectedFiles: [],
    checks: ['FlatList', 'keyExtractor', 'renderItem'],
    negativeChecks: ['ScrollView'],
  },
  {
    id: 'rn-13-missing-key-fix',
    category: 'fix',
    prompt: 'Fix the "Each child in a list should have a unique key" warning by adding proper key props.',
    expectedFiles: [],
    checks: ['key='],
  },

  // ── Refactor ───────────────────────────────────────────────────────────
  {
    id: 'rn-14-extract-component',
    category: 'refactor',
    prompt: 'Extract the user info section from HomeScreen into a separate UserInfoCard component in src/components/.',
    expectedFiles: ['src/components/UserInfoCard.tsx'],
    checks: ['UserInfoCard', 'StyleSheet', 'interface', 'export'],
  },
  {
    id: 'rn-15-hooks-refactor',
    category: 'refactor',
    prompt: 'Extract the data fetching logic from ProfileScreen into a custom hook useProfile in src/hooks/.',
    expectedFiles: ['src/hooks/useProfile.ts'],
    checks: ['useProfile', 'useState', 'useEffect', 'return'],
  },
  {
    id: 'rn-16-style-constants',
    category: 'refactor',
    prompt: 'Move all color values into a theme file src/theme/colors.ts and replace inline color strings with imports.',
    expectedFiles: ['src/theme/colors.ts'],
    checks: ['export const', 'primary', 'background', 'text'],
  },

  // ── Package ────────────────────────────────────────────────────────────
  {
    id: 'rn-17-add-navigation',
    category: 'package',
    prompt: 'Set up React Navigation with a Stack navigator. Create routes for Home and Detail screens in App.tsx.',
    expectedFiles: ['App.tsx'],
    checks: ['NavigationContainer', 'createNativeStackNavigator', 'Stack.Navigator', 'Stack.Screen'],
  },
  {
    id: 'rn-18-add-zustand',
    category: 'package',
    prompt: 'Create a Zustand store in src/store/useAppStore.ts with a counter state (value, increment, decrement).',
    expectedFiles: ['src/store/useAppStore.ts'],
    checks: ['create', 'zustand', 'increment', 'decrement', 'useAppStore'],
  },

  // ── Style ──────────────────────────────────────────────────────────────
  {
    id: 'rn-19-dark-mode',
    category: 'style',
    prompt: 'Add dark mode support using useColorScheme hook. Swap background and text colors based on the scheme.',
    expectedFiles: [],
    checks: ['useColorScheme', 'dark', 'StyleSheet', 'backgroundColor'],
  },
  {
    id: 'rn-20-responsive-layout',
    category: 'style',
    prompt: 'Make the home screen responsive using Dimensions.get to show 1 column on phones and 2 columns on tablets (width > 600).',
    expectedFiles: [],
    checks: ['Dimensions', 'width', '600', 'numColumns'],
  },
];
