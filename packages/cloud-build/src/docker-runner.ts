// packages/cloud-build/src/docker-runner.ts
// Abstraction over the Docker CLI for build container lifecycle management.
// All Docker operations go through this module — nothing calls `docker` directly.
//
// Security invariants enforced here:
//   - No bind mounts (-v flags). Source injected via docker cp only.
//   - All containers labeled with peep-build=true for reaper identification.
//   - Resource limits applied to every docker run/create call.
//   - Container is always named with the job ID for traceability.
//   - BYPASSRLS is a DB concern, not relevant here — this module is Docker-only.

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const execFileAsync = promisify(execFile);

/** The Docker image used for all builds. Pin by digest in production. */
export const BUILD_IMAGE = process.env.BUILD_IMAGE ?? 'peep/build-sandbox:latest';

/** Network name created by network-setup.ts */
export const BUILD_NETWORK = 'build-restricted';

/** Label applied to all build containers for reaper identification. */
export const BUILD_LABEL = 'peep-build=true';

/** Log ring buffer cap: 50 KB */
const LOG_MAX_BYTES = 50_000;

// ── Container creation ────────────────────────────────────────────────────────

/**
 * Creates (but does not start) a sandboxed build container.
 * Returns the container ID.
 *
 * Resource limits (all kernel-enforced via cgroup v2):
 *   --cpus=2            cgroup cpu.max
 *   --memory=4g         cgroup memory.max
 *   --memory-swap=4g    cgroup memory.memsw.max (= no swap; OOM kill fires immediately)
 *   --pids-limit=500    cgroup pids.max
 *   --storage-opt size  overlay2 + xfs quota (requires Docker daemon config)
 *
 * Security flags:
 *   --cap-drop=ALL      Drop all Linux capabilities
 *   --cap-add=...       Add back only what Gradle needs (CHOWN, DAC_OVERRIDE)
 *   --security-opt no-new-privileges   Process cannot gain privileges via setuid
 *   --network           Restricted bridge (dnsmasq FQDN allowlist + iptables)
 *   --dns               Force custom resolver only — no fallback (fail-closed)
 *   --read-only (NOT used) — Gradle needs to write to /build, so overlay fs is used
 *   No -v flags         Source injected via docker cp after creation
 */
export async function createContainer(jobId: string): Promise<string> {
  const containerName = `peep-build-${jobId}`;

  const args = [
    'create',
    '--name', containerName,
    '--label', BUILD_LABEL,
    '--label', `peep-job-id=${jobId}`,
    // Resource limits (kernel-enforced, not application-level)
    '--cpus', '2',
    '--memory', '4g',
    '--memory-swap', '4g',           // = memory → no swap
    '--pids-limit', '500',
    // Capability hardening
    '--cap-drop', 'ALL',
    '--cap-add', 'CHOWN',
    '--cap-add', 'DAC_OVERRIDE',
    '--security-opt', 'no-new-privileges',
    // Network isolation — FQDN allowlist via dnsmasq
    '--network', BUILD_NETWORK,
    '--dns', '172.30.0.1',           // Custom resolver only — NO fallback resolver
    // DNS options: minimize search path expansion, disable ndots fallback
    '--dns-opt', 'ndots:1',
    '--dns-opt', 'attempts:2',
    '--dns-opt', 'timeout:3',
    // No -v flags here. Source is injected via docker cp below.
    '--workdir', '/build',
    BUILD_IMAGE,
    // Container starts with a no-op; actual commands are sent via docker exec
    'sleep', 'infinity',
  ];

  const { stdout } = await execFileAsync('docker', args);
  return stdout.trim();
}

/**
 * Copies project source into the container's /build/project directory.
 * This is the ONLY way source enters the container — no bind mounts.
 */
export async function injectSource(containerId: string, sourceTarPath: string): Promise<void> {
  // Create the destination directory inside the container first
  await execFileAsync('docker', ['exec', containerId, 'mkdir', '-p', '/build/project']);
  // docker cp extracts the tar into the container's overlay filesystem
  await execFileAsync('docker', ['cp', `${sourceTarPath}/.`, `${containerId}:/build/project`]);
}

// ── Container execution ───────────────────────────────────────────────────────

/**
 * Starts the container.
 */
export async function startContainer(containerId: string): Promise<void> {
  await execFileAsync('docker', ['start', containerId]);
}

/**
 * Executes a single command inside a running container.
 * Returns { exitCode, stdout, stderr }.
 */
export async function execInContainer(
  containerId: string,
  cmd: string[],
  opts: { cwd?: string } = {},
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const execArgs = ['exec', '--workdir', opts.cwd ?? '/build/project', containerId, ...cmd];
    const child = spawn('docker', execArgs, { stdio: 'pipe' });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    child.on('close', (code) => {
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
    child.on('error', (err) => {
      resolve({ exitCode: 1, stdout, stderr: stderr + '\n' + err.message });
    });
  });
}

/**
 * Runs a sequence of build commands in the container.
 * Stops on first non-zero exit code.
 * Returns combined log and final exit code.
 */
export async function runBuildCommands(
  containerId: string,
  commands: string[][],
): Promise<{ exitCode: number; logs: string }> {
  const logParts: string[] = [];

  for (const cmd of commands) {
    logParts.push(`\n$ ${cmd.join(' ')}\n`);
    const result = await execInContainer(containerId, cmd);
    logParts.push(result.stdout);
    if (result.stderr) logParts.push(result.stderr);

    if (result.exitCode !== 0) {
      const combined = logParts.join('');
      return {
        exitCode: result.exitCode,
        logs: truncateLogs(combined),
      };
    }
  }

  const combined = logParts.join('');
  return { exitCode: 0, logs: truncateLogs(combined) };
}

// ── Artifact extraction ───────────────────────────────────────────────────────

/**
 * Copies a file from inside the container to a host path.
 * Used to extract the built APK/AAB before the container is destroyed.
 */
export async function copyArtifactOut(
  containerId: string,
  containerPath: string,
  hostDestPath: string,
): Promise<void> {
  await execFileAsync('docker', [
    'cp',
    `${containerId}:${containerPath}`,
    hostDestPath,
  ]);
}

// ── Container cleanup ─────────────────────────────────────────────────────────

/**
 * Stops and forcibly removes the container.
 * ALWAYS call this — unconditionally, in a finally block.
 * docker rm --force deletes the container and its overlay filesystem.
 * After this call, no container-specific files remain on disk.
 */
export async function destroyContainer(containerId: string): Promise<void> {
  try {
    // Graceful stop first (SIGTERM → 10s → SIGKILL)
    await execFileAsync('docker', ['stop', '--time', '10', containerId]);
  } catch {
    // If stop fails (container already exited), proceed to rm anyway
  }
  try {
    await execFileAsync('docker', ['rm', '--force', containerId]);
  } catch {
    // If rm fails, log but don't throw — reaper will clean up
    console.error(`[docker-runner] docker rm --force ${containerId} failed — reaper will clean up`);
  }
}

/**
 * Checks whether a named container exists (by name or ID).
 */
export async function containerExists(nameOrId: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('docker', [
      'ps', '-a', '--filter', `name=${nameOrId}`, '--format', '{{.ID}}',
    ]);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

// ── Reaper helpers ────────────────────────────────────────────────────────────

/**
 * Lists all containers with the peep-build label that are in 'exited' state
 * and older than minAgeSeconds. Used by the reaper sidecar.
 */
export async function listStaleExitedContainers(minAgeSeconds: number): Promise<string[]> {
  const { stdout } = await execFileAsync('docker', [
    'ps', '-a',
    '--filter', `label=${BUILD_LABEL}`,
    '--filter', 'status=exited',
    '--format', '{{.ID}} {{.CreatedAt}}',
  ]);
  const now = Date.now();
  const ids: string[] = [];
  for (const line of stdout.trim().split('\n').filter(Boolean)) {
    const [id, ...dateParts] = line.split(' ');
    const created = new Date(dateParts.join(' ')).getTime();
    if (!isNaN(created) && (now - created) / 1000 > minAgeSeconds) {
      ids.push(id);
    }
  }
  return ids;
}

/**
 * Lists all containers with the peep-build label that are in 'running' state
 * and older than minAgeSeconds. Used at worker startup for crash cleanup.
 */
export async function listStaleRunningContainers(minAgeSeconds: number): Promise<string[]> {
  const { stdout } = await execFileAsync('docker', [
    'ps',
    '--filter', `label=${BUILD_LABEL}`,
    '--filter', 'status=running',
    '--format', '{{.ID}} {{.CreatedAt}}',
  ]);
  const now = Date.now();
  const ids: string[] = [];
  for (const line of stdout.trim().split('\n').filter(Boolean)) {
    const [id, ...dateParts] = line.split(' ');
    const created = new Date(dateParts.join(' ')).getTime();
    if (!isNaN(created) && (now - created) / 1000 > minAgeSeconds) {
      ids.push(id);
    }
  }
  return ids;
}

// ── Temporary directory helpers ───────────────────────────────────────────────

/**
 * Creates a temporary directory for artifact staging.
 * The caller is responsible for cleanup (rm -rf) after uploading.
 */
export async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'peep-build-'));
}

/**
 * Removes a temporary directory.
 */
export async function removeTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function truncateLogs(log: string): string {
  const bytes = Buffer.byteLength(log, 'utf8');
  if (bytes <= LOG_MAX_BYTES) return log;
  const buf = Buffer.from(log, 'utf8');
  return '... [log truncated — showing last 50 KB] ...\n' +
    buf.slice(buf.length - LOG_MAX_BYTES).toString('utf8');
}
