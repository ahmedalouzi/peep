/**
 * Peep AI Agent — Flutter Eval Set
 * 20 representative tasks to measure agent quality.
 *
 * Usage (dev script):
 *   node scripts/run-eval.mjs --platform flutter --project /path/to/project
 *
 * Each task has:
 *   id       — unique slug
 *   category — type of task
 *   prompt   — user message sent to agent
 *   files    — files agent is expected to modify/create
 *   checks   — strings that should appear in the changed files
 */

export interface EvalTask {
  id: string;
  category: 'screen' | 'widget' | 'fix' | 'refactor' | 'package' | 'style';
  prompt: string;
  expectedFiles: string[];
  checks: string[];
  negativeChecks?: string[];
}

export const FLUTTER_EVAL_TASKS: EvalTask[] = [
  // ── Screens ────────────────────────────────────────────────────────────
  {
    id: 'fl-01-settings-screen',
    category: 'screen',
    prompt: 'Create a Settings screen with dark mode toggle and font size slider. Add it to the app router.',
    expectedFiles: ['lib/screens/settings_screen.dart'],
    checks: ['Switch', 'Slider', 'SettingsScreen', 'class'],
  },
  {
    id: 'fl-02-login-screen',
    category: 'screen',
    prompt: 'Create a Login screen with email and password fields, a login button, and basic form validation.',
    expectedFiles: ['lib/screens/login_screen.dart'],
    checks: ['TextFormField', 'ElevatedButton', 'validator', 'LoginScreen'],
  },
  {
    id: 'fl-03-profile-screen',
    category: 'screen',
    prompt: 'Create a Profile screen showing an avatar (CircleAvatar), name, bio, and a list of stats (posts, followers, following).',
    expectedFiles: ['lib/screens/profile_screen.dart'],
    checks: ['CircleAvatar', 'ProfileScreen', 'Column', 'Row'],
  },
  {
    id: 'fl-04-detail-screen',
    category: 'screen',
    prompt: 'Create a ProductDetail screen that receives a product name and price as constructor parameters. Show them with a buy button at the bottom.',
    expectedFiles: ['lib/screens/product_detail_screen.dart'],
    checks: ['ProductDetailScreen', 'final String', 'ElevatedButton', 'Scaffold'],
  },
  {
    id: 'fl-05-list-screen',
    category: 'screen',
    prompt: 'Create a TodoList screen using ListView.builder with mock data. Each item has a checkbox and title.',
    expectedFiles: ['lib/screens/todo_list_screen.dart'],
    checks: ['ListView.builder', 'CheckboxListTile', 'TodoListScreen'],
  },

  // ── Widgets ────────────────────────────────────────────────────────────
  {
    id: 'fl-06-card-widget',
    category: 'widget',
    prompt: 'Create a reusable ProductCard widget that accepts name, price, imageUrl. Use Card with an image, title, price row.',
    expectedFiles: ['lib/widgets/product_card.dart'],
    checks: ['ProductCard', 'StatelessWidget', 'Card', 'Image', 'final String'],
  },
  {
    id: 'fl-07-loading-widget',
    category: 'widget',
    prompt: 'Create a reusable LoadingOverlay widget that shows a semi-transparent overlay with CircularProgressIndicator.',
    expectedFiles: ['lib/widgets/loading_overlay.dart'],
    checks: ['LoadingOverlay', 'CircularProgressIndicator', 'Stack', 'Opacity'],
  },
  {
    id: 'fl-08-empty-state-widget',
    category: 'widget',
    prompt: 'Create an EmptyState widget with an icon, title, message, and optional action button.',
    expectedFiles: ['lib/widgets/empty_state.dart'],
    checks: ['EmptyState', 'StatelessWidget', 'Column', 'IconData'],
  },
  {
    id: 'fl-09-bottom-sheet',
    category: 'widget',
    prompt: 'Add a showFilterSheet function that opens a modal bottom sheet with three filter options: All, Active, Completed.',
    expectedFiles: ['lib/widgets/filter_sheet.dart'],
    checks: ['showModalBottomSheet', 'ListTile', 'All', 'Active', 'Completed'],
  },
  {
    id: 'fl-10-app-bar-widget',
    category: 'widget',
    prompt: 'Create a custom AppBar widget (PeepAppBar) that has a title, back button, and optional actions list.',
    expectedFiles: ['lib/widgets/peep_app_bar.dart'],
    checks: ['PeepAppBar', 'PreferredSizeWidget', 'AppBar', 'actions'],
  },

  // ── Fix ────────────────────────────────────────────────────────────────
  {
    id: 'fl-11-null-safety-fix',
    category: 'fix',
    prompt: 'Fix: "The value of the local variable is never read" and add null checks where user?.name is used.',
    expectedFiles: [],
    checks: ['!', '??', 'null'],
  },
  {
    id: 'fl-12-overflow-fix',
    category: 'fix',
    prompt: 'Fix the RenderFlex overflow error in the Column by wrapping children in Flexible or using Expanded correctly.',
    expectedFiles: [],
    checks: ['Flexible', 'Expanded', 'SingleChildScrollView'],
  },
  {
    id: 'fl-13-missing-import-fix',
    category: 'fix',
    prompt: "Fix the 'Undefined name' error by adding the missing import statement.",
    expectedFiles: [],
    checks: ["import '"],
  },

  // ── Refactor ───────────────────────────────────────────────────────────
  {
    id: 'fl-14-extract-widget',
    category: 'refactor',
    prompt: 'Extract the user info section from main_screen.dart into a separate UserInfoCard widget in lib/widgets/.',
    expectedFiles: ['lib/widgets/user_info_card.dart'],
    checks: ['UserInfoCard', 'StatelessWidget', 'class'],
  },
  {
    id: 'fl-15-const-constructors',
    category: 'refactor',
    prompt: 'Add const constructors to all StatelessWidgets that are missing them to improve performance.',
    expectedFiles: [],
    checks: ['const'],
  },
  {
    id: 'fl-16-theme-tokens',
    category: 'refactor',
    prompt: 'Replace all hardcoded Color(0xFF...) values with Theme.of(context).colorScheme tokens.',
    expectedFiles: [],
    checks: ['Theme.of(context)', 'colorScheme'],
    negativeChecks: ['Color(0xFF'],
  },

  // ── Package ────────────────────────────────────────────────────────────
  {
    id: 'fl-17-add-go-router',
    category: 'package',
    prompt: 'Add go_router to pubspec.yaml and create a basic AppRouter class with routes for home and detail screens.',
    expectedFiles: ['lib/router/app_router.dart'],
    checks: ['go_router', 'GoRouter', 'AppRouter', 'routes'],
  },
  {
    id: 'fl-18-add-provider',
    category: 'package',
    prompt: 'Add provider package to pubspec.yaml and wrap MaterialApp with a ChangeNotifierProvider for a new AppState class.',
    expectedFiles: ['lib/state/app_state.dart'],
    checks: ['provider', 'ChangeNotifier', 'ChangeNotifierProvider', 'AppState'],
  },

  // ── Style ──────────────────────────────────────────────────────────────
  {
    id: 'fl-19-dark-theme',
    category: 'style',
    prompt: 'Add a dark ThemeData to MaterialApp with a deep purple primary color and surface color #121212.',
    expectedFiles: [],
    checks: ['darkTheme', 'ThemeData', 'Colors.deepPurple', '0xFF121212'],
  },
  {
    id: 'fl-20-responsive-layout',
    category: 'style',
    prompt: 'Make the home screen responsive: show a single-column list on phones (<600px wide) and a two-column grid on tablets.',
    expectedFiles: [],
    checks: ['LayoutBuilder', 'GridView', 'ListView', '600'],
  },
];
