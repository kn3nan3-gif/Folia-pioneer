const electron = require('electron');
const assert = require('node:assert/strict');
const { ScriptRuntime } = require('../electron/lx/runtime.cjs');
// Owned fixtures: discarded rejections must fail initialization in the real browser.
const init = "lx.on('request',()=> 'https://fixture.example/audio');lx.send('inited',{sources:{wy:{actions:['musicUrl'],qualitys:['128k']}}});";
electron.app.on('window-all-closed', () => {});
const watchdog = setTimeout(() => electron.app.exit(124), 30000);
let runtime;
electron.app.whenReady().then(async () => {
 const cases=[];
 for (const [name,script,reject] of [
 ['queued',`Promise.resolve().then(()=>{${init}throw Error('owned queued failure')})`,true],
 ['async',`(async()=>{await Promise.resolve();${init}throw Error('owned async failure')})()`,true],
 ['discarded',`void (async()=>{await Promise.resolve();${init}throw Error('owned discarded failure')})()`,true],
 ['timer',`setTimeout(()=>{void (async()=>{await Promise.resolve();${init}throw Error('owned timer failure')})()},5)`,true],
 ['sync fatal',`${init}throw Error('owned sync failure')`,true],
 ['invalid init',"lx.on('request',()=> '');lx.send('inited',{sources:{wy:{actions:['musicUrl'],qualitys:['bad']}}});",true],
 ['caught',`Promise.reject(Error('handled')).catch(()=>{});${init}`,false],
 ['caught async',`(async()=>{await Promise.resolve();throw Error('handled')})().catch(()=>{});${init}`,false],
 ['normal timer',`setTimeout(()=>{${init}},5)`,false]
 ]) {
  runtime=new ScriptRuntime(electron,{name,digest:'owned',domains:[],script},{timeout:2000,authorize:async()=>{}});
  try {
   if(reject){await assert.rejects(runtime.start(),/owned .* failure|native error\/unhandledrejection|invalid quality/);assert.equal(runtime.closed,true);}
   else {assert.deepEqual(await runtime.start(),['128k']); runtime.mediaApproval.onChanged = () => { const c=runtime.mediaApproval.list()[0]; if(c) runtime.mediaApproval.decide({id:c.id,digest:c.digest,approved:true,acknowledged:true}); }; assert.match(await runtime.resolve({mediaId:'123'},'standard'),/^folia-lx-media:/);}
   cases.push({name,pass:true});
  }catch(e){cases.push({name,pass:false,error:e.message});}finally{runtime.destroy();}
 }
 console.log(JSON.stringify({electron:process.versions.electron,cases}));
 clearTimeout(watchdog);electron.app.exit(cases.every(c=>c.pass)?0:1);
}).catch(e=>{console.error(e);runtime?.destroy();clearTimeout(watchdog);electron.app.exit(1)});
