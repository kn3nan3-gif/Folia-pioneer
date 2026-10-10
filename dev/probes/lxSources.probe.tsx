import React from 'react';
import LxSourceHost from '../../src/components/app/lxSources/LxSourceHost';
import type { Theme } from '../../src/types';
import type { LxApproval } from '../../src/services/lxSources/bridge';
import type { ProbeDefinition } from './definition';
// Install mock only on mount; sibling gallery probes retain their own bridge.
const theme = { primaryColor: '#eeeeee', backgroundColor: '#222222', accentColor: '#aaccff', secondaryColor: '#bbbbbb' } as Theme;
const read = () => JSON.parse(localStorage.getItem('lx-probe-records') || '[]');
const write = (records: unknown[]) => { localStorage.setItem('lx-probe-records', JSON.stringify(records)); return records; };
const review = { digest: 'a'.repeat(64), version: 'lexical-1', riskVersion: 'browser-webrtc-1', method: 'lexical', findings: ['browser-network'], domains: ['owned.example'], platforms: ['wy'], apis: ['musicUrl'], limits: 'Lexical only; not a safety proof.' };
const listeners = new Set<(records: any[]) => void>();
const stop = (failure: string) => {
    const records = write(read().map((r: any) => ({ ...r, enabled: false, qualities: [], failure })));
    listeners.forEach(listener => listener(records));
};
let delayEnable = false, finishEnable: (() => void) | undefined;
const bridge = {
    onStateChanged: (listener: (records: any[]) => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    decideMedia: async (payload: unknown) => {
        localStorage.setItem('lx-probe-media-decision', JSON.stringify(payload));
        const records = write(read().map((r: any) => ({ ...r, mediaChallenges: [], mediaDomains: (payload as any).approved ? ['cdn.example'] : [] })));
        listeners.forEach(listener => listener(records)); return records;
    },
    list: async () => read(),
    importLocal: async () => write([{ name: 'Owned.js', digest: review.digest, domains: [], qualities: [], enabled: false, review }]),
    enable: async (digest: string, domains: string[], approval: LxApproval) => {
        if (approval.digest !== digest || approval.reviewVersion !== review.version || approval.riskVersion !== review.riskVersion || !approval.acknowledged) throw Error('approval mismatch');
        localStorage.setItem('lx-probe-approval', JSON.stringify(approval));
        const snapshot = write(read().map((r: any) => ({ ...r, failure: undefined, enabled: r.digest === digest, domains, qualities: ['128k'] })));
        if (delayEnable) { delayEnable = false; await new Promise<void>(resolve => { finishEnable = resolve; }); }
        return snapshot;
    },
    disable: async () => write(read().map((r: any) => ({ ...r, enabled: false }))),
    remove: async (digest: string) => write(read().filter((r: any) => r.digest !== digest)),
};
function Component() {
    (window as any).electron = { lxSources: bridge };
    return <><button onClick={() => {
        const records = write(read().map((r: any) => ({ ...r, mediaChallenges: [{ id: 'b'.repeat(64), digest: r.digest, hostname: 'cdn.example', origin: 'https://cdn.example', expires: Date.now() + 60000 }] })));
        listeners.forEach(listener => listener(records));
    }}>Probe media candidate</button><button onClick={() => { delayEnable = true; }}>Probe delay enable</button><button onClick={() => finishEnable?.()}>Probe finish enable</button><button onClick={() => stop('LX realm: native script error')}>Probe late fatal</button><button onClick={() => stop('LX: realm destroyed')}>Probe destroyed</button><button onClick={() => stop('LX: renderer gone')}>Probe renderer gone</button><LxSourceHost theme={theme} /></>;
}
export default { id: 'lxSources', title: 'LX source management', description: 'Explicit approval UI with mocked IPC', Component } satisfies ProbeDefinition;
