import type { ProjectAnalyzer, ProjectIndex } from '../types';

export class ReactNativeAnalyzer implements ProjectAnalyzer {
  analyzeFile(filePath: string, content: string): Partial<ProjectIndex> {
    const result: Partial<ProjectIndex> = {
      routes: [],
      screens: [],
      components: [],
      services: [],
      models: [],
      theme: { files: [] },
      stateManagement: { type: 'unknown', files: [] },
    };

    const fileName = filePath.split('/').pop() || '';
    const nameNoExt = fileName.replace(/\.(tsx|ts|jsx|js)$/, '');

    // Entry points
    if (fileName === 'App.tsx' || fileName === 'App.js' || fileName === 'index.js') {
      result.entryPoints = [filePath];
    }

    // Screens / Components
    if (content.includes('export default function') || content.includes('export const') || content.includes('export function') || content.includes('React.FC')) {
      const isScreen = nameNoExt.toLowerCase().includes('screen') || nameNoExt.toLowerCase().includes('page') || filePath.includes('/screens/') || filePath.includes('/pages/') || filePath.includes('/app/');
      if (isScreen) {
        result.screens?.push({ name: nameNoExt, file: filePath, type: 'screen' });
      } else if (filePath.includes('/components/') || filePath.includes('/ui/')) {
        result.components?.push({ name: nameNoExt, file: filePath, type: 'component' });
      }
    }

    // Routes
    if (content.includes('createStackNavigator') || content.includes('NavigationContainer') || content.includes('Expo Router') || filePath.includes('app/_layout')) {
      result.routes?.push({ name: 'Router', file: filePath, type: 'router' });
    }

    // Theme
    if (content.includes('ThemeProvider') || content.includes('createTheme') || filePath.includes('/theme/') || filePath.includes('/styles/')) {
      result.theme?.files.push(filePath);
    }

    // State Management
    if (content.includes('configureStore') || content.includes('useSelector') || content.includes('useDispatch')) {
      result.stateManagement = { type: 'redux', files: [filePath] };
    } else if (content.includes('create(') && content.includes('zustand')) {
      result.stateManagement = { type: 'zustand', files: [filePath] };
    } else if (content.includes('createContext') && content.includes('useContext')) {
      result.stateManagement = { type: 'context', files: [filePath] };
    }

    // Services
    if (nameNoExt.includes('service') || nameNoExt.includes('api') || filePath.includes('/services/')) {
      result.services?.push({ name: nameNoExt, file: filePath, type: 'service' });
    }

    // Models
    if (nameNoExt.includes('types') || nameNoExt.includes('model') || filePath.includes('/models/')) {
      result.models?.push({ name: nameNoExt, file: filePath, type: 'model' });
    }

    return result;
  }
}
