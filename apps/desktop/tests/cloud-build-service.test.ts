import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cloudBuildService } from '../src/main/services/cloud-build-service';
import { db } from '../src/main/services/db';
import * as fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import EventSource from 'eventsource';

vi.mock('../src/main/services/db', () => ({
  db: {
    getSettingsRaw: vi.fn(),
    getSettings: vi.fn(),
  }
}));

vi.mock('node:child_process', () => ({
  exec: vi.fn((cmd, opts, cb) => {
    if (cb) cb(null, { stdout: '', stderr: '' });
    return undefined as any;
  })
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from('zipcontent')),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

// Mock EventSource
const mockEventSource = vi.fn();
vi.mock('eventsource', () => ({
  default: function(...args: any[]) {
    mockEventSource(...args);
    return {
      onmessage: null,
      onerror: null,
      close: vi.fn(),
    };
  }
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;
global.FormData = class FormData {
  append() {}
} as any;
global.Blob = class Blob {
  constructor() {}
} as any;

describe('CloudBuildService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.getSettingsRaw as any).mockReturnValue({
      gatewayUrl: 'https://api.test.com',
      sessionToken: 'test-token',
    });
    (db.getSettings as any).mockResolvedValue({
      gatewayUrl: 'https://api.test.com',
      sessionToken: 'test-token',
    });
  });

  it('throws if no session token', async () => {
    (db.getSettings as any).mockResolvedValue({});
    await expect(cloudBuildService.startBuild('/tmp', 'flutter', 'both')).rejects.toThrow(/Not authenticated/);
  });

  it('startBuild zips and uploads successfully', async () => {
    (fs.readFile as any).mockResolvedValue(Buffer.from('zipcontent'));
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobId: 'job-123' })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'job-123', status: 'queued' })
    });

    const build = await cloudBuildService.startBuild('/tmp/project', 'flutter', 'both');
    
    expect(build.id).toBe('job-123');
    expect(mockFetch).toHaveBeenCalledTimes(2); // Upload + Get
    
    // Check upload args
    const uploadCall = mockFetch.mock.calls[0];
    expect(uploadCall[0]).toBe('https://api.test.com/api/build/upload');
    expect(uploadCall[1].method).toBe('POST');
    expect(uploadCall[1].headers).toEqual({ 'Authorization': 'Bearer test-token' });
    
    // Check get args
    const getCall = mockFetch.mock.calls[1];
    expect(getCall[0]).toBe('https://api.test.com/api/build/job-123');
    expect(getCall[1].method).toBe('GET');
  });

  it('cancelBuild calls cancel endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'job-123', status: 'cancelled' })
    });

    const build = await cloudBuildService.cancelBuild('job-123');
    expect(build.status).toBe('cancelled');
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.test.com/api/build/job-123/cancel');
    expect(mockFetch.mock.calls[0][1].method).toBe('POST');
  });

  it('startLogStream uses EventSource with auth', () => {
    const mainWindow = { webContents: { send: vi.fn() } } as any;
    cloudBuildService.startLogStream('job-123', mainWindow);
    
    expect(mockEventSource).toHaveBeenCalledWith(
      'https://api.test.com/api/build/job-123/stream',
      { headers: { Authorization: 'Bearer test-token' } }
    );
  });
});
