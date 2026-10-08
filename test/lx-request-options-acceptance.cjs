const electron=require('electron');
const {app,BrowserWindow}=electron;
const http=require('node:http');
const assert=require('node:assert/strict');
const {ScriptRuntime}=require(process.env.FOLIA_QJS_RUNTIME||'../electron/lx/runtime.cjs');
// Production guest handlers only; owned loopback transport and delayed callback fixtures.
app.on('window-all-closed',()=>{});
let runtime,server,keep;const watchdog=setTimeout(()=>app.exit(1),25000);
app.whenReady().then(async()=>{
 keep=new BrowserWindow({show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}});
 let connections=0,requests=0,authorization=0,dns=0;
 server=http.createServer((req,res)=>{requests++;let body='';req.on('data',c=>body+=c);req.on('end',()=>{const finish=()=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({method:req.method,body,type:req.headers['content-type']}));};req.url==='/slow'?setTimeout(finish,150):finish();});});server.on('connection',()=>connections++);await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const authorize=async value=>{const url=new URL(value);if(url.pathname==='/audio')return {url,address:'127.0.0.1'};authorization++;assert.equal(url.origin,base);dns++;return {url,address:'127.0.0.1'};};
 const invalid=[{proxy:'http://proxy.invalid'},{cookies:true},{rejectUnauthorized:false},{unknown:1},{formData:false},{formData:null},{formData:{}},{proxy:false,cookies:false,rejectUnauthorized:false},{method:'GET',timeout:1000,headers:{accept:'application/json'},body:'ok',proxy:'x'},null,false,[],'GET',{method:false},{method:'PATCH'},{timeout:'100'},{timeout:0},{headers:[]},{headers:{cookie:'x'}},{form:false},{form:null},{form:{a:null}},{body:null},{body:'x',form:{a:1}}];
 const valid=[undefined,{}, {method:'GET',timeout:1000,headers:{accept:'application/json'}},{method:'POST',body:'raw',headers:{'content-type':'text/plain'}},{method:'POST',form:{a:'x',b:1,c:false}}];
 const cases=[...invalid.map(options=>({options,invalid:true})),...valid.map((options,i)=>({options,i}))];
 const script=`const cases=${JSON.stringify(cases)};let index=0,callbacks=0;lx.on('request',()=>new Promise((resolve,reject)=>{const c=cases[index++];if(!c){const cancel=lx.request(${JSON.stringify(base+'/slow')},{},()=>callbacks++);setTimeout(()=>cancel(),40);return setTimeout(()=>callbacks?reject(Error('late callback')):resolve(${JSON.stringify(base+'/audio')}),300);}lx.request(${JSON.stringify(base)},c.options,(error,response,body)=>{try{if(c.invalid){if(!error||!/LX: (unsupported|invalid)/.test(error.message)||response)throw Error('invalid accepted');}else{if(error||response.statusCode!==200||body.method!==(c.i<3?'GET':'POST'))throw Error('valid rejected');if(c.i===3&&body.body!=='raw')throw Error('body');if(c.i===4&&(body.body!=='a=x&b=1&c=false'||body.type!=='application/x-www-form-urlencoded'))throw Error('form');}resolve(${JSON.stringify(base+'/audio')});}catch(e){reject(e)}})}));lx.send('inited',{sources:{wy:{actions:['musicUrl'],qualitys:['128k']}}});`;
 runtime=new ScriptRuntime(electron,{name:'owned options',digest:'owned',script,domains:[]},{authorize,timeout:5000});await runtime.start();
 for(let i=0;i<invalid.length;i++){await runtime.resolve({mediaId:'123'},'standard');assert.equal(runtime.network.size,0);}
 const denied={authorization,dns,connections,requests};assert.deepEqual(denied,{authorization:0,dns:0,connections:0,requests:0},'invalid options must not reach authorization or transport');
 for(const c of valid){await runtime.resolve({mediaId:'123'},'standard');assert.equal(runtime.network.size,0);}assert.equal(requests,5);await runtime.resolve({mediaId:'123'},'standard');assert.equal(runtime.network.size,0);
 console.log(JSON.stringify({productionQuickJS:true,electron:process.versions.electron,invalidCases:invalid.length,denied,allowedCases:valid.length,cancelLateCallback:true,slotsReclaimed:true}));runtime.destroy();server.closeAllConnections();server.close();keep.destroy();clearTimeout(watchdog);app.exit(0);
}).catch(e=>{console.error(e.stack);runtime?.destroy();server?.closeAllConnections();server?.close();keep?.destroy();clearTimeout(watchdog);app.exit(1);});
