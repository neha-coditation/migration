# Fidelity corrections added from the Coditation migration

These are automatic steps in new migration jobs, rather than prompts the user must repeat. Existing ZIPs are immutable; run a new migration to use the changes.

## Targeted repairs

The Coditation profile applies only to coditation.com and its subdomains. On /resources/blogs it removes the rejected category/filter wrapper, extra blog-search input and “Search all published blog posts” link/button while keeping original article markup and layout classes. Other sites keep their own search and topics. No replacement UI is added.

The profile restores the selected checkbox’s checkmark, blue border and tint. It changes body overflow to clip so sticky descendants do not acquire an unintended scrolling ancestor. It permits overflow at #testimonial so the source Swiper’s centered neighboring cards can reach the containing section edges. It preserves the source breakpoints, card widths and original Swiper instance instead of initializing a second slider.

Recognized Coditation particle initialization is replaced with the repaired version from the manual migration: independent scene initialization, resize handling, visibility and reduced-motion handling. The original Three.js script dependency and source script order remain intact. This recipe is deliberately signature-scoped; it does not replace arbitrary third-party animation scripts.

Finsweet v1 pagination recovery and the local adapter remain part of every compatible job. The adapter filters captured records using field values, updates selected classes, resets the page limit after a filter change, and exposes additional matching records through the original load-more control. Unseen/private CMS records are not invented. Finsweet v2 remains a review item.

## Browser evidence

At desktop and mobile sizes the browser now samples live animation state before taking animation-disabled comparison screenshots. It records changes in transforms, opacity and readable canvas image hashes over time and scroll; hero and navigation changes are evaluated separately. It measures sticky pinning during two scroll positions and testimonial visible-card count, left/right card boundaries and center alignment against the source.

Control probes open the Department dropdown when available, activate the existing checkbox label, inspect checked state and the rendered indicator, then clear the filter before testing load more. The original pagination and testimonial navigation selectors are included. Before/after interaction states are retained in the report.

A source-control contract catches controls introduced during transformation. The generated output is also compared against the live browser’s control inventory. A source-driven test cannot establish activity that was not observed on the source: those animation checks are explicitly not tested, never passed by assumption.

## Result handling

The dashboard shows applied recipes and measured fidelity checks, including when browser QA could not launch. Downloads requiring review are labeled draft. Failed measured fidelity checks prevent a verified result. No browser execution means Review needed, even when the Astro build passes.

This is bounded automation, not a claim that every arbitrary animation or undocumented platform interaction can be repaired. Closed WebGL buffers, interactions beyond the sampled scroll positions, hidden states, custom scroll engines and missing third-party dependencies may need further recipes. The profile preserves the existing hero/nav interaction engine; it does not reconstruct an absent engine from screenshots. Missing assets and remote requests remain findings.

## Dynamic Webflow chunks

The compatibility guard now maps captured `webflow.achunk.<hash>.js` filenames to their cached renamed files when a local Webflow loader constructs a relative URL. This fixes a reproduced chunk-loading failure that prevented the source dropdown/interaction engine from starting. Unknown scripts are not redirected arbitrarily. A runtime regression test executes the generated guard and verifies both the known-chunk rewrite and an untouched unknown URL.

## Verification in this update

17 automated tests passed. The controlled two-page migration ran a real Astro production build and exercised the explicit unverified HTTP fallback. A fresh one-page Coditation capture cached 380 resource URLs and built successfully. Its cached source was rebuilt after the chunk mapping fix. In the in-app browser, five particle scenes had advancing frame counters, the testimonial had Swiper initialized classes, and the source navigation dropdown became an accessible control after the recovered engine loaded. These spot checks are not a full desktop/mobile source comparison. The automated Chromium QA branch remains unverified in this environment because its browser process could not launch.
