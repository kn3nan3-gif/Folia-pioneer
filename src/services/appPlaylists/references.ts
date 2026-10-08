import type { UnifiedSong } from '../../types';
import type { AppPlaylistEntry } from '../../types/appPlaylist';
import { getPlaybackSourceRef, getPlaybackSongKey } from '../../utils/appPlaybackGuards';
// Only stable provider identifiers are persisted; raw provider payloads are never copied.
// Provider normalizers emit opaque hashes/mids and numeric catalog IDs; not URLs or arbitrary JSON.
const opaque = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(value);
const numeric = (value: unknown) => (typeof value === 'string' && /^\d{1,32}$/.test(value)) || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);
const referenceFields: Record<string, Record<string, (value: unknown) => boolean>> = {
    kugou: { hash: opaque, albumId: value => value === '' || numeric(value), albumAudioId: numeric, mixSongId: numeric, catalogLookupId: numeric, fileId: numeric },
    qq: { songMid: opaque, mediaMid: opaque, songId: numeric },
};
function onlineReference(source: Extract<ReturnType<typeof getPlaybackSourceRef>, { kind: 'online' }>) {
    if (!opaque(source.providerId) || !opaque(source.mediaId)) throw new Error('invalid-reference');
    if (source.variant !== undefined && (!(source.providerId === 'netease' || source.providerId === 'kugou') || source.variant !== 'cloud')) throw new Error('invalid-variant');
    const fields = referenceFields[source.providerId] ?? {};
    const providerData = Object.fromEntries(Object.entries(source.providerData ?? {}).flatMap(([key, value]) => {
        if (!Object.hasOwn(fields, key)) return [];
        // QQ's normalizer emits an empty optional mediaMid; playback already omits it.
        if (source.providerId === 'qq' && key === 'mediaMid' && value === '') return [];
        // The only nonnumeric songId contract is the normalizer's stable song-mid fallback.
        const midOnlySongId = source.providerId === 'qq' && key === 'songId'
            && value === source.mediaId && value === source.providerData?.songMid && opaque(value);
        if (!fields[key](value) && !midOnlySongId) throw new Error('invalid-provider-reference');
        return [[key, value]];
    }));
    return { kind: 'online' as const, providerId: source.providerId, mediaId: source.mediaId,
        ...(source.variant !== undefined ? { variant: source.variant } : {}), providerData };
}
export function toPlaylistEntry(song: UnifiedSong, _legacyServerUrl?: string): AppPlaylistEntry {
    const source = getPlaybackSourceRef(song);
    if (source.kind === 'stage') throw new Error('stage-unsupported');
    if (!['online', 'local', 'navidrome'].includes(source.kind) || typeof source.mediaId !== 'string' || !source.mediaId || (source.kind === 'online' && !source.providerId)) throw new Error('invalid-reference');
    if (!Number.isFinite(song.durationMs) || song.durationMs < 0 || typeof song.name !== 'string' || !song.album || !Array.isArray(song.artists)) throw new Error('invalid-snapshot');
    const sourceRef = source.kind === 'online' ? onlineReference(source) : { kind: source.kind, mediaId: source.mediaId };
    if (source.kind === 'local' && song.localRef?.songId !== source.mediaId) throw new Error('invalid-local-reference');
    let navidromeRef: AppPlaylistEntry['navidromeRef'];
    if (source.kind === 'navidrome') {
        // Never infer ownership from the currently configured server.
        if (!source.serverUrl) throw new Error('navidrome-association-required');
        const url = new URL(source.serverUrl);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('invalid-server-reference');
        navidromeRef = { serverUrl: url.href.replace(/\/$/, ''), songId: source.mediaId };
    }
    return {
        key: getPlaybackSongKey(song) + (navidromeRef ? `@${navidromeRef.serverUrl}` : ''), sourceRef,
        snapshot: { id: song.id, name: song.name, artists: song.artists.map(a => ({ id: a.id, name: a.name })), album: { id: song.album.id, name: song.album.name }, durationMs: song.durationMs },
        ...(source.kind === 'local' ? { localRef: { songId: source.mediaId } } : {}),
        ...(navidromeRef ? { navidromeRef } : {}),
    };
}
