const fs = require('node:fs/promises');
const path = require('node:path');
const { scriptDigest } = require('./contract.cjs');
const { ScriptRuntime } = require('./runtime.cjs');
const { reviewScript, validateApproval } = require('./review.cjs');
// Main-owned persistence and explicit digest-bound network grants. Restart is always disabled.
class SourceManager {
    constructor(electron, directory) { this.electron = electron; this.directory = directory; this.records = []; this.runtime = null; this.active = null; this.busy = false; this.writes = Promise.resolve(); this.failures = new Map(); }
    async load() {
        try { this.records = JSON.parse(await fs.readFile(path.join(this.directory, 'sources.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        if (!Array.isArray(this.records) || this.records.length > 20) throw new Error('LX: invalid storage');
        for (const r of this.records) if (typeof r.script !== 'string' || scriptDigest(r.script) !== r.digest) throw new Error('LX: stored digest mismatch');
        return this.list();
    }
    list() { return this.records.map(({ name, digest, domains, script }) => ({ name, digest, domains, review: reviewScript(script), ...(this.failures.has(digest) ? { failure: this.failures.get(digest) } : {}), enabled: this.active === digest && !this.runtime?.closed, qualities: this.active === digest && !this.runtime?.closed ? this.runtime?.qualities || [] : [] })); }
    notify() { this.onStateChanged?.(this.list()); }
    // Serialize snapshot creation and commit; a failed operation must not poison the next one.
    enqueueWrite(operation) {
        const result = this.writes.then(operation);
        this.writes = result.catch(() => {});
        return result;
    }
    save() { return this.enqueueWrite(() => this.persist(this.records)); }
    async persist(records) {
        const snapshot = JSON.stringify(records);
        await fs.mkdir(this.directory, { recursive: true });
        const file = path.join(this.directory, 'sources.json');
        await fs.writeFile(file + '.next', snapshot, { mode: 0o600 }); await fs.rename(file + '.next', file);
        this.records = records; this.notify();
    }
    async importLocal() {
        const selected = await this.electron.dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'JavaScript', extensions: ['js'] }] });
        if (selected.canceled) return this.list();
        const file = selected.filePaths[0], stat = await fs.stat(file);
        if (!stat.isFile() || stat.size > 262144 || !file.endsWith('.js')) throw new Error('LX: script size/type/count rejected');
        const script = await fs.readFile(file, 'utf8'), digest = scriptDigest(script);
        return this.enqueueWrite(async () => {
            if (!this.records.some(r => r.digest === digest)) {
                if (this.records.length >= 20) throw new Error('LX: script size/type/count rejected');
                await this.persist([...this.records, { name: path.basename(file), digest, script, domains: [] }]);
            }
            return this.list();
        });
    }
    async enable(digest, domains, approval) {
        if (this.busy) throw new Error('LX: enable already pending');
        const record = this.records.find(r => r.digest === digest);
        if (!record || !Array.isArray(domains) || domains.length > 20 || domains.some(d => typeof d !== 'string' || !/^(?=.{1,253}$)[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,63}$/.test(d))) throw new Error('LX: explicit domain names required (no wildcard/IP)');
        validateApproval(record, approval);
        this.busy = true; this.disable();
        let runtime;
        try {
            runtime = new ScriptRuntime(this.electron, { ...record, domains }); this.runtime = runtime;
            runtime.onClosed = error => {
                if (this.runtime !== runtime) return;
                this.active = null;
                this.failures.set(digest, String(error?.message || 'LX: runtime closed').slice(0, 256));
                this.notify();
            };
            await runtime.start();
            if (this.runtime !== runtime || runtime.closed) throw new Error('LX: stopped');
            return await this.enqueueWrite(async () => {
                if (this.runtime !== runtime || runtime.closed || !this.records.some(r => r.digest === digest)) throw new Error('LX: stopped');
                await this.persist(this.records.map(r => r.digest === digest ? { ...r, domains: [...new Set(domains)] } : r));
                if (this.runtime !== runtime || runtime.closed) throw new Error('LX: stopped');
                this.active = digest; this.notify(); return this.list();
            });
        } catch (error) { runtime?.destroy(); if (this.runtime === runtime) this.disable(); throw error; }
        finally { this.busy = false; }
    }
    disable() {
        // Detach before destroy: explicit disable/switch is not a runtime failure.
        const runtime = this.runtime; this.runtime = null; this.active = null;
        this.failures.clear(); runtime?.destroy(); this.notify(); return this.list();
    }
    async remove(digest) {
        if (this.runtime?.record.digest === digest) this.disable();
        return this.enqueueWrite(async () => {
            if (this.runtime?.record.digest === digest) this.disable();
            await this.persist(this.records.filter(r => r.digest !== digest));
            return this.list();
        });
    }
    async resolve(song, quality) {
        if (!this.active) { if (this.runtime) throw this.runtime.failure || new Error('LX: initialization pending'); return null; }
        if (song?.providerId !== 'netease') return null;
        return { url: await this.runtime.resolve(song, quality), providerId: 'netease', quality };
    }
}
function registerLxSources(electron, getMainWindow) {
    const manager = new SourceManager(electron, path.join(electron.app.getPath('userData'), 'lx-sources'));
    manager.onStateChanged = records => {
        const wc = getMainWindow()?.webContents;
        if (wc && !wc.isDestroyed()) wc.send('folia-lx:state-changed', records);
    };
    const loaded = manager.load();
    electron.protocol.handle('folia-lx-media', request => manager.runtime?.media.fetch(request) ?? new Response(null, { status: 410 }));
    for (const [operation, run] of Object.entries({ list: () => manager.list(), import: () => manager.importLocal(), enable: (digest, domains, approval) => manager.enable(digest, domains, approval), disable: () => manager.disable(), remove: digest => manager.remove(digest), resolve: (song, quality) => manager.resolve(song, quality) })) {
        electron.ipcMain.handle(`folia-lx:${operation}`, async (event, ...args) => {
            const wc = getMainWindow()?.webContents;
            if (event.sender !== wc || event.senderFrame !== wc?.mainFrame || JSON.stringify(args).length > 8192) throw new Error('LX: unauthorized sender/payload');
            await loaded; return run(...args);
        });
    }
    electron.app.on('before-quit', () => manager.disable()); return manager;
}
module.exports = { SourceManager, registerLxSources };
