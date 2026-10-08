import type { SongResult } from '../types';
import type { PlaybackSourceRef } from './onlineMusic';
// Application-owned references; never a platform playlist or media cache.
export interface AppPlaylistEntry {
    key: string;
    sourceRef: Exclude<PlaybackSourceRef, { kind: 'stage' }>;
    snapshot: Pick<SongResult, 'id' | 'name' | 'artists' | 'album' | 'durationMs'>;
    localRef?: { songId: string };
    navidromeRef?: { serverUrl: string; songId: string };
}
export interface AppPlaylist {
    id: string;
    name: string;
    entries: AppPlaylistEntry[];
    createdAt: number;
    updatedAt: number;
}
