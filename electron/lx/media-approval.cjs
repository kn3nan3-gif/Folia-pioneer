const crypto = require('node:crypto');
const net = require('node:net');
// Runtime-local grants and single-use challenges; never serialize candidate URLs.
function candidateUrl(value) {
    if (typeof value !== 'string' || value.length > 2048) throw new Error('LX: invalid media URL');
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || net.isIP(url.hostname) ||
        !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(url.hostname)) throw new Error('LX: invalid media URL');
    return url;
}
class MediaApproval {
    constructor(digest, authorize, { ttl = 60000, now = Date.now } = {}) {
        this.digest = digest; this.authorize = authorize; this.ttl = ttl; this.now = now;
        this.domains = []; this.pending = new Map(); this.closed = false; this.epoch = 0;
    }
    list() { return [...this.pending.values()].map(item => item.public); }
    notify() { this.onChanged?.(); }
    async authorizeCandidate(value, requestId) {
        const epoch = this.epoch;
        const url = candidateUrl(value);
        if (this.closed) throw new Error('LX: stopped');
        if (!this.domains.includes(url.hostname)) {
            if (this.pending.size >= 4 || [...this.pending.values()].some(item => item.requestId === requestId)) throw new Error('LX: media approval budget/duplicate');
            await new Promise((resolve, reject) => {
                const id = crypto.randomBytes(32).toString('hex');
                const item = { requestId, resolve, reject, public: { id, digest: this.digest, hostname: url.hostname, origin: url.origin, expires: this.now() + this.ttl } };
                item.timer = setTimeout(() => this.cancel(id, new Error('LX: media approval timeout')), this.ttl);
                this.pending.set(id, item); this.notify();
            });
        }
        if (this.closed || epoch !== this.epoch) throw new Error('LX: media authorization revoked/stopped');
        const result = await this.authorize(value, [...this.domains]);
        if (this.closed || epoch !== this.epoch) throw new Error('LX: media authorization revoked/stopped');
        return result;
    }
    decide(payload) {
        if (!payload || Object.keys(payload).sort().join(',') !== 'acknowledged,approved,digest,id' || typeof payload.approved !== 'boolean' || payload.acknowledged !== true) {
            const error = new Error('LX: explicit media decision required'); this.revoke(error); throw error;
        }
        const item = this.pending.get(payload.id);
        if (this.closed || !item || payload.digest !== this.digest || item.public.expires <= this.now()) {
            const error = new Error('LX: stale media approval'); this.revoke(error); throw error;
        }
        this.pending.delete(payload.id); clearTimeout(item.timer);
        if (payload.approved) {
            if (!this.domains.includes(item.public.hostname)) {
                if (this.domains.length >= 20) { const error = new Error('LX: media grant budget'); item.reject(error); this.revoke(error); return; }
                this.domains.push(item.public.hostname);
            }
            item.resolve();
        } else { const error = new Error('LX: media approval denied'); item.reject(error); this.revoke(error); return; }
        this.notify();
    }
    cancel(id, error) {
        if (this.pending.has(id)) this.revoke(error);
    }
    // One failure invalidates the entire session, including authorization awaiting DNS.
    revoke(error) {
        this.epoch++; this.domains.length = 0;
        for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(error); }
        this.pending.clear(); this.onRejected?.(); this.notify();
    }
    async authorizeStream(value) {
        const epoch = this.epoch;
        const url = candidateUrl(value);
        if (this.closed) throw new Error('LX: stopped');
        if (!this.domains.includes(url.hostname)) {
            this.failure = `LX: media redirect stopped; domain not approved: ${url.hostname}`;
            this.notify(); throw new Error(this.failure);
        }
        const result = await this.authorize(value, [...this.domains]);
        if (this.closed || epoch !== this.epoch) throw new Error('LX: media authorization revoked/stopped');
        return result;
    }
    destroy() {
        if (this.closed) return;
        this.closed = true; this.revoke(new Error('LX: stopped'));
    }
}
module.exports = { MediaApproval, candidateUrl };
