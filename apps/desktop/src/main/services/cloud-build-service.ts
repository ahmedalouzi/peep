import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { db } from './db';
import { BrowserWindow } from 'electron';
import { IPC_EVENTS } from '@peep/shared';
const EventSource = require('eventsource');

const execAsync = promisify(exec);

export class CloudBuildService {
  private getGatewayUrl() {
    const settings = db.getSettingsRaw();
    return settings.gatewayUrl || process.env.SYNKRO_GATEWAY_URL || 'https://api.synkro.com';
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const settings = await db.getSettings();
    if (!settings.sessionToken) {
      throw new Error('Not authenticated. Please sign in to use Cloud Build.');
    }
    return {
      'Authorization': `Bearer ${settings.sessionToken}`,
    };
  }

  async startBuild(workspacePath: string, framework: string, target: string) {
    const zipPath = path.join(require('os').tmpdir(), `peep-build-${Date.now()}.zip`);
    
    // Zip the project directory. Exclude node_modules, build, etc if possible, but for MVP just zip all.
    // On Windows 10+, tar -a -c -f creates a zip. On macOS/Linux, zip works.
    try {
      if (process.platform === 'win32') {
        await execAsync(`tar.exe -a -c -f "${zipPath}" *`, { cwd: workspacePath });
      } else {
        await execAsync(`zip -r "${zipPath}" . -x "node_modules/*" ".git/*" "build/*"`, { cwd: workspacePath });
      }
    } catch (err: any) {
      throw new Error(`Failed to zip project: ${err.message}`);
    }

    const fileBuffer = await fs.readFile(zipPath);
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'application/zip' });
    formData.append('project', blob, 'project.zip');
    formData.append('projectId', path.basename(workspacePath));

    const headers = await this.getAuthHeaders();
    
    const res = await fetch(`${this.getGatewayUrl()}/api/build/upload`, {
      method: 'POST',
      headers,
      body: formData as any,
    });

    // Cleanup zip
    fs.unlink(zipPath).catch(() => {});

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`Cloud Build Start Failed: ${errData.error || res.statusText}`);
    }

    const data = await res.json();
    return this.getBuild(data.jobId);
  }

  async getBuild(id: string) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.getGatewayUrl()}/api/build/${id}`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`Cloud Build Get Failed: ${errData.error || res.statusText}`);
    }
    return res.json();
  }

  async getHistory() {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.getGatewayUrl()}/api/build/history`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`Cloud Build History Failed: ${errData.error || res.statusText}`);
    }
    return res.json();
  }

  async cancelBuild(id: string) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.getGatewayUrl()}/api/build/${id}/cancel`, {
      method: 'POST',
      headers,
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`Cloud Build Cancel Failed: ${errData.error || res.statusText}`);
    }
    return this.getBuild(id);
  }

  startLogStream(id: string, mainWindow: BrowserWindow) {
    const settings = db.getSettingsRaw();
    if (!settings.sessionToken) return;

    const url = `${this.getGatewayUrl()}/api/build/${id}/stream`;
    const es = new EventSource(url, {
      headers: {
        'Authorization': `Bearer ${settings.sessionToken}`,
      }
    });

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.chunk) {
          mainWindow.webContents.send(IPC_EVENTS.BUILD_LOG_CHUNK, { id, chunk: data.chunk });
        }
        if (data.chunk && data.chunk.includes('[Stream Terminated')) {
          es.close();
        }
      } catch (e) {
        console.error('Error parsing SSE data', e);
      }
    };

    es.onerror = (err) => {
      console.error('SSE Error', err);
      es.close();
    };
  }
}

export const cloudBuildService = new CloudBuildService();
