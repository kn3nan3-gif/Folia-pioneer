const electron = require('electron');
const http = require('node:http');
const assert = require('node:assert/strict');
const { ScriptRuntime } = require('../electron/lx/runtime.cjs');
// Owned HTTP fixtures exercise the real sandbox bridge; no production private-network grant.
electron.app.on('window-all-closed', () => {});
let runtime, server, keep;
const watchdog = setTimeout(() => electron.app.exit(1), 20000);
electron.app.whenReady().then(async () => {
  keep = new electron.BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  const hits = [];
  server = http.createServer((req, res) => {
    hits.push(req.url);
    if (req.url === '/broken') return req.socket.destroy();
    if (req.url === '/json') { res.setHeader('content-type', 'application/json'); return res.end('{"ok":true,"nested":{"n":1}}'); }
    if (req.url === '/http-error') { res.writeHead(404); return res.end('missing'); }
    res.end('plain text');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const authorize = async value => { const url = new URL(value); assert.equal(url.origin, base); return { url, address: '127.0.0.1' }; };
  const script = `let index=0; const paths=['/json','/text','/http-error','/broken'];
    lx.on('request',()=>new Promise((resolve,reject)=>{const path=paths[index++];
      lx.request(${JSON.stringify(base)}+path,{},(err,resp,body)=>{try{
        if(path==='/broken'){if(!err||resp!==null||body!==null)throw Error('error callback contract');}
        else {if(err||resp.body!==body)throw Error('response.body alias missing');
          if(path==='/json'&&(!body.ok||body.nested.n!==1))throw Error('JSON body');
          if(path==='/text'&&body!=='plain text')throw Error('text body');
          if(path==='/http-error'&&(resp.statusCode!==404||body!=='missing'))throw Error('HTTP error body');}
        resolve(${JSON.stringify(base + '/audio')});
      }catch(e){reject(e)}});
    })); lx.send('inited',{sources:{wy:{type:'music',actions:['musicUrl'],qualitys:['128k']}}});`;
  runtime = new ScriptRuntime(electron, { script, domains: [] }, { authorize, timeout: 5000 });
  await runtime.start();
  assert.equal(runtime.window.webContents.getLastWebPreferences().sandbox, true);
  for (let i = 0; i < 4; i++) await runtime.resolve({ mediaId: '123' }, 'standard');
  assert.deepEqual(hits, ['/json', '/text', '/http-error', '/broken']);
  runtime.destroy();
  const initScript = sources => `lx.on('request',()=>${JSON.stringify(base + '/audio')});lx.send('inited',{sources:${JSON.stringify(sources)}});`;
  const mixed = { wy: { type: 'music', actions: ['musicUrl'], qualitys: ['flac', 'future', '128k', 'flac'] }, kw: { type: 'music', actions: ['musicUrl'], qualitys: ['320k'] } };
  runtime = new ScriptRuntime(electron, { script: initScript(mixed), domains: [] }, { authorize });
  assert.deepEqual(await runtime.start(), ['128k', 'flac']);
  await runtime.resolve({ mediaId: '123' }, 'lossless');
  await assert.rejects(runtime.resolve({ mediaId: '123' }, 'high'), /unsupported/);
  runtime.destroy();
  for (const sources of [
    { wy: { type: 'music', actions: ['musicUrl'], qualitys: ['future'] } },
    { wy: { type: 'video', actions: ['musicUrl'], qualitys: ['128k'] } },
    { kw: { type: 'music', actions: ['musicUrl'], qualitys: ['128k'] } },
  ]) {
    runtime = new ScriptRuntime(electron, { script: initScript(sources), domains: [] }, { authorize });
    await assert.rejects(runtime.start(), /quality|type|wy/); assert.equal(runtime.closed, true);
  }
  // A caught duplicate is rejected to the caller; discarded rejection remains fatal (native monitor).
  const first = initScript({ wy: { actions: ['musicUrl'], qualitys: ['128k'] } });
  runtime = new ScriptRuntime(electron, { script: first + `lx.send('inited',{}).then(()=>{throw Error('duplicate accepted')},()=>{});`, domains: [] }, { authorize });
  await runtime.start(); assert.deepEqual(runtime.qualities, ['128k']); runtime.destroy();
  runtime = new ScriptRuntime(electron, { script: first + `lx.send('inited',{});`, domains: [] }, { authorize });
  await assert.rejects(runtime.start(), /LX: initialization|native error\/unhandledrejection/); assert.equal(runtime.closed, true);
  console.log(JSON.stringify({ electron: process.versions.electron, bodyCases: 4, qualityIntersection: true, duplicateInit: true, sandbox: true }));
  runtime.destroy(); server.closeAllConnections(); server.close(); keep.destroy(); clearTimeout(watchdog); electron.app.exit(0);
}).catch(error => { console.error(error.stack); runtime?.destroy(); server?.closeAllConnections(); server?.close(); keep?.destroy(); clearTimeout(watchdog); electron.app.exit(1); });
