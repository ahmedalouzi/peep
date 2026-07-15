import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { ExtensionInfo, ExtensionSearchResult } from '@peep/shared';

const execAsync = promisify(exec);

export class ExtensionService {
  private extensionsDir: string;
  private readonly VSX_API_BASE = 'https://open-vsx.org/api';

  constructor() {
    // Store extensions in ~/.peep/extensions or similar
    // Actually, app.getPath('userData')/extensions is standard for Electron apps
    this.extensionsDir = path.join(app.getPath('userData'), 'extensions');
    if (!fs.existsSync(this.extensionsDir)) {
      fs.mkdirSync(this.extensionsDir, { recursive: true });
    }
  }

  public async searchExtensions(query: string, offset = 0, size = 20): Promise<ExtensionSearchResult> {
    const url = query.trim()
      ? `${this.VSX_API_BASE}/-/search?query=${encodeURIComponent(query)}&offset=${offset}&size=${size}`
      : `${this.VSX_API_BASE}/-/search?sortBy=downloadCount&offset=${offset}&size=${size}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch from Open VSX: ${response.statusText}`);
    }

    const data = await response.json() as any;
    const installedList = await this.getInstalledExtensions();
    const installedIds = new Set(installedList.map(e => e.id.toLowerCase()));

    const extensions: ExtensionInfo[] = data.extensions.map((ext: any) => {
      const id = `${ext.namespace}.${ext.name}`;
      return {
        id,
        name: ext.name,
        namespace: ext.namespace,
        version: ext.version,
        displayName: ext.displayName,
        description: ext.description,
        iconUrl: ext.files.icon,
        downloadCount: ext.downloadCount,
        averageRating: ext.averageRating,
        downloadUrl: ext.files.download,
        installed: installedIds.has(id.toLowerCase()),
      };
    });

    return {
      extensions,
      totalSize: data.totalSize,
      offset: data.offset,
    };
  }

  public async getExtensionDetails(extensionId: string): Promise<any> {
    const [namespace, name] = extensionId.split('.');
    const url = `${this.VSX_API_BASE}/${namespace}/${name}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch extension details: ${response.statusText}`);
    }
    return await response.json();
  }

  public async getInstalledExtensions(): Promise<ExtensionInfo[]> {
    if (!fs.existsSync(this.extensionsDir)) return [];

    const dirs = fs.readdirSync(this.extensionsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    const installed: ExtensionInfo[] = [];

    for (const dirName of dirs) {
      try {
        const packageJsonPath = path.join(this.extensionsDir, dirName, 'extension', 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          const id = `${pkg.publisher}.${pkg.name}`;
          installed.push({
            id,
            name: pkg.name,
            namespace: pkg.publisher,
            version: pkg.version,
            displayName: pkg.displayName || pkg.name,
            description: pkg.description,
            iconUrl: pkg.icon ? `file://${path.join(this.extensionsDir, dirName, 'extension', pkg.icon)}` : undefined,
            installed: true,
          });
        }
      } catch (err) {
        console.error(`Failed to read extension metadata from ${dirName}:`, err);
      }
    }

    return installed;
  }

  public async installExtension(extensionId: string, downloadUrl?: string): Promise<void> {
    if (!downloadUrl) {
      // Need to fetch details to get downloadUrl
      const [namespace, name] = extensionId.split('.');
      const detailsUrl = `${this.VSX_API_BASE}/${namespace}/${name}`;
      const response = await fetch(detailsUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch extension details: ${response.statusText}`);
      }
      const details = await response.json() as any;
      downloadUrl = details.files.download;
      if (!downloadUrl) {
        throw new Error('No download URL found for extension');
      }
    }

    const tempVsixPath = path.join(app.getPath('temp'), `${extensionId}.vsix`);
    
    // 1. Download .vsix using streams to avoid memory issues with large files
    const response = await fetch(downloadUrl);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to download vsix: ${response.statusText}`);
    }
    
    // Web Streams API in Node.js fetch can be converted to Node streams
    const fileStream = fs.createWriteStream(tempVsixPath);
    const { pipeline } = require('stream/promises');
    const { Readable } = require('stream');
    // @ts-ignore
    await pipeline(Readable.fromWeb(response.body), fileStream);

    // 2. Extract .vsix to extension folder
    const targetDir = path.join(this.extensionsDir, extensionId);
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(targetDir, { recursive: true });

    try {
      // .vsix is a zip file. Windows 10+ has tar.exe built-in.
      // macOS/Linux have unzip.
      // We are on Windows, so we use tar.exe
      await execAsync(`tar -xf "${tempVsixPath}" -C "${targetDir}"`);
    } catch (error) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      fs.unlinkSync(tempVsixPath);
      throw new Error(`Failed to extract extension: ${error}`);
    }

    // 3. Cleanup
    fs.unlinkSync(tempVsixPath);
  }

  public async uninstallExtension(extensionId: string): Promise<void> {
    const targetDir = path.join(this.extensionsDir, extensionId);
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  }
}
