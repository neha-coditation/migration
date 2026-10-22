# Astro Migration Studio

A separate local app for migrating public websites into real static Astro projects. Enter a URL, choose a page budget, follow the job, inspect QA, and download the source and build. No AI account, API key, live-site edits or publishing required.

## Start

Requires Node 22.23.4 or newer and npm. Node 24 is recommended.

```sh
npm install --cache .npm-cache
npm run setup:browser
npm start
```

Open http://127.0.0.1:4360. On macOS, `start-studio.command` performs these steps. Browser setup downloads official Playwright Chromium into this app's `.browsers` directory. If the port is occupied, stop the other instance, or use `PORT=4361 npm start`.

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
- Recovers available Finsweet v1 list pagination (up to eight additional pages per list) and installs a local filtering/load-more adapter over captured records. Supports explicit field metadata and unambiguous field inference. Newer Finsweet v2, custom filters, CMS API-only content and unseen records require review.
- Generates `astro.config.mjs`, pinned Astro 7.4.2, `src/pages/[...path].astro`, captured document data and local public assets. Executes an actual Astro build.
- Checks routes/resources/SEO, blocks remote runtime requests during browser QA, records browser errors, compares screenshots and probes known menu/slider/tab/filter/load-more controls without submitting forms.
- Reports pass, review and untested behavior, and packages Astro source, `dist`, build log, reports and screenshot evidence.
- Persists jobs and findings in `data`. Jobs running during a restart become Interrupted. Cancellation is supported.

## What it does not guarantee

This is a first working version, not a universal pixel-perfect migration engine. It cannot infer private CMS content, unpublished records, original backend code, authentication, checkout or unseen interaction states from a public URL. It preserves captured markup within Astro static routes, rather than refactoring every section into reusable Astro components. JavaScript, canvas/WebGL, video, consent banners, fonts, remote APIs and time-dependent content can produce differences. Unknown dynamic imports and domain-bound services may need manual fixes.

Forms cannot submit in generated output; connect an independent backend before enabling them. Ordinary links to uncaptured pages remain links to the source and are reported. The page budget is a deliberate boundary, not a claim that the entire source website was migrated. Sitemap traversal, export ZIP/CMS import, custom QA recipes, headless component refactoring and model-assisted repair are follow-up work.

No job is called verified if browser QA did not run. Screenshot differences above 2% are review items; low pixel difference alone does not establish complete behavior. Read the full report before using an output.

## Test

```sh
npm test
npm run test:pipeline
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
