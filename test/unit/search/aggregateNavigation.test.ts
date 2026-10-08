import { beforeEach, describe, expect, it, vi } from 'vitest';
import { omni } from '@/services/onlineMusic/omni';
import { useSearchNavigationStore as store } from '@/stores/useSearchNavigationStore';
// Exercise aggregate sessions through the public navigation actions.
vi.mock('@/services/onlineMusic/omni', () => ({ omni: {
    getProviderSummaries: vi.fn(), getProviderCapabilities: vi.fn(() => ({ search: true })), searchProviderSongs: vi.fn(),
} }));
const deps = { localSongs: [], t: (key: string) => key };
const song = (providerId: string, id = 1) => ({ id, name: `${providerId}-${id}`, artists: [], album: { id: 1, name: '' }, durationMs: 1000, sourceRef: { kind: 'online', providerId, mediaId: String(id) } });
const page = (provider: string, offset = 1, hasMore = true) => ({ items: [song(provider, offset)], nextOffset: offset, hasMore });
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
describe('aggregate navigation', () => {
    beforeEach(() => {
        vi.useRealTimers(); vi.clearAllMocks(); store.getState().resetRuntime(); store.setState({ searchCache: {} });
        vi.mocked(omni.getProviderSummaries).mockReturnValue(['netease', 'kugou'].map(providerId => ({ providerId, availability: { configured: true } })) as any);
        vi.mocked(omni.getProviderCapabilities).mockReturnValue({ search: true } as any);
    });
    it('shows completed sources immediately, keeps partial success and retries the failed offset independently', async () => {
        let finish!: (p: any) => void;
        vi.mocked(omni.searchProviderSongs).mockImplementation((provider) => provider === 'netease' ? Promise.resolve(page(provider) as any) : new Promise(resolve => { finish = resolve; }));
        const pending = store.getState().submitSearch({ query: 'q', sourceTab: 'all-online', deps });
        await flush();
        expect(store.getState().searchResults).toHaveLength(1);
        expect(store.getState().aggregateSources.kugou.loading).toBe(true);
        finish(Promise.reject(new Error('failed'))); await pending;
        expect(store.getState().searchResults).toHaveLength(1);
        expect(store.getState().aggregateSources.kugou.nextOffset).toBe(0);
        vi.mocked(omni.searchProviderSongs).mockResolvedValue(page('kugou') as any);
        await store.getState().loadAggregateSource('kugou');
        expect(omni.searchProviderSongs).toHaveBeenLastCalledWith('kugou', 'q', { offset: 0, limit: 30 });
        expect(store.getState().searchResults).toHaveLength(2);
        expect(store.getState().aggregateSources.kugou.error).toBeNull();
    });
    it('paginates one source, deduplicates and restores source cursors from cache', async () => {
        vi.mocked(omni.searchProviderSongs).mockImplementation(provider => Promise.resolve(page(provider) as any));
        await store.getState().submitSearch({ query: 'q', sourceTab: 'all-online', deps });
        vi.mocked(omni.searchProviderSongs).mockResolvedValue({ items: [song('netease'), song('netease', 2)], nextOffset: 3, hasMore: false } as any);
        await store.getState().loadAggregateSource('netease');
        expect(omni.searchProviderSongs).toHaveBeenLastCalledWith('netease', 'q', { offset: 1, limit: 30 });
        expect(store.getState().searchResults).toHaveLength(3);
        store.getState().hideSearchOverlay();
        store.getState().restoreSearch({ query: 'q', sourceTab: 'all-online' });
        expect(store.getState().aggregateSources.netease.nextOffset).toBe(3);
        expect(store.getState().aggregateSources.kugou.nextOffset).toBe(1);
    });
    it.each(['close', 'restore', 'reset', 'query', 'providers'])('ignores pending pages after %s', async action => {
        vi.mocked(omni.searchProviderSongs).mockImplementation(provider => Promise.resolve(page(provider) as any));
        await store.getState().submitSearch({ query: 'q', sourceTab: 'all-online', deps });
        let finish!: (p: any) => void;
        vi.mocked(omni.searchProviderSongs).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
        const pending = store.getState().loadAggregateSource('netease'); await flush();
        if (action === 'close') store.getState().hideSearchOverlay();
        if (action === 'restore') store.getState().restoreSearch({ query: 'other', sourceTab: 'all-online' });
        if (action === 'reset') store.getState().resetRuntime();
        if (action === 'query') store.getState().setSearchQuery('new');
        if (action === 'providers') vi.mocked(omni.getProviderSummaries).mockReturnValue([]);
        finish(page('netease', 2)); await pending;
        expect(store.getState().searchResults?.some(s => s.name === 'netease-2')).not.toBe(true);
    });
    it('times out logically, permits retry and never applies the original late result', async () => {
        vi.useFakeTimers(); let finish!: (p: any) => void;
        vi.mocked(omni.searchProviderSongs).mockImplementation(provider => provider === 'netease' ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(page(provider) as any));
        const pending = store.getState().submitSearch({ query: 'q', sourceTab: 'all-online', deps });
        await vi.advanceTimersByTimeAsync(15001); await pending;
        expect(store.getState().aggregateSources.netease.error).toBe('search_timeout');
        vi.mocked(omni.searchProviderSongs).mockResolvedValue(page('netease') as any);
        await store.getState().loadAggregateSource('netease'); finish(page('netease', 99)); await flush();
        expect(store.getState().searchResults?.some(s => s.name === 'netease-99')).toBe(false);
        vi.useRealTimers();
    });
    it('filters unconfigured or search-incapable providers without hardcoded IDs', async () => {
        vi.mocked(omni.getProviderSummaries).mockReturnValue([
            { providerId: 'netease', availability: { configured: true } },
            { providerId: 'kugou', availability: { configured: false } },
            { providerId: 'qq', availability: { configured: true } },
            { providerId: 'folium.test.source', availability: { configured: true } },
        ] as any);
        vi.mocked(omni.getProviderCapabilities).mockImplementation(id => ({ search: id !== 'qq' }) as any);
        vi.mocked(omni.searchProviderSongs).mockImplementation(id => Promise.resolve(page(id) as any));
        await store.getState().submitSearch({ query: 'q', sourceTab: 'all-online', deps });
        expect(Object.keys(store.getState().aggregateSources)).toEqual(['netease', 'folium.test.source']);
    });
    it('prevents duplicate page loads while allowing another source to load concurrently', async () => {
        vi.mocked(omni.searchProviderSongs).mockImplementation(provider => Promise.resolve(page(provider) as any));
        await store.getState().submitSearch({ query: 'q', sourceTab: 'all-online', deps });
        let finish!: (p: any) => void;
        vi.mocked(omni.searchProviderSongs).mockImplementation(provider => provider === 'netease' ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(page(provider, 2) as any));
        const pending = store.getState().loadAggregateSource('netease');
        await store.getState().loadAggregateSource('netease');
        await store.getState().loadAggregateSource('kugou');
        expect(store.getState().aggregateSources.kugou.nextOffset).toBe(2);
        expect(omni.searchProviderSongs).toHaveBeenCalledTimes(4);
        finish(page('netease', 2)); await pending;
    });
    it('retries a failed later page at its original cursor without dropping prior items', async () => {
        vi.mocked(omni.searchProviderSongs).mockImplementation(provider => Promise.resolve(page(provider) as any));
        await store.getState().submitSearch({ query: 'q', sourceTab: 'all-online', deps });
        vi.mocked(omni.searchProviderSongs).mockRejectedValueOnce(new Error('later page'));
        await store.getState().loadAggregateSource('netease');
        expect(store.getState().aggregateSources.netease).toMatchObject({ nextOffset: 1, error: 'later page' });
        expect(store.getState().searchResults).toHaveLength(2);
        vi.mocked(omni.searchProviderSongs).mockResolvedValueOnce(page('netease', 2, false) as any);
        await store.getState().loadAggregateSource('netease');
        expect(omni.searchProviderSongs).toHaveBeenLastCalledWith('netease', 'q', { offset: 1, limit: 30 });
        expect(store.getState().searchResults).toHaveLength(3);
    });
    it('invalidates cache when configured searchable source membership changes', async () => {
        vi.mocked(omni.searchProviderSongs).mockImplementation(provider => Promise.resolve(page(provider) as any));
        await store.getState().submitSearch({ query: 'q', sourceTab: 'all-online', deps });
        vi.mocked(omni.getProviderSummaries).mockReturnValue([]);
        store.getState().restoreSearch({ query: 'q', sourceTab: 'all-online' });
        expect(store.getState().searchResults).toBeNull();
    });
});
