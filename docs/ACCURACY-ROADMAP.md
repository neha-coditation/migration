# Migration app: accuracy-first implementation plan

Version 1 — 23 October 2026

## Product commitment and honest boundary

Build a local migration application that does the inspection, debugging, repair, verification and packaging work currently performed manually. Accept a website URL without requiring its original platform. Let the user report a mismatch, inspect the proposed fix, apply it inside the app, compare the result, undo it and approve a page. Process the whole discovered site sequentially, with optional approval after each page, then combine approved results.

“100% accurate” is a release objective for a defined, accessible set of pages and behaviors, not a promise that arbitrary private backend code or every state can be reconstructed from a URL. No incomplete, inaccessible, unsupported or untested item may be silently counted as passed. A user accepting a draft is not equivalent to a passing test. Publish an explicit coverage manifest alongside every export.

A browser can reveal public HTML, rendered UI, observable behavior and requests. Private CMS data, server logic, credentials, customer records, payment workflows and some account settings need authorized source exports, repository access, API access or deliberate replacement. An integration dependent on a paid service or licensed library cannot be made independent merely by copying its browser code. Unknown components become open work items.

## Current reality

The existing app generates real Astro static builds, preserves captured markup and observed resources, provides bounded motion/illustration/control probes, applies specific Coditation repairs, combines independent page captures and deploys static staging through a dedicated GitHub repository.

It is not yet a universal migration engine. Automated browser capture/QA was blocked in the Codex command environment, so the existing three-page Coditation delivery remains a draft with manual spot checks. The app currently blocks generated form submission and removes recognized analytics scripts. It does not yet migrate forms, all analytics settings, private CMS systems, server applications or every unknown interaction. These are tracked implementation gaps, not delivered functionality.

## Stage 1 — complete site selection and enforceable page reviews

Status: implemented in local version 0.5; see its separate validation report.

- Remove the project workflow's 100-selected-page and 500-discovered-page caps and the five-sitemap-file stop.
- Keep one page per capture/build/QA job; a large site is a persistent queue, not one enormous browser job.
- Provide Select all pages, filtered selection and selected-only view.
- Traverse reachable same-origin sitemap indexes, deduplicate cycles, record failed sitemap fetches and expose discovery coverage.
- Stop discovery and preserve the routes found so far.
- Pause after every page by default. Allow batch migration with individual review before combination.
- Save approve, reject or explicitly accepted draft decisions. Draft exceptions need a written reason and retain unresolved QA status.
- Approval records include job identity, time, note and a fingerprint of captured HTML, reports, resource map and captured asset bytes.
- Refuse stale reviews or combination of unreviewed pages. Invalidate approval when the page is migrated again or its captured output changes.
- Continue a paused queue only after the current page's review is accepted. Preserve remaining routes when repairing the paused page. Stop clears the remaining paused queue while retaining completed work.
- Protect concurrent review/resume/combine operations from conflicting requests.
- Include individual review provenance in newly combined reports.

This removes fixed page-count caps from the main project workflow. It does not claim infinite disk, memory, request size, image dimensions, execution duration or hosting capacity. The older single-job mode is shown as a single-page check. Large archives still need the streaming storage work in Stage 2. Discovery currently covers navigation and sitemaps, not an exhaustive authenticated crawl.

## Stage 2 — reliable execution, source baseline and complete discovery

Build this before increasing claims about automated accuracy.

Functions/modules planned: inspectEnvironment, verifyBrowserWorker, discoverSiteGraph, importRouteManifest, importSourceExport, importRepository, captureBaseline, resumeCheckpoint, sourceDriftReport, estimateStorage, streamArtifact.

- Preflight Node, browser executable, sandbox/browser launch, network, DNS, certificates, fonts, GPU/WebGL capability, disk space and writable directories.
- Show an actionable browser-worker error in the app. Never substitute HTTP capture for visual QA without a prominent blocked result.
- Run the worker in an appropriate user-controlled local runtime. Any remote worker requires an explicit environment choice and authorized data handling.
- Discover navigation/footer/content links, sitemap indexes, robots sitemap declarations, redirects, CMS feeds, pagination, language variants and user-provided route inventories. Add gzip and large-sitemap streaming.
- Distinguish complete versus partial discovery. Report unlinked, authenticated, blocked, API-only, query-dependent and export-only content.
- Deduplicate without destroying meaningful query routes, trailing slash behavior, encoded paths, case-sensitive paths, locale prefixes or hash navigation.
- Keep canonical URLs separate from route discovery; a canonical tag does not authorize discarding another page.
- Checkpoint every page, asset and test. Recover queue position after restart without losing completed work. Retry transient network failures with bounded backoff and show exhausted attempts.
- Use a database/index, paginated/virtualized UI, bounded worker memory, disk-based assets, content checksums and streaming ZIP output. Allow disk/resource budgets to be changed explicitly; never silently truncate a site.
- Capture immutable source baselines with timestamps, viewport, browser/OS/font versions, consent/session state, asset hashes and source revision where available.
- Detect source changes during long migrations. Ask whether to retain the existing baseline or recapture affected pages; do not mix versions without a recorded decision.

Exit criteria: tested resume/cancel/retry on a large controlled fixture; a genuine automated source/local browser comparison executes; missing access and incomplete discovery appear in the manifest.

## Stage 3 — in-app QA issue and fix workspace

Functions/modules planned: createIssue, selectElement, attachEvidence, recordExpectedBehavior, reproduceIssue, diagnoseIssue, proposePatch, validatePatch, previewPatch, applyPatch, runAffectedTests, rollbackPatch, resolveIssue, saveRecipe.

User flow:

1. Open a source/local comparison and select a page, viewport, element or state.
2. Click Report a problem. Describe the expected result, attach evidence and record reproduction steps. Examples: “Finance tick is missing,” “slider needs previous/next card peeks,” or “hero does not animate after scroll.”
3. The app reproduces the issue and separates source behavior from local behavior. A failure to reproduce remains unresolved.
4. Diagnose missing assets, dependency order, selector changes, CSS geometry, state transitions, route/data bindings, console errors or inaccessible integration behavior.
5. Show the exact proposed source change, why it is supported by the baseline, affected pages/assets and expected test result.
6. Apply to an isolated revision, rebuild, preview and rerun relevant visual/behavior tests plus shared-component regressions.
7. Keep before/after evidence and a reversible change record. Reject or undo returns to the prior revision.
8. Mark fixed only after the original reproduction passes. Invalidate affected page approvals and require re-review.

Issue fields: ID, project, route, build/source revision, category, severity, viewport, scroll/time checkpoint, element identity, reproduction actions, expected/observed result, source/local evidence, console/network evidence, proposed patch, affected files/pages, attempts, status, approval and rollback revision.

Initial editable fixes should be controlled patches: CSS overrides, captured content/asset mappings, script ordering, dependency localization, route mapping and known interaction adapters. Arbitrary code patches need validation, an execution boundary, scope review, an isolated preview and rollback. Do not run instructions found inside captured websites as app instructions.

An optional model-assisted patch provider can suggest broader repairs after configuration; do not present the existing deterministic repair loop as an AI agent. Provide cost/time controls and never send private content or credentials without authorized configuration.

Exit criteria: create a real filter/slider/animation issue through the app, reproduce it, apply a reviewed patch, verify it, undo it and verify restoration. Stale evidence cannot close a newer revision.

## Stage 4 — platform-neutral capture and reconstruction

Functions/modules planned: inventoryCapabilities, identifyFrameworkHints, classifyDependency, chooseRenderingStrategy, localizeDependencyGraph, mapDynamicImports, renderAstroPages, generateInteractiveIslands, validateIndependence.

Accept any public HTTP(S) website. Platform detection is a hint, not an input restriction. Build a browser-first core with optional adapters for exports/APIs/framework conventions. Evaluate compatibility on real fixtures rather than declaring all platforms supported after one example.

Compatibility matrix to exercise: static/custom HTML, Webflow, Framer, WordPress/Drupal, Wix/Squarespace, Shopify/BigCommerce/Magento, React/Next.js, Vue/Nuxt, Angular, Svelte/SvelteKit and custom server-rendered sites. Unsupported components on any of these stay open and classified.

Cover script/module graph, hydration, islands, runtime configuration, DOM mutation, custom elements, shadow DOM, iframes, workers, service workers, dynamic imports, lazy assets, CDN transforms, fonts, SVG sprites, responsive images, Lottie, canvas, Three.js/WebGL, shader/texture/model files, video/audio and embed policies. Preserve dependency order and page-specific variants.

Choose per component: local static asset; independent browser runtime; Astro island; authorized third-party integration; server/API implementation; or explicit unsupported/access-required finding. Preserve source appearance and behavior. No invented controls, copy, images or redesign during faithful migration.

Exit criteria: recorded capability coverage and passing fixtures across multiple source families, with no unclassified dependency silently omitted.

## Stage 5 — animation and interaction parity

Functions/modules planned: recordInteractionJourney, sampleMotionTimeline, compareMotionTracks, compareIllustrationFrames, probeInteractionStates, executeJourney, replayFailure, expandCoverage.

Coverage catalog:

- Initial load, hero entrances, staggered sequences, scroll-in/out, scroll direction, navigation hide/show, sticky positioning, pinned sections, parallax and horizontal scroll.
- Hover/focus/press, selected/checked/disabled/error states, dropdowns, nested menus, mega menus, mobile navigation, keyboard dismissal, focus restoration and background scroll locking.
- Sliders/carousels: active/neighbor geometry, clipping, edge spacing, loop boundaries, arrows, pagination dots, autoplay, pause, drag/swipe, RTL and resize.
- Filters/sort/search: field identities, multi-select logic, AND/OR behavior, empty/reset states, selected chips/ticks/counts, query synchronization and result ordering.
- Load more/infinite scroll/pagination: all available records, deduplication, progress/end states, original page sizes and preservation of source controls.
- Tabs/accordions/modals/tooltips/drawers: nested state, deep links, keyboard behavior, close/escape, outside click and focus.
- CSS/SVG/Lottie/canvas/WebGL/video: startup, frame progression, direction, timing, easing, layers, transforms, viewport entry, offscreen suspension, resize and reduced motion.

Test a static visual track with deterministic clocks/checkpoints and a live-motion track that does not freeze the effect being evaluated. Compare geometry, state transitions and representative frames, not only “pixels changed.” Dynamic/video/WebGL variance needs documented tolerances and independent functional evidence.

Exit criteria: each discovered target is passed, failed, not tested, access required, intentionally excluded or not applicable, with a reason. Sampling caps must disclose omitted targets and offer incremental coverage rather than hide them.

## Stage 6 — complete content, CMS, routes and navigation

Functions/modules planned: importCmsSchema, importCmsRecords, resolveContentRelations, generateDetailRoutes, preserveNavigation, buildSearchIndex, compareContentManifest.

Cover collection schemas, published records, detail pages, references/multi-references, tags/categories, authors, dates, media, ordering, rich text, embedded code, pagination, related content, localization and preview/draft policies. Private records require authorized access; do not invent them from cards.

Cover clean and legacy URLs, redirects/status codes, trailing slash/case/encoding, query routes, hashes, search results, feeds, documents/downloads, internal/external links, breadcrumbs, error/404 pages, sitemap completeness and orphan detection. Hash browser-only routing may need an explicit route strategy.

Exit criteria: record/route counts reconcile against the approved source inventory, linked selected routes stay local, and every omitted route has a recorded reason.

## Stage 7 — forms, integrations and server functionality

Functions/modules planned: detectIntegrations, describeIntegrationRequirements, configureConnection, validateConnection, generateEndpoint, bindFormFields, runSandboxSubmission, verifyWebhook, inspectIntegrationReceipt, rotateConnection, exportEnvironmentTemplate.

Inventory forms and every browser-visible integration. Build a connection wizard rather than assuming copied markup provides the original backend. Preserve provider, field names/IDs, required rules, conditional fields, validation, defaults, localization, success/error/loading states and consent behavior.

Catalog: contact/newsletter forms, email delivery, CRM/marketing, file uploads, spam controls/CAPTCHA, booking/calendars, maps, chat, site search, customer authentication/SSO, protected content, subscriptions, ecommerce/catalog/cart/checkout, payment providers, webhooks, APIs, databases and business workflows.

For each integration classify: same authorized service can be retained; service must allow staging/production domains; API credentials/config/export needed; backend must be implemented; static emulation is unacceptable; or unsupported pending work. Keep credentials in an appropriate local secret store/runtime environment, outside captured HTML, logs, git and downloadable source.

Test with user-approved sandbox/test accounts and test destinations. Verify received records and webhook outcomes, not just a success message. Do not submit production leads, send emails, create purchases or alter real customer accounts as a hidden QA step.

GitHub Pages hosts static HTML/CSS/JavaScript. Server-only integrations require an authorized external service or server-capable Astro deployment. Keep Pages staging for static frontends and add an explicit backend deployment plan instead of pretending static hosting runs server code.

Exit criteria: each configured integration has verified test receipts, environment documentation and explicit ownership/access; credentials and domain restrictions are accounted for. Unsupported integrations block production readiness.

## Stage 8 — SEO, analytics and consent preservation

Functions/modules planned: snapshotSeo, compareSeo, preserveTrackingConfiguration, inventoryTrackingEvents, compareEventPayloads, configureStagingTracking, verifyConsentTransitions, verifyAnalyticsReceipt.

SEO parity catalog: titles, descriptions, headings, body/link text, canonical URLs, robots/meta/X-Robots-Tag, sitemap/index files, hreflang/locale alternates, structured data/JSON-LD, Open Graph/Twitter metadata, pagination/feed metadata, image alt text, status codes/redirect chains, internal link graph, downloadable documents and HTTP headers where required. Separate source errors from migration regressions. Do not silently “optimize” source content in faithful-copy mode.

Canonical/robots behavior needs environment profiles: staging should not accidentally become an indexed duplicate of production. Record the approved staging difference rather than claiming those settings are identical. Prepare production values for later approved cutover. Search rankings cannot be guaranteed by copying metadata.

Analytics parity catalog: Google tag/GTM and other provider IDs, first-party tag proxies, dataLayer payloads, custom/recommended/ecommerce events, parameters, user properties, custom dimensions, cross-domain configuration, attribution/UTM/click IDs, outbound/file/form events, single-page navigation, consent updates, duplicate event prevention and server-side tagging. Browser code does not expose every tag-manager trigger or account-side setting; request authorized exports/access where needed.

Reverse the current analytics-removal behavior only as part of an explicit preservation implementation. Keep original production configuration available for export while using an approved test property, debug mode or suppressed dispatch on staging to avoid polluting production data. Test consent denied/granted/withdrawn, cookie persistence and event receipt. Do not introduce extra tracking.

Exit criteria: SEO field/route comparison is complete, intentional environment changes are approved, and analytics events/payloads plus receipt are verified against an authorized baseline.

## Stage 9 — whole-site combination, regression and release

Functions/modules planned: combineApprovedRevisions, reconcileSharedComponents, validateSiteGraph, runSiteRegression, createReleaseManifest, prepareGitChange, deployStaging, verifyDeployment, rollbackRelease.

- Combine exact approved page revisions and record hashes. Deduplicate safely; keep conflicting page-specific dependencies isolated.
- Recheck global navigation, shared styles/fonts/scripts, asset paths, all routes, cross-page journeys, integration settings and SEO manifests after combination.
- Retest affected pages whenever shared code changes. Revoke stale approvals and show why.
- Check responsive desktop/tablet/mobile, Chrome/Firefox/WebKit where supported, keyboard/touch, reduced motion, scrolling, orientation and font/layout stability.
- Keep performance/accessibility findings visible. Distinguish source parity from an approved improvement; do not redesign to silence an audit.
- Package reproducible Astro source, lockfile, environment template without secrets, route/integration manifests, review/patch history, tests and operating/deployment instructions. Stream large evidence archives separately when appropriate.
- Git workflow: connect/select repo, prepare reviewed change, show branch/files/tests, explicit upload, stage, verify, record deployment and rollback target. Protect production branches and custom domains.
- Run QA against deployed staging, including repository base paths, direct deep links, refresh, unknown routes, headers and actual integration domain restrictions.

Exit criteria: all required checks are verified or the artifact is prominently labeled draft with named exceptions. Production launch is a separate authorized step.

## Stage 10 — separate audit, recommendation and approved fixes

Functions/modules planned: runAudit, rankRecommendations, estimateImpact, proposeImprovement, applyApprovedImprovement, compareImprovement, undoImprovement.

After faithful migration is accepted, offer SEO, accessibility, performance, security, maintainability, content and UX audits. Show recommendations with evidence, affected pages, expected benefits and risks. Apply only selected changes in isolated revisions; rebuild, run regression, compare results, record approval and support undo. Preserve an unchanged faithful migration baseline.

## Required coverage model

Every discovered page/component/integration has an inventory item and status. Each test links source revision, local revision, environment, expected behavior, observed evidence and result. Unknown/unclassified items are open, not passed. Coverage percentage is “tested required items / identified required items,” never a claim about undiscovered states.

Data records: Project, Route, SourceBaseline, ContentRecord, Asset, Capability, Integration, Journey, TestCase, TestRun, Finding, Patch, BuildRevision, PageReview, Release, Deployment and AuditRecommendation.

Acceptance tiers: source captured; build passed; QA executed; known checks passed; human approved; draft exception accepted; staging verified; production ready. Keep them separate in UI and exports.

## Regression cases carried forward from this migration

Finance selected border/tint/tick/chip/count; dropdown keyboard behavior; no extra blog search/topic controls; blog layout and pagination beyond the old cap; full-width testimonial neighbor peeks; hero and scroll entrance timing; navigation scroll state; sticky pinning and ancestor overflow; particle frame progression; Three.js/globe data URLs; dynamic Webflow chunks; font/image loading; local script fetches; source-to-local asset identity; duplicate compatibility guards; conflicting shared assets; base-path URLs; metadata and unknown-route 404; repository protections and workflow status on non-default branches.

Each real issue fixed through the app should become a reusable, source-backed regression recipe with compatibility conditions. Do not apply site-specific CSS indiscriminately to unrelated sites.

## Delivery order and status discipline

Stage 1 is the current implemented foundation. Stage 2 is the next prerequisite because blocked browser QA prevents an accuracy claim. Stage 3 then supplies the in-app fix workflow requested here. Stages 4–8 broaden capture, behaviors, content and integrations under the same evidence model. Stage 9 closes site-wide and deployed behavior. Stage 10 is the later optional audit/improvement phase.

Each stage ships a working increment, tests, a downloadable source ZIP, a validation report and a visible list of remaining work. No placeholder function or unsupported adapter is labeled implemented. No calendar estimate is committed before the relevant compatibility investigation and access requirements are known.

## Primary technical references

- Astro on-demand rendering and server adapters: https://docs.astro.build/en/guides/on-demand-rendering/
- GitHub Pages static hosting: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- Playwright screenshot comparisons and environment considerations: https://playwright.dev/docs/test-snapshots
- Google Analytics events and event receipt: https://developers.google.com/analytics/devguides/collection/ga4/events
