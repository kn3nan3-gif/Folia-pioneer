import { describe, expect, it, vi } from 'vitest';
import { searchAggregatePage } from '@/services/onlineMusic/aggregateSearch';
// Aggregate searches retain source-aware playback identities.
describe('aggregate search', () => {
    it('deduplicates within a source without collapsing equal IDs across sources', async () => {
        const song = (providerId: string) => ({ id: 1, name: 'Track', artists: [], album: { id: 1, name: '' }, durationMs: 1, sourceRef: { kind: 'online', providerId, mediaId: '1' } });
        const search = vi.fn().mockResolvedValue({ items: [song('netease'), song('netease'), song('kugou')], hasMore: true, nextOffset: 3 });
        const page = await searchAggregatePage('netease', 'q', 0, 30, search as any);
        expect(page.items).toHaveLength(2);
        expect(page.nextOffset).toBe(3);
    });
});
