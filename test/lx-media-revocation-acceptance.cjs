const electron = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { SourceManager } = require('../electron/lx/manager.cjs');
const { scriptDigest } = require('../electron/lx/contract.cjs');
// Real manager/realm decision entry: rejection must revoke capabilities, not just throw.
electron.app.on('window-all-closed', () => {});
electron.app.commandLine.appendSwitch('disable-gpu');
const script = "lx.on('request',()=>Promise.resolve('https://cdn.example/audio'));lx.send('inited',{sources:{wy:{actions:['musicUrl'],qualitys:['128k']}}});";
let manager, directory;
const watchdog = setTimeout(() => electron.app.exit(124), 30000);
electron.app.whenReady().then(async () => {
    directory = await fs.mkdtemp(path.join(process.env.TMPDIR, 'media-revocation-'));
    manager = new SourceManager(electron, directory);
    manager.records = [{ name: 'owned.js', script, digest: scriptDigest(script), domains: ['api.example'] }];
    const r = manager.list()[0];
    await manager.enable(r.digest, r.domains, { digest: r.digest, reviewVersion: r.review.version, riskVersion: r.review.riskVersion, acknowledged: true });
    const runtime = manager.runtime;
    runtime.mediaApproval.authorize = async value => ({ url: new URL(value), address: '93.184.216.34' });
    const challenge = new Promise(resolve => { manager.onStateChanged = records => { const c = records[0]?.mediaChallenges?.[0]; if (c) resolve(c); }; });
    const resolving = manager.resolve({ providerId: 'netease', mediaId: '123' }, 'standard');
    const c = await challenge;
    const payload = { id: c.id, digest: c.digest, approved: true, acknowledged: true };
    manager.decideMedia(payload);
    const { url: token } = await resolving;
    assert.equal(runtime.media.tokens.size, 1);
    assert.throws(() => manager.decideMedia(payload), /stale/);
    assert.equal(runtime.media.tokens.size, 0, 'replay must revoke all existing tokens');
    assert.deepEqual(runtime.mediaApproval.domains, [], 'replay must clear session grants');
    assert.equal(runtime.mediaEpoch, 1);
    assert.equal((await runtime.media.fetch(new Request(token))).status, 410);
    assert.deepEqual(runtime.record.domains, ['api.example']);
    // Each attempt begins with a granted domain and token, then fails through manager.decideMedia.
    const pendingChallenge = async (host = 'other.example') => {
        const pending = runtime.mediaApproval.authorizeCandidate(`https://${host}/audio`, host);
        const rejected = assert.rejects(pending, /stale|explicit|denied|timeout|stopped/);
        return { c: runtime.mediaApproval.list()[0], rejected };
    };
    for (const mode of ['digest', 'malformed', 'expired', 'deny']) {
        runtime.mediaApproval.domains.push('cdn.example'); runtime.media.issue('https://cdn.example/audio');
        const epoch = runtime.mediaEpoch;
        const { c: next, rejected } = await pendingChallenge();
        if (mode === 'expired') runtime.mediaApproval.now = () => next.expires;
        const decision = { id: next.id, digest: mode === 'digest' ? 'b'.repeat(64) : next.digest, approved: mode !== 'deny', acknowledged: mode !== 'malformed' };
        if (mode === 'deny') manager.decideMedia(decision);
        else assert.throws(() => manager.decideMedia(decision), /stale|explicit/);
        await rejected; runtime.mediaApproval.now = Date.now;
        assert.equal(runtime.mediaEpoch, epoch + 1); assert.equal(runtime.media.tokens.size, 0);
        assert.deepEqual(runtime.mediaApproval.domains, []); assert.deepEqual(runtime.record.domains, ['api.example']);
    }
    // Pause actual result authorization at DNS; deny another challenge and then release DNS.
    let releaseDns, enteredDns;
    const dnsEntered = new Promise(resolve => { enteredDns = resolve; });
    runtime.mediaApproval.domains.push('cdn.example');
    runtime.mediaApproval.authorize = value => { enteredDns(); return new Promise(resolve => { releaseDns = () => resolve({ url: new URL(value), address: '93.184.216.34' }); }); };
    const inFlight = assert.rejects(manager.resolve({ providerId: 'netease', mediaId: '123' }, 'standard'), /revoked/);
    await dnsEntered;
    const { c: denying, rejected: deniedOther } = await pendingChallenge();
    manager.decideMedia({ id: denying.id, digest: denying.digest, approved: false, acknowledged: true });
    releaseDns(); await inFlight; await deniedOther;
    assert.equal(runtime.media.tokens.size, 0); assert.deepEqual(runtime.mediaApproval.domains, []);
    // An old instance's payload is fail-closed against the current instance, never ignored.
    const approval = { digest: r.digest, reviewVersion: r.review.version, riskVersion: r.review.riskVersion, acknowledged: true };
    await manager.enable(r.digest, r.domains, approval);
    const newer = manager.runtime; newer.mediaApproval.domains.push('cdn.example'); newer.media.issue('https://cdn.example/audio');
    assert.throws(() => manager.decideMedia(payload), /stale/);
    assert.equal(newer.mediaEpoch, 1); assert.equal(newer.media.tokens.size, 0); assert.deepEqual(newer.mediaApproval.domains, []);
    // Direct manager lifecycle operations, with live grants/tokens/challenges each time.
    const file = path.join(directory, 'owned.js'); await fs.writeFile(file, script);
    manager.electron = { ...electron, dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [file] }) } };
    for (const mode of ['disable', 'remove', 'restart', 'reimport', 'script-change']) {
        if (!manager.records.length) await manager.importLocal();
        const record = manager.list()[0];
        await manager.enable(record.digest, ['api.example'], { digest: record.digest, reviewVersion: record.review.version, riskVersion: record.review.riskVersion, acknowledged: true });
        const old = manager.runtime; old.mediaApproval.domains.push('cdn.example');
        const oldToken = old.media.issue('https://cdn.example/audio');
        const stopped = assert.rejects(old.mediaApproval.authorizeCandidate('https://other.example/audio', 'lifecycle'), /stopped/);
        if (mode === 'disable') manager.disable();
        if (mode === 'remove') await manager.remove(record.digest);
        if (mode === 'restart') {
            manager.disable(); const restarted = new SourceManager(electron, directory); await restarted.load();
            assert.equal(restarted.runtime, null); assert.equal(restarted.active, null);
            assert.ok(restarted.list().every(item => !item.enabled && !item.mediaDomains));
        }
        if (mode === 'reimport') await manager.importLocal();
        if (mode === 'script-change') { await fs.writeFile(file, script + '\n// changed digest'); await manager.importLocal(); }
        await stopped;
        assert.equal(old.closed, true); assert.deepEqual(old.mediaApproval.domains, []); assert.deepEqual(old.mediaApproval.list(), []);
        assert.equal(old.media.tokens.size, 0); assert.equal((await old.media.fetch(new Request(oldToken))).status, 410);
        const persisted = JSON.parse(await fs.readFile(path.join(directory, 'sources.json'), 'utf8'));
        assert.ok(persisted.every(item => Object.keys(item).sort().join(',') === 'digest,domains,name,script'));
    }
    console.log(JSON.stringify({ replayRevoked: true, invalidDecisions: true, dnsRace: true, crossInstance: true, lifecycle: ['disable','remove','restart','reimport','script-change'], sandbox: true }));
    manager.disable(); await fs.rm(directory, { recursive: true, force: true }); clearTimeout(watchdog); electron.app.exit(0);
}).catch(async error => { console.error(error.stack); manager?.disable(); if (directory) await fs.rm(directory, { recursive: true, force: true }); clearTimeout(watchdog); electron.app.exit(1); });
