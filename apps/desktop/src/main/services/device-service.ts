import { exec } from 'node:child_process';
import type { ConnectedDevice } from '@peep/shared';

export class DeviceService {
  constructor() {}

  async listDevices(flutterSdkPath?: string): Promise<ConnectedDevice[]> {
    const devices: ConnectedDevice[] = [];

    // 1. Android devices via ADB
    try {
      const adbOutput = await this.runCmd('adb devices');
      const lines = adbOutput.split(/\r?\n/);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length === 2 && parts[1] === 'device') {
          devices.push({
            id: parts[0],
            name: `Android Physical Device (${parts[0]})`,
            platform: 'android',
            type: 'physical',
          });
        }
      }
    } catch {
      // ADB command not found or failed, ignore
    }

    // 2. iOS simulator devices via xcrun
    if (process.platform === 'darwin' || (this as any)._testPlatform === 'darwin') {
      try {
        const simOutput = await this.runCmd('xcrun simctl list devices');
        const lines = simOutput.split(/\r?\n/);
        for (const line of lines) {
          if (line.includes('(Booted)')) {
            const match = line.match(/^\s*(.*?)\s*\(([-0-9A-Fa-f]+)\)\s*\(Booted\)/);
            if (match) {
              devices.push({
                id: match[2],
                name: `${match[1]} (iOS Simulator)`,
                platform: 'ios',
                type: 'emulator',
              });
            }
          }
        }
      } catch {
        // xcrun not found or failed, ignore
      }
    }

    // 3. Fallback/Extend using Flutter Devices if Flutter is active
    if (flutterSdkPath) {
      try {
        const flutterBin = process.platform === 'win32' ? 'flutter.bat' : 'flutter';
        const flutterOutput = await this.runCmd(`"${require('node:path').join(flutterSdkPath, 'bin', flutterBin)}" devices --machine`);
        const flutterList = JSON.parse(flutterOutput);
        for (const dev of flutterList) {
          if (dev.id === 'chrome' || dev.id === 'web-server') continue;
          if (devices.some((d) => d.id === dev.id)) continue;
          
          devices.push({
            id: dev.id,
            name: dev.name || `Device (${dev.id})`,
            platform: dev.targetPlatform?.toLowerCase().includes('ios') ? 'ios' : 'android',
            type: dev.emulator ? 'emulator' : 'physical',
          });
        }
      } catch {
        // Fallback fail, ignore
      }
    }

    // If no devices found, return mock emulators for development
    if (devices.length === 0) {
      devices.push({
        id: 'emulator-5554',
        name: 'Android Emulator (Pixel 8 Pro)',
        platform: 'android',
        type: 'emulator',
      });
    }

    return devices;
  }

  private runCmd(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(cmd, (err, stdout, stderr) => {
        if (err) {
          reject(err);
        } else {
          resolve(stdout || stderr);
        }
      });
    });
  }
}
