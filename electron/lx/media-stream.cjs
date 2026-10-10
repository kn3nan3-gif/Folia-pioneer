const http = require('node:http');
const https = require('node:https');
const { authorizeUrl } = require('./network.cjs');
// Media-only transport: never enters the provider request/cache path.
const MAX_BYTES = 67108864;
const IDLE_MS = 15000;
const BUDGET_MS = 1200000;
function requestStream(value, options, domains, signal, authorize = authorizeUrl) {
    return new Promise((resolve, reject) => {
        let active, response, reader, controller, idle, budget, settled = false, closed = false, bytes = 0;
        const cleanup = error => {
            if (closed) return;
            closed = true; clearTimeout(idle); clearTimeout(budget);
            signal?.removeEventListener('abort', abort);
            response?.destroy(); active?.destroy();
            if (!settled) reject(error || new Error('LX: media cancelled'));
            else if (error) { try { controller?.error(error); } catch {} }
            options.onClose();
        };
        const abort = () => cleanup(new Error('LX: media cancelled'));
        const arm = () => { clearTimeout(idle); idle = setTimeout(() => cleanup(new Error('LX: media no progress')), IDLE_MS); };
        budget = setTimeout(() => cleanup(new Error('LX: media transfer budget')), BUDGET_MS);
        arm(); signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) return abort();
        // Every hop assesses the full DNS set, then pins only a validated public IPv4.
        async function hop(target, redirects = 0) {
            try {
                const { url, address } = await authorize(target, domains);
                if (closed) return;
                active = (url.protocol === 'https:' ? https : http).request(url, {
                    method: options.method, headers: options.range ? { range: options.range } : {}, agent: false,
                    highWaterMark: 65536,
                    lookup: (_host, opts, callback) => opts.all ? callback(null, [{ address, family: 4 }]) : callback(null, address, 4),
                }, incoming => {
                    if (closed) { incoming.destroy(); return; }
                    if ([301, 302, 303, 307, 308].includes(incoming.statusCode)) {
                        incoming.destroy();
                        if (redirects >= 3 || !incoming.headers.location) return cleanup(new Error('LX: redirect limit'));
                        // Keep malformed Location errors inside the stream cleanup boundary.
                        try { void hop(new URL(incoming.headers.location, url).href, redirects + 1); }
                        catch (error) { cleanup(error); }
                        return;
                    }
                    response = incoming;
                    try {
                        validateResponse(response, options);
                        clearTimeout(idle);
                        if (options.method === 'HEAD' || response.statusCode === 416) {
                            settled = true;
                            resolve({ status: response.statusCode, headers: response.headers, body: null });
                            cleanup(); return;
                        }
                        reader = response[Symbol.asyncIterator]();
                        const length = response.headers['content-length'] == null ? null : Number(response.headers['content-length']);
                        const body = new ReadableStream({
                            start(c) { controller = c; },
                            async pull(c) {
                                if (closed) return;
                                arm();
                                try {
                                    const part = await reader.next();
                                    clearTimeout(idle);
                                    if (closed) return;
                                    if (part.done) {
                                        if (length != null && length !== bytes) throw new Error('LX: media length mismatch');
                                        c.close(); cleanup(); return;
                                    }
                                    bytes += part.value.length;
                                    if (bytes > MAX_BYTES || (length != null && bytes > length)) throw new Error('LX: media byte budget');
                                    c.enqueue(new Uint8Array(part.value));
                                } catch (error) { cleanup(error); }
                            },
                            cancel() { cleanup(); },
                        }, { highWaterMark: 65536, size: chunk => chunk.byteLength });
                        settled = true;
                        resolve({ status: response.statusCode, headers: response.headers, body });
                        response.on('error', error => cleanup(error));
                    } catch (error) { cleanup(error); }
                });
                active.on('error', error => cleanup(error)); active.end();
            } catch (error) { cleanup(error); }
        }
        void hop(value);
    });
}
// Preserve a real ignored-Range 200; reject malformed/contradictory partial responses, never synthesize 206.
function validateResponse(response, options) {
    const status = response.statusCode, h = response.headers;
    if (![200, 206, 416].includes(status)) throw new Error('LX: media status');
    if (h['content-encoding'] && h['content-encoding'] !== 'identity') throw new Error('LX: media encoding');
    const length = h['content-length'];
    if (length != null && (!/^\d{1,12}$/.test(length) || Number(length) > MAX_BYTES)) throw new Error('LX: media length budget');
    if (status === 200 && h['content-range']) throw new Error('LX: unexpected content range');
    if (status === 416) {
        if (!/^bytes \*\/\d{1,12}$/.test(h['content-range'] || '')) throw new Error('LX: invalid unsatisfied range');
        return;
    }
    if (status !== 206) return;
    const m = /^bytes (\d{1,12})-(\d{1,12})\/(\d{1,12})$/.exec(h['content-range'] || '');
    if (!options.range || !m) throw new Error('LX: invalid partial range');
    const start = Number(m[1]), end = Number(m[2]), total = Number(m[3]);
    if (start > end || end >= total || total > MAX_BYTES || (length != null && Number(length) !== end - start + 1)) throw new Error('LX: partial length mismatch');
    const r = /^bytes=(\d*)-(\d*)$/.exec(options.range);
    const expectedStart = r[1] ? Number(r[1]) : Math.max(0, total - Number(r[2]));
    const expectedEnd = r[1] && r[2] ? Math.min(total - 1, Number(r[2])) : total - 1;
    if (start !== expectedStart || end !== expectedEnd) throw new Error('LX: upstream range mismatch');
    h['content-length'] = String(end - start + 1);
}
module.exports = { requestStream, MAX_BYTES, IDLE_MS, BUDGET_MS };
