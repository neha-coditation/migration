import {createNeonRuntime,createServiceAuthenticator} from './runtime.mjs';
import {createGitHubWorker} from './worker-api.mjs';

// Production release exposes only authenticated machine worker operations.
// No development/dashboard principal is admitted to project or page APIs.
export function createProductionWorker({db,tokenHash,ref,releaseCommit,fetcher=fetch}) {
  if (!/^[a-f0-9]{40}$/.test(releaseCommit || '') || !ref?.trim()) throw new Error('Pinned production release required');
  const worker={
    authenticateWorker:createServiceAuthenticator({tokenHash,subject:'production-actions-worker'}),
    ...createGitHubWorker({repository:'neha-coditation/migration',ref,
      workflow:'neon-production-page-worker.yml',expectedCommit:releaseCommit,fetcher})
  };
  return createNeonRuntime({db,authenticate:async()=>null,worker});
}
