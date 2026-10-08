const test = require('node:test');
const assert = require('node:assert/strict');
const { SourceManager } = require('../electron/lx/manager.cjs');
const { scriptDigest } = require('../electron/lx/contract.cjs');
const { reviewScript } = require('../electron/lx/review.cjs');
const fs = require('node:fs/promises');
const path = require('node:path');
// No Electron host is supplied: denied approval must never create a realm.
test('enable rejects missing, mismatched and unacknowledged approval before execution', async () => {
 const manager=new SourceManager({},'unused');
 const script='// owned fixture',digest=scriptDigest(script);
 manager.records=[{name:'owned',script,digest,domains:[]}];
 await assert.rejects(manager.enable(digest,[]),/approval/);
 const report=manager.list()[0].review;
 await assert.rejects(manager.enable(digest,[],{digest:'b'.repeat(64),reviewVersion:report.version,riskVersion:report.riskVersion,acknowledged:true}),/approval/);
 await assert.rejects(manager.enable(digest,[],{digest,reviewVersion:report.version,riskVersion:report.riskVersion,acknowledged:false}),/approval/);
 assert.equal(manager.runtime,null);assert.equal(manager.active,null);
 const ack={digest,reviewVersion:report.version,riskVersion:report.riskVersion,acknowledged:true};
 await assert.rejects(manager.enable(digest,[],{...ack,reviewVersion:'old'}),/approval/);
 await assert.rejects(manager.enable(digest,[],{...ack,riskVersion:'old'}),/approval/);
 manager.records[0].script+='\nfetch("https://owned.example")';
 await assert.rejects(manager.enable(digest,[],ack),/approval/);
});
test('import never executes; persisted forged review is ignored and lexical limits disclosed',async()=>{
 const dir=await fs.mkdtemp(path.join(process.env.TMPDIR,'lx-review-'));
 try{
  const file=path.join(dir,'owned.js');const script='throw Error("must never execute"); fetch("https://owned.example/a"); eval("x");';
  await fs.writeFile(file,script);
  const manager=new SourceManager({dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[file]})}},path.join(dir,'data'));
  const [record]=await manager.importLocal();assert.equal(manager.runtime,null);assert.equal(record.enabled,false);
  assert.deepEqual(record.review.domains,['owned.example']);assert.ok(record.review.findings.includes('dynamic-code'));assert.equal(record.review.method,'lexical');assert.match(record.review.limits,/No AST/);
  manager.records[0].review={findings:[],version:'forged'};await manager.save();
  const restarted=new SourceManager({},manager.directory);await restarted.load();
  assert.deepEqual(restarted.list()[0].review,reviewScript(script));
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
