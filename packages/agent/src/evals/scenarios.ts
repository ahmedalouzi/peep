import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { Diagnostic } from '@peep/shared';

export interface EvalScenario {
  id: string;
  category: string;
  prompt: string;
  platform?: 'flutter' | 'react-native';
  baseTemplate: 'blank' | 'counter';
  initialFiles?: Record<string, string>;
  validate: (projectPath: string, errors: Diagnostic[]) => Promise<{ passed: boolean; note?: string }>;
}

const checkFileExists = async (path: string) => {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
};

const checkFileContains = async (path: string, content: string) => {
  try {
    const text = await fs.readFile(path, 'utf-8');
    return text.includes(content);
  } catch {
    return false;
  }
};

export const SCENARIOS: EvalScenario[] = [
  // --- Flutter Scenarios ---
  {
    id: 'scaffold-login',
    category: 'scaffolding',
    prompt: 'Create a LoginScreen widget in lib/login_screen.dart with an email and password text field.',
    platform: 'flutter',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const exists = await checkFileExists(join(path, 'lib', 'login_screen.dart'));
      return { passed: exists && errors.length === 0, note: exists ? 'File created' : 'File missing' };
    },
  },
  {
    id: 'scaffold-settings',
    category: 'scaffolding',
    prompt: 'Create a SettingsScreen in lib/settings.dart that has a dark mode switch.',
    platform: 'flutter',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const exists = await checkFileExists(join(path, 'lib', 'settings.dart'));
      return { passed: exists && errors.length === 0, note: exists ? 'File created' : 'File missing' };
    },
  },
  {
    id: 'scaffold-profile',
    category: 'scaffolding',
    prompt: 'Create a ProfileWidget in lib/profile.dart showing a CircleAvatar and a username text.',
    platform: 'flutter',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const exists = await checkFileExists(join(path, 'lib', 'profile.dart'));
      return { passed: exists && errors.length === 0, note: exists ? 'File created' : 'File missing' };
    },
  },
  {
    id: 'scaffold-list',
    category: 'scaffolding',
    prompt: 'Create a custom ListView builder in lib/item_list.dart that shows a list of 10 items.',
    platform: 'flutter',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const exists = await checkFileExists(join(path, 'lib', 'item_list.dart'));
      return { passed: exists && errors.length === 0, note: exists ? 'File created' : 'File missing' };
    },
  },
  {
    id: 'fix-syntax-error',
    category: 'fixing',
    prompt: 'Fix the syntax error in main.dart',
    platform: 'flutter',
    baseTemplate: 'blank',
    initialFiles: {
      'lib/main.dart': `
import 'package:flutter/material.dart';
void main() {
  runApp(const MyApp()) // Missing semicolon
}
class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(home: Scaffold(body: Text('Hello')));
  }
}
      `.trim(),
    },
    validate: async (_, errors) => ({ passed: errors.length === 0, note: `${errors.length} errors` }),
  },
  {
    id: 'fix-import-error',
    category: 'fixing',
    prompt: 'Fix the flutter analyze errors caused by missing imports.',
    platform: 'flutter',
    baseTemplate: 'blank',
    initialFiles: {
      'lib/main.dart': `
void main() {
  runApp(const MaterialApp(home: Scaffold(body: Text('Hello'))));
}
      `.trim(),
    },
    validate: async (_, errors) => ({ passed: errors.length === 0, note: `${errors.length} errors` }),
  },
  {
    id: 'fix-type-error',
    category: 'fixing',
    prompt: 'Fix the type error in the counter assignment.',
    platform: 'flutter',
    baseTemplate: 'counter',
    initialFiles: {
      'lib/main.dart': `
import 'package:flutter/material.dart';
void main() => runApp(const MyApp());
class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) => const MaterialApp(home: Home());
}
class Home extends StatefulWidget {
  const Home({super.key});
  @override
  State<Home> createState() => _HomeState();
}
class _HomeState extends State<Home> {
  int _counter = 0;
  void _inc() {
    setState(() { _counter = "1"; }); // Type error
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    body: Text('\$_counter'),
    floatingActionButton: FloatingActionButton(onPressed: _inc),
  );
}
      `.trim(),
    },
    validate: async (_, errors) => ({ passed: errors.length === 0, note: `${errors.length} errors` }),
  },
  {
    id: 'fix-widget-error',
    category: 'fixing',
    prompt: 'Fix the child/children confusion in the Column widget.',
    platform: 'flutter',
    baseTemplate: 'blank',
    initialFiles: {
      'lib/main.dart': `
import 'package:flutter/material.dart';
void main() => runApp(const MyApp());
class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: Column(
          child: Text('Hello'), // Should be children: []
        ),
      ),
    );
  }
}
      `.trim(),
    },
    validate: async (_, errors) => ({ passed: errors.length === 0, note: `${errors.length} errors` }),
  },
  {
    id: 'add-shared-prefs',
    category: 'packages',
    prompt: 'Add the shared_preferences package to pubspec.yaml.',
    platform: 'flutter',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const hasPackage = await checkFileContains(join(path, 'pubspec.yaml'), 'shared_preferences:');
      return { passed: hasPackage && errors.length === 0, note: hasPackage ? 'Added' : 'Missing from pubspec' };
    },
  },
  {
    id: 'add-provider',
    category: 'packages',
    prompt: 'Add the provider package to pubspec.yaml.',
    platform: 'flutter',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const hasPackage = await checkFileContains(join(path, 'pubspec.yaml'), 'provider:');
      return { passed: hasPackage && errors.length === 0, note: hasPackage ? 'Added' : 'Missing' };
    },
  },
  {
    id: 'add-http',
    category: 'packages',
    prompt: 'Add the http package to pubspec.yaml.',
    platform: 'flutter',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const hasPackage = await checkFileContains(join(path, 'pubspec.yaml'), 'http:');
      return { passed: hasPackage && errors.length === 0, note: hasPackage ? 'Added' : 'Missing' };
    },
  },
  {
    id: 'add-url-launcher',
    category: 'packages',
    prompt: 'Add the url_launcher package to pubspec.yaml.',
    platform: 'flutter',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const hasPackage = await checkFileContains(join(path, 'pubspec.yaml'), 'url_launcher:');
      return { passed: hasPackage && errors.length === 0, note: hasPackage ? 'Added' : 'Missing' };
    },
  },
  {
    id: 'modify-counter-decrement',
    category: 'logic',
    prompt: 'Change the counter app to decrement instead of increment.',
    platform: 'flutter',
    baseTemplate: 'counter',
    validate: async (path, errors) => {
      const isDecrement = await checkFileContains(join(path, 'lib', 'main.dart'), '_counter--');
      return { passed: isDecrement && errors.length === 0, note: isDecrement ? 'Decrements' : 'No --' };
    },
  },
  {
    id: 'modify-counter-step',
    category: 'logic',
    prompt: 'Change the counter app to increment by 5 instead of 1.',
    platform: 'flutter',
    baseTemplate: 'counter',
    validate: async (path, errors) => {
      const isStep = await checkFileContains(join(path, 'lib', 'main.dart'), '_counter += 5');
      return { passed: isStep && errors.length === 0, note: isStep ? 'Step 5' : 'Not step 5' };
    },
  },
  {
    id: 'modify-stateful-to-stateless',
    category: 'logic',
    prompt: 'Convert the MyHomePage widget from Stateful to Stateless widget.',
    platform: 'flutter',
    baseTemplate: 'counter',
    validate: async (path, _errors) => {
      const isStateless = await checkFileContains(join(path, 'lib', 'main.dart'), 'extends StatelessWidget');
      return { passed: isStateless, note: isStateless ? 'Stateless' : 'Still stateful' };
    },
  },
  {
    id: 'modify-extract-widget',
    category: 'logic',
    prompt: 'Extract the floating action button into its own separate stateless widget class called MyFab.',
    platform: 'flutter',
    baseTemplate: 'counter',
    validate: async (path, errors) => {
      const hasClass = await checkFileContains(join(path, 'lib', 'main.dart'), 'class MyFab');
      return { passed: hasClass && errors.length === 0, note: hasClass ? 'Extracted' : 'Not extracted' };
    },
  },
  {
    id: 'ui-bottom-nav',
    category: 'ui',
    prompt: 'Add a BottomNavigationBar to the main Scaffold with Home and Settings tabs.',
    platform: 'flutter',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const hasNav = await checkFileContains(join(path, 'lib', 'main.dart'), 'BottomNavigationBar');
      return { passed: hasNav && errors.length === 0, note: hasNav ? 'Added' : 'Missing nav' };
    },
  },
  {
    id: 'ui-hero-anim',
    category: 'ui',
    prompt: 'Wrap the center Text widget in a Hero widget with tag "my-hero".',
    platform: 'flutter',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const hasHero = await checkFileContains(join(path, 'lib', 'main.dart'), 'Hero(');
      return { passed: hasHero && errors.length === 0, note: hasHero ? 'Added' : 'Missing Hero' };
    },
  },
  {
    id: 'ui-drawer',
    category: 'ui',
    prompt: 'Add a Drawer widget to the Scaffold.',
    platform: 'flutter',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const hasDrawer = await checkFileContains(join(path, 'lib', 'main.dart'), 'drawer: Drawer(');
      return { passed: hasDrawer && errors.length === 0, note: hasDrawer ? 'Added' : 'Missing Drawer' };
    },
  },
  {
    id: 'ui-snack-bar',
    category: 'ui',
    prompt: 'Add a floating action button that shows a SnackBar when pressed.',
    platform: 'flutter',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const hasSnack = await checkFileContains(join(path, 'lib', 'main.dart'), 'showSnackBar');
      return { passed: hasSnack && errors.length === 0, note: hasSnack ? 'Added' : 'Missing SnackBar' };
    },
  },

  // --- React Native Scenarios ---
  {
    id: 'rn-scaffold-login',
    category: 'scaffolding',
    prompt: 'Create a Login screen component in Login.tsx with email and password TextInputs.',
    platform: 'react-native',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const exists = await checkFileExists(join(path, 'Login.tsx'));
      return { passed: exists && errors.length === 0, note: exists ? 'File created' : 'File missing' };
    },
  },
  {
    id: 'rn-scaffold-settings',
    category: 'scaffolding',
    prompt: 'Create a Settings screen component in Settings.tsx with a Switch for dark mode.',
    platform: 'react-native',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const exists = await checkFileExists(join(path, 'Settings.tsx'));
      return { passed: exists && errors.length === 0, note: exists ? 'File created' : 'File missing' };
    },
  },
  {
    id: 'rn-scaffold-profile',
    category: 'scaffolding',
    prompt: 'Create a Profile screen component in Profile.tsx displaying user details.',
    platform: 'react-native',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const exists = await checkFileExists(join(path, 'Profile.tsx'));
      return { passed: exists && errors.length === 0, note: exists ? 'File created' : 'File missing' };
    },
  },
  {
    id: 'rn-scaffold-list',
    category: 'scaffolding',
    prompt: 'Create a list component in ItemList.tsx using a FlatList component.',
    platform: 'react-native',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const exists = await checkFileExists(join(path, 'ItemList.tsx'));
      return { passed: exists && errors.length === 0, note: exists ? 'File created' : 'File missing' };
    },
  },
  {
    id: 'rn-fix-syntax-error',
    category: 'fixing',
    prompt: 'Fix the syntax error in App.tsx.',
    platform: 'react-native',
    baseTemplate: 'blank',
    initialFiles: {
      'App.tsx': `
import React from 'react';
import { View, Text } from 'react-native';
export default function App() {
  return (
    <View>
      <Text>Hello</Text>
    // Missing closing View tag
  );
}
      `.trim(),
    },
    validate: async (_, errors) => ({ passed: errors.length === 0, note: `${errors.length} errors` }),
  },
  {
    id: 'rn-fix-import-error',
    category: 'fixing',
    prompt: 'Fix the import error for the missing View component.',
    platform: 'react-native',
    baseTemplate: 'blank',
    initialFiles: {
      'App.tsx': `
import React from 'react';
import { Text } from 'react-native';
export default function App() {
  return (
    <View><Text>Hello</Text></View>
  );
}
      `.trim(),
    },
    validate: async (_, errors) => ({ passed: errors.length === 0, note: `${errors.length} errors` }),
  },
  {
    id: 'rn-fix-type-error',
    category: 'fixing',
    prompt: 'Fix the TypeScript type assignment error in the state hook.',
    platform: 'react-native',
    baseTemplate: 'blank',
    initialFiles: {
      'App.tsx': `
import React, { useState } from 'react';
import { View, Text, Button } from 'react-native';
export default function App() {
  const [count, setCount] = useState<number>(0);
  return (
    <View>
      <Text>{count}</Text>
      <Button title="Click" onPress={() => setCount("1")} />
    </View>
  );
}
      `.trim(),
    },
    validate: async (_, errors) => ({ passed: errors.length === 0, note: `${errors.length} errors` }),
  },
  {
    id: 'rn-fix-style-error',
    category: 'fixing',
    prompt: 'Fix the style syntax error in StyleSheet.',
    platform: 'react-native',
    baseTemplate: 'blank',
    initialFiles: {
      'App.tsx': `
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
export default function App() {
  return (
    <View style={styles.container}>
      <Text>Hello</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 12345, // Invalid background color type
  },
});
      `.trim(),
    },
    validate: async (_, errors) => ({ passed: errors.length === 0, note: `${errors.length} errors` }),
  },
  {
    id: 'rn-add-navigation',
    category: 'packages',
    prompt: 'Add @react-navigation/native package to dependencies in package.json.',
    platform: 'react-native',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const hasPackage = await checkFileContains(join(path, 'package.json'), '@react-navigation/native');
      return { passed: hasPackage && errors.length === 0, note: hasPackage ? 'Added' : 'Missing' };
    },
  },
  {
    id: 'rn-add-vector-icons',
    category: 'packages',
    prompt: 'Add @expo/vector-icons to dependencies in package.json.',
    platform: 'react-native',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const hasPackage = await checkFileContains(join(path, 'package.json'), '@expo/vector-icons');
      return { passed: hasPackage && errors.length === 0, note: hasPackage ? 'Added' : 'Missing' };
    },
  },
  {
    id: 'rn-add-async-storage',
    category: 'packages',
    prompt: 'Add @react-native-async-storage/async-storage package to package.json.',
    platform: 'react-native',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const hasPackage = await checkFileContains(join(path, 'package.json'), '@react-native-async-storage/async-storage');
      return { passed: hasPackage && errors.length === 0, note: hasPackage ? 'Added' : 'Missing' };
    },
  },
  {
    id: 'rn-add-reanimated',
    category: 'packages',
    prompt: 'Add react-native-reanimated package to package.json.',
    platform: 'react-native',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const hasPackage = await checkFileContains(join(path, 'package.json'), 'react-native-reanimated');
      return { passed: hasPackage && errors.length === 0, note: hasPackage ? 'Added' : 'Missing' };
    },
  },
  {
    id: 'rn-modify-counter-decrement',
    category: 'logic',
    prompt: 'Modify the counter logic in App.tsx to decrement count instead of increment.',
    platform: 'react-native',
    baseTemplate: 'blank',
    initialFiles: {
      'App.tsx': `
import React, { useState } from 'react';
import { View, Text, Button } from 'react-native';
export default function App() {
  const [count, setCount] = useState(0);
  return (
    <View>
      <Text>{count}</Text>
      <Button title="Click" onPress={() => setCount(count + 1)} />
    </View>
  );
}
      `.trim(),
    },
    validate: async (path, errors) => {
      const isDecrement = await checkFileContains(join(path, 'App.tsx'), 'count - 1');
      return { passed: isDecrement && errors.length === 0, note: isDecrement ? 'Decrements' : 'No - 1' };
    },
  },
  {
    id: 'rn-modify-counter-step',
    category: 'logic',
    prompt: 'Change the counter application in App.tsx to increment by 5 instead of 1.',
    platform: 'react-native',
    baseTemplate: 'blank',
    initialFiles: {
      'App.tsx': `
import React, { useState } from 'react';
import { View, Text, Button } from 'react-native';
export default function App() {
  const [count, setCount] = useState(0);
  return (
    <View>
      <Text>{count}</Text>
      <Button title="Click" onPress={() => setCount(count + 1)} />
    </View>
  );
}
      `.trim(),
    },
    validate: async (path, errors) => {
      const isStep = await checkFileContains(join(path, 'App.tsx'), 'count + 5');
      return { passed: isStep && errors.length === 0, note: isStep ? 'Step 5' : 'Not step 5' };
    },
  },
  {
    id: 'rn-modify-class-to-fn',
    category: 'logic',
    prompt: 'Convert the main App component from class-based to a functional component.',
    platform: 'react-native',
    baseTemplate: 'blank',
    initialFiles: {
      'App.tsx': `
import React from 'react';
import { View, Text } from 'react-native';
export default class App extends React.Component {
  render() {
    return (
      <View><Text>Class Component</Text></View>
    );
  }
}
      `.trim(),
    },
    validate: async (path, errors) => {
      const isFn = await checkFileContains(join(path, 'App.tsx'), 'export default function App');
      return { passed: isFn && errors.length === 0, note: isFn ? 'Converted' : 'Still class' };
    },
  },
  {
    id: 'rn-modify-extract-component',
    category: 'logic',
    prompt: 'Extract the header section of the screen in App.tsx to a separate functional component named Header.',
    platform: 'react-native',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const hasClass = await checkFileContains(join(path, 'App.tsx'), 'function Header');
      return { passed: hasClass && errors.length === 0, note: hasClass ? 'Extracted' : 'Not extracted' };
    },
  },
  {
    id: 'rn-ui-safe-area',
    category: 'ui',
    prompt: 'Wrap the main View layout in App.tsx inside a SafeAreaView component from react-native.',
    platform: 'react-native',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const hasSafeArea = await checkFileContains(join(path, 'App.tsx'), 'SafeAreaView');
      return { passed: hasSafeArea && errors.length === 0, note: hasSafeArea ? 'Added' : 'Missing SafeAreaView' };
    },
  },
  {
    id: 'rn-ui-activity-indicator',
    category: 'ui',
    prompt: 'Add an ActivityIndicator component to indicate a loading state in the center of the screen.',
    platform: 'react-native',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const hasSpinner = await checkFileContains(join(path, 'App.tsx'), 'ActivityIndicator');
      return { passed: hasSpinner && errors.length === 0, note: hasSpinner ? 'Added' : 'Missing ActivityIndicator' };
    },
  },
  {
    id: 'rn-ui-modal',
    category: 'ui',
    prompt: 'Add a Modal component to App.tsx that can be toggled visible/invisible with a Button.',
    platform: 'react-native',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const hasModal = await checkFileContains(join(path, 'App.tsx'), 'Modal');
      return { passed: hasModal && errors.length === 0, note: hasModal ? 'Added' : 'Missing Modal' };
    },
  },
  {
    id: 'rn-ui-touchable-opacity',
    category: 'ui',
    prompt: 'Replace the standard Button widget with a custom TouchableOpacity component styled with a custom border.',
    platform: 'react-native',
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const hasOpacity = await checkFileContains(join(path, 'App.tsx'), 'TouchableOpacity');
      return { passed: hasOpacity && errors.length === 0, note: hasOpacity ? 'Added' : 'Missing TouchableOpacity' };
    },
  },
];
