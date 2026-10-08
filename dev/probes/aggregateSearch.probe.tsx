import React, { useEffect, useState } from 'react';
import SearchWorkspace from '../../src/components/app/search/SearchWorkspace';
import { useSearchNavigationStore as store } from '../../src/stores/useSearchNavigationStore';
import { omni } from '../../src/services/onlineMusic/omni';
import type { Theme, UnifiedSong } from '../../src/types';
import type { ProbeDefinition } from './definition';
// Deterministic Omni test doubles only; this probe does not validate live platforms.
const deps = { localSongs: [], t: (key: string) => key };
function Probe() {
    const [event, setEvent] = useState('');
    useEffect(() => {
        const originals = { summaries: omni.getProviderSummaries, capabilities: omni.getProviderCapabilities, search: omni.searchProviderSongs };
        let failures = 0;
        omni.getProviderSummaries = () => ['netease', 'kugou'].map(providerId => ({ providerId, availability: { configured: true } })) as any;
        omni.getProviderCapabilities = () => ({ search: true }) as any;
        omni.searchProviderSongs = async (providerId, _query, options) => {
            await new Promise(resolve => setTimeout(resolve, providerId === 'netease' ? 50 : 600));
            if (providerId === 'kugou' && failures++ === 0) throw new Error('probe failure');
            const offset = options?.offset ?? 0;
            const id = offset + 1;
            const track = { id, name: `${providerId} track ${id}`, artists: [], album: { id: 1, name: '' }, durationMs: 1000, sourceRef: { kind: 'online', providerId, mediaId: String(id) } } as UnifiedSong;
            return { items: [track], nextOffset: offset + 1, hasMore: offset === 0 };
        };
        store.getState().resetRuntime('netease');
        store.getState().restoreSearch({ query: 'probe', sourceTab: 'netease' });
        return () => { omni.getProviderSummaries = originals.summaries; omni.getProviderCapabilities = originals.capabilities; omni.searchProviderSongs = originals.search; store.getState().resetRuntime(); };
    }, []);
    return <><output data-testid="playback-event" className="fixed bottom-0 z-[100]">{event}</output><SearchWorkspace
        theme={{ primaryColor: '#eee', backgroundColor: '#101014', accentColor: '#b9a2ec' } as Theme} isDaylight={false}
        onClose={() => store.getState().hideSearchOverlay()}
        onSubmitSearch={source => { void store.getState().submitSearch({ sourceTab: source ?? store.getState().searchSourceTab, deps }); }}
        onLoadMore={() => { void store.getState().loadMoreSearchResults({ deps }); }}
        onPlayTrack={track => setEvent(`play:${track.sourceRef?.kind === 'online' ? track.sourceRef.providerId : ''}:${track.id}`)}
        onAddTrackToQueue={track => setEvent(`queue:${track.sourceRef?.kind === 'online' ? track.sourceRef.providerId : ''}:${track.id}`)}
        onOpenArtist={() => {}} onOpenAlbum={() => {}} /></>;
}
export default { id: 'aggregateSearch', title: 'Aggregate search', description: 'Independent source progress, retry and pagination', Component: Probe } satisfies ProbeDefinition;
