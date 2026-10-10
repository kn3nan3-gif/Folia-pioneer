const path = require('node:path');
const crypto = require('node:crypto');
const { validateInit, validateAudioUrl, musicRequest, scriptInfo } = require('./contract.cjs');
const { request, authorizeUrl } = require('./network.cjs');
const { MediaBroker } = require('./media.cjs');
const { MediaApproval } = require('./media-approval.cjs');
// Approved browser extension realm; WebRTC is reachable, not an untrusted-code sandbox.
class ScriptRuntime {
    constructor(electron, record, { authorize = authorizeUrl, timeout = 15000 } = {}) {
        this.record = record; this.authorize = authorize; this.timeout = timeout;
        this.mediaApproval = new MediaApproval(record.digest, authorize);
        this.media = new MediaBroker({ ...record, domains: this.mediaApproval.domains }, value => this.mediaApproval.authorizeStream(value));
        this.mediaApproval.onChanged = () => this.onStateChanged?.();
        this.mediaEpoch = 0;
        this.mediaApproval.onRejected = () => { this.mediaEpoch++; this.media.revoke(); };
        this.pending = new Map(); this.network = new Map(); this.operations = 0; this.closed = false;
        this.electron = electron;
        this.channel = 'folia-lx-realm-' + crypto.randomUUID();
        this.session = electron.session.fromPartition('folia-lx-' + crypto.randomUUID());
        this.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
        this.session.setPermissionCheckHandler(() => false);
        this.session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: details.url !== this.realmUrl || details.resourceType !== 'mainFrame' }));
        this.window = new electron.BrowserWindow({ show: false, webPreferences: {
            session: this.session, preload: path.join(__dirname, 'preload.cjs'),
            sandbox: true, contextIsolation: true, nodeIntegration: false,
            webSecurity: true, additionalArguments: ['--folia-lx-channel=' + this.channel],
        } });
        this.window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        this.window.webContents.on('will-navigate', event => event.preventDefault());
        this.window.webContents.on('will-redirect', event => event.preventDefault());
        this.window.webContents.on('will-attach-webview', event => event.preventDefault());
        this.window.webContents.on('destroyed', () => this.fail(new Error('LX: realm destroyed')));
        this.window.webContents.on('render-process-gone', () => this.fail(new Error('LX: renderer gone')));
        this.listener = (event, payload) => {
            if (event.sender !== this.window.webContents || event.senderFrame !== this.window.webContents.mainFrame) return;
            if (this.closed) return;
            try {
                if (typeof payload !== 'string' || payload.length > 131072 || ++this.operations > 2000) throw new Error('LX: message budget exceeded');
                const message = JSON.parse(payload);
                if (message.kind === 'boot') {
                    if (this.booted) throw new Error('LX: duplicate boot');
                    this.booted = true;
                    // rawScript is delivered only to this realm, not logs or command-line arguments.
                    this.send({ kind: 'info', info: scriptInfo(this.record.script) });
                } else if (message.kind === 'environmentReady') {
                    if (!this.booted || this.environmentReady) throw new Error('LX: environment state');
                    this.environmentReady = true; this.loadScript();
                }
                else if (message.kind === 'fatal') this.fail(new Error('LX realm: ' + message.error));
                else this.receive(message);
            } catch (error) { this.fail(error); }
        };
        electron.ipcMain.on(this.channel, this.listener);
        this.ready = new Promise((resolve, reject) => { this.initResolve = resolve; this.initReject = reject; });
        this.initTimer = setTimeout(() => this.fail(new Error('LX: initialization timeout')), timeout);
        const html = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; connect-src 'none'"><body></body>`;
        this.realmUrl = 'data:text/html,' + encodeURIComponent(html);
        this.window.loadURL(this.realmUrl).then(() => {
            this.pageLoaded = true; this.loadScript();
        }).catch(error => this.fail(error));
    }
    async start() { return this.ready; }
    send(message) {
        if (this.closed) return;
        const text = JSON.stringify(message);
        if (text.length > (message.kind === 'info' ? 1600000 : 131072)) throw new Error('LX: host message budget');
        this.window.webContents.send(this.channel, text);
    }
    // Install native MAIN-world monitors before any approved script is evaluated.
    async loadScript() {
        if (this.closed || !this.environmentReady || !this.pageLoaded || this.loading) return;
        this.loading = true;
        try {
            await this.window.webContents.executeJavaScript(`(() => {
                const fatal = window.__foliaLxFatal;
                const quiet = () => undefined, console = Object.create(null);
                for (const name of ['log', 'info', 'warn', 'error', 'debug', 'group', 'groupCollapsed', 'groupEnd', 'trace', 'table', 'assert', 'count', 'countReset', 'time', 'timeLog', 'timeEnd', 'dir', 'dirxml', 'clear', 'profile', 'profileEnd', 'timeStamp']) console[name] = quiet;
                Object.defineProperty(window, 'console', { value: Object.freeze(console), writable: false, configurable: false });
                window.addEventListener('error', () => fatal());
                window.addEventListener('unhandledrejection', () => fatal());
            })()`, false);
            await this.window.webContents.executeJavaScript(this.record.script, false);
            if (!this.closed) this.receive({ kind: 'loaded' });
        } catch (error) { this.fail(error); }
    }
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
            if (pending.candidate) return;
            if (message.error) finish(new Error(`LX script: ${message.error}`));
            else {
                pending.candidate = true;
                clearTimeout(pending.timer);
                pending.timer = setTimeout(() => { finish(new Error('LX: media resolution timeout')); this.destroy(); }, 75000);
                const epoch = this.mediaEpoch;
                Promise.resolve().then(() => this.mediaApproval.authorizeCandidate(validateAudioUrl(message.value), message.id))
                    .then(() => { if (this.closed || epoch !== this.mediaEpoch || !this.pending.has(message.id)) throw new Error('LX: media resolution revoked'); finish(null, this.media.issue(message.value)); })
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
    finishInitialization() {
        if (!this.closed && this.loaded && this.qualities && !this.settleTimer) {
            this.settleTimer = setTimeout(() => {
                if (this.closed) return;
                clearTimeout(this.initTimer); this.initResolve(this.qualities);
            }, 150);
        }
    }
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
        if (this.closed) return; this.closed = true; this.failure = error; this.onClosed?.(error); this.mediaApproval.destroy(); this.media.destroy(); clearTimeout(this.initTimer);
        this.initReject(error); clearTimeout(this.settleTimer); this.electron.ipcMain.removeListener(this.channel, this.listener);
        for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(error); }
        this.pending.clear(); for (const item of this.network.values()) item.abort(); this.network.clear();
        if (!this.window.isDestroyed()) this.window.destroy();
    }
}
module.exports = { ScriptRuntime };
