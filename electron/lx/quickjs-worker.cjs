const { getQuickJS } = require('@tootallnate/quickjs-emscripten');
// Trusted utility host: only bounded JSON crosses into the no-loader QuickJS guest.
const port = process.parentPort;
let context, runtime, deadline, stopped = false;
const timers = new Map();
function post(message) { const text = JSON.stringify(message); if (text.length > 131072) throw new Error('LX: message budget'); port.postMessage(text); }
function fatal(error) { if (stopped) return; stopped = true; for (const timer of timers.values()) clearTimeout(timer); timers.clear(); try { post({kind:'fatal', error:String(error.message || error).slice(0,256)}); } finally { process.exitCode = 1; setImmediate(() => process.exit(1)); } }
function evaluate(code) { const result = context.evalCode(code); if (result.error) { const error = context.dump(result.error); result.error.dispose(); throw new Error(JSON.stringify(error)); } result.value.dispose(); }
function jobs() { const result = runtime.executePendingJobs(100); if (result.error) { const error = context.dump(result.error); result.error.dispose(); throw new Error(JSON.stringify(error)); } if (runtime.hasPendingJob()) throw new Error('LX: promise job budget'); }
function deliver(message) { deadline = Date.now() + 100; evaluate(`__deliver(${JSON.stringify(message)})`); jobs(); }
(async () => {
    const quickjs = await getQuickJS(); runtime = quickjs.newRuntime();
    runtime.setMemoryLimit(8 * 1024 * 1024); runtime.setMaxStackSize(256 * 1024); runtime.setInterruptHandler(() => Date.now() > deadline);
    context = runtime.newContext(); deadline = Date.now() + 100;
    context.newFunction('bridge', handle => {
        const text = context.getString(handle); if (text.length > 131072) throw new Error('LX: message budget');
        const message = JSON.parse(text);
        if (message.kind === 'timer') {
            if (timers.size >= 64 || !Number.isInteger(message.id) || !Number.isFinite(message.delay)) throw new Error('LX: timer budget');
            const timer = setTimeout(() => { timers.delete(message.id); try { deliver({kind:'timer',id:message.id}); } catch (error) { fatal(error); } }, Math.min(60000, Math.max(1, message.delay)));
            timers.set(message.id, timer);
        } else if (message.kind === 'clearTimer') { clearTimeout(timers.get(message.id)); timers.delete(message.id); }
        else post(message);
    }).consume(handle => context.setProp(context.global, '__bridge', handle));
    evaluate(`(() => {
        const bridge = __bridge; delete globalThis.__bridge;
        // Guest-only no-ops: no coercion, serialization, storage or host console capability.
        const quiet=()=>undefined, console=Object.create(null);
        for(const name of ['log','info','warn','error','debug'])console[name]=quiet;
        Object.defineProperty(globalThis,'console',{value:Object.freeze(console),writable:false,configurable:false});
        let handler, initialized=false, nextId=0; const callbacks=new Map(), timerCallbacks=new Map();
        const unsupported=()=>{throw Error('LX: crypto/compress/buffer utilities unsupported in Pioneer slice 1')};
        globalThis.lx={EVENT_NAMES:{request:'request',inited:'inited',updateAlert:'updateAlert'},version:'2.0.0',env:'desktop',currentScriptInfo:{},utils:{crypto:{aesEncrypt:unsupported,rsaEncrypt:unsupported,md5:unsupported,randomBytes:unsupported},buffer:{from:unsupported,bufToString:unsupported},zlib:{inflate:unsupported,deflate:unsupported}},
            on(event,fn){if(event!=='request'||handler||typeof fn!=='function')throw Error('LX: handler');handler=fn},
            async send(event,data){if(event!=='inited'||initialized||!handler)throw Error('LX: initialization');initialized=true;bridge(JSON.stringify({kind:'init',data}))},
            request(url,options,callback){if(typeof callback!=='function'||callbacks.size>=8)throw Error('LX: callback budget');const id=++nextId;callbacks.set(id,callback);bridge(JSON.stringify({kind:'network',id,url,options}));return()=>{callbacks.delete(id);bridge(JSON.stringify({kind:'cancel',id}))}}
        };
        globalThis.setTimeout=(fn,delay=0,...args)=>{if(typeof fn!=='function'||timerCallbacks.size>=64)throw Error('LX: timer callback budget');const id=++nextId;timerCallbacks.set(id,()=>fn(...args));bridge(JSON.stringify({kind:'timer',id,delay:Number(delay)}));return id};
        globalThis.clearTimeout=id=>{timerCallbacks.delete(id);bridge(JSON.stringify({kind:'clearTimer',id}))};
        Object.defineProperty(globalThis,'__deliver',{value:m=>{
            if(m.kind==='info')Object.assign(lx.currentScriptInfo,m.info);
            else if(m.kind==='invoke'){if(!initialized||!handler)throw Error('LX: not initialized');Promise.resolve().then(()=>handler(m.data)).then(value=>bridge(JSON.stringify({kind:'result',id:m.id,value})),error=>bridge(JSON.stringify({kind:'result',id:m.id,error:String(error).slice(0,256)})))}
            else if(m.kind==='networkResult'){const cb=callbacks.get(m.id);callbacks.delete(m.id);if(cb)cb(m.error?Error(m.error):null,m.response,m.body)}
            else if(m.kind==='timer'){const cb=timerCallbacks.get(m.id);timerCallbacks.delete(m.id);if(cb)cb()}
        },writable:false,configurable:false});
    })()`);
    port.on('message', event => {
        try {
            if (typeof event.data !== 'string' || event.data.length > 300000) throw new Error('LX: host message budget');
            const message = JSON.parse(event.data);
            if(message.kind==='load') { deliver({kind:'info',info:message.info}); deadline=Date.now()+100; evaluate(message.script); jobs(); post({kind:'loaded'}); }
            else if(['invoke','networkResult'].includes(message.kind)) deliver(message);
            else throw new Error('LX: host event');
            post({kind:'ack'});
        } catch(error) { fatal(error); }
    });
    post({kind:'boot'});
})().catch(fatal);
