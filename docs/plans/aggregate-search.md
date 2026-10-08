# Aggregate Search Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 在 Folia-pioneer 搜索工作台增加“全部在线来源”，聚合现有已配置且支持搜索的 provider。

**Architecture:** 在 Omni 上方添加明确的跨来源编排，保存每个 provider 独立游标、结果和错误；搜索 store 管理会话与迟到响应。界面按需调整，但延续 Folia 风格；沿用现有播放/入队链路。

**Tech Stack:** 现有 TypeScript、React、Zustand、Vitest、Playwright。

## Task 1：编排与独立分页
- Create: src/services/onlineMusic/aggregateSearch.ts；必要时 src/types/aggregateSearch.ts。
- Test: test/unit/search/aggregateSearch.test.ts。
- 先写失败测试并实际执行，再实现最小编排；通过 Omni summaries/configured/search 筛选，不硬编码平台。
- 并发请求且逐来源回报结果，成功及时显示；独立 nextOffset/hasMore/loading/error，失败重试原游标。
- 用 getPlaybackSongKey 去重，不丢 sourceRef，不按标题或裸 ID 合并来源。
- 有界超时；逻辑取消忽略晚回，不声称网络已取消。
- 实跑筛选、独立分页、部分失败/重试、超时/晚回和同ID不同来源测试。

## Task 2：搜索状态接入
- Modify: src/stores/useSearchNavigationStore.ts。
- Test: test/unit/search/searchNavigationStore.test.ts。
- SearchSource 新增聚合值；接入 submit/execute/loadMore、resolve/follow/command palette 分支。
- 新查询、关闭、恢复、reset、来源集合变化失效旧会话；分页同样校验会话身份。
- 缓存保留provider集合与各自游标；不能把聚合值误当 provider。
- 先失败测试，再实现，覆盖缓存恢复、关闭晚回、重复加载及原单源/本地/Navidrome回归。

## Task 3：统一风格UI与原播放链路
- Modify: src/components/app/search/SearchWorkspace.tsx；必要时 SearchResultsList.tsx/SearchResultRow.tsx 和 overlays 接线。
- Create if needed: src/components/app/search/SearchProviderStatus.tsx。
- “全部在线来源”选择；独立来源进度/失败重试；有成功结果时不被全屏loading挡住；展示可辨认来源。
- 沿用原点击播放与入队，无新播放器store；布局可按需调整，不照搬LX/Biu。
- i18n沿用现有体系；不显示虚假的未接入来源。
- 测试：复用现有probe和Playwright组件方案，验证来源选择、部分失败、重试、加载更多、播放/入队事件。

## Verification
复用 PIONEER.md 指定已安装 ext4 验证环境，同步变更文件；不重新安装或升级依赖。运行目标单测、typecheck、可行的真实浏览器组件测试；完整日志保存scratch，摘要记录准确结果。UI浏览器验证若阻塞需明确原因；模拟数据仅用于测试，不能声称真实平台已验收。

## Scope
仅聚合现有provider，不新增酷我/咪咕/B站，不实现自定义音源/列表/下载/同步。不修改三个原仓库，不复制Biu代码，不commit/push。完成后规格审查，再质量审查。
