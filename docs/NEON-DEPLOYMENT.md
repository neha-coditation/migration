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
