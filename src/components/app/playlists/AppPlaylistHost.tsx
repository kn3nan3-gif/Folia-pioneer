import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListMusic } from 'lucide-react';
import type { LocalSong, SongResult, Theme, UnifiedSong } from '../../../types';
import { usePlaybackStore } from '../../../stores/usePlaybackStore';
import { useSearchNavigationStore } from '../../../stores/useSearchNavigationStore';
import { getNavidromeConfig, NAVIDROME_CONFIG_CHANGED } from '../../../services/navidromeService';
import { normalizePlaybackSongSource } from '../../../utils/appPlaybackGuards';
import AppPlaylistPanel from './AppPlaylistPanel';
// Production entry independent of platform collections; reads existing playback/search stores.
export interface AppPlaylistHostProps {
    theme: Theme;
    localSongs: LocalSong[];
    onPlay: (song: SongResult, queue: SongResult[]) => Promise<unknown>;
}
export default function AppPlaylistHost({ theme, localSongs, onPlay }: AppPlaylistHostProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [config, setConfig] = useState(getNavidromeConfig);
    useEffect(() => {
        const refresh = () => setConfig(getNavidromeConfig());
        window.addEventListener(NAVIDROME_CONFIG_CHANGED, refresh);
        window.addEventListener('storage', refresh);
        return () => {
            window.removeEventListener(NAVIDROME_CONFIG_CHANGED, refresh);
            window.removeEventListener('storage', refresh);
        };
    }, []);
    const current = usePlaybackStore(state => state.currentSong);
    const queue = usePlaybackStore(state => state.playQueue);
    const results = useSearchNavigationStore(state => state.searchResults);
    const normalize = (song: SongResult): UnifiedSong => normalizePlaybackSongSource(song);
    return <>
        <button className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-2xl border border-current/20 px-4 py-2 shadow-lg backdrop-blur-xl" style={{ color: theme.primaryColor, backgroundColor: theme.backgroundColor }} onClick={() => setOpen(true)}><ListMusic size={18} />{t('appPlaylists.title')}</button>
        {open && <AppPlaylistPanel theme={theme} currentSong={current ? normalize(current) : null} queue={queue.map(normalize)} searchResults={(results ?? []).map(normalize)} localSongs={localSongs} navidromeConfig={config} onPlay={onPlay} onClose={() => setOpen(false)} />}
    </>;
}
