import React from 'react';
import { useTranslation } from 'react-i18next';
import type { LxReview } from '../../../services/lxSources/bridge';
// Show main-derived hints and their limits; absence of a flag is not approval.
export default function LxReviewReport({ review }: { review: LxReview }) {
    const { t } = useTranslation();
    return <section className="my-3 rounded-xl border border-current/20 p-3 text-sm">
        <h4>{t('lxSources.review')} · {review.version}</h4>
        <p>{t('lxSources.risk')}</p>
        <p>{t('lxSources.lexicalLimits')}</p>
        <dl className="my-2 break-words">
            <dt>{t('lxSources.findings')}</dt><dd>{review.findings.join(', ') || '—'}</dd>
            <dt>{t('lxSources.detectedDomains')}</dt><dd>{review.domains.join(', ') || '—'}</dd>
            <dt>{t('lxSources.detectedApis')}</dt><dd>{[...review.platforms, ...review.apis].join(', ') || '—'}</dd>
        </dl>
        <p className="opacity-70">{review.limits}</p>
    </section>;
}
