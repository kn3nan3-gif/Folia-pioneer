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
  const scalarBodies = { '/json-null': null, '/json-boolean': false, '/json-number': -12.5, '/json-string': '中文🎵' };
  const utf8Text = '正文：中文 🎵🚀';
  let holdArrived, throwArrived, holdClosed;
  const holdRequest = new Promise(resolve => { holdArrived = resolve; });
  const throwRequest = new Promise(resolve => { throwArrived = resolve; });
  const abortedRequest = new Promise(resolve => { holdClosed = resolve; });
  server = http.createServer((req, res) => {
    hits.push(req.url);
    if (req.url === '/hold') { res.on('close', holdClosed); holdArrived(); return; }
    if (req.url === '/throw') { throwArrived(res); return; }
    if (Object.hasOwn(scalarBodies, req.url)) {
      res.setHeader('content-type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify(scalarBodies[req.url]));
    }
    if (req.url === '/utf8') { res.setHeader('content-type', 'text/plain; charset=utf-8'); return res.end(utf8Text); }
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
  // Strict equality checks both parsed scalar types and the response.body alias in the MAIN world.
  const extraBodies = { ...scalarBodies, '/utf8': utf8Text };
  const extraScript = `const expected=${JSON.stringify(extraBodies)};let index=0;
    lx.on('request',()=>new Promise((resolve,reject)=>{
      const path=Object.keys(expected)[index++];
      lx.request(${JSON.stringify(base)}+path,{},(err,resp,body)=>{try{
        if(err||!resp||resp.body!==body||body!==expected[path])throw Error('scalar/UTF8 body contract: '+path);
        resolve(${JSON.stringify(base + '/audio')});
      }catch(e){reject(e)}});
    }));lx.send('inited',{sources:{wy:{actions:['musicUrl'],qualitys:['128k']}}});`;
  runtime = new ScriptRuntime(electron, { script: extraScript, domains: [] }, { authorize, timeout: 5000 });
  await runtime.start();
  assert.equal(runtime.window.webContents.getLastWebPreferences().sandbox, true);
  for (const path of Object.keys(extraBodies)) await runtime.resolve({ mediaId: '123' }, 'standard');
  assert.deepEqual(hits.slice(4), Object.keys(extraBodies));
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
  // A callback-local catch must not be confused with an uncaught bridge callback failure.
  const caughtScript = `lx.on('request',()=>new Promise(resolve=>{
    lx.request(${JSON.stringify(base + '/text')},{},()=>{
      try{throw Error('owned caught callback');}catch(e){if(e.message!=='owned caught callback')throw e;}
      resolve(${JSON.stringify(base + '/audio')});
    });
  }));lx.send('inited',{sources:{wy:{actions:['musicUrl'],qualitys:['128k']}}});`;
  runtime = new ScriptRuntime(electron, { script: caughtScript, domains: [] }, { authorize, timeout: 5000 });
  await runtime.start();
  for (let i = 0; i < 2; i++) assert.match(await runtime.resolve({ mediaId: '123' }, 'standard'), /^folia-lx-media:/);
  assert.equal(runtime.closed, false); runtime.destroy();
  // Gate the throwing response on two real server arrivals, not a sleep or retry.
  const callbackScript = `let index=0;lx.on('request',()=>new Promise(()=>{
    const path=index++===0?'/hold':'/throw';
    lx.request(${JSON.stringify(base)}+path,{},()=>{throw Error('owned uncaught callback');});
  }));lx.send('inited',{sources:{wy:{actions:['musicUrl'],qualitys:['128k']}}});`;
  const hostRejections = [];
  const onUnhandled = reason => hostRejections.push(String(reason));
  process.on('unhandledRejection', onUnhandled);
  try {
    runtime = new ScriptRuntime(electron, { script: callbackScript, domains: [] }, { authorize, timeout: 5000 });
    await runtime.start();
    assert.equal(runtime.window.webContents.getLastWebPreferences().sandbox, true);
    const settled = Promise.allSettled([
      runtime.resolve({ mediaId: '123' }, 'standard'),
      runtime.resolve({ mediaId: '456' }, 'standard'),
    ]);
    const [, throwingResponse] = await Promise.all([holdRequest, throwRequest]);
    assert.equal(runtime.pending.size, 2); assert.equal(runtime.network.size, 2);
    const controllers = [...runtime.network.values()];
    throwingResponse.end('callback fixture');
    const results = await settled;
    for (const result of results) {
      assert.equal(result.status, 'rejected');
      assert.match(result.reason.message, /LX: bridge callback failed/);
    }
    assert.equal(runtime.closed, true); assert.equal(runtime.window.isDestroyed(), true);
    assert.equal(runtime.pending.size, 0); assert.equal(runtime.network.size, 0);
    assert.equal(controllers[0].signal.aborted, true);
    await abortedRequest;
    await assert.rejects(runtime.resolve({ mediaId: '123' }, 'standard'), /stopped/);
    runtime = new ScriptRuntime(electron, { script: caughtScript, domains: [] }, { authorize, timeout: 5000 });
    await runtime.start();
    assert.match(await runtime.resolve({ mediaId: '123' }, 'standard'), /^folia-lx-media:/);
    assert.equal(runtime.closed, false); runtime.destroy();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(hostRejections, []);
  } finally { process.removeListener('unhandledRejection', onUnhandled); }
  console.log(JSON.stringify({ electron: process.versions.electron, bodyCases: 4, scalarCases: 4, utf8: true, callbackFailClosed: true, callbackCaught: true, pendingNetworkCleanup: true, restart: true, hostUnhandledRejections: 0, qualityIntersection: true, duplicateInit: true, sandbox: true }));
  runtime.destroy(); server.closeAllConnections(); server.close(); keep.destroy(); clearTimeout(watchdog); electron.app.exit(0);
}).catch(error => { console.error(error.stack); runtime?.destroy(); server?.closeAllConnections(); server?.close(); keep?.destroy(); clearTimeout(watchdog); electron.app.exit(1); });
