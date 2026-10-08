const { app, BrowserWindow, ipcMain, session } = require('electron');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
// Real sandbox tests use only self-written fixtures. Loopback override is test-constructor-only.
const { ScriptRuntime } = require(path.join(process.env.FOLIA_LX_PROJECT || path.resolve(__dirname, '..'), 'electron/lx/runtime.cjs'));
app.on('window-all-closed', () => {});
app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async () => {
    let requests = 0;
    const server = http.createServer((req, res) => { requests++; if (req.url === '/slow') return setTimeout(() => res.end('{}'), 1000); res.setHeader('content-type','application/json'); res.end(JSON.stringify({url:base+'/owned.wav'})); });
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const authorize = async value => { const url = new URL(value); if(url.origin !== base) throw new Error('test origin denied'); return {url,address:'127.0.0.1'}; };
    const fixtures = [];
    const make = (script, timeout=500) => { const runtime = new ScriptRuntime({BrowserWindow,ipcMain,session},{name:'Owned fixture',digest:'test',script,domains:[]},{authorize,timeout}); fixtures.push(runtime); return runtime; };
    const init = "lx.send('inited',{sources:{wy:{actions:['musicUrl'],qualitys:['128k']}}});";
    try {
        const good = make(`if(typeof process !== 'undefined' || typeof require !== 'undefined' || window.electron) throw new Error('isolation');
          lx.on('request',({info})=>new Promise((resolve,reject)=>lx.request('${base}/resolve',{},(err,resp,body)=>err?reject(err):resolve(body.url)))); ${init}`,3000);
        await good.start(); assert.match(await good.resolve({mediaId:'123'},'standard'),/^folia-lx-media:\/\/audio\/[a-f0-9]{64}$/);
        assert.equal(good.window.webContents.getLastWebPreferences().sandbox,true);
        await assert.rejects(good.resolve({mediaId:'123'},'high'),/unsupported/);
        good.destroy();
        const invalid = make(`lx.on('request',()=> 'file:///etc/passwd'); ${init}`); await invalid.start(); await assert.rejects(invalid.resolve({mediaId:'123'},'standard'),/HTTP/); invalid.destroy();
        const notInit = make("lx.on('request',()=> 'https://x.example');"); await assert.rejects(notInit.start(),/initialization timeout/);
        const hung = make(`lx.on('request',()=>new Promise(()=>{})); ${init}`); await hung.start(); await assert.rejects(hung.resolve({mediaId:'123'},'standard'),/musicUrl timeout/);
        const late = make(`lx.on('request',()=>new Promise(resolve=>setTimeout(()=>resolve('${base}/owned.wav'),100))); ${init}`); await late.start(); const pending=late.resolve({mediaId:'123'},'standard'); const rejected=assert.rejects(pending,/stopped/); setTimeout(()=>late.destroy(),20); await rejected;
        const denied = make(`lx.on('request',()=>new Promise((resolve,reject)=>lx.request('http://127.0.0.1:1/no',{},err=>err?reject(err):resolve('${base}/owned.wav')))); ${init}`); await denied.start(); await assert.rejects(denied.resolve({mediaId:'123'},'standard'),/denied/); denied.destroy();
        const cancelled = make(`lx.on('request',()=>new Promise(resolve=>{ const cancel=lx.request('${base}/slow',{},()=>resolve('file:///bad')); cancel(); setTimeout(()=>resolve('${base}/owned.wav'),150); })); ${init}`); await cancelled.start(); assert.match(await cancelled.resolve({mediaId:'123'},'standard'),/^folia-lx-media:\/\/audio\/[a-f0-9]{64}$/); cancelled.destroy();
        const crypto = make("lx.utils.crypto.aesEncrypt('x');"); await assert.rejects(crypto.start());
        console.log(JSON.stringify({realElectron:true,sandbox:true,isolation:true,passed:8,networkRequests:requests,checks:['musicUrl-network','quality','invalid-url','init-timeout','resolve-timeout','disable-late','denied-network','cancel-crypto']}));
        fixtures.forEach(r=>r.destroy()); server.close(); app.exit(0);
    } catch(error) {console.error(error.stack);fixtures.forEach(r=>r.destroy());server.close();app.exit(1);}
});
