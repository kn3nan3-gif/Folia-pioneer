const { app, BrowserWindow, protocol } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { MediaBroker } = require('../electron/lx/media.cjs');
// Self-generated 180-second fixtures; loopback authorization is constructor-only, never IPC.
protocol.registerSchemesAsPrivileged([{ scheme: 'folia-lx-media', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
app.on('window-all-closed', () => {});
app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async () => {
    let player, broker;
    const metrics = [];
    const root = process.env.LX_AUDIO_FIXTURES;
    const fixtures = { mp3: fs.readFileSync(root + '/owned.mp3'), flac: fs.readFileSync(root + '/owned.flac') };
    let sent = 0, requests = 0;
    const server = http.createServer((req, res) => {
        requests++;
        const slow = req.url.includes('slow');
        const kind = req.url.includes('flac') ? 'flac' : 'mp3';
        const data = fixtures[kind];
        const m = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
        const start = m ? Number(m[1]) : 0;
        const end = m && m[2] ? Math.min(Number(m[2]), data.length - 1) : data.length - 1;
        const status = m ? 206 : 200;
        res.writeHead(status, { 'content-type': kind === 'mp3' ? 'audio/mpeg' : 'audio/flac', 'accept-ranges': 'bytes', 'content-length': end - start + 1, ...(m ? { 'content-range': `bytes ${start}-${end}/${data.length}` } : {}) });
        if (req.method === 'HEAD') return res.end();
        if (!slow) { sent += end - start + 1; res.end(data.subarray(start, end + 1)); return; }
        // Exactly 64 KiB each second: enough for audio bitrate, not full-object download in 15 s.
        let offset = start;
        const timer = setInterval(() => { const next = Math.min(offset + 65536, end + 1); sent += next - offset; res.write(data.subarray(offset, next)); offset = next; if (offset > end) { clearInterval(timer); res.end(); } }, 1000);
        res.on('close', () => clearInterval(timer));
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const authorize = async value => { const url = new URL(value); assert.equal(url.origin, base); return { url, address: '127.0.0.1' }; };
    broker = new MediaBroker({ domains: [], digest: 'owned-duration' }, authorize);
    protocol.handle('folia-lx-media', request => broker.fetch(request));
    try {
        player = new BrowserWindow({ show: false, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } });
        await player.loadURL('data:text/html,<body>Owned duration</body>');
        for (const kind of ['mp3', 'flac']) {
            for (const slow of [false, true]) {
                // Revoke the prior sample and isolate deadlines/concurrency for each measurement.
                broker.destroy();
                broker = new MediaBroker({ domains: [], digest: 'owned-duration' }, authorize);
                const token = broker.issue(`${base}/${slow ? 'slow-' : ''}${kind}`);
                const before = performance.now(), oldSent = sent, oldReq = requests;
                const result = await player.webContents.executeJavaScript(`new Promise(resolve => {
                    const a = new Audio(${JSON.stringify(token)}); window.ownedAudio = a; a.crossOrigin = 'anonymous';
                    const seeks = []; let phase = 0, frontStartedMs; const started = performance.now();
                    const finish = x => { clearTimeout(timer); a.pause(); a.removeAttribute('src'); a.load(); resolve({ frontStartedMs, ...x }); };
                    const timer = setTimeout(() => finish({ ok: false, timeout: true }), 40000);
                    a.onerror = () => finish({ ok: false, mediaError: a.error?.code });
                    a.onloadedmetadata = () => { a.play().catch(e => finish({ ok: false, error: String(e) })); };
                    a.onseeked = () => { seeks.push(a.currentTime); if (phase === 1) { phase = 2; a.currentTime = 170; } else if (phase === 2) { phase = 3; a.play().catch(e => finish({ ok: false, error: String(e) })); } };
                    a.ontimeupdate = () => {
                        if (phase === 0 && a.currentTime > 0.2) { frontStartedMs = performance.now() - started; phase = 1; a.pause(); a.currentTime = 5; }
                        else if (phase === 3 && a.currentTime > 170.1) finish({ ok: true, duration: a.duration, seeks, playbackTime: a.currentTime });
                    };
                    a.load();
                })`);
                const metric = { kind, slow, rateBytesPerSecond: slow ? 65536 : null, fixtureBytes: fixtures[kind].length, elapsedMs: performance.now() - before, sentBytes: sent - oldSent, requests: requests - oldReq, ...result };
                metrics.push(metric); console.log(JSON.stringify(metric));
                { assert.equal(result.ok, true); assert.ok(result.frontStartedMs < 15000); if (slow) assert.ok(metric.sentBytes < fixtures[kind].length); assert.ok(Math.abs(result.duration - 180) < 0.2); assert.ok(result.seeks.some(x => Math.abs(x - 5) < 0.2)); assert.ok(result.seeks.some(x => Math.abs(x - 170) < 0.2)); }
            }
        }
        console.log(JSON.stringify({ realElectron: true, sandbox: true, metrics, usabilityBlocked: metrics.some(x => !x.ok) }));
        broker.destroy(); player.destroy(); server.closeAllConnections(); server.close(); app.exit(metrics.some(x => !x.ok) ? 2 : 0);
    } catch (e) { console.error(e.stack); broker?.destroy(); player?.destroy(); server.closeAllConnections(); server.close(); app.exit(1); }
});
