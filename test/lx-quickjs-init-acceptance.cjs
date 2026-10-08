const electron = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ScriptRuntime } = require(process.env.FOLIA_QJS_RUNTIME || '../electron/lx/runtime.cjs');
const { SourceManager } = require(path.join(process.env.FOLIA_LX_PROJECT || path.resolve(__dirname, '..'), 'electron/lx/manager.cjs'));
// Owned fixtures exercise production guest initialization and cleanup, not third-party code.
const { app, BrowserWindow } = electron;
app.on('window-all-closed', () => {});
const init = "lx.on('request',()=> 'https://fixture.example/audio');lx.send('inited',{sources:{wy:{actions:['musicUrl'],qualitys:['128k']}}});";
let runtime, manager, keep;
const result = { electron: process.versions.electron, cases: [] };
const watchdog = setTimeout(() => app.exit(124), 35000);
app.whenReady().then(async () => {
  keep = new BrowserWindow({show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}});
  runtime = new ScriptRuntime(electron, {name:'owned',digest:'owned',domains:[],script:`
    const poison={toString(){throw Error('console coerced')},toJSON(){throw Error('console serialized')}};
    for(const method of ['log','info','warn','error','debug']) {
      console[method](poison, 'secret fixture');
      if(console[method].constructor('return typeof process')()!=='undefined')throw Error('host console escape');
    }
    if(Object.getPrototypeOf(console)!==null || Object.keys(console).length!==5)throw Error('console surface');
    for(let i=0;i<10000;i++)console.log(poison);
    ${init}`}, {authorize:async()=>{}});
  assert.deepEqual(await runtime.start(), ['128k']);
  assert.match(await runtime.resolve({mediaId:'123'}, 'standard'), /^folia-lx-media:/);
  assert.ok(runtime.operations < 20, 'console must not generate IPC/log storage');
  runtime.destroy(); result.cases.push('guest console five no-ops/no coercion/no host/no IPC');
  manager = new SourceManager(electron, path.join(app.getPath('temp'), 'folia-init-owned-' + process.pid));
  manager.records = [{name:'owned',digest:'owned',domains:[],script:init + "throw Error('owned after init')"}];
  await assert.rejects(manager.enable('owned', []), /owned after init/);
  assert.equal(manager.active, null); assert.equal(manager.runtime, null); assert.equal(manager.busy, false);
  assert.equal(manager.list()[0].enabled, false);
  manager.records[0].script = init;
  await manager.enable('owned', []); assert.equal(manager.list()[0].enabled, true); manager.disable();
  fs.rmSync(manager.directory, {recursive:true,force:true});
  result.cases.push('inited then top-level throw rejects/manager inactive/cleanup/retry');
  for (const [name, script] of [
    ['promise init', `Promise.resolve().then(()=>{${init}})`],
    ['timer init', `setTimeout(()=>{${init}},5)`],
    ['async init', `(async()=>{await new Promise(r=>setTimeout(r,5));${init}})()`]
  ]) {
    runtime = new ScriptRuntime(electron,{name,digest:'owned',domains:[],script},{authorize:async()=>{}});
    assert.deepEqual(await runtime.start(), ['128k']);
    assert.match(await runtime.resolve({mediaId:'123'},'standard'), /^folia-lx-media:/);
    runtime.destroy();result.cases.push(name);
  }
  runtime = new ScriptRuntime(electron,{name:'invalid init',digest:'owned',domains:[],script:"lx.on('request',()=> '');lx.send('inited',{sources:{}})"},{timeout:2000});
  await assert.rejects(runtime.start());assert.equal(runtime.closed,true);assert.equal(runtime.network.size,0);
  result.cases.push('invalid init rejects');
  result.pass = true;
}).catch(error => {result.pass=false;result.error=error.stack;}).finally(() => {
  runtime?.destroy();manager?.disable();keep?.destroy();clearTimeout(watchdog);
  fs.writeFileSync(process.env.FOLIA_QJS_RESULT || 'init-result.json', JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));app.exit(result.pass ? 0 : 1);
});
