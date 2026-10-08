import type { SongResult } from '../../types';
import type { AudioQualityPreference, OmniAudioSource } from '../../types/onlineMusic';
import { getPlaybackSourceRef } from '../../utils/appPlaybackGuards';
// Desktop bridge returns null ONLY when disabled or outside the wy mapping.
export interface LxReview { digest: string; version: string; riskVersion: string; method: string; findings: string[]; domains: string[]; platforms: string[]; apis: string[]; limits: string }
export interface LxApproval { digest: string; reviewVersion: string; riskVersion: string; acknowledged: true }
export interface LxSourceRecord { name: string; digest: string; domains: string[]; enabled: boolean; qualities: string[]; failure?: string; review: LxReview }
export interface LxSourceBridge {
    onStateChanged(callback: (records: LxSourceRecord[]) => void): () => void;
    list(): Promise<LxSourceRecord[]>;
    importLocal(): Promise<LxSourceRecord[]>;
    enable(digest: string, domains: string[], approval: LxApproval): Promise<LxSourceRecord[]>;
    disable(): Promise<LxSourceRecord[]>;
    remove(digest: string): Promise<LxSourceRecord[]>;
    resolve(song: { providerId: string; mediaId: string; name: string; singer: string; interval: string }, quality: AudioQualityPreference): Promise<OmniAudioSource | null>;
}
export function getLxBridge(): LxSourceBridge | undefined {
    if (typeof window === 'undefined') return undefined;
    return (window.electron as unknown as { lxSources?: LxSourceBridge } | undefined)?.lxSources;
}
export async function resolveLxAudio(song: SongResult, quality: AudioQualityPreference): Promise<OmniAudioSource | null> {
    const ref = getPlaybackSourceRef(song);
    if (ref?.kind !== 'online' || ref.providerId !== 'netease') return null;
    return await getLxBridge()?.resolve({ providerId: ref.providerId, mediaId: ref.mediaId,
        name: song.name, singer: song.artists.map(a => a.name).join('、'), interval: String(song.durationMs / 1000),
    }, quality) ?? null;
}
