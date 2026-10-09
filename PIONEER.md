# Folia-pioneer：第一阶段独立基线

> 当前主线为隐藏 BrowserWindow + sandbox preload；最新合同与证据见 [浏览器脚本兼容路线](docs/plans/browser-script-runtime.md)。下列 QuickJS/旧 WebRTC 阻断及各轮验收均为历史，不是当前路线保证。QuickJS worker 与旧测试已从 main 清理，可从已远端保存的 `experiment/quickjs-checkpoint`（`aec7eac310cd6b204a77ea821c4c0d75b6a39bdc`）恢复；清理证据见 [最小清理](docs/evidence/minimal-runtime-cleanup-20261010.md)。

## Promise/async 初始化拒绝：技术阻塞（本轮，REQUEST_CHANGES，待独立 spec/quality）

- 已确认 QuickJS **0.23.0** 的 `runtime.d.ts:139–141` 明示 executePendingJobs 不返回常见 Promise/async 拒绝；`types.d.ts:91` 的 promiseRejectionHandler 是 TODO/never。实际 runtime、FFI、WASM JS 导出均无 rejection tracker。没有猜 API、升级包或改 Promise 原型作为生产修复。
- 新增 `test/lx-quickjs-rejection-acceptance.cjs`：queued/async/void-discarded/timer async 未处理拒绝应拒绝启动并清理；manager应 inactive/清理/重试；caught Promise/async 与正常 async timer 应成功。生产 worker/runtime **未修改**，没有 GREEN，不得批准。Node child 仅替代 IPC 的诊断实跑 pinned QuickJS：四种未处理全部错误 resolved/closed=false，manager错误 enabled=true；已捕获两种及正常 async 成功。该 RED exit1 不是 Electron utility 验收。
- guest桥实证：覆盖 Promise.prototype.then 时，void async await 拒绝 thenCalls=0、eval结果undefined；因此该桥及仅观察eval返回Promise都漏掉 intrinsic/discarded async。启动协议只延迟 loaded 或追加显式catch，不能观察全部已丢弃Promise；无限等待未来拒绝也不构成可靠ready。需要获准使用带原生tracker的QuickJS构建/版本或改变脚本协议，当前约束下未找到可靠路径。
- 当前 ready 仍仅要求 init声明+顶层及queued jobs执行完成；timer/network回调内init可立即使ready完成，未提供该回合拒绝检查。目标边界应为声明init的执行回合及其有界微任务排空/拒绝检查后ready，之后新回合未处理拒绝fatal并撤权，不无限等待未来timer；此为待实现合同，非当前保证。
- 本轮 Node v26.7.0，相关109文件1038项、typecheck、现有Node测试均exit0；新拒绝测试仍RED。2380文件生产/ext4清单 `promise-init-fix/ext4-manifest.json` SHA256 `397c3a6cf474f5c12e28d90e916d543a7879d6a25c5b3c2139deb162228dc0a6`，各轮前后无漂移。旧2379清单不得代替本轮。历史asar SHA `b4a7b976a2de47c4407ba6623ad3ac70d4e0bdfef0b13335520496f72fd01a9f`复核未改，未生成新asar/冒称packaged GREEN。
- Windows最小cmd/PowerShell/直接Electron.exe均Invalid argument，Electron未启动；Linux WSLg :0虽有socket仍Missing X server后SIGTRAP，headless替代SIGSEGV，无真实utility/options/lifecycle/Audio本轮结果。没有禁sandbox/改系统策略/安装。完整诊断、失败与版本绑定日志及改前backup：`/home/administrator/.hermes/cache/scratch/folia-lx/promise-init-fix/`。未重跑公网用户源/执行22未知源；不改broker/media/cache/Biu/UI，无commit/push。

## LX 两项质量阻断定点修复（等待父独立 spec → quality，未批准）

- 独立复现再次确认：authorized 302 `Location: http://[` 使两个transport子进程exit1；并发remove的`.next` rename出现ENOENT，未证明数据丢失。callback本地catch分别走finish/cleanup，未放宽逐跳授权；manager统一排队import/remove/enable持久化及save，队列内生成snapshot，rename成功后提交内存，失败向调用者传播且不毒化后续队列。enable busy与disable立即撤权保留。
- TDD真实RED→GREEN：redirect测试exit1→0；并发持久化2失败→2通过。新增3文件：`test/lx-redirect-regression.cjs`、`test/lx-persistence-regression.test.cjs`、`test/lx-quality-acceptance.cjs`。正常相对/绝对跳转、私网0命中、畸形media连续8次502后slot0/后续成功/连接0、并发启用导入删除保存、重启disabled、写失败恢复均验证。
- Node26.7.0最终38项通过；services/search/navigation/playback/command/playlists/cache/automix 109文件1038项通过；typecheck及diff-check exit0。Windows Electron44.3.0真实生产utility/app.asar完成新quality、options24非法/5合法/cancel、lifecycle、Audio seek/ended/Range/撤权，四轮exit0，无重试/flaky。
- 2378文件生产/ext4清单 `quality-fix-ext4-manifest.json` SHA256 `a76a3f42d2657007ccb3d797787939e92666d23e286f338fc490f043185a4a26`；8轮命令均记录版本/exit/前后无漂移。新asar86条目、8个LX模块逐字节一致，SHA256 `e5903cf7c0f4638d67db564452ac32af8fee32442f3a2b4d1b1d6ab1a338e98a`。旧6880清单不绑定本轮代码。
- 完整日志/summary/改前backup在 `/home/administrator/.hermes/cache/scratch/folia-lx/quality-fix*`、`spec-recheck-quality-fix*`、`win-quality-*`。loopback授权与native picker为测试注入；新Windows并发用rename gate固定交叠、EACCES注入验证失败，不冒充真实系统故障。180秒慢网未重跑，stream SHA已改变，旧证据只作历史；未验完整桌面/平台登录/可听设备，未执行24用户音源，无安装升级commit/push，原三仓只读，Biu计划/UI不改。

## QuickJS 接入历史（仅实验分支；非当前正式路径）

- `electron/lx/runtime.cjs` 已改用 Electron `utilityProcess` 与 `quickjs-worker.cjs`，不调用 BrowserWindow/executeJavaScript，无旧浏览器 fallback；旧 preload 入口明确拒绝。QuickJS 0.23.0 升为精确直接生产依赖，只改根 lock 声明，未安装或升级其他包。宿主有可信 Node 权限，隔离边界是无 module loader 的 QuickJS realm，不是 OS 网络 sandbox。
- 仅字符串 JSON 传输；8MiB 客体内存、256KiB stack、每执行片100ms interrupt、100 Promise jobs、64个一次性timer、4个解析/8个网络/2000消息预算、初始化/解析timeout及1.5s外部watchdog。保留 LX init/on/send/request/cancel、Promise和setTimeout/clearTimeout；不支持 interval/full utils。崩溃清token/abort/pending，并同步manager inactive；spawn失败不锁死enable。
- TDD public runtime transport RED exit1→GREEN；最终Node36项exit0。真实Windows Electron44.3.0，直接生产runtime和小型app.asar路径均exit0：客体无RTC/fetch/DOM/Node/WebAssembly，constructor取不到host，四档musicUrl、Promise/timer、CPU/OOM/module失败清理、实际broker HTTP200且hit1、自有UDP listener实收0。CPU183ms/OOM98ms含utility启动；不是纯执行耗时。未禁sandbox，未用外部Node运行客体。
- 现成asar工具确认86 entries、worker/index.js和generated两JS存在；0.23.0 WASM内嵌JS，无独立wasm文件。builder精确解包worker及包dist，Windows app.asar实跑验证loader路径。没有完整平台发行/安装，也未改变fuse；Electron utilityProcess不依赖RunAsNode。
- 当前SHA清单 `quickjs-production-manifest.json`；结果 `quickjs-windows-packaged-result.json`、`quickjs-package-result.json`、`quickjs-production-node.log`，备份 `quickjs-production-backup/`，均在 `/home/administrator/.hermes/cache/scratch/folia-lx/`。清单目前是最终文件/依赖绑定，不冒充所有命令前后完整ext4回归绑定。
- 补验完成（仍待独立spec→quality）：Windows Electron44.3.0真实生产app.asar utility通过非法options24（授权/DNS/connect/HTTP全0）、合法5及cancel晚回slot0；RTC96次读取无能力/UDP0/HTTP1，DOM/frame/meta明确不支持；普通app RTC未禁用。constructor/async Node与node:fs module拒绝。实际manager crash→inactive/报错→再enable、initfail恢复、disable pending/init、CPU/OOM/stack/Promise/timer、2000IPC消息/4并发第5拒绝通过。lost-ACK故障注入验证真实1.5s watchdog杀child并收到exit；不是实际挂死可信Node。超大消息由2500ms初始化timeout关闭。
- script→lx.request→HTTP→token→sandbox Audio seeked/ended通过，Range/私网0/重授权拒绝/410/abort通过。Node36、103文件1000项（含LX cache/automix排除）、typecheck、sandbox Chromium管理组件1项均新跑exit0，管理IPC明确mock。生产/ext42375文件清单 `quickjs-recovery-ext4-manifest.json` SHA256 `6880c87738487ccc56295b5ce3a5116cba7889b9ef1d031c718aeb9bb36c38c9`；日志 `spec-recheck-qjs-verified-{regression,typecheck,component}`、`recovery-node-verified`、`win-{options,rtc,audio,lifecycle}-verified`记录版本/命令/exit/无漂移。asar86条目生产8个runtime文件逐字节匹配；媒体180s慢网仅沿用相同SHA历史。首轮lifecycle断言错误exit1保留，不是生产修复。只改测试/文档，生产未改，未执行用户24脚本，无安装升级commit/push/release。

## 旧浏览器 LX WebRTC 未授权 UDP（历史无 RTC 合同；当前路线明确披露旁路风险）

- 本轮未取得可靠 GREEN，不批准网络隔离合同。真实生产 `ScriptRuntime`、domains=[]、sandbox=true：原单入口 STUN 自有 UDP RED 为4包80bytes；新增 `test/lx-webrtc-acceptance.cjs` 覆盖标准/webkit、descriptor/prototype.constructor、about:blank 子frame、meta移除/放宽尝试，最终96包1920bytes、exit1；Worker入口实际异步 SecurityError。只绑定自有127.0.0.1随机UDP端口，未扫描。
- 查证 Electron protocol/session 官方文档及 Chromium 150源码的 Connection-Allowlist 原生阻断；尝试专属session HTTPS handler 返回 `Connection-Allowlist: ();webrtc=block`，执行脚本前fail-closed检查未通过。独立真实HTTP对照及显式启用该已查证feature仍返回OPEN；不能把源码存在当现成Electron已有效。失败候选仅留scratch `webrtc-native-candidate-rejected.cjs`，生产runtime已按备份逐字节恢复，未留下导致所有音源不可用的假修复。未采用可恢复JS遮盖、全应用关RTC、禁sandbox或安装升级。
- 最终2370文件生产/ext4散列一致，`webrtc-final-manifest.json` SHA256 `fe7e0de521ea0042c60f0c34df9375d6b3aa07cc317062d04266fca64701afa4`；`spec-recheck-webrtc-final-{red,node-bound,sandbox,security,runtime,typecheck,regression}.log`绑定命令/版本/exit/前后SHA。除WebRTC RED外均exit0：Node34、相关103文件1000项、typecheck、安全8、非法options24（授权/DNS/connect/hit0）及合法5+cancel、自写script→broker HTTP→token→Audio ended。Node26.7.0/Electron43.7.5/Chromium150.0.7871.250。
- media/media-stream/180秒测试与旧options清单SHA相同，仅沿用慢网历史，不声称本轮重测。管理IPC mock、rebind constructor注入、完整桌面/平台/可听设备未验收不变。完整证据 `/home/administrator/.hermes/cache/scratch/folia-lx/`，summary `webrtc-final-summary.json`；改前 `webrtc-backup/`，所有失败/外层timeout/DBus告警保留。仅新增回归和更新文档；生产行为未修好，必须继续REQUEST_CHANGES，待父spec再quality，不自行批准。

## LX request options 定点修复（等待独立 spec，再 quality）

- `network.cjs` 在授权/DNS/连接前校验 options 白名单，仅 method/timeout/headers/body/form；未知或不支持字段按存在即拒绝，包括 formData:false/null、proxy/cookies/rejectUnauthorized 及组合。字段类型严格，body/form 同时出现明确拒绝；默认 GET、有限 timeout、字符串 body、标量 form、取消均保留。未改媒体流架构、Omni身份/音质/active失败不回退及管理授权/重启规则。
- TDD：proxy 行为 RED（实际到达 authorization）→GREEN；类型/提前拒绝再 RED→GREEN。早轮默认 Node v22 的日志仅作行为历史，最终全部使用既有 Node v26.7.0，无安装。
- 最终2369实现/测试/配置文件生产/ext4逐项SHA一致，`folia-lx/options-final-manifest.json` SHA256 `ecff3d7b88c86a74dd05c1f77323ed590b6b52411acd2af1ad2930371175d8b2`；六份 `spec-recheck-options-final-*.log` 命令/版本/exit/前后SHA绑定且全部exit0。Node34项、相关回归103文件1000项、typecheck通过；真实sandbox安全8场景和script→HTTP→token→Audio ended/duration1通过。
- 新真实Electron测试24种非法options均经lx.request→preload→runtime→错误callback，不挂起，授权/DNS/connection/HTTP hit全0；5种允许请求（默认/GET/POST body/form）成功，cancel不回调且slot清零。loopback仅测试constructor注入，非生产IPC。未重跑完整桌面或真实平台；慢网180秒样本旧证据属上次媒体版本，不冒充本轮重测。
- 新验收脚本初次末表达式返回函数触发Electron结果不可clone/提前exit0，无完成指标，不计通过；加watchdog并用void结束后取得完整指标。最终无重试/flaky；WSLg DBus告警保留。改前备份 `folia-lx/options-backup/`；只写Pioneer及scratch，无commit/push。独立spec尚待复审，不自行批准或进入quality。

## LX 慢网定点修复：真实 RED→GREEN，等待独立 spec 再 quality

- 当前2367实现/测试/配置文件同步并逐项比对生产/ext4副本SHA256；`folia-lx/stream-final-manifest.json` 摘要 `881ca593b6f4e2b77fdedc00a17400b00a83c0ad5202b96f3747a88665658c6c`。`spec-recheck-stream-final-*.log` 头尾绑定完整命令、Node v26.7.0、exit及无漂移；现成Electron v43.7.5，未安装/禁sandbox。
- 根因是等待整首缓冲的15秒总deadline。诊断日志 `stream-diagnose-monotonic-red.log` 显示slow MP3真实15015.5ms超时、Date.now却仅13366ms：墙钟在运行中回退约1.65s；历史FLAC短wall elapsed机制已复现于MP3；原始那次缺单调记录，不能反推精准偏移，不是已证明的FLAC特有Range/并发/取消。slow FLAC真实15005.2ms超时，仅一次bytes=0-请求，两者mediaError4。后续指标改用单调时钟。诊断副本含临时日志，不作为最终生产绑定证据。
- 新媒体专用背压流保留域名/DNS全公网IPv4/固定IP/逐跳授权，无凭据。Node/Web各64KiB队列，64MiB/request、15秒首响应/消费无进度、20分钟总传输、4活动流、200token及20分钟TTL；取消/撤权/过期销毁连接并回收slot/timer。真实Range/HEAD/416，忽略Range保持200不伪造206。provider request/cache及单播放内核未改，不新增HLS。
- 自有180秒MP3/FLAC平均40014/56422bytes/s，64KiB/s均足实时，完整下载需110/155秒。最终真实Audio前段推进1.271/2.592秒，duration180、seek5/170及后段再播通过；全流程5.826/21.988秒，累计仅327680/1732410bytes，未下载整首。不是证明低于码率网络无缓冲。
- 最终Node11项、回归103文件1000项、typecheck、真实sandbox安全8场景、runtime Audio、媒体Range/seek/ended/私网命中0/重授权拒绝/撤权abort、Chromium管理1项全部exit0。管理IPC仍mock，重绑定是constructor策略注入；不证明完整桌面/平台登录/可听设备。首次并行Node被外层timeout中断，保留日志，串行最终重测通过。
- 改前备份 `folia-lx/stream-backup/`；样本清单 `spec-recheck-audio-manifest.json`。原三仓只读，无安装升级commit/push。独立spec、quality尚未完成，不以自测替代审查。


基于 Folia-major `e4b1c5c1` / `0.7.13` 的实验性派生项目，不是 Folia 官方发行版。当前完成独立身份与更新隔离，并实现聚合搜索首个功能切片；未完成多项目整体能力整合。Folia 的 React/Electron 界面、布局、主题、歌词动画和原有品牌说明保留；未引入 lx/Vue 外壳，也未复制 biu 代码。

## 独立身份与数据

- npm：`folia-pioneer`；产品名：`Folia-pioneer`；桌面 app ID / Windows AUMID：`local.folia.pioneer`（本地实验标识，非已注册域名）。
- 主进程在初始化 Store、session、单实例锁之前设置名称及 userData/sessionData。
- Windows 默认数据：`%APPDATA%\Folia-pioneer`；Linux：`$XDG_CONFIG_HOME/Folia-pioneer`（未设置时通常 `~/.config/Folia-pioneer`）；macOS：`~/Library/Application Support/Folia-pioneer`。
- 配置、Electron 浏览器存储、凭据、默认媒体缓存、模型和模组数据跟随独立 userData。不会自动导入、覆盖或迁移 Folia 数据。用户手动配置的外部缓存/模型目录不在此隔离保证内。
- Web 开发版仍按浏览器 origin 保存数据；不要与原 Folia 使用同一浏览器 origin。Stage/OBS/Lyric API 默认端口仍沿用上游，同时开启两项目时需调整端口。
- 禁止全部桌面更新路径：启动、手动、预览、下载、安装及打开发行页面；已有 upstream channel 设置无法恢复更新。尚无 Pioneer 更新源。
- electron-builder 的全局/Linux publish 均为空；本次禁用以下 7 个上游 workflow，保留原文并改为 `.yml.disabled`，不会被 GitHub Actions 自动识别：
  - `canary-pre-release.yml`、`nightly-pre-release.yml`、`release-candidate.yml`、`electron-release.yml`
  - `docker-stack-publish.yml`、`sync-server-docker-publish.yml`、`codemap-sync.yml`
  前 6 个涉及发布，`codemap-sync` 涉及自动 commit/push；均不作为 Pioneer 自动化入口。`pr-unit-tests.yml` 与 `docker-stack-check.yml` 保持启用。上游 AGENTS.md 中关于 codemap 自动同步的说明在此派生项目中不再适用，代码地图仍可手动生成。旧 AUR 包和上游 README 保留作历史参考，不是 Pioneer 发布入口。没有发布、推送或自动 commit。

## 启动与验证

要求 Node `>=24.0.0`；保留所有依赖版本和锁定项，仅同步 lockfile 的项目名称。

在本项目目录、兼容 Node 环境中：

```sh
npm ci
node --test test/pioneer-baseline.test.cjs
npm run typecheck
npm run test:unit -- test/unit/electron/updateChannels.test.ts
npm run dev -- --port 31731 --strictPort
# 有图形桌面的 Windows / macOS / Linux 环境：
npm run dev:electron
```

本次使用 Node `v24.21.0`、npm `11.17.0`，ext4 副本：
`/home/administrator/.hermes/cache/scratch/folia-pioneer-baseline/build`。
`npm ci` 成功；身份/数据/更新边界测试 3 项通过（均有 RED→GREEN 记录），上游更新通道回归 10 项通过，typecheck 通过。Vite 根页面与 main.tsx 转换响应均为 HTTP 200；这仅是服务冒烟，不等于完整页面渲染或音乐播放验证。

首次 Electron 启动等待下载超时；随后镜像下载成功。主进程启动及软件图形回退均退出 SIGTRAP；当前 WSL 会话 DISPLAY/Wayland 均为空，未完成图形桌面启动验证，也未证明缺少显示器是 SIGTRAP 的唯一原因。没有运行完整安装包构建或跨平台验证。

日志目录：`/home/administrator/.hermes/cache/scratch/folia-pioneer-baseline/`。
主要文件：`npm-ci.log`、`final-identity.log`、`typecheck.log`、`update-channels.log`、`http-smoke.log`、`desktop-electron.log`、`electron-software.log`、`electron-download.log`。临时副本无 `.git`，Vite 会显示 git 元数据告警但服务可用。

## 第一阶段审查修复复测

使用上述现成 ext4 安装副本，仅同步必要文件，未重新安装依赖。先运行旧 Linux desktop + updateChannels 测试，复现 13 项通过、1 项失败（仍断言 `folia-major.desktop`）；修正 Pioneer 断言和模板路径后，14 项全部通过，身份/数据/更新边界测试 3 项全部通过，`git diff --check` 通过。历史 AUR 检查仍验证上游包，未修改 AUR 文件；Linux 便携说明改用 Pioneer 独立启动项。此次没有改动 UI/功能、提交或推送，也没有重新验证 Electron 图形启动。

复测日志（同上述日志目录）：`review-red-linux-update.log`、`review-green-linux-update.log`、`review-green-identity.log`、`review-diff-check.log`、`review-static-check.log`。

## 聚合搜索首个切片（等待规格 / 质量审查）

- 新增“全部在线来源”，只通过 Omni summaries 的 configured 与 capabilities.search 筛选现有来源；不新增平台。来源并发且逐项发布，独立结果、游标、更多、loading、error；失败保留成功项并原游标重试。以 getPlaybackSongKey 去重，保留 sourceRef；来源徽标、进度、独立重试/更多、英文及简中文案接入现有 SearchWorkspace，复用播放/入队回调。已有结果不会被整屏 loading 覆盖。
- 缓存保存来源集合和独立游标。新查询、关闭、恢复、reset、来源集合变更及分页均校验会话；15 秒超时只结束逻辑等待并忽略晚回，不声称中止网络。搜索 controller 在发请求前建立导航历史，完成时不再重复恢复搜索；关闭/新查询后没有旧请求完成导航，原有历史 restore 仍递增会话并取消旧响应。
- 复用既有 ext4 build/node_modules，仅同步必要文件，未安装/升级依赖；本轮使用已存在 Node v26.7.0（符合 >=24）。中断测试实跑先得到 13 通过/1 失败，新导航行为测试先得到 9 失败，接入后通过。最终搜索、播放身份与导航目标测试 12 个文件 / 75 项全部通过，typecheck 退出 0，真实 Chromium StrictMode 组件测试 1 项通过（选择、渐进结果、失败重试、独立更多、播放/入队来源事件）。测试的 Omni 数据为明确模拟，不能代表在线平台登录、音频播放或接口验收。
- 日志绝对目录：`/home/administrator/.hermes/cache/scratch/folia-aggregate/`；`initial.log`、`red-navigation.log`、`green-navigation.log`、`unit-final.log`、`typecheck-final.log`、`browser.log`（首次组件测试因已有译文大小写选择器不匹配失败）、`browser-final.log`（修正选择器后通过）。ext4 无 .git 的 Vite 元数据警告、npm onnxruntime 配置警告未影响验证。
- Electron SIGTRAP 未处理、未重验桌面；本切片不包含酷我、咪咕、B站、列表、下载或同步，不宣称在线平台已验收。未改原三仓、未复制 biu、未 commit/push。

## 聚合搜索规格缺口修复（等待父代理复审）

- 已实证原 controller 等慢来源首屏完成后导航，`useAppNavigation` 恢复搜索导致已开始的更多/重试被取消；真实 hooks 联动测试先得到 2 失败 / 4 通过（exit 1），仅将 controller 导航移到请求之前后 6 项通过（exit 0）。未改 store 会话防护和历史恢复语义。
- 新增 `dev/probes/aggregateSearchController.probe.tsx`、`test/unit/search/aggregateController.test.ts`、`test/component/aggregateSearchController.spec.ts`。覆盖快成功分页 / 快失败重试 pending 后慢首屏结束、关闭恢复后的重试、失败及加载中缓存恢复、关闭/新查询晚回；入队调用真实 controller 并断言真实 playback store 的跨来源同 ID 保留及同来源去重，不用 output 事件替代队列。output 仅暴露真实 store 状态供 Chromium 断言。
- 在现成 ext4 build 中实跑 `npm run test:unit -- test/unit/search test/unit/navigation test/unit/playback`：24 文件 / 137 项通过，exit 0；`npm run typecheck` exit 0；`npm run test:component -- test/component/aggregateSearch.spec.ts test/component/aggregateSearchController.spec.ts --workers=1`：Chromium 3 项通过，exit 0；`git diff --check` exit 0。沿用 Node v26.7.0 与既有依赖，无安装、提交、推送。最初 jsdom 环境受 Node localStorage 影响而未收集用例（exit 1），测试内补隔离内存 storage 后才取得上述行为 RED。
- 日志绝对目录 `/home/administrator/.hermes/cache/scratch/folia-aggregate-review/`：`red.log`、`red-behavior.log`、`red-target.log`、`green-target.log`、`regression.log`、`regression-final.log`（加强 pending/cursor 断言后 137 项仍通过，exit 0）、`typecheck.log`、`chromium.log`、`diff-check.log`。远端搜索为明确 Omni mock，持久化/音频边界为 noop；真实验证的是导航/缓存/队列业务链，不代表真实登录、音频播放或在线平台验收。旧 SearchWorkspace probe 仍只验证 UI 回调，新 probe 补业务链验证。现存 npm onnxruntime / ext4 无 .git 告警未阻塞验证；Electron SIGTRAP 未处理，未扩大到酷我/咪咕/B站、列表、下载或同步。

## 命令面板搜索入口竞态修复（等待父代理复审，未宣称最终规格 PASS）

- `searchCommands.ts` 使用真实 `buildSearchCommandContext` → search store；原来等待首屏再导航，历史 restore 会递增会话、取消正在更多/重试，并在关闭或新查询后重新打开旧查询。现仅把导航放到非空 trim 校验后、submitSearch 之前，完成后不导航；保留 source、player returnView、已有搜索历史 replace、返回 boolean 与单源/local/Navidrome 语义。store/navigation/context builder 不改。
- 扩展既有真实 controller probe 和 jsdom 测试，经真实 command.execute、context builder、store、useAppNavigation 验证：请求时历史已建立、trim/source、空输入无导航、完成不重复导航、关闭/编辑新查询/执行新命令后旧查询晚回、快来源更多/重试跨慢首屏，以及单源/local/Navidrome 分支。新增 Chromium 4 项验证相同真实命令业务入口；它们是 probe 按钮调用命令，并非完整 command palette UI 输入/快捷键端到端测试。
- RED：最初 13 项中 6 失败 / 7 通过，exit 1。加强后的最终 16 项回退旧调用顺序再验证，6 失败 / 10 通过，exit 1；恢复修复后 16 项通过，exit 0。首次 GREEN 中“编辑新查询后 requestId 不变”断言不合理：现有 provider reconcile 可继续递增取消会话；移除该分支的计数断言，仍保留历史不变、query 不回退的行为断言，未改 store。
- 复用现成 ext4 build 与依赖，Node v26.7.0，无安装。`npm run test:unit -- test/unit/search test/unit/navigation test/unit/playback test/unit/command-palette`：46 文件 / 379 项通过，exit 0；`npm run typecheck` exit 0；两份 aggregate component specs：Chromium 7 项通过，exit 0。Omni 搜索为明确 mock，local 为空库、Navidrome 为未配置分支，不代表真实远端登录/搜索/音频验收。npm onnxruntime、Node localStorage 与 ext4 无 .git 告警不阻塞。
- 日志及独立 `.exit` 文件：`/home/administrator/.hermes/cache/scratch/folia-command-review/`，包括 `red.log`、`red-final.log`、`green-target.log`（首次 GREEN 1 个断言失败）、`green-target-final.log`、`green-recheck.log`、`regression.log`、`typecheck.log`、`chromium.log`、`diff-check.log`。
- 只读检索全部 src submitSearch/navigation 入口，另发现 `src/library/suites/grid/home/Grid3D.tsx:272-283` 仍 await submitSearch 再 onSearchCommitted，经 `src/components/app/home/buildHomeModel.ts:125-126` 导航。该入口目前单源/local/Navidrome，而非全部在线来源，但存在同类晚回导航风险；本轮按授权不扩大修改。controller 已在请求前导航，无另一直接 await submitSearch→navigateToSearch 命中。
- 保留全部已有改动；原三仓只读，无提交/推送，不处理 Electron SIGTRAP，不引入额外平台、列表、下载或同步。整体规格仍等待父代理复审。

## 首页搜索入口闭合（等待父代理最终规格 / 质量复审）

- `Grid3D.tsx` 唯一生产改动：trim 非空后先调用真实 HomeModel `onSearchCommitted` 建立导航，再 submitSearch；完成后不再导航。保留在线 active provider、本地 / Navidrome source、home returnView、首页布局、样式、焦点与 3D 状态；controller / command 已有修复及 store/history 语义未改。
- 新增 `dev/probes/gridSearchNavigation.probe.tsx`、`test/component/gridSearchNavigation.spec.ts`、`test/component/gridSearchSources.spec.ts`：真实 Home → Grid3D 表单 → buildHomeModel → useAppNavigation → search store；复用现有首页 fake-provider / 本地 / Navidrome 环境，替换远端 Omni 搜索以控制完成顺序，不 mock 业务。覆盖 trim/source/空 query、关闭/编辑/新聚合查询后的旧首页晚回不导航、快来源更多/失败重试跨旧首页及慢聚合首屏完成，以及三类首页来源正常完成不重复导航。首页不是 aggregate 入口，因此通过真实 command 开始下一聚合查询，而非虚构首页 all-online UI。
- RED 实跑观察旧首页完成重开 race、覆盖 next 聚合历史；加强版回退仅 ext4 副本的旧时序再次 RED。GREEN 最终 Chromium 4 specs / 15 项通过，exit 0；搜索/navigation/playback/command 回归 46 文件 / 379 项通过，exit 0；typecheck exit 0。复用既有 ext4 依赖、Node v26.7.0，无安装。首次 probe typecheck 因 navidromeEnabled 未显式传入失败，已修复；来源测试初用错误翻译标签 Local/Navidrome，改为真实 Folder/Navi；gallery window.mount 初始化偶发失败，完整最终轮全部通过，未修改测试基础设施。
- 全 src 文本检索 + ts-code-map references（含同名声明、仅文本命中人工核对）闭合清单：① Grid3D form / search icon 共用 handleSearch → HomeModel 回调；② SearchWorkspace form / source tabs / 整屏 retry → overlays builder → controller；③ search-current/local/navidrome/netease commands 共用 runSearch → context builder。三条业务提交链均导航在 IO 前，无完成导航；App 只透传；store executeSearch / loadMore / aggregate retry 只更新结果、不导航；history restore 不提交 IO。歌词/元数据内部搜索不属于结果页导航入口，未扩大修改。
- 日志及逐项 `.exit`：`/home/administrator/.hermes/cache/scratch/folia-grid-review/`：`red.log`、`red-behavior.log`、`red-final.log`、`red-strengthened.log`、`green.log`、`regression.log`、`typecheck-final.log`、`typecheck-recheck.log`、`chromium.log`、`chromium-final.log`、`sources*.log`、`submit-references.log`、`callback-references.log`、`production-entry-audit.json`、`diff-check.log`。早期失败记录保留；最终日志才是验收依据。
- 原三仓只读、保留已有全部改动，无提交/推送、不复制 biu。远端搜索、持久化/音频仍为测试边界，不代表真实平台登录或音频验收；Electron SIGTRAP 不处理，不扩展其他整合功能。整体规格仍等待父代理复审。

## 混合来源持久化应用列表（等待父代理 spec + quality 审查）

- 先核对中断遗留、AGENTS 与项目相关 skills；保留独立基线和已批准聚合搜索全部改动。具体计划 `docs/plans/app-playlists.md`。新增 types / transactional repository / service / references / JSON / resolver / Zustand store / panel / host，App 只增加 memo 与 overlay 传参。
- 复用 `AppDatabase` 从 0.9 升至 1.0，专用 `app_playlists`；旧 session/cache/local_music/entities/covers 保留。应用列表不存 api_cache，真实 cacheRepository 清缓存不删列表。不改 LocalPlaylist/localPlaylistService，不把在线条目塞进 songIds，不自动迁移旧列表，无同步。
- 持久化 sourceRef 白名单、显示快照、localRef 与无凭证 Navidrome server/songId；不保存 stream/audio/cover URL、Cookie、密码、Blob 或完整 provider 响应。Stage 明确拒绝。同源去重、不同 provider 同 ID 保留；Navidrome 额外区分服务器。CRUD、事务歌曲增删及精确排列、并发添加、重开恢复；写失败 reject 并在界面显示，未提交数据不乐观生效。
- Folia 主题色面板从应用固定入口打开，明确“应用列表”与平台歌单区分；当前歌、搜索结果及混合队列可加入。整列表通过既有 playSong / UnifiedSong 队列，未新增播放器；本地及 Navidrome 用现有 adapters、当前库/配置重建。缺失本地、服务器不匹配或远端失效均提示且保留引用，解析不会删除记录。版本 1 JSON 以文本框导入导出引用，严格验证未知字段/身份/大小/结构；导入创建新 ID，不覆盖原列表。异机须自行重新导入/关联本地库及配置 Navidrome，无自动重关联 UI。
- TDD 实跑 RED→GREEN：持久化缺模块、来源与 Stage、CRUD 排列、JSON、store、非法来源；初次 Stage 拒绝为同步 throw，与 Promise 合同不一致，改 async 后 GREEN。升级/缓存/写失败额外测试直接 GREEN。最终单测 56 文件 / 420 项通过，typecheck exit 0；其中列表 4 文件 / 13 项。迁移旧测试原断言 schema 0.9 导致两失败，更新为实际 1.0 后旧数据断言仍通过。
- 真实 Chromium 5 specs / 18 项通过，exit 0（列表新增 3 项，既有搜索 15 项）：真实 Host→Panel→store→service→Dexie，创建/添加/改名/排序/删除/JSON/页面重载，失效引用保留、IDB write quota 失败提示，以及在线/本地/Navidrome 起始整混合 UnifiedSong 队列顺序。Omni 音频/歌词、Navidrome getSong、local/Navidrome 实际音频播放回调是明确 mock；真实 queue controller 未 mock。probe 关闭自动最佳歌词，避免测试触及无关远端；不证明真实登录、文件可读性或音频播放。应用整体 UI/Electron 没有验收。
- 全部复用现成 ext4 build/node_modules 和 Node v26.7.0，无安装/升级/commit/push、未写原三仓、不复制 biu、不扩大 B站/下载/同步/Electron。`git diff --check` exit 0。npm onnxruntime / Node localStorage / 无 .git 警告保留；一轮 Chromium gallery `window.mount` 初始化竞态 3 项失败，原样完整重跑 18 项通过，未改公共测试基础设施。
- 日志与逐项 `.exit`：`/home/administrator/.hermes/cache/scratch/folia-app-playlists/`；`red-persistence.log`、`green-persistence.log`、`red-reference.log`、`green-reference-final.log`、`red-crud.log`、`green-crud.log`、`green-durability.log`、`red-json.log`、`green-json.log`、`red-resolve.log`、`green-resolve.log`、`red-store.log`、`green-store.log`、`red-validation.log`；最终验收 `unit-acceptance.log`（420 passed）、`typecheck-acceptance.log`、`browser-recheck.log`（18 passed）、`diff-check.log`。早期失败日志仍保留。Electron SIGTRAP 未解决，不能宣称桌面可用。

## 应用列表三项规格缺口修复（等待父代理 spec 复审）

- 按实际 normalizers 核对：网易/酷狗仅 cloud variant；酷狗 hash 与数字 catalog/file 标识、QQ mid/songId 白名单，URL、token=、对象及非法 variant 拒绝。持久化只投影白名单；JSON 未知扩展因规范重建不一致而拒绝。补真实 parser 恶意 variant/hash/url/token 与合法 cloud/hash/mid roundtrip。
- Navidrome 创建边界 toNavidromeSong 写入不含凭证的服务器来源；buildUnifiedNavidromeSong 保留。Panel 不再把当前配置当歌曲归属；当前歌、队列、搜索统一按歌曲来源保存；旧歌来源未知拒绝，A 切 B 保存/JSON恢复仍绑定 A，B 下不调用同 ID getSong。认证不改，列表持久化仍只用 navidromeRef。
- 显式播放时经 Omni provider availability/capability/detail/song availability 判断：离线或明确 unavailable 提示跳过；null detail、网络/权限失败、unknown 分开提示，引用全部保留。unknown 在线歌允许现有播放器尝试，不承诺成功；不额外解析音频 URL、不在 render 执行 IO，不进行后台批量预检。空详情不能证明删除；只有 provider 明确不可播才按失效处理。
- 三个切片分别真实 RED exit 1 → GREEN exit 0；日志 red/green-security、red/green-server、red/green-availability。完整沿用原 420 回归范围，最终 57 文件 / 424 项通过（新增安全测试 4 项），typecheck exit 0。Chromium 包括新服务器切换、离线/明确不可播/临时未知及原列表/聚合场景；旧 gallery window.mount 初始化竞态仍偶发，未改基础设施，保留失败日志，最后显式 --retries=1 的完整轮 20 项全部首试通过、exit 0（无 flaky），不掩盖此前初始化失败。
- 复用既有 ext4 build/node_modules、Node v26.7.0，仅同步必要文件；未安装升级、提交推送或写原三仓。日志及 .exit 在 /home/administrator/.hermes/cache/scratch/folia-list-review/：unit-acceptance、typecheck-acceptance、chromium-retry 等；远端详情/availability/音频仍明确 mock，真实链为 Host/Panel/store/Dexie/queue，不证明平台登录或真实音频。Electron SIGTRAP 未处理，Stage 拒绝、无同步边界不变。

## QQ 列表 normalizer 契约回退最小修复（等待父代理复审）

- 唯一生产修改为 `src/services/appPlaylists/references.ts`：QQ normalizer 合法 `mediaMid: ''` 在持久化投影中省略；非数字 `songId` 仅在符合 opaque 白名单且同时等于 `mediaId` 与 `songMid` 时接受，即真实 mid-only 回退。不放宽任意字符串、URL、token 或对象；原 variant/hash 安全拒绝与严格 JSON canonical 边界不变。Navidrome 归属、availability、provider/lyric 实现均未修改。
- 新增 `test/unit/playlists/appPlaylistQqContract.test.ts`，使用真实 `normalizeQqSong` 返回，而非手造 UnifiedSong：numeric 缺 mediaMid 先 RED（1 失败、exit 1）→ GREEN；mid-only 再 RED（1 失败 / 1 通过、exit 1）→ GREEN。最终目标 7 项通过，覆盖完整正常、混合 provider 四条队列 JSON 往返、恶意 QQ 字段与不匹配字符串拒绝；原安全测试保留 variant/hash/URL/token 拒绝。
- 实跑真实 QQ playback adapter 与真实 lyric pipeline，比较存储 JSON 前后请求：缺 mediaMid 仍不传 mediaId，完整歌曲保留 mediaId；numeric 歌词 songID 保持数字。mid-only 原歌词管线 `Number(mid)` 经 JSON 成为 null、缺歌词返回 null，往返保持同样降级，并非承诺 mid-only 可取得歌词。只有 QQ transport / fetch 网络响应被明确 mock，无真实平台登录或音频验收。
- 复用既有 ext4 build/node_modules、Node v26.7.0，无安装。列表、QQ adapter/歌词、search/navigation/playback/command、数据库迁移/cache 回归 **59 文件 / 498 项通过，exit 0**；typecheck、git diff --check exit 0。必要列表 Chromium：首次 3 通过 / 2 个 gallery `window.mount` 初始化失败，exit 1；显式 `--retries=1` 重跑 **4 passed + 1 flaky（重试通过），exit 0**，不宣称全部首试通过，未改公共测试设施。
- 日志与逐项 `.exit`：`/home/administrator/.hermes/cache/scratch/folia-qq-contract/`：`red-numeric`、`green-numeric`、`red-mid`、`green-target`、`regression`、`typecheck`、`chromium`、`chromium-final`、`diff-check`；`synced.json` 记录同步的现有改动文件。保留全部原改动，未写原三仓、无 commit/push，不扩大整合范围。npm onnxruntime / Node localStorage / ext4 无 .git 告警保留；Electron SIGTRAP 仍未处理。

## 应用列表三项异步质量修复恢复验证（等待父代理独立 spec / quality 复审）

- 恢复后先实跑当前实现，未为已存在修复伪造本轮 RED。核对保留 store revision：旧 load 晚回不能隐藏 create 或复活 delete；resolver 单请求 5 秒、整操作 15 秒逻辑等待预算，超时归 unknown、保留引用、继续解析后续 local，finally 清理计时器，不声称取消 transport；Panel generation 在关闭/卸载/列表或配置变化时失效，并校验当前持久化配置，旧 A 不得覆盖重开播放 B。QQ 空 mediaMid 省略、mid-only 三字段一致白名单，Navidrome A/B 归属及持久化安全边界均保留。
- 本轮唯一测试修正为 `test/unit/playlists/appPlaylistResolve.test.ts` 的 local fixture：首次 typecheck 实报 TS2352、exit 1，补真实 LocalSong importedMetadata.title/titleSource 并改为显式类型后 exit 0；没有改生产实现、公共 gallery 基础设施或 API。修改前备份在 `/home/administrator/.hermes/cache/scratch/folia-list-quality/resume-backup/`。
- 发现并实用已有 Node **v24.21.0**（默认 v22 不兼容），复用原 ext4 build/node_modules，无安装升级。恢复首跑列表 **6 文件 / 28 项通过，exit 0**；修正 fixture 后列表 + QQ provider/歌词 + search/navigation/playback/command + 数据库迁移/cache 最终 **59 文件 / 502 项通过，exit 0**；typecheck 最终 exit 0。
- Chromium appPlaylists **8 项**覆盖关闭重开 A 晚回、仅配置变化时恢复控件、超时 unknown 后本地播放、A/B 归属、安全/CRUD/IDB/混合队列。首轮 **6 passed / 2 gallery window.mount 初始化失败，exit 1**；显式 `--retries=1` 完整重跑 **7 passed + 1 flaky（gallery 初始化失败后重试通过），exit 0**，三项异步场景均在该轮首试通过。未将 mount 失败说成行为失败，也不宣称全轮首试通过。
- 本轮日志及同名 `.exit` 绝对目录 `/home/administrator/.hermes/cache/scratch/folia-list-quality/`：`resume-target.log`、`resume-regression.log`、`resume-regression-final.log`、`resume-typecheck.log`、`resume-typecheck-final.log`、`resume-chromium.log`、`resume-chromium-retry.log`、`resume-diff-check.log`；`resume-synced.json` 记录当前项目文件同步清单。旧 red/green 日志仅作历史证据，不计本轮结果。
- 真实业务链为 Host/Panel/store/service/resolver/Dexie/queue；远端详情、音频及本地播放 IO 为明确 mock，不代表真实平台登录/播放。Navidrome getSong 既有吞异常→null 仍可能归 unavailable，不能证明远端歌曲删除；本轮未扩大 API 重构。gallery 初始化 flaky、npm onnxruntime / ext4 无 .git 告警保留；Electron SIGTRAP 未处理、未验收桌面。仅写 Folia-pioneer，保留所有已有改动，无打包、commit/push，不扩展 B站/下载/同步；不宣称最终审查通过。

## 同 ID entries 变化取消 pending 播放（本轮，等待独立 spec 复审）

- 唯一生产修改 `src/components/app/playlists/AppPlaylistPanel.tsx`：以有序 entries 的 JSON 内容标识观察 resolver 实际输入（含 sourceRef/localRef/navidromeRef/snapshot），不以列表对象引用、name、updatedAt 判断。layout 生命周期同步订阅真实 store 提交并递增 generation、恢复控件；onPlay 前再读取当前 store 同 ID entries 校验，覆盖 React render 前窗口。不新增 hash 依赖，不取消 transport；同 ID 改名、等价刷新不取消 pending。
- 扩展 `dev/probes/appPlaylists.probe.tsx` 与 `test/component/appPlaylists.spec.ts`：通过真实 store.run → service → Dexie 外部修改 A 同 ID entries；分别在修改渲染后释放旧 lookup、以及 store 操作完成同微任务立即释放，断言旧 onPlay 调用数为 0、原真实队列未覆写、控件恢复、随后新 local 内容播放正确。另测真实 rename/load 等价刷新保留 pending 并成功播放。真实 Host/Panel/store/service/resolver/controller 未 mock；仅 remote metadata/availability/audio/local/Navidrome 播放 IO 为显式 mock，onPlay 计数 wrapper 委托真实 controller。
- 确切行为 RED：`red.log` 中外部替换场景旧 onPlay 实际调用 1（期望 0），exit 1；该轮另有 gallery window.mount 初始化失败。单独重跑立即释放场景 `red-immediate-behavior.log` 同样调用 1、exit 1，非初始化失败。`red-immediate.log` 是错误 grep 导致无测试，不计 RED。最小修复后 `green-target.log` 两项通过、exit 0；增强“释放前控件恢复”断言及新增改名/刷新后，最终 `chromium.log` **11 项全首试通过、exit 0、无 flaky**，保留旧关闭重开 B / server / timeout / 安全归属 / CRUD 场景，未修改公共 gallery 基础设施。
- 本轮实跑目标单测 `unit-target.log` **6 文件 / 28 项通过，exit 0**；相关回归 `regression-final.log` **59 文件 / 502 项通过，exit 0**（列表、QQ provider/歌词、search/navigation/playback/command、迁移/cache）；`typecheck.log` exit 0。使用已有 Node **v26.7.0**（>=24），复用现成 ext4 build/node_modules，仅同步三个实现/测试文件，无安装升级、打包、commit/push，原三仓只读。改前四文件备份在本轮日志目录 `backup/`。
- 日志及同名 `.exit`：`/home/administrator/.hermes/cache/scratch/folia-entries-review/`；另 `diff-check.log` 记录 git diff --check。历史结果不计本轮。JSON 内容比较成本随列表条目数增长（store 通知时比较当前列表），持久化内容已白名单投影；没有播放 IO/后台预检。gallery 既有初始化竞态、ext4 无 .git/npm 告警保留；Navidrome getSong 吞异常→null 与 Electron SIGTRAP 未扩大处理，真实平台登录/音频及桌面仍未验收。本轮等待父代理独立 spec，再 quality，不宣称审查批准。

## 应用列表异步修复最终审查结论

- 上述“等待复审”描述保留为阶段历史；当前限定范围已完成独立规格复审 **PASS** 与独立代码质量复审 **APPROVED**。闭合旧 load 覆盖 CRUD、解析挂起无界等待、关闭/卸载/列表及服务器变化后的旧播放晚回；包括同 ID entries 已提交但 React 尚未 render 的窗口。此结论只覆盖应用列表及本轮异步修复，不代表全部跨项目整合完成。
- 父代理已核对 `/home/administrator/.hermes/cache/scratch/folia-entries-review/` 实跑日志：相关回归 59 文件 / 502 项通过，最终 Chromium 11 项全首试通过，typecheck 与 git diff --check exit 0。独立质量审查另报告复跑列表/迁移 7 文件 / 30 项通过、Chromium 同 ID/归属 4 项通过；这些额外指标来自审查报告，不与父代理核对的主回归混算。
- 规格审查转录：`/home/administrator/.hermes/cache/delegation/live/deleg_25b8326b/task-0.log`；质量审查转录：`/home/administrator/.hermes/cache/delegation/live/deleg_e6b0c119/task-0.log`。业务组件/store/service/Dexie/queue 已验证，远端与音频 IO 为明确 mock；真实平台登录、音频和完整桌面仍未验收。Navidrome getSong 吞异常→null、gallery 既有初始化竞态及 Electron SIGTRAP 仍为已记录风险。本轮无安装升级、打包、commit/push，未修改原三仓。

## LX 自定义音源首切片（等待独立 spec / quality）

- 实现主进程本地 .js 导入、摘要存储、域名授权、启停/删除；独立非持久 sandbox=true、nodeIntegration=false runtime，仅暴露 lx 专用 preload。Folia 主题管理面板和 desktop 命令入口；重启从不自动执行。只接 wy→netease musicUrl，Omni 前置解析，保留歌曲 sourceRef；未启用原路径不变，启用错误不偷偷回退。完整精确兼容范围见 `docs/plans/lx-custom-source.md`，非全 LX utils/search 兼容，不复制 biu/LX 代码。
- TDD init/network RED→GREEN；真实 Omni 回退前置逻辑在 ext4 单独重跑 RED exit1，恢复后通过。相关回归 **54文件/411项通过**；Node契约/真实磁盘管理/redirect/cancel/timeout **5项通过**；typecheck、git diff --check exit0。真实Chromium管理组件 **1项通过**，IPC明确mock，reload通过 fixture 后置addInitScript还原已读存储，不能冒充native picker/main磁盘端到端。真实磁盘由Node测试另证。
- 独立Electron无DISPLAY首次Gtk exit133；发现已有WSLg X0，DISPLAY=:0及XDG_RUNTIME_DIR=/mnt/wslg/runtime-dir后，**无需安装或关闭sandbox**。真实执行揭露bootstrap被全拦、Proxy不能contextBridge clone，已修复。真实sandbox安全8场景完成；自写LX脚本→受控HTTP→自有1秒WAV→独立Electron Audio **ended=true/duration=1/currentTime=1**，exit0。loopback仅测试构造参数override，生产IPC无此开关。不是Folia完整UI/播放器、真实平台登录/可听设备验收，原主应用未重跑。
- 本轮闭合原媒体URL绕过：renderer仅取随机 `folia-lx-media` token，主进程当前runtime持有真实URL；媒体逐次及逐跳复用授权DNS/固定IP网络broker。GET/HEAD/单Range，64MiB累计字节/15秒首响应及消费无进度/20分钟总预算/4活动流有界背压，token20分钟/200上限，停用移除清token+abort，旧token410；no-store且LX音频不写共享provider缓存。已缓冲音频无法回收，非无限stream/HLS，额外媒体header不支持。精确缓存优先级及边界见计划文档；仍待独立spec再quality，非完整桌面安全验收。
- 日志 `/home/administrator/.hermes/cache/scratch/folia-lx/`：`red-init`、`red-network`、`red-omni-behavior`、`node-acceptance`、`regression`、`typecheck-final`、`chromium-green`、`runtime-security-acceptance`、`runtime-playback`、`diff-check`（均.log，早期失败保留）；修改前backup。沿用已有Node v26.7.0/ext4 node_modules，无安装升级、commit/push，仅写Pioneer及scratch。整体等待独立spec再quality，不扩展其他平台/下载/同步。

- 恢复轮最新落盘回归103文件/1000项、Node6项、Chromium管理1项首试、真实sandbox8场景均exit0；真实媒体RED私网命中1→GREEN0，Range56bytes及Audio seeked/ended/duration1、撤权410/pending abort通过。typecheck/diff exit0。日志同目录resume-*.log，resume-backup/保留改前文件；旧指标为历史证据，不代替本轮。

## 尚未实现 / 风险

- 后续音乐源、下载队列、缓存管理等跨项目整合尚未实施；原有在线 API 能力也未逐一实测。尚未实现 Pioneer 更新源、发布流水线及替代的自动代码地图同步；禁用 workflow 不代表这些能力已经实现。
- Windows 安装、卸载、升级隔离，图形渲染、真实登录和播放未验证。
- npm ci 报告 16 个漏洞（8 moderate / 8 high），未擅自升级。npm 11 安装脚本策略提示 5 个包未批准，原生模块可用性需后续检查；Electron 二进制另行下载成功。
- `.npmrc` 的 onnxruntime-node-install 在 npm 11 有未知配置警告；本阶段未更改策略或依赖。

## 许可边界

保留原作者 `chthollyphile`、`AGPL-3.0`、LICENSE、贡献者和第三方声明。派生项目不取得上游商标或官方发行身份；使用 Folia 名称与视觉不应暗示官方认可。分发或提供修改版网络服务须遵守适用 AGPL 源码提供义务；第三方代码、模型、FFmpeg 和资源仍适用各自许可。未复制 biu 或其他项目代码；任何后续跨项目移植须先核对其许可兼容性与归属。
