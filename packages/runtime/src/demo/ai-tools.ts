import { getDemoLocale } from '@fluxwp/core/src/demo/locale';
import type { AiToolFilter, AiToolRow, AiToolsResult } from '../modules/ai-tools';

type Route = [string, RegExp, (match: RegExpMatchArray, query: URLSearchParams, body: Record<string, unknown>) => unknown];
const disabled = new Set(['flxseo_update_03', 'flxmail_read_08']);
let picked = 'flxseo';
let revision = 1;
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const filterFor = (input: Record<string, unknown>): AiToolFilter => ({ q: String(input.q ?? ''), source: String(input.source ?? ''), kind: String(input.kind ?? '') as AiToolFilter['kind'], state: String(input.state ?? '') as AiToolFilter['state'] });
const matches = (row: AiToolRow, filter: AiToolFilter) => (!filter.q || fold([row.name,row.title,row.description,row.label,...row.aliases].join(' ')).includes(fold(filter.q))) && (!filter.source || row.source === filter.source) && (!filter.kind || row.readonly === (filter.kind === 'read')) && (!filter.state || (filter.state === 'on' ? !row.dupe && !row.off : filter.state === 'off' ? !row.dupe && row.off : filter.state === 'conflict' ? row.dupe || row.rivals.length > 0 : !row.prefixed));
const rows = (): AiToolRow[] => {
  const en = getDemoLocale() === 'en';
  const sources = ['flxseo','flxcrm','flxmail'];
  const labels: Record<string,string> = { flxseo:'Flux SEO',flxcrm:'Flux CRM',flxmail:'Flux Mail',core:'WordPress' };
  const row = (name: string, source: string, readonly: boolean, title: string): AiToolRow => ({ id:`${name}|${source}`,name,source,title,label:labels[source]!,description:en?'Reads or updates your site through its registered plugin.':'Sitenizdeki kayıtlı eklenti üzerinden okuma veya güncelleme yapar.',readonly,approval:!readonly,cap:readonly?'read':'edit_posts',mcp:true,chat:true,off:disabled.has(name),aliases:[],dupe:false,rivals:[],prefixed:true,usage:{n:12,avg_ms:245,errors:0} });
  const list = Array.from({length:65},(_,i) => {
    const source = sources[i%3]!; const read = i%2 === 0;
    return row(`${source}_${read?'read':'update'}_${String(i).padStart(2,'0')}`,source,read,`${en?(read?'Read content':'Update content'):(read?'İçerik oku':'İçerik güncelle')} ${i+1}`);
  });
  for (const source of ['flxseo','flxmail']) {
    const definition = row('flxseo_preview',source,source==='flxseo',en?'Preview content':'İçerik önizleme');
    definition.dupe = source!==picked; definition.rivals=[source==='flxseo'?'flxmail':'flxseo']; definition.off=!definition.dupe&&disabled.has(definition.name); definition.mcp=!definition.dupe; definition.chat=!definition.dupe;
    list.push(definition);
  }
  const legacy = row('site_info','core',true,en?'Site information':'Site bilgileri'); legacy.prefixed=false; list.push(legacy);
  return list.sort((a,b)=>a.label.localeCompare(b.label)||a.name.localeCompare(b.name)||Number(a.dupe)-Number(b.dupe));
};
const failure = (status: number, message: string) => new Response(JSON.stringify({code:'demo_ai_tools',message}),{status,headers:{'Content-Type':'application/json'}});
export const aiToolsDemoRoutes: Route[] = [
  ['GET', /^flx-ai\/v1\/admin\/tools$/, (_match,query): AiToolsResult => {
    const all=rows(); const filtered=all.filter(row=>matches(row,filterFor(Object.fromEntries(query)))); const per=Number(query.get('per_page')??30); const page=Number(query.get('page')??1); const active=all.filter(row=>!row.dupe);
    return {revision:String(revision),items:filtered.slice((page-1)*per,page*per),total:filtered.length,selectable_total:filtered.filter(row=>!row.dupe).length,page,pages:Math.max(1,Math.ceil(filtered.length/per)),sources:[...new Set(all.map(row=>row.source))].map(id=>({id,label:all.find(row=>row.source===id)!.label,total:active.filter(row=>row.source===id).length,on:active.filter(row=>row.source===id&&!row.off).length,duplicates:all.filter(row=>row.source===id&&row.dupe).length})),summary:{tools:active.length,on:active.filter(row=>!row.off).length,off:active.filter(row=>row.off).length,conflicts:1,unprefixed:1}};
  }],
  ['POST', /^flx-ai\/v1\/admin\/tools$/, (_match,_query,body) => {
    if(body.revision!==String(revision))return failure(409,'Reload the tool catalogue before saving.');
    const all=rows(); const active=all.filter(row=>!row.dupe); const changes={...(body.changes??{}) as Record<string,boolean>};
    const bulk=body.bulk as {enabled:boolean;names?:string[];filter?:AiToolFilter;exclude?:string[]}|undefined;
    if(bulk)for(const row of active)if((bulk.names?.includes(row.name)||bulk.filter&&matches(row,bulk.filter))&&!bulk.exclude?.includes(row.name))changes[row.name]=bulk.enabled;
    const pick=body.pick as {name:string;source:string}|undefined;
    if(Object.entries(changes).some(([name,value])=>!active.some(row=>row.name===name)||typeof value!=='boolean')||pick&&!all.some(row=>row.name===pick.name&&row.source===pick.source))return failure(400,'Invalid tool change.');
    for(const [name,enabled] of Object.entries(changes))if(enabled)disabled.delete(name);else disabled.add(name);
    if(pick)picked=pick.source;
    revision++; return {ok:true,changed:Object.keys(changes).length+(pick?1:0)};
  }],
];
