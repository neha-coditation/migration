import fs from 'node:fs/promises';
import path from 'node:path';

export function createCallbackClient(env=process.env,fetcher=fetch) {
  const base = new URL(env.NEON_WORKER_API_URL);
  // Explicit environment profiles prevent a dev credential being sent to production.
  const origins={
    development:'br-quiet-hat-b5fslf7n-migrationapi.compute.c-7.us-east-2.aws.neon.tech',
    production:'br-proud-hall-b5rtedf4-migrationworker.compute.c-7.us-east-2.aws.neon.tech'
  };
  const profile=env.MIGRATION_ENVIRONMENT || 'development';
  if (base.protocol !== 'https:' || base.hostname !== origins[profile] || base.pathname !== '/' || base.username || base.password || base.search || base.hash) throw new Error('Expected the selected Neon worker environment origin');
  if (!env.NEON_WORKER_TOKEN) throw new Error('Worker credential required');
  const fence={jobId:env.MIGRATION_JOB_ID,workerId:env.MIGRATION_WORKER_ID,attempt:Number(env.MIGRATION_ATTEMPT),runId:Number(env.GITHUB_RUN_ID)};
  return async (action,body={}) => {
    for (let attempt=0;attempt<3;attempt++) {
      let response;
      try {
        response=await fetcher(new URL(`/api/neon/worker/${action}`,base),{method:'POST',headers:{Authorization:`Bearer ${env.NEON_WORKER_TOKEN}`,'Content-Type':'application/json',...(action==='complete' && env.GH_TOKEN ? {'X-GitHub-Token':env.GH_TOKEN} : {})},body:JSON.stringify({...body,...fence}),signal:AbortSignal.timeout(30000)});
      } catch (error) {if(attempt===2)throw error;continue;}
      if (response.ok) return response.json();
      if (response.status<500 || attempt===2) throw new Error(`Worker callback rejected (${response.status})`);
    }
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const callback=createCallbackClient();
  const root=path.resolve('worker-output',process.env.MIGRATION_JOB_ID);
  const result=await fs.readFile(path.join(root,'worker-result.json'),'utf8').then(JSON.parse).catch(()=>null);
  const report=await fs.readFile(path.join(root,'report.json'),'utf8').then(JSON.parse).catch(()=>null);
  const artifact=process.env.ARTIFACT_ID ? {id:Number(process.env.ARTIFACT_ID),sha256:process.env.ARTIFACT_DIGEST?.replace(/^sha256:/,''),bytes:Number(process.env.ARTIFACT_BYTES)} : null;
  const valid=result && report && result.browserExecuted && !report.qa?.notRun && report.build==='passed' && ['verified','needs-review'].includes(report.status);
  await callback('complete',{status:valid ? report.status : 'failed',manifest:valid ? {...result,checks:report.qa.checks.map(check=>({route:check.route,viewport:check.viewport,status:report.status==='verified' ? 'pass' : 'review'})),failures:report.failures,warnings:report.warnings} : {error:'Worker did not produce complete build and browser evidence'},artifact});
}
