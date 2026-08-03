import { AgentService } from '../apps/desktop/src/main/services/agent-service';
import { DatabaseService } from '../apps/desktop/src/main/services/db';
import { WorkspaceManager } from '../apps/desktop/src/main/services/workspace-manager';
import { PlatformRegistry } from '../apps/desktop/src/main/services/platform-registry';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);
  const action = args[0];
  const projectPath = args[1];

  if (!action || !projectPath) {
    console.error('Usage: npx tsx agent-cli.ts <manage_plan|verify_criterion> <projectPath> <toolArgsJSON>');
    process.exit(1);
  }

  const toolArgsStr = args.slice(2).join(' ');
  let toolArgs = {};
  if (toolArgsStr) {
    try {
      toolArgs = JSON.parse(toolArgsStr);
    } catch (e) {
      console.error('Invalid JSON for tool args:', e);
      process.exit(1);
    }
  }

  const db = new DatabaseService();
  await db.init();
  const workspace = new WorkspaceManager(db);
  (workspace as any).project = { path: projectPath };
  const registry = new PlatformRegistry();

  const agent = new AgentService(db, workspace, registry);

  try {
    const result = await agent.handleToolCall(action, toolArgs, projectPath);
    console.log(result);
  } catch (error) {
    console.error('Error executing tool:', error);
  }
}

main().catch(console.error);
