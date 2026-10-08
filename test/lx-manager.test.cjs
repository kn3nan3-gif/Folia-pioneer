const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { SourceManager, registerLxSources } = require('../electron/lx/manager.cjs');
// Real disk persistence in the designated scratch area; only native picker is replaced.
test('status notifications target the main window and preserve sender authorization', async () => {
    const dir = await fs.mkdtemp(path.join(process.env.TMPDIR, 'lx-notify-'));
    const handlers = new Map(), messages = [];
    const wc = { mainFrame: {}, isDestroyed: () => false, send: (...args) => messages.push(args) };
    let window = { webContents: wc };
    const manager = registerLxSources({ app: { getPath: () => dir, on: () => {} }, protocol: { handle: () => {} }, ipcMain: { handle: (name, fn) => handlers.set(name, fn) } }, () => window);
    const list = handlers.get('folia-lx:list');
    await assert.rejects(list({ sender: {}, senderFrame: wc.mainFrame }), /unauthorized/);
    await assert.rejects(list({ sender: wc, senderFrame: {} }), /unauthorized/);
    await list({ sender: wc, senderFrame: wc.mainFrame });
    manager.disable();assert.deepEqual(messages, [['folia-lx:state-changed', []]]);
    window = null;manager.disable();assert.equal(messages.length, 1);
    wc.isDestroyed = () => true;window = { webContents: wc };manager.disable();assert.equal(messages.length, 1);
    await fs.rm(dir, { recursive: true, force: true });
});
test('preload subscription strips the event and removes only its listener', async () => {
    const vm = require('node:vm'), { EventEmitter } = require('node:events');
    const ipcRenderer = new EventEmitter();let bridge;
    const source = await fs.readFile(path.join(__dirname, '../electron/preload.cjs'), 'utf8');
    vm.runInNewContext(source, { require: () => ({ contextBridge: { exposeInMainWorld: (_name, value) => { bridge = value; } }, ipcRenderer, webUtils: {} }), process: { platform: 'linux', env: {} } });
    const received = [], sibling = () => {};
    ipcRenderer.on('folia-lx:state-changed', sibling);
    const unsubscribe = bridge.lxSources.onStateChanged(records => received.push(records));
    const records = [{ enabled: false, failure: 'owned failure' }];
    ipcRenderer.emit('folia-lx:state-changed', { secret: 'native event' }, records);
    assert.deepEqual(received, [records]);unsubscribe();unsubscribe();
    assert.deepEqual(ipcRenderer.listeners('folia-lx:state-changed'), [sibling]);
});
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
