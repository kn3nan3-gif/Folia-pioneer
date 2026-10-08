import React from 'react';
import LxSourceHost from '../../src/components/app/lxSources/LxSourceHost';
import type { Theme } from '../../src/types';
import type { ProbeDefinition } from './definition';
// Explicit IPC boundary mock; actual React management and reload persistence run in Chromium.
const theme = { primaryColor: '#eeeeee', backgroundColor: '#222222', accentColor: '#aaccff', secondaryColor: '#bbbbbb' } as Theme;
const read = () => JSON.parse(localStorage.getItem('lx-probe-records') || '[]');
const write = (records: unknown[]) => { localStorage.setItem('lx-probe-records', JSON.stringify(records)); return records; };
(window as any).electron = { lxSources: {
    list: async () => read(),
    importLocal: async () => write([{name:'Owned.js',digest:'a'.repeat(64),domains:[],qualities:[],enabled:false}]),
    enable: async (digest: string, domains: string[]) => write(read().map((r: any) => ({...r,enabled:r.digest===digest,domains,qualities:['128k']}))),
    disable: async () => write(read().map((r: any) => ({...r,enabled:false}))),
    remove: async (digest: string) => write(read().filter((r: any) => r.digest!==digest)),
} };
export default { id: 'lxSources', title: 'LX source management', description: 'Explicit grant and restart persistence UI with mocked IPC', Component: () => <LxSourceHost theme={theme} /> } satisfies ProbeDefinition;
