const { app, BrowserWindow, ipcMain, session, protocol } = require('electron');
const assert = require('node:assert/strict');
const http = require('node:http');
const { ScriptRuntime } = require('../electron/lx/runtime.cjs');
// Real sandbox realm, owned audio and explicit challenge decisions; injected exact fixture transport only.
protocol.registerSchemesAsPrivileged([{ scheme: 'folia-lx-media', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async () => {
    let hits = 0, dns = 0;
    const wav = Buffer.alloc(16044); wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(16000, 40);
    const server = http.createServer((_req, res) => { hits++; res.setHeader('content-type', 'audio/wav'); res.end(wav); });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const script = `lx.on(lx.EVENT_NAMES.request, () => Promise.resolve('https://cdn.example/owned.wav?secret=hidden')); lx.send(lx.EVENT_NAMES.inited,{sources:{wy:{actions:['musicUrl'],qualitys:['128k']}}});`;
    const runtime = new ScriptRuntime({ BrowserWindow, ipcMain, session }, { digest: 'a'.repeat(64), script, domains: ['api.example'] }, { authorize: async (value, domains) => {
        dns++; assert.equal(new URL(value).hostname, 'cdn.example'); assert.deepEqual(domains, ['cdn.example']);
        return { url: new URL(`http://owned.example:${server.address().port}/owned.wav`), address: '127.0.0.1' };
    } });
    let player;
    try {
        await runtime.start(); assert.equal(runtime.window.webContents.getLastWebPreferences().sandbox, true);
        const challenge = () => new Promise(resolve => { runtime.onStateChanged = () => { const c = runtime.mediaApproval.list()[0]; if (c) resolve(c); }; });
        let event = challenge(); const denied = runtime.resolve({ mediaId: '123' }, 'standard'); const rejection = assert.rejects(denied, /denied/);
        let c = await event; assert.equal(hits, 0); assert.equal(dns, 0); assert.equal(runtime.media.tokens.size, 0); assert.equal(JSON.stringify(c).includes('secret'), false);
        runtime.mediaApproval.decide({ id: c.id, digest: c.digest, approved: false, acknowledged: true }); await rejection;
        event = challenge(); const resolving = runtime.resolve({ mediaId: '123' }, 'standard'); c = await event;
        runtime.mediaApproval.decide({ id: c.id, digest: c.digest, approved: true, acknowledged: true });
        const token = await resolving; assert.equal(hits, 0); assert.equal(dns, 1);
        protocol.handle('folia-lx-media', req => runtime.media.fetch(req));
        player = new BrowserWindow({ show: false, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } });
        await player.loadURL('data:text/html,<body>Owned player</body>');
        const result = await player.webContents.executeJavaScript(`new Promise((resolve,reject)=>{ const a=new Audio(${JSON.stringify(token)}); a.onended=()=>resolve({ended:true,duration:a.duration}); a.onerror=()=>reject(Error('Audio error')); a.play().catch(reject); setTimeout(()=>reject(Error('timeout')),5000); })`);
        assert.equal(result.ended, true); assert.equal(result.duration, 1); assert.ok(hits > 0); assert.ok(dns > 1);
        assert.deepEqual(runtime.record.domains, ['api.example']); runtime.destroy(); assert.equal((await runtime.media.fetch(new Request(token))).status, 410);
        console.log(JSON.stringify({ sandbox: true, beforeApprovalHits: 0, deny: true, nativeAudio: result, revoke: true }));
        player.destroy(); server.closeAllConnections(); server.close(); app.exit(0);
    } catch (error) { console.error(error.stack); runtime.destroy(); player?.destroy(); server.closeAllConnections(); server.close(); app.exit(1); }
}).catch(error => { console.error(error); app.exit(1); });
