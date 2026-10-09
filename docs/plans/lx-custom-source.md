# LX 自定义音源首切片（历史实施记录）

> 当前主线为隐藏 BrowserWindow + sandbox preload，执行须绑定脚本摘要及明确风险审批；最新合同与证据以 [浏览器脚本兼容路线](browser-script-runtime.md) 为准。下文 QuickJS utility、杀 utility、无 RTC 与初始化阻塞均为历史，不能套用于当前主线；浏览器资源不继承 QuickJS 预算，WebRTC 旁路仍须披露。已清理的 worker/旧测试可从远端 `experiment/quickjs-checkpoint`（`aec7eac310cd6b204a77ea821c4c0d75b6a39bdc`）恢复，见 [最小清理证据](../evidence/minimal-runtime-cleanup-20261010.md)。网络/媒体有效回归保留。

## Promise/async 初始化拒绝：技术阻塞（本轮，REQUEST_CHANGES，待独立 spec/quality）

- 已确认 QuickJS **0.23.0** 的 `runtime.d.ts:139–141` 明示 executePendingJobs 不返回常见 Promise/async 拒绝；`types.d.ts:91` 的 promiseRejectionHandler 是 TODO/never。实际 runtime、FFI、WASM JS 导出均无 rejection tracker。没有猜 API、升级包或改 Promise 原型作为生产修复。
- 新增 `test/lx-quickjs-rejection-acceptance.cjs`：queued/async/void-discarded/timer async 未处理拒绝应拒绝启动并清理；manager应 inactive/清理/重试；caught Promise/async 与正常 async timer 应成功。生产 worker/runtime **未修改**，没有 GREEN，不得批准。Node child 仅替代 IPC 的诊断实跑 pinned QuickJS：四种未处理全部错误 resolved/closed=false，manager错误 enabled=true；已捕获两种及正常 async 成功。该 RED exit1 不是 Electron utility 验收。
- guest桥实证：覆盖 Promise.prototype.then 时，void async await 拒绝 thenCalls=0、eval结果undefined；因此该桥及仅观察eval返回Promise都漏掉 intrinsic/discarded async。启动协议只延迟 loaded 或追加显式catch，不能观察全部已丢弃Promise；无限等待未来拒绝也不构成可靠ready。需要获准使用带原生tracker的QuickJS构建/版本或改变脚本协议，当前约束下未找到可靠路径。
- 当前 ready 仍仅要求 init声明+顶层及queued jobs执行完成；timer/network回调内init可立即使ready完成，未提供该回合拒绝检查。目标边界应为声明init的执行回合及其有界微任务排空/拒绝检查后ready，之后新回合未处理拒绝fatal并撤权，不无限等待未来timer；此为待实现合同，非当前保证。
- 本轮 Node v26.7.0，相关109文件1038项、typecheck、现有Node测试均exit0；新拒绝测试仍RED。2380文件生产/ext4清单 `promise-init-fix/ext4-manifest.json` SHA256 `397c3a6cf474f5c12e28d90e916d543a7879d6a25c5b3c2139deb162228dc0a6`，各轮前后无漂移。旧2379清单不得代替本轮。历史asar SHA `b4a7b976a2de47c4407ba6623ad3ac70d4e0bdfef0b13335520496f72fd01a9f`复核未改，未生成新asar/冒称packaged GREEN。
- Windows最小cmd/PowerShell/直接Electron.exe均Invalid argument，Electron未启动；Linux WSLg :0虽有socket仍Missing X server后SIGTRAP，headless替代SIGSEGV，无真实utility/options/lifecycle/Audio本轮结果。没有禁sandbox/改系统策略/安装。完整诊断、失败与版本绑定日志及改前backup：`/home/administrator/.hermes/cache/scratch/folia-lx/promise-init-fix/`。未重跑公网用户源/执行22未知源；不改broker/media/cache/Biu/UI，无commit/push。

## 两项独立 quality 阻断修复（等待父 spec 再 quality）

- 根因：异步response callback不受hop外层try保护，畸形Location同步抛至宿主；manager共享`.next`且未串行记录变更。改前再次自有fixture复现双方exit1及rename ENOENT，未复现数据丢失。分别增加callback本地catch→finish/cleanup；manager排队所有持久化路径，snapshot在队列内，rename后commit内存、失败reject且队列恢复，保留busy/立即撤权及crash/init重试。
- 新增redirect/persistence/Windows quality三测试文件。RED redirect exit1、manager两失败；最小修复GREEN。新Windows真实utility验证并发enable/remove/import/save最终恢复、restart disabled、busy拒绝、立即撤权、写失败旧记录不提交/再enable；rename gate及EACCES均明确故障注入。transport畸形拒绝、连接0、8次media失败slot0后合法请求成功；relative/absolute成功及私网0命中。
- 最终Node26.7.0 38/38、109文件1038/1038、typecheck和diff-check exit0；Windows44.3.0新quality/options/cancel/lifecycle/Audio四轮均exit0，未重试/flaky。2378文件清单SHA `a76a3f42d2657007ccb3d797787939e92666d23e286f338fc490f043185a4a26`，8轮前后无漂移；新asar86条目/8LX模块匹配，SHA `e5903cf7c0f4638d67db564452ac32af8fee32442f3a2b4d1b1d6ab1a338e98a`。旧6880清单不用于本轮。
- 日志 `/home/administrator/.hermes/cache/scratch/folia-lx/`：`quality-fix-{original-red,redirect-red,redirect-green,manager-red,manager-green}.log`，`spec-recheck-quality-fix-{node,redirect,regression,typecheck}`、`win-quality-{fix,options,lifecycle,audio}` log/result及`quality-fix-summary.json`。改前`quality-fix-backup/`。180秒慢网不重跑；stream SHA因本次catch改变，旧慢网仅历史不冒称同SHA当前验证。loopback/picker注入边界不变，未执行24用户源/完整平台/桌面/可听设备，无安装升级commit/push，未改Biu计划/UI；自测不等于独立批准。

## QuickJS 接入历史（仅实验分支；非当前正式路径）

- `electron/lx/runtime.cjs` 已改用 Electron `utilityProcess` 与 `quickjs-worker.cjs`，不调用 BrowserWindow/executeJavaScript，无旧浏览器 fallback；旧 preload 入口明确拒绝。QuickJS 0.23.0 升为精确直接生产依赖，只改根 lock 声明，未安装或升级其他包。宿主有可信 Node 权限，隔离边界是无 module loader 的 QuickJS realm，不是 OS 网络 sandbox。
- 仅字符串 JSON 传输；8MiB 客体内存、256KiB stack、每执行片100ms interrupt、100 Promise jobs、64个一次性timer、4个解析/8个网络/2000消息预算、初始化/解析timeout及1.5s外部watchdog。保留 LX init/on/send/request/cancel、Promise和setTimeout/clearTimeout；不支持 interval/full utils。崩溃清token/abort/pending，并同步manager inactive；spawn失败不锁死enable。
- TDD public runtime transport RED exit1→GREEN；最终Node36项exit0。真实Windows Electron44.3.0，直接生产runtime和小型app.asar路径均exit0：客体无RTC/fetch/DOM/Node/WebAssembly，constructor取不到host，四档musicUrl、Promise/timer、CPU/OOM/module失败清理、实际broker HTTP200且hit1、自有UDP listener实收0。CPU183ms/OOM98ms含utility启动；不是纯执行耗时。未禁sandbox，未用外部Node运行客体。
- 现成asar工具确认86 entries、worker/index.js和generated两JS存在；0.23.0 WASM内嵌JS，无独立wasm文件。builder精确解包worker及包dist，Windows app.asar实跑验证loader路径。没有完整平台发行/安装，也未改变fuse；Electron utilityProcess不依赖RunAsNode。
- 当前SHA清单 `quickjs-production-manifest.json`；结果 `quickjs-windows-packaged-result.json`、`quickjs-package-result.json`、`quickjs-production-node.log`，备份 `quickjs-production-backup/`，均在 `/home/administrator/.hermes/cache/scratch/folia-lx/`。清单目前是最终文件/依赖绑定，不冒充所有命令前后完整ext4回归绑定。
- 补验已完成：Windows Electron44.3.0 从生产同字节 app.asar 执行options24非法（授权/DNS/connect/HTTP全0）+5合法、取消晚回slot0；96次RTC读取路径无能力，UDP0、HTTP1，普通app RTC仍可用。frame/meta不支持，不冒充原浏览器96包攻击复现。constructor/async取不到Node，node:fs module拒绝。新lifecycle实际utility crash→inactive/解析错误→再enable，initfail恢复、disable pending/init、CPU/OOM/stack/Promise/timer、2000消息压力与4并发第5拒绝；watchdog丢ACK故障注入后真实1.5s超时杀child并收到exit。超大消息在初始化timeout2500ms关闭，不声称即时拒绝。
- 真实script→lx.request→HTTP JSON→media token→sandbox Audio seeked/ended/currentTime1通过；Range56bytes、redirect私网0、重授权拒绝、撤销410/pending abort通过。Node36、相关103文件1000项、typecheck、sandbox Chromium管理组件1项均新实跑exit0，管理IPC明确mock。生产/ext42375文件清单 `quickjs-recovery-ext4-manifest.json` SHA256 `6880c87738487ccc56295b5ce3a5116cba7889b9ef1d031c718aeb9bb36c38c9`；`spec-recheck-qjs-verified-{regression,typecheck,component}` 与 `recovery-node-verified`、`win-{options,rtc,audio,lifecycle}-verified` log/result记录命令/版本/exit/前后无漂移。asar86条目与生产8个runtime模块逐字节一致。180sMP3/FLAC64KiB慢网仅沿用相同media-stream/media SHA历史，不冒充新重跑。
- 首轮lifecycle错误地要求init必须reject，实际先init后fatal而exit1，保留 `win-lifecycle-first.log`；修正测试等待关闭，未改生产。watchdog是lost-ACK注入不是成功挂死可信Node宿主。未执行24用户脚本，无安装升级/commit/push/release；独立spec→quality仍待审，不批准发布。

## QuickJS 时期已交付边界（历史；当前以浏览器路线为准）

只接本地 .js 导入 → 主进程 SHA-256 存储 → Folia 管理面板显式域名确认 → 独立 QuickJS utility runtime → Omni 网易云 musicUrl。不下载执行第三方脚本；自写 fixture，不复制 LX / biu 实现。原 4 provider 搜索、来源标识、混合列表不变。不包含账号、B站、下载、同步及 kw/mg 检索。

管理入口：固定音源按钮及 desktop command `lx-sources`；i18n en/zh-CN，命令另含 in。导入保存原脚本文本、摘要、文件 basename 和确认过的域名，不保存原本地路径。上限 20 脚本、256 KiB/脚本；重启从不自动运行。最多启用一个；更改脚本形成新摘要，不继承授权。移除需确认。启用失败抛错，已启用解析失败不调用原 provider；未启用/非网易云仍用原路径。

## QuickJS 时期精确兼容合同（历史；当前增量见浏览器路线）

`lx.version=2.0.0`、`env=desktop`、`currentScriptInfo` 含 basename/id，version/author/description 暂空，不解析元数据头。单槽 `on(request, handler)`；`send(inited)` 一次且先注册 handler；init 必须声明 wy/musicUrl 及支持 qualitys，与本切片交集。其余 source 不路由。`updateAlert`、search、任意事件不支持，明确报错。utils.crypto/buffer/zlib 入口明确抛不支持；未知 utils 不存在，不能称全 LX 兼容。

请求 `{source:'wy', action:'musicUrl', info:{type,musicInfo}}`，meta.songId、qualitys、_qualitys；映射 standard/high/lossless/hires → 128k/320k/flac/flac24bit，仅已声明音质可请求。返回 HTTP(S) URL <=2048、无 userinfo。返回保留网易云身份，不注册新的 search provider，custom 不伪造 ReplayGain、不经过原 Folium 后置 audio hook。

`lx.request(url,options,callback(err,response,body))` 返回 cancel 函数。options 默认省略/{}有效，仅允许自有字段 method/timeout/headers/body/form；其余字段（包括 proxy、cookies、rejectUnauthorized、formData 即使 false/null）按存在明确拒绝，组合不部分执行。所有字段校验均在授权/DNS/网络前，错误回到 callback。method必须字符串 GET/POST/PUT/DELETE/HEAD（大小写不敏感），timeout必须正有限number，执行clamp至100ms–15s；headers必须非null非数组对象且仅字符串 Accept/Content-Type/User-Agent；body必须字符串；form必须非null非数组对象且值仅字符串/有限number/boolean，body与form同时出现拒绝，序列化最多64KiB。formData、cookies、Authorization、代理、自定义证书、Buffer、全 utils 均不支持。JSON body 自动解析，否则字符串；response.statusCode/headers。<=1MiB 响应，最多3次重定向逐跳授权；4个解析/8个网络并发、2000消息总预算、128KiB消息、初始化和解析15s预算。停用杀utility、abort网络、拒绝 pending，不接晚回。

## 旧浏览器 WebRTC 未授权UDP阻塞（历史无 RTC 合同；当前明确披露旁路）

真实生产sandbox、domains=[]并不能隔离ICE/STUN。单标准入口实收自有UDP4包80bytes；新增 `test/lx-webrtc-acceptance.cjs` 标准/webkit、descriptor及prototype.constructor、about:blank子frame、meta放宽尝试最终96包1920bytes（exit1）；Worker异步SecurityError。仅自有随机loopback端口，不扫描。不能再把下文“直接页面网络阻断”解读为全部网络隔离已成立。

查证Chromium150 Connection-Allowlist解析和RTCPeerConnection原生NotAllowedError代码及Electron session.protocol文档。专属session HTTPS bootstrap响应头 `();webrtc=block` 实际未生效，执行脚本前原生检查fail-closed；真实HTTP对照及显式feature启用仍OPEN。候选已撤回，生产runtime与 `webrtc-backup/electron/lx/runtime.cjs` 完全相同；失败源码留 `webrtc-native-candidate-rejected.cjs`。未用可恢复JS遮盖或全应用RTC禁用，不禁sandbox、不安装升级；没有找到满足当前版本/范围的可靠策略，**未修复，未取得GREEN，必须阻塞**。

2370实现/测试/配置文件清单 `webrtc-final-manifest.json` SHA256 `fe7e0de521ea0042c60f0c34df9375d6b3aa07cc317062d04266fca64701afa4`。`spec-recheck-webrtc-final-{red,node-bound,sandbox,security,runtime,typecheck,regression}.log` 完整命令/Node26.7.0/exit及前后生产/ext4SHA一致；Electron43.7.5/Chromium150.0.7871.250。除WebRTC exit1，其余exit0：Node34、103文件1000项、typecheck、sandbox安全8、非法options24授权/DNS/connect/hit0与合法5+cancel、broker→token→Audio ended。媒体及180秒测试SHA与旧options清单一致，未重跑长慢网，不将旧证据伪装本轮。日志 `/home/administrator/.hermes/cache/scratch/folia-lx/`，summary `webrtc-final-summary.json`；失败/timeout/DBus保留。管理IPCmock、rebind constructor注入及完整桌面/平台/可听设备未验收不变，等待父spec再quality。

## 早期浏览器隔离说明（历史；当前路线见 browser-script-runtime.md，网络/媒体合同仍保留）

独立非 persist partition，sandbox=true、nodeIntegration=false、contextIsolation=true、webSecurity=true；专用 preload 仅 lx，不使用 app preload；阻断直接页面网络、导航、弹窗/webview，权限全拒绝。仅首次精确 bootstrap data URL 放行。IPC 验证 runtime/main 的 sender 与 mainFrame。主进程请求无 cookie/用户凭据；域名严格 exact 无 wildcard/IP，仅80/443；DNS全部记录公网 IPv4，拒绝内网/loopback/保留地址及全部 IPv6，连接固定查验 IP，逐跳重验防 DNS rebinding。

**媒体接缝已收口，待独立审查**：runtime 不再向 renderer 返回原 HTTP(S)，而是随机256-bit `folia-lx-media://audio/<token>`，真实 URL 仅当前摘要 runtime 的 MediaBroker 持有。生产 defaultSession protocol handler 只能选择当前 runtime 已铸 token，非 localhost 通用代理，无任意 URL 参数。每次读取、Range seek、每跳重定向复用 network.cjs exact域名/DNS全部IPv4校验及固定IP；重定向立即销毁响应，不继续读无限body。Node all-address lookup callback兼容已修复。

媒体仅 GET/HEAD 和单 Range；只转发 Range，不带 Cookie/Auth/脚本header，响应仅 Content-Type/Content-Range/Accept-Ranges/Content-Length，CORS `*` 不允许 credentials，Cache-Control no-store。不是无限 streaming：媒体专用 `media-stream.cjs` 在收到响应头后返回背压流；Node及Web队列各64KiB（另允许一个有限chunk），每请求64MiB累计字节、首响应/消费等待上游无进度15秒、总传输20分钟、4个活动流。消费者背压暂停时不误算上游idle，但总预算继续计时。真实206校验单Range及长度，缺Content-Length时由合法Content-Range推导；忽略Range明确返回真实200（seek依赖浏览器，不保证高效），不伪造206；拒绝压缩编码、过大及矛盾响应。不支持HLS/播放清单/额外媒体header。最多200 token，TTL20分钟，过期410，停用/移除/失败/更换runtime立即清token并abort待网络，晚回丢弃；已被播放器读入的字节不能远程收回。共享播放后缓存及automix缓存不存LX音频，不污染netease共享缓存；原provider已缓存字节仍按既有优先级播放。内存prefetch旧token可留存，但撤权后服务端410且不静默原provider回退；过期需重新解析。DNS lookup本身未abort，但deadline后不连接。保持单播放内核，Omni身份/搜索provider合同不变。

## 恢复轮历史验证（不能绑定当前生产版本，不作为当前验收）

独立 spec 已发现此前 ext4 副本 network.cjs/media.cjs 与生产不同，媒体 seek 断言也未完整同步；下列 resume PASS 缺少生产/副本散列绑定，只保留历史过程，不证明当前实现通过。当前证据以文末 spec-recheck 清单与日志为准。

日志同目录 `resume-*.log`，改前 `resume-backup/`。真实Electron媒体RED exit1，断言私网redirect endpoint被命中1次；GREEN私网命中0、访问重新授权拒绝、Range206/56bytes、跨源Audio seeked/ended、撤权410和pending abort。重绑定场景注入构造授权策略变化，不冒充真实公网DNS改记录；另Node真实hostname HTTP固定IP覆盖Node autoSelectFamily all callback。缓存RED明确旧实现写入共享audio，GREEN禁止LX持久化。完整主应用/真实平台/可听设备仍未验收。


恢复轮最终实跑：`resume-regression.log` 103文件/1000项通过exit0（services含QQ合同、search、playback、command、playlists、cache、automix）；`resume-typecheck.log` exit0；`resume-node-verified.log` 6项通过exit0；`resume-chromium.log` 管理组件1项首试通过exit0，IPC仍明确mock；`resume-lx-runtime-security-verified.log` 8场景完成exit0，`resume-lx-runtime-acceptance-verified.log` 自写script→HTTP→token→Audio ended/duration1 exit0，`resume-lx-media-acceptance-verified.log` Range/seeked/ended/撤权完成exit0。git diff --check exit0。初轮hostname固定IP测试失败保留于resume-node.log，暴露Node all-address callback签名后已修复；不是隐去flaky。DBus、Node localStorage、ext4无git和npm配置告警保留。

## 验证与证据

日志 `/home/administrator/.hermes/cache/scratch/folia-lx/`；改前 backup/。
- RED init/network 模块缺失 → GREEN；Omni 去掉仅ext4的前置路由重跑 `red-omni-behavior.log` exit1，再恢复。
- `node-final.log` 实际磁盘导入/恢复/移除、契约/网络；后续 `node-acceptance.log` 补 redirect/cancel/timeout。
- `regression.log` 54文件411项通过exit0（搜索/导航/播放/命令/列表/迁移/LX）。typecheck-final exit0。
- `chromium-green.log` 真实Chromium 1项通过exit0：授权 gating、导入/启停/删除、reload内容恢复。IPC为显式mock；fixture会clear storage，reload通过addInitScript恢复已读记录，不冒充真实主进程磁盘验收。真实磁盘由node manager测试覆盖。早期PATH cross-env找不到、reload清存储失败均保留，不改公共gallery。
- 独立 Electron 初跑exit133 Gtk无display。发现已有WSLg X0，设置 DISPLAY=:0/XDG_RUNTIME_DIR 即可运行，无安装/禁用sandbox。首次真实runtime揭露bootstrap拦截、Proxy不可clone，修复后GREEN。`runtime-security-final.log` 自写8场景真实sandbox、init/resolve timeout、非法URL/quality、网络拒绝/cancel、停用晚回、crypto失败，exit0。早轮窗口全关导致Electron提前exit0但无完成指标，不计通过。
- `runtime-playback.log` 真实LX脚本→受控HTTP→自有1秒WAV→独立Electron Audio播放ended/duration=1/currentTime=1，exit0。loopback只test constructor authorize override，生产IPC不可设置。不证明Folia完整UI/真实平台播放、可听音频设备或登录验收。
- Node v26.7.0及现成ext4依赖，无安装/升级/commit/push。只写Pioneer与scratch。WSLg运行DBus告警保留，主应用SIGTRAP未重验。

## 当前 options 修复证据（等待独立 spec → quality）

- 修改 `electron/lx/network.cjs`，新增 `test/lx-request-options.test.cjs`（23项）和 `test/lx-request-options-acceptance.cjs`。proxy 单例RED实际到达authorization→GREEN；类型/校验时序第二轮RED→GREEN，日志 `spec-recheck-options-{red,green-first,types-red,types-green}.log`。这四份早轮Node v22仅行为历史；最终统一既有Node v26.7.0。
- 2369文件生产/ext4完整散列清单 `options-final-manifest.json` 摘要 `ecff3d7b88c86a74dd05c1f77323ed590b6b52411acd2af1ad2930371175d8b2`，旧881ca593仅媒体历史不绑定新实现。`spec-recheck-options-final-{node,regression,typecheck,sandbox,security,runtime}.log`及同名result.json均exit0且前后清单一致：Node34项；services/search/playback/command/playlists/cache/automix 103文件1000项；typecheck；真实sandbox安全8场景；真实自写script→HTTP→token→Audio ended/duration1。
- 新真实sandbox验收24种非法options，经lx.request专用preload/runtime返回callback错误，无挂起，authorization/dns/connections/requests均0；5种允许请求保留默认GET/headers/timeout/POST body/form，cancel无callback且slot回收。DNS计数为testconstructor受控策略边界，不是真实公网DNS修改；生产IPC不可设置override。最终无重试/flaky。没有重新生成音频或重测180秒慢网，未改媒体专用流架构。
- 验收脚本初次末表达式返回函数导致executeJavaScript结果不可clone并提前exit0，缺完成指标不计通过；watchdog揭示不完整，void结尾修正后完整通过。DBus告警保留。改前备份 `options-backup/`，完整日志均在既有scratch folia-lx。保留管理摘要/授权/重启不自动执行及Omni身份/音质/active失败不回退。无安装升级commit/push、原三仓只读；本轮自测不等于独立spec批准，待父代理复审后再quality。

## 慢网定点修复当前证据（独立 spec → quality 尚待进行）

- `media.cjs` 改接新增媒体专用 `media-stream.cjs`，provider的 `network.cjs` 未改。新增 `test/lx-media-stream.test.cjs`，更新真实duration和撤权流测试；仅Pioneer和scratch可写，无安装升级commit/push。`stream-backup/` 保存生产改前文件。
- 最终2367文件清单 `stream-final-manifest.json`，SHA256 `881ca593b6f4e2b77fdedc00a17400b00a83c0ad5202b96f3747a88665658c6c`。现成Node v26.7.0/Electron v43.7.5。`spec-recheck-stream-final-{node,regression,typecheck,component,duration,media,security,runtime}.log` 全部exit0，头尾绑定完整命令及前后相同manifest；Node11项、103文件1000项、sandbox安全8场景、Chromium管理1项（IPC mock）。没有完成独立审查。
- 旧实现RED诊断：`stream-diagnose-monotonic-red.log` 同时记录单调/墙钟；MP3网络deadline真实15015.5ms而墙钟elapsed13366ms，证明墙钟回退约1.65s；FLAC真实15005.2ms。两者只有一次bytes=0-请求，finish均network timeout而非并发/取消。历史FLAC13.38s不能解释成特殊网络根因，短wall elapsed机制已复现于MP3；原始那次缺单调记录不能反推精准偏移。
- 额外同一最终测试的基线对照 `stream-bound-red.log` exit1：仅将副本media.cjs替换为真实改前备份；2367文件基线manifest SHA `b29eca7168876e0aca0ae382b733b6179652813926694142b1c26884c200dc43`，命令/版本/前后SHA绑定。随后恢复最终副本并全量核验一致，未改生产。
- GREEN自有180秒样本，平均MP3 40014、FLAC 56422bytes/s，64KiB/s两者均够实时，完整下载需110/155秒。最终前段推进MP3 1.271s、FLAC 2.592s；duration180、seek5/170、后段再播全通过，全流程5.826/21.988s，仅传327680/1732410bytes。FLAC后段seek多次Range探测较慢，不冒称与MP3一样快，不证明不足码率持续无缓冲。
- HEAD/单Range/suffix/416/忽略Range真实200、64MiB声明拒绝、15s无headers/无body进度、consumer cancel回收4slot并销毁上游、撤权body error/旧410、活动TTL abort均真实测试通过。私网redirect命中0及每访问重授权拒绝真实Electron验证；rebind是constructor注入，不是真实公网改DNS。已读字节不能收回，完整桌面/可听设备/真实平台仍未验收。
- 首次并行Node运行被外层timeout中断且取消1项，`spec-recheck-stream-node.log`保留；串行最终11项通过。DBus等告警保留。只更新文档后未改实现，不以自测代替父spec再quality。

## spec-recheck历史：版本绑定复测及旧可用性阻塞（已由上节修复替代）

全量同步 src/electron/shared/test/dev/api-ts/api 与根配置，共2365文件。`/home/administrator/.hermes/cache/scratch/folia-lx/spec-recheck-manifest.json` 逐项记录relative路径、生产/副本实际SHA256；摘要 `8e6253c52d0d949ccf0b614bd14623c2f23a77ad512a6321c4bdea0fb154ab64`。每条 `spec-recheck-*.log` 头尾记录该摘要、完整命令、cwd、Node v26.7.0、exit，运行前后2365文件散列全部一致；测试结束未改实现。执行器 `spec-recheck-run.py`、样本清单 `spec-recheck-audio-manifest.json` 同目录。生产文档不属于实现清单。

本轮 Node 6项、typecheck、相关 services/search/playback/command/playlists/cache/automix 回归103文件1000项均exit0，含QQ合法合同及原聚合/混合列表边界。真实Electron sandbox安全8场景、runtime script→HTTP→token→Audio、媒体Range206/56bytes、seeked/ended、私网跳转命中0、访问重新授权拒绝、停用410/pending abort均exit0。重绑定只是constructor授权策略变化，非真实公网DNS修改。Chromium管理组件1项通过；IPC显式mock，不证明整应用。仓库Playwright默认有no-sandbox，故另用scratch `spec-recheck-playwright.config.ts`去掉该参数并显式chromiumSandbox=true，`spec-recheck-chromium-sandbox.log`再次1项exit0；Electron从未禁sandbox。

新增自有 `test/lx-media-duration.cjs`，现成ffmpeg6.1.1合成seed123粉噪声、44.1kHz双声道180秒；MP3 320k为7202525bytes，FLAC s16为10155933bytes，样本实际SHA及ffprobe在清单。不盲等整曲：生产custom protocol的真实Electron Audio均duration180，seek5秒和170秒后播放推进；不限速耗时MP3 351ms、FLAC376ms。受控HTTP每秒65536bytes时两者均失败mediaError4，收到917504bytes后失败（MP3约15.006s，FLAC约13.380s；独立重建broker后仍如此，FLAC确切提前失败原因未定位，不应冒称精确15s超时）；`spec-recheck-duration.log` exit2并明确usabilityBlocked=true，未伪装PASS。

**结论：普通时长/MP3/FLAC在高速受控源可播可seek，但慢网可用性未达标，阻塞首切片通过。** network.cjs等待全响应缓冲完成才返回，每请求15s/64MiB上限使足以实时播放320k的64KiB/s源也无法起播。不能靠无界放宽限制解决。最小安全后续候选是在现有authorize/pinned-IP/逐跳重授权之下增加有界Range分块或背压流式响应；必须保留摘要域名绑定、无凭据、4并发、bytes预算、Abort/TTL/撤权，拒绝不遵守Range的无界源，且不要支持HLS。该改动影响响应生命周期、安全预算和播放器Range，属于显著可用性改造：本轮按要求完成绑定证据后停止实现扩展，等待父spec复审/明确后续修复范围，再quality；不以免责声明宣称普通歌曲普遍可用。scratch sandbox override初次typecheck因base.use可空失败，日志保留 `spec-recheck-typecheck-audit-config-failure.log`，修正scratch配置后typecheck和sandbox组件均重新exit0，未改生产配置。DBus/localStorage/ext4无git告警原样保留，无安装升级提交推送，原三仓只读。

