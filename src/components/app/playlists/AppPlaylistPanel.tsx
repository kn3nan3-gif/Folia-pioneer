import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUp, ArrowDown, Trash2, Play, X } from 'lucide-react';
import type { Theme, UnifiedSong, LocalSong } from '../../../types';
import type { NavidromeConfig } from '../../../types/navidrome';
import { useAppPlaylistStore } from '../../../stores/useAppPlaylistStore';
import { getNavidromeConfig, NAVIDROME_CONFIG_CHANGED } from '../../../services/navidromeService';
import { resolvePlaylist } from '../../../services/appPlaylists/resolve';
import { exportPlaylist } from '../../../services/appPlaylists/json';
import { getPlaybackSongKey } from '../../../utils/appPlaybackGuards';
// Application-owned list editor. Playback is delegated to the existing unified controller.
export interface AppPlaylistPanelProps {
    theme: Theme;
    currentSong: UnifiedSong | null;
    queue: UnifiedSong[];
    searchResults: UnifiedSong[];
    localSongs: LocalSong[];
    navidromeConfig: NavidromeConfig | null;
    onPlay: (song: UnifiedSong, queue: UnifiedSong[]) => Promise<unknown>;
    onClose: () => void;
}
export default function AppPlaylistPanel(props: AppPlaylistPanelProps) {
    const { t } = useTranslation();
    const state = useAppPlaylistStore();
    const [selected, select] = useState('');
    const [name, setName] = useState('');
    const [json, setJson] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [missing, setMissing] = useState<string[]>([]);
    const [unknown, setUnknown] = useState<string[]>([]);
    const [playing, setPlaying] = useState(false);
    const list = state.lists.find(item => item.id === selected) ?? state.lists[0];
    const generation = useRef(0);
    const configKey = JSON.stringify(props.navidromeConfig);
    // Resolver inputs only: list name/timestamps and fresh equivalent objects do not cancel play.
    const entriesKey = JSON.stringify(list?.entries);
    const invalidate = () => { ++generation.current; setPlaying(false); };
    useLayoutEffect(() => {
        invalidate();
        // Observe durable store commits synchronously, including before React renders the new entries.
        const unsubscribe = useAppPlaylistStore.subscribe(next => {
            if (JSON.stringify(next.lists.find(item => item.id === list?.id)?.entries) !== entriesKey) invalidate();
        });
        return () => { unsubscribe(); ++generation.current; };
    }, [list?.id, entriesKey, configKey]);
    useEffect(() => {
        const changed = () => invalidate();
        window.addEventListener(NAVIDROME_CONFIG_CHANGED, changed);
        window.addEventListener('storage', changed);
        return () => {
            ++generation.current;
            window.removeEventListener(NAVIDROME_CONFIG_CHANGED, changed);
            window.removeEventListener('storage', changed);
        };
    }, []);
    useEffect(() => { void state.load().catch(() => {}); }, [state.load]);
    useEffect(() => { setName(list?.name ?? ''); setMissing([]); setUnknown([]); }, [list?.id]);
    const act = (task: () => Promise<unknown>) => { setError(null); void task().catch(e => setError(e instanceof Error ? e.message : String(e))); };
    const add = (songs: UnifiedSong[]) => list && act(() => state.run(service => service.add(list.id, songs)));
    const move = (index: number, delta: number) => {
        if (!list) return;
        const keys = list.entries.map(entry => entry.key);
        [keys[index], keys[index + delta]] = [keys[index + delta], keys[index]];
        act(() => state.run(service => service.reorder(list.id, keys)));
    };
    const play = async () => {
        if (!list) return;
        const request = ++generation.current;
        const storedConfigKey = JSON.stringify(getNavidromeConfig());
        const isCurrent = () => request === generation.current
            && entriesKey === JSON.stringify(useAppPlaylistStore.getState().lists.find(item => item.id === list.id)?.entries)
            && storedConfigKey === JSON.stringify(getNavidromeConfig());
        setPlaying(true);
        try {
            const result = await resolvePlaylist(list.entries, props);
            if (!isCurrent()) return;
            setMissing(result.unavailable.map(item => item.key));
            setUnknown(result.unknown.map(item => item.key));
            if (result.songs.length && isCurrent()) await props.onPlay(result.songs[0], result.songs);
        } catch (e) {
            if (isCurrent()) setError(e instanceof Error ? e.message : String(e));
        } finally { if (request === generation.current) setPlaying(false); }
    };
    const buttonClass = 'rounded-xl border border-current/20 px-3 py-2 hover:bg-current/10 disabled:opacity-40';
    return <section role="dialog" aria-modal="true" aria-label={t('appPlaylists.title')} className="fixed inset-4 z-[100] mx-auto max-w-4xl overflow-auto rounded-3xl border border-current/20 p-6 shadow-2xl backdrop-blur-xl" style={{ color: props.theme.primaryColor, backgroundColor: props.theme.backgroundColor }}>
        <header className="flex items-center justify-between"><h2 className="text-2xl">{t('appPlaylists.title')}</h2><button aria-label={t('appPlaylists.close')} onClick={() => { invalidate(); props.onClose(); }}><X /></button></header>
        <p className="my-3 text-sm opacity-70">{t('appPlaylists.hint')}</p>
        {(error || state.error) && <p role="alert">{t('appPlaylists.error', { message: error || state.error })}</p>}
        {missing.length > 0 && <p role="status">{t('appPlaylists.missing', { count: missing.length })}</p>}
        {unknown.length > 0 && <p role="status">{t('appPlaylists.unknown', { count: unknown.length })}</p>}
        <fieldset disabled={state.busy || playing} className="space-y-4">
            <div className="flex flex-wrap gap-2">
                <input className={buttonClass} aria-label={t('appPlaylists.name')} value={name} onChange={e => setName(e.target.value)} />
                <button className={buttonClass} onClick={() => act(() => state.run(async service => { const created = await service.create(name); select(created.id); }))}>{t('appPlaylists.create')}</button>
                <select className={buttonClass} aria-label={t('appPlaylists.select')} value={list?.id ?? ''} onChange={e => { invalidate(); select(e.target.value); }}>{state.lists.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                <button className={buttonClass} disabled={!list} onClick={() => list && act(() => state.run(service => service.rename(list.id, name)))}>{t('appPlaylists.rename')}</button>
                <button className={buttonClass} disabled={!list} onClick={() => list && window.confirm(t('appPlaylists.confirm')) && act(() => state.run(service => service.delete(list.id)))}>{t('appPlaylists.delete')}</button>
            </div>
            <div className="flex flex-wrap gap-2">
                <button className={buttonClass} disabled={!list || !props.currentSong} onClick={() => props.currentSong && add([props.currentSong])}>{t('appPlaylists.current')}</button>
                <button className={buttonClass} disabled={!list || !props.queue.length} onClick={() => add(props.queue)}>{t('appPlaylists.queue')}</button>
                <button className={buttonClass} disabled={!list?.entries.length} onClick={() => act(play)}><Play className="inline" size={16} /> {t('appPlaylists.play')}</button>
            </div>
            {!list && <p>{t('appPlaylists.empty')}</p>}
            <ol className="space-y-2">{list?.entries.map((entry, index) => <li data-testid="playlist-entry" key={entry.key} className="flex items-center gap-3 rounded-xl border border-current/10 p-3">
                <span className="flex-1">{entry.snapshot.name} <small className="opacity-60">{entry.sourceRef.kind === 'online' ? entry.sourceRef.providerId : entry.sourceRef.kind}</small>{missing.includes(entry.key) && <span> ⚠</span>}{unknown.includes(entry.key) && <span> ?</span>}</span>
                <button aria-label={t('appPlaylists.up')} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={18} /></button>
                <button aria-label={t('appPlaylists.down')} disabled={index === list.entries.length - 1} onClick={() => move(index, 1)}><ArrowDown size={18} /></button>
                <button aria-label={t('appPlaylists.remove')} onClick={() => act(() => state.run(service => service.remove(list.id, entry.key)))}><Trash2 size={18} /></button>
            </li>)}</ol>
            <details><summary>{t('appPlaylists.search')}</summary><ul>{props.searchResults.map(song => <li className="flex justify-between p-2" key={getPlaybackSongKey(song)}>{song.name}<button disabled={!list} className={buttonClass} onClick={() => add([song])}>{t('appPlaylists.add')}</button></li>)}</ul></details>
            <div className="flex gap-2"><button className={buttonClass} disabled={!list} onClick={() => { try { if (list) setJson(exportPlaylist(list)); } catch (e) { setError(String(e)); } }}>{t('appPlaylists.export')}</button>
                <button className={buttonClass} onClick={() => act(() => state.run(async service => { const imported = await service.importJson(json); select(imported.id); }))}>{t('appPlaylists.import')}</button></div>
            <textarea className={`${buttonClass} w-full min-h-40 font-mono text-sm`} aria-label={t('appPlaylists.json')} value={json} onChange={e => setJson(e.target.value)} />
        </fieldset>
    </section>;
}
