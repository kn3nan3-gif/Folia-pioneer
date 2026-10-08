const electron = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const project = process.env.FOLIA_LX_PROJECT || path.resolve(__dirname, '..');
const { ScriptRuntime } = require(path.join(project, 'electron/lx/runtime.cjs'));
const { SourceManager } = require(path.join(project, 'electron/lx/manager.cjs'));
// Owned rejection fixtures run the production utility; RED must not be disguised as a pass.
const init = "lx.on('request',()=> 'https://fixture.example/audio');lx.send('inited',{sources:{wy:{actions:['musicUrl'],qualitys:['128k']}}});";
const result = { electron: process.versions.electron, platform: process.platform, cases: [] };
let runtime, manager, keep;
const watchdog = setTimeout(() => electron.app.exit(124), 35000);
electron.app.on('window-all-closed', () => {});
// Keep all outcomes, including failures, so a first RED cannot hide the async case.
async function check(name, run) {
  try { await run(); result.cases.push({ name, pass: true }); }
  catch (error) { result.cases.push({ name, pass: false, error: error.stack }); }
  finally { runtime?.destroy(); manager?.disable(); }
}
electron.app.whenReady().then(async () => {
  keep = new electron.BrowserWindow({ show: false, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } });
  for (const [name, script] of [
    ['queued unhandled rejection', `Promise.resolve().then(()=>{${init}throw Error('owned queued failure')})`],
    ['async unhandled rejection', `(async()=>{await Promise.resolve();${init}throw Error('owned async failure')})()`],
    ['discarded async rejection', `void (async()=>{await Promise.resolve();${init}throw Error('owned discarded failure')})()`],
    ['timer async init rejection', `setTimeout(()=>{void (async()=>{await Promise.resolve();${init}throw Error('owned timer failure')})()},5)`]
  ]) await check(name, async () => {
    runtime = new ScriptRuntime(electron, { name, digest: 'owned', domains: [], script }, { timeout: 2000 });
    await assert.rejects(runtime.start(), /owned .* failure/);
    assert.equal(runtime.closed, true); assert.equal(runtime.network.size, 0); assert.equal(runtime.pending.size, 0);
  });
  await check('manager rejects/cleans/retries', async () => {
    manager = new SourceManager(electron, path.join(electron.app.getPath('temp'), 'folia-rejection-owned-' + process.pid));
    manager.records = [{ name: 'owned', digest: 'owned', domains: [], script: `void (async()=>{await Promise.resolve();${init}throw Error('owned manager failure')})()` }];
    try {
      await assert.rejects(manager.enable('owned', []), /owned manager failure/);
      assert.equal(manager.active, null); assert.equal(manager.runtime, null); assert.equal(manager.busy, false);
      assert.equal(manager.list()[0].enabled, false);
      manager.records[0].script = init;
      await manager.enable('owned', []); assert.equal(manager.list()[0].enabled, true);
    } finally { manager.disable(); fs.rmSync(manager.directory, { recursive: true, force: true }); }
  });
  for (const [name, script] of [
    ['caught Promise rejection', `Promise.reject(Error('handled')).catch(()=>{});${init}`],
    ['caught async rejection', `(async()=>{await Promise.resolve();throw Error('handled')})().catch(()=>{});${init}`],
    ['normal async timer init', `void (async()=>{await new Promise(r=>setTimeout(r,5));${init}})()`]
  ]) await check(name, async () => {
    runtime = new ScriptRuntime(electron, { name, digest: 'owned', domains: [], script }, { timeout: 2000, authorize: async () => {} });
    assert.deepEqual(await runtime.start(), ['128k']);
    assert.match(await runtime.resolve({ mediaId: '123' }, 'standard'), /^folia-lx-media:/);
    assert.equal(runtime.closed, false);
  });
  result.pass = result.cases.every(item => item.pass);
}).catch(error => { result.pass = false; result.error = error.stack; }).finally(() => {
  runtime?.destroy(); manager?.disable(); keep?.destroy(); clearTimeout(watchdog);
  fs.writeFileSync(process.env.FOLIA_QJS_RESULT || 'rejection-result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result)); electron.app.exit(result.pass ? 0 : 1);
});