# Production worker service release

Scope: the authenticated machine-to-machine worker service only. This release
does not publish the migrated website, expose the local dashboard, enable
production human dashboard login, or approve page QA.

## Target and isolation

- Neon project: `bitter-rain-72060505`.
- Production branch: `br-proud-hall-b5rtedf4` (confirmed branch name `production`).
- New Function: `migrationworker`; no existing Function is replaced.
- Only new `migration_studio` schema objects are installed using
  `server/neon/001_durable_queue.sql`. Existing `public.MigrationCredential` and
  `neon_auth` objects are not changed.
- Dashboard/project HTTP routes always deny authentication. Only worker routes
  accept the distinct production machine bearer token.
- Production callbacks require the explicit production client profile and exact
  production Function origin. Dev endpoints and credentials remain separate.

## Release procedure

1. Pass the feature PR's complete unit/database suite, actual browser pipeline
   and Function build checks; merge through the feature PR.
2. Create a unique `production-worker-*` tag at that tested merge commit.
3. In the `neon-production` GitHub environment, configure
   `NEON_PROD_WORKER_TOKEN` and its SHA-256 in `NEON_PROD_WORKER_TOKEN_SHA256`.
   Never reuse the dev credential. The existing repository `NEON_API_KEY` is used
   only by the fixed-target deployment workflow.
4. Apply the additive queue schema to the explicitly selected production branch.
5. Dispatch `neon-deploy-production.yml` on main with that release tag. Its
   main-only guard remains mandatory. The bundle uses the production worker-only
   entry; no dev dashboard authentication configuration is included.
6. Confirm Neon marks the Function deployment active/completed. Probe missing
   and wrong bearer credentials (401), machine access to dashboard routes (401),
   and dispatch with no GitHub credential (503 without claiming any job).
7. Create a new, clearly identified smoke-test project/job and dispatch it using
   the production service credential and a request-scoped GitHub credential.
   Observe run binding, live progress/heartbeat, actual build/browser QA, uploaded
   artifact and atomic terminal metadata. Preserve the real QA verdict.

The worker dispatches the pinned release tag. Artifact verification also requires
that exact release commit. The Function never persists a personal GitHub token;
completion uses the workflow's short-lived Actions-read token.

## Rollback and stop behavior

This is an additive first worker release. To stop admission, disable the
`neon-production-page-worker.yml` workflow and rotate the production worker
credential; do not drop tables or rewrite job results. Running leases expire if
heartbeats stop. For later upgrades, retain the previously tested release tag and
deploy its worker-only bundle and matching ref/hash through the same main-only
workflow. Existing `public`/`neon_auth` data is outside this service's SQL paths.

Artifacts retain the documented 90-day expiry; Postgres metadata persists. The
smoke-test page may correctly finish needs-review even when the worker service
and callback path succeed. No human approval or verified result is fabricated.

## Evidence

Production deployment and smoke-test results are recorded after execution in the
release verification artifact. Development evidence remains in NEON-DEPLOYMENT.md.
