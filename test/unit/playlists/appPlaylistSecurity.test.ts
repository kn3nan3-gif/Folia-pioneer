import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { toPlaylistEntry } from '../../../src/services/appPlaylists/references';
import { parsePlaylist } from '../../../src/services/appPlaylists/json';
import type { UnifiedSong } from '../../../src/types';
import { navidromeApi } from '../../../src/services/navidromeService';
import { buildUnifiedNavidromeSong } from '../../../src/services/playbackAdapters';
import { resolvePlaylist } from '../../../src/services/appPlaylists/resolve';
import { vi } from 'vitest';
import { omni } from '../../../src/services/onlineMusic/omni';
// Exercise the real parser and persistence projection, including previously accepted payloads.
const song: UnifiedSong = { id: 1, name: 'Track', artists: [], album: { id: 1, name: '' }, durationMs: 1, sourceRef: { kind: 'online', providerId: 'kugou', mediaId: 'ABC123', providerData: { hash: 'ABC123' } } };
it('keeps server A provenance across config B for current/queue/search carriers and refuses legacy unknown songs', async () => {
    const a = { serverUrl: 'https://a.test', username: 'user', passwordHash: 'hash' };
    const raw = { id: 'same', title: 'A', artist: 'Artist', album: 'Album', duration: 1 } as any;
    const search = navidromeApi.toNavidromeSong(a, raw);
    const current = buildUnifiedNavidromeSong(search);
    const queue = { ...current };
    const spy = vi.spyOn(navidromeApi, 'getSong');
    try {
        for (const carrier of [search, current, queue]) {
            const entry = toPlaylistEntry(carrier as UnifiedSong, 'https://b.test');
            expect(entry.navidromeRef?.serverUrl).toBe('https://a.test');
            const restored = parsePlaylist(doc(entry)).entries;
            expect((await resolvePlaylist(restored, { localSongs: [], navidromeConfig: { ...a, serverUrl: 'https://b.test' } })).songs).toEqual([]);
        }
        expect(spy).not.toHaveBeenCalled();
        expect(() => toPlaylistEntry({ ...song, sourceRef: { kind: 'navidrome', mediaId: 'same' } }, 'https://b.test')).toThrow('navidrome-association-required');
    } finally { spy.mockRestore(); }
});
it('distinguishes offline, deleted/unplayable and transient unknown without deleting references or fetching audio', async () => {
    const entry = toPlaylistEntry(song);
    const before = JSON.stringify(entry);
    const availability = vi.spyOn(omni, 'getProviderAvailability').mockReturnValue({ configured: false });
    const capabilities = vi.spyOn(omni, 'getProviderCapabilities').mockReturnValue({ playback: true } as any);
    const detail = vi.spyOn(omni, 'getSongDetail').mockResolvedValue(null);
    const status = vi.spyOn(omni, 'getSongAvailability').mockReturnValue({ state: 'unknown' });
    const audio = vi.spyOn(omni, 'getAudioSource');
    const context = { localSongs: [], navidromeConfig: null };
    try {
        expect((await resolvePlaylist([entry], context)).unavailable[0]?.reason).toBe('provider-unavailable');
        expect(detail).not.toHaveBeenCalled();
        availability.mockReturnValue({ configured: true });
        expect((await resolvePlaylist([entry], context)).unknown[0]?.reason).toBe('online-unknown');
        detail.mockResolvedValue(song); status.mockReturnValue({ state: 'unavailable' });
        expect((await resolvePlaylist([entry], context)).unavailable[0]?.reason).toBe('online-unavailable');
        status.mockReturnValue({ state: 'unknown' });
        detail.mockRejectedValue(new Error('network'));
        const unknown = await resolvePlaylist([entry], context);
        expect((unknown as any).unknown[0]?.reason).toBe('online-unknown');
        expect(unknown.unavailable).toEqual([]);
        detail.mockResolvedValue(song); status.mockReturnValue({ state: 'unavailable' });
        expect((await resolvePlaylist([entry], context)).songs).toEqual([]);
        expect(JSON.stringify(entry)).toBe(before); expect(audio).not.toHaveBeenCalled();
    } finally { vi.restoreAllMocks(); }
});
const doc = (entry: unknown) => JSON.stringify({ format: 'folia-app-playlist', version: 1, name: 'Mix', entries: [entry] });
it('rejects credential objects and URL/token payloads in stable identifiers', () => {
    const clean = toPlaylistEntry(song);
    for (const variant of [{ cookie: 'secret', url: 'https://private' }, 'token=secret', 'https://private', 'unknown']) {
        expect(() => parsePlaylist(doc({ ...clean, sourceRef: { ...clean.sourceRef, variant } }))).toThrow();
    }
    for (const value of ['https://private/audio?token=secret', 'token=secret', { url: 'https://private' }]) {
        expect(() => parsePlaylist(doc({ ...clean, sourceRef: { ...clean.sourceRef, providerData: { hash: value } } }))).toThrow();
        expect(() => toPlaylistEntry({ ...song, sourceRef: { ...song.sourceRef as any, providerData: { hash: value } } })).toThrow();
    }
    for (const key of ['url', 'token', 'cookie', 'unknown']) expect(() => parsePlaylist(doc({ ...clean, sourceRef: { ...clean.sourceRef, providerData: { hash: 'ABC123', [key]: 'secret' } } }))).toThrow();
});
it('roundtrips existing provider cloud/hash/mid/numeric contracts without volatile data', () => {
    for (const sourceRef of [
        { kind: 'online', providerId: 'netease', mediaId: '123', variant: 'cloud' },
        { kind: 'online', providerId: 'kugou', mediaId: 'ABC123', variant: 'cloud', providerData: { hash: 'ABC123', fileId: 123, albumAudioId: '456', albumId: '', mixSongId: 789 } },
        { kind: 'online', providerId: 'qq', mediaId: '004Abc', providerData: { songMid: '004Abc', mediaMid: '004Def', songId: 123 } },
        { kind: 'online', providerId: 'bodian', mediaId: '123' },
    ]) {
        const entry = toPlaylistEntry({ ...song, sourceRef } as UnifiedSong);
        expect(parsePlaylist(doc(entry)).entries).toEqual([entry]);
    }
});
