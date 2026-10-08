const crypto = require('node:crypto');
const { requestStream } = require('./media-stream.cjs');
// Digest-runtime capabilities expose no URL; media streams use bounded backpressure.
class MediaBroker {
    constructor(record, authorize, { now = Date.now, ttl = 1200000 } = {}) {
        this.record = record; this.authorize = authorize; this.now = now; this.ttl = ttl;
        this.tokens = new Map(); this.pending = new Set(); this.closed = false;
    }
    issue(url) {
        if (this.closed) throw new Error('LX: stopped');
        for (const [key, item] of this.tokens) if (item.expires <= this.now()) this.tokens.delete(key);
        if (this.tokens.size >= 200) throw new Error('LX: media token budget');
        const token = crypto.randomBytes(32).toString('hex');
        this.tokens.set(token, { url, expires: this.now() + this.ttl });
        return `folia-lx-media://audio/${token}`;
    }
    // Only a token minted by this runtime can select a target. Each access and redirect uses network.cjs.
    async fetch(input) {
        const url = new URL(input.url), token = url.pathname.slice(1), item = this.tokens.get(token);
        const headers = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Content-Range, Accept-Ranges, Content-Length', 'cache-control': 'no-store' };
        const deny = status => new Response(null, { status, headers });
        if (this.closed || !item || item.expires <= this.now()) { this.tokens.delete(token); return deny(410); }
        if (url.protocol !== 'folia-lx-media:' || url.hostname !== 'audio' || url.search || url.hash || url.username || url.password || url.port || !/^[a-f0-9]{64}$/.test(token)) return deny(400);
        if (!['GET', 'HEAD'].includes(input.method)) return deny(405);
        const range = input.headers.get('range');
        if (range && !/^bytes=(?:\d{1,12}-\d{0,12}|-\d{1,12})$/.test(range)) return deny(416);
        if (this.pending.size >= 4) return deny(429);
        const controller = new AbortController(); this.pending.add(controller);
        const abort = () => controller.abort(); input.signal?.addEventListener('abort', abort, { once: true });
        const expiry = setTimeout(abort, Math.max(0, item.expires - this.now()));
        const release = () => { clearTimeout(expiry); input.signal?.removeEventListener('abort', abort); this.pending.delete(controller); };
        if (input.signal?.aborted) abort();
        try {
            const result = await requestStream(item.url, { method: input.method, range, onClose: release }, this.record.domains, controller.signal, this.authorize);
            if (this.closed || item.expires <= this.now()) { controller.abort(); return deny(410); }
            for (const name of ['content-type', 'content-range', 'accept-ranges', 'content-length']) {
                if (typeof result.headers[name] === 'string') headers[name] = result.headers[name];
            }
            if (result.status === 416) headers['content-length'] = '0';
            return new Response(result.body, { status: result.status, headers });
        } catch { controller.abort(); release(); return deny(this.closed ? 410 : 502); }
    }
    destroy() { this.closed = true; this.tokens.clear(); for (const item of this.pending) item.abort(); this.pending.clear(); }
}
module.exports = { MediaBroker };
