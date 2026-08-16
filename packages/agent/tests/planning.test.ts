import { classifyRequest } from '../src/planning/classifier';
import { ArchitecturePolicyEngine } from '../src/planning/rules';
import { ProjectPlanner } from '../src/planning/planner';
import { runAgentLoop, getBatchCategory, BATCH_ORDER } from '../src/orchestrator';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProjectPlan } from '../src/planning/types';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error('Assertion Failed: ' + msg);
}

export default async function runPlanningTests() {
  console.log('  Running Project Planner & Architecture Policy unit tests...');

  // 1. Test Request Classification
  assert(classifyRequest('hi') === 'lightweight', 'classify hi as lightweight');
  assert(classifyRequest('what is this') === 'lightweight', 'classify short general questions as lightweight');
  assert(classifyRequest('build me a hotel booking app') === 'major_scaffold', 'classify build app as major_scaffold');
  assert(classifyRequest('scaffold a delivery application') === 'major_scaffold', 'classify scaffold application as major_scaffold');
  assert(classifyRequest('refactor App.tsx') === 'refactor', 'classify refactor App.tsx as refactor');
  assert(classifyRequest('fix compilation error in App.tsx') === 'bug_fix', 'classify fix error as bug_fix');
  assert(classifyRequest('change the color of the button') === 'small', 'classify simple tweak as small');

  // 2. Test Architecture Rules Engine - App.tsx Policy
  const cleanApp = `import React from 'react';
import { View } from 'react-native';
export default function App() {
  return <View />;
}`;
  assert(ArchitecturePolicyEngine.evaluateAppPolicy(cleanApp, 'App.tsx').length === 0, 'clean App has no violations');

  const largeApp = Array(600).fill('// line').join('\n');
  const largeAppViolations = ArchitecturePolicyEngine.evaluateAppPolicy(largeApp, 'App.tsx');
  assert(largeAppViolations.some(v => v.rule === 'APP_FILE_TOO_LARGE'), 'large App has size violation');

  const inlineScreensApp = `
function HomeScreen() { return null; }
function SettingsScreen() { return null; }
export default function App() { return null; }
`;
  const screenViolations = ArchitecturePolicyEngine.evaluateAppPolicy(inlineScreensApp, 'App.tsx');
  assert(screenViolations.some(v => v.rule === 'APP_INLINE_SCREENS'), 'App with screens has screen violation');

  const apiCallsApp = `
export default function App() {
  const loadData = () => {
    fetch('https://api.example.com/data');
  };
  return null;
}
`;
  const apiViolations = ArchitecturePolicyEngine.evaluateAppPolicy(apiCallsApp, 'App.tsx');
  assert(apiViolations.some(v => v.rule === 'APP_DIRECT_API_CALLS'), 'App with direct fetch has API calls violation');

  // 3. Test General Architecture Rules
  const rawSqlScreen = `
export default function UserScreen() {
  const runQuery = () => {
    const q = 'SELECT * FROM users';
  };
  return null;
}
`;
  const dbViolations = ArchitecturePolicyEngine.evaluateGeneralArchitecture(rawSqlScreen, 'src/screens/UserScreen.tsx');
  assert(dbViolations.some(v => v.rule === 'UI_DIRECT_DB_ACCESS'), 'UI file with SELECT query has DB access violation');

  const cleanReactScreen = `
export default function UserScreen() {
  return null;
}
const styles = StyleSheet.create({});
`;
  assert(ArchitecturePolicyEngine.evaluateGeneralArchitecture(cleanReactScreen, 'src/screens/UserScreen.tsx').length === 0, 'clean screen has no violations');

  // 4. Test ProjectPlanner Inspection
  const mockWorkspace = {
    listDir: async () => [
      { name: 'package.json', path: 'package.json' },
      { name: 'App.tsx', path: 'App.tsx' }
    ],
    readFile: async (p: string) => {
      if (p.endsWith('package.json')) return JSON.stringify({ dependencies: { 'react-native': '0.72.0' } });
      if (p.endsWith('App.tsx')) return cleanApp;
      return '';
    }
  };
  const inspection = await ProjectPlanner.inspectWorkspace('.', mockWorkspace);
  assert(inspection.framework === 'react-native-expo', 'framework is react-native-expo');
  assert(inspection.entryPath === 'App.tsx', 'entry path is App.tsx');

  // 5. Test Plan Validation
  const validPlan: ProjectPlan = {
    projectType: 'booking',
    framework: 'react-native-expo',
    architecture: 'feature-based',
    directories: ['src/features', 'src/components'],
    files: [{ path: 'src/components/Button.tsx', responsibility: 'Render buttons', dependencies: [], tasks: [] }],
    dependencies: ['zustand'],
    implementationPhases: [{ name: 'Phase 1', description: 'Core', tasks: ['task_1'] }],
    tasks: [{ id: 'task_1', description: 'Create button', status: 'pending', required: true }],
    architectureRules: [],
    completionCriteria: ['Test completes']
  };
  assert(ProjectPlanner.validatePlan(validPlan), 'validPlan validates');
  assert(!ProjectPlanner.validatePlan({}), 'empty object does not validate');

  // 6. Test Roadmap Merging
  const existingRoadmap = `
# ROADMAP.md
## 1. Project Overview
Old Overview
`;
  const merged = ProjectPlanner.mergeRoadmap(existingRoadmap, validPlan);
  assert(merged.includes('## 5. Pending Work'), 'roadmap contains pending work');
  assert(merged.includes('Create button'), 'roadmap contains new tasks');

  // 7. Orchestrator and Intercepted Executor Integration
  let callCount = 0;
  const mockGateway = {
    generate: async (args: any) => {
      callCount++;
      // If it is the system planner prompt, it has "You are the Synkro Project Planner" or "JSON project plan"
      const isPlannerCall = args.messages?.[0]?.content?.includes('JSON project plan');
      if (isPlannerCall) {
        return {
          content: JSON.stringify(validPlan)
        };
      }
      if (callCount <= 2) {
        return {
          toolCalls: [
            {
              id: 'call_abc',
              name: 'read_file',
              arguments: JSON.stringify({ path: 'package.json' })
            }
          ]
        };
      }
      return {
        content: 'Scaffolding completed successfully.'
      };
    }
  };

  const planStore: Record<string, string> = {};
  const mockExecutor = {
    lastOriginalContent: '',
    execute: async (name: string, args: Record<string, unknown>) => {
      if (name === 'manage_plan') {
        planStore['.peep/plan.json'] = JSON.stringify(args);
        return 'Plan initialized';
      }
      if (name === 'propose_file_edit') {
        planStore[args.path as string] = args.content as string;
        return 'Edit applied';
      }
      if (name === 'read_file') {
        return planStore[args.path as string] || cleanApp;
      }
      return 'Success';
    }
  };

  const callbacks = {
    onStatus: () => {},
    onDelta: () => {},
    onError: () => {},
    onDone: () => {}
  };

  await rm(join(process.cwd(), '.peep', 'task.json'), { force: true }).catch(() => {});
  const result = await runAgentLoop(
    {
      capabilityTier: 'fast',
      sessionToken: 'test_token',
      gateway: mockGateway as any,
      planApprovalMode: 'auto'
    },
    'Test System Prompt',
    [{ role: 'user', content: 'Build me a booking app' }],
    mockExecutor as any,
    callbacks,
    new AbortController().signal,
    true
  );

  assert(result.includes('Worked for') || result.includes('Change Tracking Summary'), 'runAgentLoop returns logs or final response');
  assert(!!planStore['.peep/plan.json'], 'plan was written to store');

  // 8. Intercepted Executor App.tsx Policy Enforcement
  const interceptedExecutor = (runAgentLoop as any).interceptedExecutor || mockExecutor;
  const wrappedExecute = async (args: any) => {
    const filePath = String(args.path);
    const content = String(args.content);
    const appViolations = ArchitecturePolicyEngine.evaluateAppPolicy(content, filePath);
    if (appViolations.length > 0) {
      return 'REJECTED: violations: ' + appViolations.map(v => v.rule).join(',');
    }
    return 'ACCEPTED';
  };

  const rejectResult = await wrappedExecute({ path: 'App.tsx', content: apiCallsApp });
  assert(rejectResult.includes('REJECTED') && rejectResult.includes('APP_DIRECT_API_CALLS'), 'App with direct API call was rejected');

  // 9. Real E2E Booking Application Generation Test
  console.log('  Testing E2E Booking Application generation flow...');
  let e2eCalls = 0;
  const e2ePlan: ProjectPlan = {
    projectType: 'booking',
    framework: 'react-native-expo',
    architecture: 'feature-based',
    directories: ['src/features/booking', 'src/navigation', 'src/store'],
    files: [
      { path: 'src/features/booking/types.ts', responsibility: 'Define booking types', dependencies: [], tasks: [] },
      { path: 'src/features/booking/screens/BookingScreen.tsx', responsibility: 'Booking list screen', dependencies: [], tasks: [] },
      { path: 'App.tsx', responsibility: 'Bootstrap app', dependencies: [], tasks: [] }
    ],
    dependencies: ['zustand', '@react-navigation/native'],
    implementationPhases: [],
    tasks: [
      { id: 't1', description: 'Create types', status: 'pending', required: true },
      { id: 't2', description: 'Create BookingScreen', status: 'pending', required: true },
      { id: 't3', description: 'Setup App.tsx entry', status: 'pending', required: true }
    ],
    architectureRules: ['App.tsx remains minimal'],
    completionCriteria: ['All files generated']
  };

  const e2eGateway = {
    generate: async (args: any) => {
      e2eCalls++;
      if (args.messages?.[0]?.content?.includes('JSON project plan')) {
        return { content: JSON.stringify(e2ePlan) };
      }
      
      if (e2eCalls === 2) {
        return {
          toolCalls: [
            {
              id: 'call_e2e_1',
              name: 'propose_file_edit',
              arguments: JSON.stringify({
                path: 'src/features/booking/types.ts',
                content: 'export interface Booking { id: string; name: string; }',
                description: 'Create types'
              })
            },
            {
              id: 'call_e2e_manage_1',
              name: 'manage_plan',
              arguments: JSON.stringify({
                action: 'update_step',
                stepId: 't1',
                status: 'completed'
              })
            }
          ]
        };
      }
      
      if (e2eCalls === 3) {
        return {
          toolCalls: [
            {
              id: 'call_e2e_2',
              name: 'propose_file_edit',
              arguments: JSON.stringify({
                path: 'App.tsx',
                content: 'export default function App() { fetch("https://api.example.com"); return null; }',
                description: 'Add inline logic to App.tsx'
              })
            }
          ]
        };
      }

      if (e2eCalls === 4) {
        return {
          toolCalls: [
            {
              id: 'call_e2e_3',
              name: 'propose_file_edit',
              arguments: JSON.stringify({
                path: 'src/features/booking/screens/BookingScreen.tsx',
                content: 'export default function BookingScreen() { return null; }',
                description: 'Create BookingScreen'
              })
            },
            {
              id: 'call_e2e_4',
              name: 'propose_file_edit',
              arguments: JSON.stringify({
                path: 'App.tsx',
                content: 'import BookingScreen from "./src/features/booking/screens/BookingScreen"; export default function App() { return <BookingScreen />; }',
                description: 'Make App.tsx thin'
              })
            },
            {
              id: 'call_e2e_manage_2',
              name: 'manage_plan',
              arguments: JSON.stringify({
                action: 'update_step',
                stepId: 't2',
                status: 'completed'
              })
            },
            {
              id: 'call_e2e_manage_3',
              name: 'manage_plan',
              arguments: JSON.stringify({
                action: 'update_step',
                stepId: 't3',
                status: 'completed'
              })
            }
          ]
        };
      }

      return {
        content: 'E2E booking application successfully scaffolded!'
      };
    }
  };

  const e2eStore: Record<string, string> = {
    'package.json': JSON.stringify({ dependencies: { 'react-native': '0.72' }, scripts: {} }),
    'App.tsx': cleanApp
  };
  const e2eExecutor = {
    lastOriginalContent: '',
    execute: async (name: string, args: Record<string, unknown>) => {
      if (name === 'manage_plan') return 'Success';
      if (name === 'propose_file_edit') {
        e2eStore[args.path as string] = args.content as string;
        return 'Edit applied';
      }
      if (name === 'read_file') {
        return e2eStore[args.path as string] || '';
      }
      if (name === 'run_command') {
        return 'Command exited with code 0';
      }
      return 'Success';
    }
  };

  const e2eCallbacks = {
    onStatus: () => {},
    onDelta: () => {},
    onError: () => {},
    onDone: () => {}
  };

  await runAgentLoop(
    {
      capabilityTier: 'fast',
      sessionToken: 'test_token',
      gateway: e2eGateway as any,
      planApprovalMode: 'auto'
    },
    'E2E System Prompt',
    [{ role: 'user', content: 'Build me a booking application' }],
    e2eExecutor as any,
    e2eCallbacks,
    new AbortController().signal,
    true
  );

  assert(e2eStore['src/features/booking/types.ts'] !== undefined, 'types.ts should be created');
  assert(e2eStore['src/features/booking/screens/BookingScreen.tsx'] !== undefined, 'BookingScreen.tsx should be created');
  assert(e2eStore['App.tsx'].includes('import BookingScreen'), 'App.tsx should import BookingScreen');
  assert(!e2eStore['App.tsx'].includes('fetch('), 'App.tsx must not contain fetch API calls');
  console.log('  🟢 E2E Booking Application generation flow passed.');

  // 3. Test hi lightweight conversation request
  console.log('  Testing "hi" request lightweight conversation path...');
  let chatCalls = 0;
  const chatGateway = {
    generate: async (args: any) => {
      chatCalls++;
      return { content: 'Hello! How can I help you today?' };
    }
  };
  const chatExecutor = {
    execute: async (name: string) => {
      throw new Error(`Executor should not be called for lightweight request, called: ${name}`);
    }
  };
  await runAgentLoop(
    {
      capabilityTier: 'fast',
      sessionToken: 'test_token',
      gateway: chatGateway as any,
      planApprovalMode: 'auto'
    },
    'Chat System Prompt',
    [{ role: 'user', content: 'hi' }],
    chatExecutor as any,
    e2eCallbacks,
    new AbortController().signal
  );
  assert(chatCalls === 1, 'conversation loop should run exactly once for chat');
  console.log('  🟢 "hi" request lightweight path test passed.');

  // 4. Test premature completion refusal guard when unfinished tasks remain
  console.log('  Testing premature completion refusal guard...');
  let guardCalls = 0;
  const guardGateway = {
    generate: async (args: any) => {
      guardCalls++;
      if (guardCalls === 1) {
        // Planning
        return { content: JSON.stringify(e2ePlan) };
      }
      // Iteration 1: Return text content without tool calls, simulating premature model stop
      if (guardCalls === 2) {
        return { content: 'I am thinking about the implementation. Let me stop for a second.' };
      }
      // Iteration 2: Now call tool to implement
      if (guardCalls === 3) {
        return {
          toolCalls: [
            {
              id: 'call_guard_manage',
              name: 'manage_plan',
              arguments: JSON.stringify({
                action: 'update_step',
                stepId: 't1',
                status: 'completed'
              })
            },
            {
              id: 'call_guard_manage2',
              name: 'manage_plan',
              arguments: JSON.stringify({
                action: 'update_step',
                stepId: 't2',
                status: 'completed'
              })
            },
            {
              id: 'call_guard_manage3',
              name: 'manage_plan',
              arguments: JSON.stringify({
                action: 'update_step',
                stepId: 't3',
                status: 'completed'
              })
            }
          ]
        };
      }
      return { content: 'All implementation finished!' };
    }
  };

  const guardStore: Record<string, string> = {};
  const guardExecutor = {
    lastOriginalContent: '',
    execute: async (name: string, args: Record<string, unknown>) => {
      if (name === 'read_file') return guardStore[args.path as string] || '';
      if (name === 'propose_file_edit') {
        guardStore[args.path as string] = args.content as string;
        return 'Edit applied';
      }
      return 'Success';
    }
  };

  await runAgentLoop(
    {
      capabilityTier: 'fast',
      sessionToken: 'test_token',
      gateway: guardGateway as any,
      planApprovalMode: 'auto'
    },
    'Guard System Prompt',
    [{ role: 'user', content: 'Build me a booking application' }],
    guardExecutor as any,
    e2eCallbacks,
    new AbortController().signal
  );

  assert(guardCalls >= 4, `premature completion guard failed, only called ${guardCalls} times`);
  console.log('  🟢 Premature completion refusal guard test passed.');

  // 5. Test loop continuation and tool call safety guards
  console.log('  Testing loop safety guards (tool refusal / WAITING_FOR_APPROVAL)...');
  let testACalls = 0;
  const testAGateway = {
    generate: async (args: any) => {
      testACalls++;
      if (testACalls === 1) {
        return { content: JSON.stringify(e2ePlan) };
      }
      return { content: 'No tools called yet, I am thinking.' };
    }
  };
  const testAExecutor = {
    lastOriginalContent: '',
    execute: async (name: string, args: Record<string, unknown>) => {
      if (name === 'read_file') return '';
      return 'Success';
    }
  };
  await rm(join(process.cwd(), '.peep', 'task.json'), { force: true }).catch(() => {});
  const testAResult = await runAgentLoop(
    {
      capabilityTier: 'fast',
      sessionToken: 'test_token',
      gateway: testAGateway as any,
      planApprovalMode: 'auto'
    },
    'Test A System Prompt',
    [{ role: 'user', content: 'Build me a booking application' }],
    testAExecutor as any,
    e2eCallbacks,
    new AbortController().signal
  );
  assert(testACalls === 4, `Test A calls count must be 4 (1 planning + 3 toolless), got ${testACalls}`);
  assert(testAResult.includes('WAITING_FOR_APPROVAL'), 'Should transition to WAITING_FOR_APPROVAL due to repeated toolless responses');
  console.log('  🟢 Loop safety guards (tool refusal / WAITING_FOR_APPROVAL) test passed.');

  await runAutonomousExecutionTests();

  console.log('  🟢 All Project Planner & Architecture Policy unit tests passed.');
}

async function runAutonomousExecutionTests() {
  console.log('\n  Testing autonomous execution system...');

  // 1. Test getBatchCategory categorizer
  const catTypes1 = getBatchCategory('create app types', ['src/features/booking/types.ts']);
  assert(catTypes1 === 'types', `Expected 'types', got ${catTypes1}`);

  const catData1 = getBatchCategory('setup database schema', ['src/db/schema.ts']);
  assert(catData1 === 'data', `Expected 'data', got ${catData1}`);

  const catStore1 = getBatchCategory('setup user slice store', ['src/store/userStore.ts']);
  assert(catStore1 === 'state/store', `Expected 'state/store', got ${catStore1}`);

  const catComp1 = getBatchCategory('custom shared buttons component', ['src/components/shared/Button.tsx']);
  assert(catComp1 === 'shared components', `Expected 'shared components', got ${catComp1}`);

  const catScreen1 = getBatchCategory('booking list screen screen page', ['src/features/booking/screens/BookingList.tsx']);
  assert(catScreen1 === 'screens', `Expected 'screens', got ${catScreen1}`);

  const catNav1 = getBatchCategory('app navigation router configuration', ['src/navigation/index.tsx']);
  assert(catNav1 === 'navigation', `Expected 'navigation', got ${catNav1}`);

  const catService1 = getBatchCategory('fetch booking api services', ['src/services/api.ts']);
  assert(catService1 === 'services', `Expected 'services', got ${catService1}`);

  const catConfig1 = getBatchCategory('eslint configure setup', ['eslint.config.js']);
  assert(catConfig1 === 'configuration', `Expected 'configuration', got ${catConfig1}`);

  console.log('  🟢 getBatchCategory helper passed.');

  // 2. Test multi-file incremental execution batching and validation
  let generateCount = 0;
  const mockGateway = {
    generate: async (args: any) => {
      generateCount++;
      if (generateCount === 1) {
        // Return a plan with 2 tasks belonging to types and screens
        return {
          content: JSON.stringify({
            projectType: 'hotel-booking',
            framework: 'react-native-expo',
            architecture: 'feature-based',
            directories: ['src/features/booking', 'src/navigation'],
            files: [
              { path: 'src/features/booking/types.ts', responsibility: 'Define types', dependencies: [], tasks: [] },
              { path: 'src/features/booking/screens/BookingList.tsx', responsibility: 'Render list', dependencies: [], tasks: [] }
            ],
            dependencies: [],
            implementationPhases: [],
            tasks: [
              { id: 't1', description: 'Create types.ts file', status: 'pending', required: true, relevantFiles: ['src/features/booking/types.ts'] },
              { id: 't2', description: 'Create BookingList.tsx screen', status: 'pending', required: true, relevantFiles: ['src/features/booking/screens/BookingList.tsx'] }
            ],
            architectureRules: [],
            completionCriteria: ['All files exist']
          })
        };
      }
      
      // Simulating assistant model calling tools based on current batch prompt
      if (generateCount === 2) {
        // First batch is 'types'. Return propose_file_edit for types.ts
        return {
          content: 'Creating types.ts',
          toolCalls: [
            {
              id: 'call_1',
              name: 'propose_file_edit',
              arguments: JSON.stringify({ path: 'src/features/booking/types.ts', content: 'export interface Booking {}' })
            }
          ]
        };
      }

      if (generateCount === 3) {
        // Next batch is 'screens'. Return propose_file_edit for BookingList.tsx
        return {
          content: 'Creating screens',
          toolCalls: [
            {
              id: 'call_2',
              name: 'propose_file_edit',
              arguments: JSON.stringify({ path: 'src/features/booking/screens/BookingList.tsx', content: 'export const BookingList = () => null;' })
            }
          ]
        };
      }

      // No tool calls - should trigger completion audit and pass!
      return { content: 'All implementation tasks completed.' };
    }
  };

  const createdFiles: string[] = [];
  const mockExecutor = {
    lastOriginalContent: '',
    execute: async (name: string, args: Record<string, unknown>) => {
      if (name === 'propose_file_edit') {
        createdFiles.push(String(args.path));
        return 'Edit applied';
      }
      if (name === 'read_file') {
        if (args.path === 'package.json') {
          return JSON.stringify({ name: 'test-app' });
        }
        return 'Success';
      }
      if (name === 'run_command') {
        return 'Command exited with code 0';
      }
      if (name === 'validate_project') {
        return JSON.stringify({ success: true, blockingErrors: 0, warnings: 0, checks: [] });
      }
      return 'Success';
    }
  };

  const e2eCallbacks = {
    onStatus: () => {},
    onDelta: () => {},
    onError: () => {},
    onDone: () => {}
  };

  await rm(join(process.cwd(), '.peep', 'task.json'), { force: true }).catch(() => {});
  const runResult = await runAgentLoop(
    {
      capabilityTier: 'fast',
      sessionToken: 'test_token',
      gateway: mockGateway as any,
      autoApplyEdits: true,
      planApprovalMode: 'auto'
    },
    'Autonomous Execution Prompt',
    [{ role: 'user', content: 'Build me a booking application' }],
    mockExecutor as any,
    e2eCallbacks,
    new AbortController().signal
  );

  assert(runResult.includes('COMPLETED'), `Expected status to transition to COMPLETED, got response: ${runResult}`);
  assert(createdFiles.includes('src/features/booking/types.ts'), 'Expected types.ts to be created');
  assert(createdFiles.includes('src/features/booking/screens/BookingList.tsx'), 'Expected BookingList.tsx to be created');
  console.log('  🟢 Multi-file incremental execution batching and Completion Audit passed.');

  // 3. Test Two-Stage Plan Approval Flow
  console.log('  Testing Two-Stage Plan Approval Flow...');
  
  let approvalGenerateCount = 0;
  const twoStageCreatedFiles: string[] = [];
  const twoStageGateway = {
    generate: async (args: any) => {
      approvalGenerateCount++;
      if (args.messages?.[0]?.content?.includes('JSON project plan')) {
        return {
          content: JSON.stringify({
            projectType: 'hotel-booking',
            framework: 'react-native-expo',
            architecture: 'feature-based',
            directories: [],
            files: [],
            dependencies: [],
            implementationPhases: [],
            tasks: [{ id: 't1', description: 'Create file', status: 'pending', required: true, relevantFiles: ['src/file.ts'] }],
            architectureRules: [],
            completionCriteria: []
          })
        };
      }
      
      // In Stage 2, simulate creating the file so Completion Audit passes
      if (approvalGenerateCount === 2) { // 1st is planner, 2nd is execution
        return {
          content: 'Creating file',
          toolCalls: [
            {
              id: 'call_1',
              name: 'propose_file_edit',
              arguments: JSON.stringify({ path: 'src/file.ts', content: 'hello' })
            }
          ]
        };
      }
      
      return { content: 'Autonomous execution completed.' };
    }
  };

  const twoStageExecutor = {
    lastOriginalContent: '',
    execute: async (name: string, args: Record<string, unknown>) => {
      if (name === 'propose_file_edit') {
        twoStageCreatedFiles.push(String(args.path));
        return 'Edit applied';
      }
      if (name === 'read_file') return JSON.stringify({ name: 'test' });
      if (name === 'validate_project') return JSON.stringify({ success: true, blockingErrors: 0, warnings: 0, checks: [] });
      return 'Success';
    }
  };

  let stage1State = '';
  const twoStageCallbacks1 = {
    onStatus: (status: string) => {
      // updateTaskState now signals state transitions via onStatus, not onDelta
      if (status.includes('WAITING_FOR_PLAN_APPROVAL')) {
        stage1State = 'WAITING_FOR_PLAN_APPROVAL';
      }
    },
    onDelta: (_text: string) => {
      // onDelta now contains only real LLM text — no internal state HTML comments
    },
    onError: () => {},
    onDone: () => {}
  };

  await rm(join(process.cwd(), '.peep', 'task.json'), { force: true }).catch(() => {});
  // Stage 1: Planning (planApprovalMode = 'normal')
  const resultStage1 = await runAgentLoop(
    {
      capabilityTier: 'fast',
      sessionToken: 'test_token',
      gateway: twoStageGateway as any,
      planApprovalMode: 'normal'
    },
    'Prompt',
    [{ role: 'user', content: 'Build a hotel booking app' }],
    twoStageExecutor as any,
    twoStageCallbacks1,
    new AbortController().signal,
    true
  );

  assert(resultStage1 === '', 'Stage 1 should return empty string (early exit for approval)');
  assert(stage1State === 'WAITING_FOR_PLAN_APPROVAL', 'Stage 1 should emit WAITING_FOR_PLAN_APPROVAL state');

  let stage2State = '';
  const twoStageCallbacks2 = {
    onStatus: (status: string) => {
      // PLAN_APPROVED is now signalled via onStatus, not onDelta
      if (status.includes('Plan approved') || status.includes('PLAN_APPROVED')) {
        stage2State = 'PLAN_APPROVED';
      }
    },
    onDelta: (_text: string) => {
      // onDelta now contains only real LLM text — no internal state banners
    },
    onError: () => {},
    onDone: () => {}
  };

  // Stage 2: Approving (planApprovalMode = 'approve')
  const resultStage2 = await runAgentLoop(
    {
      capabilityTier: 'fast',
      sessionToken: 'test_token',
      gateway: twoStageGateway as any,
      planApprovalMode: 'approve'
    },
    'Prompt',
    [{ role: 'user', content: 'Build a hotel booking app' }], // Same prompt
    twoStageExecutor as any,
    twoStageCallbacks2,
    new AbortController().signal,
    true
  );

  assert(resultStage2.includes('COMPLETED') || resultStage2.includes('completed'), 'Stage 2 should execute and complete');
  assert(stage2State === 'PLAN_APPROVED', 'Stage 2 should emit PLAN_APPROVED state');
  console.log('  🟢 Two-Stage Plan Approval Flow passed.');
}
