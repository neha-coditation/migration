import {Pool} from 'pg';
import {createNeonRuntime, createDevelopmentAuthenticator} from './runtime.mjs';

// Neon Functions injects DATABASE_URL for the selected branch.
// Only this backend receives the credential; never expose it in JSON or logs.
const url=process.env.DATABASE_URL;
const hash=process.env.DEV_AUTH_TOKEN_SHA256;
const subject=process.env.DEV_AUTH_SUBJECT;
if (!url || !hash || !subject) {
  throw new Error('Neon development API disabled: DATABASE_URL and dev authentication must be configured');
}
const parsed=new URL(url);
if (!['postgresql:','postgres:'].includes(parsed.protocol) || !parsed.hostname) {
  throw new Error('Invalid PostgreSQL connection URL');
}
const pool=new Pool({connectionString:url,max:5,connectionTimeoutMillis:10000,idleTimeoutMillis:30000});
const authenticate=createDevelopmentAuthenticator({tokenHash:hash,subject});
const handle=createNeonRuntime({db:pool,authenticate});
export default {fetch:handle};
