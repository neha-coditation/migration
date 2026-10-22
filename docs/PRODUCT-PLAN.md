# Website to Astro migration studio

## Goal
A local application that turns a public website URL and optional extra paths into a downloadable, buildable Astro project. It automates the observed Coditation migration workflow and produces evidence of fidelity and unresolved behavior. No deployment or live-site mutation.

## First release acceptance criteria
1. A user enters a public URL, page budget and optional additional routes, then starts a background migration.
2. The job discovers same-site routes, captures HTML and resources with a browser, inventories scripts, CMS indicators, forms, SEO and interaction controls, and preserves provenance.
3. A self-contained Astro project is generated with clean static routes and localized assets. Existing browser interaction code is retained when possible, with remote service dependencies identified explicitly.
4. The job runs an actual Astro production build, serves that output, then checks internal resources, routes, desktop and mobile appearance, runtime errors, remote dependencies, scrolling and observable interaction states.
5. A report distinguishes pass, fail, warning, not tested and blocked. Downloads include Astro source, generated output, screenshots, route inventory and QA evidence. A failed build must never be marked ready.
6. Input errors, failed downloads, unsupported content, job cancellation and interrupted jobs remain visible. Jobs and results persist across application restarts.
7. The app never publishes, submits source-site forms, changes a live domain or claims that an inaccessible backend was reproduced.

## Architecture
A local HTTP control server owns a persistent job queue and workspace per job. A browser capture worker discovers public pages and records resource responses. A transformer rewrites references and generates an Astro static project from captured documents. A build worker runs a pinned Astro dependency with argument arrays and bounded resource use. A QA worker compares source captures against built local pages at matched viewports and scroll checkpoints. A packaging worker produces a ZIP plus a human-readable report and JSON evidence.

## Important limits
A public link does not expose private CMS records, backend APIs, server code, authentication logic or all interaction states. Arbitrary JavaScript may require domain-bound APIs or dynamic imports not observed during capture. Video, WebGL and time-dependent animation can cause screenshot differences. Visual similarity is measured evidence, not a universal pixel-perfect guarantee. Optional source exports and declared interaction checks improve coverage.

## Ordered milestones
1. Inspect chosen repository and agree local-first boundaries.
2. Implement persistent jobs, URL validation and migration status UI.
3. Implement public-page discovery, browser resource capture and dependency inventory.
4. Generate a real Astro project and run its build with clean routes.
5. Implement deterministic fixture tests, route/resource audits and matched-view visual QA.
6. Exercise the app in the browser, package source and document verified limits.

## Confirmed decisions
A separate local app was selected by the user. The first pipeline is deterministic and uses no AI service. The first release supports public URL capture; export ZIP and private CMS ingestion are follow-up work. Full browser automation remains unverified in the restricted development shell, with explicit fallback behavior tested instead. If model-assisted repairs are later selected, provider credentials and explicit source-data destinations need a separate decision.
