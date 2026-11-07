import { useTranslation } from 'react-i18next';
import { Check, RefreshCw, Save, X } from 'lucide-react';
import { ApiError } from '@fluxwp/core';
import { useAccount } from '@fluxwp/runtime';
import { useAiTools, type AiToolFilter, type AiToolRow } from '@fluxwp/runtime/src/modules/ai-tools';
import { ResizablePane, Select } from '@fluxwp/ui';
import './native-admin.css';
import './ai-tools.css';
import { useRoute } from '../state/route';

export function AiToolsScreen() { const account = useAccount(); const route = useRoute(s=>s.route); const source = 'params' in route ? route.params?.source ?? '' : ''; return <AiToolsView key={`${account.id}|${source}`} source={source}/>; }
function AiToolsView({source}:{source:string}) {
  const { t } = useTranslation(); const account = useAccount(); const c = useAiTools(source); const data = c.query.data;
  const unavailable = c.busy || c.query.isPlaceholderData;
  const visible = data?.items.filter(row => !row.dupe) ?? [];
  const selectedPage = visible.length > 0 && visible.every(row => c.isSelected(row.name));
  const enabled = (row: AiToolRow) => c.draft[row.name] ?? !row.off;
  const status = (row: AiToolRow) => row.dupe ? t('aiTools.duplicate') : enabled(row) ? t('aiTools.on') : t('aiTools.off');
  const pageError = c.query.error instanceof ApiError && c.query.error.status === 404 ? t('aiTools.updateRequired') : c.query.error instanceof Error ? c.query.error.message : t('states.errorTitle');
  return <div className="native-admin ai-tools" onKeyDown={event => { if (event.key === 'Escape' && c.detail) { c.setDetail(null); event.stopPropagation(); } }} data-testid="screen-ai-tools">
    <main className="native-admin-body ai-tools-main">
      <header className="page-head"><div><h1>{t('aiTools.title')}</h1><p className="muted">{t('aiTools.intro')}</p></div><button className="btn-ghost" disabled={c.busy} onClick={() => void c.reload()}><RefreshCw size={16}/>{t('aiTools.reload')}</button></header>
      {data && <div className="ai-tools-summary">{(['tools','on','off','conflicts','unprefixed'] as const).map(key => <div className="panel" key={key}><span>{t(`aiTools.${key}`)}</span><strong>{data.summary[key]}</strong></div>)}</div>}
      <div className="ai-tools-filters">
        <label className="field">{t('aiTools.search')}<input type="search" value={c.search} onChange={event => c.setSearch(event.target.value)} placeholder={t('aiTools.searchPlaceholder')} disabled={c.busy}/></label>
        <label className="field">{t('aiTools.source')}<Select value={c.filter.source} disabled={c.busy} onChange={event => c.setFilter({ source: event.target.value })}><option value="">{t('aiTools.allSources')}</option>{data?.sources.filter(source => source.id).map(source => <option key={source.id} value={source.id}>{source.label} ({source.on}/{source.total})</option>)}</Select></label>
        <label className="field">{t('aiTools.kind')}<Select value={c.filter.kind} disabled={c.busy} onChange={event => c.setFilter({ kind: event.target.value as AiToolFilter['kind'] })}>{(['','read','write'] as const).map(value => <option key={value} value={value}>{t(value ? `aiTools.${value}` : 'aiTools.all')}</option>)}</Select></label>
        <label className="field">{t('aiTools.state')}<Select value={c.filter.state} disabled={c.busy} onChange={event => c.setFilter({ state: event.target.value as AiToolFilter['state'] })}>{(['','on','off','conflict','noprefix'] as const).map(value => <option key={value} value={value}>{t(value ? `aiTools.${value}` : 'aiTools.all')}</option>)}</Select></label>
      </div>
      {c.error && <p className="error" role="alert">{c.error}</p>}
      {c.stale && <p className="notice warn" role="alert">{t('aiTools.stale')}</p>}
      {c.query.isError && <p className="error" role="alert">{pageError}</p>}
      <div className="ai-tools-actions"><span aria-live="polite">{c.query.isFetching ? t('states.loading') : t('aiTools.results',{ count:data?.total??0 })}</span><button className="btn-ghost small" disabled={unavailable || !data?.selectable_total || c.search !== c.filter.q} onClick={c.setMatching}>{t('aiTools.selectMatching',{ count:data?.selectable_total??0 })}</button>{c.selectionCount > 0 && <><strong>{t('aiTools.selected',{ count:c.selectionCount })}</strong><button className="btn-ghost small" disabled={unavailable || c.stale} onClick={() => void c.save('enable')}>{t('aiTools.enable')}</button><button className="btn-ghost small" disabled={unavailable || c.stale} onClick={() => void c.save('disable')}>{t('aiTools.disable')}</button><button className="btn-ghost small" disabled={c.busy} onClick={c.clearSelection}>{t('aiTools.clear')}</button></>}</div>
      <div className="native-table-scroll" aria-busy={c.query.isFetching}><table className="native-matrix ai-tools-table"><thead><tr><th><input type="checkbox" aria-label={t('aiTools.selectPage')} checked={selectedPage} disabled={unavailable || !visible.length} onChange={event => c.selectPage(event.target.checked)}/></th><th>{t('aiTools.enabled')}</th><th>{t('aiTools.tool')}</th><th>{t('aiTools.source')}</th><th>{t('aiTools.kind')}</th><th>{t('aiTools.where')}</th><th>{t('aiTools.cap')}</th><th>{t('aiTools.usage')}</th></tr></thead><tbody>
        {data?.items.map(row => <tr key={row.id} className={row.dupe ? 'ai-tool-dupe' : undefined}>
          <td>{!row.dupe && <input type="checkbox" checked={c.isSelected(row.name)} disabled={unavailable} aria-label={t('aiTools.selectTool',{name:row.title})} onChange={event => c.select(row.name,event.target.checked)}/>}</td>
          <td>{row.dupe ? <button className="btn-ghost small" disabled={unavailable || !!c.dirty} onClick={() => void c.save('pick',row)}>{t('aiTools.useDefinition')}</button> : <input type="checkbox" checked={enabled(row)} disabled={unavailable} aria-label={t('aiTools.enabledTool',{name:row.title})} onChange={event => c.toggle(row,event.target.checked)}/>}</td>
          <th scope="row"><button className="ai-tool-title" disabled={unavailable} onClick={() => c.setDetail(row)}><strong>{row.title}</strong><code>{row.name}</code></button><small>{row.description}</small><span className="ai-tool-status">{status(row)}{!row.prefixed && ` · ${t('aiTools.noprefix')}`}</span></th>
          <td>{row.label}<code>{row.source}</code></td><td>{t(row.readonly ? 'aiTools.read' : 'aiTools.write')}{row.approval && <small>{t('aiTools.approval')}</small>}</td><td>{[row.mcp?'MCP':'',row.chat?t('aiTools.chat'):''].filter(Boolean).join(' · ')||'—'}</td><td><code>{row.cap||'—'}</code></td><td>{row.usage ? <>{row.usage.n}<small>{Math.round(row.usage.avg_ms)} ms</small></> : '—'}</td>
        </tr>)}
        {!data?.items.length && <tr><td colSpan={8}>{c.query.isPending ? t('states.loading') : t('aiTools.empty')}</td></tr>}
      </tbody></table></div>
      <div className="ai-tools-actions"><button className="btn-ghost" disabled={unavailable || c.page<=1} onClick={() => c.setPage(c.page-1)}>{t('aiTools.previous')}</button><span>{t('aiTools.page',{page:c.page,pages:data?.pages??1})}</span><button className="btn-ghost" disabled={unavailable || !data || c.page>=data.pages} onClick={() => c.setPage(c.page+1)}>{t('aiTools.next')}</button><span className="grow"/><button className="btn-primary" disabled={unavailable || !c.dirty || c.stale} onClick={() => void c.save('save')}><Save size={16}/>{t('aiTools.save')}</button></div>
      {!!c.dirty && <p className="muted small">{t('aiTools.dirty',{count:c.dirty})}</p>}
      <p className="muted small">{t('aiTools.registrationHint')}</p>
    </main>
    {c.detail && <ResizablePane storageKey={`flux.pane.${account.id}.ai-tool-detail`} initialWidth={340} minWidth={260} maxWidth={600} minContentWidth={360} edge="left" label={t('aiTools.resize')} className="ai-tools-detail">
      <header className="page-head"><h2>{c.detail.title}</h2><button className="icon-btn" aria-label={t('common.close')} onClick={() => c.setDetail(null)}><X size={18}/></button></header>
      <code>{c.detail.name}</code><p>{c.detail.description}</p><dl><dt>{t('aiTools.source')}</dt><dd>{c.detail.label} · {c.detail.source}</dd><dt>{t('aiTools.state')}</dt><dd>{status(c.detail)}</dd><dt>{t('aiTools.cap')}</dt><dd>{c.detail.cap||'—'}</dd><dt>{t('aiTools.aliases')}</dt><dd>{c.detail.aliases.join(', ')||'—'}</dd><dt>{t('aiTools.rivals')}</dt><dd>{c.detail.rivals.join(', ')||'—'}</dd></dl>
      {c.detail.approval && <p className="notice warn"><Check size={16}/>{t('aiTools.approval')}</p>}{c.detail.dupe && <button className="btn-primary" disabled={unavailable || !!c.dirty} onClick={() => void c.save('pick',c.detail!)}>{t('aiTools.useDefinition')}</button>}{!!c.dirty && <p className="muted small">{t('aiTools.saveBeforePick')}</p>}
    </ResizablePane>}
  </div>;
}
