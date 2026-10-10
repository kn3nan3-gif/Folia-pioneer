# V261006 媒体 CDN 审批复测（裤佬SVIP / 非常刀）

基线 `eb346c383ce58fef960cb8ddfb5882a49b361e87`。仅两已授权源，未扫/执行其余22源。Node 24.21.0 / Electron 43.7.5 / Chromium 150.0.7871.250，WSL Xvfb，sandbox=true。样本：公开免费网易 5275429，仅 standard/128k；不绕账号/会员/DRM、不下载。两原文件运行前后 SHA 一致；34 个 LX 模块/测试同步 ext4 `folia-media-work` 逐文件 SHA 一致。

方法：真实 `SourceManager` 走 `importLocal`（不执行）→ 派生 review 核对 → digest / `lexical-1` / `browser-webrtc-1` / acknowledged 审批后 `enable`；API 授权沿用上次各自静态精确列表，未新扩。脚本返回候选后由真实 `MediaApproval` 发起挑战；**harness 仅对返回的那个精确 CDN 域名做一次明确决定，是代替用户执行、仅限该域名——非产品自动批准，非生产自动授权。** 批准并经真实 DNS 公网 IPv4 校验后签发 token，由独立 sandbox 原生 `Audio` 播该 token URL（不落盘）。

**裤佬SVIP音源(二改整合版) v3.0.0.js `58e8cb…6d97`**：导入不执行通过；初始化通过，qualities `128k/320k/flac/flac24bit`，realm sandbox=true、nodeIntegration=false、contextIsolation=true；`music-api.gdstudio.xyz` 请求真实 HTTP 200；候选域名 `m701.music.126.net`；审批 approve（仅该域名）；token 签发=是；Audio 真实播放成功，currentTime=20、duration=62.706667s、readyState=4、seeked=true；禁用/重启 disabled 通过。

**非常刀 v5.js `4948…84d7`**：导入不执行通过；初始化通过，同四质量，sandbox=true；`api.chksz.top` 因脚本带 `Referer` 头被拒（`unsupported header`，未放宽头白名单）、`oiapi.net` 真实 HTTP 200；**拒绝路径**：对 `m701.music.126.net` 明确 denied → resolve 拒绝 `LX: media approval denied`、未签发 token、拒绝后媒体域清零；再请求候选仍 `m701.music.126.net` → approve → token 签发=是 → Audio 真实播放成功，currentTime=20、duration=62.706667s、readyState=4、seeked=true；禁用/重启 disabled 通过。

命令/版本/exit：cwd = ext4 `folia-media-work`，`SOURCE_INDEX∈{0,1} timeout 180 xvfb-run -a --server-args='-screen 0 1280x1024x24' ./node_modules/electron/dist/electron <scratch>/run.cjs`，两者 exit 0（仅表示 harness 完成，不等同端点长期可用）。

证据/脱敏：scratch `/home/administrator/.hermes/cache/scratch/media-approval-retest-20261010`（`sync-manifest.json`、`result-{0,1}.json`、`results.jsonl`、`run-{0,1}.log`）；仓内本报告与 `media-approval-retest-20261010.json`，仅留 hostname/IP 与 challenge 公开字段，无内置 key、脚本全文、完整音频 URL 或 token。

局限：词法审查非 AST/安全证明；WebRTC 仍可达、不继承 QuickJS 资源预算；仅两源、单样本/单质量、短时（约 62s）播放，未覆盖 Windows/完整 LX/其余 22 源；媒体批准系 harness 模拟用户明确批准。
