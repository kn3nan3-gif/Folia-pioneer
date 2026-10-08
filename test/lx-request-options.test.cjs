const test = require('node:test');
const assert = require('node:assert/strict');
const { request } = require('../electron/lx/network.cjs');
// Options failures must precede even the broker authorization boundary.
test('unsupported proxy is rejected before authorization', async () => {
    let hits = 0;
    await assert.rejects(request('http://example.com', { proxy: 'http://proxy.invalid' }, [], undefined, async () => {
        hits++; throw new Error('authorization reached');
    }), /unsupported request option: proxy/);
    assert.equal(hits, 0);
});
for (const options of [{cookies:true}, {rejectUnauthorized:false}, {formData:false}, {formData:null}, {unknown:1}, {proxy:false,cookies:false,rejectUnauthorized:false}, null, false, [], 'GET', {method: false}, {timeout: '100'}, {timeout: 0}, {timeout: Infinity}, {headers: []}, {body: null}, {form: false}, {form: null}, {form: {a: null}}, {method: 'PATCH'}, {headers: {cookie: 'secret'}}, {body: 'x', form: {a: 'b'}}]) {
    test(`invalid options fail before authorization: ${JSON.stringify(options)}`, async () => {
        let hits = 0;
        await assert.rejects(request('http://example.com', options, [], undefined, async () => {
            hits++; throw new Error('authorization reached');
        }), /LX: (invalid|unsupported)/);
        assert.equal(hits, 0);
    });
}
