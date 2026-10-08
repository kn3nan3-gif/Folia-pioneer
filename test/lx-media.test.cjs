const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { MediaBroker } = require('../electron/lx/media.cjs');
const { authorizeUrl } = require('../electron/lx/network.cjs');
// Real broker HTTP with only constructor DNS policy injection; no production loopback switch.
test('media capabilities expire, reject arbitrary targets/headers, and pin checked DNS', async () => {
    let clock=0,hits=0;
    const server=http.createServer((req,res)=>{hits++; assert.equal(req.headers.cookie,undefined);assert.equal(req.headers.authorization,undefined);res.end('owned');});
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const base=`http://owned.example:${server.address().port}`;
    const broker=new MediaBroker({digest:'owned',domains:['owned.example']},async v=>({url:new URL(v),address:'127.0.0.1'}),{now:()=>clock,ttl:100});
    try {
        const url=broker.issue(base+'/audio'); const response=await broker.fetch(new Request(url,{headers:{Cookie:'secret',Authorization:'secret'}}));
        assert.equal(await response.text(),'owned');assert.equal(hits,1);assert.equal(response.headers.get('cache-control'),'no-store');
        assert.equal((await broker.fetch(new Request(url+'?url=http://127.0.0.1'))).status,400);
        assert.equal((await broker.fetch(new Request(url,{headers:{Range:'bytes=1-2,3-4'}}))).status,416);
        clock=100;assert.equal((await broker.fetch(new Request(url))).status,410);assert.equal(hits,1);
        await assert.rejects(authorizeUrl('https://owned.example/audio',['owned.example'],async()=>[{address:'93.184.216.34'},{address:'127.0.0.1'}]),/private/);
        await assert.rejects(authorizeUrl('https://owned.example/audio',['owned.example'],async()=>[{address:'::1'}]),/private/);
        broker.destroy();assert.throws(()=>broker.issue(base),/stopped/);
    } finally {broker.destroy();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
