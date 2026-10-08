const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const root = process.env.FOLIA_LX_PROJECT || path.resolve(__dirname, '..');
const { request, authorizeUrl } = require(path.join(root, 'electron/lx/network.cjs'));
const { requestStream } = require(path.join(root, 'electron/lx/media-stream.cjs'));
const { MediaBroker } = require(path.join(root, 'electron/lx/media.cjs'));
// Owned HTTP fixture: callback exceptions must reject locally, release slots and keep the host alive.
async function run() {
    let privateHits = 0, sockets = new Set();
    const server = http.createServer((req, res) => {
        if (req.url === '/bad') { res.writeHead(302, { location: 'http://[' }); res.end(); }
        else if (req.url === '/relative') { res.writeHead(302, { location: '/ok' }); res.end(); }
        else if (req.url === '/absolute') { res.writeHead(302, { location: base + '/ok' }); res.end(); }
        else if (req.url === '/denied') { res.writeHead(302, { location: 'http://127.0.0.1/private' }); res.end(); }
        else { if (req.url === '/private') privateHits++; res.end('ok'); }
    });
    server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://fixture.example:${server.address().port}`;
    const authorize = async value => {
        const url = new URL(value);
        if (url.hostname !== 'fixture.example') return authorizeUrl(value, ['127.0.0.1'], async () => [{ address: '127.0.0.1' }]);
        return { url, address: '127.0.0.1' };
    };
    try {
        await assert.rejects(request(base + '/bad', { timeout: 1000 }, [], undefined, authorize), /Invalid URL/);
        let closes = 0;
        await assert.rejects(requestStream(base + '/bad', { method: 'GET', onClose() { closes++; } }, [], undefined, authorize), /Invalid URL/);
        assert.equal(closes, 1);
        for (const route of ['/relative', '/absolute']) {
            assert.equal((await request(base + route, {}, [], undefined, authorize)).body, 'ok');
            const stream = await requestStream(base + route, { method: 'GET', onClose() {} }, [], undefined, authorize);
            assert.equal(await new Response(stream.body).text(), 'ok');
        }
        await assert.rejects(request(base + '/denied', {}, [], undefined, authorize), /private/);
        await assert.rejects(requestStream(base + '/denied', { method: 'GET', onClose() {} }, [], undefined, authorize), /private/);
        const broker = new MediaBroker({ domains: [] }, authorize);
        const bad = broker.issue(base + '/bad');
        for (let i = 0; i < 8; i++) {
            assert.equal((await broker.fetch(new Request(bad))).status, 502);
            assert.equal(broker.pending.size, 0);
        }
        const good = await broker.fetch(new Request(broker.issue(base + '/relative')));
        assert.equal(await good.text(), 'ok'); assert.equal(broker.pending.size, 0); broker.destroy();
        assert.equal(privateHits, 0);
        await new Promise(resolve => setTimeout(resolve, 50));
        assert.equal(sockets.size, 0);
        return { malformedRejected: 2, brokerFailures: 8, subsequentRequest: true, relativeAbsolute: true, privateHits, sockets: sockets.size };
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
module.exports = { run };
if (require.main === module) run().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exitCode = 1; });
