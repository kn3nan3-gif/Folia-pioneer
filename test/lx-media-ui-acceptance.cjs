const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const electron = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { registerLxSources } = require('../electron/lx/manager.cjs');
// Real app preload and React UI on owned Vite page; picker alone is replaced.
// Run with Vite on 4174; do not run during source synchronization/HMR.
protocol.registerSchemesAsPrivileged([{scheme:'folia-lx-media',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
app.commandLine.appendSwitch('disable-gpu');
let main, manager;
// UI copy is localized; assert the media consent/decision labels in the active locale, not just English.
const locale = process.env.LX_UI_LOCALE === 'zh-CN' || process.env.LX_UI_LOCALE === 'in' ? process.env.LX_UI_LOCALE : 'en';
const labels = {
    en: ['LX custom sources', 'Import local .js', 'Authorize & enable', 'Disable', 'Deny media domain', 'Approve media domain', 'audio playback only'],
    'zh-CN': ['LX 自定义音源', '导入本地 .js', '授权并启用', '停用', '拒绝媒体域名', '批准媒体域名', '仅本次会话内'],
    in: ['LX custom sources', 'Import local .js', 'Authorize & enable', 'Disable', 'Tolak domain media', 'Setujui domain media', 'Izinkan domain persis ini']
}[locale];
const wait = async expression => { const end = Date.now()+15000; while(Date.now()<end){ if(await main.webContents.executeJavaScript(expression)) return; await new Promise(r=>setTimeout(r,50)); } throw Error('UI wait: '+expression); };
app.whenReady().then(async()=>{
 const dir=await fs.mkdtemp(path.join(process.env.TMPDIR,'media-native-')); app.setPath('userData',dir);
 const script=path.join(dir,'owned.js'); await fs.writeFile(script,"lx.on('request',()=>Promise.resolve('https://cdn.example/audio?secret=hidden'));lx.send('inited',{sources:{wy:{actions:['musicUrl'],qualitys:['128k']}}});");
 ipcMain.handle('set-app-locale', () => null);
 main=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,preload:path.resolve('electron/preload.cjs')}});
 main.webContents.on('console-message', event => console.log('renderer',event.message));
 manager=registerLxSources({...electron,dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[script]})}},()=>main);
 await main.loadURL('http://127.0.0.1:4174/dev/lx-media-approval.html?locale=' + locale);
 await wait("!!document.querySelector('button')");
 const click=async text=>{await wait(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent===${JSON.stringify(text)})`); await main.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(text)}).click()`);};
 await click(labels[0]); await click(labels[1]);
 await wait("!!document.querySelector('input[type=checkbox]')");
 await main.webContents.executeJavaScript("document.querySelector('input[type=checkbox]').click()"); await click(labels[2]);
 await wait(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent===${JSON.stringify(labels[3])})`);
 const result=manager.resolve({providerId:'netease',mediaId:'123'},'standard'); const denied=assert.rejects(result,/denied/);
 await wait('document.body.textContent.includes(' + JSON.stringify(labels[6]) + ')');
 assert.equal((await main.webContents.executeJavaScript('document.body.textContent')).includes(labels[6]), true, 'localized media consent copy: ' + locale);
 assert.equal((await main.webContents.executeJavaScript('document.body.textContent')).includes('cdn.example'), true);
 assert.equal(manager.runtime.media.tokens.size,0); assert.equal((await main.webContents.executeJavaScript('document.body.textContent')).includes('secret'),false);
 await click(labels[4]); await denied;
 const result2=manager.resolve({providerId:'netease',mediaId:'123'},'standard'); const failed=assert.rejects(result2,/ENOTFOUND/);
 await click(labels[5]); await failed;
 assert.deepEqual(manager.list()[0].mediaDomains,['cdn.example']);
 assert.deepEqual(manager.list()[0].domains,[]);
 const stored = await fs.readFile(path.join(manager.directory, 'sources.json'), 'utf8');
 assert.equal(stored.includes('cdn.example'), true); // script text, not session grants
 const persisted = JSON.parse(stored)[0];
 assert.equal(persisted.mediaDomains, undefined); assert.equal(persisted.mediaChallenges, undefined);
 const resolving3=manager.resolve({providerId:'netease',mediaId:'123'},'standard'); const dnsFailure=assert.rejects(resolving3,/ENOTFOUND/); await dnsFailure;
 await manager.importLocal(); assert.equal(manager.active, null); assert.equal(manager.runtime, null);
 manager.disable(); assert.deepEqual(manager.list()[0].mediaChallenges,undefined);
 console.log(JSON.stringify({locale,realAppPreload:true,realManager:true,realReactUI:true,sandbox:main.webContents.getLastWebPreferences().sandbox,deny:true,approve:true,apiGrantUnchanged:true}));
 app.exit(0);
}).catch(e=>{console.error(e.stack);manager?.disable();main?.destroy();app.exit(1)});
