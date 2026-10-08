// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import probe from '../../../dev/probes/aggregateSearchController.probe';
import { useSearchNavigationStore as search } from '@/stores/useSearchNavigationStore';
import { usePlaybackStore as playback } from '@/stores/usePlaybackStore';
import { omni } from '@/services/onlineMusic/omni';
vi.hoisted(() => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', { value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, String(value)),
        removeItem: (key: string) => values.delete(key), clear: () => values.clear(),
    }, configurable: true });
});
// Mount both real hooks; the probe mocks only remote search and persistence/audio boundaries.
let root: Root;
let host: HTMLDivElement;
const click = async (name: string) => {
    await act(async () => {
        const button = [...host.querySelectorAll('button')].find(b => b.textContent === name)!;
        button.click();
        for (let i = 0; i < 20; i++) await Promise.resolve();
    });
};
beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    host = document.createElement('div'); document.body.append(host);
    root = createRoot(host);
    await act(async () => root.render(React.createElement(probe.Component)));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
describe('command + real search context/store/navigation', () => {
    it('navigates trimmed aggregate query before requests and never again on completion', async () => {
        const push = vi.spyOn(window.history, 'pushState');
        const remote = omni.searchProviderSongs;
        const observed: unknown[] = [];
        vi.spyOn(omni, 'searchProviderSongs').mockImplementation((...args) => {
            observed.push(window.history.state.search);
            return remote(...args);
        });
        await click('Command');
        expect(observed).toEqual([
            { query: 'race', sourceTab: 'all-online', returnView: 'player' },
            { query: 'race', sourceTab: 'all-online', returnView: 'player' },
        ]);
        expect(window.history.state.search).toEqual({ query: 'race', sourceTab: 'all-online', returnView: 'player' });
        expect(search.getState().searchQuery).toBe('race');
        expect(push).toHaveBeenCalledTimes(1);
        const requestId = search.getState().requestId;
        await click('Finish slow');
        expect(push).toHaveBeenCalledTimes(1);
        expect(search.getState().requestId).toBe(requestId);
    });
    it.each([['Local command', 'local'], ['Navidrome command', 'navidrome'], ['Single command', 'netease']])('preserves explicit source and player return semantics: %s', async (command, sourceTab) => {
        await click(command);
        expect(window.history.state.search).toEqual({ query: 'race', sourceTab, returnView: 'player' });
        expect(search.getState()).toMatchObject({ searchQuery: 'race', searchSourceTab: sourceTab, searchReturnView: 'player', isSearchOpen: true, isSearching: false, aggregateSources: {} });
        expect(search.getState().searchResults).toHaveLength(sourceTab === 'netease' ? 1 : 0);
        expect(search.getState().hasMore).toBe(sourceTab === 'netease');
    });
    it('does not navigate for an empty command', async () => {
        const history = window.history.state;
        const requestId = search.getState().requestId;
        await click('Empty command');
        expect(window.history.state).toEqual(history);
        expect(search.getState().requestId).toBe(requestId);
        expect(search.getState().isSearchOpen).toBe(false);
    });
    it.each(['Command', 'Command failure'])('keeps pending more/retry across slow command completion: %s', async command => {
        await click(command);
        expect(search.getState().aggregateSources.netease).toMatchObject({ loading: false, nextOffset: command === 'Command' ? 1 : 0, error: command === 'Command' ? null : 'fast failure' });
        await click('More or retry');
        const requestId = search.getState().requestId;
        await click('Finish slow');
        expect(search.getState().requestId).toBe(requestId);
        expect(search.getState().aggregateSources.netease.loading).toBe(true);
        await click('Finish page');
        expect(search.getState().aggregateSources.netease).toMatchObject({ loading: false, nextOffset: 2, error: null });
        expect(search.getState().searchResults?.map(song => song.name)).toContain('netease-2');
    });
    it.each(['Close', 'New query', 'New command'])('old command completion cannot reopen or replace %s', async action => {
        await click('Command');
        await click(action);
        const history = window.history.state;
        const requestId = search.getState().requestId;
        await click(action === 'New command' ? 'Finish previous' : 'Finish slow');
        expect(window.history.state).toEqual(history);
        if (action !== 'New query') expect(search.getState().requestId).toBe(requestId);
        if (action === 'Close') expect(search.getState().isSearchOpen).toBe(false);
        else expect(search.getState().searchQuery).toBe('new');
    });
});
describe('aggregate controller + app navigation', () => {
    it.each(['Submit', 'Submit failure'])('keeps pending pagination/retry through slow first-page completion: %s', async submit => {
        await click(submit);
        expect(search.getState().aggregateSources.netease.loading).toBe(false);
        expect(search.getState().aggregateSources.netease.nextOffset).toBe(submit === 'Submit' ? 1 : 0);
        expect(search.getState().aggregateSources.netease.error).toBe(submit === 'Submit' ? null : 'fast failure');
        await click('More or retry');
        expect(search.getState().aggregateSources.netease.loading).toBe(true);
        await click('Finish slow');
        expect(window.history.state.search.sourceTab).toBe('all-online');
        expect(search.getState().aggregateSources.netease.loading).toBe(true);
        await click('Finish page');
        expect(search.getState().searchResults?.map(s => s.name)).toContain('netease-2');
        expect(search.getState().aggregateSources.netease).toMatchObject({ loading: false, nextOffset: 2, error: null });
    });
    it('restores failed and loading cache, cancels old pages, permits retry after close', async () => {
        await click('Submit'); await click('More or retry'); await click('Fail page');
        await click('Close'); await click('History restore');
        expect(search.getState().aggregateSources.netease).toMatchObject({ error: 'page failure', nextOffset: 1, loading: false });
        expect(search.getState().aggregateSources.kugou.loading).toBe(false);
        await click('More or retry'); await click('Close'); await click('History restore');
        await click('Finish page'); await click('Finish slow');
        expect(search.getState().searchResults?.map(s => s.name)).toEqual(['netease-1']);
        expect(search.getState().aggregateSources.netease).toMatchObject({ loading: false, nextOffset: 1 });
        await click('More or retry'); await click('Finish page');
        expect(search.getState().searchResults?.map(s => s.name)).toContain('netease-2');
    });
    it.each(['Close', 'New query'])('does not navigate or apply late search after %s', async action => {
        await click('Submit'); await click('More or retry'); await click(action);
        const history = window.history.state;
        await click('Finish slow'); await click('Finish page');
        expect(window.history.state).toEqual(history);
        expect(search.getState().searchResults?.map(s => s.name) ?? []).not.toContain('netease-2');
    });
    it('queues equal numeric IDs from different providers through real controller and deduplicates same source', async () => {
        await click('Queue netease'); await click('Queue kugou'); await click('Queue netease');
        expect(playback.getState().playQueue.map(s => s.sourceRef)).toEqual(expect.arrayContaining([
            { kind: 'online', providerId: 'netease', mediaId: '1' },
            { kind: 'online', providerId: 'kugou', mediaId: '1' },
        ]));
        expect(playback.getState().playQueue).toHaveLength(2);
    });
});
