# Migration Studio 0.4 — delivery and QA report

Updated 23 October 2026. This is an extension of the separate local app.

## Delivered

- Local app: http://127.0.0.1:4364/
- Staging: https://neha-coditation.github.io/Website-migration/
- Deployment: https://github.com/neha-coditation/Website-migration/actions/runs/39905518708
- Repository: neha-coditation/Website-migration
- New staging branch: astro-staging/d4082c39-mvkix7wc
- Deployed commit: c71f04e6a908c1ce67c2424af5940cdbd8b3affb
- App download: Astro-Migration-Studio-v0.4.zip
- Combined Astro source: Coditation-Three-Page-Astro-Draft.zip

The production website and custom domain were not changed. The staging deployment succeeded. Only three selected routes were staged; this is not the entire Coditation website.

## Page-by-page workflow

1. Enter a public website URL and click Find pages.
2. The app reads navigation links and public sitemaps, discovering up to 500 routes. Add any missing same-origin path yourself.
3. Select up to 100 pages per batch. Use Selected pages only to inspect your selection.
4. Migrate selected pages one at a time. Every page gets its own job, build, report and QA status. Completed results persist across restarts.
5. Open page & QA to read measured results. Repair & recheck reruns that page independently.
6. Select completed pages and combine them. The app creates one Astro app, rewrites links between selected routes, deduplicates shared binary assets, preserves page-specific script/style/data variants, builds and rechecks routes and assets.
7. Download the combined ZIP. Individual full evidence remains in each page job download.

## QA and automatic repair

The visual checkpoint target is selectable: 0%, 0.1% or 2% differing pixels. The app includes per-target animation and illustration evidence, scroll checks, selected filter state/results, navigation, sliders, load more and sticky measurements where source behavior is supported and observable.

The repair loop is bounded to three additional passes per page. It restores supported exact captured illustration assets from evidence, rebuilds and reruns QA. Known Coditation recipes also restore particles, selected filter ticks, sticky overflow, testimonial geometry and collection behavior. Unsupported mismatches remain open; this is not a general AI code-writing repair agent. A public URL and a passing build cannot guarantee every animation, interaction or visual aspect matches.

**The automated browser process could not launch in the Codex command environment.** The three real test migrations therefore used HTTP fallback and explicitly show Browser QA blocked. Their builds passed, but complete automated source-versus-output screenshots and animation/interaction approval did not run. No page was marked verified. Run the app in a normal local terminal, complete browser setup, then Repair & recheck each page to attempt full browser QA. See the setup message if Chromium still cannot launch.

## Real conversion exercised

The app discovered 212 Coditation pages, then migrated these sequentially:

- /
- /industries/healthcare-life-sciences
- /resources/blogs

All three Astro builds passed. The combined build contains 1,297 per-page cached resource mappings, 1,265 distinct output asset files and 43,205,431 bytes of cached assets. The combined static audit reports zero missing local resources, zero unexpected UI controls and zero static remote resource references. Links to unselected pages remain source-site links and are listed in the report. Static resource checks do not prove absence of all dynamically generated remote requests.

All three staged routes returned HTTP 200. An unknown staged route returned HTTP 404. The GitHub Actions run completed successfully.

## Manual browser checks performed

These spot checks supplement, but do not replace, a complete automated fidelity comparison:

- Combined blogs page: correct main heading; zero added search fields; zero broken visible images; 167 recovered list records; 15 initially visible and 30 after View More.
- Combined healthcare page: Finance checkbox checked; selected border/tint and tick image present; Finance chip correct; seven matching results.
- Deployed homepage: correct heading; zero broken visible images; five particle counters observed advancing; exactly one compatibility guard and a per-page resource map; captured cross-page links stay under /Website-migration/.
- Deployed blogs: View More increases visible records to 30; no added search field; zero broken visible images.
- Deployed healthcare: Finance chip and seven matching results work under the repository base path.
- Dashboard: selected-page view, individual QA links, combined source download and deployment status exercised. No horizontal document overflow at 390px and 1280px widths.

Full entrance animation timing, every slider/sticky state, WebGL/globe parity, all CMS detail routes, all mobile states and every hidden interaction have not been approved by these checks.

## Defects fixed during implementation

- Rewriting an already local globe-data URL could turn it back into a source-domain URL. Local migrated references now remain local through repeated transforms.
- Recovered CMS card links were falsely reported as extra controls and missing assets. CMS card anchors are now treated as content, while genuinely added UI controls stay separate findings.
- Blog collection recovery stopped after eight extra pages. The bounded pagination limit is now fifty, with content/link-based deduplication.
- Selected filter chips could retain the template text Report. The local adapter now uses the existing tag template to show and remove the actual selected value.
- Department controls now support keyboard activation.
- Remote prerender/prefetch pagination links are removed after local collection recovery.
- Shared scripts can vary between page captures. Combination now retains each page's script/style/data dependency map and content-deduplicates binary assets, avoiding silent cross-page replacement.
- Repeated transformation no longer inserts duplicate compatibility guards.
- GitHub workflow lookup must work when the workflow exists only on the new staging branch. Deployment status now reads branch runs instead of requiring a workflow on the default branch.

## GitHub staging behavior

GitHub authentication uses GitHub CLI device sign-in. Credentials are kept by GitHub CLI and are not included in the app ZIP. Choose a dedicated repository with Pages administration permission. Existing Pages sites, custom domains and unrelated root deployment workflows are rejected. Once this project creates its staging site, it can update that managed target.

Preparation is local: it clones the chosen repository, creates a new astro-staging/... branch, copies Astro source under astro-staging/site, writes a root staging workflow and commits. The app displays the repository, branch and changed files before upload. Upload pushes that branch without force, enables Pages and a staging branch deployment policy, then follows Actions. It does not write to the pre-existing main branch or configure a custom domain.

This delivery used the repository you selected and your explicit staging request. Draft QA findings remain visible after deployment. Source content follows repository visibility and Pages visibility rules.

## Automated validation

Passed 36 unit/regression tests, including a 25-page simulated sequential queue, honest blocked-QA status, selection bounds, source-backed repairs, globe URL idempotence, shared asset variants, existing Pages/custom-domain guards, stale upload rejection and staging-branch workflow status.

Passed these integrations:

```
npm test
npm run test:pipeline
node test/deployment.mjs
node test/combined.mjs
node test/staging.mjs
```

The pipeline integration performs a real two-page Astro build and checks its archive, routes and resources. It explicitly validates HTTP fallback when browser launch is blocked. Deployment integration builds under a repository base path and validates the pinned npm lockfile offline. Combination integration checks independent page reports, source ZIP, asset audit, routes/404, preview reuse and a GitHub Pages base build. Staging integration uses real local Git repositories plus mocked GitHub APIs to verify branch-only push, workflow nesting and environment setup. The selected real GitHub staging deployment was separately executed and succeeded.

## Run the downloaded app

Use Node 24. Extract Astro-Migration-Studio-v0.4.zip. On macOS run start-studio.command, or run:

```
npm install --cache .npm-cache
npm run setup:browser
npm start
```

The downloaded app starts on port 4360 by default. If occupied, use `PORT=4364 npm start`. Keep it local. The app ZIP excludes node_modules, browsers, captured website/job data, authentication files and local Git clones.

## Run the combined Astro ZIP

Extract Coditation-Three-Page-Astro-Draft.zip. In astro-project:

```
npm ci
npm run build
npm run preview
```

The source ZIP contains the Astro project, cached assets, a pinned lockfile, Pages workflow, START-HERE.md, COMBINED-REPORT.json and QA/page-*.json. dist is regenerated. Unselected CMS detail pages, source forms/backends, private content and unknown domain-bound dependencies are not implemented by this three-page draft. Do not assume a combined build closes unresolved per-page QA.

Official deployment reference: https://docs.astro.build/en/guides/deploy/github/
