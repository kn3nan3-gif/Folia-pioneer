import 'fake-indexeddb/auto';
import { afterEach, expect, it } from 'vitest';
import { AppDatabase } from '../../../src/services/appDatabase';
import { AppPlaylistRepository } from '../../../src/services/repositories/appPlaylistRepository';
import { AppPlaylistService } from '../../../src/services/appPlaylistService';
import { exportPlaylist, parsePlaylist } from '../../../src/services/appPlaylists/json';
// JSON crosses the machine boundary as references only, never live playback carriers.
let db: AppDatabase;
afterEach(async () => { if (db) await db.delete(); });
it('roundtrips versioned references and imports a new list rather than replacing the original', async () => {
    db = new AppDatabase(`json-${crypto.randomUUID()}`);
    const service = new AppPlaylistService(new AppPlaylistRepository(db));
    const list = await service.create('Mix');
    const song = { id: '1', name: 'Track', artists: [], album: { id: '1', name: '' }, durationMs: 1, sourceRef: { kind: 'online' as const, providerId: 'qq', mediaId: '1', providerData: { songMid: 'mid' } } };
    await service.add(list.id, [song]);
    await service.add(list.id, [{ ...song, isLocal: true, localRef: { songId: 'file' }, sourceRef: { kind: 'local', mediaId: 'file' } }]);
    await service.add(list.id, [{ ...song, sourceRef: { kind: 'navidrome', mediaId: 'remote', serverUrl: 'https://navi.test' } }], 'https://navi.test');
    const original = (await service.list())[0];
    const json = exportPlaylist(original);
    expect(parsePlaylist(json)).toEqual({ name: 'Mix', entries: original.entries });
    const imported = await service.importJson(json);
    expect(imported.id).not.toBe(original.id);
    expect(imported.entries).toEqual(original.entries);
    expect(await service.list()).toHaveLength(2);
});
it('rejects invalid schemas, unsafe extras, stage and forged identity before any write', async () => {
    db = new AppDatabase(`invalid-${crypto.randomUUID()}`);
    const service = new AppPlaylistService(new AppPlaylistRepository(db));
    const list = await service.create('Mix');
    await service.add(list.id, [{ id: 1, name: 'Track', artists: [], album: { id: 1, name: '' }, durationMs: 1, sourceRef: { kind: 'online', providerId: 'netease', mediaId: '1' } }]);
    const document = JSON.parse(exportPlaylist((await service.list())[0]));
    for (const bad of [null, { ...document, version: 2 }, { ...document, cookie: 'secret' }, { ...document, entries: [{ ...document.entries[0], key: 'fake' }] }, { ...document, entries: [{ ...document.entries[0], snapshot: { ...document.entries[0].snapshot, audioUrl: 'secret' } }] }, { ...document, entries: [{ ...document.entries[0], sourceRef: { kind: 'stage', mediaId: '1' } }] }]) {
        await expect(service.importJson(JSON.stringify(bad))).rejects.toThrow();
    }
    await expect(service.importJson('{')).rejects.toThrow();
    expect(await service.list()).toHaveLength(1);
});
