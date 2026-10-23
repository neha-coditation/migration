import {Pool} from 'pg';
import {createProductionWorker} from './production-worker.mjs';
const url=new URL(process.env.DATABASE_URL);
if (!['postgres:','postgresql:'].includes(url.protocol)) throw new Error('PostgreSQL required');
const pool=new Pool({connectionString:url.href,max:5,connectionTimeoutMillis:10000,idleTimeoutMillis:30000});
pool.on('error',()=>console.warn('Idle worker database connection closed'));
const handle=createProductionWorker({db:pool,tokenHash:process.env.WORKER_AUTH_TOKEN_SHA256,
  ref:process.env.MIGRATION_WORKER_REF,releaseCommit:process.env.WORKER_RELEASE_SHA});
export default {fetch:handle};
