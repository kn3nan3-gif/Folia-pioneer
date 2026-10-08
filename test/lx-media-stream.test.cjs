const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { MediaBroker } = require('../electron/lx/media.cjs');
// Owned HTTP tests exercise response lifecycle, not private transport mocks.
async function fixture(run) {
    let closed = 0;
    const data = Buffer.from('0123456789');
    const server = http.createServer((req, res) => {
        res.on('close', () => closed++);
        if (req.url === '/redirect') { res.writeHead(302, { location: '/private' }); res.write('redirect'); return; }
        if (req.url === '/stall') { res.writeHead(200); res.write('a'); return; }
        if (req.url === '/headers-stall') return;
        if (req.url === '/oversize') { res.writeHead(200, { 'content-length': 67108865 }); res.flushHeaders(); return; }
        const range = req.headers.range;
        if (range && req.url !== '/ignore') {
            const m = /^bytes=(\d*)-(\d*)$/.exec(range);
            const start = m[1] ? Number(m[1]) : Math.max(0, data.length - Number(m[2]));
            const end = m[1] && m[2] ? Math.min(Number(m[2]), data.length - 1) : data.length - 1;
            if (start >= data.length || start > end) { res.writeHead(416, { 'content-range': 'bytes */10' }); res.end(); return; }
            res.writeHead(206, { 'content-range': `bytes ${start}-${end}/10`, 'accept-ranges': 'bytes', 'content-length': end - start + 1 });
            res.end(req.method === 'HEAD' ? undefined : data.subarray(start, end + 1)); return;
        }
        res.writeHead(200, { 'content-length': data.length }); res.end(req.method === 'HEAD' ? undefined : data);
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    let blocked = false, privateHits = 0;
    const authorize = async value => {
        const url = new URL(value);
        if (url.origin !== base || url.pathname === '/private' || blocked) { privateHits++; throw new Error('private/rebind'); }
        return { url, address: '127.0.0.1' };
    };
    const broker = new MediaBroker({ domains: [] }, authorize);
    const get = (path, init) => broker.fetch(new Request(broker.issue(base + path), init));
    try { await run({ get, broker, closed: () => closed, block: () => { blocked = true; }, privateHits: () => privateHits }); }
    finally { broker.destroy(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
}
test('stream Range/HEAD/suffix/416 and ignored Range preserve truthful status and length', () => fixture(async ({ get }) => {
    for (const [range, text] of [['bytes=2-4', '234'], ['bytes=7-', '789'], ['bytes=-3', '789']]) {
        const r = await get('/audio', { headers: { range } }); assert.equal(r.status, 206); assert.equal(r.headers.get('content-length'), '3'); assert.equal(await r.text(), text);
    }
    const head = await get('/audio', { method: 'HEAD', headers: { range: 'bytes=2-4' } }); assert.equal(head.status, 206); assert.equal(head.headers.get('content-length'), '3'); assert.equal(await head.text(), '');
    const ignored = await get('/ignore', { headers: { range: 'bytes=2-4' } }); assert.equal(ignored.status, 200); assert.equal(await ignored.text(), '0123456789'); assert.equal(ignored.headers.get('content-range'), null);
    const bad = await get('/audio', { headers: { range: 'bytes=12-' } }); assert.equal(bad.status, 416); assert.equal(bad.headers.get('content-range'), 'bytes */10'); assert.equal(await bad.text(), '');
    assert.equal((await get('/oversize')).status, 502);
}));
test('consumer cancel frees all four active slots and destroys upstream; revoke aborts body', () => fixture(async ({ get, broker, closed }) => {
    const streams = await Promise.all(Array.from({ length: 4 }, () => get('/stall')));
    assert.equal((await get('/audio')).status, 429);
    for (const r of streams) await r.body.cancel();
    assert.equal(await (await get('/audio')).text(), '0123456789');
    await new Promise(r => setTimeout(r, 50)); assert.ok(closed() >= 4);
    const r = await get('/stall'), reader = r.body.getReader(); await reader.read(); broker.destroy(); await assert.rejects(reader.read());
}));
test('private redirect and changing authorization are rejected before target connection', () => fixture(async ({ get, block, privateHits }) => {
    assert.equal((await get('/redirect')).status, 502); assert.equal(privateHits(), 1);
    block(); assert.equal((await get('/audio')).status, 502);
}));
test('active stream expires and no longer owns a concurrency slot', () => fixture(async ({ get, broker }) => {
    broker.ttl = 100;
    const r = await get('/stall'), reader = r.body.getReader(); await reader.read();
    await assert.rejects(reader.read(), /cancelled/);
    assert.equal(broker.pending.size, 0);
}));
test('no headers and body without progress fail within finite 15 second deadline', { timeout: 22000 }, () => fixture(async ({ get }) => {
    const start = performance.now();
    const pending = get('/headers-stall');
    const body = await get('/stall'); await assert.rejects(body.text(), /progress/);
    assert.equal((await pending).status, 502);
    const elapsed = performance.now() - start; assert.ok(elapsed >= 14000 && elapsed < 21000, String(elapsed));
}));
