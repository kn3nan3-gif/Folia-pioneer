import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Radio, X } from 'lucide-react';
import type { Theme } from '../../../types';
import { getLxBridge, type LxSourceRecord } from '../../../services/lxSources/bridge';
// Native import and grants are main-owned; dangerous enable/remove actions have no shortcut.
export const LX_SOURCES_OPEN = 'folia-lx-open';
export default function LxSourceHost({ theme }: { theme: Theme }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false), [records, setRecords] = useState<LxSourceRecord[]>([]);
    const [domains, setDomains] = useState<Record<string, string>>({}), [approved, setApproved] = useState<Record<string, boolean>>({});
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const bridge = getLxBridge();
    useEffect(() => { const show = () => setOpen(true); window.addEventListener(LX_SOURCES_OPEN, show); return () => window.removeEventListener(LX_SOURCES_OPEN, show); }, []);
    const run = async (action: () => Promise<LxSourceRecord[]>) => {
        setBusy(true); setError('');
        try { setRecords(await action()); } catch (error) { setError(String(error instanceof Error ? error.message : error)); }
        finally { setBusy(false); }
    };
    useEffect(() => { if (open && bridge) void run(() => bridge.list()); }, [open, bridge]);
    if (!bridge) return null;
    return <>
        <button className="fixed bottom-20 left-6 z-50 flex items-center gap-2 rounded-2xl border border-current/20 px-4 py-2 backdrop-blur-xl" style={{ color: theme.primaryColor, backgroundColor: theme.backgroundColor }} onClick={() => setOpen(true)}><Radio size={18} />{t('lxSources.title')}</button>
        {open && <section role="dialog" aria-label={t('lxSources.title')} className="fixed inset-8 z-[100] overflow-auto rounded-3xl border border-current/20 p-6 shadow-2xl" style={{ color: theme.primaryColor, backgroundColor: theme.backgroundColor }}>
            <div className="flex items-center justify-between"><h2>{t('lxSources.title')}</h2><button aria-label={t('lxSources.close')} onClick={() => setOpen(false)}><X /></button></div>
            <p className="my-4 opacity-70">{t('lxSources.hint')}</p>
            <button disabled={busy} onClick={() => void run(() => bridge.importLocal())}>{t('lxSources.import')}</button>
            {error && <p role="alert">{error}</p>}
            {records.map(record => <article key={record.digest} className="my-4 rounded-2xl border border-current/20 p-4">
                <h3>{record.name} · {record.enabled ? t('lxSources.enabled') : t('lxSources.disabled')}</h3>
                <code className="block break-all text-xs">SHA-256: {record.digest}</code>
                <p>{record.qualities.join(' / ')}</p>
                <label className="my-3 block">{t('lxSources.domains')}<input aria-label={`${record.name} ${t('lxSources.domains')}`} className="ml-3 border border-current/20 bg-transparent p-2" value={domains[record.digest] ?? record.domains.join(', ')} onChange={e => { setDomains({ ...domains, [record.digest]: e.target.value }); setApproved({ ...approved, [record.digest]: false }); }} /></label>
                <label className="block"><input type="checkbox" checked={approved[record.digest] ?? false} onChange={e => setApproved({ ...approved, [record.digest]: e.target.checked })} /> {t('lxSources.authorize')}</label>
                <div className="mt-3 flex gap-6">
                    <button disabled={busy || (!record.enabled && !approved[record.digest])} onClick={() => void run(() => record.enabled ? bridge.disable() : bridge.enable(record.digest, (domains[record.digest] ?? record.domains.join(',')).split(',').map(s => s.trim()).filter(Boolean)))}>{record.enabled ? t('lxSources.disable') : t('lxSources.enable')}</button>
                    <button disabled={busy} onClick={() => { if (window.confirm(t('lxSources.removeConfirm'))) void run(() => bridge.remove(record.digest)); }}>{t('lxSources.remove')}</button>
                </div>
            </article>)}
        </section>}
    </>;
}
