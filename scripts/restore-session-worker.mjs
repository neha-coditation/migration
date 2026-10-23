import fs from 'node:fs/promises';
import path from 'node:path';

const sessionId=process.env.SESSION_ID;
if(!/^[0-9a-f-]{36}$/i.test(sessionId||''))throw new Error('Invalid resume session');
const root=path.resolve('worker-output',sessionId);
const restored=path.join(root,'restored');
const folders=await fs.readdir(restored,{withFileTypes:true});
const saved=new Map();
const prefix=`migration-session-${sessionId}-page-`;
for(const dir of folders){
 if(!dir.isDirectory()||!dir.name.startsWith(prefix))continue;
 const folder=path.join(restored,dir.name);
 const checkpoint=JSON.parse(await fs.readFile(path.join(folder,'session-checkpoint.json'),'utf8'));
 if(!Array.isArray(checkpoint.urls)||!Array.isArray(checkpoint.completed)||checkpoint.version!==1)throw new Error('Invalid saved checkpoint');
 saved.set(dir.name.slice(prefix.length),{checkpoint,folder});
}
if(!saved.size)throw new Error('No valid saved page checkpoint artifacts found');
const latest=[...saved.values()].sort((a,b)=>b.checkpoint.completed.length-a.checkpoint.completed.length)[0].checkpoint;
for(const page of latest.completed){
 const number=String(page.index+1).padStart(5,'0');
 const artifact=saved.get(number);
 if(!artifact||!artifact.checkpoint.completed.some(x=>x.url===page.url&&x.jobId===page.jobId))throw new Error('Missing completed page checkpoint '+number);
 const report=JSON.parse(await fs.readFile(path.join(artifact.folder,'report.json'),'utf8'));
 if(report.source!==page.url||report.status!==page.status||report.build!=='passed'||report.qa?.notRun)throw new Error('Saved page provenance or QA mismatch '+number);
 const destination=path.join(root,'page-'+number);
 await fs.mkdir(destination,{recursive:true});
 await fs.copyFile(path.join(artifact.folder,'migration.zip'),path.join(destination,'migration.zip'));
 await fs.copyFile(path.join(artifact.folder,'report.json'),path.join(destination,'report.json'));
}
await fs.writeFile(path.join(root,'session.json'),JSON.stringify(latest,null,2));
console.log(JSON.stringify({event:'session-restored',sessionId,completed:latest.completed.length}));
