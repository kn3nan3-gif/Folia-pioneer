const test = require('node:test');
const assert = require('node:assert/strict');
const { authorizeUrl } = require('../electron/lx/network.cjs');
// Owned DNS answers exercise authorization without contacting external services.
const v4 = { address: '8.8.8.8', family: 4 };
const v6 = { address: '2606:4700:4700::1111', family: 6 };
const authorize = answers => authorizeUrl('https://owned.invalid/audio', ['owned.invalid'], async () => answers);
test('dual-stack authorization chooses validated IPv4 even when IPv6 is first', async () => {
    for (const answers of [[v6, v4], [v4, v6], [v6, { address: '1.1.1.1', family: 4 }, v4]]) {
        assert.equal((await authorize(answers)).address, answers.find(item => item.family === 4).address);
    }
});
test('IPv6-only is explicitly unsupported and empty DNS fails closed', async () => {
    await assert.rejects(authorize([v6]), /IPv6-only.*unsupported/);
    await assert.rejects(authorize([]), /private or unsupported/);
});
for (const address of [
    '0.0.0.0', '10.0.0.1', '127.0.0.1', '169.254.1.1', '172.16.0.1', '192.168.1.1',
    '100.64.0.1', '198.18.0.1', '224.0.0.1', '::', '::1', 'fc00::1', 'fdff::1',
    'fe80::1', 'febf::1', 'fec0::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:7f00:1',
    '::ffff:192.168.1.1', '::ffff:c0a8:101', '::ffff:8.8.8.8', '::192.168.1.1',
    '64:ff9b::c0a8:101', '64:ff9b:1::a00:1', '2002:0a00:0001::1', '2001::1',
    '2001:2::1', '2001:20::1', '2001:db8::1', '3fff::1', '4000::1', 'not-an-ip',
    'fe80::1%eth0',
]) {
    test(`unsafe or unsupported DNS member rejects entire dual-stack set: ${address}`, async () => {
        const member = { address, family: address.includes(':') ? 6 : 4 };
        for (const answers of [[v4, v6, member], [member, v6, v4]]) {
            await assert.rejects(authorize(answers), /private or unsupported/);
        }
    });
}
test('family/address mismatch is rejected rather than connected as IPv4', async () => {
    await assert.rejects(authorize([v4, { ...v6, family: 4 }]), /private or unsupported/);
});

// Transport fixtures inspect both Node lookup callback shapes, with no external I/O.
const http = require('node:http');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const { request } = require('../electron/lx/network.cjs');
const { requestStream } = require('../electron/lx/media-stream.cjs');
for (const media of [false, true]) {
    const label = media ? 'media stream' : 'request';
    const run = (signal, auth) => media
        ? requestStream('http://owned.invalid/start', { method: 'GET', onClose() {} }, ['owned.invalid'], signal, auth)
        : request('http://owned.invalid/start', {}, ['owned.invalid'], signal, auth);
    test(`${label} pins IPv4 without a second DNS lookup and reauthorizes redirect`, async t => {
        let dnsCalls = 0, connections = 0;
        const auth = value => authorizeUrl(value, ['owned.invalid'], async () => {
            dnsCalls++;
            return dnsCalls === 1 ? [v6, v4] : [v4, { address: 'fd00::1', family: 6 }];
        });
        t.mock.method(http, 'request', (url, options, callback) => {
            connections++;
            assert.equal(options.agent, false);
            for (const all of [false, true]) options.lookup(url.hostname, { all }, (error, address, family) => {
                assert.equal(error, null);
                if (all) assert.deepEqual(address, [{ address: v4.address, family: 4 }]);
                else { assert.equal(address, v4.address); assert.equal(family, 4); }
            });
            const req = new EventEmitter(); req.destroy = () => {};
            req.end = () => queueMicrotask(() => {
                const res = Readable.from([]);
                res.statusCode = 302; res.headers = { location: '/next' }; callback(res);
            });
            return req;
        });
        await assert.rejects(run(undefined, auth), /private or unsupported/);
        assert.equal(dnsCalls, 2); assert.equal(connections, 1);
    });
    test(`${label} pins the first authorization even if DNS would now rebind private`, async t => {
        let dnsCalls = 0;
        const auth = value => authorizeUrl(value, ['owned.invalid'], async () => {
            dnsCalls++;
            return dnsCalls === 1 ? [v6, v4] : [{ address: '127.0.0.1', family: 4 }];
        });
        t.mock.method(http, 'request', (url, options, callback) => {
            options.lookup(url.hostname, {}, (error, address, family) => {
                assert.equal(error, null); assert.equal(address, v4.address); assert.equal(family, 4);
            });
            const req = new EventEmitter(); req.destroy = () => {};
            req.end = () => queueMicrotask(() => {
                const res = Readable.from([Buffer.from('owned')]); res.statusCode = 200;
                res.headers = { 'content-length': '5' }; callback(res);
            });
            return req;
        });
        const result = await run(undefined, auth);
        assert.equal(media ? await new Response(result.body).text() : result.body, 'owned');
        assert.equal(dnsCalls, 1);
        await assert.rejects(auth('http://owned.invalid/start'), /private or unsupported/);
    });
    test(`${label} cancellation while DNS pending prevents any connection`, async t => {
        let release, connections = 0;
        t.mock.method(http, 'request', () => { connections++; throw new Error('unexpected connection'); });
        const controller = new AbortController();
        const pending = run(controller.signal, value => authorizeUrl(value, ['owned.invalid'],
            () => new Promise(resolve => { release = resolve; })));
        controller.abort();
        await assert.rejects(pending, /cancelled/);
        release([v6, v4]);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(connections, 0);
    });
    test(`${label} unauthorized redirect domain fails before additional DNS`, async t => {
        let dnsCalls = 0, connections = 0;
        const auth = value => authorizeUrl(value, ['owned.invalid'], async () => { dnsCalls++; return [v6, v4]; });
        t.mock.method(http, 'request', (_url, _options, callback) => {
            connections++;
            const req = new EventEmitter(); req.destroy = () => {};
            req.end = () => queueMicrotask(() => {
                const res = Readable.from([]); res.statusCode = 302;
                res.headers = { location: 'http://ungranted.invalid/audio' }; callback(res);
            });
            return req;
        });
        await assert.rejects(run(undefined, auth), /domain\/port not authorized/);
        assert.equal(dnsCalls, 1); assert.equal(connections, 1);
    });
}
