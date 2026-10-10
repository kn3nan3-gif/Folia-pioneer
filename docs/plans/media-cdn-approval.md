# 媒体 CDN 明确审批第一切片

范围：独立于 API domains 的 session-only 精确媒体域名授权。API grants 不隐式授予媒体；媒体 grants 不赋予 lx.request 能力。保持摘要/review/risk 门禁。

宿主保留最多4个 pending challenge，随机 opaque ID，绑定当前运行时/摘要/请求/候选 origin；公开状态只含 ID、digest、hostname、origin、截止时间，不含候选临时 URL。URL必须 http/https 默认端口、无 credentials、合法非IP域名。候选未批准时不 DNS/HTTP、不签发token。60秒等待人工批准，普通脚本请求仍15秒；重复 result、重复/旧实例审批拒绝。批准后重新 DNS 公网检查并在连接时 pin；媒体每跳重新授权。未知 redirect 明确停止并撤销该token，显示安全域名停止原因，不自动扩域。

批准/拒绝是主窗口 mainFrame 有预算 IPC，明确 acknowledged；拒绝/timeout 清理挑战并报错，无 fallback；disable/remove/runtime失效撤销所有challenge/grants/token。重启无媒体授权持久化，API存储兼容不变。UI订阅状态，新事件优先旧响应，后台收到挑战打开审批面板；无需额外 command（沿用管理面板）。

TDD owned：先独立host挑战 no-before/approve/deny，逐步补 timeout/revoke/duplicate/strict URLs；再实际runtime与sandbox UI/Audio、DNS pin/redirect/生命周期回归。独立ext4锁依赖恢复，不改原仓锁/依赖，不禁sandbox、不执行第三方、不commit/push。AGENTS由父维护。当前实现待父独立 spec→quality，不称完整验收。

## 实跑证据与边界

- 改前同级备份 `../Folia-pioneer-backups/media-approval-20261010-185545/`；HEAD e966949f92c683493b3bc935f3cfa84e81cf4c81，未提交推送。AGENTS 未改。
- ext4 `~/.hermes/cache/scratch/folia-media-work` 锁定 npm ci --ignore-scripts 恢复 exit0；Electron installer未提供binary，使用缓存精确43.7.5 zip恢复；原仓依赖/锁未变。Node26.7.0/npm11.17.0/Electron43.7.5/Playwright1.63，Xvfb sandbox=true。2616源码文件逐文件SHA一致，scratch media-sync-final.json。
- host tracer RED 缺模块 exit1，GREEN；最终 `node --test test/lx-*.test.cjs` 91 PASS exit0：独立grant、无审批前DNS、deny/timeout/destroy/stale/digest/budget/严格URL、真实HTTP未知redirect停止/撤token及原DNS pin/媒体回归。
- `timeout 45 xvfb-run -a node_modules/electron/dist/electron test/<name>.cjs`：media-approval、browser-rejection、browser-lifecycle、runtime-security、runtime-acceptance、quality、body、request-options acceptance最终全部exit0；owned一秒Audio ended duration=1，不是第三方播放证据。
- native `lx-media-ui-acceptance` 接真实manager/app preload/React Host，只有文件picker替换，deny/approve实际IPC、真实DNS ENOTFOUND、API grants不变、无session字段持久化/reimport停用最终exit0。页面需 `npm run dev -- --host 127.0.0.1 --port 4174 --strictPort`。同步触发HMR期间曾UI失败exit124，静止后exit0，不认定稳定性全绿。初始scratch页面ESM import及locale错误已修，失败不作为产品验收。
- `npm run test:component -- test/component/lxSources.spec.ts --workers=1 --config=media-sandbox.config.ts`（scratch配置chromiumSandbox=true，无no-sandbox）7 PASS exit0；首试mock未更新list状态造成2失败，修probe后通过。组件IPC mock不是完整闭环证明，native harness另给。
- Omni2 PASS、typecheck、diff-check exit0。旧owned acceptance原先IP候选/隐式媒体成功与新合同冲突，显式fixture challenge决定及合法fixture域名适配；重复失败token现在410，保留逐次新token异常回归。没有生产自动授权。
- 未做完整每边界TDD RED、全部生命周期/跨challenge拒绝DNS竞态直接新用例、Windows/第三方/长时播放/全LX验收。审批UI新增文案暂英文，待本地化；主UI仍复用旧事件优先快照机制。后续独立审查应重点核查这两项及并发撤销epoch。禁止据此声称全部 acceptance criteria完成。

## 本轮修复：UI 文案国际化（i18n）

- 范围：`src/components/app/lxSources/LxSourceHost.tsx` 中 6 处硬编码英文（"Media-only grants (this session): "、"Source:"/"Media CDN:"、媒体授权同意书正文、"Approve media domain"/"Deny media domain"）及 `record.mediaFailure` 直接渲染，全部改走 `t('lxSources.*')`；功能字段 challenge.id/hostname/origin/digest 与 record.name/digest 原样保留。
- 新增键（`src/i18n/locales/{en,zh-CN,in}.ts` 的 `lxSources` 命名空间）：mediaGrants、mediaNone、mediaSource、mediaCdn、mediaConsent、mediaApprove、mediaDeny、mediaFailure。三语言均真实翻译（en 英文、zh-CN 中文、in 印尼语）；in 的 lxSources 原先只有 runtimeFailure，本轮新增键已在 in 落地，其余旧键仍走 en 回退。
- 测试同步：`test/component/lxSources.spec.ts` 新增 "media candidate copy renders in Simplified Chinese"（fixture 已 seed en，用例内 `page.addInitScript` 覆盖 i18nextLng/folia_app_language=zh-CN），原英文用例断言全部保留。`test/lx-media-ui-acceptance.cjs` 由 en/zh-CN 二选一扩为 en/zh-CN/in 三语言，并在真实 UI 内断言本地化同意书文案与按钮文本。
- 改前备份：`../Folia-pioneer-backups/media-i18n-20261010-232724/`；HEAD e966949f，未 commit/push，AGENTS.md 未改。

证据（Node v24.21.0，Electron 43.7.5，Xvfb 1280x1024x24，sandbox=true；同步 27 文件到 ext4 `~/.hermes/cache/scratch/folia-media-work`，逐文件 SHA 一致 `media-i18n-20261010-232724/sync-manifest.json`）：

1. i18n RED：把 ext4 的 LxSourceHost+三 locales 回退到改前备份后跑组件 spec → `1 failed 7 passed` exit1，失败点 spec:29 断言中文"本次会话的媒体域名授权"找不到（component-red.log）。
2. i18n GREEN：恢复修复版后组件 spec `8 passed` exit0（component-green2.log）。
3. `node --test test/lx-*.test.cjs` → 91 pass exit0。
4. `timeout 60 xvfb-run ... electron test/lx-media-revocation-acceptance.cjs` → exit0（replayRevoked/invalidDecisions/dnsRace/crossInstance/lifecycle 全绿）。
5. `electron test/lx-media-approval-acceptance.cjs` → exit0（beforeApprovalHits=0、deny、nativeAudio ended+duration=1、revoke）。
6. `electron test/lx-media-ui-acceptance.cjs` × {en, zh-CN, in} → 三者 exit0，输出含 locale 字段且本地化同意书断言通过（ui-en/zh-CN/in.log）；证明 en/zh-CN/in 三语言均在真实 app preload+React UI 中实际呈现。
7. `npm run test:component -- test/component/lxSources.spec.ts --workers=1 --config=media-sandbox.config.ts` → 8 passed exit0（chromiumSandbox=true，未用 no-sandbox）。
8. 回归：lx-body/browser-rejection/browser-lifecycle/runtime-security/quality/request-options acceptance 全 exit0；`lx-redirect-regression.cjs` 实为纯 node 用例（仅 node:http，无 electron app 生命周期），`node test/lx-redirect-regression.cjs` exit0。
9. `tsc --noEmit` exit0；`git diff --check` exit0。

## 独立审查结论（规格复审 + 质量审查）

- 规格复审 PASS：前次唯一阻塞（invalid/stale/expired/deny 仅抛异常不撤 token）确认闭合。审查方自写探针在真实 `MediaApproval`+`MediaBroker` 上复现 replay/crossDigest/malformed/expired/deny 与 DNS 在途、旧实例 payload，逐项断言 `tokens.size===0`、`domains===[]`、`epoch` 递增，并确认公开状态字段仅 digest/expires/hostname/id/origin、无临时 URL 泄漏；合同 13 条逐项核对通过；`npm run test:component` 冷启动偶发 timeout 一次、热跑 8 passed。
- 质量审查 APPROVED：重跑 Node 91 pass、media-approval/revocation/nativeUI(en,zh-CN,in)/body/rejection/lifecycle/security/quality/request-options 与 redirect-regression 全部 exit0，`tsc --noEmit`/`git diff --check` exit0，sandbox 未降；状态机 epoch/pending/domains/token 不变量与 timer 清理判定成立；i18n 无硬编码残留、`in` 走 `fallbackLng:'en'`；旧 acceptance 适配仅注入测试用同步自动批准与合法 fixture 域名，未降低原有断言强度。
- 非阻塞遗留（已记录，未在本切片修）：① `media-approval.cjs:68` 的 `mediaFailure` 为闩锁值，revoke/authorizeStream 均不清除，恢复播放后告警仍显示至运行时结束；② `zh-CN.ts` 的 `mediaFailure`（“媒体播放异常，已停用”）措辞偏重，实际只停止该 token，会话与授权仍在，en/in 表述准确；③ `media.cjs:41` 在任意 fetch 异常（含 5xx/超时）都删除 token，比计划所述“未知 redirect”更宽，属 fail-closed 但对重试鲁棒性有影响，宜加注释。

未完成/失败：
- 曾把 `lx-redirect-regression.cjs` 误用 electron runner 跑，超时 exit124；该文件无 electron 生命周期，改用 node 后 exit0——非产品回归，是本轮 runner 误用。
- vite dev server 在文件同步/HMR 重优化期间会让首个 UI 用例偶发 exit124（en/zh-CN/in 均命中过）；静止重跑后稳定 exit0。属既有记录过的运行环境抖动，不认定稳定性全绿。
- 未单独在组件层跑印尼语用例（仅 Electron 真 UI 断言 in）；未新增生产端 locale 单测；未做完整每边界 TDD RED。
