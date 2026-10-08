import type { LocalSong, UnifiedSong } from '../../types';
import type { NavidromeConfig } from '../../types/navidrome';
import type { AppPlaylistEntry } from '../../types/appPlaylist';
import { buildLocalQueue, buildUnifiedNavidromeSong } from '../playbackAdapters';
import { navidromeApi } from '../navidromeService';
import { omni } from '../onlineMusic/omni';
// Rebuild live playback carriers at use time. Unavailable references remain user-owned data.
export interface PlaylistResolution {
    songs: UnifiedSong[];
    unavailable: { key: string; reason: 'local-reassociate' | 'navidrome-reassociate' | 'navidrome-unavailable' | 'provider-unavailable' | 'online-unavailable' }[];
    unknown: { key: string; reason: 'online-unknown' | 'navidrome-unknown' }[];
}
const REQUEST_BUDGET_MS = 5000;
const OPERATION_BUDGET_MS = 15000;
// Bounds logical waiting only: transport may continue, but its late result is never consumed.
async function withinBudget<T>(lookup: () => Promise<T>, deadline: number): Promise<T> {
    const remaining = Math.min(REQUEST_BUDGET_MS, deadline - Date.now());
    if (remaining <= 0) throw new Error('playlist-resolution-timeout');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            lookup(),
            new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('playlist-resolution-timeout')), remaining); }),
        ]);
    } finally { if (timer !== undefined) clearTimeout(timer); }
}
export async function resolvePlaylist(entries: AppPlaylistEntry[], context: { localSongs: LocalSong[]; navidromeConfig: NavidromeConfig | null }): Promise<PlaylistResolution> {
    const result: PlaylistResolution = { songs: [], unavailable: [], unknown: [] };
    const deadline = Date.now() + OPERATION_BUDGET_MS;
    for (const entry of entries) {
        if (entry.sourceRef.kind === 'online') {
            const sourceRef = entry.sourceRef;
            const song: UnifiedSong = { ...entry.snapshot, sourceRef };
            try {
                if (!omni.getProviderAvailability(entry.sourceRef.providerId).configured || !omni.getProviderCapabilities(entry.sourceRef.providerId).playback) {
                    result.unavailable.push({ key: entry.key, reason: 'provider-unavailable' });
                    continue;
                }
                // Resolve metadata only on the explicit Play action, never audio URLs or render IO.
                // Cloud IDs may have no public catalog detail: lack of detail is unknown there.
                const detail = await withinBudget(() => omni.getSongDetail(sourceRef.providerId, sourceRef.mediaId), deadline);
                // A null detail can also be a permission/partial response, not proof of deletion.
                if (!detail) {
                    result.unknown.push({ key: entry.key, reason: 'online-unknown' });
                    result.songs.push(song);
                    continue;
                }
                const availability = omni.getSongAvailability(detail);
                if (availability.state === 'unavailable') result.unavailable.push({ key: entry.key, reason: 'online-unavailable' });
                else {
                    if (availability.state === 'unknown') result.unknown.push({ key: entry.key, reason: 'online-unknown' });
                    result.songs.push(song);
                }
            } catch {
                result.unknown.push({ key: entry.key, reason: 'online-unknown' });
                result.songs.push(song);
            }
        } else if (entry.sourceRef.kind === 'local') {
            const local = context.localSongs.find(song => song.id === entry.localRef?.songId);
            if (local) result.songs.push(...buildLocalQueue([local]));
            else result.unavailable.push({ key: entry.key, reason: 'local-reassociate' });
        } else {
            const config = context.navidromeConfig;
            if (!config || config.serverUrl.replace(/\/$/, '') !== entry.navidromeRef?.serverUrl) {
                result.unavailable.push({ key: entry.key, reason: 'navidrome-reassociate' });
                continue;
            }
            try {
                const remote = await withinBudget(() => navidromeApi.getSong(config, entry.navidromeRef!.songId), deadline);
                if (!remote) { result.unavailable.push({ key: entry.key, reason: 'navidrome-unavailable' }); continue; }
                result.songs.push({ ...buildUnifiedNavidromeSong(navidromeApi.toNavidromeSong(config, remote)), sourceRef: { ...entry.sourceRef, serverUrl: entry.navidromeRef.serverUrl } });
            } catch {
                result.unknown.push({ key: entry.key, reason: 'navidrome-unknown' });
            }
        }
    }
    return result;
}
