# Single-session migration worker and graceful finish

## Behavior

When `MIGRATION_WORKER_REPOSITORY` is configured and batch review is selected, the local project controller dispatches **one** `migration-session-worker.yml` GitHub Actions run containing the ordered selected URLs. Browser dependencies install once per run; each page retains a separate capture, Astro build, browser QA and report.

On completing a page, the worker uploads an artifact named `migration-session-<session-id>-page-<index>` containing that page's `migration.zip`, `report.json` and an updated session checkpoint. The controller reads these artifacts, validates report identity/QA, and imports them into the original project. A page is only marked complete **after** its durable artifact upload succeeds. Reports with browser QA not executed are rejected, never marked verified.

The button **Finish migration** dispatches the lightweight `migration-session-control.yml` workflow scoped to the current session and Actions run ID. The worker checks for this finish signal only between pages; it does not kill an active page. The controller assembles an Astro draft ZIP from the completed selected pages and marks open QA/review correctly. **Stop immediately** remains a separate destructive-to-the-active-page action; already completed page artifacts are preserved.

After interruption, the controller retains page statuses and lets the user resume. The resume workflow can download prior page artifacts, restore their validated checkpoint manifest and skip already completed pages. No fixed 20-page selection cap is imposed by the local controller. GitHub Actions still enforces its job duration, dispatch-input sizes, artifact retention, and storage quotas; the workflow uses a 350-minute job deadline and a 7-day artifact retention window. If a page does not finish before a runner timeout, that page (not completed pages) may need to be repeated.

## Safety and limitations

- Existing manual per-page approval retains the per-page worker path so user review can pause outside a single Actions run. Batch mode is the single-session path.
- The GitHub worker is run only against public approved source pages and uses the existing source URL policy.
- GitHub checkpoint artifacts are retained for seven days. These are durable across runner eviction within that window, not indefinite object storage. Export the ZIPs or connect long-term storage before relying on multi-week sessions.
- Browser QA evidence and draft/verified statuses are never silently upgraded when files are combined.
- Control signals are issued via a small GitHub Actions dispatch, not unverified shared mutable repository variables.
- The locally bound project controller still requires a running local backend to ingest remote artifacts automatically. The separately deployed Neon API queue is not yet this same project controller.
- The hosted `chatgpt.site` testing URL has **not** been proven to serve this repository or branch. Deployment there requires confirming its source and publishing the tested application.

## Verification

Run `npm test`; the regression suite includes artifact-first checkpoints, resume without re-running completed pages, failed checkpoint handling, one workflow dispatch/validated ZIP import, and graceful Finish on the project controller.

The `migration-session-smoke.yml` workflow is designed to run once when merged into main. It migrates two public Coditation routes inside one runner, running real Astro build and browser QA, with page artifacts uploaded separately. Review its logs and artifacts before declaring the multi-page integration production ready.
