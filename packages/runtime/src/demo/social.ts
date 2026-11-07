// Fictional social network state. This transport never sends anything to a real social provider.
import type {ComposerAccount,SocialBoot,SocialMedia,SocialPost} from '../modules/social-composer';
type Handler=(m:RegExpMatchArray,q:URLSearchParams,body:Record<string,unknown>)=>unknown;
const copy=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
const image=(label:string)=>'data:image/svg+xml;utf8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect width="640" height="640" fill="#4338ca"/><text x="320" y="330" text-anchor="middle" fill="white" font-family="sans-serif" font-size="40">${label}</text></svg>`);
export function socialDemoRoutes():[string,RegExp,Handler][]{
 const accounts:ComposerAccount[]=[
  {id:1,name:'Demo Site',provider:'instagram',network:'Instagram',status:'active',caps:{max_text:2200,needs_media:true,image:true,video:true,max_images:10,max_videos:1,mix:false,options:['ig_type','share_to_feed','thumb_url','first_comment']}},
  {id:2,name:'Demo Updates',provider:'x',network:'X',status:'active',caps:{max_text:280,image:true,video:true,gif:true,max_images:4,max_videos:1,mix:false,options:['reply_settings','alt']}},
  {id:3,name:'Demo Ideas',provider:'pinterest',network:'Pinterest',status:'active',boards:[{id:'design',name:'Design ideas'},{id:'news',name:'News'}],caps:{max_text:500,needs_media:true,image:true,video:true,max_images:1,max_videos:1,options:['title','board','link','alt']}},
  {id:4,name:'Demo Videos',provider:'youtube',network:'YouTube',status:'active',playlists:[{id:'videos',name:'Demo videos'}],caps:{max_text:5000,needs_media:true,image:false,video:true,max_videos:1,options:['title','privacy','tags','flx_category','playlist','made_for_kids','notify','shorts','ai_generated']}},
  {id:5,name:'Demo Business',provider:'gbp',network:'Google Business',status:'active',caps:{max_text:1500,image:true,video:true,max_images:1,options:['gbp_topic','gbp_cta','gbp_cta_url','event_title','event_start','event_end','offer_code']}},
 ];
 const boot:SocialBoot={user:{id:1,name:'Demo User',publish:true,manage:true,upload:true},providers:{},accounts,ai:true,studio:true,settings:{approval:0,signature:'Demo Site'},tz:'Europe/Istanbul',tz_offset:10800};
 let seq=900;const posts=new Map<number,SocialPost>();const media:SocialMedia[]=Array.from({length:45},(_,i)=>({id:i+11,kind:'image',url:image(`Demo ${i+1}`),name:`Demo image ${i+1}`}));
 const out=(p:SocialPost)=>({...copy(p),accounts_label:p.targets.map(t=>t.account).join(', '),when_label:p.scheduled_at?new Date(p.scheduled_at*1000).toISOString():'',excerpt:p.content.slice(0,140)});
 const list=(q:URLSearchParams)=>{const all=[...posts.values()].filter(p=>(!q.get('status')||q.get('status')!.split(',').includes(p.status))&&(!q.get('q')||`${p.title} ${p.content}`.toLocaleLowerCase().includes(q.get('q')!.toLocaleLowerCase())));return {items:all.map(out),total:all.length,page:1,pages:1};};
 return [
 ['GET',/^flx-social\/v1\/boot$/,()=>copy(boot)],
 ['GET',/^flx-social\/v1\/accounts$/,()=>copy(accounts)],
 ['GET',/^flx-social\/v1\/(posts|calendar)$/,(_m,q)=>list(q)],
 ['POST',/^flx-social\/v1\/posts(?:\/(\d+))?$/, (m,_q,b)=>{
  const id=Number(m[1]||++seq);const old=posts.get(id);const locked=old?.targets.filter(t=>['published','processing','deleted'].includes(t.status))||[];
  const targets=(Array.isArray(b.targets)?b.targets:[]) as {account_id:number;content:string|null;media:number[]|null;options:Record<string,string|boolean|string[]>}[];
  const p:SocialPost={id,title:String(b.title||''),content:String(b.content||''),media:media.filter(m=>(b.media as number[]||[]).includes(m.id)),tags:b.tags as string[]||[],status:'draft',scheduled_at:Number(b.scheduled_at||0),repeat_days:Number(b.repeat_days||0),updated:Date.now(),targets:[...locked,...targets.filter(t=>!locked.some(l=>l.account_id===t.account_id)).map((t,i)=>({id:id*10+i,account_id:t.account_id,provider:accounts.find(a=>a.id===t.account_id)?.provider||'',account:accounts.find(a=>a.id===t.account_id)?.name||'',status:'draft',content:t.content??null,media:t.media===null?null:media.filter(m=>(t.media||[]).includes(m.id)),options:t.options||{}}))]};posts.set(id,p);return out(p);
 }],
 ['GET',/^flx-social\/v1\/posts\/(\d+)$/,m=>{const p=posts.get(Number(m[1]));return p?out(p):null;}],
 ['POST',/^flx-social\/v1\/posts\/(\d+)\/action$/, (m,_q,b)=>{const p=posts.get(Number(m[1]));if(!p)return null;p.status=b.action==='submit'?'pending':'scheduled';p.targets=p.targets.map(t=>t.status==='published'?t:{...t,status:p.status==='pending'?'draft':'scheduled'});p.updated=Date.now();return out(p);}],
 ['GET',/^flx-social\/v1\/media$/,(_m,q)=>{const all=media.filter(m=>(m.name||'').toLocaleLowerCase().includes((q.get('q')||'').toLocaleLowerCase()));const page=Number(q.get('page')||1);return {items:copy(all.slice((page-1)*20,page*20)),pages:Math.max(1,Math.ceil(all.length/20))};}],
 ['POST',/^flx-social\/v1\/media$/,()=>{const m:SocialMedia={id:++seq,kind:'image',url:image('Imported demo'),name:'Imported demo media'};media.push(m);return copy(m);}],
 ['GET',/^flx-social\/v1\/media\/studio$/,()=>({items:[{id:7,attachment_id:0,kind:'image',title:'Demo Studio illustration',url:image('Studio'),prompt:'Demo image'}]})],
 ['POST',/^flx-social\/v1\/ai$/,(_m,_q,b)=>({result:b.mode==='adapt'?Object.fromEntries((b.providers as string[]||[]).map(p=>[p,`${String(b.text||'Demo text')} (${p})`])):b.mode==='hashtags'?'#Demo #FluxWP':`Demo: ${String(b.brief||b.text||'Sample post')}`})],
 ];
}
