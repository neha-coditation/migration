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

[Release PR #8](https://github.com/neha-coditation/migration/pull/8) is merged.
Release tag: `production-worker-20261023-v1`, commit
`3dcb304ed0795754b83e217016d3fda1df132607`.

[CI 39939134259](https://github.com/neha-coditation/migration/actions/runs/39939134259)
passed all 79 tests (including PostgreSQL fencing/rollback and five production
isolation/provenance tests) and actual browser-mode fixture QA with an Astro build.
Both development and production Function bundle checks passed.

[Deployment 39939641739](https://github.com/neha-coditation/migration/actions/runs/39939641739)
succeeded. Neon confirmed production `migrationworker` deployment 1 active and
completed. Its environment contains only the service hash, pinned worker ref and
release SHA; no development dashboard authentication configuration or persistent
personal GitHub token was deployed.

The production URL is
`https://br-proud-hall-b5rtedf4-migrationworker.compute.c-7.us-east-2.aws.neon.tech/`.
Live probes returned 401 for missing/invalid service credentials, 401 for a
machine credential requesting dashboard routes, and 503 for dispatch without the
request-scoped GitHub credential (before consuming a job attempt).

Smoke-test project: `a18d8f39-8404-4520-9666-37c13027197c`.
Smoke-test job: `ea497fd0-3dbf-4932-9baf-815e5506cf0c`.
[Production smoke run 39939785351](https://github.com/neha-coditation/migration/actions/runs/39939785351)
was created by the production endpoint with HTTP 202 on database attempt 1.
The initial Actions attempt had unusually slow Ubuntu package downloads and was
canceled before any job claim. After confirming cancellation and an unclaimed
job, the same Actions run was retried (Actions run attempt 2) without resetting
any database lease or result. The retry succeeded in 5m39s. The production endpoint
received the actual claim, run binding, progress/heartbeats and completion.

Neon records **needs-review**, progress 100, database attempt 1 and run
`39939785351`, with the lease cleared. Actual Astro build and desktop/mobile
browser QA executed. The remaining page findings are remote runtime dependencies,
fidelity regressions and interaction regressions; no verified verdict or human
approval was fabricated.

Completion atomically saved artifact ID `12496670351`, object key
`github-actions/39939785351/12496670351`, size 79,543,785 bytes, SHA-256
`13bf9861085ae6b48efe9277eb5cc76786c17db4bb333874ac337b2efe6176dd`,
release commit `3dcb304ed0795754b83e217016d3fda1df132607` and expiry
`2027-01-21T10:40:37Z`. An independent GitHub API read matched all metadata to the
production record. The production worker release is ready with evidence for this
machine-service scope. No migrated website was published or cut over.

The requested push and production smoke test are complete. Resume page-quality
work later using this run's artifact; no follow-up monitor was scheduled.

Development evidence remains in NEON-DEPLOYMENT.md.
