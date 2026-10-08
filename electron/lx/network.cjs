const dns = require('node:dns').promises;
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
// Broker pins a checked public IPv4 address: DNS rebinding cannot change the connection.
function isPublic(address) {
    if (net.isIP(address) !== 4) return false; // IPv6 deliberately unsupported in the first slice.
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0, 168].includes(b)) ||
        (a === 100 && b >= 64 && b <= 127) || (a === 198 && [18, 19, 51].includes(b)) || (a === 203 && b === 0));
}
async function authorizeUrl(value, domains, lookup = hostname => dns.lookup(hostname, { all: true })) {
    const url = new URL(value);
    if (value.length > 2048 || !['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        !domains.includes(url.hostname) || (url.port && !['80', '443'].includes(url.port))) throw new Error('LX: domain/port not authorized');
    const addresses = await lookup(url.hostname);
    if (!addresses.length || addresses.some(item => !isPublic(item.address))) throw new Error('LX: private or unsupported network address');
    return { url, address: addresses[0].address };
}
// Each redirect re-enters authorization. Abort destroys both pending and active requests.
function request(value, options = {}, domains, signal, authorize = authorizeUrl, media = false) {
    return new Promise((resolve, reject) => {
        // Validate the complete contract before authorization/DNS or installing network work.
        let method, headers, body;
        try {
            if (!options || typeof options !== 'object' || Array.isArray(options)) throw new Error('LX: invalid request options');
            for (const key of Object.keys(options)) {
                if (!['method', 'timeout', 'headers', 'body', 'form'].includes(key)) throw new Error(`LX: unsupported request option: ${key}`);
            }
            const has = key => Object.hasOwn(options, key);
            if (has('method') && typeof options.method !== 'string') throw new Error('LX: invalid method');
            method = has('method') ? options.method.toUpperCase() : 'GET';
            if (!['GET', 'POST', 'PUT', 'DELETE', 'HEAD'].includes(method)) throw new Error('LX: unsupported method');
            if (has('timeout') && (typeof options.timeout !== 'number' || !Number.isFinite(options.timeout) || options.timeout <= 0)) throw new Error('LX: invalid timeout');
            if (has('headers') && (!options.headers || typeof options.headers !== 'object' || Array.isArray(options.headers))) throw new Error('LX: invalid headers');
            headers = {};
            for (const [key, val] of Object.entries(options.headers || {})) {
                if (!(media ? ['range'] : ['accept', 'content-type', 'user-agent']).includes(key.toLowerCase()) || typeof val !== 'string' || val.length > 2048) throw new Error('LX: unsupported header');
                headers[key] = val;
            }
            if (has('form') && (!options.form || typeof options.form !== 'object' || Array.isArray(options.form) || Object.values(options.form).some(v => !['string', 'number', 'boolean'].includes(typeof v) || (typeof v === 'number' && !Number.isFinite(v))))) throw new Error('LX: invalid scalar form');
            if (has('body') && has('form')) throw new Error('LX: unsupported body/form combination');
            if (has('body') && typeof options.body !== 'string') throw new Error('LX: invalid body');
            body = has('form') ? new URLSearchParams(options.form).toString() : options.body;
            if (has('form')) headers['content-type'] = 'application/x-www-form-urlencoded';
            if (body !== undefined && Buffer.byteLength(body) > 65536) throw new Error('LX: invalid body');
        } catch (error) { reject(error); return; }
        let active, done = false;
        const finish = (error, result) => { if (done) return; done = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); error ? reject(error) : resolve(result); };
        const abort = () => { active?.destroy(); finish(new Error('LX: request cancelled')); };
        const timer = setTimeout(() => { active?.destroy(); finish(new Error('LX: network timeout')); }, Math.min(Math.max(Number(options.timeout) || 10000, 100), 15000));
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) return abort();
        async function hop(target, redirects = 0) {
            try {
                const { url, address } = await authorize(target, domains);
                if (done) return;

                active = (url.protocol === 'https:' ? https : http).request(url, {
                    method, headers, agent: false,
                    lookup: (_host, opts, callback) => opts.all ? callback(null, [{ address, family: 4 }]) : callback(null, address, 4),
                }, response => {
                    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
                        response.destroy();
                        if (redirects >= 3 || !response.headers.location) return finish(new Error('LX: redirect limit'));
                        // Response callbacks run after hop's try has returned.
                        try { void hop(new URL(response.headers.location, url).href, redirects + 1); }
                        catch (error) { active?.destroy(); finish(error); }
                        return;
                    }
                    const chunks = []; let bytes = 0;
                    response.on('data', chunk => { bytes += chunk.length; if (bytes > (media ? 67108864 : 1048576)) { active.destroy(); finish(new Error('LX: response too large')); } else chunks.push(chunk); });
                    response.on('error', error => finish(error));
                    response.on('end', () => {
                        if (media) return finish(null, { status: response.statusCode, headers: response.headers, bytes: Buffer.concat(chunks) });
                        const text = Buffer.concat(chunks).toString('utf8'); let parsed = text;
                        try { parsed = JSON.parse(text); } catch {}
                        finish(null, { response: { statusCode: response.statusCode, headers: response.headers }, body: parsed });
                    });
                });
                active.on('error', error => finish(error)); active.end(body);
            } catch (error) { finish(error); }
        }
        void hop(value);
    });
}
module.exports = { authorizeUrl, request, isPublic };
