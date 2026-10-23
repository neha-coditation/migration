import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const repoRoot=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const sourceDir=path.join(repoRoot,'server','neon');
const output=path.resolve(process.argv[2] || path.join(repoRoot,'dist','neon-migration-api.zip'));
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'neon-function-build-'));
const command=(program,args,cwd)=>new Promise((resolve,reject)=>{
 const child=spawn(program,args,{cwd,stdio:'inherit',env:{...process.env,npm_config_audit:'false',npm_config_fund:'false'}});
 child.on('error',reject);
 child.on('close',code=>code===0?resolve():reject(new Error(program+' failed with exit code '+code)));
});
try {
 const entry=process.argv.includes('--worker-only') ? 'production-worker-entry.mjs' : 'function-entry.mjs';
 const files={[entry]:'index.mjs','runtime.mjs':'runtime.mjs','api-handler.mjs':'api-handler.mjs','controller-state.mjs':'controller-state.mjs','worker-api.mjs':'worker-api.mjs'};
 if(entry==='production-worker-entry.mjs')files['production-worker.mjs']='production-worker.mjs';
 for(const [from,to] of Object.entries(files))await fs.copyFile(path.join(sourceDir,from),path.join(directory,to));
 await fs.writeFile(path.join(directory,'package.json'),JSON.stringify({
  name:'migration-neon-function',version:'0.0.1',private:true,type:'module',
  dependencies:{pg:'8.16.3'}
 },null,2)+'\n');
 await command('npm',['install','--omit=dev','--no-audit','--no-fund'],directory);
 await fs.mkdir(path.dirname(output),{recursive:true});
 await fs.rm(output,{force:true});
 await command('zip',['-q','-r',output,'.'],directory);
 console.log('Neon Function ZIP generated at '+output);
} finally {
 await fs.rm(directory,{recursive:true,force:true});
}
