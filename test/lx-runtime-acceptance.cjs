const { app, BrowserWindow, ipcMain, session, protocol } = require('electron');
const http = require('node:http');
const path = require('node:path');
// Real Electron sandbox acceptance with a self-written script and test-only loopback authorization.
const { ScriptRuntime } = require(path.join(process.env.FOLIA_LX_PROJECT || path.resolve(__dirname, '..'), 'electron/lx/runtime.cjs'));
protocol.registerSchemesAsPrivileged([{scheme:'folia-lx-media',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
app.commandLine.appendSwitch('headless');
app.commandLine.appendSwitch('disable-gpu');
let server;
app.whenReady().then(async () => {
    const wav = Buffer.alloc(44 + 16000); wav.write('RIFF'); wav.writeUInt32LE(wav.length-8,4); wav.write('WAVEfmt ',8); wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22); wav.writeUInt32LE(8000,24); wav.writeUInt32LE(16000,28); wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34); wav.write('data',36); wav.writeUInt32LE(16000,40);
    server = http.createServer((req, res) => { if (req.url === '/owned.wav') { res.setHeader('content-type','audio/wav'); res.end(wav); return; } res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ url: 'https://fixture.example/owned.wav' })); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const script = `if(typeof process !== 'undefined' || typeof require !== 'undefined' || window.electronAPI) throw new Error('isolation failed');
      lx.on(lx.EVENT_NAMES.request, ({source, action, info}) => new Promise((resolve,reject) => {
        if(source !== 'wy' || action !== 'musicUrl' || info.type !== '128k' || info.musicInfo.meta.songId !== '123') return reject(new Error('contract failed'));
        lx.request('${base}/resolve', {method:'GET'}, (err,resp,body) => err ? reject(err) : resolve(body.url));
      }));
      lx.send(lx.EVENT_NAMES.inited, {sources:{wy:{actions:['musicUrl'],qualitys:['128k']}}});`;
    const authorize = async value => { const url = new URL(value); if(url.origin !== base && url.hostname !== 'fixture.example') throw new Error('test origin denied'); return {url: url.hostname === 'fixture.example' ? new URL(base + '/owned.wav') : url,address:'127.0.0.1'}; };
    const runtime = new ScriptRuntime({ BrowserWindow, ipcMain, session }, { name:'Self-written acceptance', digest:'test', script, domains:[] }, {authorize,timeout:5000});
    try {
        runtime.mediaApproval.onChanged=()=>{const c=runtime.mediaApproval.list()[0];if(c)runtime.mediaApproval.decide({id:c.id,digest:c.digest,approved:true,acknowledged:true});};
        const qualities = await runtime.start();
        const url = await runtime.resolve({mediaId:'123',name:'Owned fixture'}, 'standard');
        if(!/^folia-lx-media:\/\/audio\/[a-f0-9]{64}$/.test(url)) throw new Error('wrong URL');
        protocol.handle('folia-lx-media', request => runtime.media.fetch(request));
        const player = new BrowserWindow({show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}});
        await player.loadURL('data:text/html,<body>Owned fixture player</body>');
        const playback = await player.webContents.executeJavaScript(`new Promise((resolve,reject)=>{ const audio=new Audio(${JSON.stringify(url)}); audio.onended=()=>resolve({ended:true,duration:audio.duration,currentTime:audio.currentTime}); audio.onerror=()=>reject(new Error('media '+audio.error?.code)); audio.play().catch(reject); setTimeout(()=>reject(new Error('play timeout')),5000); })`);
        if(!playback.ended || playback.duration !== 1) throw new Error('owned audio playback failed');
        console.log(JSON.stringify({realElectron:true,sandbox:runtime.window.webContents.getLastWebPreferences().sandbox,qualities,url:'owned fixture',network:true,isolation:true,playback}));
        player.destroy(); runtime.destroy(); server.close(); app.exit(0);
    } catch(error) { console.error(error.stack); runtime.destroy(); server.close(); app.exit(1); }
}).catch(error => { console.error(error.stack); app.exit(1); });
