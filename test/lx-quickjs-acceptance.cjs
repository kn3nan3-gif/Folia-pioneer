const { app, BrowserWindow } = require('electron');
const electron = require('electron');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { ScriptRuntime } = require(process.env.FOLIA_QJS_RUNTIME || '../electron/lx/runtime.cjs');
// Real production runtime, Windows utilityProcess; owned fixtures only.
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
 const keep = new BrowserWindow({show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}});
 const results={electron:process.versions.electron,quickjs:'0.23.0',cases:[]};
 const init=`lx.on('request', async d => { await new Promise(r=>setTimeout(r,5)); return 'https://fixture.example/audio.wav'; }); lx.send('inited',{sources:{wy:{name:'wy',type:'music',actions:['musicUrl'],qualitys:['128k','320k','flac','flac24bit']}}});`;
 const base={name:'owned',digest:'owned',domains:[]}; let runtime;
 try {
  const guard=`for(const k of ['RTCPeerConnection','fetch','XMLHttpRequest','WebSocket','document','window','navigator','process','require','Buffer','WebAssembly'])if(typeof globalThis[k]!=='undefined')throw Error(k); if(lx.request.constructor('return typeof process')()!=='undefined')throw Error('escape');`;
  runtime=new ScriptRuntime(electron,{...base,script:guard+init},{authorize:async()=>{}}); assert.deepEqual(await runtime.start(),['128k','320k','flac','flac24bit']);
  for(const q of ['standard','high','lossless','hires']) assert.match(await runtime.resolve({providerId:'netease',mediaId:'123',name:'owned'},q),/^folia-lx-media:/);
  runtime.destroy(); assert.equal(runtime.pending.size,0); results.cases.push('realm/four qualities/timers/cleanup');
  for(const [name,script] of [['cpu','while(true){}'],['oom','new Array(10000000).fill(1)'],['module',"import x from 'node:fs'"]]) {
   const start=Date.now(); runtime=new ScriptRuntime(electron,{...base,script},{timeout:3000}); await assert.rejects(runtime.start()); assert.equal(runtime.closed,true); results.cases.push({name,ms:Date.now()-start});
  }
  const http=require('node:http'), dgram=require('node:dgram');
  let hits=0, udpPackets=0;
  const udp=dgram.createSocket('udp4'); udp.on('message',()=>udpPackets++); await new Promise(r=>udp.bind(0,'127.0.0.1',r));
  const server=http.createServer((req,res)=>{hits++;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({url:'https://fixture.example/audio.wav'}));}); await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const url='http://fixture.example:'+server.address().port+'/owned';
  try {
   const script=`lx.on('request', d=>new Promise((resolve,reject)=>lx.request(${JSON.stringify(url)},{method:'GET'},(e,res,body)=>{if(e)return reject(e);if(res.statusCode!==200)throw Error('status');resolve(body.url)})));lx.send('inited',{sources:{wy:{actions:['musicUrl'],qualitys:['128k']}}});`;
   runtime=new ScriptRuntime(electron,{...base,script},{authorize:async value=>({url:new URL(value),address:'127.0.0.1'})}); await runtime.start(); await runtime.resolve({providerId:'netease',mediaId:'123'},'standard'); assert.equal(hits,1); runtime.destroy();
   await new Promise(r=>setTimeout(r,100)); assert.equal(udpPackets,0); results.cases.push({name:'production broker HTTP / domains empty realm',hits,udpPackets});
  } finally { runtime?.destroy();await new Promise(r=>server.close(r));udp.close(); }
  results.pass=true;
 }catch(error){results.error=String(error.stack);results.pass=false;}finally{runtime?.destroy();fs.writeFileSync(process.env.FOLIA_QJS_RESULT||'quickjs-result.json',JSON.stringify(results,null,2));keep.destroy();app.exit(results.pass?0:1);}
});
