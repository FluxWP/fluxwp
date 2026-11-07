import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useScope } from '../scope';

export interface AiSystemRow { source:string; label:string; installed:boolean; active:boolean; page:string; on:boolean; model:string; calls:number; tools:number; tok:number; cost:number; errors:number; last:number }
export interface AiSystemField { key:string; type:string; label:string; help:string; supported:boolean; value?:string|number|boolean; min?:number; max?:number; options?:Array<{value:string;label:string}> }
export interface AiSystemDetail extends AiSystemRow { description:string; configured_model:string; default_model:string; fields:AiSystemField[]; revision:string; tool_count:number; tools_enabled:number; sdk_version:string }
export interface AiSystemsList { items:AiSystemRow[]; total:number; page:number; pages:number }
interface SystemForm { revision:string; enabled:boolean; model:string; values:Record<string,string|number|boolean> }
const fromDetail = (data:AiSystemDetail):SystemForm => ({ revision:data.revision,enabled:data.on,model:data.configured_model,values:Object.fromEntries(data.fields.filter(field=>field.supported).map(field=>[field.key,field.value??''])) });

/** Views must be keyed by account; the server validates revisions and declared SDK fields again. */
export function useAiSystems(initialSource='') {
  const {account,api,renderer}=useScope(); const qc=useQueryClient(); const active=useRef(true);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  const [search,setSearch]=useState('');const [q,setQ]=useState('');const [page,setPage]=useState(1);const [source,setSource]=useState(initialSource);
  const [draft,setDraft]=useState<SystemForm|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  useEffect(()=>{const timeout=setTimeout(()=>{setQ(search);setPage(1);},220);return()=>clearTimeout(timeout);},[search]);
  const list=useQuery<AiSystemsList>({queryKey:[account.id,'ai-systems',q,page],queryFn:({signal})=>api('flx-ai/v1/admin/systems',{query:{q,page,per_page:30},signal}),placeholderData:(previous,previousQuery)=>previousQuery?.queryKey[0]===account.id?previous:undefined});
  const detailKey=[account.id,'ai-system',source];
  const detail=useQuery<AiSystemDetail>({queryKey:detailKey,enabled:!!source,queryFn:({signal})=>api(`flx-ai/v1/admin/systems/${encodeURIComponent(source)}`,{signal})});
  const models=useQuery<{models:Array<{id:string;name:string;provider:string}>}>({queryKey:[account.id,'ai-model-catalogue'],enabled:!!source,staleTime:300_000,queryFn:({signal})=>api('flx-ai/v1/models',{signal}),retry:false});
  const form=draft??(detail.data?fromDetail(detail.data):null);
  const dirty=!!draft&&!!detail.data&&JSON.stringify(draft)!==JSON.stringify(fromDetail(detail.data));
  const stale=!!draft&&!!detail.data&&draft.revision!==detail.data.revision;
  const edit=(patch:Partial<Omit<SystemForm,'revision'>>)=>{if(busy||!form)return;setDraft({...form,...patch});setError('');};
  const field=(key:string,value:string|number|boolean)=>{if(form)edit({values:{...form.values,[key]:value}});};
  const choose=async(next:string)=>{
    if(busy||next===source)return;setBusy(true);
    try {if(dirty&&!await renderer.ui.confirm({title:renderer.t('aiSystems.title'),body:renderer.t('aiSystems.discard')}))return;if(!active.current)return;setDraft(null);setError('');setSource(next);}
    finally{if(active.current)setBusy(false);}
  };
  const reload=async()=>{
    if(busy)return;setBusy(true);
    try{if(dirty&&!await renderer.ui.confirm({title:renderer.t('aiTools.reload'),body:renderer.t('aiSystems.discard')}))return;if(!active.current)return;setDraft(null);setError('');await Promise.all([list.refetch(),...(source?[detail.refetch()]:[])]);}
    finally{if(active.current)setBusy(false);}
  };
  const save=async()=>{
    if(busy||!form||!detail.data||!dirty||stale)return;
    const values={...form.values};
    for(const f of detail.data.fields){if(!f.supported||f.type!=='number')continue;const raw=String(values[f.key]??'').trim().replace(',','.');if(!raw||!Number.isFinite(Number(raw))){setError(renderer.t('aiSystems.invalidNumber',{name:f.label}));return;}values[f.key]=Number(raw);}
    setBusy(true);setError('');
    try{if(!await renderer.ui.confirm({title:renderer.t('aiTools.save'),body:renderer.t('aiSystems.confirm',{name:detail.data.label,site:`${account.siteName} (${account.siteUrl})`})})||!active.current)return;
      const saved=await api<AiSystemDetail>(`flx-ai/v1/admin/systems/${encodeURIComponent(source)}`,{method:'POST',body:{...form,values}});
      qc.setQueryData(detailKey,saved);setDraft(null);await qc.invalidateQueries({queryKey:[account.id,'ai-systems']});if(active.current)renderer.ui.toast(renderer.t('form.saved'),'ok');
    }catch(e){if(active.current)setError(e instanceof Error?e.message:String(e));}finally{if(active.current)setBusy(false);}
  };
  const modelOptions=(current:string)=>[{value:'',label:renderer.t('aiSystems.defaultModel')},...(current&&!models.data?.models.some(m=>m.id===current)?[{value:current,label:current}]:[]),...(models.data?.models.map(m=>({value:m.id,label:`${m.name} · ${m.provider}`}))??[])];
  const state=(row:AiSystemRow)=>!row.installed?'notInstalled':!row.active?'inactive':!row.on?'disabled':'working';
  return{account,list,detail,models,modelOptions,search,setSearch,page,setPage,source,choose,form,edit,field,dirty,stale,busy,error,reload,save,state,
    tools:()=>renderer.nav.push({kind:'native',component:'flxai-tools',params:{source}}),
  };
}
