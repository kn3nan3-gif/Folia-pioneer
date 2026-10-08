const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { SourceManager } = require('../electron/lx/manager.cjs');
const { scriptDigest } = require('../electron/lx/contract.cjs');
// Exercise ordered public mutations against real disk, including rejected writes and restart.
const scratch = process.env.TMPDIR || '/home/administrator/.hermes/cache/scratch';
const record = name => ({ name, script: `// ${name}`, digest: scriptDigest(`// ${name}`), domains: [] });
test('concurrent removes both succeed and restart reflects all removals', async () => {
    const dir = await fs.mkdtemp(path.join(scratch, 'lx-save-race-'));
    try {
        const manager = new SourceManager({}, dir); const a = record('a'), b = record('b');
        manager.records = [a, b]; await manager.save();
        await Promise.all([manager.remove(a.digest), manager.remove(b.digest)]);
        const restarted = new SourceManager({}, dir); assert.deepEqual(await restarted.load(), []);
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test('concurrent imports deduplicate, ordered removals persist and failed writes do not poison queue', async () => {
    const dir = await fs.mkdtemp(path.join(scratch, 'lx-save-import-')); const data = path.join(dir, 'data');
    try {
        const file = path.join(dir, 'owned.js'); await fs.writeFile(file, '// imported');
        const manager = new SourceManager({ dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [file] }) } }, data);
        await Promise.all(Array.from({ length: 8 }, () => manager.importLocal()));
        assert.equal(manager.records.length, 1);
        const a = record('a'); manager.records.push(a); await manager.save();
        await Promise.all([manager.remove(a.digest), manager.importLocal(), manager.save()]);
        const restarted = new SourceManager({}, data); assert.deepEqual(await restarted.load(), manager.list());
        const before = manager.list();
        await fs.rm(data, { recursive: true }); await fs.writeFile(data, 'block mkdir');
        await assert.rejects(manager.remove(manager.records[0].digest), /EEXIST|ENOTDIR/);
        assert.deepEqual(manager.list(), before, 'uncommitted removal must not alter memory');
        await fs.rm(data); await manager.save(); await manager.remove(manager.records[0].digest);
        assert.deepEqual(await new SourceManager({}, data).load(), []);
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
