# V261006 全 24 音源复测（三项修复后）

固定基线 `87a6e1e7f2fdf0fed84b1fda17647fcce196de57`（**用 `git archive 87a6e1e7 | tar -x` 导出干净副本**，未用当前工作区，未用 git worktree）。Node 24.21.0 / Electron 43.7.5 / Chromium 150.0.7871.250，WSL Xvfb，`sandbox=true`（逐次断言）、nodeIntegration=false、contextIsolation=true。样本：公开免费网易 5275429，仅 standard/128k；不绕账号/会员/DRM，不下载。上次基线 `45c472ae` 结论段保持不变，本文件为新增复测。

## 结论

```
{"files":24,"import_passed":24,"static_blocked":16,"enabled_init_passed":7,"init_failed":1,
 "http_or_dns_reached":7,"media_approved":6,"token_issued":5,"audio_attempted":5,"played":5}
```

24 源全部通过真实 `SourceManager.importLocal`（**不执行**）、重启 disabled 断言，原文件 SHA 前后一致。16 源静态审查未批准，**未执行**（区别于初始化失败）。8 审批源中 7 初始化成功、1 初始化失败。有效媒体 token 由上次 0 → **5**，真实 `Audio` 播放成功 **5** 源：gdstudio、收集の聚合接口、统一音乐源、裤佬SVIP、非常刀。

## 方法与边界（安全边界未放宽）

- **review**：pinned 树内 `review.cjs` 派生 `lexical-1`/`browser-webrtc-1` 词法审查 + 非执行人工静态阅读；非 AST/数据流/安全证明。
- **execution**：每文件独立 `SourceManager` 目录，`importLocal` 不执行 → 对 8 个可读清白脚本做 digest/`lexical-1`/`browser-webrtc-1`/acknowledged 审批 → enable → list 回读。仅授予其**静态列出的精确域名**，未新扩。production 20 条上限未改。
- **blocked 处置**：上次无法清白的 16 源（内置卡密/X-Card-Key、QQ 越权/伪造 cookie、DRM/ekey 解密、未知动态域名/未完整解混淆）本次**仍 blocked、未执行**，报告单列，不与“初始化失败”混计。
- **media**：脚本返回候选后走真实 `MediaApproval` 挑战；**harness 仅对返回的那个精确 CDN 域名代用户做一次明确决定（非产品自动批准、非生产自动授权）**。批准后经真实 DNS 公网 IPv4 校验签发 token，由独立 sandbox 原生 `Audio` 播该 token URL（不落盘）。**拒绝路径**在非常刀 v5 上跑通：先 denied → `LX: media approval denied`、token=false、媒体域清零，再 approve 重试成功。
- **limit**：每文件 `timeout 30s`；无重试、无第三方修改。

## 逐文件

见同目录 `all-sources-v261006-retest-20261011.json`；下表为摘要（“审批=approved”均指 harness 代替用户对该精确域名决定）。

| 文件 | 导入 | 静态审查 | 初始化(qualities) | 网络(HTTP/DNS) | 候选域名 | token | Audio |
|---|---|---|---|---|---|---|---|
| HYWmusic_公益版_v1.0.3.js | 通过(不执行) | blocked（裸IP+卡密） | blocked-static-review | — | — | 否 | 未到播放层 |
| HYWmusic_公益版v1.1.0.js | 通过(不执行) | blocked（裸IP+卡密） | blocked-static-review | — | — | 否 | 未到播放层 |
| HelloWorld音源(中秋快乐).js | 通过(不执行) | blocked（裸IP+卡密） | blocked-static-review | — | — | 否 | 未到播放层 |
| gdstudio音乐源 v1.0.1（仅支持网易）.js | 通过(不执行) | approve | passed 128k/320k/flac/flac24bit | gdstudio=200, gdstudio=200, CDN pinned | m701.music.126.net | **是** | **真实播放** played, currentTime=20, duration=211.64, readyState=4, seeked |
| lx-玉宁熙1.2.5.js | 通过(不执行) | blocked（未完整解混淆） | blocked-static-review | — | — | 否 | 未到播放层 |
| stellarwave-v3.2.0.js | 通过(不执行) | blocked（越权/伪造cookie） | blocked-static-review | — | — | 否 | 未到播放层 |
| stellarwave-v4.0.0（酷我稍后支持）.js | 通过(不执行) | blocked（越权/伪造cookie） | blocked-static-review | — | — | 否 | 未到播放层 |
| 全豆要-聚合音源-V4.1（酷狗挂了）.js | 通过(不执行) | blocked（ekey 解密路径） | blocked-static-review | — | — | 否 | 未到播放层 |
| 回避聚合V0.0.1.js | 通过(不执行) | blocked（越权/卡密） | blocked-static-review | — | — | 否 | 未到播放层 |
| 墨澜音乐源v2.3.4.js | 通过(不执行) | blocked（未完整解混淆） | blocked-static-review | — | — | 否 | 未到播放层 |
| 屿溪-终章.js | 通过(不执行) | blocked（未完整解混淆） | blocked-static-review | — | — | 否 | 未到播放层 |
| 幻音音源 v3.js | 通过(不执行) | approve | passed 同四质量 | music-dl.sayqz.com=**denied(ENOTFOUND)** | music-dl.sayqz.com | 否 | 未到播放层 |
| 念心音源 v1.0.2.js | 通过(不执行) | blocked（未完整解混淆） | blocked-static-review | — | — | 否 | 未到播放层 |
| 收集の聚合接口.js | 通过(不执行) | approve | passed 同四质量 | cenguigui=200, CDN pinned | iot102.music.126.net | **是** | **真实播放** played, currentTime=20, duration=62.706667, seeked |
| 星海音乐源V3.2.15.js | 通过(不执行) | blocked（密钥/解密路径） | blocked-static-review | — | — | 否 | 未到播放层 |
| 溯音音源_v1.js | 通过(不执行) | approve | **failed（realm native error/unhandledrejection）** | — | — | 否 | 未到播放层 |
| 稳定版音源 v1.0.3.js | 通过(不执行) | approve | passed 同四质量 | api.injahow.cn=**404** | — | 否 | 未到播放层 |
| 统一音乐源.js | 通过(不执行) | approve | passed 128k/320k/flac | gdstudio=200, CDN pinned | m701.music.126.net | **是** | **真实播放** played, currentTime=20, duration=62.706667, seeked |
| 聚合API接口 (CF) v3.js | 通过(不执行) | blocked（未知动态域名） | blocked-static-review | — | — | 否 | 未到播放层 |
| 裤佬SVIP音源(二改整合版) v3.0.0.js | 通过(不执行) | approve | passed 同四质量 | gdstudio=200, CDN pinned | m801.music.126.net | **是** | **真实播放** played, currentTime=20, duration=62.706667, seeked |
| 西瓜聚合.js | 通过(不执行) | blocked（未完整解混淆） | blocked-static-review | — | — | 否 | 未到播放层 |
| 长青SVIP音源(二改修复版) v1.2.0.js | 通过(不执行) | blocked（未完整解混淆） | blocked-static-review | — | — | 否 | 未到播放层 |
| 长青SVIP音源v1.3.0.protected.js | 通过(不执行) | blocked（未完整解混淆） | blocked-static-review | — | — | 否 | 未到播放层 |
| 非常刀 v5.js | 通过(不执行) | approve | passed 同四质量 | chksz.top 拒(unsupported header), gdstudio/`oiapi.net=200`, CDN pinned | m801.music.126.net | **是** | **真实播放** played, currentTime=20, duration=62.706667, seeked；**含拒绝路径** |

## 与上次基线（45c472ae）的变化点

| 源 | 上次 | 本次 | 归因 |
|---|---|---|---|
| gdstudio音乐源 | init 失败：`console.group is not a function` | init 通过、GDAPI HTTP200、签发 token、**真实播放** | c0bf251e（realm 内 console 补齐 group/groupCollapsed/groupEnd） |
| 统一音乐源.js | DNS 含 IPv6 → 全部音质失败 | GDAPI HTTP200、签发 token、**真实播放** | e966949f（双栈 DNS 安全选公网 IPv4）+ eb346c38 |
| 收集の聚合接口.js | `private or unsupported network address` 拒绝 | cenguigui HTTP200、签发 token、**真实播放** | e966949f + eb346c38 |
| 裤佬SVIP | HTTP200 有候选，域名未授权 → 拒绝 | 媒体审批通过 → 签发 token → **真实播放**（候选 m801） | eb346c38 |
| 非常刀 v5 | HTTP200 有候选，域名未授权 → 拒绝 | 媒体审批通过 → **真实播放**；并跑通拒绝路径 | eb346c38 |
| 幻音音源 v3 | 固定域名 DNS ENOTFOUND | 同（候选域名 music-dl.sayqz.com ENOTFOUND） | 外部域名不可解析，非产品缺陷 |
| 稳定版音源 v1.0.3 | api.injahow.cn HTTP404 | 同（HTTP404） | 外部接口 404 |
| 溯音音源_v1 | init realm native error | 同 | 未修复项（showConfigView 等候选，未独立证实） |
| 16 blocked 源 | blocked 未执行 | blocked 未执行（不变） | 安全边界未放宽 |

净变化：token/播放 **0 → 5**；初始化成功 7→7（但成员变化：gdstudio 由失败转成功，新增其播放链路）；blocked 16→16。

## 阻塞 / 未执行清单

- **静态审查未批准，未执行（16）**：HYWmusic v1.0.3、HYWmusic v1.1.0、HelloWorld、lx-玉宁熙1.2.5、stellarwave v3.2.0、stellarwave v4.0.0、全豆要-V4.1、回避聚合V0.0.1、墨澜v2.3.4、屿溪-终章、念心v1.0.2、星海V3.2.15、聚合API接口(CF)v3、西瓜聚合、长青v1.2.0、长青v1.3.0.protected。原因见 JSON 各 `static_review.note`。**这不是初始化失败。**
- **初始化失败（1）**：溯音音源_v1（realm native error/unhandledrejection）。
- **已审批但未到播放层（3）**：幻音（候选域名 DNS ENOTFOUND）、稳定版（接口 HTTP404）、非常刀的非授权子域 api.chksz.top（unsupported header，脚本自动回退）。

## 命令 / 版本 / exit

- 导出：`git -C "<repo>" archive 87a6e1e7 | tar -x -C <retest>/work`，`node_modules` 软链自 `folia-media-work`（Electron 43.7.5）。
- 运行：`SOURCE_INDEX=<0..23> timeout 30 xvfb-run -a --server-args='-screen 0 1280x1024x24' <retest>/work/node_modules/electron/dist/electron <retest>/run.cjs`。
- 版本：node 24.21.0 / electron 43.7.5 / chrome 150.0.7871.250。24 个子进程 **exit 0**（仅表示 harness 完成，不等于端点长期可用或脚本安全）。每文件实测耗时 10ms–4375ms，**全部 24 源 <5s**，无一次触及 30s 上限。

## 证据 / 脱敏

- scratch：`/home/administrator/.hermes/cache/scratch/all-sources-retest-20261011`（`decisions.json`/`results.jsonl`/`result-*.json`/`run-*.log`，0600）；pinned work 副本同目录 `work/`。
- 仓内本报告与 `all-sources-v261006-retest-20261011.json`：仅留 hostname/IP、HTTP 状态、DNS 错误与挑战公开字段，**无内置 key、脚本全文、完整音频 URL 或 token**。
- 校验：Python 核验 24 唯一文件名、导入不执行、16 blocked 未启用/未播放、8 审批源 disabled/restartDisabled、**24 源原文件运行前后 SHA 一致**、pinned `electron/lx/*.cjs` 未被改动。全部 PASS。

## 局限

词法审查非 AST/安全证明；WebRTC 仍可达、不继承资源预算；仅单样本/单质量、短时（约 3s 内到 seeked，gdstudio duration 211.64）；媒体批准系 harness 模拟用户明确批准；仅 WSL/Linux，未覆盖 Windows/完整 LX。1 个文件（gdstudio）首轮在批量中遭遇一次进程提前结束的**环境瞬态**（结果文件停在 token 阶段），**整批重跑后完整**，非产品问题。

## 产品缺陷（最小复现，不自行修）

- 溯音音源_v1 init 期间 realm 原生报错：`importLocal` → `enable`→ `runtime.start()` 抛 `LX realm: LX: native error/unhandledrejection`（duration≈66ms）。候选原因 `showConfigView` 等未实现注册，**未独立证实**。
- 幻音：返回候选域名 `music-dl.sayqz.com` 但 `authorizeUrl` 在该域名 `getaddrinfo ENOTFOUND`；审批已批准仍无法签发 token（外部域名不可解析）。
- 非常刀：子域 `api.chksz.top` 的请求因带 `Referer` 头被 broker 以 `LX: unsupported header` 拒绝；脚本回退其余 API 成功（头白名单未放宽，属预期 fail-closed）。
