# 主线最小废代码 / 旧测试清理（2026-10-10，待独立 spec → quality）

## 范围与恢复

基线 main `45c472ae4e353597bf7f91edd9c26668bb8be4a8`。清理前 `git ls-remote origin` 回读 QuickJS 分支 `experiment/quickjs-checkpoint` 为 `aec7eac310cd6b204a77ea821c4c0d75b6a39bdc`；8个删除文件逐字节匹配该提交的 `git show <sha>:<path>`，可恢复。父任务全仓备份 `../Folia-pioneer-backups/all-sources-20261010-020508/` 未动；额外触及文件备份 `../Folia-pioneer-backups/minimal-cleanup-20261010-022251/`，逐文件副本比对及 SHA manifest 已生成。

删除：

- `electron/lx/quickjs-worker.cjs`
- `test/lx-quickjs-acceptance.cjs`
- `test/lx-quickjs-runtime.test.cjs`
- `test/lx-quickjs-init-acceptance.cjs`
- `test/lx-quickjs-lifecycle-acceptance.cjs`
- `test/lx-quickjs-rejection-acceptance.cjs`
- `test/lx-quickjs-options-acceptance.cjs`
- `test/lx-webrtc-acceptance.cjs`

当前 runtime 是 BrowserWindow 路线，无 utilityWorker/worker 入口。清理前扫描全部 tracked 非文档/JSON 文件，唯一旧 worker 引用在本次删除的 QuickJS runtime 测试；包配置及历史文档的引用已定点处理。旧无 RTC 测试不符合当前“审查后授权 + 披露 WebRTC 旁路”合同，删除不代表旁路已修复。

`package.json` 仅移除 QuickJS 直接依赖和2条专用 asarUnpack；`package-lock.json` 仅根 dependencies 同一声明删除。程序比对证明其余 lock 数据完全等同 HEAD，保留 pac-proxy-agent 的 QuickJS 依赖及包节点；没有 npm 更新、安装或无关升级。当前 package/lock 根 dependencies 和 devDependencies 相等。静态 pack 检查 main 文件存在、`electron/**/*` 保留、无旧 worker 解包项；未构建完整安装包，不声称真实打包验收。

有效 browser/body/rejection/lifecycle/security/quality/options、Node manager/approval/persistence/media/stream、Omni/component/gallery、媒体时长与redirect回归均未改删。`PIONEER.md` / `lx-custom-source.md` 定点标记旧 QuickJS 合同为历史并链接新路线；保留历史证据、版权与 @note。AGENTS 保护文件未修改，交接由父处理。已有 all-sources 证据未改。

## 当前实跑

证据根：`/home/administrator/.hermes/cache/scratch/lx-body-strengthening/minimal-cleanup/`。官方既有 Node v24.21.0 / Electron 43.7.5，ext4 `../work/`，Xvfb，未传 `--no-sandbox`；运行时断言 sandbox=true。同步26文件（全部当前 LX 模块/直接 LX tests + app preload），`sync-before.json` / `sync-after.json` 逐文件 SHA 与原仓一致且运行后不变。

Node 命令：`<scratch>/node-v24.21.0-linux-x64/bin/node --test test/lx-{custom-source,manager,approval,persistence-regression,request-options,media,media-stream}.test.cjs`（实际 argv 展开于 `node-result.json`），7文件41项 PASS，exit0。首次只同步 LX 模块而漏 app preload 得40 PASS / 1 ENOENT；补齐原仓 preload 后完整重跑41 PASS，未改产品/测试，初始失败日志保留。

Electron 每套：`timeout 60 xvfb-run -a --server-args='-screen 0 1280x1024x24' <scratch>/electron/electron test/lx-<suite>.cjs`：

| suite | exit |
| --- | --- |
| body-acceptance | 0 |
| browser-rejection-acceptance | 0 |
| browser-lifecycle-acceptance | 0 |
| runtime-security | 0 |
| runtime-acceptance | 0 |
| quality-acceptance | 0 |
| request-options-acceptance | 0 |

`electron-results.json` 保存完整 argv/exit；各套日志保留真实完成指标。包括body标量/UTF8/回调fatal清理与重启、9种初始化拒绝、生命周期、8项security、1秒owned WAV ended、畸形redirect与并发持久化、24非法options/5合法/cancel。DBus/ALSA警告不改变退出结果。部分既有输出字段 `productionQuickJS` / `isolation` 为历史命名，不构成 QuickJS 或全部浏览器网络隔离证明；真实路径已核对为 BrowserWindow。

Omni/Vitest、component/gallery/Playwright 未重跑：原仓及已知 ext4 副本相应 `.bin/vitest` / `.bin/playwright` 不存在，旧依赖已清理。未全量安装、重建或冒用历史 PASS。Windows、原生renderer crash（当前lifecycle为信号注入）、完整产品、第三方音源和180秒媒体未验收。

静态配置/入口及SHA结果 `static-checks.json`；`git diff --check` exit0。无commit/push；本清理仍待父独立规格审查→质量审查。
