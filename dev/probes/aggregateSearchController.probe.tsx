import React, { useEffect } from 'react';
import { useAppNavigation } from '../../src/hooks/useAppNavigation';
import { usePlaybackQueueController } from '../../src/hooks/usePlaybackQueueController';
import { useSearchNavigationStore as search } from '../../src/stores/useSearchNavigationStore';
import { usePlaybackStore as playback } from '../../src/stores/usePlaybackStore';
import { omni } from '../../src/services/onlineMusic/omni';
import { searchCommands } from '../../src/components/command-palette/commands/searchCommands';
import { buildSearchCommandContext } from '../../src/components/app/command-palette-context/buildSearchCommandContext';
import { resolveCommandPaletteSearchSource } from '../../src/stores/useSearchNavigationStore';
import type { CommandPaletteContext } from '../../src/components/command-palette/types';
import type { ProbeDefinition } from './definition';
import type { UnifiedSong } from '../../src/types';
// Real navigation, search and queue controller; only the remote Omni search is replaced.
const track = (providerId: string, id: number) => ({ id, name: `${providerId}-${id}`, artists: [], album: { id: 1, name: '' }, durationMs: 1000, sourceRef: { kind: 'online', providerId, mediaId: String(id) } }) as UnifiedSong;
const page = (providerId: string, id = 1) => ({ items: [track(providerId, id)], nextOffset: id, hasMore: true });
const ref = <T,>(current: T) => ({ current });
const noop = () => {};
const asyncNoop = async () => {};
let finishSlow = noop;
let finishPrevious = noop;
let finishPage = noop;
let failPage = noop;
let failFast = false;
let slowQuery = '';

function Probe() {
    const navigation = useAppNavigation();
    const state = search();
    const queue = playback(s => s.playQueue);
    const controller = usePlaybackQueueController({
        isNowPlayingStageActive: false, shouldNavigateToPlayerOnTrackChange: false,
        localSongs: [], localLibraryCatalog: {} as any,
        setLyrics: noop, setIsLyricsLoading: noop,
        navigateToPlaybackView: navigation.navigateToPlaybackView, navigateToSearch: navigation.navigateToSearch,
        persistLastPlaybackCache: asyncNoop, restoreCachedThemeForSong: asyncNoop,
        interruptStagePlaybackForMainTransition: noop, onPlayLocalSong: asyncNoop,
        onPlayNavidromeSong: asyncNoop, onAddLocalSongToQueue: noop, onAddNavidromeSongsToQueue: noop,
        searchDeps: { submitSearch: search.getState().submitSearch, loadMoreSearchResults: search.getState().loadMoreSearchResults },
        audioRef: ref(null), blobUrlRef: ref(null), shouldAutoPlayRef: ref(false), currentSongRef: ref(null),
        mainPlaybackSnapshotRef: ref(null), playbackAutoSkipCountRef: ref(0), pendingResumeTimeRef: ref(null),
        currentOnlineAudioUrlFetchedAtRef: ref(null), lastAudioRecoverySourceRef: ref(null),
    });
    useEffect(() => {
        const originals = { summaries: omni.getProviderSummaries, capabilities: omni.getProviderCapabilities, search: omni.searchProviderSongs };
        failFast = false;
        let fastCalls = 0;
        omni.getProviderSummaries = () => ['netease', 'kugou'].map(providerId => ({ providerId, availability: { configured: true } })) as any;
        omni.getProviderCapabilities = () => ({ search: true }) as any;
        omni.searchProviderSongs = (providerId, query, options) => {
            if (providerId === 'kugou') {
                slowQuery = query;
                return new Promise(resolve => { finishSlow = () => resolve(page(providerId) as any); });
            }
            if (fastCalls++ === 0 && !failFast) return Promise.resolve(page(providerId) as any);
            if (failFast) { failFast = false; return Promise.reject(new Error('fast failure')); }
            return new Promise((resolve, reject) => {
                finishPage = () => resolve(page(providerId, 2) as any);
                failPage = () => reject(new Error('page failure'));
            });
        };
        search.getState().resetRuntime('all-online');
        search.getState().setSearchQuery('race');
        playback.setState({ playQueue: [], currentSong: null, activePlaybackContext: 'main', isFmMode: false });
        return () => {
            omni.getProviderSummaries = originals.summaries;
            omni.getProviderCapabilities = originals.capabilities;
            omni.searchProviderSongs = originals.search;
            search.getState().resetRuntime();
            playback.setState({ playQueue: [], currentSong: null });
        };
    }, []);
    // Exercise the shipped command and context builder, not a mocked search executor.
    const runCommand = (query = '  race  ', commandId = 'search-current') => searchCommands.find(command => command.id === commandId)!.execute(query, {
        shared: { t: (_key: string, fallback?: string) => fallback ?? _key },
        search: buildSearchCommandContext({
            currentSearchSourceTab: resolveCommandPaletteSearchSource(null, state.searchSourceTab, 'netease'),
            localSongs: [], localLibraryCatalog: {} as any, navigateToSearch: navigation.navigateToSearch,
        }),
    } as CommandPaletteContext);
    return <>
        <button onClick={() => { void runCommand(); }}>Command</button>
        <button onClick={() => { failFast = true; void runCommand(); }}>Command failure</button>
        <button onClick={() => { finishPrevious = finishSlow; void runCommand('new'); }}>New command</button>
        <button onClick={() => finishPrevious()}>Finish previous</button>
        <button onClick={() => { void runCommand('   '); }}>Empty command</button>
        <button onClick={() => { void runCommand('  race  ', 'search-local'); }}>Local command</button>
        <button onClick={() => { void runCommand('  race  ', 'search-navidrome'); }}>Navidrome command</button>
        <button onClick={() => { void runCommand('  race  ', 'search-netease'); }}>Single command</button>
        <button onClick={() => { void controller.handleSearchOverlaySubmit('all-online'); }}>Submit</button>
        <button onClick={() => { failFast = true; void controller.handleSearchOverlaySubmit('all-online'); }}>Submit failure</button>
        <button onClick={() => { void search.getState().loadAggregateSource('netease'); }}>More or retry</button>
        <button onClick={() => finishSlow()}>Finish slow</button>
        <button onClick={() => finishPage()}>Finish page</button>
        <button onClick={() => failPage()}>Fail page</button>
        <button onClick={navigation.closeSearchView}>Close</button>
        <button onClick={() => window.dispatchEvent(new PopStateEvent('popstate', { state: { view: 'home', search: { query: 'race', sourceTab: 'all-online' }, appHistoryIndex: 1 } }))}>History restore</button>
        <button onClick={() => search.getState().setSearchQuery('new')}>New query</button>
        <button onClick={() => controller.handleSearchResultAddToQueue(track('netease', 1))}>Queue netease</button>
        <button onClick={() => controller.handleSearchResultAddToQueue(track('kugou', 1))}>Queue kugou</button>
        <output data-testid="state">{JSON.stringify({ query: state.searchQuery, open: state.isSearchOpen, sources: state.aggregateSources, results: state.searchResults?.map(s => s.name), history: window.history.state, queue: queue.map(s => s.sourceRef), slowQuery })}</output>
    </>;
}
export default { id: 'aggregateSearchController', title: 'Aggregate controller integration', description: 'Controlled remote timing through real navigation and queue business layers', Component: Probe } satisfies ProbeDefinition;
