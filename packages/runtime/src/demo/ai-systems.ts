import { getDemoLocale } from '@fluxwp/core/src/demo/locale';
import type { AiSystemDetail, AiSystemField, AiSystemRow } from '../modules/ai-systems';
type Route=[string,RegExp,(match:RegExpMatchArray,query:URLSearchParams,body:Record<string,unknown>)=>unknown];
const stored=new Map<string,{revision:number;enabled:boolean;model:string;values:Record<string,string|number|boolean>}>();
const ids=['flxseo','flxcrm','flxmail','flx-chatbot',...Array.from({length:31},(_,i)=>`demo-${String(i+1).padStart(2,'0')}`)];
const labels:Record<string,string>={flxseo:'Flux SEO',flxcrm:'Flux CRM',flxmail:'Flux Mail','flx-chatbot':'Flux Chatbot'};
const fold=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const failure=(status:number,message:string)=>new Response(JSON.stringify({code:'demo_ai_system',message}),{status,headers:{'Content-Type':'application/json'}});
const fields=():AiSystemField[]=>{
 const en=getDemoLocale()==='en';return[
  {key:'feature',type:'toggle',label:en?'Content assistance':'İçerik yardımı',help:'',supported:true,value:true},
  {key:'temperature',type:'number',label:en?'Temperature':'Sıcaklık',help:en?'A fractional value between 0 and 1.':'0 ile 1 arasında ondalık değer.',supported:true,value:.5,min:0,max:1},
  {key:'mode',type:'select',label:en?'Workflow':'Çalışma biçimi',help:'',supported:true,value:'review',options:[{value:'draft',label:en?'Draft':'Taslak'},{value:'review',label:en?'Human review':'İnsan onayı'}]},
  {key:'prompt',type:'textarea',label:en?'Instructions':'Yönergeler',help:'',supported:true,value:en?'Keep the original meaning.':'İçeriğin anlamını koru.'},
  {key:'signature',type:'text',label:en?'Signature':'İmza',help:'',supported:true,value:'FluxWP'},
  {key:'model',type:'model',label:en?'Feature model':'Özellik modeli',help:'',supported:true,value:''},
 ];
};
const state=(id:string)=>{let value=stored.get(id);if(!value){value={revision:1,enabled:true,model:'',values:{}};stored.set(id,value);}return value;};
const row=(source:string,index:number):AiSystemRow=>({source,label:labels[source]??`Demo ${index-3}`,installed:index!==33,active:index<33,page:'',on:state(source).enabled,model:state(source).model||'demo/model-1',calls:42+index,tools:6,tok:4200,cost:.125,errors:index===0?1:0,last:Math.floor(Date.now()/1000)-7200});
const detail=(source:string):AiSystemDetail|undefined=>{const i=ids.indexOf(source);if(i<0)return;const s=state(source);return{...row(source,i),description:getDemoLocale()==='en'?'Plugin-specific AI features and model preferences.':'Eklentiye özel yapay zekâ özellikleri ve model tercihleri.',configured_model:s.model,default_model:'demo/model-1',fields:fields().map(f=>({...f,value:s.values[f.key]??f.value})),revision:String(s.revision),tool_count:8,tools_enabled:6,sdk_version:'1.0.0'};};
export const aiSystemsDemoRoutes:Route[]=[
 ['GET',/^flx-ai\/v1\/admin\/systems$/,(_m,q)=>{const rows=ids.map(row).filter(r=>fold(`${r.source} ${r.label}`).includes(fold(q.get('q')??'')));const page=Number(q.get('page')??1);const per=Number(q.get('per_page')??30);return{items:rows.slice((page-1)*per,page*per),total:rows.length,page,pages:Math.max(1,Math.ceil(rows.length/per))};}],
 ['GET',/^flx-ai\/v1\/admin\/systems\/([a-z0-9_-]+)$/,m=>detail(m[1]!)??failure(404,'System not found.')],
 ['POST',/^flx-ai\/v1\/admin\/systems\/([a-z0-9_-]+)$/, (m,_q,b)=>{const d=detail(m[1]!);if(!d)return failure(404,'System not found.');if(b.revision!==d.revision)return failure(409,'System changed. Refresh before saving.');const s=state(d.source);const values={...s.values,...b.values as Record<string,string|number|boolean>};for(const f of d.fields)if(f.type==='number'&&f.key in values)values[f.key]=Math.max(f.min??-Infinity,Math.min(f.max??Infinity,Number(values[f.key])));stored.set(d.source,{revision:s.revision+1,enabled:!!b.enabled,model:String(b.model??''),values});return detail(d.source);}],
 ['GET',/^flx-ai\/v1\/models$/,()=>({models:Array.from({length:12},(_,i)=>({id:`demo/model-${i+1}`,name:`Demo model ${i+1}`,provider:'Demo'})),providers:[]})],
];
