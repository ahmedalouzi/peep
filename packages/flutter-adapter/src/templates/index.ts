export interface TemplateFile {
  relativePath: string;
  content: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  files: TemplateFile[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'Standard Flutter app from flutter create — no customizations.',
    files: [],
  },
  {
    id: 'material-app',
    name: 'Material App',
    description: 'Material 3 theme with a welcome home screen.',
    files: [
      {
        relativePath: 'lib/main.dart',
        content: `import 'package:flutter/material.dart';

void main() {
  runApp(const PeepMaterialApp());
}

class PeepMaterialApp extends StatelessWidget {
  const PeepMaterialApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Peep App',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF6750A4)),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Welcome')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.flutter_dash, size: 72, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 16),
            Text('Your app is ready', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text('Start building with Peep', style: Theme.of(context).textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }
}
`,
      },
    ],
  },
  {
    id: 'bottom-nav',
    name: 'Bottom Navigation',
    description: 'Material 3 app with bottom navigation and three tabs.',
    files: [
      {
        relativePath: 'lib/main.dart',
        content: `import 'package:flutter/material.dart';

void main() {
  runApp(const PeepNavApp());
}

class PeepNavApp extends StatelessWidget {
  const PeepNavApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Peep Nav App',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF006874)),
        useMaterial3: true,
      ),
      home: const RootShell(),
    );
  }
}

class RootShell extends StatefulWidget {
  const RootShell({super.key});

  @override
  State<RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<RootShell> {
  int _index = 0;

  static const _tabs = [
    _TabData('Home', Icons.home_outlined, Icons.home),
    _TabData('Explore', Icons.explore_outlined, Icons.explore),
    _TabData('Profile', Icons.person_outline, Icons.person),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          _TabPage(title: 'Home', icon: Icons.home),
          _TabPage(title: 'Explore', icon: Icons.explore),
          _TabPage(title: 'Profile', icon: Icons.person),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          for (final tab in _tabs)
            NavigationDestination(icon: Icon(tab.icon), selectedIcon: Icon(tab.selectedIcon), label: tab.label),
        ],
      ),
    );
  }
}

class _TabData {
  const _TabData(this.label, this.icon, this.selectedIcon);
  final String label;
  final IconData icon;
  final IconData selectedIcon;
}

class _TabPage extends StatelessWidget {
  const _TabPage({required this.title, required this.icon});

  final String title;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 64, color: Theme.of(context).colorScheme.primary),
          const SizedBox(height: 12),
          Text(title, style: Theme.of(context).textTheme.headlineSmall),
        ],
      ),
    );
  }
}
`,
      },
    ],
  },
];

export function getTemplate(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((t) => t.id === id);
}
