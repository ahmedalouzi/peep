import * as fs from 'fs';
import * as path from 'path';

export interface ProjectIntelligence {
  routes: string[];
  themes: string[];
  stateManagement: string[];
  coreFiles: string[];
}

function scanDirectory(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      if (file !== 'build' && file !== '.dart_tool' && file !== '.git') {
        scanDirectory(filePath, fileList);
      }
    } else {
      if (filePath.endsWith('.dart') || filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

export function discoverProjectContext(projectPath: string): ProjectIntelligence {
  const libPath = path.join(projectPath, 'lib');
  const srcPath = path.join(projectPath, 'src'); // For React/RN
  
  const targetDir = fs.existsSync(libPath) ? libPath : (fs.existsSync(srcPath) ? srcPath : projectPath);
  const files = scanDirectory(targetDir);

  const intelligence: ProjectIntelligence = {
    routes: [],
    themes: [],
    stateManagement: [],
    coreFiles: [],
  };

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const relativePath = path.relative(projectPath, file);

      // Routing detection
      if (
        content.includes('GoRouter') ||
        content.includes('MaterialApp.router') ||
        content.includes('routes:') ||
        content.includes('Route<') ||
        content.includes('createBrowserRouter') || // React
        content.includes('Stack.Navigator') // RN
      ) {
        if (!intelligence.routes.includes(relativePath)) intelligence.routes.push(relativePath);
        if (!intelligence.coreFiles.includes(relativePath)) intelligence.coreFiles.push(relativePath);
      }

      // Theme detection
      if (
        content.includes('ThemeData') ||
        content.includes('ColorScheme') ||
        content.includes('TextTheme') ||
        content.includes('ThemeProvider') ||
        content.includes('createTheme')
      ) {
        if (!intelligence.themes.includes(relativePath)) intelligence.themes.push(relativePath);
        if (!intelligence.coreFiles.includes(relativePath)) intelligence.coreFiles.push(relativePath);
      }

      // State Management detection
      if (
        content.includes('Provider<') ||
        content.includes('ChangeNotifierProvider') ||
        content.includes('Riverpod') ||
        content.includes('ConsumerWidget') ||
        content.includes('BlocBuilder') ||
        content.includes('Cubit<') ||
        content.includes('GetX') ||
        content.includes('StoreProvider') ||
        content.includes('useContext(')
      ) {
        if (!intelligence.stateManagement.includes(relativePath)) intelligence.stateManagement.push(relativePath);
      }

    } catch (e) {
      // Ignore read errors
    }
  }

  // Deduplicate and limit to top 10 per category to prevent context bloat
  intelligence.routes = Array.from(new Set(intelligence.routes)).slice(0, 10);
  intelligence.themes = Array.from(new Set(intelligence.themes)).slice(0, 5);
  intelligence.stateManagement = Array.from(new Set(intelligence.stateManagement)).slice(0, 10);
  intelligence.coreFiles = Array.from(new Set(intelligence.coreFiles)).slice(0, 10);

  return intelligence;
}
