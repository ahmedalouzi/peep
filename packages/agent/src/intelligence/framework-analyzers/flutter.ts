import type { ProjectAnalyzer, ProjectIndex } from '../types';

export class FlutterAnalyzer implements ProjectAnalyzer {
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
    const nameNoExt = fileName.replace('.dart', '');

    // Entry points
    if (fileName === 'main.dart' && content.includes('void main()')) {
      result.entryPoints = [filePath];
    }

    // Screens
    if (content.includes('extends StatelessWidget') || content.includes('extends StatefulWidget') || content.includes('extends ConsumerWidget')) {
      const match = content.match(/class\s+([A-Za-z0-9_]+)\s+extends/);
      if (match) {
        const className = match[1];
        if (className.toLowerCase().includes('screen') || className.toLowerCase().includes('page') || filePath.includes('/screens/') || filePath.includes('/pages/')) {
          result.screens?.push({ name: className, file: filePath, type: 'screen' });
        } else {
          result.components?.push({ name: className, file: filePath, type: 'component' });
        }
      }
    }

    // Routes
    if (content.includes('GoRouter(') || content.includes('MaterialApp.router') || content.includes('routes:')) {
      result.routes?.push({ name: 'Router', file: filePath, type: 'router' });
    }

    // Theme
    if (content.includes('ThemeData(') || content.includes('ColorScheme')) {
      result.theme?.files.push(filePath);
    }

    // State Management
    if (content.includes('Riverpod') || content.includes('ConsumerWidget')) {
      result.stateManagement = { type: 'riverpod', files: [filePath] };
    } else if (content.includes('Bloc') || content.includes('Cubit')) {
      result.stateManagement = { type: 'bloc', files: [filePath] };
    } else if (content.includes('ChangeNotifierProvider')) {
      result.stateManagement = { type: 'provider', files: [filePath] };
    } else if (content.includes('GetX')) {
      result.stateManagement = { type: 'getx', files: [filePath] };
    }

    // Services
    if (nameNoExt.includes('service') || nameNoExt.includes('api') || nameNoExt.includes('repository')) {
      result.services?.push({ name: nameNoExt, file: filePath, type: 'service' });
    }

    // Models
    if (nameNoExt.includes('model') || filePath.includes('/models/')) {
      result.models?.push({ name: nameNoExt, file: filePath, type: 'model' });
    }

    return result;
  }
}
