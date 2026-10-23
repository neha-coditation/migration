# Astro Migration Studio

A separate local app for migrating public websites into real static Astro projects. Enter a URL, discover and select pages, migrate them one at a time, inspect individual QA and combine them into one Astro ZIP. GitHub Pages staging is optional and requires explicit repository selection and upload. No AI account or API key is needed.

## Start

Requires Node 22.23.4 or newer and npm. Node 24 is recommended.

```sh
npm install --cache .npm-cache
npm run setup:browser
npm start
```

Open http://127.0.0.1:4360. On macOS, `start-studio.command` performs these steps. Browser setup downloads official Playwright Chromium into this app's `.browsers` directory. If the port is occupied, stop the other instance, or use `PORT=4361 npm start`.

## Browser readiness and automatic next page (0.5.2)

The app checks whether its browser worker can start and distinguishes a missing installation from an environment permission block. Use **Set up checking browser** if missing, then **Recheck browser**. If the environment blocks startup, start the app in a normal local terminal or use a browser-capable backend; reinstalling or a GitHub Pages frontend alone cannot remove that restriction. A readiness check does not verify migrated pages. Rerun checks on old untested captures after the browser is ready.

Saving an accepted review of the currently paused page now automatically starts the next selected page and focuses it in the list. **Approve & migrate next page** requires passed checks. **Accept draft & migrate next page** requires an explicit written exception and retains unverified QA. Rejecting a page keeps it open. The final page is saved for combination rather than starting another job. The separate Continue control remains for recovering previously paused queues, and is no longer required after a new accepted review.

## Accuracy foundation (0.5)

The main project workflow has no fixed selected/discovered page-count cap. Select all discovered pages and process them one at a time. Navigation and reachable same-origin sitemaps are inspected without the old 500-route/five-sitemap limits; failed sitemap fetches are recorded. This is not proof that private or unlinked content was discovered. Existing per-resource, request, memory and archive budgets still apply.

**Pause for approval after every page** is enabled by default. Open page & QA, then Review & approve. Approve requires a verified result; reject keeps the page open. Accept draft requires a reason and never upgrades failed/blocked QA. Continue to next page resumes the saved paused queue. Repairing the paused page invalidates its old approval and keeps remaining routes. Stop preserves completed pages and cancels the remaining paused queue.

New combinations require a review for every included page. Reviews are tied to job identity and the bytes of captured HTML, reports, resource maps and assets; changed content must be reviewed again. Existing previously combined/staged drafts are preserved. Human review is distinct from automated verification.

The general in-app issue/patch/undo workspace and universal integration support are **planned**, not delivered by this foundation. Read [the staged accuracy roadmap](docs/ACCURACY-ROADMAP.md) for the current gaps, acceptance criteria, SEO/analytics preservation, backend integration work and the later audit/fix phase.

## Page-by-page migration and staging (0.4)

The 0.4 workflow originally limited discovery to 500 routes and selection to 100 pages. Version 0.5 removes those fixed project page-count caps. Each runs as its own job, sequentially. Open its QA report or choose **Repair & recheck**. Completed results persist across restarts. Select completed pages and **Combine** to build one clean-route Astro project and download a source ZIP. Shared binary assets are deduplicated by content; scripts, styles, SVGs and JSON retain per-page dependency mappings so changing resources cannot corrupt another page.

The visual target is configurable from 0 to 2 percent. QA checks individual animations, illustration frames, scroll behavior and supported interactions. Up to three automatic repair passes restore supported exact source illustration assets, rebuild and recheck. Existing Coditation recipes restore known filter, slider, sticky and particle behavior. This is a deterministic repair system, not an AI code-rewriting engine: unsupported differences remain open for manual repair. If Chromium cannot start, the app explicitly reports **Browser QA blocked** and skips automatic evidence-based repair. A successful build never substitutes for browser QA.

For staging, install [GitHub CLI](https://cli.github.com/) and connect through the app device sign-in. Load repositories and choose a dedicated repository with Pages administration permission. Review open QA findings and allow a draft if needed. **Prepare staging changes** creates a local commit and displays its repository, new `astro-staging/...` branch and file summary. **Upload and launch staging** pushes that branch, enables Pages with a staging-only environment branch policy and displays deployment progress. It never force-pushes or writes to an existing main branch. Existing Pages sites, custom domains and unrelated root workflows are rejected. Repository/source visibility follows your GitHub settings; GitHub Pages can be public even when its repository is private. No custom domain or DNS is configured.

The combined ZIP includes `START-HERE.md`, a pinned Astro lockfile, Pages workflow and individual QA reports. Run `npm ci`, `npm run build`, `npm run preview` in its `astro-project` folder. Screenshots remain in each individual job download. If the first Actions run reaches deployment before initial Pages settings complete, re-run it from the shown Actions link.

## Animation, illustration, interaction and GitHub ZIP update

Version 0.3 adds per-target startup/scroll animation checks, live illustration frame pairs, illustration identity/load/geometry checks, expanded control probes, Lottie/glTF/SVG dependency localization, and GitHub Pages workflow/base-path support in exported Astro projects. See [coverage and limits](docs/EXPERIENCE-QA.md).

## Fidelity update

The app now includes the Coditation correction recipes and source-driven motion, sticky, selected-filter and testimonial geometry checks. See [the detailed coverage](docs/FIDELITY-RECIPES.md). New jobs apply these changes; rerun older migrations. Applied repairs are distinguished from browser-verified results.

## What this version does

- Discovers linked same-origin pages within a 1–20 page budget, with optional specific paths.
- Uses an isolated browser to observe resources, rendered content, desktop/mobile screenshots, scroll checkpoints and selected UI controls when Chromium is available.
- Falls back to HTTP HTML capture if Chromium cannot start. This fallback is explicitly unverified for visual and interaction fidelity.
- Downloads observed images, SVG illustrations, styles, fonts, scripts and other resources. Rewrites asset references, CSS URLs, common imports/fetch literals and known dynamic resource URLs. Discovers Webflow chunk names where their manifest is visible.
- Preserves source HTML, scripts, classes and existing controls; does not redesign the website or add search/topic/filter UI.
- Recovers available Finsweet v1 list pagination (up to 50 additional pages per list) and installs a local filtering/load-more adapter over captured records. Supports explicit field metadata and unambiguous field inference. Newer Finsweet v2, custom filters, CMS API-only content and unseen records require review.
- Generates `astro.config.mjs`, pinned Astro 7.4.2, `src/pages/[...path].astro`, captured document data and local public assets. Executes an actual Astro build.
- Checks routes/resources/SEO, blocks remote runtime requests during browser QA, records browser errors, compares screenshots and probes known menu/slider/tab/filter/load-more controls without submitting forms.
- Reports pass, review and untested behavior, and packages Astro source, `dist`, build log, reports and screenshot evidence.
- Persists jobs and findings in `data`. Jobs running during a restart become Interrupted. Cancellation is supported.

## What it does not guarantee

This is a first working version, not a universal pixel-perfect migration engine. It cannot infer private CMS content, unpublished records, original backend code, authentication, checkout or unseen interaction states from a public URL. It preserves captured markup within Astro static routes, rather than refactoring every section into reusable Astro components. JavaScript, canvas/WebGL, video, consent banners, fonts, remote APIs and time-dependent content can produce differences. Unknown dynamic imports and domain-bound services may need manual fixes.

Forms cannot submit in generated output; connect an independent backend before enabling them. Ordinary links to uncaptured pages remain links to the source and are reported. The page budget is a deliberate boundary, not a claim that the entire source website was migrated. Export ZIP/CMS import, custom QA recipes, headless component refactoring and model-assisted repair are follow-up work.

No job is called verified if browser QA did not run. Screenshot differences above the selected tolerance are review items; low pixel difference alone does not establish complete behavior. Read the full report before using an output.

## Test

```sh
npm test
npm run test:pipeline
node test/deployment.mjs
node test/combined.mjs
node test/staging.mjs
```

The integration test runs a controlled two-page local source, generates Astro, performs the actual production build and checks the ZIP and static resources. Local source URLs are allowed only inside that direct test invocation; the app API rejects private/reserved destinations. When Chromium can run, the integration test also executes browser QA and asserts slider behavior. In restricted environments, it asserts the truthful HTTP fallback and Review needed result instead.

See `docs/VALIDATION.md` for the evidence and limits recorded during this build. The complete browser pipeline could not execute in the Codex shell sandbox; its Chromium process was blocked by the operating system. The actual Astro build, resource checks, output ZIP and representative generated-site behavior were verified separately.

## Project layout

`public/` is the local dashboard. `server/` contains URL policy, job queue, capture, collection recovery, transformation, Astro build, QA and packaging. `test/` contains boundary tests and a controlled website fixture. `data/<job-id>/` contains job state, captured resources, the generated Astro app, reports, evidence and the download ZIP.

The control server binds to 127.0.0.1 and has no authentication or hosted multi-user isolation. It is a local tool. Browser navigation rejects private destinations and state-changing requests. Downloaded websites contain source-site browser code. This app is not configured for public deployment.

## Edit the migrated Astro app

Extract a migration ZIP, then:

```sh
cd astro-project
npm install
npm run build
npm run preview
```

Edit captured markup in `src/data/pages.json`; styles and assets are in `public/migrated`. The catch-all Astro page statically generates the captured clean routes. Reusable component conversion is separate work.
