import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * One process for an ordered group of pages, with an atomic checkpoint after
 * every page. checkpoint() must durably publish the page artifact before the
 * manifest records it as completed. Resume skips only confirmed artifacts.
 */
export async function runMigrationSession({urls,root,runPage,checkpoint,shouldFinish=async()=>false,reportProgress=()=>{}}) {
 if (!Array.isArray(urls) || !urls.length || urls.some(x=>typeof x!=='string'||!x)) throw new TypeError('Provide selected page URLs');
 if (typeof runPage!=='function'||typeof checkpoint!=='function')throw new TypeError('Worker and durable checkpoint callbacks required');
 await fs.mkdir(root,{recursive:true});
 const file=path.join(root,'session.json');
 let state;
 try{state=JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;state={version:1,urls,completed:[],failed:[],createdAt:new Date().toISOString()};}
 if(JSON.stringify(state.urls)!==JSON.stringify(urls))throw new Error('Resumed session page selection does not match');
 const done=new Map(state.completed.map(item=>[item.url,item]));
 for(const [index,url] of urls.entries()){
  if(done.has(url))continue;
  if(await shouldFinish())break;
  const jobId=`page-${String(index+1).padStart(5,'0')}`;
  const directory=path.join(root,jobId);
  await fs.mkdir(directory,{recursive:true});
  reportProgress({url,index,stage:'working'});
  try{
   const result=await runPage({url,index,directory,jobId});
   if(!['verified','needs-review','qa-blocked'].includes(result.status))throw new Error('Page did not produce a completed QA result');
   // Publish first: a failed artifact upload cannot mark a page complete.
   await checkpoint({url,index,directory,jobId,result});
   const completed={url,index,jobId,status:result.status,completedAt:new Date().toISOString()};
   state.completed.push(completed);done.set(url,completed);
   state.failed=state.failed.filter(x=>x.url!==url);
   await writeCheckpoint(file,state);
   reportProgress({url,index,stage:'checkpointed'});
  }catch(error){
   state.failed=state.failed.filter(x=>x.url!==url).concat({url,index,error:String(error.message).slice(0,500)});
   await writeCheckpoint(file,state);
   throw error; // No silent success or skipping failed pages.
  }
 }
 state.finishedEarly=state.completed.length<urls.length;
 await writeCheckpoint(file,state);
 return state;
}
async function writeCheckpoint(file,data){
 const temp=file+'.tmp';
 await fs.writeFile(temp,JSON.stringify(data,null,2));
 await fs.rename(temp,file);
}
