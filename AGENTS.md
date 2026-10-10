# Project Skills

## Folia-pioneer 持续交接（截至本次对话迁移）

### 维护规则
- 每次实际项目变更（功能、代码、依赖、路线、验收、已知阻塞），结束前同步更新本节：写清改了什么、实跑结果、未验证范围和下一步。失败、暂停及路线调整也要记录；没有结果不得写完成。
- 保留既有用户修改，改前备份；暂停后恢复先核对工作区及中断转录。小步实现、真实运行、独立规格审查后再质量审查；未通过不得宣布验收。
- 本文件保存当前状态，不堆全量日志；详细过程见 PIONEER.md、专项计划及证据目录。新事实应替换过时当前状态，历史只保留关键决策。
- 不自动提交、推送、发布或升级无关依赖。创建分支名不等于保存未提交内容；路线切换前先备份已跟踪和未跟踪文件，明确是否获准本地检查点提交。

### 目标、范围与固定约束
- 主项目：`F:\experiment\music desktop\Folia-pioneer`（WSL `/mnt/f/experiment/music desktop/Folia-pioneer`）。参考仓同级 `folia-major`、`lx-music-desktop`、`biu` 均只读。
- 以 Folia 为主体，加入 LX 的多平台检索、应用级混合列表、自定义音源、统一下载和列表同步；加入 Biu 的 B站视频音频化使用能力。桌面端优先，Web 单独验收。
- Folia 的 React/TypeScript/Zustand/Electron/Vite 技术栈、Omni、唯一播放内核/队列及歌词舞台保留；不搬 LX/Vue 或 Biu 外壳与 store。
- UI 可按功能需要改造页面、导航、布局与交互，但配色、字体、间距、圆角、材质、图标、动效须与 Folia 协调，不是冻结原 UI。
- Biu 的 PolyForm Noncommercial 代码不直接混入 AGPL 分发物；优先独立重写，可以换更优技术路线。尽量保留检索、分P音频、账号、收藏夹、合集、稍后再看、历史及既定下载能力；延期不等于舍弃，永久删减须用户确认。视频下载仍单独决定。
- 保留 Folia 版权/AGPL 与适用第三方声明，LX 本地许可证为 Apache-2.0；复用前核对许可、归属和通知义务。

### 当前路线：浏览器兼容主线，按用户给定顺序分步补齐 LX 兼容
- 用户已确认隐藏 Chromium 窗口 + 专用 preload/MAIN world 执行及“审查后明确授权执行”的信任合同；QuickJS 保留在实验分支，不再作为正式路径。用户指定推进顺序与进度：① 明确兼容问题（console/事件语义/脚本信息/网易字段）已完成 `c0bf251e`；② 双栈 DNS 误伤（全地址安全评估后选已验证公网 IPv4 固定连接，不做完整 IPv6）已完成 `e966949f`；③ 媒体 CDN 明确审批 + 候选源复测 已完成 `eb346c38`（证据 `b906927a`）；④ 按需补请求合同与工具 API（crypto/buffer/zlib、formData、对象 body、headers 白名单、updateAlert）未开始；⑤ 多平台接入与混淆源静态复核未开始。
- 已通过独立审查的切片（每项先规格 PASS 后质量 APPROVED）：浏览器运行时+摘要审批+自动停用 UI 同步 `4f68d27b`；resp.body 与音质交集 `13f32c0e`；标量/UTF-8/回调异常清理测试补强 `45c472ae`；最小旧路线清理+全音源报告 `56ebf149`。命令/版本/exit 与未验证边界见 `docs/plans/browser-script-runtime.md` §9 与 `docs/plans/media-cdn-approval.md`。
- **真实播放里程碑**：在媒体审批流程下，`裤佬SVIP音源(二改整合版) v3.0.0` 与 `非常刀 v5` 均完成导入不执行 + 初始化四质量 + 真实 HTTP 200 + 精确域名明确批准 + token 签发 + sandbox 原生 Audio 真实播放（currentTime=20、duration≈62.7s、readyState=4、seeked）。批准为 harness 代替用户对精确域名执行，非产品自动批准；证据 `docs/evidence/media-approval-retest-20261010.md`。
- **全音源基线（24 源）**：导入 24 通过、静态 blocked 16 未执行、审批启用 8（初始化 7 通过 1 失败）、当时 token 与播放均为 0。报告 `docs/evidence/all-sources-v261006-20261010.md`，独立核对 PASS；双栈归因缺当时 DNS 地址清单、星海语法检查缺单独留档，两处证据缺口已注明。
- 明确边界（不得越过）：静态审查是词法提示，不是 AST/安全证明；WebRTC 旁路仍可达、浏览器不继承 QuickJS CPU/堆/timer 预算、render-process-gone 仅信号注入；Windows、UI 稳定性（cold component run 偶发 timeout 未归因）、长时媒体、其余 22 源、完整 LX API 与多平台均未验收。
- 媒体审批切片非阻塞遗留（已记录未修）：`media-approval.cjs` 的 `mediaFailure` 闩锁在恢复播放后不清除；`zh-CN.ts` 的 `mediaFailure` 措辞偏重（实际只停该 token，会话与授权仍在）；`media.cjs` 在任意 fetch 异常（含 5xx/超时）都会作废该 token，属 fail-closed 但宜加注释说明。
- 安全约束保持：导入不执行、脚本 SHA-256 绑定审批、平台/API/域名/危险行为报告、混淆与远端执行默认人工审查、更新变化重新审批、运行监测与立即停用；独立非持久 session、专用 preload、页面 Node 关闭、权限/导航/弹窗限制、网络 broker、私网/重定向检查、预算与媒体 token 一律保留；`sandbox=true` 实跑验证，不照抄 LX 的 `sandbox=false`。

### Git 现场与成果保存
- 项目 GitHub 仓库：`https://github.com/kn3nan3-gif/Folia-pioneer.git`。`origin` 指向该仓库，保留 `folia-local` 参考远端；同步不携带第三方音源、scratch 产物或凭据；推送后必须回读远端精确 SHA 与本地 HEAD 核对，以实际回读为准。
- 当前 `main` 开发检查点随每次切片推进（最新见文末“最近提交”与专项计划 §9）；已推送并通过远端回读核对。用户已授权通过验证的本地检查点提交及 GitHub 同步，不等于发布或完整验收批准。
- `experiment/quickjs-checkpoint` 分支已推送，SHA `aec7eac310cd6b204a77ea821c4c0d75b6a39bdc`，保留旧 QuickJS 代码与测试；已删除的旧路线文件均可从该提交恢复。历史记载“实验分支尚未推送”为过时信息。
- 备份位于同级 `Folia-pioneer-backups/`：`20261008-160814/`（切换前全量快照+bundle）、`all-sources-20261010-020508/`（24 源清单+全量快照）、以及各切片的 `minimal-cleanup-*`、`lx-body-*`、`lx-dual-stack-*`、`media-approval-*`、`media-i18n-*` 备份。归档成员集合与 bundle 均已验证。
- 正式直接依赖已移除 `@tootallnate/quickjs-emscripten`（旧路径清理切片 `56ebf149`）；lock 中该包仅作为 `pac-proxy-agent` 传递依赖保留。WASI 及其他候选仅在 scratch，不在正式依赖。

### 已实现成果与验收边界
1. **独立基线**：包/产品名称、app ID/userData 隔离，上游更新路径与发布配置禁用；7个上游 workflow 改 `.yml.disabled`，无发布/自动推送。基础测试通过，完整安装/卸载/升级隔离仍未验收。
2. **现有来源聚合检索**：网易、酷狗、QQ、波点及已注册扩展经 Omni 聚合；渐进结果、来源分页/重试/部分失败/超时、缓存与导航代次、队列来源身份。已完成阶段审查，测试远端 IO 为 mock；不等于新增酷我/咪咕/B站或真实接口全部可用。
3. **应用级混合列表**：Dexie 独立表迁移、CRUD/排序、同来源去重与跨来源身份保留、JSON引用导入导出、重启恢复、现有统一播放队列。来源白名单拒绝凭据和临时URL；Navidrome A/B归属、QQ合法normalizer回退保留。旧load覆CRUD、解析挂起、关闭/切服务器/同ID内容更新旧播放晚回均修复；独立 spec PASS、quality APPROVED。阶段回归502项及Chromium11项首试通过仅绑定当时版本。
4. **LX 首切片公共能力**：本地 `.js` 导入、摘要/精确域名授权、单启用/删除、重启不自动执行、Folia管理UI/命令；只接 wy→网易 musicUrl四质量，保留 sourceRef；禁用原路径不变，启用错误不静默回退。不是全LX API，不包含自定义搜索。
5. **网络/媒体**：options白名单、授权/DNS前拒绝非法项；全部公网IPv4验证、固定IP连接、逐跳授权；随机token媒体协议、有界背压流、Range/HEAD、TTL/撤权/取消，LX音频不污染共享provider缓存/automix。畸形redirect宿主异常和manager `.next` 并发写竞争已修复并独立批准。自有180秒MP3/FLAC限速播放/seek曾通过；后续stream源码变动后该证据只算历史，最新版不能冒称长时播放已验收。
6. **QuickJS 实验路径（已归档，不再是主线）**：曾实现 Electron utilityProcess + `electron/lx/quickjs-worker.cjs`，guest JSON桥、无RTC/DOM/Node/module loader、CPU/堆/栈/jobs/timer/IPC预算、崩溃inactive/retry；Windows 生产 utility/小 asar 与 owned Audio 曾通过。该路径存在未修复缺陷（见下条），用户已确认改为浏览器兼容主线；相关 worker 与 6 个专用测试已在清理切片 `56ebf149` 从 `main` 移除，完整代码与测试保留在 `experiment/quickjs-checkpoint`（`aec7eac3`）可恢复。
7. **QuickJS console/初始化缺陷（保留作为实验分支历史证据）**：guest 内部冻结、无原型的五个 no-op，无 host 透传/参数 coercion/日志 IPC。valid inited + loaded 门控能处理同步顶层异常，但 queued/async/discarded/timer Promise 拒绝仍可错误 start 成功、manager enabled。不得据此认为主线实现继承该缺陷，也不得把旧路线称为“正式路径”。

### 核心历史与当前 QuickJS 阻塞（保留供实验分支）
- 早期 Electron browser 脚本环境即使 sandbox开启、domains=[]，owned WebRTC STUN实收本地UDP；权限/CSP/HTTP拦截不足。多次原生浏览器限制尝试失败并撤回，转向QuickJS。
- 原LX使用隐藏BrowserWindow（contextIsolation=true、nodeIntegration=false、sandbox=false）及preload；`webFrame.executeJavaScript`执行脚本，浏览器 `error/unhandledrejection`监听；inited后 onError可直接忽略，与我们更严格的ready合同不同。
- QuickJS0.23无native rejection tracker，executePendingJobs不报告普通拒绝；then包装/eval返回值/延迟ready均漏掉内置或丢弃async Promise。0.32候选也无tracker。
- `quickjs-wasi@3.6.2` scratch候选有原生tracker，但公共jobs API无100-job限额；自有FFI bounded原型能100/150停止、跟踪handled与释放reason，不过独立审查发现factory失败native未销毁、负job ABI/context/exception所有权和实例捕获身份未闭合。
- 最后候选任务已中断；取得精确3.6.2 C源码，发现上游dispose只释放JS引用，不调用native destroy。不得将候选正常路径测试当正式安全批准；未迁移生产。
- 最新基线诊断：四种未处理拒绝仍RED；Node41项及109文件1038项回归通过不覆盖该失败。Node child IPC shim是真引擎诊断，不是Electron utility验收。

### 用户音源与真实测试结果
- 目录 `E:\浏览器下载\V261006`（`/mnt/e/浏览器下载/V261006`）24个 `.js`，逐文件 SHA 已记录（`Folia-pioneer-backups/all-sources-20261010-020508/sources-manifest.json`）。原文件未改、未混入分发物。
- **全量基线（`docs/evidence/all-sources-v261006-20261010.md`，独立核对 PASS）**：导入不执行 24/24 通过；静态审查 blocked 16 个未执行（卡密认证、越权/解密路径、未知动态域名、未完整解混淆等，不能算作初始化失败）；经摘要审批启用 8 个，其中初始化 7 通过、1 失败（`溯音音源_v1` native error/unhandledrejection）。当时媒体 token 与真实播放均为 0。
- **真实播放里程碑（媒体审批流程下，`docs/evidence/media-approval-retest-20261010.md`）**：`裤佬SVIP音源(二改整合版) v3.0.0`（`m701.music.126.net`）与 `非常刀 v5`（先拒绝路径、再批准）均完成导入不执行 + 初始化四质量 + 真实 HTTP 200 + 精确域名明确批准 + token 签发 + sandbox 原生 Audio 真实播放（currentTime=20、duration≈62.7s、readyState=4、seeked）。批准由 harness 代替用户对精确域名执行，非产品自动批准/生产自动授权。
- 仍未取得可用结果的例子：`稳定版音源 v1.0.3.js` 真实 HTTP 404；`幻音音源 v3.js` DNS ENOTFOUND；`gdstudio` 因 `console.group` 缺失（该缺口已在 `c0bf251e` 修复，尚未重测）；`非常刀` 的 `api.chksz.top` 因脚本带 `Referer` 头被拒（headers 白名单限制，未放宽）。
- 使用公开目录确认的免费样本网易5275429，仅 standard/128k；不绕账号/会员/DRM，不替换第三方接口，不放宽域名/私网安全。初始化兼容、接口可用、可播放三者必须分开汇报；harness exit 0 只表示采集完成。

### 尚未完成与恢复顺序
- 按用户给定顺序：④ 请求合同与工具 API（crypto/buffer/zlib、formData、对象 body、headers 白名单、updateAlert/showConfigView 等按实际契约逐项补）未开始；⑤ 多平台接入（酷我/咪咕/B站）与仍需静态复核的混淆源未开始。补完前不得称完整 LX 脚本环境已实现。
- AST 审查仍是目标，当前为明确披露局限的词法审查；不得称 AST 已完成。UI 稳定性（cold component run 偶发 timeout）与历史标题 opacity 失败未归因。
- 混淆源需完成静态解码与人工复核后才能另行授权；卡密/越权/DRM 风险保持 blocked，不通过实现绕过能力来“修兼容”。
- 新平台酷我/咪咕/B站未接入；B站仅匿名API调查（搜索/detail/playurl/音频Range），分P、多平台账户内容整理、统一下载、同步均未实现。
- 后续闭合缺失平台及B站搜索/分P/播放→账号收藏夹合集稍后再看历史→统一音频下载（续传/过期刷新/重启恢复）→列表同步（冲突策略/不传凭据；LX移动协议独立验收）。不可因Biu许可删功能。
- 环境：Linux 侧用 ext4 副本 + 官方 Node/Electron + Xvfb（sandbox 不降）；`npm run test:component` 必须走 npm 脚本或把 `node_modules/.bin` 加入 PATH（直接跑 playwright 会因 `cross-env` 缺失 exit 127）。Windows 桌面运行仍未重新验收，不得声称可运行；区分 launcher 失败与代码失败，不可禁 sandbox 凑 PASS。

### 证据入口、运行习惯与建议skills
- 项目内：`PIONEER.md`、`docs/plans/pioneer-integration.md`、`aggregate-search.md`、`app-playlists.md`、`lx-custom-source.md`（后三项位于同一plans目录）；历史等待审查标题不等当前结论，核对最新章节。
- 既有Linux依赖副本：`/home/administrator/.hermes/cache/scratch/folia-pioneer-baseline/build`，Node要求>=24，曾用26.7.0/24.21.0；默认PATH Node可能22，须现场检查。不得将ext4旧源码测试当当前生产验收，同步并以SHA清单/命令/版本/exit绑定运行前后。
- 详细证据根：`/home/administrator/.hermes/cache/scratch/folia-lx/`：`quality-fix*`及`win-quality-*`（redirect/并发），`console-init-fix/`（console/两源复测），`quality-console-review/`（Promise缺陷），`promise-init-fix/`（生产RED），`native-rejection-candidate/`（WASI实验），`user-source-static-compatibility.json`及`user-source-live-test/`。
- scratch可能被清理，不能把缓存文件视为永久交付；找不到先说明/恢复证据，不编哈希。建议在实际分支保存时将关键结论与适当小fixtures纳入仓内文档，勿提交完整原始日志/第三方音源/敏感URL。
- 会话源：`http://localhost:8787/session/bc95e3b4997a` 为原整合对话；本次对话继续开发。最后候选中断转录 `/home/administrator/.hermes/cache/delegation/live/deleg_153245a4/task-0.log`。
- 建议skills：全局 `subagent-driven-development`、`tdd`、`handoff`；项目 `testing-strategy`、`readme-reference`、`online-song-omni-routing`、`file-modularization`、`settings-feature-integration`。按任务加载，不读PPT无关skills。

### 最近提交（`main`，均已推送并远端回读核对）

- `4f68d27b` 浏览器运行时 + 摘要绑定审批 + 自动停用 UI 同步（首切片）
- `13f32c0e` resp.body 与支持音质交集对齐
- `45c472ae` 正文标量/UTF-8 与回调失败清理测试补强
- `56ebf149` 移除废弃 QuickJS 路径并记录 24 音源审计
- `c0bf251e` console / on 事件语义 / 脚本信息 / 网易字段对齐
- `e966949f` 双栈 DNS 安全选择公网 IPv4 固定连接
- `eb346c38` 媒体 CDN 每会话精确审批（含撤销修复与三语言）
- `b906927a` 记录两音源真实播放证据
- `a59c7a1c` 记录路线进度与播放里程碑（本文件随此提交更新）

---

本文件同时是 Folia-pioneer 的项目入口、持续更新的交接摘要；专项开发规则仍按 skill 组织。用户要求：以后项目发生变动，必须更新本文件中的当前状态、路线、验收与下一步，不能只更新 PIONEER.md 或对话。详见上方“Folia-pioneer 持续交接”。

使用方式：

1. 如果需要的话，先根据任务选择最相关的 skill。
2. 读取对应 `skills/<skill-name>/SKILL.md`。
3. 按 skill 中的触发条件和执行规则完成工作。
4. 如果多个 skill 同时相关，可以组合使用，但只加载当前任务真正需要的内容。
5. 不要主动移除项目中的注释，也不要在没有明确指令的情况下修改、删除或翻译 `@note` 注释。

## 代码定位

按成本从低到高三层：

1. **结构性问题读 `docs/CODEMAP.md`** —— 由编译器和模块图生成（`npm run codemap`），
   Pioneer 已禁用上游 `codemap-sync` workflow，不再自动重生成或提交；地图可能过期，必要时手动核对。
   区域分布、枢纽模块、动态注册点的完整展开、分层边界违规都在里面。
   本地想确认有没有偏差跑 `npm run codemap:check`；PR 不校验它，不必手动同步。
2. **符号级问题默认用 rg** —— 快、灵活，还覆盖 `.md`/`.json`/CSS 这些 LSP 看不到的地方。
3. **rg 拿不准时才用 `dev/mcp/ts-code-map/cli.mjs`** —— 同名消歧、引用完备性、调用链、
   影响面这几类 rg 做不了的问题才升级。它是后备，不是默认。

什么时候该升级，见 `skills/codebase-navigation/SKILL.md` 里的对照表。

同一套能力也能作为 MCP server 挂载（`dev/mcp/ts-code-map/server.mjs`），但默认不加载：
工具 schema 每个会话常驻约 6KB，而绝大多数问题读地图加 rg 就解决了。

skill 只负责地图和编译器都推不出来的东西：口头术语到名字的映射，以及架构约束的意图。

当前项目内 skills：

- `codebase-navigation`
  路径：`skills/codebase-navigation/SKILL.md`
  用于说明代码定位的三层顺序（先读生成的代码地图，再用 rg，rg 拿不准才升级到 ts-code-map cli），以及定位之后改动要遵守的分层与模块边界；同时标注了几个已经不存在、但仍会被搜到的历史命名。

- `testing-strategy`
  路径：`skills/testing-strategy/SKILL.md`
  用于决定当前任务应该看热加载报错、跑单测、跑 UI 截图测试，还是避免误跑构建。

- `readme-reference`
  路径：`skills/readme-reference/SKILL.md`
  用于在修改代码、测试、流程或文档前，先从仓库内 README 中提取仍然有效的项目上下文。

- `glossary-alignment`
  路径：`skills/glossary-alignment/SKILL.md`
  用于把开发者口头说的组件、视图、状态、面板、模式等术语换成可检索的符号名或模块名，再交给 MCP 解析成当前路径。表里只有名字，没有路径。

- `file-modularization`
  路径：`skills/file-modularization/SKILL.md`
  用于在新增或重构前端功能时约束文件长度、入口文件职责和模块拆分，避免继续把大量实现堆进 `App.tsx`、页面根组件或单个大文件。

- `frontend-runtime-guardrails`
  路径：`skills/frontend-runtime-guardrails/SKILL.md`
  用于在新增、重构或审查前端运行时行为时约束高频动画、`useMotionValueEvent`、`requestAnimationFrame`、`ResizeObserver` 和 React state 更新频率，避免 visualizer 等路径引入高 CPU 或时序错位。

- `reuse-project-utilities`
  路径：`skills/reuse-project-utilities/SKILL.md`
  用于在实现、重构或审查时提示优先复用仓库已有公共工具和常用库，例如 pretext 文本测量、visualizer runtime、歌词时序 helper、字体/颜色 helper、i18n、lucide 图标和虚拟列表，避免重复造轮子。

- `settings-feature-integration`
  路径：`skills/settings-feature-integration/SKILL.md`
  用于新增或调整设置项时判断接入位置：视觉相关设置必须进入视觉配置导入导出，功能性设置和可执行动作必须注册到 command palette。

- `kugou-provider-alignment`
  路径：`skills/kugou-provider-alignment/SKILL.md`
  用于开发阶段根据 `docs\ku-go-api-docs.md`、`.env.local` 中的真实 KuGou 服务和 `.dev-credentials\kugou.json` 对齐酷狗 provider 的请求与响应，禁止猜测接口结构。

- `online-song-omni-routing`
  路径：`skills/online-song-omni-routing/SKILL.md`
  用于所有在线歌曲、搜索、播放、歌词、歌单、账户和跨 provider 数据流，确保普通调用经过 Omni，只有 provider adapter/transport 直接接触原始接口。

- `prepare-folia-release`
  路径：`skills/prepare-folia-release/SKILL.md`
  用于进入稳定版本发布流程：汇总上个稳定版本以来的用户可感知变化，更新新功能介绍、桌面与 Docker 版本元数据，并生成可手动粘贴的 Markdown release note。

全局沟通规则：

- 不需要使用skills的时候，不要读取它们。
- 回答用户问题时，直接给出结论，不添加无关的辅助性评价措辞。
- 如果用户指出的是潜在 bug 或不合理设计，需要直接指出问题并给出建议，不回避。
- 如果创建了新的文件，在导入行结束后插入当前文件的注释
- 如果创建了复杂的函数，写出简短的注释，说明函数功能
 
