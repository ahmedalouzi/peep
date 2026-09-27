// packages/cloud-build/src/index.ts
// Public API surface for the cloud-build package.
// Only exports what the API server and worker entry points need.
// Internal implementation details (docker-runner, job-store internals) are
// not re-exported — consumers use the high-level functions below.

export type {
  CloudBuildJob,
  CloudBuildFramework,
  CloudBuildStatus,
  CloudBuildTarget,
} from './types';

export type {
  CreateJobOptions,
  CompleteJobOptions,
  BuildJobRow,
} from './types.js';

// Job store — API layer (use with apiPool)
export {
  createJob,
  cancelJob,
  getJob,
  listJobs,
  initBuildSchema,
  dropBuildSchema,
} from './job-store.js';

// Job store — Worker layer (use with workerPool / BYPASSRLS)
export {
  claimNextJob,
  completeJob,
  failJob,
  isJobCancelled,
  findOrphanedJobs,
  markOrphanedJobsFailed,
} from './job-store.js';

// Framework dispatch (pure, no I/O except detectFramework)
export {
  getBuildCommands,
  getArtifactPaths,
  detectFramework,
  validateFramework,
} from './framework-dispatch.js';

// Reconciler (run on API server with workerPool)
export {
  reconcileOrphanedJobs,
  startReconciler,
  BUILD_TIMEOUT_MS,
  GRACE_PERIOD_MS,
  RECONCILER_INTERVAL,
} from './reconciler.js';

// Network setup (run once on worker host, requires root)
export {
  setupBuildNetwork,
  generateDnsmasqConfig,
  writeDnsmasqConfig,
  getDnsmasqConfigForAudit,
  ALLOWLISTED_FQDNS,
  BUILD_NETWORK,
  IPSET_NAME,
  RESOLVER_IP,
} from './network-setup.js';

// Worker
export { startWorker } from './worker.js';
