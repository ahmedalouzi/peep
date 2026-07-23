import { DeviceService } from '../../../apps/desktop/src/main/services/device-service';

export default async function run() {
  console.log('  Testing DeviceService parser...');

  const service = new DeviceService();
  (service as any)._testPlatform = 'darwin';

  // Stub the private runCmd runner method
  (service as any).runCmd = async (cmd: string) => {
    if (cmd.includes('adb devices')) {
      return `List of devices attached\nemulator-5554\tdevice\n988a1b414f4e\tdevice\n`;
    }
    if (cmd.includes('xcrun simctl list devices')) {
      return `== Devices ==\n-- iOS 17.0 --\n    iPhone 15 (F1A1B2C3-D4E5-4E6A-7B8C-9D0E1F2A3B4C) (Booted)\n    iPhone SE (3rd generation) (A1B2C3D4-E5F6-7G8H-9I0J-1K2L3M4N5O6P) (Shutdown)\n`;
    }
    if (cmd.includes('devices --machine')) {
      return JSON.stringify([
        {
          id: 'chrome',
          name: 'Chrome',
          targetPlatform: 'web',
          emulator: false,
        },
        {
          id: 'my-custom-phone',
          name: 'My Custom Phone',
          targetPlatform: 'android-arm64',
          emulator: false,
        }
      ]);
    }
    return '';
  };

  // Run listDevices with a mock Flutter SDK path to trigger all parsing branches
  const devices = await service.listDevices('/mock/flutter/sdk');

  // Verify Android devices from ADB
  const androidAdb = devices.find(d => d.id === '988a1b414f4e');
  if (!androidAdb || androidAdb.platform !== 'android' || androidAdb.type !== 'physical') {
    throw new Error('Expected to parse physical Android device from ADB logs');
  }

  // Verify iOS booted simulators
  const iosSim = devices.find(d => d.id === 'F1A1B2C3-D4E5-4E6A-7B8C-9D0E1F2A3B4C');
  if (!iosSim || iosSim.platform !== 'ios' || iosSim.type !== 'emulator') {
    throw new Error('Expected to parse booted iOS simulator target');
  }

  // Verify flutter devices fallback inclusion
  const customPhone = devices.find(d => d.id === 'my-custom-phone');
  if (!customPhone || customPhone.name !== 'My Custom Phone') {
    throw new Error('Expected to parse fallback devices from flutter devices machine list');
  }

  console.log('  Testing DeviceService successfully passed!');
}
