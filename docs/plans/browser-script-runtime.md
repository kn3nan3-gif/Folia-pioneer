# 浏览器脚本兼容路线

## 1. 决策与信任合同

用户已确认切换浏览器兼容主线，QuickJS 留在实验分支。用户授权通过验证的本地检查点提交及 GitHub 同步；不等于发布或完整验收批准。

此路线是审查后明确授权的脚本扩展，不是任意不可信代码沙箱。浏览器 WebRTC 可能绕过 HTTP broker/CSP；必须在用户审批 UI 明确披露。静态/AI 审查不能证明任意脚本安全。

## 2. 成果保存

切换前本地与远端 main 精确 SHA：aec7eac310cd6b204a77ea821c4c0d75b6a39bdc，工作区干净。

QuickJS 保留分支：experiment/quickjs-checkpoint，指向上述提交。

备份：../Folia-pioneer-backups/20261008-160814/；workspace.tar.gz 保存全部 2604 个已跟踪及非忽略未跟踪文件，history.bundle 保存全部 Git refs 可达历史。manifest.json 记录摘要；归档成员集合与 bundle 已验证。忽略文件不在归档中（本次无待保存的未提交文件）；依赖与缓存不作为成果交付。

## 3. 第一切片

1. 隐藏 BrowserWindow、独立非持久 session、专用 preload；sandbox=true、contextIsolation=true、nodeIntegration=false。
2. 脚本在 MAIN world 执行，ready 必须等 preload 启动、脚本加载和有效 inited，并设短 settle 窗口接收原生 error/unhandledrejection；异常 fail closed。销毁和 render-process-gone 关闭运行时。
3. 保留现有 contract/network/media；直接页面网络、权限、导航、弹窗限制；仍披露 WebRTC 风险，不通过关闭 sandbox 获取通过结果。
4. 导入不执行，启用必须明确批准当前 SHA-256、审查版本和风险披露；摘要变更不可复用批准。不能只凭域名授权执行。审批 UI 必须显示实际报告。
5. 静态报告派生自脚本，不信任持久化报告。优先核对可打包 AST 工具；若只有词法审查，须明示局限，不冒称 AST。新增依赖需单独授权，不能借用未打包传递依赖。
6. 保留现有 wy/musicUrl 首切片，不能宣称完整 LX API。两个用户候选后续分别记录初始化、端点可用、实际播放；不得改用户音源或放宽网络授权。

## 4. 实施与验收顺序

测试先失败再实现；第一切片实跑 Electron + Node + UI 最小回归。测试用自有 fixtures，禁提交第三方音源、凭据、完整原始日志及 scratch。ext4 测试副本须同步当前源码并绑定摘要。独立规格审查 PASS 后进行独立质量审查，问题修复后复审。

## 9. 当前证据与未验证范围

已完成旧成果备份、历史 bundle 验证、本地 QuickJS 分支保存及远端 main SHA 回读。第一切片代码已转浏览器 MAIN world + 专用 sandbox preload，启用需当前摘要/词法报告版本/风险版本及明确 acknowledgement；UI展示报告及 WebRTC 旁路风险。未提交/推送，等待独立 spec→quality 审查，不表示验收。

### 9.1 本次真实证据

环境：Node v24.21.0，Electron包与二进制均43.7.5；WSL ext4副本 `/home/administrator/.hermes/cache/scratch/folia-work`，Xvfb；未关闭 sandbox。触及源码和全部 electron/lx 模块同步并逐文件SHA-256比对相同，清单 `/home/administrator/.hermes/cache/scratch/browser-sync.json`。runtime SHA-256 `bdb01599904b1b75852fc6ed489ab62ed4d3090fd6f7ac59a851c7a88e1baadc`，preload `5bcf207c8847ef1854e57a3a08df46890f300bf801e896130c6f6e54c3acbb70`，manager `44a32446121e9a12b772967d91f1913a88ea0be06f7be8aca3736914c418fcaf`。

- RED：新增 `lx-browser-rejection-acceptance.cjs` 对原QuickJS运行，queued/async/discarded/timer四例 Missing expected rejection，exit1；caught等三例通过。改浏览器后最终9例全PASS exit0（含同步fatal、invalid init、caught及正常timer）。
- RED：`node --test test/lx-approval.test.cjs` 未审批仍尝试创建realm，exit1；实现后与manager/persistence/contract/options/media/stream回归共38项PASS exit0。导入无执行、伪造持久报告不采信、摘要变化/旧审查版本/旧风险版本/no-ack拒绝。
- RED：`npm run test:component -- test/component/lxSources.spec.ts --workers=1` 风险文案缺失 exit1；实现后1项PASS exit0，断言实际审批payload。过程中reload后gallery mount尚未注册，补显式等待后通过。
- 最终逐个 `timeout 45 xvfb-run -a ./node_modules/electron/dist/electron test/<name>.cjs`：`lx-browser-rejection-acceptance`、`lx-browser-lifecycle-acceptance`、`lx-runtime-security`、`lx-runtime-acceptance`、`lx-quality-acceptance` 均exit0。实际验证sandbox=true/Node关闭/非持久session、destroyed清理与重启、晚发native fatal使inactive、broker网络及1秒自有WAV播放结束、直接fetch/导航/弹窗拒绝、重定向/并发持久化回归。日志在scratch对应 `<name>.final.log`，不进入分发。
- `npm run test:unit -- test/unit/services/lxOmni.test.ts` 2项PASS；`npm run typecheck` exit0（ext4副本已同步触及前端文件，仅辅助检查，非全仓源码一致性证明）；`git diff --check` exit0。
- 首次全请求拦截误阻断宿主data页面，修为只允许精确realmURL的mainFrame，其他页面请求仍拒绝；首次请求错误泛化导致security回归失败，恢复有界错误透传后通过。DBus/ALSA环境警告不影响上述退出结果。

### 9.3 独立规格缺口修复：运行时停用同步

独立规格审查指出 manager 的 onClosed 仅清空 active，打开的面板仍可能使用旧 enabled；本次增量修复未覆盖或重生成此前第一切片。改前备份及摘要验证：`../Folia-pioneer-backups/ui-runtime-sync-20261008-163832/`。

- manager 通过 `folia-lx:state-changed` 只向当前主窗口推送派生 records；关闭失败原因仅保留内存，最多256字符，不持久化。主动 disable/切换先解绑 runtime 再 destroy，不误报失败；旧 runtime 关闭回调不能停用新实例。原 sender/mainFrame 授权和摘要审批不变。
- preload 的 `onStateChanged` 剥离 native event，返回精确 removeListener cleanup。Host 在挂载期间订阅、卸载清理，无轮询；新状态事件优先于在途旧 IPC 结果，停止后显示停用与原因，重新勾选摘要审批后恢复启用按钮。en/zh-CN/in 新增失败提示。
- TDD RED：`npm run test:component -- test/component/lxSources.spec.ts --workers=1` 对晚发fatal仍显示Enabled，exit1（旧审批用例通过）；`timeout 45 xvfb-run -a ./node_modules/electron/dist/electron test/lx-browser-lifecycle-acceptance.cjs` 无状态通知断言得到undefined，exit1。日志 scratch `ui-sync-component-red.log`、`ui-sync-lifecycle-red.log`。
- GREEN：上述component命令5项PASS exit0（面板持续打开的late fatal/destroyed/renderer gone、在途enable旧结果竞态、原审批）；`node --test test/lx-manager.test.cjs test/lx-approval.test.cjs` 5项PASS exit0（含通知目标/sender拒绝/preload cleanup）；`npm run typecheck`、`git diff --check` exit0。
- Node v24.21.0 / Electron43.7.5，Xvfb未禁sandbox。最终逐个 `timeout 45 xvfb-run -a ./node_modules/electron/dist/electron test/<name>.cjs`：`lx-browser-lifecycle-acceptance`、`lx-browser-rejection-acceptance`、`lx-runtime-security`、`lx-runtime-acceptance`、`lx-quality-acceptance` 全部exit0。生命周期实测destroyed/native late fatal、256字符截断、主动disable/切换不误报与旧实例回调隔离；renderer gone仍为信号注入，不是原生崩溃证明。首次扩展生命周期断言误用mock文案，改为实际有界native原因后实跑通过。
- 当前原仓已跟踪及非忽略未跟踪文件2610个同步到ext4，逐文件SHA-256比对；清单 scratch `ui-runtime-sync.json`，最终日志 `ui-sync-*-final.log`。无新增依赖、第三方音源执行、提交/推送。尚待父任务独立规格复审→质量审查，不称验收；AGENTS由父更新。

### 9.4 Gallery mount 启动竞态修复（待独立复核）

- 改前完整备份 `../Folia-pioneer-backups/gallery-mount-20261008-171233/`，2610文件归档逐成员SHA验证及history.bundle验证通过。仅修改component fixture、LX spec、新增galleryMount spec及本节；AGENTS由父维护，无提交/推送。
- Playwright1.63.0内置mount每次goto后立即调用window.mount；旧reload后等待不保护下一次导航。fixture现在拥有每次导航→等待函数注册→调用的顺序，保留props/exposeFunctions、Locator/update/unmount及导航前storage种子。无sleep、失败重试、node_modules修改或产品变更。
- 自有测试用addInitScript截获真实gallery的mount注册，首次消费者读取后经exposeBinding事件放行；旧fixture必然报`The gallery page does not define window.mount()`（RED exit1，冷启动另一项通过），新fixture两项GREEN exit0。测试覆盖每次重新导航、update不导航、unmount及storage重新播种；最终新增storage断言后`--repeat-each=2`四项PASS exit0。
- ext4副本 `/home/administrator/.hermes/cache/scratch/folia-work`，全部2611源码文件同步SHA验证（scratch `gallery-mount-sync-red.json`），改动文件再次逐文件SHA相同。Node v24.21.0/npm11.19.0/Playwright1.63.0/Chrome150.0.7871.128。原config有既存`--no-sandbox`，本次仅在scratch生成`gallery-sandbox.config.ts`覆盖chromiumSandbox:true及args:['--disable-dev-shm-usage']，未禁sandbox。
- RED/GREEN命令：`npm run test:component -- test/component/galleryMount.spec.ts --workers=1 --config=gallery-sandbox.config.ts`。LX5项加gallery2项以相同命令选两spec且`--trace=on`，7项PASS exit0；最终gallery两项`--repeat-each=2 --trace=on`4项PASS exit0；`npm run typecheck`最终exit0，`git diff --check`exit0。scratch日志`gallery-mount-{red,green,lx-final,final,typecheck-final}.log`。
- 不隐瞒失败：扩展LX/gallery三轮21项得到19通过2超时exit1；两份失败trace显示模块请求`net::ERR_NETWORK_CHANGED`，等待无法让已失败的模块图注册，未用重试掩盖。先前13项LX/gallery/trackTitleNavigator回归11通过，1注册超时、1标题opacity失败；另两项标题小回归1通过1预览opacity失败，均exit1。动画失败未修改产品、尚未归因；整体回归不能声称全绿。限gallery竞态修复待父独立复核，无Windows/第三方音源/产品完整验收。

### 9.5 独立审查与检查点保存

浏览器第一切片及自动停用 UI 同步已获独立规格 PASS、质量 APPROVED。gallery 修复另经独立规格 PASS、质量 APPROVED；2611源码文件与测试副本 SHA 核对一致。同配置仅跑两轮：当前 fixture 的 gallery/LX/标题三个 spec 共13项 PASS exit0；只换回 HEAD 旧 fixture 后12项 PASS、延迟注册测试 FAIL exit1。测试副本已恢复并核对摘要。证据 scratch `gallery-independent-{current,baseline}.log`、`gallery-independent-sha.json`。

历史标题 opacity 失败两轮均未复现，不能认定本次回归或既有故障；历史注册超时存在日志，但原 trace 不在当前产物且网络证据 JSON 为空，无法独立确认 ERR_NETWORK_CHANGED 归因。允许保存带已知边界的开发检查点，不得声称扩展回归稳定性全绿、完整平台或产品验收。父任务按已获授权进行本地提交和 main/QuickJS 保存分支同步，成功与精确 SHA 以远端回读为准。

### 9.6 两个已授权用户音源：当前浏览器路线复测

基线 `4f68d27b5810d7c6c0cbbdec1894d55129bec6df`。仅复测原候选两文件；未扫描/执行其他22源。当前 `electron/lx/*.cjs` 及两套相关acceptance文件共11文件同步ext4、逐文件SHA相同；两原音源执行前后SHA与历史静态报告一致。scratch证据根 `~/.hermes/cache/scratch/folia-lx/browser-two-retest/`：`sync-{before,after}.json`、`static.json`、`results.json`、`exit-final.json`；本计划改前备份 `browser-script-runtime.before.md`。不提交第三方脚本、完整日志或临时音频URL。

静态核对：当前派生词法报告均findings=[]，不是AST/安全证明；与历史可读代码及精确SHA一致，未发现新增风险。稳定源报告列出api.injahow.cn、cyapi.top、kw-api.cenguigui.cn、lxmusic.toside.cn；幻音列出music-dl.sayqz.com、api.xcvts.cn。测试仅分别授予api.injahow.cn和music-dl.sayqz.com，其他域名不授权/不调用。复测继承用户既定两候选授权及已披露WebRTC风险，通过真实manager.importLocal→派生review核对→manager.enable提交当前digest、reviewVersion=lexical-1、riskVersion=browser-webrtc-1、acknowledged=true；未直接构造或手工置active绕门禁。批准payload存scratch；透明网络观测仍调用未改authorizeUrl，公网DNS/IP固定及逐跳授权不变。

- `稳定版音源 v1.0.3.js` SHA256 `5e5f39c1a51b6c005104f382b22cd0a3e0af2ba30c7003e4fd03bfcf9f6a088a`：真实初始化通过，声明128k/320k/flac/flac24bit；仅网易5275429 standard/128k请求。api.injahow.cn公网IPv4授权通过、真实HTTP404，脚本拒绝获取链接；无有效URL/媒体token，不进行Audio。
- `幻音音源 v3.js` SHA256 `4a81129240ecae3ebf6b42f28c73e2d37bbcb6fccac9a73a401d90cdd36bee5f`：真实初始化通过，同四质量；相同样本/质量。返回候选地址进入宿主授权后music-dl.sayqz.com DNS ENOTFOUND，HTTP未发生、未签发媒体token；不进行Audio。
- 两者运行时实测sandbox=true、nodeIntegration=false；导入未执行、manager启用成功回读、禁用及新manager重启disabled已断言。没有新增域名、权限、私网、账号、下载、会员/DRM步骤；没有更换接口或修改脚本。

命令（ext4 folia-work，PATH前置scratch/node24/bin）：`timeout 80 xvfb-run -a --server-args='-screen 0 1280x1024x24' ./node_modules/electron/dist/electron /home/administrator/.hermes/cache/scratch/folia-lx/browser-two-retest/run.cjs`。Node24.21.0/Electron43.7.5，最终exit0仅表示harness完成，不表示音源可播放。首次scratch harness错误用绝对包路径require Electron，app未定义并超时exit124；改为原生require('electron')后运行完成，非产品失败。原音源及同步模块结束后摘要再次相同；git diff --check通过。

当前阻塞仍为外部404/DNS失败，而非已证实浏览器初始化缺口。音频URL有效性/真实播放/长时播放未获证据；不得借此扩域或更改音源凑PASS。下一切片建议由父决定以最小自有fixture覆盖resp.body及质量交集等历史兼容契约；本次不改产品、不加依赖、不更新AGENTS、不commit/push。

### 9.7 resp.body 与 wy 音质交集最小切片（待独立审查）

- 改前备份 `../Folia-pioneer-backups/lx-body-quality-20261008-180609/` 保存触及既有文件及SHA manifest；保留§9.6原修改，AGENTS由父更新。无提交/推送、新依赖、第三方音源执行或扩域。
- 原LX只读语义来源 `../lx-music-desktop/src/main/modules/userApi/renderer/preload.js`：29–35固定音质表，146–155仅type=music且按宿主顺序求交集；213–231把原始响应转UTF8、尝试JSON解析，callback第三参数与response.body相同，错误为(err,null,null)；247–251重复inited拒绝。类型定义 `src/common/types/user_api.d.ts:3–10` 为music/actions/qualitys。没有照搬statusMessage/raw/bytes、formData或新增平台。
- `preload.cjs` 成功回调在realm内组装response.body，复用同一个body值（含对象身份）；失败回调两个null。broker仍只传单份body，未增大网络回复体积或修改固定IP逐跳授权。`contract.cjs` wy四质量按宿主顺序交集去重，忽略未知字符串；空交集拒绝，非字符串/非数组拒绝，明确非music type拒绝。保留首切片既有省略type兼容，不扩为原LX的所有平台或允许空源成功。
- 新 `test/lx-body-acceptance.cjs` 使用owned HTTP JSON/text/HTTP404/断连，测试authorize只准精确owned origin；生产私网策略不变。真实sandbox=true，覆盖混合/全不支持、kw不提升到wy、高音质未声明拒绝及重复init：caught只拒绝该调用且原声明保留；discarded在ready前失败关闭（执行结果拒绝或native监测）。Node合同回归同时拒绝混合合法字符串和非法值。
- TDD：原preload `timeout 45 xvfb-run -a ./node_modules/electron/dist/electron test/lx-body-acceptance.cjs` RED exit1（response.body alias missing）；补丁首GREEN exit0。原contract `node --test test/lx-custom-source.test.cjs` RED exit1，扩展Electron同命令RED exit1（invalid quality）；新contract最终两者GREEN exit0。中间一次断言过窄只期待native原因而实际得到LX:initialization，以及原rejection回归依赖invalid quality前缀，两次exit1均保留日志；修正测试原因范围与保留旧错误前缀后通过，未放松fatal合同。
- Node v24.21.0（指定node24/bin缺失，从既有node24.tar.xz解包至scratch/node24-x）、Electron43.7.5，ext4 folia-work/Xvfb不禁sandbox。全部LX模块及直接LX测试同步SHA清单 scratch `lx-body-sync-{red,final}.json`。最终`node --test`七文件（custom-source/manager/approval/persistence-regression/request-options/media/media-stream）41 PASS exit0；上述body以及browser-rejection/browser-lifecycle/runtime-security/runtime-acceptance/quality-acceptance/request-options-acceptance七套Electron逐个同样timeout/Xvfb命令exit0。scratch日志`lx-body-*-final.log`，RED另见`lx-body-red.log`、`lx-quality-{red,electron-red}.log`；git diff --check exit0。
- 无TS公共类型改动，未跑typecheck/完整构建/UI/Windows/第三方音源或长时Audio。旧queued/async/discarded/timer fatal、审批/manager/网络/媒体最小回归保留通过；独立spec→quality仍由父另派，不能称已验收。

### 9.8 最小契约切片独立审查

resp.body 与 wy 支持音质交集切片已获独立规格 PASS、独立质量 APPROVED，仅限本切片。规格审查真实 Electron body/rejection 均 exit0；质量审查原仓 Node custom-source/request-options 共28项 PASS，Electron body/rejection/security 均 exit0，运行前后相关模块摘要与 ext4 副本一致，sandbox 未关闭。父任务提交前再次原仓运行上述28项测试及 diff-check 均通过。

非阻塞补强：JSON 标量、非 ASCII 正文和回调抛异常尚无新增直接 body 用例；异常 fatal 路径已静态审查。不代表完整 LX、Windows 或长时播放验收。两用户源结果见 §9.6，仍无可用音频 URL。

此前浏览器功能检查点 main=4f68d27b5810d7c6c0cbbdec1894d55129bec6df、QuickJS 保存分支=aec7eac310cd6b204a77ea821c4c0d75b6a39bdc 均已推送并远端回读。AGENTS.md 的推送状态补写曾因保护审批超时未完成，其中“实验分支尚未推送”是过时信息；未绕过保护。当前本切片按用户已授权保存开发检查点，精确提交与同步结果以实际远端回读为准。

### 9.2 待审查与明确边界

没有直接可打包AST parser；不增加依赖。报告是保守文本词法提示，注释/字符串可误报，别名/动态属性/编码/远端代码可漏报，绝非AST/数据流/安全证明。WebRTC仍可达，域名授权仅约束broker而非浏览器全部网络；UI明确披露。MAIN world事件监听不是恶意可信脚本无法篡改的防线，150ms settle窗口仅覆盖初始化常见迟发事件，晚异常会停用，不保证任意未来错误在ready前发生。浏览器资源不继承QuickJS堆/CPU/jobs/timer预算，保留host请求/消息/网络预算与超时，不宣称不可信代码沙箱。

`render-process-gone` 用真实webContents信号注入验证清理，未证明原生崩溃通知在此平台可靠。仅wy/musicUrl首切片；第一切片审查阶段未执行第三方用户音源，随后两候选复测见§9.6，仍没有完整LX API/可用音频端点/长时媒体/Windows/Web验收。QuickJS旧验收用例继续属于实验分支路线，不用于浏览器安全声称。独立规格及质量审查由父任务继续执行；AGENTS.md由父更新。
