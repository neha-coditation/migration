import fs from 'node:fs/promises';
import path from 'node:path';
import {migrate} from '../server/pipeline.mjs';
import {launchBrowser} from '../server/browser.mjs';
const id=process.env.MIGRATION_JOB_ID;
if(!/^[a-f\d-]{36}$/.test(id||''))throw new Error('A valid migration job ID is required.');
const root=path.resolve('worker-output',id);
await fs.mkdir(root,{recursive:true});
const controller=new AbortController();
const timeout=setTimeout(()=>controller.abort(),40*60*1000);
try {
 // Refuse a successful worker result if the actual checking browser cannot start.
 const browser=await launchBrowser();
 try {const page=await browser.newPage();await page.goto('about:blank');} finally {await browser.close();}
 const visualTolerance=Number(process.env.MIGRATION_VISUAL_TOLERANCE||0);
 if(!Number.isFinite(visualTolerance)||visualTolerance<0||visualTolerance>2)throw new Error('Invalid visual tolerance.');
 const job={id,url:process.env.MIGRATION_SOURCE_URL,maxPages:1,extraPaths:[],visualTolerance,maxRepairAttempts:3};
 const report=await migrate(job,root,{signal:controller.signal,update:({stage,progress})=>console.log(JSON.stringify({stage,progress}))});
 if(report.qa?.notRun)throw new Error('Browser QA did not execute. This worker result cannot be accepted.');
 await fs.writeFile(path.join(root,'worker-result.json'),JSON.stringify({jobId:id,url:job.url,status:report.status,browserExecuted:true,build:report.build}));
} catch(error) {
 await fs.writeFile(path.join(root,'worker-error.json'),JSON.stringify({jobId:id,message:error.message}));
 console.error('Migration worker failed; inspect the downloaded worker-error.json.');
 process.exitCode=1;
} finally {
 clearTimeout(timeout);
 for(const name of ['node_modules','.astro'])await fs.rm(path.join(root,'astro-project',name),{recursive:true,force:true});
}
