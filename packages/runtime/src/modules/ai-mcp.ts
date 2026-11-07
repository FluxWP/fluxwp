import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useScope } from '../scope';

export interface AiMcpTool { name:string; title:string; description:string; source:string; label:string; readonly:boolean; off:boolean; allowed:boolean }
export interface AiMcpKey { id:string; name:string; hint:string; user:number; owner:string; created:number; last_used:number; tools:string[]|null }
export interface AiMcpState { revision:string; enabled:boolean; legacy:boolean; url:string; slug:string; keys:AiMcpKey[]; tools:AiMcpTool[]; log:Array<{at:number;owner:string;tool:string;target:string;ok:boolean}> }
interface CreatedKey { id:string; secret:string }
interface Draft { revision:string; name:string; scope:'selected'|'all'; tools:string[] }

/** Account-keyed views only. One-time credentials never enter a query/mutation cache or persistent storage. */
export function useAiMcp() {
 const {account,api,renderer}=useScope();const qc=useQueryClient();const active=useRef(true);const operation=useRef(false);
 const queryKey=[account.id,'ai-mcp'];
 const query=useQuery<AiMcpState>({queryKey,queryFn:({signal})=>api('flx-ai/v1/admin/mcp',{signal})});
 const [draft,setDraft]=useState<Draft|null>(null);const [search,setSearch]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [created,setCreated]=useState<CreatedKey|null>(null);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 useEffect(()=>{if(!created)return;const timeout=setTimeout(()=>setCreated(null),300_000);return()=>clearTimeout(timeout);},[created]);
 const state=query.data;const form=draft??{revision:state?.revision??'',name:'',scope:'selected' as const,tools:[]};
 const stale=!!draft&&!!state&&draft.revision!==state.revision;
 const edit=(patch:Partial<Omit<Draft,'revision'>>)=>{if(operation.current||created)return;setDraft({...form,...patch});setError('');};
 const select=(name:string)=>edit({tools:form.tools.includes(name)?form.tools.filter(n=>n!==name):[...form.tools,name]});
 const filteredTools=state?.tools.filter(tool=>`${tool.name} ${tool.title} ${tool.label}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))??[];
 const mutation=async(body:Record<string,unknown>,confirmation:string)=>{
  if(operation.current||!state||state.legacy)return;operation.current=true;setBusy(true);setError('');
  try{
   if(!await renderer.ui.confirm({title:renderer.t('aiMcp.title'),body:confirmation})||!active.current)return;
   // Direct request, not useMutation: the response includes a credential that must not be retained in MutationCache.
   const result=await api<{state:AiMcpState;created?:CreatedKey}>('flx-ai/v1/admin/mcp',{method:'POST',body});
   qc.setQueryData(queryKey,result.state);
   if(active.current){if(result.created){setCreated(result.created);setDraft(null);}else if(body.action==='revoke'&&body.id===created?.id){setCreated(null);}renderer.ui.toast(renderer.t('form.saved'),'ok');}
  }catch(e){if(active.current)setError(e instanceof Error?e.message:String(e));}
  finally{operation.current=false;if(active.current)setBusy(false);}
 };
 const site=`${account.siteName} (${account.siteUrl})`;
 const create=()=>{if(stale||created||form.scope==='selected'&&!form.tools.length)return;return mutation({action:'create',...form,tools:form.scope==='all'?[]:form.tools},renderer.t('aiMcp.confirmCreate',{site,scope:form.scope==='all'?renderer.t('aiMcp.all'):renderer.t('aiMcp.selectedCount',{count:form.tools.length})}));};
 const toggle=()=>state&&mutation({action:'toggle',revision:state.revision,enabled:!state.enabled},renderer.t(state.enabled?'aiMcp.confirmDisable':'aiMcp.confirmEnable',{site}));
 const revoke=(key:AiMcpKey)=>state&&mutation({action:'revoke',revision:state.revision,id:key.id},renderer.t('aiMcp.confirmRevoke',{name:key.name,owner:key.owner||'—',site}));
 const copy=async(value:string)=>{try{await renderer.ui.copy(value);if(active.current)renderer.ui.toast(renderer.t('aiMcp.copied'),'ok');}catch(e){if(active.current)setError(e instanceof Error?e.message:String(e));}};
 const keyUrl=()=>{if(!state)return'';const url=new URL(state.url);url.searchParams.set('key',created?.secret??'YOUR_MCP_KEY');return url.toString();};
 const cli=()=>{
  // This is copyable shell text: quote each argument, including a site's potentially unusual URL.
  const quote=(value:string)=>`'${value.replaceAll("'", "'\\''")}'`;
  return `claude mcp add --transport http ${quote(state?.slug||'fluxwp')} ${quote(state?.url??'')} --header ${quote(`Authorization: Bearer ${created?.secret??'YOUR_MCP_KEY'}`)}`;
 };
 const config=()=>JSON.stringify({mcpServers:{[state?.slug||'fluxwp']:{command:'npx',args:['-y','mcp-remote',state?.url??'','--header',`Authorization: Bearer ${created?.secret??'YOUR_MCP_KEY'}`]}}},null,2);
 const reload=async()=>{if(operation.current)return;operation.current=true;setBusy(true);try{await query.refetch();}finally{operation.current=false;if(active.current)setBusy(false);}};
 return{account,query,state,form,edit,select,filteredTools,search,setSearch,stale,busy,error,created,create,toggle,revoke,copy,keyUrl,config,cli,reload,reset:()=>{if(!busy){setDraft(null);setError('');}},dismiss:()=>setCreated(null)};
}
