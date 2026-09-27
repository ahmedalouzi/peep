// packages/cloud-build/src/types.ts
// Re-exports CloudBuild types from @peep/shared and defines internal worker types.
// No types from the local Electron build system (BuildRecord, BuildStatus) are imported here.

export type { 
  CloudBuildFramework, 
  CloudBuildStatus, 
  CloudBuildTarget, 
  CloudBuildJob 
} from '@peep/shared';

// ── Internal types (not exposed to renderer/IPC layer) ───────────────────────

/** Row as returned from Postgres — snake_case keys before camelCase mapping. */
export interface BuildJobRow {
  id: string;
  user_id: string;
  project_id: string;
  framework: 'flutter' | 'react-native';
  target: string;
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled';
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  build_duration_ms: number | null;
  artifact_url: string | null;
  artifact_size_bytes: string | null;  // Postgres BIGINT comes back as string
  error_log: string | null;
  worker_id: string | null;
  container_id: string | null;
  version_name: string;
  version_code: number;
  keystore_secret_id: string | null;
}

/** Options passed to the job store when creating a new job. */
export interface CreateJobOptions {
  userId: string;
  projectId: string;
  framework: 'flutter' | 'react-native';
  target: 'apk' | 'aab' | 'both';
  versionName: string;
  versionCode: number;
}

/** Result of a job claim operation. Null if no queued job is available. */
export type ClaimResult = BuildJobRow | null;

/** Options for completing a successful build. */
export interface CompleteJobOptions {
  artifactUrl: string;
  artifactSizeBytes: number;
}

/** Docker container run configuration. */
export interface ContainerRunConfig {
  jobId: string;
  framework: 'flutter' | 'react-native';
  target: 'apk' | 'aab' | 'both';
  versionName: string;
  versionCode: number;
  sourceTarPath: string;      // Host path to gzipped project source tarball
  outputDir: string;          // Host path to write extracted artifact(s)
  label: string;              // Docker label for reaper identification
}

/** Result of a container execution. */
export interface ContainerResult {
  exitCode: number;
  logs: string;               // Combined stdout + stderr, capped at 50 KB
  containerId: string;
}
