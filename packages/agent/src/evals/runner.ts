import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { SCENARIOS } from './scenarios';
import { EvalExecutor } from './executor';
import { runAgentLoop } from '../orchestrator';
import { parseFlutterAnalyze } from '@peep/flutter-adapter';

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('OPENAI_API_KEY environment variable is required.');
  process.exit(1);
}

const SYSTEM_CONTEXT = `You are Peep, an expert Flutter developer AI.
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

async function run() {
  const results: EvalResult[] = [];
  const filter = process.argv[2]; // optional filter

  for (const scenario of SCENARIOS) {
    if (filter && !scenario.id.includes(filter)) continue;

    console.log(`\n=== Running Scenario: ${scenario.id} ===`);
    const tempDir = await fs.mkdtemp(join(tmpdir(), `peep-eval-${scenario.id}-`));
    console.log(`Temp dir: ${tempDir}`);

    try {
      // 1. Scaffold base Flutter app
      execSync('flutter create . --platforms web', { cwd: tempDir, stdio: 'ignore' });

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
        { apiKey: API_KEY, provider: 'openai', model: 'gpt-4o-mini' },
        SYSTEM_CONTEXT,
        scenario.prompt,
        executor,
        callbacks,
        new AbortController().signal
      );

      // 4. Run Flutter Analyze
      console.log('  Running flutter analyze...');
      let analyzeOutput = '';
      try {
        analyzeOutput = execSync('flutter analyze', { cwd: tempDir, encoding: 'utf-8' });
      } catch (err: any) {
        // flutter analyze exits with code 1 if there are errors
        analyzeOutput = err.stdout?.toString() || err.message;
      }

      const diagnostics = parseFlutterAnalyze(analyzeOutput);
      
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
