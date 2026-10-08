const electron = require('electron');
const { app, BrowserWindow, protocol } = electron;
const http = require('node:http');
const assert = require('node:assert/strict');
const { ScriptRuntime } = require(process.env.FOLIA_QJS_RUNTIME || '../electron/lx/runtime.cjs');
// Self-owned network and audio fixture; authorization override exists only in this constructor.
protocol.registerSchemesAsPrivileged([{scheme:'folia-lx-media',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
app.on('window-all-closed', () => {});
app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async () => {
    let privateHits=0, ranges=0, runtime, player;
    const wav=Buffer.alloc(16044); wav.write('RIFF'); wav.writeUInt32LE(wav.length-8,4); wav.write('WAVEfmt ',8); wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22); wav.writeUInt32LE(8000,24); wav.writeUInt32LE(16000,28); wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34); wav.write('data',36); wav.writeUInt32LE(16000,40);
    const server=http.createServer((req,res)=>{
        if(req.url==='/resolve') { res.setHeader('content-type','application/json');res.end(JSON.stringify({url:base+'/owned.wav'}));return; }
        if(req.url==='/private') { privateHits++; res.end('secret'); return; }
        if(req.url==='/redirect') { res.writeHead(302,{location:base+'/private'}); res.end(); return; }
        if(req.url==='/slow') { res.writeHead(200,{'content-type':'audio/wav'}); res.write(wav.subarray(0,44)); return; }
        const range=req.headers.range; const m=range?.match(/^bytes=(\d+)-(\d*)$/);
        if(m) { ranges++; const start=Number(m[1]),end=m[2]?Math.min(Number(m[2]),wav.length-1):wav.length-1; res.writeHead(206,{'content-type':'audio/wav','accept-ranges':'bytes','content-range':`bytes ${start}-${end}/${wav.length}`}); res.end(wav.subarray(start,end+1)); }
        else { res.writeHead(200,{'content-type':'audio/wav','accept-ranges':'bytes'}); res.end(wav); }
    });
    await new Promise(r=>server.listen(0,'127.0.0.1',r)); const base=`http://127.0.0.1:${server.address().port}`;
    let rebind=false;
    const authorize=async value=>{const url=new URL(value); if(url.origin!==base || url.pathname==='/private' || (rebind && url.pathname==='/rebind')) throw new Error('LX: private network denied'); return {url,address:'127.0.0.1'};};
    const make=async endpoint=>{runtime?.destroy(); runtime=new ScriptRuntime(electron,{name:'Owned media fixture',digest:'owned',domains:[],script:`lx.on('request',()=> ${endpoint==='resolve'?`new Promise((resolve,reject)=>lx.request('${base}/resolve',{},(e,r,b)=>e?reject(e):resolve(b.url)))`:`'${base}/${endpoint}'`}); lx.send('inited',{sources:{wy:{actions:['musicUrl'],qualitys:['128k']}}});`},{authorize,timeout:5000}); await runtime.start(); return runtime.resolve({mediaId:'123'},'standard');};
    const get=async (url,range)=> url.startsWith('folia-lx-media:') ? runtime.media.fetch(new Request(url,{headers:range?{Range:range}:{}})) : fetch(url,{headers:range?{Range:range}:{}});
    try {
        const redirect=await make('redirect'); let denied=false;
        try { const r=await get(redirect); denied=!r.ok; await r.arrayBuffer(); } catch { denied=true; }
        assert.equal(privateHits,0,'media redirect reached denied private endpoint'); assert.equal(denied,true);
        const rebound=await make('rebind'); rebind=true; let reboundDenied=false; try { const r=await get(rebound); reboundDenied=!r.ok; } catch {reboundDenied=true;} assert.equal(reboundDenied,true,'media access did not reauthorize DNS'); rebind=false;
        const url=await make('resolve'); assert.match(url,/^folia-lx-media:\/\/audio\/[a-f0-9]{64}$/); assert.equal(url.includes(base),false);
        const ranged=await get(url,'bytes=44-99'); assert.equal(ranged.status,206); assert.equal((await ranged.arrayBuffer()).byteLength,56); assert.equal(ranged.headers.get('content-range'),'bytes 44-99/16044');
        protocol.handle('folia-lx-media',request=>runtime.media.fetch(request));
        player=new BrowserWindow({show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}}); await player.loadURL('data:text/html,<body>Owned audio</body>');
        const playback=await player.webContents.executeJavaScript(`new Promise((resolve,reject)=>{const a=new Audio(${JSON.stringify(url)}); a.crossOrigin='anonymous'; let seeked=false; a.onloadedmetadata=()=>{a.currentTime=0.5;}; a.onseeked=()=>{seeked=true;}; a.onended=()=>resolve({ended:true,seeked,duration:a.duration,currentTime:a.currentTime}); a.onerror=()=>reject(new Error('media '+a.error?.code)); a.play().catch(reject);setTimeout(()=>reject(new Error('audio timeout')),6000);})`);
        assert.equal(playback.ended,true); assert.equal(playback.seeked,true); assert.equal(playback.duration,1);
        runtime.destroy(); assert.equal((await get(url)).status,410);
        const slow=await make('slow'); const streaming=await get(slow); assert.equal(streaming.status,200); const reader=streaming.body.getReader(); assert.equal((await reader.read()).value.byteLength,44); runtime.destroy(); await assert.rejects(reader.read()); assert.equal((await get(slow)).status,410);
        console.log(JSON.stringify({realElectron:true,sandbox:true,redirectDenied:true,privateHits,rebindDenied:true,rangeBytes:56,ranges,revoked:true,pendingAborted:true,playback}));
        player.destroy(); server.closeAllConnections(); server.close(); app.exit(0);
    } catch(e) { console.error(e.stack); runtime?.destroy(); player?.destroy(); server.closeAllConnections(); server.close(); app.exit(1); }
}).catch(e=>{console.error(e.stack);app.exit(1);});
