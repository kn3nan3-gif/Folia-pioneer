const electron = require('electron');
const { app, BrowserWindow } = electron;
const dgram = require('node:dgram');
const http = require('node:http');
const assert = require('node:assert/strict');
const { ScriptRuntime } = require(process.env.FOLIA_QJS_RUNTIME || '../electron/lx/runtime.cjs');
// Production no-DOM realm: execute historical RTC access paths; own UDP/HTTP controls.
app.on('window-all-closed',()=>{});
let runtime,keep,udp,server;const watchdog=setTimeout(()=>app.exit(1),20000);
app.whenReady().then(async()=>{
 keep=new BrowserWindow({show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}});
 let udpHits=0,httpHits=0;udp=dgram.createSocket('udp4');udp.on('message',()=>udpHits++);await new Promise(r=>udp.bind(0,'127.0.0.1',r));
 server=http.createServer((q,s)=>{httpHits++;s.setHeader('content-type','application/json');s.end(JSON.stringify({url:'https://fixture.example/audio'}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://fixture.example:${server.address().port}`;
 const script=`let checks=0;for(const phase of ['main','frame','afterMeta'])for(const key of ['RTCPeerConnection','webkitRTCPeerConnection'])for(const access of ['direct','descriptor','prototype','constructor'])for(let repeat=0;repeat<4;repeat++){let candidate;if(access==='direct')candidate=globalThis[key];if(access==='descriptor')candidate=Object.getOwnPropertyDescriptor(globalThis,key)?.value;if(access==='prototype'){let p=globalThis;while(p=Object.getPrototypeOf(p)){const d=Object.getOwnPropertyDescriptor(p,key);if(d?.value)candidate=d.value;if(d?.get)candidate=d.get.call(globalThis);}}if(access==='constructor')candidate=globalThis[key]?.prototype?.constructor;if(candidate!==undefined)throw Error('RTC capability');checks++;}if(checks!==96)throw Error('coverage');for(const key of ['window','document','Worker','navigator','process','require','Buffer','fetch','WebSocket'])if(typeof globalThis[key]!=='undefined')throw Error(key);if(lx.request.constructor('return typeof process')()!=='undefined')throw Error('constructor escape');lx.on('request',async()=>{if(await (async()=>{}).constructor('return typeof process')()!=='undefined')throw Error('async escape');return await new Promise((resolve,reject)=>lx.request(${JSON.stringify(base)},{},(e,r,b)=>e?reject(e):resolve(b.url)))});lx.send('inited',{sources:{wy:{actions:['musicUrl'],qualitys:['128k']}}});`;
 runtime=new ScriptRuntime(electron,{name:'owned RTC',digest:'owned',script,domains:[]},{authorize:async v=>({url:new URL(v),address:'127.0.0.1'})});await runtime.start();await runtime.resolve({mediaId:'123'},'standard');assert.equal(httpHits,1);await new Promise(r=>setTimeout(r,200));assert.equal(udpHits,0);assert.equal(runtime.closed,false);runtime.destroy();
 const normal=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});await normal.loadURL('data:text/html,normal');assert.equal(await normal.webContents.executeJavaScript('(()=>{const p=new RTCPeerConnection();p.close();return true})()'),true);normal.destroy();
 console.log(JSON.stringify({electron:process.versions.electron,productionQuickJS:true,accessChecks:96,RTC:'unsupported',DOMFrameMeta:'unsupported; paths not browser-native attacks',udpHits,httpHits,constructorEscape:false,asyncEscape:false,normalSessionWebRTC:true}));runtime.destroy();udp.close();server.closeAllConnections();server.close();keep.destroy();clearTimeout(watchdog);app.exit(0);
}).catch(e=>{console.error(e.stack);runtime?.destroy();udp?.close();server?.closeAllConnections();server?.close();keep?.destroy();clearTimeout(watchdog);app.exit(1)});
