// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { expect, it, vi } from 'vitest';
import { AppDatabase } from '../../../src/services/appDatabase';
import { AppPlaylistRepository } from '../../../src/services/repositories/appPlaylistRepository';
import { AppPlaylistService } from '../../../src/services/appPlaylistService';
import { createAppPlaylistStore } from '../../../src/stores/useAppPlaylistStore';
// Store reflects durable commits only; failures reject and are visible to UI.
it.each(['create', 'delete'])('late load cannot hide or resurrect a committed %s', async action => {
    const db = new AppDatabase(`late-${crypto.randomUUID()}`);
    const service = new AppPlaylistService(new AppPlaylistRepository(db));
    const initial = await service.create('Original');
    const store = createAppPlaylistStore(service);
    await store.getState().load();
    const snapshot = await service.list();
    let release!: (value: typeof snapshot) => void;
    vi.spyOn(service, 'list').mockImplementationOnce(() => new Promise<typeof snapshot>(resolve => { release = resolve; }) as ReturnType<typeof service.list>);
    const oldLoad = store.getState().load();
    await store.getState().run(s => action === 'create' ? s.create('New') : s.delete(initial.id));
    const committed = store.getState().lists;
    release(snapshot);
    await oldLoad;
    expect(store.getState().lists).toEqual(committed);
    expect(store.getState().lists.map(list => list.name)).toEqual(action === 'create' ? ['Original', 'New'] : []);
    await db.delete();
});
it('hydrates committed lists and surfaces failed writes without optimistic success', async () => {
    const db = new AppDatabase(`store-${crypto.randomUUID()}`);
    const store = createAppPlaylistStore(new AppPlaylistService(new AppPlaylistRepository(db)));
    await store.getState().run(service => service.create('Saved'));
    expect(store.getState().lists[0].name).toBe('Saved');
    const id = store.getState().lists[0].id;
    await expect(store.getState().run(service => service.rename(id, ''))).rejects.toThrow('invalid-name');
    expect(store.getState().error).toBe('invalid-name');
    expect(store.getState().lists[0].name).toBe('Saved');
    const restored = createAppPlaylistStore(new AppPlaylistService(new AppPlaylistRepository(db)));
    await restored.getState().load();
    expect(restored.getState().lists[0].id).toBe(id);
    await db.delete();
});
