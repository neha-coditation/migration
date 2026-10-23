# Neon deployment status — 23 October 2026

The user selected Neon for the backend and GitHub Actions in neha-coditation/migration for browser workers.

## Verified infrastructure

A separate Neon branch named migration-studio-runtime-check was created in project bitter-rain-72060505. Diagnostic Function migrationcheck was deployed. It returned HTTP 200 on Linux arm64 with Node 24.22.1. No Chromium executable was installed. Its ldconfig probe did not find libnss3, libnspr4, libatk, libatk-bridge, libX11, libxcb, libxkbcommon, libgbm or libasound. This is evidence that the current local-browser pipeline cannot be deployed unchanged, not a claim that Neon can never run a custom browser binary.

The Function is only a readiness diagnostic. It exposes no project data, database connection strings or arbitrary command execution. The temporary database endpoint used for the diagnostic was disabled after the test; the branch and Function remain. No existing production tables or live website domains were changed.

## Implemented worker stage

The Actions workflow receives a public page URL and a job UUID, installs official Playwright Chromium plus OS dependencies, runs the existing migration pipeline, executes the real Astro build and browser QA, and uploads results. Source URLs continue to use the existing public destination policy. Source-site forms are not submitted. The workflow has read-only repository contents access and does not persist checkout credentials. The local controller can dispatch a page, follow the run, download and validate its artifact and continue the existing page review workflow. It refuses mismatched artifacts and browser-QA fallback results.

## Required before the full online app can launch

1. Replace the loopback Node HTTP listener with a Neon Functions fetch-handler adapter.
2. Authenticate dashboard users and authorize every project, job and artifact request.
3. Move project/job state and transactional command claims to Postgres. The existing in-memory queue and filesystem writes are not a cloud queue.
4. Store captured resources, screenshots, intermediate revisions and ZIPs in durable object storage. Isolate evictions must not lose progress.
5. Dispatch Actions using an application-scoped GitHub integration, or have authenticated Actions workers claim durable queue entries. The local gh login cannot simply be assumed in Neon.
6. Receive authenticated worker completion callbacks, deduplicate retries and retain exact job/revision provenance.
7. Serve previews and downloads over authenticated HTTPS routes, replacing local ephemeral ports.
8. Test sign-in, discovery, migration, actual browser QA, manual review, automatic next page, restart/retry, combination and download end to end in the hosted app.

Neon Functions can be evicted; their waitUntil work is limited to 15 minutes and is explicitly not a background job runner. Migration worker jobs therefore belong in Actions, with durable queue state in Neon. Backend hosting is not complete until the eight checks above pass.

References: https://neon.com/docs/compute/functions/reference/runtime-limits and https://neon.com/docs/compute/functions/deploy.

## Executed worker verification

GitHub Actions run 39917939336 completed successfully on Ubuntu 22.04. The running app dispatched it, downloaded the artifact, validated its page identity and imported its build and browser QA evidence. The measured result was Review needed (maximum screenshot difference 8.34%, text differences, and unestablished fidelity); it was not marked verified. The first Ubuntu 24.04 attempt failed because its Chromium sandbox was unavailable; no sandbox protections were disabled. The worker runner was changed to Ubuntu 22.04 and retested successfully. Unit tests: 49 passed, including exact artifact identity, actual browser evidence, cancellation and review-to-next-page transitions. The local pipeline integration also passed its explicit browser-blocked fallback assertions; that local run is separate from the successful remote browser run.

## Neon → Actions integration (feature, not deployed)

`/api/neon/worker/{dispatch,claim,progress,complete}` accepts POST requests
with a separate service bearer token. Dashboard tokens cannot use these routes.
The Function remains disabled for workers unless `WORKER_AUTH_TOKEN_SHA256`
is set. Configure `MIGRATION_WORKER_REPOSITORY=neha-coditation/migration`,
`MIGRATION_WORKER_REF` (the reviewed feature branch or commit), and
`GITHUB_WORKER_TOKEN` with Actions write access to this repository. Never
reuse the dashboard credential. The existing Function bundle now includes the
worker handler; no database migration is needed.

On GitHub, configure `NEON_DEV_WORKER_API_URL` as the origin
`https://br-quiet-hat-b5fslf7n-migrationapi.compute.c-7.us-east-2.aws.neon.tech`
and secret `NEON_DEV_WORKER_TOKEN` matching the hash configured in the dev
Function. The client rejects other origins. Do not change production settings.
Deploying this feature is a separate operation; creating the PR does not deploy it.
The workflow must be registered on the default branch before GitHub accepts its
workflow_dispatch event; the feature ref must contain the same workflow.

POST dispatch with `{"jobId":"53038615-f229-4e45-b6a0-ea1710a368af"}`
using the worker credential only after dev configuration and deployment.
Dispatch atomically claims that specific queued or expired job with a random
lease owner and incremented attempt. GitHub receives identifiers, never secrets
or source URLs. The worker claims the authoritative source URL and binds its run
ID. Every progress/heartbeat/completion requires the live lease, exact attempt,
owner and bound run. The lease lasts 15 minutes; heartbeats renew it every minute.
Retries with a lost dispatch response wait for expiry; they never immediately
release potentially dispatched work. After max_attempts an operator must inspect
the failed/expired job; no automatic attempt reset or success is synthesized.

Completion records artifact metadata and the terminal job state in one SQL
statement. Exact terminal retries are idempotent. Conflicting or stale callbacks
return 409. Success requires actual build and browser check evidence, and an
artifact whose run, digest, size and unexpired status match GitHub's API.
Artifact keys are `github-actions/<run-id>/<artifact-id>`; Postgres metadata is
durable, but GitHub blobs expire after 90 days (repository policy may shorten
this). This is not permanent object storage. No download or preview endpoint or
cross-provider archival is supplied. Do not present expired artifacts as usable.
Failure callbacks preserve partial progress and never claim verified completion.

The supplied homepage job was observed queued at attempt 0 before development.
No dispatch, completion, dev deployment or production write was performed as part
of implementation. Hosted end-to-end verification requires the configuration above.

The dev deployment workflow accepts repository/environment secrets
`NEON_DEV_WORKER_TOKEN_SHA256`, `NEON_DEV_GITHUB_WORKER_TOKEN` and variable
`NEON_DEV_WORKER_REF` together. Partial configuration fails before deployment;
leaving all three unset keeps the worker API disabled. The dashboard and worker
hashes must differ. The Actions worker uses `NEON_DEV_WORKER_TOKEN` separately.

Run database integration tests against a disposable **local** PostgreSQL database:
`NEON_WORKER_TEST_DATABASE_URL=postgresql://localhost/test_db node --test test/neon-worker-postgres.test.mjs`.
The test rejects remote hosts and removes its own fixture rows. It checks concurrent
dispatch, run binding, expired/reclaimed leases, monotonic progress, transactional
rollback of completion when metadata insertion fails, exact retry deduplication and
terminal job protection. The standard suite skips this test unless configured.

### Validation for this feature

All 21 Neon tests passed, including the local PostgreSQL concurrency and rollback
integration test. The Function ZIP was built and inspected with `worker-api.mjs`
included. The full unit suite reported 65 passes and five failures in
`test/reviews.test.mjs`; all five were reproduced from unchanged HEAD (the tests
expect per-page default behavior while the existing implementation defaults to
batch). These existing failures were not changed in this worker feature.
`npm run test:pipeline` passed with a real Astro build and explicit HTTP fallback;
browser QA did not run because Chromium was not installed. No hosted Neon→Actions
migration or successful homepage completion is claimed by these local tests.
