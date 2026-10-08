const electron = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = process.env.FOLIA_LX_PROJECT || path.resolve(__dirname, '..');
const { SourceManager } = require(path.join(root, 'electron/lx/manager.cjs'));
const { scriptDigest } = require(path.join(root, 'electron/lx/contract.cjs'));
const { reviewScript } = require(path.join(root, 'electron/lx/review.cjs'));
const approval = record => { const report = reviewScript(record.script); return {digest:record.digest,reviewVersion:report.version,riskVersion:report.riskVersion,acknowledged:true}; };
const { run } = require('./lx-redirect-regression.cjs');
// Real Electron browser host; controlled disk gate fixes mutation overlap timing.
electron.app.on('window-all-closed', () => {});
const watchdog = setTimeout(() => electron.app.exit(1), 30000);
let manager, window, directory;
electron.app.whenReady().then(async () => {
    window = new electron.BrowserWindow({ show: false, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } });
    const redirect = await run();
    directory = await fs.mkdtemp(path.join(electron.app.getPath('temp'), 'folia-quality-'));
    const script = "lx.on('request',()=> 'https://fixture.example/audio');lx.send('inited',{sources:{wy:{actions:['musicUrl'],qualitys:['128k']}}});";
    const record = { name: 'owned', script, digest: scriptDigest(script), domains: [] };
    const other = { name: 'other', script: '// other', digest: scriptDigest('// other'), domains: [] };
    const imported = path.join(directory, 'imported.js'); await fs.writeFile(imported, '// import');
    manager = new SourceManager({ ...electron, dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [imported] }) } }, path.join(directory, 'data'));
    manager.records = [record, other]; await manager.save();
    const rename = fs.rename;
    let entered, release;
    const gate = new Promise(resolve => { release = resolve; });
    const atRename = new Promise(resolve => { entered = resolve; });
    let once = true;
    fs.rename = async (...args) => { if (once) { once = false; entered(); await gate; } return rename(...args); };
    try {
        const enabling = manager.enable(record.digest, ['fixture.example'], approval(record));
        await atRename;
        await assert.rejects(manager.enable(record.digest, []), /already pending/);
        const removing = manager.remove(other.digest), importing = manager.importLocal(), saving = manager.save();
        release(); await Promise.all([enabling, removing, importing, saving]);
    } finally { release(); fs.rename = rename; }
    assert.equal(manager.active, record.digest); assert.equal(manager.busy, false);
    const restarted = new SourceManager({}, manager.directory); await restarted.load();
    assert.deepEqual(restarted.records, manager.records); assert.equal(restarted.records.length, 2);
    assert.deepEqual(restarted.records.find(r => r.digest === record.digest).domains, ['fixture.example']);
    assert.ok(restarted.list().every(r => !r.enabled));
    const removal = manager.remove(record.digest);
    assert.equal(manager.active, null); assert.equal(manager.runtime, null); await removal;
    await assert.rejects(manager.enable(record.digest, []), /domain/);
    // Failed enable persistence must propagate, disable the child and leave grants uncommitted.
    manager.records = [record]; await manager.save();
    const previous = manager.records;
    fs.rename = async () => { const error = new Error('owned write failure'); error.code = 'EACCES'; throw error; };
    try { await assert.rejects(manager.enable(record.digest, ['fixture.example'], approval(record)), /owned write failure/); }
    finally { fs.rename = rename; }
    assert.deepEqual(manager.records, previous); assert.equal(manager.active, null); assert.equal(manager.busy, false);
    await manager.enable(record.digest, ['fixture.example'], approval(record)); manager.disable();
    console.log(JSON.stringify({ electron: process.versions.electron, redirect, concurrentEnableImportRemoveSave: true, restartDisabled: true, immediateRevoke: true, failedWriteRecovery: true, productionBrowser: true }));
    await fs.rm(directory, { recursive: true, force: true }); window.destroy(); clearTimeout(watchdog); electron.app.exit(0);
}).catch(error => { console.error(error.stack); manager?.disable(); window?.destroy(); clearTimeout(watchdog); electron.app.exit(1); });
