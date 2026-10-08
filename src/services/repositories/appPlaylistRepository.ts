import { appDatabase, type AppDatabase } from '../appDatabase';
import type { AppPlaylist } from '../../types/appPlaylist';
// Transactional user-data repository. Errors intentionally propagate to callers.
export class AppPlaylistRepository {
    constructor(private readonly db: AppDatabase = appDatabase) {}
    list() { return this.db.app_playlists.orderBy('createdAt').toArray(); }
    async create(name: string, entries: AppPlaylist['entries'] = []): Promise<AppPlaylist> {
        if (!name.trim()) throw new Error('invalid-name');
        const now = Date.now();
        const playlist = { id: crypto.randomUUID(), name: name.trim(), entries, createdAt: now, updatedAt: now };
        await this.db.app_playlists.add(playlist);
        return playlist;
    }
    async mutate(id: string, change: (playlist: AppPlaylist) => AppPlaylist): Promise<AppPlaylist> {
        return this.db.transaction('rw', this.db.app_playlists, async () => {
            const previous = await this.db.app_playlists.get(id);
            if (!previous) throw new Error('missing-playlist');
            const next = { ...change(previous), id, updatedAt: Date.now() };
            await this.db.app_playlists.put(next);
            return next;
        });
    }
    async delete(id: string) { await this.db.app_playlists.delete(id); }
}
