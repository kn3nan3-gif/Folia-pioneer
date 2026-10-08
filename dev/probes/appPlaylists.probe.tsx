import React, { useEffect, useRef, useState } from 'react';
import AppPlaylistHost from '../../src/components/app/playlists/AppPlaylistHost';
import { usePlaybackQueueController } from '../../src/hooks/usePlaybackQueueController';
import { usePlaybackStore as playback } from '../../src/stores/usePlaybackStore';
import { useSearchNavigationStore as search } from '../../src/stores/useSearchNavigationStore';
import { useAppPlaylistStore } from '../../src/stores/useAppPlaylistStore';
import { omni } from '../../src/services/onlineMusic/omni';
import { navidromeApi, saveNavidromeConfig } from '../../src/services/navidromeService';
import { getPlaybackSongKey } from '../../src/utils/appPlaybackGuards';
import { useLyricSettingsStore } from '../../src/stores/useLyricSettingsStore';
import type { ProbeDefinition } from './definition';
import type { UnifiedSong, LocalSong } from '../../src/types';
// Real host/panel/store/service/Dexie/controller. Only remote IO and audio/local playback boundaries mocked.
const track = (providerId: string): UnifiedSong => ({ id: 1, name: `${providerId}-1`, artists: [], album: { id: 1, name: '' }, durationMs: 1000, sourceRef: { kind: 'online', providerId, mediaId: '1' } });
const local: UnifiedSong = { ...track('local'), name: 'Local-1', isLocal: true, localRef: { songId: 'file-1' }, sourceRef: { kind: 'local', mediaId: 'file-1' } };
const remote: UnifiedSong = { ...track('remote'), name: 'Navi-1', sourceRef: { kind: 'navidrome', mediaId: 'remote-1', serverUrl: 'https://navi.fixture' } };
const localFile = { id: 'file-1', title: 'Local-1', titleOrigin: 'import', importedMetadata: { artistNames: ['Artist'], albumName: 'Album' }, duration: 1000, filePath: '/fixture/file.mp3' } as LocalSong;
const theme = { name: 'Probe', backgroundColor: '#f1efe9', primaryColor: '#272821', accentColor: '#5c7a57', secondaryColor: '#757970', fontStyle: 'sans', animationIntensity: 'calm' } as const;
const noop = () => {};
const asyncNoop = async () => {};
const ref = <T,>(current: T) => ({ current });
function Probe() {
    const pendingLookups = useRef<Array<() => void>>([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [externalChanges, setExternalChanges] = useState(0);
    const [playCalls, setPlayCalls] = useState(0);
    const releaseLookups = () => { pendingLookups.current.splice(0).forEach(release => release()); setPendingCount(0); };
    // External callers use the real durable service/store while the panel controls are disabled.
    const replaceEntries = async (release: boolean) => {
        const store = useAppPlaylistStore.getState();
        const list = store.lists[0];
        await store.run(async service => {
            for (const entry of list.entries) await service.remove(list.id, entry.key);
            await service.add(list.id, [local]);
        });
        setExternalChanges(value => value + 1);
        if (release) releaseLookups(); // Same microtask as store completion, before React has to render.
    };
    const queue = playback(s => s.playQueue);
    const current = playback(s => s.currentSong);
    const lists = useAppPlaylistStore(s => s.lists);
    const controller = usePlaybackQueueController({
        isNowPlayingStageActive: false, shouldNavigateToPlayerOnTrackChange: false,
        localSongs: [localFile], localLibraryCatalog: { entities: [], assignments: [] },
        setLyrics: noop, setIsLyricsLoading: noop, navigateToPlaybackView: noop, navigateToSearch: noop,
        persistLastPlaybackCache: asyncNoop, restoreCachedThemeForSong: asyncNoop,
        interruptStagePlaybackForMainTransition: noop,
        // These are the audio boundary, not list/queue business mocks. Controller selects full unifiedQueue.
        onPlayLocalSong: async (_song, _queue, options) => { playback.setState({ playQueue: options?.unifiedQueue ?? [], currentSong: local }); },
        onPlayNavidromeSong: async (_song, _queue, options) => { playback.setState({ playQueue: options?.unifiedQueue ?? [], currentSong: remote }); },
        onAddLocalSongToQueue: noop, onAddNavidromeSongsToQueue: noop,
        searchDeps: { submitSearch: search.getState().submitSearch, loadMoreSearchResults: search.getState().loadMoreSearchResults },
        audioRef: ref(null), blobUrlRef: ref(null), shouldAutoPlayRef: ref(false), currentSongRef: ref(null),
        mainPlaybackSnapshotRef: ref(null), playbackAutoSkipCountRef: ref(0), pendingResumeTimeRef: ref(null),
        currentOnlineAudioUrlFetchedAtRef: ref(null), lastAudioRecoverySourceRef: ref(null),
    });
    useEffect(() => {
        const originalAutoLyrics = useLyricSettingsStore.getState().autoUseBestLyric;
        useLyricSettingsStore.setState({ autoUseBestLyric: false });
        const original = { canPlay: omni.canPlaySong, audio: omni.getAudioSource, lyrics: omni.getLyrics, remote: navidromeApi.getSong, availability: omni.getProviderAvailability, capabilities: omni.getProviderCapabilities, detail: omni.getSongDetail, status: omni.getSongAvailability };
        omni.canPlaySong = () => true;
        omni.getProviderAvailability = () => ({ configured: true });
        omni.getProviderCapabilities = () => ({ playback: true }) as any;
        omni.getSongDetail = async (provider, id) => ({ ...track(provider), sourceRef: { kind: 'online', providerId: provider, mediaId: String(id) } });
        omni.getSongAvailability = () => ({ state: 'playable' });
        omni.getAudioSource = async () => ({ url: 'https://fixture.invalid/audio.mp3', fetchedAt: Date.now(), quality: 'standard' });
        omni.getLyrics = async () => ({ lyrics: null, pureMusic: true }) as any;
        navidromeApi.getSong = async () => ({ id: 'remote-1', title: 'Navi-1', artist: 'Artist', album: 'Album', duration: 1 }) as any;
        saveNavidromeConfig({ serverUrl: 'https://navi.fixture', username: 'fixture', passwordHash: 'mock-not-a-credential' });
        playback.setState({ currentSong: track('netease'), playQueue: [track('netease'), track('kugou'), local, remote], activePlaybackContext: 'main', isFmMode: false });
        search.setState({ searchResults: [track('qq')] });
        return () => { useLyricSettingsStore.setState({ autoUseBestLyric: originalAutoLyrics }); omni.canPlaySong = original.canPlay; omni.getAudioSource = original.audio; omni.getLyrics = original.lyrics; navidromeApi.getSong = original.remote; omni.getProviderAvailability = original.availability; omni.getProviderCapabilities = original.capabilities; omni.getSongDetail = original.detail; omni.getSongAvailability = original.status; };
    }, []);
    return <>
        <button onClick={() => { playback.setState({ currentSong: local, playQueue: [local] }); }}>Use local queue</button>
        <button onClick={() => { omni.getSongDetail = (provider, id) => new Promise(resolve => { pendingLookups.current.push(() => resolve({ ...track(provider), sourceRef: { kind: 'online', providerId: provider, mediaId: String(id) } })); setPendingCount(pendingLookups.current.length); }); }}>Hold lookup</button>
        <button onClick={releaseLookups}>Release lookup</button>
        <button onClick={() => { void replaceEntries(false); }}>External replace entries</button>
        <button onClick={() => { void replaceEntries(true); }}>External replace and release</button>
        <button onClick={() => { void useAppPlaylistStore.getState().run(service => service.rename(lists[0].id, 'External name')).then(() => setExternalChanges(value => value + 1)); }}>External rename</button>
        <button onClick={() => { void useAppPlaylistStore.getState().load().then(() => setExternalChanges(value => value + 1)); }}>External refresh</button>
        <output data-testid="external-changes">{externalChanges}</output>
        <output data-testid="play-calls">{playCalls}</output>
        <button onClick={() => saveNavidromeConfig({ serverUrl: 'https://b.fixture', username: 'fixture', passwordHash: 'mock' })}>Config only B</button>
        <output data-testid="pending-lookups">{pendingCount}</output>
        <button onClick={() => { saveNavidromeConfig({ serverUrl: 'https://b.fixture', username: 'fixture', passwordHash: 'mock' }); playback.setState({ currentSong: remote, playQueue: [remote] }); search.setState({ searchResults: [remote] }); }}>Switch server B</button>
        <button onClick={() => { omni.getProviderAvailability = () => ({ configured: false }); }}>Provider offline</button>
        <button onClick={() => { omni.getProviderAvailability = () => ({ configured: true }); omni.getSongDetail = async () => { throw new Error('network'); }; }}>Provider temporary failure</button>
        <button onClick={() => { omni.getProviderAvailability = () => ({ configured: true }); omni.getSongDetail = async () => track('netease'); omni.getSongAvailability = () => ({ state: 'unavailable' }); }}>Song deleted</button>
        <AppPlaylistHost theme={theme} localSongs={[localFile]} onPlay={async (song, songs) => { setPlayCalls(value => value + 1); return controller.playSong(song, songs); }} />
        <output data-testid="business">{JSON.stringify({ queue: queue.map(getPlaybackSongKey), current: current && getPlaybackSongKey(current), lists: lists.map(list => ({ id: list.id, name: list.name, keys: list.entries.map(entry => entry.key) })) })}</output></>;
}
export default { id: 'appPlaylists', title: 'Persistent mixed application lists', description: 'Real Dexie and unified playback controller; remote/audio mocked explicitly', Component: Probe } satisfies ProbeDefinition;
