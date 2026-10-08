const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { SourceManager } = require('../electron/lx/manager.cjs');
// Real disk persistence in the designated scratch area; only native picker is replaced.
test('local import stores digest and no filesystem path; restart stays disabled', async () => {
    const dir = await fs.mkdtemp(path.join(process.env.TMPDIR || '/home/administrator/.hermes/cache/scratch','lx-manager-'));
    const file = path.join(dir,'owned.js'); await fs.writeFile(file,"lx.on('request',()=> 'https://owned.example/a');");
    const electron = {dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[file]})}};
    const first = new SourceManager(electron,path.join(dir,'data')); await first.load();
    const records = await first.importLocal(); assert.equal(records.length,1); assert.equal(records[0].enabled,false); assert.equal(records[0].digest.length,64);
    const stored = await fs.readFile(path.join(dir,'data/sources.json'),'utf8'); assert.equal(stored.includes(file),false);
    const second = new SourceManager(electron,path.join(dir,'data')); assert.deepEqual(await second.load(),records);
    await assert.rejects(second.enable(records[0].digest,['127.0.0.1']),/domain/);
    await assert.rejects(second.enable(records[0].digest,['*.example.com']),/domain/);
    assert.equal(await second.resolve({providerId:'netease',mediaId:'123'},'standard'),null);
    await second.remove(records[0].digest); const third=new SourceManager(electron,path.join(dir,'data')); assert.deepEqual(await third.load(),[]);
});
