import 'fake-indexeddb/auto';
import { expect, it, vi } from 'vitest';
import { omni } from '../../../src/services/onlineMusic/omni';
import { toPlaylistEntry } from '../../../src/services/appPlaylists/references';
import { resolvePlaylist } from '../../../src/services/appPlaylists/resolve';
import { navidromeApi } from '../../../src/services/navidromeService';
import type { LocalSong, UnifiedSong } from '../../../src/types';
// Remote lookup mocked; playback carrier reconstruction uses real adapters.
it('bounds hanging lookups and total work, retaining unknown entries and reaching later local songs', async () => {
    vi.useFakeTimers();
    const a = vi.spyOn(omni, 'getProviderAvailability').mockReturnValue({ configured: true });
    const c = vi.spyOn(omni, 'getProviderCapabilities').mockReturnValue({ playback: true } as any);
    let release!: (value: UnifiedSong | null) => void;
    const d = vi.spyOn(omni, 'getSongDetail').mockImplementation(() => new Promise(resolve => { release = resolve; }));
    try {
        const online = Array.from({ length: 8 }, (_, i) => toPlaylistEntry({ ...song, sourceRef: { kind: 'online', providerId: 'qq', mediaId: String(i + 1) } }));
        const local = toPlaylistEntry({ ...song, localRef: { songId: 'file' }, sourceRef: { kind: 'local', mediaId: 'file' } });
        const file: LocalSong = { id: 'file', fileName: 'file.mp3', fileSize: 1, mimeType: 'audio/mpeg', addedAt: 0, title: 'Local', titleOrigin: 'import', importedMetadata: { title: 'Local', titleSource: 'embedded', artistNames: [], albumName: '' }, duration: 1000, filePath: '/fixture/file.mp3' };
        let finished = false;
        const pending = resolvePlaylist([...online, local], { localSongs: [file], navidromeConfig: null }).then(result => { finished = true; return result; });
        await vi.advanceTimersByTimeAsync(15000);
        expect(finished).toBe(true);
        const result = await pending;
        expect(result.unknown).toHaveLength(8);
        expect(result.unavailable).toEqual([]);
        expect(result.songs.at(-1)?.sourceRef.kind).toBe('local');
        expect(d).toHaveBeenCalledTimes(3);
        expect(vi.getTimerCount()).toBe(0);
        release(song);
        await Promise.resolve();
        expect(result.unknown).toHaveLength(8);
        d.mockResolvedValue(song);
        expect((await resolvePlaylist([online[0]], { localSongs: [], navidromeConfig: null })).songs).toHaveLength(1);
        expect(vi.getTimerCount()).toBe(0);
    } finally { a.mockRestore(); c.mockRestore(); d.mockRestore(); vi.useRealTimers(); }
});
it('hanging Navidrome lookup becomes unknown after one request budget', async () => {
    vi.useFakeTimers();
    const entry = toPlaylistEntry({ ...song, sourceRef: { kind: 'navidrome', mediaId: '1', serverUrl: 'https://navi.test' } });
    const lookup = vi.spyOn(navidromeApi, 'getSong').mockImplementation(() => new Promise(() => {}));
    try {
        let finished = false;
        const pending = resolvePlaylist([entry], { localSongs: [], navidromeConfig: { serverUrl: 'https://navi.test', username: 'u', passwordHash: 'h' } }).then(result => { finished = true; return result; });
        await vi.advanceTimersByTimeAsync(5000);
        expect(finished).toBe(true);
        expect((await pending).unknown).toEqual([{ key: entry.key, reason: 'navidrome-unknown' }]);
        expect(entry.navidromeRef?.songId).toBe('1');
        expect(vi.getTimerCount()).toBe(0);
    } finally { lookup.mockRestore(); vi.useRealTimers(); }
});
const song: UnifiedSong = { id: 1, name: 'Snapshot', artists: [], album: { id: 1, name: '' }, durationMs: 10, sourceRef: { kind: 'online', providerId: 'qq', mediaId: '1', providerData: { songMid: 'mid' } } };
it('rejects malformed reference fields and credentials in server associations', () => {
    expect(() => toPlaylistEntry({ ...song, sourceRef: { kind: 'navidrome', mediaId: '1', serverUrl: 'https://user:secret@navi.test' } }, 'https://user:secret@navi.test')).toThrow('invalid-server-reference');
    expect(() => toPlaylistEntry({ ...song, sourceRef: { kind: 'online', providerId: '', mediaId: '' } })).toThrow('invalid-reference');
    expect(() => toPlaylistEntry({ ...song, durationMs: NaN })).toThrow('invalid-snapshot');
});
it('keeps source identity online, reconstructs local and retains missing references', async () => {
    const local = toPlaylistEntry({ ...song, isLocal: true, localRef: { songId: 'local-1' }, sourceRef: { kind: 'local', mediaId: 'local-1' } });
    const entries = [toPlaylistEntry(song), local];
    const a = vi.spyOn(omni, 'getProviderAvailability').mockReturnValue({ configured: true });
    const d = vi.spyOn(omni, 'getSongDetail').mockResolvedValue(song);
    const missing = await resolvePlaylist(entries, { localSongs: [], navidromeConfig: null });
    expect(missing.songs[0].sourceRef).toEqual(song.sourceRef);
    expect(missing.unavailable).toEqual([{ key: 'local:local-1', reason: 'local-reassociate' }]);
    expect(entries).toHaveLength(2);
    const file = { id: 'local-1', title: 'Actual file', titleOrigin: 'import', importedMetadata: { artistNames: ['Artist'], albumName: 'Album' }, duration: 1000, filePath: '/music/file.mp3' } as LocalSong;
    const resolved = await resolvePlaylist(entries, { localSongs: [file], navidromeConfig: null });
    expect(resolved.songs[1]).toMatchObject({ name: 'Actual file', isLocal: true, localRef: { songId: 'local-1' } });
    a.mockRestore(); d.mockRestore();
});
it('rebuilds Navidrome URL using current config only and never deletes failed or mismatched entries', async () => {
    const entry = toPlaylistEntry({ ...song, sourceRef: { kind: 'navidrome', mediaId: 'remote-1', serverUrl: 'https://navi.test' } }, 'https://navi.test');
    const config = { serverUrl: 'https://navi.test', username: 'user', passwordHash: 'hash' };
    const spy = vi.spyOn(navidromeApi, 'getSong').mockResolvedValue({ id: 'remote-1', title: 'Remote', artist: 'Artist', album: 'Album', duration: 1 } as any);
    const resolved = await resolvePlaylist([entry], { localSongs: [], navidromeConfig: config });
    expect(resolved.songs[0]).toMatchObject({ sourceRef: { kind: 'navidrome', mediaId: 'remote-1' }, isNavidrome: true });
    expect(JSON.stringify(resolved.songs)).toContain('/rest/stream');
    spy.mockResolvedValue(null);
    expect((await resolvePlaylist([entry], { localSongs: [], navidromeConfig: config })).unavailable[0].reason).toBe('navidrome-unavailable');
    expect((await resolvePlaylist([entry], { localSongs: [], navidromeConfig: { ...config, serverUrl: 'https://other.test' } })).unavailable[0].reason).toBe('navidrome-reassociate');
    expect(JSON.stringify(entry)).not.toMatch(/password|streamUrl|user/);
    spy.mockRestore();
});
