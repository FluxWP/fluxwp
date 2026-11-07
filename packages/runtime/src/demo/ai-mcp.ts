import type { AiMcpState } from '../modules/ai-mcp';
import { getDemoLocale } from '@fluxwp/core/src/demo/locale';
type Route=[string,RegExp,(match:RegExpMatchArray,query:URLSearchParams,body:Record<string,unknown>)=>unknown];
let revision=1;let enabled=false;let sequence=1;
let keys:AiMcpState['keys']=[{id:'demo-key',name:'Demo assistant',hint:'DEMO',user:1,owner:'demo',created:1_700_000_000,last_used:0,tools:['demo_read_2']}];
const tools=():AiMcpState['tools']=>Array.from({length:45},(_,i)=>({name:`demo_${i%3?'read':'write'}_${i+1}`,title:getDemoLocale()==='en'?`Demo ${i%3?'read':'write'} tool ${i+1}`:`Demo ${i%3?'okuma':'yazma'} aracı ${i+1}`,description:getDemoLocale()==='en'?'Demonstration tool. No external action is performed.':'Örnek araç. Dışarıda işlem yapılmaz.',source:i%2?'flxseo':'flxcrm',label:i%2?'Flux SEO':'Flux CRM',readonly:!!(i%3),off:i===44,allowed:true}));
const snapshot=():AiMcpState=>({revision:String(revision),enabled,legacy:false,url:'https://demo.fluxapp.local/wp-json/flx-mcp/v1/mcp',slug:'demo-site',keys:structuredClone(keys),tools:tools(),log:[{at:1_700_000_000,owner:'demo',tool:'demo_read_2',target:'Demo article',ok:true}]});
const failure=(status:number,message:string)=>new Response(JSON.stringify({code:'demo_mcp',message}),{status,headers:{'Content-Type':'application/json'}});
export const aiMcpDemoRoutes:Route[]=[
 ['GET',/^flx-ai\/v1\/admin\/mcp$/,()=>snapshot()],
 ['POST',/^flx-ai\/v1\/admin\/mcp$/,(_m,_q,b)=>{
  if(b.revision!==String(revision))return failure(409,'MCP settings changed. Refresh before saving.');
  let created:undefined|{id:string;secret:string};
  if(b.action==='toggle'&&typeof b.enabled==='boolean')enabled=b.enabled;
  else if(b.action==='create'&&typeof b.name==='string'&&Array.isArray(b.tools)&&['selected','all'].includes(String(b.scope))){
   if(b.scope==='selected'&&!b.tools.length||b.scope==='all'&&b.tools.length||b.tools.some(n=>!tools().some(t=>t.name===n)))return failure(400,'Invalid scope.');
   const id=`demo-key-${++sequence}`;created={id,secret:`demo-only-not-a-real-credential-${sequence}`};keys.push({id,name:b.name||'Demo assistant',hint:'DEMO',user:1,owner:'demo',created:Math.floor(Date.now()/1000),last_used:0,tools:b.scope==='all'?null:b.tools as string[]});
  }else if(b.action==='revoke'&&keys.some(k=>k.id===b.id))keys=keys.filter(k=>k.id!==b.id);
  else return failure(400,'Invalid MCP action.');
  revision++;return{state:snapshot(),...(created?{created}:{})};
 }],
];
