const test = require('node:test');
const assert = require('node:assert/strict');
const { MediaApproval } = require('../electron/lx/media-approval.cjs');
const { MediaBroker } = require('../electron/lx/media.cjs');
const http = require('node:http');
// Owned candidate; no network work before an explicit current challenge decision.
test('unknown redirect stops before target DNS, revokes token and exposes only hostname', async () => {
    let checks = 0, hits = 0;
    const server = http.createServer((_req, res) => { hits++; res.writeHead(302, { location: 'https://other.example/audio?secret=hidden' }); res.end(); });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const approval = new MediaApproval('digest', async () => { checks++; return { url: new URL(`http://owned.example:${server.address().port}/audio`), address: '127.0.0.1' }; });
    const broker = new MediaBroker({ domains: approval.domains }, v => approval.authorizeStream(v));
    try {
        const pending = approval.authorizeCandidate('https://cdn.example/audio', 'r');
        const [c] = approval.list(); approval.decide({ id: c.id, digest: c.digest, approved: true, acknowledged: true }); await pending;
        const token = broker.issue('https://cdn.example/audio');
        assert.equal((await broker.fetch(new Request(token))).status, 502);
        assert.equal(checks, 2); assert.equal(hits, 1);
        assert.equal((await broker.fetch(new Request(token))).status, 410);
        assert.match(approval.failure, /other.example/); assert.equal(approval.failure.includes('secret'), false);
        assert.deepEqual(approval.domains, ['cdn.example']);
    } finally { approval.destroy(); broker.destroy(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
});
test('independent session media grant waits for explicit approval', async () => {
    let checks = 0;
    const approval = new MediaApproval('a'.repeat(64), async (url, domains) => { checks++; assert.deepEqual(domains, ['cdn.example']); return { url: new URL(url), address: '93.184.216.34' }; });
    const pending = approval.authorizeCandidate('https://cdn.example/audio?secret=hidden', 'request');
    assert.equal(checks, 0);
    const [challenge] = approval.list();
    assert.equal(challenge.hostname, 'cdn.example');
    assert.equal(JSON.stringify(challenge).includes('secret'), false);
    approval.decide({ id: challenge.id, digest: challenge.digest, approved: true, acknowledged: true });
    await pending; assert.equal(checks, 1);
    assert.deepEqual(approval.domains, ['cdn.example']);
    assert.throws(() => approval.decide({ id: challenge.id, digest: challenge.digest, approved: true, acknowledged: true }), /stale/);
    approval.destroy();
});
test('deny, timeout and destruction fail closed without DNS', async () => {
    for (const mode of ['deny', 'timeout', 'destroy']) {
        let checks = 0;
        const approval = new MediaApproval('digest', async () => { checks++; }, { ttl: 10 });
        const pending = approval.authorizeCandidate('https://cdn.example/a', 'r');
        const rejected = assert.rejects(pending, /denied|timeout|stopped/);
        const [c] = approval.list();
        if (mode === 'deny') approval.decide({ id: c.id, digest: c.digest, approved: false, acknowledged: true });
        if (mode === 'destroy') approval.destroy();
        await rejected; assert.equal(checks, 0); assert.deepEqual(approval.list(), []); assert.deepEqual(approval.domains, []);
        assert.throws(() => approval.decide({ id: c.id, digest: c.digest, approved: true, acknowledged: true }), /stale/);
        approval.destroy();
    }
});
test('strict URLs, digest, decision and pending budget; redirect never expands', async () => {
    const approval = new MediaApproval('digest', async () => { throw Error('should not DNS'); });
    for (const url of ['https://127.0.0.1/a', 'https://[::1]/a', 'https://user:pw@cdn.example/a', 'https://cdn.example:8443/a', 'file:///a', 'https://bad_.example/a', 'https://cdn.example./a']) await assert.rejects(approval.authorizeCandidate(url, url), /invalid/);
    const promises = [];
    for (let i = 0; i < 4; i++) promises.push(assert.rejects(approval.authorizeCandidate('https://cdn.example/a', String(i)), /stale/));
    await assert.rejects(approval.authorizeCandidate('https://cdn.example/a', '4'), /budget/);
    const [c] = approval.list();
    assert.throws(() => approval.decide({ id: c.id, digest: 'other', approved: true, acknowledged: true }), /stale/);
    assert.throws(() => approval.decide({ id: c.id, digest: c.digest, approved: true, acknowledged: false }), /explicit/);
    await assert.rejects(approval.authorizeStream('https://other.example/a'), /redirect stopped/);
    assert.deepEqual(approval.domains, []); approval.destroy(); await Promise.all(promises);
});
