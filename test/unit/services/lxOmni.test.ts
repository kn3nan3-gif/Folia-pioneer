import { describe, it, expect, vi, beforeEach } from 'vitest';
import { omni } from '../../../src/services/onlineMusic/omni';
import { requireOnlineMusicProvider } from '../../../src/services/onlineMusic/providerRegistry';
import type { SongResult } from '../../../src/types';
// Real Omni with only the transport bridge and provider audio endpoint replaced.
const song = { id: 123, name: 'Own fixture', artists: [{ id: 1, name: 'Own' }], album: { id: 1, name: 'Own' }, durationMs: 1000, sourceRef: { kind: 'online', providerId: 'netease', mediaId: '123' } } as SongResult;
describe('LX Omni routing', () => {
    beforeEach(() => { vi.restoreAllMocks(); Object.defineProperty(globalThis, 'window', { configurable: true, value: {} }); });
    it('resolves before provider audio and preserves identity', async () => {
        const provider = vi.spyOn(requireOnlineMusicProvider('netease').playback!, 'getAudioSource');
        const resolve = vi.fn().mockResolvedValue({url:'https://own.example/a',providerId:'netease',quality:'standard'});
        (window as any).electron = {lxSources:{resolve}};
        expect((await omni.getAudioSource(song, 'standard'))?.url).toBe('https://own.example/a');
        expect(provider).not.toHaveBeenCalled(); expect(resolve.mock.calls[0][0].mediaId).toBe('123');
        expect(song.sourceRef).toEqual({kind:'online',providerId:'netease',mediaId:'123'});
    });
    it('enabled failure is not a provider fallback; disabled uses original path', async () => {
        const provider = vi.spyOn(requireOnlineMusicProvider('netease').playback!, 'getAudioSource').mockResolvedValue(null);
        (window as any).electron = {lxSources:{resolve:vi.fn().mockRejectedValue(new Error('LX: timeout'))}};
        await expect(omni.getAudioSource(song,'high')).rejects.toThrow('LX: timeout'); expect(provider).not.toHaveBeenCalled();
        (window as any).electron.lxSources.resolve = vi.fn().mockResolvedValue(null);
        expect(await omni.getAudioSource(song,'high')).toBeNull(); expect(provider).toHaveBeenCalledOnce();
    });
});
