import { useTranslation } from 'react-i18next';
import { Copy, RefreshCw, X } from 'lucide-react';
import { useAccount } from '@fluxwp/runtime';
import { useAiMcp } from '@fluxwp/runtime/src/modules/ai-mcp';
import { ResizablePane, Select } from '@fluxwp/ui';
import './native-admin.css';
import './ai-mcp.css';

export function AiMcpScreen(){const account=useAccount();return <McpView key={account.id}/>;}
function McpView(){
 const {t,i18n}=useTranslation();const c=useAiMcp();const s=c.state;const locked=c.busy||!!s?.legacy;const date=(at:number)=>at?new Date(at*1000).toLocaleString(i18n.language):t('aiMcp.never');
 const copy=(label:string,value:string)=><button className="btn-ghost small" onClick={()=>void c.copy(value)}><Copy size={15}/>{label}</button>;
 return <div className="native-admin split ai-mcp" data-testid="screen-ai-mcp">
  <ResizablePane storageKey={`flux.pane.${c.account.id}.ai-mcp`} initialWidth={320} minWidth={250} maxWidth={500} minContentWidth={400} label={t('aiMcp.resize')} className="ai-mcp-create"><div className="ai-mcp-create-scroll">
   <h2>{t('aiMcp.create')}</h2><p className="muted small">{t('aiMcp.ownerHelp')}</p>
   <label className="field">{t('aiMcp.name')}<input value={c.form.name} disabled={locked||!!c.created} onChange={e=>c.edit({name:e.target.value})}/></label>
   <label className="field">{t('aiMcp.scope')}<Select value={c.form.scope} disabled={locked||!!c.created} onChange={e=>c.edit({scope:e.target.value as 'selected'|'all'})}><option value="selected">{t('aiMcp.selected')}</option><option value="all">{t('aiMcp.all')}</option></Select></label>
   {c.form.scope==='all'?<p className="notice warn">{t('aiMcp.allHelp')}</p>:<>
    <label className="field">{t('aiMcp.search')}<input type="search" value={c.search} onChange={e=>c.setSearch(e.target.value)}/></label><p className="muted small">{t('aiMcp.selectedCount',{count:c.form.tools.length})}</p>
    <div className="ai-mcp-tool-list">{c.filteredTools.map(tool=><label className="ai-mcp-tool" key={tool.name}><input type="checkbox" checked={c.form.tools.includes(tool.name)} disabled={locked||!!c.created} onChange={()=>c.select(tool.name)}/><span><strong>{tool.title}</strong><code>{tool.name}</code><small>{tool.label} · {t(tool.readonly?'aiMcp.read':'aiMcp.write')}{tool.off?` · ${t('aiMcp.disabled')}`:''}{!tool.allowed?` · ${t('aiMcp.noPermission')}`:''}</small><small>{tool.description}</small></span></label>)}{!c.filteredTools.length&&<p className="muted">{t('aiMcp.noTools')}</p>}</div>
   </>}
   {c.stale&&<p className="notice warn" role="alert">{t('aiMcp.stale')}</p>}
   <div className="row"><button className="btn-primary" disabled={locked||!s||c.stale||!!c.created||c.form.scope==='selected'&&!c.form.tools.length} onClick={()=>void c.create()}>{t('aiMcp.create')}</button><button className="btn-ghost" disabled={c.busy||!!c.created} onClick={c.reset}>{t('aiMcp.reset')}</button></div>
  </div></ResizablePane>
  <main className="native-admin-body">
   <header className="page-head"><div><h1>{t('aiMcp.title')}</h1><p className="muted">{t('aiMcp.intro')}</p></div><button className="btn-ghost" disabled={c.busy} onClick={()=>void c.reload()}><RefreshCw size={16}/>{t('aiTools.reload')}</button></header>
   {c.query.isPending&&<p role="status">{t('states.loading')}</p>}{c.query.isError&&<p role="alert" className="error">{c.query.error.message}</p>}{!!c.error&&<p role="alert" className="error">{c.error}</p>}
   {s&&<>
    {s.legacy&&<p role="alert" className="notice warn">{t('aiMcp.legacy')}</p>}
    <section className="panel"><div className="page-head"><h2>{t('aiMcp.server')}</h2><button className="btn-ghost" disabled={locked} onClick={()=>void c.toggle()}>{t(s.enabled?'aiMcp.turnOff':'aiMcp.turnOn')}</button></div><p>{t(s.enabled?'aiMcp.on':'aiMcp.off')}</p><code className="ai-mcp-code">{s.url}</code>{copy(t('aiMcp.copyUrl'),s.url)}<p className="muted small">{t('aiMcp.approvalHelp')}</p></section>
    {c.created&&<section className="panel ai-mcp-secret" aria-label={t('aiMcp.newKey')}><div className="page-head"><h2>{t('aiMcp.newKey')}</h2><button className="icon-btn" aria-label={t('common.close')} onClick={c.dismiss}><X size={18}/></button></div><p>{t('aiMcp.once')}</p><code className="ai-mcp-code">{c.created.secret}</code><div className="row">{copy(t('aiMcp.copyKey'),c.created.secret)}{copy(t('aiMcp.copyConfig'),c.config())}{copy(t('aiMcp.copyKeyUrl'),c.keyUrl())}<button className="btn-ghost" onClick={c.dismiss}>{t('aiMcp.dismiss')}</button></div><p className="muted small">{t('aiMcp.urlWarning')}</p><pre className="ai-mcp-code">{c.config()}</pre></section>}
    <section className="panel"><h2>{t('aiMcp.keys')}</h2><div className="ai-mcp-keys">{s.keys.map(key=><article key={key.id}><div className="page-head"><strong>{key.name}</strong><button className="btn-ghost" disabled={locked} onClick={()=>void c.revoke(key)}>{t('aiMcp.revoke')}</button></div><p>{t('aiMcp.owner')}: {key.owner||'—'} · …{key.hint}</p><p>{t('aiMcp.scope')}: {key.tools?t('aiMcp.selectedCount',{count:key.tools.length}):t('aiMcp.all')}</p>{key.tools&&<code className="ai-mcp-code">{key.tools.join(', ')}</code>}<small>{t('aiMcp.created')}: {date(key.created)} · {t('aiMcp.lastUsed')}: {date(key.last_used)}</small></article>)}</div>{!s.keys.length&&<p className="muted">{t('aiMcp.noKeys')}</p>}</section>
    <section className="panel"><h2>{t('aiMcp.connect')}</h2><p>{t('aiMcp.connectHelp')}</p><pre className="ai-mcp-code">{c.config()}</pre>{!c.created&&copy(t('aiMcp.copyTemplate'),c.config())}<h3>{t('aiMcp.cli')}</h3><pre className="ai-mcp-code">{c.cli()}</pre>{copy(t('aiMcp.copyCli'),c.cli())}<h3>{t('aiMcp.keyUrl')}</h3><code className="ai-mcp-code">{c.keyUrl()}</code>{copy(t('aiMcp.copyKeyUrl'),c.keyUrl())}<p className="muted small">{t('aiMcp.urlWarning')}</p><p className="muted small">{t('aiMcp.headerHelp')}</p></section>
    <section className="panel"><h2>{t('aiMcp.log')}</h2>{s.log.map((entry,i)=><div key={`${entry.at}-${i}`} className="ai-mcp-log"><strong>{entry.tool}</strong><span>{entry.target}</span><small>{entry.owner} · {date(entry.at)} · {t(entry.ok?'aiMcp.success':'aiMcp.failed')}</small></div>)}{!s.log.length&&<p className="muted">{t('aiMcp.noLog')}</p>}</section>
   </>}
  </main>
 </div>;
}
