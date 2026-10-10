const electron = require('electron');
const assert = require('node:assert/strict');
const { ScriptRuntime } = require('../electron/lx/runtime.cjs');
const { scriptDigest } = require('../electron/lx/contract.cjs');
// Owned fixtures exercise the MAIN world and sandbox preload, never third-party scripts.
electron.app.on('window-all-closed', () => {});
const init = "lx.on('request',()=> 'https://fixture.example/audio');lx.send('inited',{sources:{wy:{actions:['musicUrl'],qualitys:['128k']}}});";
const watchdog = setTimeout(() => electron.app.exit(124), 30000);
let runtime;
electron.app.whenReady().then(async () => {
 const cases = [];
 const fixtures = [
  ['wy old fields', `lx.on('request',({source,action,info})=>{const m=info.musicInfo;if(source!=='wy'||action!=='musicUrl'||m.songmid!=='5275429'||m.meta.songId!==m.songmid||m.hash!==undefined||m.types.length||m.meta.qualitys.length||Object.keys(m._types).length||Object.keys(m.meta._qualitys).length)throw Error('wy fields');return 'https://fixture.example/audio'});lx.send('inited',{sources:{wy:{actions:['musicUrl'],qualitys:['128k']}}});`, false],
  ['large raw script', `/*${'x'.repeat(140000)}*/${init}`, false],
  ['invalid handler', `${init}void lx.on('request',null);`, true],
  ['script info', `/**\n * @name Owned header\n * @description Owned description\n * @version 1.2.3\n * @author Fixture\n * @homepage https://fixture.example/\n */\nif(lx.currentScriptInfo.name!=='Owned header'||lx.currentScriptInfo.description!=='Owned description'||lx.currentScriptInfo.version!=='1.2.3'||lx.currentScriptInfo.author!=='Fixture'||lx.currentScriptInfo.homepage!=='https://fixture.example/'||!lx.currentScriptInfo.rawScript.startsWith('/**'))throw Error('script info');${init}`, false],
  ['on Promise', `const p=lx.on('request',()=> 'https://fixture.example/audio'); if(!p || typeof p.then!=='function') throw Error('on return'); void p.then(value=>{if(value!==undefined)throw Error('on value');return lx.send('inited',{sources:{wy:{actions:['musicUrl'],qualitys:['128k']}}});});`, false],
  ['caught unsupported on', `lx.on('inited',()=>{}).catch(()=>{});${init}`, false],
  ['discarded unsupported on', `${init}void lx.on('no-event',()=>{});`, true],
  ['discarded duplicate on', `${init}void lx.on('request',()=>{});`, true],
  ['caught duplicate retains handler', `${init}lx.on('request',()=>{}).catch(()=>{});`, false],
  ['console', `if(Object.getPrototypeOf(console)!==null || !Object.isFrozen(console)) throw Error('console shape');
    const poison={toString(){throw Error('coercion')},get value(){throw Error('getter')}};
    for(const method of ['log','info','warn','error','debug','group','groupCollapsed','groupEnd','trace','table','assert','count','countReset','time','timeLog','timeEnd','dir','dirxml','clear','profile','profileEnd','timeStamp']) {
      if(typeof console[method]!=='function' || console[method](poison)!==undefined) throw Error('console method '+method);
    } ${init}`, false],
 ];
 for (const [name, script, reject] of fixtures) {
  runtime = new ScriptRuntime(electron, { name:'not-metadata.js', digest:scriptDigest(script), script, domains:[] }, {timeout:2000,authorize:async()=>{}});
  try {
   assert.equal(runtime.window.webContents.getLastWebPreferences().sandbox,true);
   if(reject) { await assert.rejects(runtime.start(), /native error\/unhandledrejection|handler/); assert.equal(runtime.closed,true); }
   else {
    assert.deepEqual(await runtime.start(),['128k']);
    assert.equal(await runtime.window.webContents.executeJavaScript('lx.currentScriptInfo.rawScript'),script);
    assert.match(await runtime.resolve({mediaId:'5275429'},'standard'),/^folia-lx-media:/);
   }
   cases.push({name,pass:true});
  } catch(error) { cases.push({name,pass:false,error:error.message}); } finally { runtime.destroy(); }
 }
 console.log(JSON.stringify({electron:process.versions.electron,node:process.versions.node,sandbox:true,cases}));
 clearTimeout(watchdog); electron.app.exit(cases.every(c=>c.pass)?0:1);
}).catch(error=>{console.error(error);runtime?.destroy();clearTimeout(watchdog);electron.app.exit(1)});
