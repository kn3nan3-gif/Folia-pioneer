const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { ScriptRuntime } = require('../electron/lx/runtime.cjs');
// Public runtime transport contract; real utilityProcess acceptance is separate.
test('LX runs in a utility process and fails closed on exit', async () => {
  const worker = new EventEmitter(); worker.postMessage = () => {}; worker.kill = () => {};
  let forked; const runtime = new ScriptRuntime({ utilityProcess: { fork(file) { forked = file; return worker; } } }, { name:'fixture', digest:'owned', domains:[], script:'' });
  const started = runtime.start();
  worker.emit('message', JSON.stringify({kind:'init', data:{sources:{wy:{name:'wy',type:'music',actions:['musicUrl'],qualitys:['128k']}}}}));
  let ready = false; started.then(() => { ready = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ready, false, 'init event must not finish script load');
  worker.emit('message', JSON.stringify({kind:'loaded'}));
  await started;
  assert.match(forked, /quickjs-worker\.cjs$/);
  worker.emit('exit', 1);
  assert.equal(runtime.closed, true);
  assert.equal(runtime.network.size, 0);
});
test('utility spawn failure clears manager enable lock for retry', async () => {
 const { SourceManager } = require('../electron/lx/manager.cjs');
 const manager = new SourceManager({utilityProcess:{fork(){throw Error('spawn failure')}}},'unused');
 manager.records=[{digest:'owned',domains:[],script:''}];
 await assert.rejects(manager.enable('owned',[]),/spawn failure/);
 assert.equal(manager.busy,false); assert.equal(manager.active,null);
 await assert.rejects(manager.enable('owned',[]),/spawn failure/);
});
