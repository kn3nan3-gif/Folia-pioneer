import { omni } from './omni';
import type { UnifiedSong } from '../../types';
import type { OnlineProviderId } from '../../types/onlineMusic';
import { getPlaybackSongKey } from '../../utils/appPlaybackGuards';
// Explicit cross-provider orchestration; never discard sourceRef.
export type AggregateSourceState = {
    providerId: OnlineProviderId;
    items: UnifiedSong[];
    nextOffset: number;
    hasMore: boolean;
    loading: boolean;
    error: string | null;
};
export const getAggregateProviders = () => omni.getProviderSummaries()
    .filter(source => source.availability.configured && omni.getProviderCapabilities(source.providerId).search)
    .map(source => source.providerId);
export const uniqueSearchSongs = (items: UnifiedSong[]) =>
    [...new Map(items.map(song => [getPlaybackSongKey(song), song])).values()];
/** Timeout settles the logical request even if a transport cannot abort. */
export async function searchAggregatePage(
    providerId: OnlineProviderId, query: string, offset: number, limit: number,
    search = omni.searchProviderSongs, timeoutMs = 15000,
) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const page = await Promise.race([
            Promise.resolve().then(() => search(providerId, query, { offset, limit })),
            new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('search_timeout')), timeoutMs); }),
        ]);
        if (!Number.isFinite(page.nextOffset) || page.nextOffset < offset || (page.hasMore && page.nextOffset <= offset)) {
            throw new Error('search_invalid_cursor');
        }
        return { ...page, items: uniqueSearchSongs(page.items) };
    } finally {
        if (timer) clearTimeout(timer);
    }
}
