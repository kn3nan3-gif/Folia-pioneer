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

### 当前路线：正在转向，尚未实际切换
- 用户提出考虑回到原 LX 的隐藏 Chromium 窗口 + 专用 preload/LX API 路径，并补脚本审查机制；QuickJS 保留为实验分支。助手建议采用兼容性主线，但**实际代码仍是 QuickJS，尚未创建 QuickJS 分支、切分支或回滚**。
- 下一会话先确认并落实该路线及“审查后明确授权执行”的信任合同，不继续默认钻研 WASI FFI。最新 QuickJS 候选任务已停止。
- 浏览器兼容方案应包含导入不执行、脚本 SHA-256 绑定审批、AST 静态审查、平台/API/域名/危险行为报告、混淆与远端执行默认人工审查、更新内容变化重新审批、运行监测及立即停用。
- 静态规则/AI 审查不能证明任意脚本安全，不能替代网络隔离。若没有可靠 WebRTC 封锁，必须披露浏览器联网旁路风险：该方案是经过审查授权的脚本扩展，不是任意不可信代码沙箱。LX 原窗口未在本项目实测旁路，不得把 Folia 的复现冒作 LX 漏洞确认。
- 尽可能保留独立非持久 session、专用 preload、页面 Node 关闭、权限/导航/弹窗限制、网络 broker、私网/重定向检查、预算和媒体 token。`sandbox=true` 的兼容性应实际验证，不自动照抄 LX 的 `sandbox:false`。

### Git 现场与成果保存
- 项目 GitHub 仓库：`https://github.com/kn3nan3-gif/Folia-pioneer.git`。用户已明确授权同步当前成果；同步前 `git ls-remote` 成功且无 refs。此次同步是带已知阻塞的开发检查点，不是发布批准；不携带第三方音源、scratch产物或凭据。`origin` 指向该仓库，保留 `folia-local` 参考远端。推送结果及精确提交以实际远端回读为准。
- 用户授权同步后，当前成果保存为 `main` 开发检查点 `99b8f7fc`（基于 `e4b1c5c13b8f480d5b5c8b9a887a52c1468f21a4`）。首次推送因鉴权失败；用户重新登录后，`git push -u origin main` 已成功建立远端 main 和跟踪关系。同步包含当前代码、测试、计划及本交接文档，不是发布或验收批准。后续同步必须回读远端SHA与本地HEAD核对。没有创建QuickJS实验分支。
- 已授权的正式直接依赖仍是 `@tootallnate/quickjs-emscripten: 0.23.0`。WASI 及其他候选仅在 scratch，不在正式依赖。
- 迁移前需完整快照/备份，然后再确定本地检查点和分支布局；本节不表示已经建立分支。

### 已实现成果与验收边界
1. **独立基线**：包/产品名称、app ID/userData 隔离，上游更新路径与发布配置禁用；7个上游 workflow 改 `.yml.disabled`，无发布/自动推送。基础测试通过，完整安装/卸载/升级隔离仍未验收。
2. **现有来源聚合检索**：网易、酷狗、QQ、波点及已注册扩展经 Omni 聚合；渐进结果、来源分页/重试/部分失败/超时、缓存与导航代次、队列来源身份。已完成阶段审查，测试远端 IO 为 mock；不等于新增酷我/咪咕/B站或真实接口全部可用。
3. **应用级混合列表**：Dexie 独立表迁移、CRUD/排序、同来源去重与跨来源身份保留、JSON引用导入导出、重启恢复、现有统一播放队列。来源白名单拒绝凭据和临时URL；Navidrome A/B归属、QQ合法normalizer回退保留。旧load覆CRUD、解析挂起、关闭/切服务器/同ID内容更新旧播放晚回均修复；独立 spec PASS、quality APPROVED。阶段回归502项及Chromium11项首试通过仅绑定当时版本。
4. **LX 首切片公共能力**：本地 `.js` 导入、摘要/精确域名授权、单启用/删除、重启不自动执行、Folia管理UI/命令；只接 wy→网易 musicUrl四质量，保留 sourceRef；禁用原路径不变，启用错误不静默回退。不是全LX API，不包含自定义搜索。
5. **网络/媒体**：options白名单、授权/DNS前拒绝非法项；全部公网IPv4验证、固定IP连接、逐跳授权；随机token媒体协议、有界背压流、Range/HEAD、TTL/撤权/取消，LX音频不污染共享provider缓存/automix。畸形redirect宿主异常和manager `.next` 并发写竞争已修复并独立批准。自有180秒MP3/FLAC限速播放/seek曾通过；后续stream源码变动后该证据只算历史，最新版不能冒称长时播放已验收。
6. **QuickJS 正式路径**：Electron utilityProcess + `electron/lx/quickjs-worker.cjs`，无浏览器fallback、不依赖外部Node；guest JSON桥，无RTC/DOM/Node/module loader，CPU/堆/栈/jobs/timer/IPC预算，崩溃inactive/retry。Windows实际生产utility/小asar与owned Audio测试通过过。该首切片曾spec/quality批准，但**新console/初始化补丁仍有未处理Promise拒绝误成功缺陷，不能延用旧批准称最新版完成**。
7. **console补丁**：guest内部冻结、无原型的五个no-op，无host透传/参数coercion/日志IPC。valid inited + loaded门控能处理同步顶层异常，但queued/async/discarded/timer Promise拒绝仍可错误start成功、manager enabled，当前阻塞未修复。

### 核心历史与当前 QuickJS 阻塞（保留供实验分支）
- 早期 Electron browser 脚本环境即使 sandbox开启、domains=[]，owned WebRTC STUN实收本地UDP；权限/CSP/HTTP拦截不足。多次原生浏览器限制尝试失败并撤回，转向QuickJS。
- 原LX使用隐藏BrowserWindow（contextIsolation=true、nodeIntegration=false、sandbox=false）及preload；`webFrame.executeJavaScript`执行脚本，浏览器 `error/unhandledrejection`监听；inited后 onError可直接忽略，与我们更严格的ready合同不同。
- QuickJS0.23无native rejection tracker，executePendingJobs不报告普通拒绝；then包装/eval返回值/延迟ready均漏掉内置或丢弃async Promise。0.32候选也无tracker。
- `quickjs-wasi@3.6.2` scratch候选有原生tracker，但公共jobs API无100-job限额；自有FFI bounded原型能100/150停止、跟踪handled与释放reason，不过独立审查发现factory失败native未销毁、负job ABI/context/exception所有权和实例捕获身份未闭合。
- 最后候选任务已中断；取得精确3.6.2 C源码，发现上游dispose只释放JS引用，不调用native destroy。不得将候选正常路径测试当正式安全批准；未迁移生产。
- 最新基线诊断：四种未处理拒绝仍RED；Node41项及109文件1038项回归通过不覆盖该失败。Node child IPC shim是真引擎诊断，不是Electron utility验收。

### 用户音源与真实测试结果
- 目录 `E:\浏览器下载\V261006`（`/mnt/e/浏览器下载/V261006`）24个 `.js`。全部静态评估；只有2个候选真正执行过，其他22个未执行。原文件未改、未混入分发物。
- `稳定版音源 v1.0.3.js`：初始化四质量通过；只测 standard/128k，`api.injahow.cn` HTTP404，无音频URL，无Audio成功。
- `幻音音源 v3.js`：最初console缺失顶层失败；补丁后初始化通过，但 `music-dl.sayqz.com` DNS ENOTFOUND，无音频URL，无Audio成功。
- 使用公开目录确认的免费样本网易5275429；不绕账号/会员/DRM，不替换第三方接口，不放宽域名/私网安全。初始化兼容、接口可用、可播放三者必须分开汇报。
- 静态兼容缺口还包括resp.body、crypto/buffer/zlib、init音质交集、headers/options、updateAlert/showConfigView等；切回LX路线应按实际契约补齐，不能默认24个均可用。

### 尚未完成与恢复顺序
- 浏览器+审查新路线未实现，QuickJS实验分支未保存；脚本审查UI/AST机制未实现。
- 新平台酷我/咪咕/B站未接入；B站仅匿名API调查（搜索/detail/playurl/音频Range），分P、多平台账户内容整理、统一下载、同步均未实现。
- 恢复先读本文件和 git status，备份全部工作区；确认路线/信任合同并保存QuickJS成果。再做浏览器兼容与审查第一切片，实测两个候选/契约fixtures，独立spec→quality。
- 后续闭合缺失平台及B站搜索/分P/播放→账号收藏夹合集稍后再看历史→统一音频下载（续传/过期刷新/重启恢复）→列表同步（冲突策略/不传凭据；LX移动协议独立验收）。不可因Biu许可删功能。
- 环境重新检查：曾有WSLg和WindowsElectron实测成功，最近Windowscmd/PowerShell/直接exe Invalid argument、Linux显示缺失/SIGTRAP/headlessSIGSEGV，当前不能声称可运行。区分launcher失败与代码失败；不可禁sandbox凑PASS。

### 证据入口、运行习惯与建议skills
- 项目内：`PIONEER.md`、`docs/plans/pioneer-integration.md`、`aggregate-search.md`、`app-playlists.md`、`lx-custom-source.md`（后三项位于同一plans目录）；历史等待审查标题不等当前结论，核对最新章节。
- 既有Linux依赖副本：`/home/administrator/.hermes/cache/scratch/folia-pioneer-baseline/build`，Node要求>=24，曾用26.7.0/24.21.0；默认PATH Node可能22，须现场检查。不得将ext4旧源码测试当当前生产验收，同步并以SHA清单/命令/版本/exit绑定运行前后。
- 详细证据根：`/home/administrator/.hermes/cache/scratch/folia-lx/`：`quality-fix*`及`win-quality-*`（redirect/并发），`console-init-fix/`（console/两源复测），`quality-console-review/`（Promise缺陷），`promise-init-fix/`（生产RED），`native-rejection-candidate/`（WASI实验），`user-source-static-compatibility.json`及`user-source-live-test/`。
- scratch可能被清理，不能把缓存文件视为永久交付；找不到先说明/恢复证据，不编哈希。建议在实际分支保存时将关键结论与适当小fixtures纳入仓内文档，勿提交完整原始日志/第三方音源/敏感URL。
- 会话源：`http://localhost:8787/session/bc95e3b4997a` 为原整合对话；本次对话继续开发。最后候选中断转录 `/home/administrator/.hermes/cache/delegation/live/deleg_153245a4/task-0.log`。
- 建议skills：全局 `subagent-driven-development`、`tdd`、`handoff`；项目 `testing-strategy`、`readme-reference`、`online-song-omni-routing`、`file-modularization`、`settings-feature-integration`。按任务加载，不读PPT无关skills。

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
 
