const test = require('node:test');
const assert = require('node:assert/strict');
// LX contract behavior tests: no third-party scripts are executed.
const { validateInit, validateAudioUrl, scriptDigest } = require('../electron/lx/contract.cjs');
test('initialization accepts only declared wy musicUrl qualities', () => {
  assert.deepEqual(validateInit({ sources: { wy: { actions: ['musicUrl'], qualitys: ['128k', 'flac'] }, kw: { actions: ['musicUrl'], qualitys: ['320k'] } } }), ['128k', 'flac']);
  assert.throws(() => validateInit({ sources: { wy: { actions: ['search'], qualitys: ['128k'] } } }), /wy/);
  assert.throws(() => validateInit({ sources: { wy: { actions: ['musicUrl'], qualitys: ['fake'] } } }), /quality/);
});
test('audio URLs and unsupported qualities fail closed', () => {
  assert.equal(validateAudioUrl('https://audio.example/a.mp3'), 'https://audio.example/a.mp3');
  for (const value of ['file:///etc/passwd', 'https://u:p@audio.example/a', {}, 'x'.repeat(2049)]) assert.throws(() => validateAudioUrl(value));
  const { musicRequest } = require('../electron/lx/contract.cjs');
  assert.throws(() => musicRequest({mediaId: '123'}, 'high', ['128k']), /unsupported/);
  assert.equal(musicRequest({mediaId: '123'}, 'standard', ['128k']).info.musicInfo.meta.songId, '123');
  assert.equal(scriptDigest('abc').length, 64);
});
test('broker reauthorizes redirects and enforces cancellation/timeout', async () => {
  const http = require('node:http'); const {request} = require('../electron/lx/network.cjs');
  const server = http.createServer((req,res) => { if(req.url === '/redirect') {res.writeHead(302,{location:'http://blocked.example/x'});res.end();} else setTimeout(()=>res.end('{}'),500); });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`; const checked=[];
  const authorize=async value=>{checked.push(value);const url=new URL(value);if(url.origin!==base)throw new Error('redirect not authorized');return {url,address:'127.0.0.1'};};
  try {
    await assert.rejects(request(base+'/redirect',{},[],null,authorize),/not authorized/); assert.equal(checked.length,2);
    await assert.rejects(request(base+'/slow',{timeout:100},[],null,authorize),/timeout/);
    const controller=new AbortController();const pending=request(base+'/slow',{},[],controller.signal,authorize);controller.abort();await assert.rejects(pending,/cancelled/);
  } finally {server.closeAllConnections();server.close();}
});
test('network authorization rejects private DNS and redirects before connecting', async () => {
  const { authorizeUrl } = require('../electron/lx/network.cjs');
  const lookup = async () => [{ address: '127.0.0.1', family: 4 }];
  await assert.rejects(authorizeUrl('https://api.example/x', ['api.example'], lookup), /private/);
  await assert.rejects(authorizeUrl('https://other.example/x', ['api.example'], lookup), /authorized/);
  for (const address of ['10.0.0.1', '::1', '::ffff:127.0.0.1', '169.254.1.1', 'fc00::1']) await assert.rejects(authorizeUrl('https://api.example/x', ['api.example'], async () => [{address, family: address.includes(':') ? 6 : 4}]), /private/);
});
