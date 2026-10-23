# Neon Function deployment (development only)

The backend entrypoint is `server/neon/function-entry.mjs` and exports a Neon-compatible `fetch` handler. It is **not currently deployed**.

## Requirements

- Use the isolated Neon development branch, not the default or protected branch.
- Package the entrypoint plus `api-handler.mjs`, `controller-state.mjs`, and `runtime.mjs`; install the npm package `pg` into the function bundle. Neon recommends a module-scope `pg.Pool` for Functions.
- Neon injects `DATABASE_URL` for the selected database branch. Never commit that value.
- Set `DEV_AUTH_SUBJECT` to a test account identifier and `DEV_AUTH_TOKEN_SHA256` to the lowercase SHA-256 digest of a random bearer token. Store the **original** token in a secret manager, not GitHub or source code.
- Deploy through the Neon Function deployment mechanism using a built artifact. The current repository root `package.json` does not include `pg`, so the source file alone is **not yet an executable packaged deployment**.
- Requests must use HTTPS and `Authorization: Bearer <token>`. Do not expose the development verifier as production authentication.
- Connect a production identity provider and enforce URL destination policy before making project discovery or worker dispatch publicly usable.

## API routes

- `POST /api/neon/projects` with `sourceUrl` and optional `approvalMode`
- `GET /api/neon/projects/:id`
- `GET /api/neon/projects/:id/pages`
- `POST /api/neon/projects/:id/pages` with same-origin `sourceUrl`

This API only creates and lists database records. It does **not** launch GitHub Actions workers yet. It does not host the UI or persist migration assets.

## Verification checklist

1. Build the full Node 24 function bundle with `pg` and the source modules.
2. Run tests for the Neon API handler, runtime, queue and controller state.
3. Deploy only to `migration-queue-development-20261023`.
4. Check missing/invalid tokens return 401 and other users cannot read projects.
5. Create a test project and enqueue a same-origin page, and verify its DB records in the development branch.
6. Verify queue claims/heartbeats, worker callbacks, object storage, restart recovery and download before any production deployment.
