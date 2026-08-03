import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export type AgentState =
  | 'UNDERSTAND'
  | 'PLAN'
  | 'DISCOVER'
  | 'DESIGN'
  | 'IMPLEMENT'
  | 'INSTALL'
  | 'RUN'
  | 'VALIDATE'
  | 'DEBUG'
  | 'UI_REVIEW'
  | 'IMPROVE'
  | 'FINAL_VERIFY'
  | 'COMPLETE';

export interface TaskState {
  taskId: string;
  currentState: AgentState;
  modifiedFiles: string[];
  retryCount: number;
  lastErrorSignature?: string;
  lastUpdatedAt: string;
}

export async function loadAgentTaskState(projectRoot: string): Promise<TaskState | null> {
  try {
    const filePath = join(projectRoot, '.peep', 'task-state.json');
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as TaskState;
  } catch {
    return null;
  }
}

export async function saveAgentTaskState(projectRoot: string, state: TaskState): Promise<void> {
  try {
    const dirPath = join(projectRoot, '.peep');
    await mkdir(dirPath, { recursive: true });
    const filePath = join(dirPath, 'task-state.json');
    await writeFile(filePath, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    // Fail-silent in case of write restrictions during test runs
  }
}
