# Migration Studio 0.5 — Stage 1 delivery

23 October 2026

Local app: http://127.0.0.1:4364/

## Implemented

- The main project workflow no longer stops at 100 selected pages, 500 discovered pages or five sitemap files.
- Select all pages, filter selection and selected-only view are available. Every captured page remains a separate job.
- Public navigation and reachable same-origin sitemap indexes are inspected. Cycles are deduplicated, malformed links skipped, failed sitemap requests recorded, and discovery can be stopped.
- Migration pauses after every page by default. Batch processing remains optional, with individual review required before a new combination.
- Each completed page exposes Review & approve: approve, reject or explicitly accept a draft with a written reason.
- Approval requires a genuinely verified report, passed build and executed browser checks; a cached status label cannot override blocked evidence.
- Draft acceptance never changes the underlying QA verdict. A combined artifact containing a draft exception remains a draft.
- Reviews include job ID, timestamp, reason and a fingerprint covering captured markup, reports, resource map, captured assets, generated public files and generator/dependency version inputs.
- New combinations require current reviews for every included page. Changed input or generator state invalidates the review check. Review provenance is included in the combined QA report.
- Continue resumes the saved paused queue after a review is accepted. Repairing the paused page preserves remaining routes and invalidates its old review. Failed pages can be retried.
- Stop preserves completed jobs/reviews and cancels the remaining paused queue. Paused state and saved reviews survive reloading the service.
- Conflicting review/resume/combine requests are protected by a per-project operation lock.
- Existing previously generated combined ZIPs and the existing staging deployment are preserved. No new GitHub publication or production change was made in this stage.

## Automated validation

42 unit/regression tests passed. New coverage includes:

- 1,500 selected routes without the former selection cap.
- 701 discovered routes through seven child sitemaps, beyond both former discovery limits, including a cyclic index reference.
- Default pause after one page, blocked continuation before approval, and blocked normal approval when browser QA did not run.
- A meaningful reason required for draft acceptance; the QA result stays blocked.
- No combination while a paused queue remains unfinished.
- Current-job matching, resource mutation invalidation and conflicting review requests.
- Preservation of pending routes when the paused page is repaired.
- Stop/cancel behavior and persisted review/queue state after service reload.
- Existing resource transformation, illustration, motion, dependency, source-control and staging guards.

The actual two-page Astro pipeline integration passed its build, archive, resource and route checks. The browser process could not launch in the restricted command environment, so the test explicitly asserted HTTP fallback and needs-review, not successful browser QA.

The combination integration passed after requiring explicit fixture reviews. It checks combined review provenance, retained blocked QA status, all selected routes/404, assets, source ZIP, preview reuse and a repository-base build.

Deployment-base and local-Git staging integrations also passed. These tests do not claim new live staging publication in this stage.

Commands used for verification:

```
npm test
npm run test:pipeline
node test/combined.mjs
node test/deployment.mjs
node test/staging.mjs
node --check public/projects.js
node --check server/projects.mjs
node --check server/reviews.mjs
node --check server/index.mjs
```

## Browser validation

A separate fixture data directory and local test instance were used; the user's real page approvals were not changed.

- Normal approval of a browser-QA-blocked fixture was rejected with an actionable error.
- Explicit draft acceptance with a written reason was saved.
- Continue became enabled, while combining the unfinished queue stayed disabled.
- Browser QA blocked remained visible after acceptance.
- The saved review survived page refresh.
- The real app exposes Select all pages, pause-after-each-page enabled by default and per-page review panels. New combination is disabled until the included pages are reviewed.

The temporary fixture browser/server were closed. The updated real app remains available on port 4364.

## Not yet implemented

This stage does not implement a universal in-app patch editor, automatic diagnosis/repair of every issue, complete backend/form migration, private CMS access, analytics preservation or all-platform compatibility. It does not remove physical memory/disk/request/per-resource/archive budgets. Discovery is not yet a full authenticated, query-aware link crawl. The project workflow has no fixed page-count cap; it is not an infinite-capacity engine.

The app still needs reliable automated browser-worker execution before claiming full visual/interaction verification. The new review controls do not solve that environment blocker or convert a human draft exception into test evidence.

Read Migration-App-Accuracy-Implementation-Plan.md for the ten stages, planned functions, component/integration coverage, exit criteria and later audit/fix phase. Stage 2 establishes execution/baselines; Stage 3 provides the requested in-app issue → patch → apply → retest → undo workflow.
