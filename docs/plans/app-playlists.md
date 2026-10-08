# Mixed-source App Playlists Implementation Plan

> **For Hermes:** Implement task-by-task with TDD; parent performs spec then quality review. Explicit task instructions prohibit commits, pushes, dependency changes and original-repository writes.

**Goal:** A local, persistent application-list slice for mixed online/local/Navidrome references, separate from platform and legacy local playlists.

**Architecture:** Extend AppDatabase from 0.9 to 1.0 with dedicated app_playlists, leaving all historical stores intact. Separate types, reference/JSON validation, transactional repository, service, Zustand store and theme-aware React panel. Reconstruct UnifiedSong only at playback using existing local/Navidrome adapters and current configuration; online playback remains Omni-routed. Route the entire resolved queue to the existing playback controller (no new player).

**Tech Stack:** Existing React, Zustand, Dexie, Vitest/fake-indexeddb, Playwright Chromium, i18next, lucide.

## Scope / invariants
- No online IDs in LocalPlaylist.songIds; do not alter localPlaylistService repair or automatically migrate legacy lists.
- Store only allowlisted sourceRef and display fields, localRef and credential-free Navidrome server association. No stream/audio/cover URLs, Cookie, credentials, Blob, provider response dumping. Stage rejected explicitly.
- Identity uses existing getPlaybackSongKey: same source deduplicates, different providers with same ID survive. Navidrome associations distinguish servers.
- Writes are transactional and errors propagate. Store refreshes only after successful writes; UI reports errors rather than claiming success.
- Missing local/remote references remain in persisted lists and display unavailable/reassociation guidance; resolution never deletes entries.
- Versioned reference-only JSON import creates a fresh list ID; invalid input rejected atomically. Different machines require manual reassociation/reimport of their library/configuration. No synchronization.

## Task 1: tracer bullet — dedicated persistence
Create `src/types/appPlaylist.ts`, `src/services/repositories/appPlaylistRepository.ts`, `test/unit/playlists/appPlaylists.test.ts`; modify `src/services/appDatabase.ts`.
1. Test create/read/reopen on real Dexie with fake IndexedDB; run and record RED.
2. Add schema 1.0 and transactional create/read/delete repository; preserve 0.9 data.
3. Run GREEN. Commands below; no commits.

## Task 2: identities and mutations
Create `src/services/appPlaylists/references.ts`, `src/services/appPlaylistService.ts`.
1. Add one test per cycle for allowlisted snapshots, Stage rejection, online provider identity/localRef/Navidrome reference, CRUD, add/remove and exact-permutation ordering.
2. Implement serialization and service mutations through repository transactions; verify GREEN after each cycle.
3. Test concurrent additions and injected write rejection (old record intact); implement only needed behavior.

## Task 3: import/export and source reconstruction
Create `src/services/appPlaylists/json.ts`, `src/services/appPlaylists/resolve.ts`.
1. RED→GREEN version/schema/size/unsafe-field validation and JSON roundtrip/new-ID import.
2. RED→GREEN real local and Navidrome adapters, online source retention, missing local/changed server/remote lookup failure reporting without deletion.
3. RED→GREEN reopening and legacy 0.9 upgrade plus actual cache clearing proving lists and original local data survive.

## Task 4: store and production UI
Create `src/stores/useAppPlaylistStore.ts`, `src/components/app/playlists/AppPlaylistPanel.tsx` and focused actions/host modules as needed.
1. RED→GREEN store hydration, committed-only updates and surfaced errors.
2. Add theme-aware accessible panel: create/select/rename/delete lists, add current/search-result/save mixed queue, per-track remove/up/down, full resolved queue play, reference JSON import/export.
3. Minimal wiring at app overlay/queue-controller boundary; explicit label distinguishes application lists from platform playlists. Add en/zh-CN keys. No extra player or frozen navigation redesign.

## Task 5: real Chromium business verification
Create `dev/probes/appPlaylists.probe.tsx`, `test/component/appPlaylists.spec.ts`.
- Use shipped panel/store/service/repository/Dexie; actual UnifiedSong queue controller. Only external Omni/Navidrome IO/audio is mocked and documented; do not replace queue business with output events.
- Cover create/add/current/search/mixed queue, rename, reorder/remove/delete, import/export, page reload restore, unavailable retention, whole-list queue identity/order.
- Run focused tests, relevant existing search/navigation/playback/command/cache regression, typecheck and browser specs using existing ext4 dependency tree.

## Execution environment / evidence
Repository: `/mnt/f/experiment/music desktop/Folia-pioneer`; ext4 build: `/home/administrator/.hermes/cache/scratch/folia-pioneer-baseline/build`.
Set PATH to `/home/administrator/.hermes/tools/node-26.7.0-linux-x64/bin:/home/administrator/.hermes/tools/npm-12.0.2-linux-x64/bin:$PATH` (verify live versions). Sync modified/new files with rsync (exclude node_modules/.git); do not install anything.
Logs and companion .exit files: `/home/administrator/.hermes/cache/scratch/folia-app-playlists/`.
Commands in build: `npm run test:unit -- test/unit/playlists`; `npm run test:unit -- test/unit/search test/unit/navigation test/unit/playback test/unit/command-palette test/unit/cache test/unit/playlists`; `npm run typecheck`; `npm run test:component -- test/component/appPlaylists.spec.ts --workers=1` and existing aggregate/navigation component regressions. Repository: `git diff --check`.
Update `PIONEER.md` with actual counts, exit codes, logs, remaining limitations and mock boundaries. Electron SIGTRAP is outside this slice and remains unverified. Wait for parent spec + quality review; never label stubs or unexecuted tests complete.
