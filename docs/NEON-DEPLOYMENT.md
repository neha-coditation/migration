# Neon development worker integration — 23 October 2026

This records the development rollout. The later, separately authorized production worker-only release is documented in [PRODUCTION-WORKER.md](PRODUCTION-WORKER.md).

The development API and Actions worker are connected for
`neha-coditation/migration`. All operations described below target Neon project
`bitter-rain-72060505`, development branch `br-quiet-hat-b5fslf7n`.
No production deployment, production database write, DNS change or source-site
form submission was performed.

## Delivered behavior

- Authenticated project creation, ownership-scoped reads and durable page jobs.
- Separate worker service authentication for dispatch, claim, progress and completion.
- Atomic targeted dispatch claims with random lease owner and incremented attempt.
- Worker run binding and fencing by job, owner, attempt, run ID and live lease.
- Monotonic progress and one-minute heartbeats that preserve the current stage.
- Real Astro build and Chromium QA in Actions; browser fallback cannot be accepted
  as successful worker completion.
- Atomic completion and durable artifact metadata writes; exact terminal retries
  are idempotent, and stale or conflicting callbacks return 409.
- Artifact run, job/attempt name, digest, size and expiry verification against GitHub.
- Per-page local review is again the default. Explicit batch requests still run
  sequentially without pausing, and draft exceptions never upgrade QA evidence.

## Executed validation

Implementation PR: [#6](https://github.com/neha-coditation/migration/pull/6), merged
as `ed500c6fe0e4a05ed5ccb7b06166b724dd098a82`.

[Integration CI 39936623168](https://github.com/neha-coditation/migration/actions/runs/39936623168)
passed all **74 tests**, with zero failures or skips. Its disposable PostgreSQL
service exercised concurrent dispatch, run binding, expired/reclaimed leases,
monotonic progress, transaction rollback when artifact insertion fails, exact
completion retries and terminal-job protection. The same CI ran the controlled
two-page fixture through actual Chromium capture, Astro build and browser QA,
and explicitly asserted browser-mode evidence. The Function build check passed.

The full local suite passed 73 tests with zero failures; its one PostgreSQL test
was skipped without the database URL. Local pipeline verification performed an
actual Astro build and passed explicit HTTP-fallback assertions. Chromium was not
installed locally. These local fallback results are separate from CI's executed
browser pipeline.

The five previous review tests now pass: the service default was corrected from
batch to the documented per-page behavior, while preserving explicit batch mode.

[Development deployment 39937026712](https://github.com/neha-coditation/migration/actions/runs/39937026712)
succeeded through the existing main-only workflow. Neon confirmed completed,
active Function deployment **4**. No persistent personal GitHub token is stored
in that Function. Live authentication probes returned 401 for missing/invalid
bearer tokens, and 503 for a worker-authenticated dispatch with no GitHub
credential; that rejection occurs before consuming an attempt.

### Homepage end-to-end run

Application project: `b4b1ade3-b65d-4ac5-b2d1-039de4ccdcda`.
Job: `53038615-f229-4e45-b6a0-ea1710a368af`.

The authenticated dev dispatch returned 202 for attempt 1 and created
[Actions run 39937157018](https://github.com/neha-coditation/migration/actions/runs/39937157018).
The run completed successfully in 5m52s. Neon recorded progress through capture,
QA and packaging, then atomically saved **needs-review**, progress 100, run ID,
attempt 1 and artifact metadata, and cleared the lease. The downloaded evidence
independently confirms browser capture, actual Astro build and desktop/mobile QA
for one page with 389 resources. Maximum screenshot difference was **4.15%**.

The result remains needs-review because remote runtime dependencies remain and
fidelity/interaction regressions were observed. Some animation/control evidence
was not established. Twenty other discovered routes were outside this homepage
job's one-page budget. These are page-quality findings, not a failed worker
integration, and no verified page result or human approval was fabricated.

Artifact `12494237715` has object key
`github-actions/39937157018/12494237715`, size **78,883,091 bytes**, SHA-256
`ddfe434b1062fac331b4bb7a8529e001b7974c134fa81266a3549a26258b500a`,
and expires `2027-01-21T10:10:06Z`. An independent GitHub API read matched every
one of these values and the merged source commit to the saved Neon record.
The downloadable migration ZIP was also retrieved and its contents verified.

## Development configuration

The Function origin is
`https://br-quiet-hat-b5fslf7n-migrationapi.compute.c-7.us-east-2.aws.neon.tech`.
The worker client rejects other origins. The Function's `DATABASE_URL` is injected
by Neon for the selected branch and never sent to a browser or callback response.

The existing `neon-deploy-dev.yml` retains its main-branch guard and fixed dev
branch target. It reads these GitHub secrets/settings:

| Setting | Purpose |
| --- | --- |
| `NEON_API_KEY` | Existing Neon deployment credential |
| `NEON_DEV_AUTH_TOKEN_SHA256` | Dashboard development bearer hash |
| `NEON_DEV_AUTH_SUBJECT` | Development dashboard identity |
| `NEON_DEV_WORKER_TOKEN_SHA256` | Separate worker service bearer hash |
| `NEON_DEV_WORKER_TOKEN` | Worker bearer, supplied only to worker/callback steps |
| `NEON_DEV_WORKER_REF` variable | Worker source ref, currently `main` |
| `NEON_DEV_WORKER_API_URL` variable | Exact development Function origin |

Worker hash and source ref must be configured together, and the dashboard and
worker hashes must differ. With both worker settings unset, the API remains
worker-disabled. The repository is fixed to `neha-coditation/migration` in the
deployment environment serializer.

## Request and credential contract

`POST /api/neon/worker/dispatch` accepts `{"jobId":"<job UUID>"}` with the worker
bearer. With no optional `GITHUB_WORKER_TOKEN` configured in the Function, supply
`X-GitHub-Token` with a request-scoped credential authorized to dispatch Actions
in this repository. It is used for that request only, never persisted in Postgres
or returned in JSON. No credential is sent as a workflow input.

The workflow receives job ID, lease owner and attempt. Its claim obtains the
authoritative source URL and binds the actual `GITHUB_RUN_ID`. Every later
progress or completion request must match that fence and a live lease.

`POST /api/neon/worker/{claim,progress,complete}` uses the worker bearer plus job
ID, lease owner, attempt and run ID in the JSON body. Completion forwards the
workflow's short-lived, Actions-read `GITHUB_TOKEN` in `X-GitHub-Token` solely to
verify uploaded artifact metadata. Progress and claim do not forward that token.
An optional stored integration token is supported for installations that already
have one, but this dev deployment does not require or store one.

The lease lasts 15 minutes, renewed every minute during migration. Ambiguous
GitHub dispatch failures retain the lease: never immediately release and repeat
an operation GitHub may have accepted. An expired job may be reclaimed up to
`max_attempts`; exhausted attempts require operator inspection. Terminal jobs are
never silently reset or rerun. A failed run never becomes verified automatically.

## Artifact durability and remaining hosted-app scope

Artifact keys are `github-actions/<run-id>/<artifact-id>`. Postgres retains the
artifact identity, SHA-256, byte size and job linkage, plus repository/expiry and
run/attempt provenance in the result manifest. Job completion and metadata
insertion are one SQL statement, so a metadata failure cannot leave a completed
job without its artifact record.

Actions artifact blobs have 90-day retention (repository policy can shorten it).
This is durable metadata with explicitly expiring evidence, not permanent object
storage. Do not present expired artifacts as downloadable. Worker evidence and
migration output are available from the authenticated GitHub Actions run.

This delivers the requested Neon-to-Actions worker integration. A complete hosted
dashboard with multi-user identity-provider login, authenticated preview/download
routes, permanent object archival, hosted discovery/review/combination and an
end-to-end dashboard journey remains separate product work. The loopback local
controller is not exposed publicly by this integration.

## Re-run database tests safely

Use a disposable local PostgreSQL database:

```sh
NEON_WORKER_TEST_DATABASE_URL=postgresql://localhost/test_db node --test test/neon-worker-postgres.test.mjs
```

The integration test rejects remote hosts and removes only its fixture rows.
The normal suite skips it without the explicit URL; PR CI supplies a disposable
PostgreSQL service and runs it with the entire suite.

## Earlier runtime evidence

The separate `migration-studio-runtime-check` branch and `migrationcheck`
Function were diagnostics. They showed Node 24 on Linux arm64 without the browser
and required OS libraries. They were not the hosted application. Earlier
standalone worker run 39917939336 did execute browser QA and returned needs-review
(maximum screenshot difference 8.34%); it did not establish homepage verification
for this new durable job. The current job has its own run and artifact provenance.
