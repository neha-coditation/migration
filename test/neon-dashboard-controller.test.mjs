import test from 'node:test';import assert from 'node:assert/strict';
import {validArchivePaths,verifyArtifact} from '../scripts/neon-dashboard-controller.mjs';
test('dashboard importer rejects escaping archives and artifact provenance mismatches',()=>{
 assert.equal(validArchivePaths(['report.json','evidence/source/a--top.png']),true);
 for(const paths of [['../secret'],['/etc/x'],['evidence/../../x'],['..\\x']])assert.equal(validArchivePaths(paths),false);
 const job={jobId:'j',attempt:1,runId:3,artifact:{id:4,sha256:'f'.repeat(64),bytes:5}};
 const artifact={id:4,workflow_run:{id:3},expired:false,digest:'sha256:'+'f'.repeat(64),size_in_bytes:5,name:'neon-j-1'};
 assert.doesNotThrow(()=>verifyArtifact(job,artifact));
 for(const patch of [{id:8},{workflow_run:{id:2}},{expired:true},{digest:'bad'},{size_in_bytes:9},{name:'another-job'}])assert.throws(()=>verifyArtifact(job,{...artifact,...patch}));
});
