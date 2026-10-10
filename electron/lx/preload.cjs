const { contextBridge, ipcRenderer } = require('electron');
// Dedicated sandbox preload: narrow LX API, no filesystem or application bridge.
const channel = process.argv.find(arg => arg.startsWith('--folia-lx-channel='))?.split('=')[1];
if (!channel) throw new Error('LX: missing realm channel');
const post = message => {
    const text = JSON.stringify(message);
    if (text.length > 131072) throw new Error('LX: message budget');
    ipcRenderer.send(channel, text);
};
let handler, initialized = false, nextId = 0;
const callbacks = new Map();
const unsupported = () => { throw new Error('LX: crypto/compress/buffer utilities unsupported in Pioneer slice 1'); };
const exposeLx = currentScriptInfo => contextBridge.exposeInMainWorld('lx', {
    EVENT_NAMES: { request: 'request', inited: 'inited', updateAlert: 'updateAlert' },
    version: '2.0.0', env: 'desktop', currentScriptInfo,
    utils: { crypto: { aesEncrypt: unsupported, rsaEncrypt: unsupported, md5: unsupported, randomBytes: unsupported }, buffer: { from: unsupported, bufToString: unsupported }, zlib: { inflate: unsupported, deflate: unsupported } },
    async on(event, fn) { if (event !== 'request' || handler || typeof fn !== 'function') throw new Error('LX: handler'); handler = fn; },
    async send(event, data) { if (event !== 'inited' || initialized || !handler) throw new Error('LX: initialization'); initialized = true; post({ kind: 'init', data }); },
    request(url, options, callback) {
        if (typeof callback !== 'function' || callbacks.size >= 8) throw new Error('LX: callback budget');
        const id = ++nextId; callbacks.set(id, callback);
        post({ kind: 'network', id, url, options });
        return () => { callbacks.delete(id); post({ kind: 'cancel', id }); };
    },
});
contextBridge.exposeInMainWorld('__foliaLxFatal', () => post({ kind: 'fatal', error: 'LX: native error/unhandledrejection' }));
// Results stay bounded JSON; invocation errors are request failures, not swallowed init failures.
let environmentReady = false;
ipcRenderer.on(channel, (_event, text) => {
    try {
        const message = JSON.parse(text);
        if (text.length > (message.kind === 'info' ? 1600000 : 131072)) throw new Error('LX: host message budget');
        if (message.kind === 'info') {
            if (environmentReady) throw new Error('LX: duplicate environment');
            exposeLx(message.info); environmentReady = true; post({ kind: 'environmentReady' });
        } else if (message.kind === 'invoke') {
            if (!initialized || !handler) throw new Error('LX: not initialized');
            Promise.resolve().then(() => handler(message.data)).then(
                value => post({ kind: 'result', id: message.id, value }),
                error => post({ kind: 'result', id: message.id, error: String(error?.message || error).slice(0, 256) }),
            ).catch(() => post({ kind: 'fatal', error: 'LX: result delivery failed' }));
        } else if (message.kind === 'networkResult') {
            const callback = callbacks.get(message.id); callbacks.delete(message.id);
            if (callback) {
                if (message.error) callback(new Error(message.error), null, null);
                else callback(null, { ...message.response, body: message.body }, message.body);
            }
        } else throw new Error('LX: host event');
    } catch (_error) { post({ kind: 'fatal', error: 'LX: bridge callback failed' }); }
});
ipcRenderer.send(channel, JSON.stringify({ kind: 'boot' }));
