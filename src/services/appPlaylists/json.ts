import type { AppPlaylist, AppPlaylistEntry } from '../../types/appPlaylist';
import type { UnifiedSong } from '../../types';
import { toPlaylistEntry } from './references';
// Strict, bounded reference exchange. Unknown fields fail instead of carrying secrets across machines.
const record = (value: unknown): value is Record<string, any> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const id = (value: unknown) => (typeof value === 'string' && value.length > 0 && value.length <= 1024) || (typeof value === 'number' && Number.isFinite(value));
const text = (value: unknown) => typeof value === 'string' && value.length <= 4096;
const canonical = (value: any): string => JSON.stringify(value, (_key, item) => record(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export function parsePlaylist(json: string): { name: string; entries: AppPlaylistEntry[] } {
    if (json.length > 5_000_000) throw new Error('invalid-json');
    const input: unknown = JSON.parse(json);
    if (!record(input) || input.format !== 'folia-app-playlist' || input.version !== 1 || !text(input.name) || !input.name.trim() || !Array.isArray(input.entries) || input.entries.length > 10000) throw new Error('invalid-json');
    const entries = input.entries.map((entry: unknown) => {
        if (!record(entry) || !record(entry.sourceRef) || !record(entry.snapshot)) throw new Error('invalid-json');
        const s = entry.snapshot;
        if (!id(s.id) || !text(s.name) || !Array.isArray(s.artists) || s.artists.length > 100 || !s.artists.every((a: unknown) => record(a) && id(a.id) && text(a.name)) || !record(s.album) || !id(s.album.id) || !text(s.album.name) || typeof s.durationMs !== 'number' || !Number.isFinite(s.durationMs) || s.durationMs < 0) throw new Error('invalid-json');
        const ref = entry.sourceRef;
        if (!['online', 'local', 'navidrome'].includes(ref.kind) || typeof ref.mediaId !== 'string' || !id(ref.mediaId) || (ref.kind === 'online' && (typeof ref.providerId !== 'string' || !id(ref.providerId)))) throw new Error('invalid-json');
        const normalized = toPlaylistEntry({ ...s, sourceRef: ref.kind === 'navidrome' ? { ...ref, serverUrl: entry.navidromeRef?.serverUrl } : ref, localRef: entry.localRef } as UnifiedSong, entry.navidromeRef?.serverUrl);
        if (canonical(normalized) !== canonical(entry)) throw new Error('invalid-json');
        return normalized;
    });
    if (new Set(entries.map((e: AppPlaylistEntry) => e.key)).size !== entries.length || canonical(input) !== canonical({ format: 'folia-app-playlist', version: 1, name: input.name, entries })) throw new Error('invalid-json');
    return { name: input.name.trim(), entries };
}
export function exportPlaylist(playlist: AppPlaylist): string {
    const json = JSON.stringify({ format: 'folia-app-playlist', version: 1, name: playlist.name, entries: playlist.entries }, null, 2);
    parsePlaylist(json);
    return json;
}
