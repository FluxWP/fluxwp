import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ImagePlus, Send, Save, RotateCcw, X, ArrowLeft, Users, Eye, Sparkles } from 'lucide-react';
import { ResizablePane } from '@fluxwp/ui';
import { useSocialComposer } from '@fluxwp/runtime/src/modules/use-social-composer';
import { socialInputTime, socialLength, socialLocalInput, socialMediaFor, socialOverride, socialQuickTime, socialTextFor, socialVisibleOptions,
  type ComposerAccount, type SocialAction, type SocialMedia, type SocialOptions } from '@fluxwp/runtime/src/modules/social-composer';
import { useRoute } from '../state/route';
import './social-composer.css';
import { Select } from '@fluxwp/ui';

export function SocialComposerScreen() {
  const route=useRoute(s=>s.route); const params=route.kind==='native'?route.params:{};
  const c=useSocialComposer(params); const {state:s,session,t,account,renderer}=c; const d=s.document; const boot=s.boot;
  const [picker,setPicker]=useState(false); const [preview,setPreview]=useState(0); const [when,setWhen]=useState(''); const [tags,setTags]=useState('');
  useEffect(()=>{ if(!s.dirty&&boot){setWhen(socialLocalInput(d.scheduled_at,boot));setTags(d.tags.join(', '));} },[d,s.dirty,boot]);
  useEffect(()=>{if(s.tab!=='all')setPreview(s.tab);},[s.tab]);
  useEffect(()=>{const before=(e:BeforeUnloadEvent)=>{if(session.state.dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',before);return()=>window.removeEventListener('beforeunload',before);},[session]);
  if(c.invalidId)return <div className="page"><p className="error">{t('socialComposer.errors.accountMissing')}</p></div>;
  if(!s.ready)return <div className="page"><h1>{t('socialComposer.title')}</h1>{s.error?<><p role="alert" className="error">{s.error}</p><button className="btn-ghost" onClick={()=>void c.refresh()}>{t('common.retry')}</button></>:<p role="status">{t('states.loading')}</p>}</div>;
  if(!boot)return null;
  const active=boot.accounts.filter(a=>a.status!=='disabled'); const selected=active.filter(a=>d.selected.includes(a.id));
  const current=s.tab==='all'?null:boot.accounts.find(a=>a.id===s.tab); const override=current?socialOverride(d,current.id):null;
  const text=current?socialTextFor(d,current.id):d.content; const media=current?socialMediaFor(d,current.id):d.media;
  const ownText=!current||override?.content!==null; const ownMedia=!current||override?.media!==null;
  const previewAccount=selected.find(a=>a.id===preview)||selected[0];
  const ai=async(mode:'write'|'improve'|'shorten'|'hashtags'|'translate'|'adapt')=>{
    let extra:{brief?:string;to?:string}={};
    if(mode==='write'||mode==='translate') {const result=await renderer.ui.prompt({title:t(`socialComposer.ai.${mode}`),fields:[{name:'value',type:mode==='write'?'textarea':'text',label:t(mode==='write'?'socialComposer.ai.brief':'socialComposer.ai.language'),required:true,default:mode==='translate'?'English':''}]});if(!result?.value)return;extra=mode==='write'?{brief:String(result.value)}:{to:String(result.value)};}
    await session.ai(mode,extra);
  };
  const setWhenValue=(value:string)=>{setWhen(value);session.edit(old=>({...old,scheduled_at:value?(socialInputTime(value,boot)||NaN):0}));};
  const quick=(kind:'hour'|'tomorrow'|'weekend')=>{const time=socialQuickTime(kind,boot);setWhen(socialLocalInput(time,boot));session.edit(old=>({...old,scheduled_at:time}));};
  const submit=(action:SocialAction)=>void c.save(action);
  return <div className="social-composer">
    <ResizablePane className="social-account-pane" storageKey={`flux.pane.${account.id}.social.accounts`} initialWidth={230} minWidth={190} maxWidth={360} minContentWidth={700} label={t('socialComposer.resizeAccounts')}>
      <header><Users size={20}/><h1>{t('socialComposer.accounts')}</h1></header><p className="muted small">{t('socialComposer.accountsHelp')}</p>
      <nav aria-label={t('socialComposer.accounts')}>{active.map(a=><button key={a.id} disabled={!!s.busy||d.locked.some(x=>x.account_id===a.id)} aria-pressed={d.selected.includes(a.id)} onClick={()=>session.toggleAccount(a.id)} className={d.selected.includes(a.id)?'on':''}>
        <Avatar account={a}/><span><strong>{a.name}</strong><small>{a.network||a.provider}{a.status==='expired'?' · '+t('socialComposer.expired'):''}</small></span><span className="social-check" aria-hidden="true">{d.selected.includes(a.id)?'✓':'○'}</span>
      </button>)}</nav>
      {!active.length&&<p className="notice">{t(boot.user.manage?'socialComposer.noAccounts':'socialComposer.askAdmin')}</p>}
      {boot.user.manage&&<button className="btn-ghost small" onClick={()=>renderer.nav.push({kind:'manifest',module:'social',screen:'accounts',params:{}})}>{t('socialComposer.manageAccounts')}</button>}
    </ResizablePane>
    <div className="social-editor-layout"><main className="social-editor-main">
      <header className="page-head"><div><h1>{t(d.id?'socialComposer.editTitle':'socialComposer.title')}</h1><p className="muted small">{t('socialComposer.site',{site:account.siteName})}{d.id?' · #'+d.id:''}</p></div><button className="icon-btn" disabled={!!s.busy||s.loading} aria-label={t('socialComposer.reload')} onClick={()=>void c.refresh()}><RotateCcw size={18}/></button></header>
      {s.error&&<p role="alert" className="error">{s.error}</p>}
      {s.uncertain&&<p role="alert" className="notice warn">{t('socialComposer.uncertain')}</p>}{s.changedOnServer&&<p role="alert" className="notice warn">{t('socialComposer.errors.conflict')}</p>}
      {!!d.locked.length&&<p className="notice">{t('socialComposer.locked',{count:d.locked.length})} {d.locked.map(x=>x.account).join(', ')}</p>}
      {!!d.note&&<p className="notice">{t('socialComposer.note',{note:d.note})}</p>}
      <div className="social-tabs" role="tablist" aria-label={t('socialComposer.versions')}><button role="tab" aria-selected={s.tab==='all'} disabled={!!s.busy} className={s.tab==='all'?'on':''} onClick={()=>session.setTab('all')}>{t('socialComposer.common')}</button>{selected.map(a=><button role="tab" aria-selected={s.tab===a.id} disabled={!!s.busy} key={a.id} className={s.tab===a.id?'on':''} onClick={()=>session.setTab(a.id)}>{a.name}{socialOverride(d,a.id).content!==null?' •':''}</button>)}</div>
      <section className="social-content-editor">
        {current&&<label className="check"><input type="checkbox" checked={ownText} disabled={!!s.busy} onChange={e=>session.override(current.id,{content:e.target.checked?text:null})}/>{t('socialComposer.ownText')}</label>}
        <textarea className="social-text" aria-label={t('socialComposer.content')} placeholder={t('socialComposer.placeholder')} value={text} disabled={!!s.busy||!ownText} rows={7} onChange={e=>session.setText(e.target.value)}/>
        <div className="social-counters">{(current?[current]:selected).map(a=>a.caps?.max_text?<span key={a.id} className={socialLength(current?text:socialTextFor(d,a.id),a.provider)>a.caps.max_text?'error':''}>{a.network||a.provider} · {socialLength(current?text:socialTextFor(d,a.id),a.provider)} / {a.caps.max_text}</span>:null)}</div>
        {!current&&!!boot.settings.signature&&<button className="btn-link small" disabled={!!s.busy} onClick={()=>session.setText(`${text.trimEnd()}${text?'\n\n':''}${boot.settings.signature}`)}>{t('socialComposer.signature')}</button>}
        {boot.ai&&ownText&&<div className="social-ai">{(['write','improve','shorten','hashtags','translate',...(!current&&selected.length>1?['adapt']:[])] as const).map(mode=><button className="btn-ghost small" disabled={!!s.busy} key={mode} onClick={()=>void ai(mode as Parameters<typeof ai>[0])}><Sparkles size={13}/>{t(`socialComposer.ai.${mode}`)}</button>)}</div>}
        {current&&<label className="check"><input type="checkbox" checked={ownMedia} disabled={!!s.busy} onChange={e=>session.override(current.id,{media:e.target.checked?[...media]:null})}/>{t('socialComposer.ownMedia')}</label>}
        <MediaStrip items={media} editable={!s.busy&&ownMedia} t={t} onChange={items=>session.setMedia(items)}/>
        {ownMedia&&<button className="btn-ghost" disabled={!!s.busy} onClick={()=>setPicker(true)}><ImagePlus size={18}/>{t('socialComposer.media')}</button>}
        {current&&<ProviderOptions account={current} values={override!.options} t={t} disabled={!!s.busy} onChange={options=>session.setOptions(current.id,options)}/>}
      </section>
      <details className="social-extras"><summary>{t('socialComposer.extras')}</summary><label className="field">{t('socialComposer.internalTitle')}<input value={d.title} maxLength={190} disabled={!!s.busy} onChange={e=>session.edit(old=>({...old,title:e.target.value}))}/></label>
        <label className="field">{t('socialComposer.tags')}<input value={tags} disabled={!!s.busy} onChange={e=>{setTags(e.target.value);const tags=e.target.value.split(',').map(s=>s.trim()).filter(Boolean);session.edit(old=>({...old,tags}));}}/></label>
        <label className="field">{t('socialComposer.repeat')}<input type="number" min={0} max={365} value={d.repeat_days} disabled={!!s.busy} onChange={e=>{const repeat_days=e.target.valueAsNumber;session.edit(old=>({...old,repeat_days}));}}/></label>
      </details>
      <section className="social-schedule"><label className="field">{t('socialComposer.scheduleTime')} <small>{boot.tz}</small><input type="datetime-local" value={when} disabled={!!s.busy} onChange={e=>setWhenValue(e.target.value)}/></label><div className="row">{(['hour','tomorrow','weekend'] as const).map(kind=><button className="btn-link small" key={kind} disabled={!!s.busy} onClick={()=>quick(kind)}>{t(`socialComposer.quick.${kind}`)}</button>)}{when&&<button className="btn-link small" disabled={!!s.busy} onClick={()=>setWhenValue('')}>{t('socialComposer.clearTime')}</button>}</div></section>
      {!!s.issues.length&&<ul className="error" role="alert">{s.issues.map((issue,i)=><li key={i}>{issue.account?`${boot.accounts.find(a=>a.id===issue.account)?.name||issue.account}: `:''}{t(issue.key,issue.vars)}</li>)}</ul>}
      <footer className="social-actions"><button className="btn-ghost" disabled={!!s.busy||s.uncertain} onClick={()=>submit('draft')}><Save size={16}/>{t('socialComposer.actions.draft')}</button>
        {boot.user.publish&&d.status==='pending'&&<button className="btn-ghost" disabled={!!s.busy||s.uncertain} onClick={()=>submit('approve')}>{t('socialComposer.actions.approve')}</button>}
        <button className="btn-primary" disabled={!!s.busy||s.uncertain||!active.length} onClick={()=>submit(!boot.user.publish?'submit':when?'schedule':'now')}><Send size={16}/>{s.busy?t('form.saving'):t(`socialComposer.actions.${!boot.user.publish?'submit':when?'schedule':'now'}`)}</button>
      </footer>
    </main>
    <ResizablePane className="social-preview-pane" storageKey={`flux.pane.${account.id}.social.preview`} edge="left" initialWidth={320} minWidth={240} maxWidth={500} minContentWidth={430} label={t('socialComposer.resizePreview')}>
      <header><Eye size={18}/><h2>{t('socialComposer.preview')}</h2></header>{previewAccount?<><Select aria-label={t('socialComposer.previewAccount')} value={previewAccount.id} onChange={e=>setPreview(Number(e.target.value))}>{selected.map(a=><option value={a.id} key={a.id}>{a.network||a.provider} · {a.name}</option>)}</Select><article className="social-preview-card"><header><Avatar account={previewAccount}/><div><strong>{previewAccount.name}</strong><small>{previewAccount.network||previewAccount.provider}</small></div></header><p>{socialTextFor(d,previewAccount.id)}</p><MediaStrip items={socialMediaFor(d,previewAccount.id)} editable={false} t={t} onChange={()=>{}}/>
        {typeof socialOverride(d,previewAccount.id).options.first_comment==='string'&&<p className="social-first-comment">{String(socialOverride(d,previewAccount.id).options.first_comment)}</p>}</article><p className="muted small">{t('socialComposer.previewHelp')}</p></>:<p className="muted">{t('socialComposer.choosePreview')}</p>}
    </ResizablePane></div>
    {picker&&<MediaPicker c={c} onClose={()=>setPicker(false)}/>}
  </div>;
}
function Avatar({account:a}:{account:ComposerAccount}) {return a.avatar?<img className="social-avatar" alt="" src={a.avatar}/>:<span className="social-avatar" aria-hidden="true">{a.name.slice(0,1).toLocaleUpperCase()}</span>;}
type TextFn=ReturnType<typeof useSocialComposer>['t'];
function MediaStrip({items,editable,t,onChange}:{items:SocialMedia[];editable:boolean;t:TextFn;onChange:(items:SocialMedia[])=>void}) {return <div className="social-media-strip">{items.map((m,i)=><figure key={m.id}>{m.kind==='video'?<video controls={!editable} preload="metadata" src={m.url} poster={m.thumb} playsInline/>:<img src={m.thumb||m.url} alt={m.alt||m.name||''}/>}<figcaption>{m.name}</figcaption>{editable&&<div>{i>0&&<button className="icon-btn" aria-label={t('socialComposer.moveLeft')} onClick={()=>{const next=[...items];[next[i-1],next[i]]=[next[i]!,next[i-1]!];onChange(next);}}><ArrowLeft size={14}/></button>}<button className="icon-btn" aria-label={t('socialComposer.removeMedia')} onClick={()=>onChange(items.filter((_,index)=>index!==i))}><X size={14}/></button></div>}</figure>)}</div>;}
function ProviderOptions({account,values,t,disabled,onChange}:{account:ComposerAccount;values:SocialOptions;t:TextFn;disabled:boolean;onChange:(v:SocialOptions)=>void}) {
  return <section className="social-provider-options"><h2>{t('socialComposer.networkOptions',{network:account.network||account.provider})}</h2><div>{socialVisibleOptions(account,values,t).map(([id,f])=>{
    const value=values[id]??f.default??f.choices?.[0]?.value??''; const change=(value:SocialOptions[string])=>onChange({...values,[id]:value});
    if(f.type==='check')return <label className="check" key={id}><input type="checkbox" checked={!!value} disabled={disabled} onChange={e=>change(e.target.checked)}/>{f.label}</label>;
    return <label className="field" key={id}>{f.label}{f.required?' *':''}{f.type==='select'?<Select value={String(value)} disabled={disabled} onChange={e=>change(e.target.value)}>{f.choices?.map(o=><option value={o.value} key={o.value}>{o.label}</option>)}</Select>:f.type==='area'?<textarea rows={3} value={String(value)} disabled={disabled} onChange={e=>change(e.target.value)}/>:f.type==='tags'?<TagInput value={Array.isArray(value)?value:[]} disabled={disabled} onChange={change}/>:<input type={f.type==='url'?'url':f.type==='date'?'date':'text'} maxLength={f.max} value={String(value)} disabled={disabled} onChange={e=>change(e.target.value)}/>}</label>;
  })}</div></section>;
}
function TagInput({value,disabled,onChange}:{value:string[];disabled:boolean;onChange:(v:string[])=>void}) {
  const [raw,setRaw]=useState(value.join(', '));const normalized=value.join(', ');
  useEffect(()=>{if(raw.split(',').map(s=>s.trim()).filter(Boolean).join(', ')!==normalized)setRaw(normalized);},[normalized,raw]);
  return <input value={raw} disabled={disabled} onChange={e=>{setRaw(e.target.value);onChange(e.target.value.split(',').map(s=>s.trim()).filter(Boolean));}}/>;
}
type StudioMedia={id:number;attachment_id?:number;url:string;thumb?:string;kind:'image'|'video';title?:string;prompt?:string};
function MediaPicker({c,onClose}:{c:ReturnType<typeof useSocialComposer>;onClose:()=>void}) {
  const {t,api,session,state}=c; const boot=state.boot!; const [source,setSource]=useState<'library'|'studio'>('library'); const [search,setSearch]=useState(''); const [page,setPage]=useState(1); const [chosen,setChosen]=useState<Record<string,SocialMedia>>({}); const [url,setUrl]=useState(''); const dialog=useRef<HTMLDialogElement>(null); const file=useRef<HTMLInputElement>(null);
  useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close();},[]);
  const query=useQuery({queryKey:[c.account.id,'social-media',source,search,page],queryFn:async({signal})=>{
    if(source==='studio'){const r=await api<{items:StudioMedia[]}>('flx-social/v1/media/studio',{signal});return {items:r.items.filter(m=>(m.title||m.prompt||'').toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(m=>({id:m.attachment_id||0,url:m.url,thumb:m.thumb,kind:m.kind,name:m.title||m.prompt,key:`studio-${m.id}`})),pages:1};}
    const r=await api<{items:SocialMedia[];pages:number}>('flx-social/v1/media',{signal,query:{q:search,page}});return {...r,items:r.items.map(m=>({...m,key:`media-${m.id}`}))};
  }});
  const add=async()=>{await session.addMedia(Object.values(chosen));if(!session.state.error&&!session.state.issues.length)onClose();};
  return <dialog ref={dialog} className="social-picker" onCancel={e=>{e.preventDefault();if(!state.busy)onClose();}} aria-label={t('socialComposer.media')}><header><h2>{t('socialComposer.media')}</h2><button className="icon-btn" disabled={!!state.busy} aria-label={t('common.close')} onClick={onClose}><X size={20}/></button></header>
    <div className="social-picker-tools"><Select aria-label={t('socialComposer.mediaSource')} value={source} onChange={e=>{setSource(e.target.value as typeof source);setPage(1);}}><option value="library">{t('socialComposer.library')}</option>{boot.studio&&<option value="studio">Flux Studio</option>}</Select><input type="search" aria-label={t('socialComposer.searchMedia')} placeholder={t('socialComposer.searchMedia')} value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/>
      {boot.user.upload&&<><button className="btn-ghost" disabled={!!state.busy} onClick={()=>file.current?.click()}>{t('socialComposer.upload')}</button><input ref={file} hidden type="file" accept="image/*,video/*" multiple onChange={e=>{const files=Array.from(e.target.files||[]);void session.upload(files.map(f=>({uri:'',name:f.name,type:f.type,blob:f}))).then(()=>{if(!session.state.error)onClose();});}}/></>}
    </div>
    {boot.user.upload&&<form className="row" onSubmit={e=>{e.preventDefault();void session.importUrl(url).then(()=>{if(!session.state.error&&!session.state.issues.length)onClose();});}}><input type="url" aria-label={t('socialComposer.mediaUrl')} placeholder="https://" required value={url} onChange={e=>setUrl(e.target.value)}/><button className="btn-ghost small" disabled={!!state.busy}>{t('socialComposer.importUrl')}</button></form>}
    {state.error&&<p role="alert" className="error">{state.error}</p>}{query.isError&&<p role="alert" className="error">{query.error.message}</p>}
    {query.isPending?<p role="status">{t('states.loading')}</p>:<div className="social-library-grid">{query.data?.items.map(m=><button aria-pressed={!!chosen[m.key]} disabled={!!state.busy||!m.id&&!boot.user.upload} title={m.name} key={m.key} onClick={()=>setChosen(old=>{const next={...old};if(next[m.key])delete next[m.key];else next[m.key]=m;return next;})}>{m.kind==='video'&&!m.thumb?<video src={m.url} preload="metadata"/>:<img src={m.thumb||m.url} alt={m.name||''}/>}<span>{m.name}</span>{chosen[m.key]&&<strong>✓</strong>}</button>)}{!query.data?.items.length&&<p>{t('socialComposer.noMedia')}</p>}</div>}
    <footer><div className="row"><button className="btn-ghost small" disabled={page<=1||query.isFetching} onClick={()=>setPage(p=>p-1)}>{t('nav.back')}</button><span>{page} / {Math.max(1,query.data?.pages||1)}</span><button className="btn-ghost small" disabled={page>=(query.data?.pages||1)||query.isFetching} onClick={()=>setPage(p=>p+1)}>{t('nav.forward')}</button></div><button className="btn-primary" disabled={!!state.busy||!Object.keys(chosen).length} onClick={()=>void add()}>{state.busy?t('form.saving'):t('socialComposer.addSelected',{count:Object.keys(chosen).length})}</button></footer>
  </dialog>;
}
