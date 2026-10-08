import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useSearchNavigationStore } from '../../../stores/useSearchNavigationStore';
import { omni } from '../../../services/onlineMusic/omni';
// Independent aggregate progress and actions; never restart successful sources on retry.
export default function SearchProviderStatus() {
    const { t } = useTranslation();
    const sources = useSearchNavigationStore(state => state.aggregateSources);
    const load = useSearchNavigationStore(state => state.loadAggregateSource);
    return <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto py-2" aria-live="polite">
        {Object.values(sources).map(source => <div key={source.providerId} data-search-provider={source.providerId}
            className="flex items-center gap-2 rounded-2xl border border-current/10 px-3 py-2 text-xs">
            <span>{omni.getProviderLabel(source.providerId)}</span>
            <span className="opacity-60">{t('search.sourceCount', { count: source.items.length })}</span>
            {source.loading ? <span className="flex items-center gap-1"><Loader2 size={12} className="animate-spin" />{t('search.sourceLoading')}</span>
                : source.error ? <><span className="opacity-60">{t(source.error === 'search_timeout' ? 'search.sourceTimeout' : 'search.error')}</span>
                    <button type="button" className="rounded-full border border-current/15 px-2 py-1" onClick={() => void load(source.providerId)}>{t('search.retry')}</button></>
                    : source.hasMore ? <button type="button" className="rounded-full border border-current/15 px-2 py-1" onClick={() => void load(source.providerId)}>{t('home.loadMore')}</button>
                        : <span className="opacity-50">{t('search.sourceComplete')}</span>}
        </div>)}
        {Object.keys(sources).length === 0 && <span className="text-xs opacity-60">{t('search.sourcesChanged')}</span>}
    </div>;
}
