import { app } from 'electron';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface TelemetryEvent {
  name: string;
  ts: string;
  props?: Record<string, string | number | boolean>;
}

/**
 * Privacy-first telemetry:
 * - No network calls — everything stays local.
 * - Opt-in only; disabled by default.
 * - Log file lives in Electron userData, never committed.
 * - Log is capped at MAX_LINES to avoid unbounded growth.
 */
export class TelemetryService {
  private enabled = false;
  private logPath: string;
  private optInPath: string;
  private static MAX_LINES = 2000;

  constructor() {
    const dir = join(app.getPath('userData'), 'telemetry');
    this.logPath = join(dir, 'events.jsonl');
    this.optInPath = join(dir, 'opt-in.json');
  }

  async init(): Promise<void> {
    try {
      const dir = join(app.getPath('userData'), 'telemetry');
      await mkdir(dir, { recursive: true });
      const raw = await readFile(this.optInPath, 'utf-8');
      const parsed = JSON.parse(raw) as { enabled: boolean };
      this.enabled = parsed.enabled === true;
    } catch {
      // file doesn't exist yet → disabled by default
      this.enabled = false;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async setEnabled(value: boolean): Promise<void> {
    this.enabled = value;
    const dir = join(app.getPath('userData'), 'telemetry');
    await mkdir(dir, { recursive: true });
    await writeFile(this.optInPath, JSON.stringify({ enabled: value }, null, 2), 'utf-8');
    if (value) {
      await this.track('telemetry_opted_in');
    }
  }

  async track(name: string, props?: Record<string, string | number | boolean>): Promise<void> {
    if (!this.enabled) return;
    const event: TelemetryEvent = { name, ts: new Date().toISOString(), props };
    try {
      await appendFile(this.logPath, JSON.stringify(event) + '\n', 'utf-8');
      await this.trimLog();
    } catch {
      // never throw from telemetry
    }
  }

  private async trimLog(): Promise<void> {
    try {
      const raw = await readFile(this.logPath, 'utf-8');
      const lines = raw.split('\n').filter(Boolean);
      if (lines.length > TelemetryService.MAX_LINES) {
        const trimmed = lines.slice(-TelemetryService.MAX_LINES).join('\n') + '\n';
        await writeFile(this.logPath, trimmed, 'utf-8');
      }
    } catch {
      // ignore
    }
  }

  async getRecentEvents(limit = 50): Promise<TelemetryEvent[]> {
    try {
      const raw = await readFile(this.logPath, 'utf-8');
      const lines = raw.split('\n').filter(Boolean);
      return lines
        .slice(-limit)
        .map((l) => JSON.parse(l) as TelemetryEvent)
        .reverse();
    } catch {
      return [];
    }
  }
}
