const path = require('node:path');
const crypto = require('node:crypto');
const { validateInit, validateAudioUrl, musicRequest } = require('./contract.cjs');
const { request, authorizeUrl } = require('./network.cjs');
const { MediaBroker } = require('./media.cjs');
// Bounded QuickJS guest; utilityProcess host is trusted, not an OS network sandbox.
class ScriptRuntime {
    constructor(electron, record, { authorize = authorizeUrl, timeout = 15000 } = {}) {
        this.record = record; this.authorize = authorize; this.timeout = timeout;
        this.media = new MediaBroker(record, authorize);
        this.pending = new Map(); this.network = new Map(); this.operations = 0; this.closed = false;
        this.worker = electron.utilityProcess.fork(path.join(__dirname, 'quickjs-worker.cjs'), [], { serviceName: 'Folia LX QuickJS', stdio: 'pipe' });
        this.listener = payload => {
            if (this.closed) return;
            try {
                if (typeof payload !== 'string' || payload.length > 131072 || ++this.operations > 2000) throw new Error('LX: message budget exceeded');
                const message = JSON.parse(payload);
                if (message.kind === 'boot') this.send({ kind: 'load', script: record.script, info: { name: record.name, id: record.digest, version: '', author: '', description: '' } });
                else if (message.kind === 'fatal') this.fail(new Error('LX worker: ' + message.error));
                else if (message.kind === 'ack') this.busySince = null;
                else this.receive(message);
            } catch (error) { this.fail(error); }
        };
        this.worker.on('message', this.listener);
        this.worker.on('exit', code => this.fail(new Error('LX: worker exited ' + code)));
        this.watchdog = setInterval(() => { if (this.busySince && Date.now() - this.busySince > 1500) this.fail(new Error('LX: worker watchdog')); }, 100);
        this.ready = new Promise((resolve, reject) => { this.initResolve = resolve; this.initReject = reject; });
        this.initTimer = setTimeout(() => this.fail(new Error('LX: initialization timeout')), timeout);
    }
    async start() { return this.ready; }
    send(message) { if (!this.closed) { this.busySince ??= Date.now(); this.worker.postMessage(JSON.stringify(message)); } }
    receive(message) {
        if (message.kind === 'init') {
            if (this.qualities) throw new Error('LX: duplicate initialization');
            this.qualities = validateInit(message.data); this.finishInitialization();
        } else if (message.kind === 'loaded') {
            if (this.loaded) throw new Error('LX: duplicate script load');
            this.loaded = true; this.finishInitialization();
        } else if (message.kind === 'result') {
            const pending = this.pending.get(message.id); if (!pending) return;
            const finish = (error, value) => {
                if (!this.pending.has(message.id)) return;
                this.pending.delete(message.id); clearTimeout(pending.timer);
                error ? pending.reject(error) : pending.resolve(value);
            };
            if (message.error) finish(new Error(`LX script: ${message.error}`));
            else {
                Promise.resolve().then(() => this.authorize(validateAudioUrl(message.value), this.record.domains))
                    .then(() => { if (this.closed) throw new Error('LX: stopped'); finish(null, this.media.issue(message.value)); })
                    .catch(error => finish(error));
            }
        } else if (message.kind === 'network') {
            if (!this.qualities || this.network.size >= 8 || this.network.has(message.id)) throw new Error('LX: network budget/not initialized');
            const controller = new AbortController(); this.network.set(message.id, controller);
            request(message.url, message.options, this.record.domains, controller.signal, this.authorize)
                .then(result => this.replyNetwork(message.id, result), error => this.replyNetwork(message.id, { error: String(error.message).slice(0, 256) }));
        } else if (message.kind === 'cancel') {
            this.network.get(message.id)?.abort(); this.network.delete(message.id);
        } else throw new Error('LX: unsupported event');
    }
    // Init declaration alone is provisional until top-level evaluation and its queued jobs succeed.
    finishInitialization() { if (!this.closed && this.loaded && this.qualities) { clearTimeout(this.initTimer); this.initResolve(this.qualities); } }
    replyNetwork(id, result) {
        if (!this.closed && this.network.has(id)) this.send({ kind: 'networkResult', id, ...result });
        this.network.delete(id);
    }
    async resolve(song, quality) {
        await this.ready;
        if (this.closed || this.pending.size >= 4) throw new Error('LX: stopped/request budget');
        const data = musicRequest(song, quality, this.qualities);
        const id = crypto.randomUUID();
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('LX: musicUrl timeout')); this.destroy(); }, this.timeout);
            this.pending.set(id, { resolve, reject, timer });
            this.send({ kind: 'invoke', id, data });
        });
    }
    fail(error) { this.initReject(error); this.destroy(error); }
    destroy(error = new Error('LX: stopped')) {
        if (this.closed) return; this.closed = true; this.failure = error; this.onClosed?.(error); this.media.destroy(); clearTimeout(this.initTimer);
        this.initReject(error); clearInterval(this.watchdog); this.worker.removeListener('message', this.listener);
        for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(error); }
        this.pending.clear(); for (const item of this.network.values()) item.abort(); this.network.clear();
        this.worker.kill();
    }
}
module.exports = { ScriptRuntime };
