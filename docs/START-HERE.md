# Start here

1. Enter your website address.
2. Click Fetch pages.
3. Select the pages you want and start migration.
4. View migrated page opens the local result inside the app.
5. View check results shows what passed, needs attention, or could not run. Screenshot comparisons appear only when browser checks ran.
6. Review each page. An accepted review automatically starts the next selected page; rejection keeps the page open. Combine after the final page is reviewed.

To resume previous work, choose a saved project. The app starts with an empty address and does not open an old project automatically.

Version 0.5.1 validation: 42 regression tests passed. The two-page Astro pipeline build and resource checks passed with explicit HTTP fallback because the automated browser worker could not launch here. Manual in-app checks verified address-first startup, saved-project selection, embedded migrated-page preview and readable check findings. No new live deployment was made.
