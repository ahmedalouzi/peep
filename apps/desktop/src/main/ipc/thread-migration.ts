import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';

export const activeMigrations = new Map<string, Promise<void>>();

export async function performThreadMigration(projectPath: string, settings: any, gatewayUrl: string, threads: any[]): Promise<any[]> {
  const chatJsonPath = path.join(projectPath, '.peep', 'chat.json');
  const migratedMarkerPath = path.join(projectPath, '.peep', 'chat_migrated.marker');
  let currentThreads = threads;

  if (fs.existsSync(chatJsonPath) && !fs.existsSync(migratedMarkerPath)) {
    const hash = crypto.createHash('sha256').update(projectPath).digest('hex');
    const deterministicThreadId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;

    if (!currentThreads.find((t: any) => t.id === deterministicThreadId)) {
      if (!activeMigrations.has(deterministicThreadId)) {
        const migrate = async () => {
          const content = await fs.promises.readFile(chatJsonPath, 'utf-8');
          const history = JSON.parse(content);
          
          let runs = undefined;
          if (history.timelineActivities && history.timelineActivities.length > 0) {
            const runsMap = new Map<string, any>();
            let currentLegacyRunId: string | null = null;
            let lastLegacyActTimestamp: number | null = null;
            let currentLegacyRunClosed = false;
            
            // 5-minute threshold is a best-effort heuristic for legacy data without guaranteed accuracy.
            const GAP_THRESHOLD = 5 * 60 * 1000;
            
            const sortedActivities = [...history.timelineActivities].sort((a, b) => {
              const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
              const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
              return timeA - timeB;
            });
            
            for (const act of sortedActivities) {
              if (act.runId) {
                const runId = act.runId;
                if (!runsMap.has(runId)) {
                  runsMap.set(runId, {
                    run_id: runId,
                    thread_id: deterministicThreadId,
                    started_at: act.timestamp || new Date(0).toISOString(),
                    status: act.status || 'in_progress',
                    timeline_activities: []
                  });
                }
                const run = runsMap.get(runId);
                run.timeline_activities.push(act);
                if (act.type === 'completed' || act.type === 'error') {
                  run.completed_at = act.timestamp;
                  run.status = act.status;
                }
                continue;
              }
              
              const actTime = act.timestamp ? new Date(act.timestamp).getTime() : 0;
              let startNewRun = false;
              
              if (!currentLegacyRunId || currentLegacyRunClosed) {
                startNewRun = true;
              } else if (lastLegacyActTimestamp !== null && actTime - lastLegacyActTimestamp > GAP_THRESHOLD) {
                startNewRun = true;
              }
              
              if (startNewRun) {
                const legacyFirstActId = act.id || 'unknown';
                const legacyHash = crypto.createHash('sha256').update(`legacy-run:${deterministicThreadId}:${legacyFirstActId}`).digest('hex');
                currentLegacyRunId = `run:legacy:${legacyHash}`;
                currentLegacyRunClosed = false;
              }
              
              lastLegacyActTimestamp = actTime;
              
              if (!runsMap.has(currentLegacyRunId!)) {
                runsMap.set(currentLegacyRunId!, {
                  run_id: currentLegacyRunId!,
                  thread_id: deterministicThreadId,
                  started_at: act.timestamp || new Date(0).toISOString(),
                  status: act.status || 'in_progress',
                  timeline_activities: []
                });
              }
              
              const run = runsMap.get(currentLegacyRunId!);
              run.timeline_activities.push(act);
              
              if (act.type === 'completed' || act.type === 'error') {
                run.completed_at = act.timestamp;
                run.status = act.status;
                currentLegacyRunClosed = true;
              }
            }
            runs = Array.from(runsMap.values());
          }

          const saveRes = await fetch(`${gatewayUrl}/v1/threads/${deterministicThreadId}`, {
            method: 'POST',
            headers: { 
              Authorization: `Bearer ${settings.sessionToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              messages: history.messages || [], 
              title: 'Migrated Chat',
              runs
            })
          });
          if (!saveRes.ok) throw new Error('Failed to migrate thread to backend');
          await fs.promises.writeFile(migratedMarkerPath, new Date().toISOString());
        };

        const migrationPromise = migrate().catch(err => {
          console.error('Migration failed:', err);
        }).finally(() => {
          activeMigrations.delete(deterministicThreadId);
        });
        activeMigrations.set(deterministicThreadId, migrationPromise);
        await migrationPromise;

        const refetchRes = await fetch(`${gatewayUrl}/v1/threads`, {
          headers: { Authorization: `Bearer ${settings.sessionToken}` }
        });
        if (refetchRes.ok) {
          const refetchData = await refetchRes.json();
          currentThreads = refetchData.threads || [];
        }
      } else {
        await activeMigrations.get(deterministicThreadId);
        const refetchRes = await fetch(`${gatewayUrl}/v1/threads`, {
          headers: { Authorization: `Bearer ${settings.sessionToken}` }
        });
        if (refetchRes.ok) {
          const refetchData = await refetchRes.json();
          currentThreads = refetchData.threads || [];
        }
      }
    } else {
      await fs.promises.writeFile(migratedMarkerPath, new Date().toISOString());
    }
  }
  return currentThreads;
}
