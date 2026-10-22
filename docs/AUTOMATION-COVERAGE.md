# How the Coditation migration workflow becomes an app

The original manual migration used an export, public live comparisons and several bespoke repairs. This first app automates the repeatable capture, rewrite, build, audit and packaging stages. It does not claim that every bespoke repair is generalized.

| Original input or correction | App behavior | Coverage |
| --- | --- | --- |
| Supply the website and ask for migration | URL form, automatic same-origin link discovery, optional specific paths, page budget | Implemented for public URLs; export ZIP ingestion is follow-up |
| Choose a standalone architecture | Actual Astro 7.4.2 project and static production build | Implemented |
| Inspect pages, assets, CMS and SEO | Source inventories, resource maps, titles, canonicals, forms, controls and visible lists | Implemented; inaccessible CMS remains unknown |
| Recover missing assets and libraries | Browser response capture, HTML/CSS/import/fetch discovery, known Webflow chunk manifests, local resource URL mapping | Implemented within resource limits; unknown dynamic requests require review |
| Preserve Three.js, particles, illustrations and animations | Preserve source scripts, inline SVG, CSS, media and observed dependencies rather than deleting them | Implemented preservation; arbitrary custom motion repair is not guaranteed |
| Hero and scroll-into-view animation missing | Preserve original interaction runtime; capture three scroll checkpoints for source/local visual QA | Partial; exact timing and all animation states are not established |
| Navigation behavior missing | Preserve original scripts; known menu expanded/visible-state probe | Implemented for recognizable controls; arbitrary custom navigation requires review |
| Testimonial slider arrangement and edge gaps | Retain original source CSS and card markup; compare source/local screenshots; probe known next controls | Implemented preservation and QA; no universal geometry repair algorithm |
| Sticky section broken | Preserve source CSS and DOM; compare scroll-state screenshots and inventory sticky elements | Partial automatic QA; controlled generated fixture pinned correctly in manual browser checks |
| Finsweet filter and load more broken | Recover public v1 pagination, retain initial size, local adapter over collected records | Implemented for recognized v1 markup, bounded to eight extra pages |
| Finance checkbox has no selected appearance | Toggle original active label and checked classes; retain source checkmark assets/styles | Implemented state compatibility; source-specific styles still need visual QA |
| Extra blog search and Topics were added | No redesign controls inserted into captured pages; regression tests check no added search/topics in recovery | Implemented |
| Hidden CMS detail content not in export | Public linked pages can be discovered; missing routes/content are reported | Partial; no private CMS or full collection export inference |
| Clean URLs and internal routes | Astro static catch-all route, directory output, local links for captured routes, real unknown-route 404 | Implemented |
| Webflow independence | Local copies of observed assets and browser code; offline browser QA blocks external runtime requests | Implemented audit and caching; remaining dependencies prevent verification |
| Form backend no longer available | Generated guard prevents form submission; report identifies unsupported backend work | Implemented limitation reporting, not backend recreation |
| Run build, compare, fix and package | Real Astro build, static audit, visual/control QA, report and downloadable ZIP | Implemented pipeline; browser branch unverified in this sandbox |
| Ask repeatedly what failed | Stage progress, activity log, structured failures/warnings, saved jobs and source/local/diff evidence | Implemented |

## Follow-up work needed for the broader product

1. Export ZIP and structured CMS import with collections, references, drafts and slug generation.
2. Complete sitemap discovery and resumable larger-site crawling beyond the first release's bounded page budget.
3. A platform compatibility matrix for Webflow, Framer, WordPress and custom client apps.
4. Declarative interaction recipes for source-specific filters, slider edge geometry, sticky pinning, canvas activity and scroll choreography.
5. Safe iterative repairs driven by observed QA differences, with an optional separately configured model service if desired.
6. Semantic Astro components and editable CMS templates rather than captured HTML data alone.
7. A full browser-worker run in an ordinary local environment, followed by regression tests across representative live sites and devices.

A public link cannot reveal private database records, server code or authenticated behavior. Even a mature app needs to label that missing information rather than promise exact completeness.
