import React, { useEffect, useState } from 'react';
import '../../src/i18n/config';
import Home from '../../src/components/app/Home';
import { buildHomeModel } from '../../src/components/app/home/buildHomeModel';
import { useAppNavigation } from '../../src/hooks/useAppNavigation';
import { useSearchNavigationStore as search } from '../../src/stores/useSearchNavigationStore';
import { omni } from '../../src/services/onlineMusic/omni';
import { searchCommands } from '../../src/components/command-palette/commands/searchCommands';
import { buildSearchCommandContext } from '../../src/components/app/command-palette-context/buildSearchCommandContext';
import type { CommandPaletteContext } from '../../src/components/command-palette/types';
import { useHomeProbeEnvironment, useHomeProbeModel, type HomeProbeLibrary } from './homeBehavior/useHomeProbeHarness';
import type { ProbeDefinition } from './definition';
// dev/probes/gridSearchNavigation.probe.tsx
// Real Home/Grid3D, model and navigation; controlled remote search only.
const noop = () => {};
const page = (providerId: string, id = 1) => ({ items: [{ id, name: `${providerId}-${id}`, artists: [], album: { id: 1, name: '' }, sourceRef: { kind: 'online', providerId, mediaId: String(id) } }], nextOffset: id, hasMore: true }) as any;
function Stage({ library }: { library: HomeProbeLibrary }) {
    const { model: base } = useHomeProbeModel(library);
    const navigation = useAppNavigation();
    const state = search();
    const [ready, setReady] = useState(false);
    const gates = React.useRef({ grid: noop, slow: noop, more: noop, fail: false, fastCalls: 0 });
    useEffect(() => {
        const original = { search: omni.searchProviderSongs, summaries: omni.getProviderSummaries, capabilities: omni.getProviderCapabilities };
        omni.searchProviderSongs = (providerId) => {
            if (providerId.startsWith('probe-')) return new Promise(resolve => { gates.current.grid = () => resolve(page(providerId)); });
            if (providerId === 'kugou') return new Promise(resolve => { gates.current.slow = () => resolve(page(providerId)); });
            if (gates.current.fail) { gates.current.fail = false; gates.current.fastCalls++; return Promise.reject(new Error('fast failure')); }
            if (gates.current.fastCalls++ === 0) return Promise.resolve(page(providerId));
            return new Promise(resolve => { gates.current.more = () => resolve(page(providerId, 2)); });
        };
        omni.getProviderSummaries = () => ['netease', 'kugou'].map(providerId => ({ providerId, availability: { configured: true } })) as any;
        omni.getProviderCapabilities = () => ({ ...original.capabilities('netease'), search: true });
        search.getState().resetRuntime();
        search.getState().setSearchQuery('');
        setReady(true);
        return () => { Object.assign(omni, { searchProviderSongs: original.search, getProviderSummaries: original.summaries, getProviderCapabilities: original.capabilities }); search.getState().resetRuntime(); };
    }, []);
    const p = base.surfaceProps;
    const model = buildHomeModel({
        ...p, account: base.account, currentSong: null, activePlaybackContext: 'main', navidromeEnabled: p.navidromeEnabled,
        playSong: p.onPlaySong, navigateToPlayer: navigation.navigateToPlayer, navigateToLattice: noop,
        refreshOnlineProviderPlaylists: async () => {}, navigateToSearch: navigation.navigateToSearch,
        openStagePlayer: async () => {}, playAll: noop, addAllToQueue: noop, addSongToQueue: noop,
        onOpenCollection: base.onOpenCollection, onPushCollection: base.onPushCollection, onBackCollection: base.onBackCollection,
    });
    const aggregate = () => searchCommands.find(c => c.id === 'search-current')!.execute('next', {
        shared: { t: (key: string) => key }, search: buildSearchCommandContext({ currentSearchSourceTab: 'all-online', localSongs: library.songs, localLibraryCatalog: p.localLibraryCatalog, navigateToSearch: navigation.navigateToSearch }),
    } as CommandPaletteContext);
    return <div style={{ height: 900 }}>
        {ready && <Home model={model} />}
        <div style={{ position: 'fixed', bottom: 0, zIndex: 999 }}>
            <button onClick={navigation.closeSearchView}>Close grid search</button>
            <button onClick={() => search.getState().setSearchQuery('new')}>Edit query</button>
            <button onClick={() => { void aggregate(); }}>Aggregate next</button>
            <button onClick={() => { gates.current.fail = true; void aggregate(); }}>Aggregate failure</button>
            <button onClick={() => { void search.getState().loadAggregateSource('netease'); }}>More retry</button>
            <button onClick={() => gates.current.grid()}>Finish grid</button>
            <button onClick={() => gates.current.slow()}>Finish aggregate slow</button>
            <button onClick={() => gates.current.more()}>Finish more</button>
            <output data-testid="grid-state">{JSON.stringify({ query: state.searchQuery, open: state.isSearchOpen, requestId: state.requestId, sources: state.aggregateSources, results: state.searchResults?.map(s => s.name), history: window.history.state })}</output>
        </div>
    </div>;
}
function Probe() {
    const library = useHomeProbeEnvironment(true);
    return library ? <Stage library={library} /> : null;
}
export default { id: 'gridSearchNavigation', title: 'Grid search navigation race', description: 'Real home search form with controlled remote completion', Component: Probe } satisfies ProbeDefinition;
