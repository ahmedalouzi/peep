import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { SCENARIOS } from './scenarios';
import { EvalExecutor } from './executor';
import { runAgentLoop } from '../orchestrator';
import { parseFlutterAnalyze } from '@peep/flutter-adapter';
import type { Diagnostic } from '@peep/shared';

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('OPENAI_API_KEY environment variable is required.');
  process.exit(1);
}

const SYSTEM_CONTEXT_FLUTTER = `You are Peep, an expert Flutter developer AI.
You must fulfill the user's request by proposing file edits.
Always ensure your code is error-free and follows best practices.`;

const SYSTEM_CONTEXT_RN = `You are Peep, an expert React Native and Expo developer AI.
You must fulfill the user's request by proposing file edits.
Always ensure your code is error-free and follows best practices.`;

interface EvalResult {
  scenario: string;
  category: string;
  passed: boolean;
  errors: number;
  note: string;
  dir: string;
}

function parseTscOutput(output: string, root: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const regex = /^(.+?)\((\d+),(\d+)\):\s+(error|warning|info)\s+TS\d+:\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(output)) !== null) {
    diagnostics.push({
      file: join(root, m[1]!.replace(/\\/g, '/')),
      line: parseInt(m[2]!, 10),
      column: parseInt(m[3]!, 10),
      severity: m[4] as 'error' | 'warning' | 'info',
      message: m[5]!.trim(),
    });
  }
  return diagnostics;
}

async function run() {
  const results: EvalResult[] = [];
  const filter = process.argv[2]; // optional filter

  // Find the monorepo root directory to locate templates
  const repoRoot = join(__dirname, '..', '..', '..', '..');

  for (const scenario of SCENARIOS) {
    if (filter && !scenario.id.includes(filter)) continue;

    console.log(`\n=== Running Scenario: ${scenario.id} ===`);
    const tempDir = await fs.mkdtemp(join(tmpdir(), `peep-eval-${scenario.id}-`));
    console.log(`Temp dir: ${tempDir}`);

    const isRN = scenario.platform === 'react-native';

    try {
      if (!isRN) {
        // 1. Scaffold base Flutter app
        execSync('flutter create . --platforms web', { cwd: tempDir, stdio: 'ignore' });
      } else {
        // 1. Scaffold React Native project
        const packageJson = {
          name: 'peep-eval-rn',
          version: '1.0.0',
          dependencies: {
            react: '18.2.0',
            'react-native': '0.72.6',
            expo: '~49.0.15',
          },
          devDependencies: {
            typescript: '^5.1.3',
            '@types/react': '^18.2.8',
            '@types/react-native': '^0.72.2',
          },
        };

        const tsconfigJson = {
          compilerOptions: {
            target: 'es2020',
            module: 'commonjs',
            jsx: 'react-native',
            strict: true,
            skipLibCheck: true,
            moduleResolution: 'node',
            allowSyntheticDefaultImports: true,
          },
        };

        await fs.writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf-8');
        await fs.writeFile(join(tempDir, 'tsconfig.json'), JSON.stringify(tsconfigJson, null, 2), 'utf-8');

        // Copy default App.tsx from template if no custom App.tsx is specified in initialFiles
        const initialHasApp = scenario.initialFiles && ('App.tsx' in scenario.initialFiles);
        if (!initialHasApp) {
          const templatePath = join(repoRoot, 'templates', 'react-native', 'blank-rn', 'App.tsx');
          let appContent = 'import React from \'react\';\nimport { View, Text } from \'react-native\';\nexport default function App() { return <View><Text>Peep</Text></View>; }';
          try {
            appContent = await fs.readFile(templatePath, 'utf-8');
          } catch {
            // Fallback if template doesn't exist locally
          }
          await fs.writeFile(join(tempDir, 'App.tsx'), appContent, 'utf-8');
        }

        // Install minimal packages for tsc checks (fast install)
        console.log('  Installing npm dependencies for TS type checking...');
        execSync('npm install --no-audit --no-fund --legacy-peer-deps', { cwd: tempDir, stdio: 'ignore' });
      }

      // 2. Apply initial files
      if (scenario.initialFiles) {
        for (const [relPath, content] of Object.entries(scenario.initialFiles)) {
          const absPath = join(tempDir, relPath);
          await fs.mkdir(join(absPath, '..'), { recursive: true });
          await fs.writeFile(absPath, content, 'utf-8');
        }
      }

      // 3. Run Agent
      const executor = new EvalExecutor(tempDir);
      const callbacks = {
        onStatus: (s: string) => console.log(`  [Agent] ${s}`),
        onDelta: () => {},
        onError: (e: string) => console.error(`  [Agent Error] ${e}`),
        onDone: () => {},
      };

      console.log(`  Prompt: "${scenario.prompt}"`);
      await runAgentLoop(
        { apiKey: API_KEY!, provider: 'openai', model: 'gpt-4o-mini' },
        isRN ? SYSTEM_CONTEXT_RN : SYSTEM_CONTEXT_FLUTTER,
        [{ role: 'user', content: scenario.prompt }],
        executor,
        callbacks,
        new AbortController().signal
      );

      // 4. Run Analyze
      let diagnostics: Diagnostic[] = [];
      if (!isRN) {
        console.log('  Running flutter analyze...');
        let analyzeOutput = '';
        try {
          analyzeOutput = execSync('flutter analyze', { cwd: tempDir, encoding: 'utf-8' });
        } catch (err: any) {
          analyzeOutput = err.stdout?.toString() || err.message;
        }
        diagnostics = parseFlutterAnalyze(analyzeOutput);
      } else {
        console.log('  Running tsc analyze...');
        let tsOutput = '';
        try {
          tsOutput = execSync('npx tsc --noEmit --pretty false', { cwd: tempDir, encoding: 'utf-8' });
        } catch (err: any) {
          tsOutput = err.stdout?.toString() || err.message;
        }
        diagnostics = parseTscOutput(tsOutput, tempDir);
      }

      // 5. Validate
      const { passed, note } = await scenario.validate(tempDir, diagnostics);
      const errorsCount = diagnostics.filter((d) => d.severity === 'error').length;

      console.log(`  Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
      console.log(`  Note: ${note}`);
      if (passed) {
        await fs.rm(tempDir, { recursive: true, force: true });
      } else {
        console.log(`  Keeping temp dir for inspection: ${tempDir}`);
      }

      results.push({
        scenario: scenario.id,
        category: scenario.category,
        passed,
        errors: errorsCount,
        note: note || '',
        dir: tempDir,
      });

    } catch (e: any) {
      console.error(`  Crash during scenario: ${e.message}`);
      results.push({
        scenario: scenario.id,
        category: scenario.category,
        passed: false,
        errors: -1,
        note: `Crashed: ${e.message}`,
        dir: tempDir,
      });
    }
  }

  // Print markdown report
  console.log('\n\n## Eval Report\n');
  console.log('| Scenario | Category | Result | Errors | Notes |');
  console.log('|---|---|---|---|---|');
  for (const r of results) {
    const res = r.passed ? '✅ Pass' : '❌ Fail';
    console.log(`| ${r.scenario} | ${r.category} | ${res} | ${r.errors >= 0 ? r.errors : 'Crash'} | ${r.note} |`);
  }
}

run().catch(console.error);
