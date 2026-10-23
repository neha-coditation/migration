-- Isolated foundation for a future authenticated hosted controller.
-- Do not expose these tables or claim functions directly to the browser.
CREATE SCHEMA IF NOT EXISTS migration_studio;

CREATE TABLE IF NOT EXISTS migration_studio.projects (
  id uuid PRIMARY KEY,
  owner_subject text NOT NULL,
  source_url text NOT NULL,
  status text NOT NULL DEFAULT 'ready',
  approval_mode text NOT NULL DEFAULT 'batch' CHECK (approval_mode IN ('batch','per-page')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS migration_studio.page_jobs (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES migration_studio.projects(id) ON DELETE CASCADE,
  route text NOT NULL,
  source_url text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','verified','needs-review','qa-blocked','failed','cancelled')),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 20),
  lease_owner text,
  lease_until timestamptz,
  external_run_id bigint,
  progress smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  stage text NOT NULL DEFAULT 'queued',
  error_message text,
  result_manifest jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, route)
);

CREATE INDEX IF NOT EXISTS migration_jobs_claim_idx
  ON migration_studio.page_jobs (created_at, id)
  WHERE status IN ('queued','running');
CREATE INDEX IF NOT EXISTS migration_jobs_project_idx
  ON migration_studio.page_jobs (project_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS migration_studio.artifacts (
  id uuid PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES migration_studio.page_jobs(id) ON DELETE CASCADE,
  object_key text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('astro-zip','source','report','screenshot','manifest','qa','other')),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Atomic claim. Expired leases can be reclaimed; terminal jobs are never rerun.
-- Only an authenticated backend service should call this function.
CREATE OR REPLACE FUNCTION migration_studio.claim_page_job(worker text, lease_seconds integer DEFAULT 900)
RETURNS SETOF migration_studio.page_jobs
LANGUAGE plpgsql
AS $$
BEGIN
  IF worker IS NULL OR length(trim(worker)) = 0 OR lease_seconds < 60 OR lease_seconds > 3600 THEN
    RAISE EXCEPTION 'Invalid worker or lease';
  END IF;
  RETURN QUERY
  WITH candidate AS (
    SELECT j.id FROM migration_studio.page_jobs j
    WHERE (j.status = 'queued' OR (j.status = 'running' AND j.lease_until < now()))
      AND j.attempt < j.max_attempts
    ORDER BY j.created_at, j.id
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE migration_studio.page_jobs j SET
    status = 'running', lease_owner = worker,
    lease_until = now() + make_interval(secs => lease_seconds),
    attempt = j.attempt + 1, updated_at = now()
  FROM candidate WHERE j.id = candidate.id
  RETURNING j.*;
END;
$$;

CREATE OR REPLACE FUNCTION migration_studio.heartbeat_page_job(job_uuid uuid, worker text, lease_seconds integer DEFAULT 900)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE changed integer;
BEGIN
  IF worker IS NULL OR length(trim(worker)) = 0 OR lease_seconds < 60 OR lease_seconds > 3600 THEN
    RETURN false;
  END IF;
  UPDATE migration_studio.page_jobs
  SET lease_until = now() + make_interval(secs => lease_seconds), updated_at = now()
  WHERE id = job_uuid AND status = 'running' AND lease_owner = worker AND lease_until > now();
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;

-- Explicitly restrict function execution; grant to the authenticated server role during deployment.
REVOKE ALL ON SCHEMA migration_studio FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA migration_studio FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION migration_studio.claim_page_job(text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION migration_studio.heartbeat_page_job(uuid, text, integer) FROM PUBLIC;
