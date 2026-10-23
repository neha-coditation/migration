import {Pool} from 'pg';
import {createGitHubWorker} from './worker-api.mjs';
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
const workerHash=process.env.WORKER_AUTH_TOKEN_SHA256;
if(workerHash && workerHash.toLowerCase()===hash.toLowerCase()) throw new Error('Worker and dashboard credentials must differ');
const worker=workerHash ? {
  authenticateWorker:createDevelopmentAuthenticator({tokenHash:workerHash,subject:'actions-worker'}),
  ...createGitHubWorker({repository:process.env.MIGRATION_WORKER_REPOSITORY,ref:process.env.MIGRATION_WORKER_REF,token:process.env.GITHUB_WORKER_TOKEN})
} : undefined;
const handle=createNeonRuntime({db:pool,authenticate,worker});
export default {fetch:handle};
