import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import type { Diagnostic } from '@peep/shared';

export interface EvalScenario {
  id: string;
  category: string;
  prompt: string;
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
  // --- Category 1: Scaffolding new screens/widgets ---
  {
    id: 'scaffold-login',
    category: 'scaffolding',
    prompt: 'Create a LoginScreen widget in lib/login_screen.dart with an email and password text field.',
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
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const exists = await checkFileExists(join(path, 'lib', 'item_list.dart'));
      return { passed: exists && errors.length === 0, note: exists ? 'File created' : 'File missing' };
    },
  },

  // --- Category 2: Fixing broken Flutter project ---
  {
    id: 'fix-syntax-error',
    category: 'fixing',
    prompt: 'Fix the syntax error in main.dart',
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
    validate: async (_, errors) => ({ passed: errors.length === 0, note: \`\${errors.length} errors\` }),
  },
  {
    id: 'fix-import-error',
    category: 'fixing',
    prompt: 'Fix the flutter analyze errors caused by missing imports.',
    baseTemplate: 'blank',
    initialFiles: {
      'lib/main.dart': `
void main() {
  runApp(const MaterialApp(home: Scaffold(body: Text('Hello'))));
}
      `.trim(),
    },
    validate: async (_, errors) => ({ passed: errors.length === 0, note: \`\${errors.length} errors\` }),
  },
  {
    id: 'fix-type-error',
    category: 'fixing',
    prompt: 'Fix the type error in the counter assignment.',
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
    validate: async (_, errors) => ({ passed: errors.length === 0, note: \`\${errors.length} errors\` }),
  },
  {
    id: 'fix-widget-error',
    category: 'fixing',
    prompt: 'Fix the child/children confusion in the Column widget.',
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
    validate: async (_, errors) => ({ passed: errors.length === 0, note: \`\${errors.length} errors\` }),
  },

  // --- Category 3: Adding a pub package ---
  {
    id: 'add-shared-prefs',
    category: 'packages',
    prompt: 'Add the shared_preferences package to pubspec.yaml.',
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
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const hasPackage = await checkFileContains(join(path, 'pubspec.yaml'), 'url_launcher:');
      return { passed: hasPackage && errors.length === 0, note: hasPackage ? 'Added' : 'Missing' };
    },
  },

  // --- Category 4: Modifying state logic ---
  {
    id: 'modify-counter-decrement',
    category: 'logic',
    prompt: 'Change the counter app to decrement instead of increment.',
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
    baseTemplate: 'counter',
    validate: async (path, errors) => {
      const isStateless = await checkFileContains(join(path, 'lib', 'main.dart'), 'extends StatelessWidget');
      return { passed: isStateless, note: isStateless ? 'Stateless' : 'Still stateful' };
    },
  },
  {
    id: 'modify-extract-widget',
    category: 'logic',
    prompt: 'Extract the floating action button into its own separate stateless widget class called MyFab.',
    baseTemplate: 'counter',
    validate: async (path, errors) => {
      const hasClass = await checkFileContains(join(path, 'lib', 'main.dart'), 'class MyFab');
      return { passed: hasClass && errors.length === 0, note: hasClass ? 'Extracted' : 'Not extracted' };
    },
  },

  // --- Category 5: UI/Navigation ---
  {
    id: 'ui-bottom-nav',
    category: 'ui',
    prompt: 'Add a BottomNavigationBar to the main Scaffold with Home and Settings tabs.',
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
    baseTemplate: 'blank',
    validate: async (path, errors) => {
      const hasSnack = await checkFileContains(join(path, 'lib', 'main.dart'), 'showSnackBar');
      return { passed: hasSnack && errors.length === 0, note: hasSnack ? 'Added' : 'Missing SnackBar' };
    },
  },
];
