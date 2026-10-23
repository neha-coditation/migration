import {timingSafeEqual, createHash} from 'node:crypto';
import {NeonControllerState} from './controller-state.mjs';
import {createNeonApi} from './api-handler.mjs';
import {createWorkerApi} from './worker-api.mjs';

/**
 * Hashed bearer authentication for trusted machine-to-machine callers.
 * Human-facing production routes must use an OIDC/JWT identity verifier.
 * The secret is stored in the runtime environment, never in source.
 */
export function createServiceAuthenticator({tokenHash, subject}) {
  if (!/^[a-f0-9]{64}$/i.test(tokenHash || '') || !subject?.trim()) {
    throw new Error('Set a 64-character bearer token hash and a service subject');
  }
  const expected = Buffer.from(tokenHash.toLowerCase(), 'hex');
  return async token => {
    if (typeof token !== 'string' || token.length > 4096) return null;
    const digest = createHash('sha256').update(token).digest();
    return timingSafeEqual(expected, digest) ? {subject} : null;
  };
}

// Development dashboard compatibility only. Production user routes require OIDC.
export const createDevelopmentAuthenticator = createServiceAuthenticator;

/**
 * Creates a fetch handler only after trusted Postgres and authentication
 * implementations are supplied. No public deployment is enabled by default.
 */
export function createNeonRuntime({db, authenticate, worker}) {
  if (!db || typeof db.query !== 'function') throw new TypeError('Parameterized PostgreSQL client required');
  if (typeof authenticate !== 'function') throw new TypeError('Verified authenticator required');
  const state = new NeonControllerState(db);
  const api = createNeonApi({state, authenticate});
  const workerApi = worker ? createWorkerApi({db,...worker}) : null;
  return async request => {
    if (new URL(request.url).protocol !== 'https:') {
      return Response.json({error:'HTTPS required'}, {status:403});
    }
    if (new URL(request.url).pathname.startsWith('/api/neon/worker/')) {
      return workerApi ? workerApi(request) : Response.json({error:'Worker disabled'}, {status:503});
    }
    return api(request);
  };
}
