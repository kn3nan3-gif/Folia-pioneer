import { afterEach, expect, it, vi } from 'vitest';
import { normalizeBodianSong } from '../../../src/services/onlineMusic/bodianNormalize';
import { qqProvider } from '../../../src/services/onlineMusic/qqProvider';
import { normalizeQqSong } from '../../../src/services/onlineMusic/qqNormalize';
import { toPlaylistEntry } from '../../../src/services/appPlaylists/references';
import { exportPlaylist, parsePlaylist } from '../../../src/services/appPlaylists/json';
// Exercise actual normalizer carriers, not hand-built UnifiedSong fixtures.
const requestQq = vi.hoisted(() => vi.fn());
vi.mock('../../../src/services/onlineMusic/qqTransport', () => ({
    getQqTransportAvailability: () => ({ configured: true }), hasQqSession: () => false,
    clearQqSession: vi.fn(), requestQq,
}));
afterEach(() => { requestQq.mockReset(); vi.unstubAllGlobals(); });
const numericSong = () => normalizeQqSong({ mid: '004Abc', songid: 123, title: 'Normal', interval: 30, album: { mid: 'Album123', name: 'Album' } });
it('saves real numeric QQ songs without optional mediaMid and roundtrips canonical JSON', () => {
    const song = numericSong();
    expect(song.sourceRef).toMatchObject({ providerData: { songId: 123, mediaMid: '' } });
    const entry = toPlaylistEntry(song);
    expect(entry.sourceRef).toMatchObject({ providerData: { songId: 123, songMid: '004Abc' } });
    expect((entry.sourceRef as any).providerData).not.toHaveProperty('mediaMid');
    const json = exportPlaylist({ id: 'test', name: 'QQ', entries: [entry], createdAt: 1, updatedAt: 1 });
    expect(parsePlaylist(json).entries).toEqual([entry]);
});
it('saves the real mid-only QQ fallback without accepting unrelated string songIds', () => {
    const song = normalizeQqSong({ mid: '004MidOnly', title: 'Mid only', interval: 30, album: { mid: 'Album123', name: 'Album' }, file: { media_mid: '004Def' } });
    expect(song.sourceRef).toMatchObject({ providerData: { songId: '004MidOnly' } });
    const entry = toPlaylistEntry(song);
    expect((entry.sourceRef as any).providerData.songId).toBe('004MidOnly');
    expect(parsePlaylist(exportPlaylist({ id: 'test', name: 'QQ', entries: [entry], createdAt: 1, updatedAt: 1 })).entries).toEqual([entry]);
});
it('roundtrips a mixed-provider queue including complete, numeric and mid-only QQ carriers', () => {
    const songs = [numericSong(), normalizeBodianSong({ id: 123, songName: 'Other provider', albumId: 1, album: 'Album', duration: 30 }),
        normalizeQqSong({ mid: '004MidOnly', title: 'Mid', interval: 30, album: { mid: 'Album123' } }),
        normalizeQqSong({ mid: '004Complete', songid: 456, title: 'Full', interval: 30, album: { mid: 'Album123' }, file: { media_mid: '004Media' } })];
    const entries = songs.map(song => toPlaylistEntry(song));
    const restored = parsePlaylist(exportPlaylist({ id: 'queue', name: 'Mix', entries, createdAt: 1, updatedAt: 1 })).entries;
    expect(restored).toEqual(entries);
    expect(new Set(restored.map(entry => entry.key)).size).toBe(4);
    expect((restored[3].sourceRef as any).providerData).toEqual({ songId: 456, songMid: '004Complete', mediaMid: '004Media' });
});
it('rejects malicious and unrelated QQ songId/mediaMid values through save and JSON boundaries', () => {
    const song = numericSong();
    const clean = toPlaylistEntry(song);
    for (const key of ['songId', 'songMid', 'mediaMid']) {
        for (const value of ['https://private/audio?token=secret', 'token=secret', { token: 'secret' }, ...(key === 'songId' ? ['unrelated-mid'] : [])]) {
            const sourceRef = { ...song.sourceRef as any, providerData: { ...(song.sourceRef as any).providerData, [key]: value } };
            expect(() => toPlaylistEntry({ ...song, sourceRef })).toThrow('invalid-provider-reference');
            const importedRef = { ...clean.sourceRef as any, providerData: { ...(clean.sourceRef as any).providerData, [key]: value } };
            expect(() => parsePlaylist(JSON.stringify({ format: 'folia-app-playlist', version: 1, name: 'QQ', entries: [{ ...clean, sourceRef: importedRef }] }))).toThrow();
        }
    }
});
it.each([
    { mid: '004Abc', songid: 123 },
    { mid: '004MidOnly' },
    { mid: '004Full', songid: 456, file: { media_mid: '004Media' } },
])('preserves QQ playback and actual lyric request fallback across JSON: $mid', async raw => {
    const original = normalizeQqSong({ ...raw, title: 'Track', interval: 30, album: { mid: 'Album123', name: 'Album' } });
    const entry = toPlaylistEntry(original);
    const [restored] = parsePlaylist(exportPlaylist({ id: 'test', name: 'QQ', entries: [entry], createdAt: 1, updatedAt: 1 })).entries;
    const song = { ...restored.snapshot, sourceRef: restored.sourceRef };
    requestQq.mockResolvedValue({ data: { playUrl: { [raw.mid]: { url: 'https://audio.fixture.test/song.mp3' } } } });
    const originalAudio = await qqProvider.playback!.getAudioSource(original, 'high');
    const originalRequest = requestQq.mock.calls[0];
    requestQq.mockClear();
    expect(await qqProvider.playback!.getAudioSource(song, 'high')).toEqual(expect.objectContaining({ url: originalAudio!.url }));
    expect(requestQq.mock.calls[0]).toEqual(originalRequest);
    if (!raw.file) expect(requestQq.mock.calls[0][1]).not.toHaveProperty('mediaId');
    else expect(requestQq.mock.calls[0][1].mediaId).toBe('004Media');
    // Real QQ lyric pipeline; only network is stubbed. No numeric id means existing null fallback.
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ code: 0, request: { code: 0, data: {} } })));
    vi.stubGlobal('fetch', fetchMock);
    const originalLyrics = await qqProvider.lyrics!.getLyrics(original);
    const originalBody = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    fetchMock.mockClear();
    expect(await qqProvider.lyrics!.getLyrics(song)).toEqual(originalLyrics);
    const restoredBody = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(restoredBody).toEqual(originalBody);
    expect(restoredBody.request.param.songID).toBe(raw.songid ?? null);
    expect(originalLyrics).toEqual({ lyrics: null, isPureMusic: false });
});
