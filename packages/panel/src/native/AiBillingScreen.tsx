import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, RefreshCw, Wallet } from 'lucide-react';
import { useAccount } from '@fluxwp/runtime';
import { billingNumber, useAiBilling, type AiBillingRow } from '@fluxwp/runtime/src/modules/ai-billing';
import { ResizablePane } from '@fluxwp/ui';
import './native-admin.css';
import './ai-billing.css';

export function AiBillingScreen() {
  const { t, i18n } = useTranslation(); const account = useAccount();
  const { query, setMonth, credits, refreshCredits, exportReport } = useAiBilling();
  const [exporting, setExporting] = useState(false); const [error, setError] = useState('');
  const locale = i18n.resolvedLanguage || i18n.language;
  const money = (value: number | string | null) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(billingNumber(value));
  const number = (value: number | string) => new Intl.NumberFormat(locale).format(billingNumber(value));
  const exportCsv = async () => {
    if (exporting) return; setExporting(true); setError('');
    try {
      const result = await exportReport();
      const url = URL.createObjectURL(new Blob([result.csv], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = result.filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setExporting(false); }
  };
  if (query.isPending) return <div className="page" role="status">{t('states.loading')}</div>;
  if (query.isError || !query.data) return <div className="page"><h1>{t('aiBilling.title')}</h1><p className="error" role="alert">{query.error instanceof Error ? query.error.message : t('states.errorTitle')}</p><button className="btn-ghost" onClick={() => void query.refetch()}>{t('common.retry')}</button></div>;
  const data = query.data; const report = data.month;
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${report.ym}-01T12:00:00Z`));
  const maximum = Math.max(...report.daily.map(day => day.cost), 0.0001);
  const breakdown = (title: string, rows: AiBillingRow[], provider = false) => <section className="panel"><h2>{title}</h2><div className="native-table-scroll"><table className="native-matrix"><thead><tr><th scope="col">{t('aiBilling.name')}</th><th scope="col">{t('aiBilling.calls')}</th><th scope="col">{t('aiBilling.input')}</th><th scope="col">{t('aiBilling.output')}</th><th scope="col">{t('aiBilling.fullCost')}</th><th scope="col">{t('aiBilling.cost')}</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.k}><th scope="row">{row.label}{provider && billingNumber(row.est) > 0 && <small>{t('aiBilling.estimated')}</small>}</th><td>{number(row.calls)}</td><td>{number(row.in_tok)}</td><td>{number(row.out_tok)}</td><td>{money(row.full_cost)}</td><td><strong>{money(row.cost)}</strong></td></tr>) : <tr><td colSpan={6}>{t('aiBilling.empty')}</td></tr>}</tbody></table></div></section>;
  return <div className="native-admin split ai-billing" data-testid="screen-ai-billing">
    <ResizablePane className="native-admin-nav" storageKey={`flux.pane.${account.id}.ai-billing`} initialWidth={240} minWidth={200} maxWidth={380} minContentWidth={440} label={t('aiBilling.resize')}>
      <header><Wallet size={22}/><h1>{t('aiBilling.months')}</h1></header>
      <nav aria-label={t('aiBilling.months')}>{data.months.map(month => <button type="button" key={month.ym} className={report.ym === month.ym ? 'on' : ''} aria-current={report.ym === month.ym ? 'page' : undefined} onClick={() => setMonth(month.ym)}><strong>{new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month.ym}-01T12:00:00Z`))}</strong><span>{money(month.cost)}</span></button>)}</nav>
    </ResizablePane>
    <main className="native-admin-body" aria-busy={query.isFetching}>
      <header className="page-head"><div><h1>{t('aiBilling.title')}</h1><p className="muted">{t('aiBilling.intro')}</p></div><button className="btn-ghost" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw size={16}/>{t('aiBilling.refresh')}</button></header>
      <div className="ai-billing-budgets">{(['day', 'week', 'month'] as const).map(period => { const budget = data.budget[period]; return <section key={period} className={`panel${budget.over ? ' ai-budget-over' : ''}`}><h2>{t(`aiBilling.${period}`)}</h2><strong>{money(budget.spent)} / {budget.limit > 0 ? money(budget.limit) : t('aiBilling.unlimited')}</strong>{budget.limit > 0 && <progress max={100} value={Math.min(100, budget.pct)} aria-label={t(`aiBilling.${period}`)}/>}<p className="muted small">{t('aiBilling.resets', { time: new Date(budget.resets * 1000).toLocaleString(locale) })}</p></section>; })}</div>
      <section className="panel"><header className="page-head"><h2>{monthLabel}</h2><button className="btn-ghost" disabled={exporting || !data.export_available} onClick={() => void exportCsv()}><Download size={16}/>{exporting ? t('states.loading') : t('aiBilling.export')}</button></header>
        {!data.export_available && <p className="muted">{t('aiBilling.exportUpdate')}</p>}{error && <p className="error" role="alert">{error}</p>}
        <div className="ai-billing-kpis"><div><span>{t('aiBilling.cost')}</span><strong>{money(report.totals.cost)}</strong><small>{t('aiBilling.withoutCache', { amount: money(report.totals.full_cost) })}</small></div><div><span>{t('aiBilling.saved')}</span><strong>{money(report.totals.saved)}</strong><small>{report.totals.full_cost > 0 ? `${number(Math.round(report.totals.saved / report.totals.full_cost * 1000) / 10)}%` : '—'}</small></div><div><span>{t('aiBilling.calls')}</span><strong>{number(report.totals.calls)}</strong></div></div>
        <h3>{t('aiBilling.daily')}</h3><div className="ai-billing-chart" role="list" aria-label={t('aiBilling.daily')}>{report.daily.map(day => <div role="listitem" key={day.date} title={`${day.date}: ${money(day.cost)}`} aria-label={`${day.date}: ${money(day.cost)}, ${number(day.calls)} ${t('aiBilling.calls')}`}><div className="ai-billing-bar" style={{ height: `${day.cost / maximum * 100}%` }}/><small>{day.date.slice(-2)}</small></div>)}</div>
      </section>
      {breakdown(t('aiBilling.providers'), report.by_provider, true)}
      {breakdown(t('aiBilling.sources'), report.by_source)}
      {breakdown(t('aiBilling.models'), report.by_model)}
      <section className="panel"><header className="page-head"><h2>{t('aiBilling.creditsTitle')}</h2><button className="btn-ghost" onClick={refreshCredits} disabled={credits.isPending}><RefreshCw size={16}/>{t('aiBilling.refresh')}</button></header>{credits.error && <p className="error" role="alert">{credits.error.message}</p>}{data.credits ? <dl className="ai-billing-credit-values">{(['credits', 'usage', 'limit', 'remaining'] as const).map(key => data.credits![key] !== null && <div key={key}><dt>{t(`aiBilling.${key}`)}</dt><dd>{money(data.credits![key])}</dd></div>)}<div><dt>{t('aiBilling.checked')}</dt><dd>{new Date(data.credits.checked * 1000).toLocaleString(locale)}</dd></div></dl> : <p className="muted">{t('aiBilling.creditsHint')}</p>}</section>
    </main>
  </div>;
}
