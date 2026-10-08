import type { UnifiedSong } from '../types';
import { AppPlaylistRepository } from './repositories/appPlaylistRepository';
import { toPlaylistEntry } from './appPlaylists/references';
import { parsePlaylist } from './appPlaylists/json';
// Application-list business operations; never call platform playlist mutations.
export class AppPlaylistService {
    constructor(private readonly repository = new AppPlaylistRepository()) {}
    async importJson(json: string) {
        const imported = parsePlaylist(json);
        return this.repository.create(imported.name, imported.entries);
    }
    list() { return this.repository.list(); }
    create(name: string) { return this.repository.create(name); }
    delete(id: string) { return this.repository.delete(id); }
    rename(id: string, name: string) {
        return this.repository.mutate(id, playlist => {
            if (!name.trim()) throw new Error('invalid-name');
            return { ...playlist, name: name.trim() };
        });
    }
    remove(id: string, key: string) {
        return this.repository.mutate(id, playlist => ({ ...playlist, entries: playlist.entries.filter(entry => entry.key !== key) }));
    }
    reorder(id: string, keys: string[]) {
        return this.repository.mutate(id, playlist => {
            const entries = new Map(playlist.entries.map(entry => [entry.key, entry]));
            if (keys.length !== entries.size || new Set(keys).size !== keys.length || keys.some(key => !entries.has(key))) throw new Error('invalid-order');
            return { ...playlist, entries: keys.map(key => entries.get(key)!) };
        });
    }
    async add(id: string, songs: UnifiedSong[], serverUrl?: string) {
        const entries = songs.map(song => toPlaylistEntry(song, serverUrl));
        return this.repository.mutate(id, playlist => {
            const seen = new Set(playlist.entries.map(entry => entry.key));
            return { ...playlist, entries: [...playlist.entries, ...entries.filter(entry => {
                if (seen.has(entry.key)) return false;
                seen.add(entry.key); return true;
            })] };
        });
    }
}
