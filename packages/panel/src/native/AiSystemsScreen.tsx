import { useTranslation } from 'react-i18next';
import { RefreshCw, Save, X } from 'lucide-react';
import { useAccount } from '@fluxwp/runtime';
import { useAiSystems } from '@fluxwp/runtime/src/modules/ai-systems';
import { ResizablePane, Select } from '@fluxwp/ui';
import './native-admin.css';
import './ai-systems.css';
import { useRoute } from '../state/route';

export function AiSystemsScreen(){const account=useAccount();const route=useRoute(s=>s.route);const source='params' in route?route.params?.system??'':'';return <SystemsView key={`${account.id}|${source}`} initialSource={source}/>;}
function SystemsView({initialSource}:{initialSource:string}){
 const {t,i18n}=useTranslation();const c=useAiSystems(initialSource);const data=c.detail.data;const form=c.form;
 const model=(label:string,value:string,onChange:(value:string)=>void,placeholder=data?.default_model)=><div className="native-fields ai-system-model"><label className="field">{label}<input value={value} disabled={c.busy} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/></label><label className="field">{t('aiSystems.chooseModel',{name:label})}<Select value={value} disabled={c.busy||c.models.isPending} onChange={e=>onChange(e.target.value)}>{c.modelOptions(value).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</Select></label></div>;
 return <div className="native-admin split ai-systems" data-testid="screen-ai-systems">
  <ResizablePane storageKey={`flux.pane.${c.account.id}.ai-systems`} initialWidth={280} minWidth={220} maxWidth={440} minContentWidth={400} label={t('aiSystems.resize')} className="native-admin-nav">
   <header><h1>{t('aiSystems.title')}</h1></header><label className="field ai-system-search">{t('aiSystems.search')}<input type="search" value={c.search} onChange={e=>c.setSearch(e.target.value)} placeholder={t('aiSystems.searchPlaceholder')}/></label>
   {c.list.isError&&<p className="error">{c.list.error.message}</p>}
   <nav aria-label={t('aiSystems.title')}>{c.list.data?.items.map(row=><button key={row.source} type="button" className={row.source===c.source?'on':''} disabled={c.busy||c.list.isPlaceholderData} onClick={()=>void c.choose(row.source)} aria-current={row.source===c.source?'page':undefined}><strong>{row.label}</strong><span>{t(`aiSystems.${c.state(row)}`)} · {t('aiSystems.calls',{count:row.calls})}</span></button>)}</nav>
   {!c.list.isPending&&!c.list.data?.items.length&&<p className="muted ai-system-search">{t('aiSystems.empty')}</p>}
   <div className="native-admin-add"><span>{t('aiTools.page',{page:c.page,pages:c.list.data?.pages??1})}</span><div className="row"><button className="btn-ghost small" disabled={c.page<=1||c.list.isPlaceholderData} onClick={()=>c.setPage(c.page-1)}>{t('aiTools.previous')}</button><button className="btn-ghost small" disabled={!c.list.data||c.page>=c.list.data.pages||c.list.isPlaceholderData} onClick={()=>c.setPage(c.page+1)}>{t('aiTools.next')}</button></div></div>
  </ResizablePane>
  <main className="native-admin-body">
   <header className="page-head"><div><h1>{data?.label??t('aiSystems.title')}</h1><p className="muted">{data?.description||t('aiSystems.intro')}</p></div><button className="btn-ghost" disabled={c.busy} onClick={()=>void c.reload()}><RefreshCw size={16}/>{t('aiTools.reload')}</button></header>
   {!!c.error&&<p className="error" role="alert">{c.error}</p>}{c.stale&&<p className="notice warn" role="alert">{t('aiSystems.stale')}</p>}{c.detail.isError&&<p className="error" role="alert">{c.detail.error.message}</p>}
   {!c.source&&<p>{t('aiSystems.choose')}</p>}{!!c.source&&c.detail.isPending&&<p role="status">{t('states.loading')}</p>}
   {data&&form&&<>
    <div className="ai-system-stats">{(['calls','tools','tok','cost','errors'] as const).map(key=><div className="panel" key={key}><span>{t(`aiSystems.stat.${key}`)}</span><strong>{key==='cost'?new Intl.NumberFormat(i18n.language,{style:'currency',currency:'USD',maximumFractionDigits:4}).format(data[key]):new Intl.NumberFormat(i18n.language).format(data[key])}</strong></div>)}</div>
    <section className="panel"><div className="page-head"><span>{t(`aiSystems.${c.state({...data,on:form.enabled})}`)}</span><button className="icon-btn" aria-label={t('common.close')} disabled={c.busy} onClick={()=>void c.choose('')}><X size={18}/></button></div><code>{data.source}</code><p className="muted small">{t('aiSystems.last')}: {data.last?new Date(data.last*1000).toLocaleString(i18n.language):'—'}</p>
     <label className="setting"><span>{t('aiSystems.enabled')}</span><input type="checkbox" checked={form.enabled} disabled={c.busy} onChange={e=>c.edit({enabled:e.target.checked})}/></label><p className="muted small">{t('aiSystems.enabledHelp')}</p>
     {model(t('aiSystems.sourceModel'),form.model,value=>c.edit({model:value}))}<p className="muted small">{t('aiSystems.modelHelp')}</p>
    </section>
    <section className="panel native-fields">{data.fields.map(f=><div key={f.key} className="ai-system-field">{!f.supported?<p className="notice warn">{t('aiSystems.unsupported',{name:f.label})}</p>:f.type==='toggle'?<label className="setting"><span>{f.label}</span><input type="checkbox" checked={!!form.values[f.key]} disabled={c.busy} onChange={e=>c.field(f.key,e.target.checked)}/></label>:f.type==='select'?<label className="field">{f.label}<Select value={String(form.values[f.key]??'')} disabled={c.busy} onChange={e=>c.field(f.key,e.target.value)}>{f.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</Select></label>:f.type==='model'?model(f.label,String(form.values[f.key]??''),value=>c.field(f.key,value),form.model||data.default_model):<label className="field">{f.label}{f.type==='textarea'?<textarea rows={4} value={String(form.values[f.key]??'')} disabled={c.busy} onChange={e=>c.field(f.key,e.target.value)}/>:<input type={f.type==='number'?'number':'text'} step={f.type==='number'?'any':undefined} min={f.min} max={f.max} value={String(form.values[f.key]??'')} disabled={c.busy} onChange={e=>c.field(f.key,e.target.value)}/>}</label>}{!!f.help&&<p className="muted small">{f.help}</p>}</div>)}{!data.fields.length&&<p className="muted">{t('aiSystems.noFields')}</p>}
     {c.models.isError&&<p className="notice warn">{t('aiSystems.catalogueError')}</p>}
    </section>
    <section className="panel"><h2>{t('aiTools.title')}</h2><p>{t('aiSystems.toolCount',{on:data.tools_enabled,count:data.tool_count})}</p><button className="btn-ghost" disabled={c.busy||c.dirty} onClick={c.tools}>{t('aiSystems.manageTools')}</button>{c.dirty&&<p className="muted small">{t('aiSystems.saveBeforeTools')}</p>}<p className="muted small">{t('aiSystems.sdk',{version:data.sdk_version||'—'})}</p></section>
    <div className="row"><button className="btn-primary" disabled={!c.dirty||c.busy||c.stale} onClick={()=>void c.save()}><Save size={16}/>{t('aiTools.save')}</button>{c.dirty&&<span className="muted small">{t('aiSystems.unsaved')}</span>}</div>
   </>}
  </main>
 </div>;
}
