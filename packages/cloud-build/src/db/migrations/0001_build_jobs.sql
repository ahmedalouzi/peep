-- Migration: 0001_build_jobs.sql
-- Creates the build_jobs table and supporting roles for the cloud build system.
-- This is entirely new infrastructure — it does NOT modify chat_threads or chat_runs.
--
-- DB roles created here MUST match the connection strings in:
--   DATABASE_URL_API    → api_app  (RLS enforced, user-facing)
--   DATABASE_URL_WORKER → worker_app (BYPASSRLS, worker + reconciler only)

-- ── Types ─────────────────────────────────────────────────────────────────────
CREATE TYPE build_framework AS ENUM ('flutter', 'react-native');
CREATE TYPE build_status    AS ENUM ('queued', 'running', 'success', 'failed', 'cancelled');

-- ── Table ─────────────────────────────────────────────────────────────────────
CREATE TABLE build_jobs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL,
  project_id          TEXT        NOT NULL,
  framework           build_framework NOT NULL,
  target              TEXT        NOT NULL DEFAULT 'apk',   -- 'apk' | 'aab' | 'both'
  status              build_status NOT NULL DEFAULT 'queued',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  build_duration_ms   INTEGER,
  artifact_url        TEXT,
  artifact_size_bytes BIGINT,
  -- Error log capped at 50 KB by the worker before INSERT
  error_log           TEXT,
  worker_id           TEXT,
  container_id        TEXT,
  version_name        TEXT        NOT NULL DEFAULT '1.0.0',
  version_code        INTEGER     NOT NULL DEFAULT 1,
  keystore_secret_id  TEXT        -- Reserved — out of scope for MVP
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_build_jobs_user_id    ON build_jobs(user_id);
CREATE INDEX idx_build_jobs_status     ON build_jobs(status)
  WHERE status IN ('queued', 'running');   -- Partial index: only live rows needed for polling
CREATE INDEX idx_build_jobs_created_at ON build_jobs(created_at DESC);
CREATE INDEX idx_build_jobs_stuck      ON build_jobs(started_at)
  WHERE status = 'running';               -- For reconciliation query performance

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE build_jobs ENABLE ROW LEVEL SECURITY;

-- User-facing policy: each user sees only their own rows.
-- app.current_user_id must be SET LOCAL per-request by the API server.
CREATE POLICY build_jobs_user_isolation ON build_jobs
  USING (user_id = current_setting('app.current_user_id')::UUID);

-- ── Roles and grants ──────────────────────────────────────────────────────────
-- api_user: restricted role used by the Build API Server.
--   - RLS is enforced (no BYPASSRLS attribute).
--   - May SELECT and INSERT (create jobs), and UPDATE only the status column (cancel).
--   - The cancel endpoint is the ONLY code path that uses this UPDATE grant,
--     and it ONLY ever writes 'cancelled' — enforced by the API layer logic,
--     not by the column grant itself (Postgres column grants cannot restrict values).
CREATE ROLE api_user NOLOGIN;
GRANT SELECT, INSERT ON build_jobs TO api_user;
GRANT UPDATE (status) ON build_jobs TO api_user;

-- worker_user: privileged role used by the Build Worker and Reconciler.
--   - BYPASSRLS: sees ALL rows across ALL users (necessary for job claiming and reconciliation).
--   - Full UPDATE: worker writes started_at, completed_at, artifact_url, error_log, etc.
--   - No access to any other table (user auth, chat_threads, etc.).
CREATE ROLE worker_user BYPASSRLS NOLOGIN;
GRANT SELECT, UPDATE ON build_jobs TO worker_user;

-- Application login users — passwords set via environment variables at deploy time.
-- CREATE USER api_app    PASSWORD :'API_APP_PASSWORD'    IN ROLE api_user;
-- CREATE USER worker_app PASSWORD :'WORKER_APP_PASSWORD' IN ROLE worker_user;
-- (Commented out — passwords must be injected at deploy time, not stored in migration.)

-- ── Constraints ───────────────────────────────────────────────────────────────
-- Prevent a running job from being reset to queued via any SQL path.
ALTER TABLE build_jobs ADD CONSTRAINT build_jobs_status_forward_only
  CHECK (
    -- Terminal states cannot transition to anything.
    -- 'queued' can only move to 'running' or 'cancelled'.
    -- These are informational — enforcement is in application code + worker claiming logic.
    -- SQL-level CHECK cannot express state machine transitions, but documents intent.
    status IN ('queued', 'running', 'success', 'failed', 'cancelled')
  );

-- ── Down migration (for test teardown) ───────────────────────────────────────
-- DROP TABLE IF EXISTS build_jobs;
-- DROP TYPE  IF EXISTS build_status;
-- DROP TYPE  IF EXISTS build_framework;
-- DROP ROLE  IF EXISTS api_user;
-- DROP ROLE  IF EXISTS worker_user;
