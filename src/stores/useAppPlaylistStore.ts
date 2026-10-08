import { create } from 'zustand';
import type { AppPlaylist } from '../types/appPlaylist';
import { AppPlaylistService } from '../services/appPlaylistService';
// Durable store: every action awaits persistence; no optimistic write-success state.
export interface AppPlaylistState {
    lists: AppPlaylist[];
    error: string | null;
    busy: boolean;
    load: () => Promise<void>;
    run: (operation: (service: AppPlaylistService) => Promise<unknown>) => Promise<void>;
}
export function createAppPlaylistStore(service = new AppPlaylistService()) {
    let tail = Promise.resolve();
    let revision = 0;
    return create<AppPlaylistState>((set) => ({
        lists: [], error: null, busy: false,
        load: async () => {
            const request = ++revision;
            try {
                const lists = await service.list();
                if (request === revision) set({ lists });
            } catch (error) {
                if (request === revision) set({ error: error instanceof Error ? error.message : String(error) });
                throw error;
            }
        },
        run: operation => {
            // Serialize local UI mutations so refreshes cannot overwrite a later committed result.
            ++revision;
            const task = tail.then(async () => {
                ++revision;
                set({ busy: true, error: null });
                try {
                    await operation(service);
                    const lists = await service.list();
                    ++revision;
                    set({ lists });
                }
                catch (error) { set({ error: error instanceof Error ? error.message : String(error) }); throw error; }
                finally { set({ busy: false }); }
            });
            tail = task.catch(() => {});
            return task;
        },
    }));
}
export const useAppPlaylistStore = createAppPlaylistStore();
