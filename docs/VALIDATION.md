# Recorded validation

23 October 2026 India time.

## Passed

- Eleven Node tests: private/reserved URL and mixed DNS rejection, route discovery, markup preservation, resource localization, path traversal rejection, inline fetch/chunk discovery, collection recovery without new UI, URL-prefix regression, pixel-difference math and public pagination recovery.
- Controlled two-page source produced a real Astro 7.4.2 production build, clean route files and a downloadable ZIP. Missing HTML/CSS resource findings were zero; unknown route returned 404.
- HTTP fallback was deliberately checked: report says `captureMode: http-fallback`, `qa.notRun: true`, and `status: needs-review`. It does not claim browser QA passed.
- Live dashboard job for Coditation homepage completed: one Astro route and 361 cached resource URLs in that run. It remained Review needed because browser QA did not run and linked routes were outside the one-page budget. This is not a full Coditation migration.
- Dashboard form rejected a private local source URL with a visible validation message.
- Dashboard accepted public URL input, persisted jobs through server restart, exposed downloads and produced a local preview link.
- Dashboard desktop and mobile rendering inspected. At a 390-pixel viewport, document scroll width was 390 pixels, with no horizontal overflow.
- Separate manual checks through the Codex in-app browser on the generated fixture: menu expanded, next slide advanced to index 1, Finance selected exactly two matching cards, and load more revealed all three cards. The initial field-inference defect was found and corrected during those checks.
- Fixture heading content, 80-pixel font size, text color and sticky CSS matched the source. Sticky element stayed at 100 pixels from the viewport top as scrolling advanced from 844 to 988 pixels.

## Not verified here

Chromium could not start in the Codex command sandbox because macOS denied its process bootstrap. The browser capture and automated browser QA branch is implemented but did not execute here. Browser screenshots and control observations made through the in-app browser are separate manual evidence, not a substituted automated pass.

The first test also found that the expected Chromium binary was not installed for the npm Playwright package. `npm run setup:browser` installs its required official browser in this app's local `.browsers` directory. A normal local environment is needed to complete the browser-worker integration test.

No claim is made that the app reproduces every site, original animation timing, hidden state, CMS collection, backend, WebGL output or device view exactly. See AUTOMATION-COVERAGE.md for the mapping of the original manual work to current automation and remaining work.

## Reproduce

```sh
npm install --cache .npm-cache
npm run setup:browser
npm test
npm run test:pipeline
npm start
```

The integration test prints its actual mode. A fully executed browser run should say browser rather than http-fallback. If it falls back, investigate the setup message and rerun outside restricted command environments before claiming complete browser verification.

## Version 0.2 fidelity update

See FIDELITY-RECIPES.md. 17 current tests pass, including a runtime Webflow chunk alias regression. The actual two-page Astro build passes. The browser worker still uses the explicit HTTP fallback here, so full automated motion, visual and interaction QA is not claimed. Manual in-app checks observed advancing particle counters and initialized source navigation/Swiper in a cached Coditation rebuild after the chunk fix.
