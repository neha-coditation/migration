# Architecture

## Data flow

URL and page budget → local job queue → source policy → browser capture or explicit HTTP fallback → public collection recovery → additional resource recovery → Astro generator → real production build → local preview → QA → report → ZIP.

The HTTP server uses Node's HTTP APIs and persists each job. Writes are serialized. One job runs at a time; at most five can be queued/running. The app binds to loopback, rejects cross-origin write requests and validates source URL protocols, credentials and resolved public addresses. Chromium capture blocks non-GET/HEAD requests, service workers and WebSockets. Every intercepted resource URL is checked. This is local-tool protection, not a claim of production tenant isolation or a complete DNS-rebinding defense.

## Capture and preservation

Browser mode records resource responses, source HTML and per-viewport rendered inventories. Client-rendered pages may use the rendered DOM, with a warning about rehydration. Three source screenshots are taken at top/middle/bottom for desktop 1440x1000 and mobile 390x844. Known controls are probed through a narrow selector allowlist. Unknown buttons, submission flows, authentication and payments are not clicked. Up to fifty pagination pages can be recovered per Finsweet v1 list, retaining the original visible page size and controls.

HTTP fallback recovers source HTML and statically discoverable resources. It does not synthesize browser evidence. Its final report contains an explicit browser-QA failure and needs-review status.

## Real Astro output

A static catch-all Astro route uses getStaticPaths and emits captured documents through set:html. This retains HTML and script behavior without Astro processing every source script. Assets are under public/migrated with stable URL-derived filenames. The source HTML remains editable data. Resource URL rewriting covers observed absolute references, HTML attributes, CSS and common JavaScript literal imports/fetches. A local compatibility script maps known dynamically requested resources to cached paths and prevents form submission.

The studio's installed Astro packages are temporarily linked into a job for its build; that symlink is removed before packaging. Downloaded Astro projects declare their own pinned dependency and install it normally. No model provider is used and no prompt/credential is sent to an AI service.

## QA and verdicts

Static audits inspect generated HTML, CSS resource URLs, clean-route responses, metadata and links to uncaptured source routes. Browser QA uses a separate context that blocks external runtime requests. It records page errors, text, viewport/scroll screenshots, pixel differences and observable control changes. Source and local inventories are matched per viewport. Screenshot differences above the selected tolerance require review. Observable state change is narrower evidence than complete behavior correctness.

Missing resources, external runtime requests, HTTP failures, observed interaction regressions and missing browser QA prevent a verified verdict. Unseen CMS records, excluded routes, SEO findings, visual differences and untested controls require review. The download can still be available when the build succeeded but fidelity needs review.

## Limits and next work

Private CMS/export ingestion, custom interaction recipes, multi-page CMS relation generation, local embedded bundler decoding, semantic component refactoring, model-assisted repairs and a broad platform compatibility matrix are not complete. Keep these limits explicit. A public URL alone cannot prove full site coverage. The original Coditation manual migration used an export and bespoke repairs that are not all generalized in this first version.

## References consulted

- Astro routing reference https://docs.astro.build/en/reference/routing-reference/
- Playwright Page API https://playwright.dev/docs/api/class-page
- Astro package version and engine requirements https://registry.npmjs.org/astro/7.4.2

## Fidelity recipes

Source capture now measures live motion, sticky pinning, slider geometry and existing controls before screenshot capture. server/fidelity.mjs applies signature-scoped Coditation repairs before collection recovery. QA compares the same measurements against the local build; missing baseline evidence remains untested. The report records each page profile, applied repairs and required checks. See FIDELITY-RECIPES.md for exact coverage and limits.

## Experience QA and deployment packaging (0.3)

server/experience.mjs installs an early DOM motion recorder, samples each target at five scroll positions, captures live illustration frame pairs and compares image/SVG/canvas/Lottie evidence. Read docs/EXPERIENCE-QA.md for budgets and exclusions. server/deployment.mjs emits the official-style GitHub Pages workflow and build helper; source export URLs are rewritten for ASTRO_BASE during postbuild. Deployment metadata and experience coverage are explicit in schema-3 reports.

## Project orchestration and staging

ProjectService persists page selection, individual job histories and independent QA status under data/projects. The shared global job queue runs each selected page separately, then a source combination builds all selected routes, localizes cross-links, content-deduplicates binary assets and preserves per-page text resource mappings. Combined builds repeat static resource and HTTP route checks; independent browser QA is retained rather than relabeled.

GitHubService uses GitHub CLI device authorization and repository APIs. Preparing clones a dedicated repository locally, creates a new staging branch and copies source under astro-staging/site with a root staging workflow. Publishing checks the immutable combined timestamp and repository protections again, pushes without force, configures Pages and its staging branch environment, and polls Actions. Credentials remain with GitHub CLI and are never returned to the dashboard or ZIP. Browser QA and live publication are separately reported.
