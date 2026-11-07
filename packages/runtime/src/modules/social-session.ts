import { createStore } from 'zustand/vanilla';
import type { ApiClient } from '@fluxwp/core';
import { mediaForm, type MediaFile } from './media';
import { emptySocialDocument, socialComposerBody, socialDocument, socialDocumentIssues, socialMediaFor, socialOverride, socialTextFor,
  type SocialAction, type SocialBoot, type SocialDocument, type SocialIssue, type SocialMedia, type SocialOptions, type SocialOverride, type SocialPost } from './social-composer';

export interface SocialSessionState {
  boot: SocialBoot | null; document: SocialDocument; tab: 'all' | number; ready: boolean; loading: boolean;
  busy: 'save' | 'ai' | 'upload' | null; dirty: boolean; error: string; issues: SocialIssue[]; uncertain: boolean; changedOnServer: boolean;
}
export class SocialSession {
  readonly store;
  private loading: Promise<void> | null = null;
  private closed = false;
  private importCache = new Map<string, SocialMedia>();
  private postId: number;
  onPersist?: (post: SocialPost) => void;
  constructor(private api: ApiClient, id = 0, at = 0) {
    this.postId = id;
    this.store = createStore<SocialSessionState>(() => ({ boot:null, document:emptySocialDocument(at), tab:'all', ready:false, loading:false, busy:null, dirty:false, error:'', issues:[], uncertain:false, changedOnServer:false }));
  }
  get state() { return this.store.getState(); }
  private patch(patch: Partial<SocialSessionState>) { if (!this.closed) this.store.setState(patch); }
  private install(post: SocialPost) {
    if (this.closed) return;
    this.postId = post.id; this.patch({ document:socialDocument(post), dirty:false, uncertain:false, changedOnServer:false, issues:[] }); this.onPersist?.(post);
  }
  load(discard = false): Promise<void> {
    if (this.closed || this.state.busy) return Promise.resolve();
    if (this.loading) return this.loading;
    const beforeLoad = this.state.document;
    this.patch({ loading:true, error:'' });
    this.loading = (async () => {
      try {
        const [boot, post] = await Promise.all([this.api<SocialBoot>('flx-social/v1/boot'), this.postId ? this.api<SocialPost>(`flx-social/v1/posts/${this.postId}`) : null]);
        if (this.closed) return;
        this.patch({ boot, ready:true });
        if (post && (!this.state.dirty || discard && this.state.document === beforeLoad)) this.install(post);
        else if (post && post.updated !== this.state.document.updated) this.patch({ changedOnServer:true });
      } catch (error) { this.patch({ error:error instanceof Error ? error.message : String(error) }); }
      finally { this.patch({ loading:false }); this.loading = null; }
    })();
    return this.loading;
  }
  edit(edit: (document: SocialDocument) => SocialDocument) {
    if (!this.closed && !this.state.busy) this.patch({ document:edit(this.state.document), dirty:true, issues:[], error:'' });
  }
  setTab(tab: 'all' | number) { if (!this.state.busy) this.patch({ tab }); }
  toggleAccount(id: number) {
    this.edit(d => d.locked.some(t=>t.account_id===id) ? d : { ...d, selected:d.selected.includes(id) ? d.selected.filter(x=>x!==id) : [...d.selected,id] });
    if (!this.state.document.selected.includes(Number(this.state.tab))) this.patch({ tab:'all' });
  }
  override(id: number, patch: Partial<SocialOverride>) { this.edit(d=>({ ...d, targets:{...d.targets,[id]:{...socialOverride(d,id),...patch}} })); }
  setText(value: string, tab = this.state.tab) { if(tab==='all') this.edit(d=>({...d,content:value})); else this.override(tab,{content:value}); }
  setOptions(id: number, options: SocialOptions) { this.override(id,{options}); }
  private putMedia(items: SocialMedia[], tab: 'all' | number) {
    if (this.closed) return;
    const d = this.state.document; const current = tab==='all' ? d.media : socialMediaFor(d,tab);
    const media = [...current,...items.filter(m=>!current.some(x=>x.id===m.id))];
    // Async uploads set their target captured at start, never a newly selected tab.
    this.patch({ document:tab==='all'?{...d,media}:{...d,targets:{...d.targets,[tab]:{...socialOverride(d,tab),media}}}, dirty:true });
  }
  setMedia(media: SocialMedia[], tab = this.state.tab) { if(tab==='all') this.edit(d=>({...d,media})); else this.override(tab,{media}); }
  async addMedia(items: SocialMedia[]) {
    if (this.closed || this.state.busy) return;
    if(items.some(m=>!m.id) && !this.state.boot?.user.upload) { this.patch({issues:[{key:'socialComposer.errors.upload'}]}); return; }
    const tab=this.state.tab; this.patch({busy:'upload',error:'',issues:[]});
    try {
      for (const item of items) {
        if(this.closed) break;
        let media=item;
        if (!media.id) {
          const cached=this.importCache.get(media.url);
          if(cached) media=cached;
          else { media=await this.api<SocialMedia>('flx-social/v1/media',{method:'POST',body:{url:media.url}}); this.importCache.set(item.url,media); }
        }
        this.putMedia([media],tab);
      }
    } catch(error) { this.patch({error:error instanceof Error?error.message:String(error)}); }
    finally { this.patch({busy:null}); }
  }
  async upload(files: MediaFile[]) {
    if(this.closed || this.state.busy || !this.state.boot?.user.upload) return;
    const tab=this.state.tab; this.patch({busy:'upload',error:'',issues:[]});
    try { for(const file of files) { if(this.closed) break; this.putMedia([await this.api<SocialMedia>('flx-social/v1/media',{method:'POST',formData:mediaForm(file)})],tab); } }
    catch(error) { this.patch({error:error instanceof Error?error.message:String(error)}); }
    finally { this.patch({busy:null}); }
  }
  async importUrl(url: string) {
    if(!this.state.boot?.user.upload) return;
    if(!/^https?:\/\//i.test(url)) { this.patch({issues:[{key:'socialComposer.errors.url'}]}); return; }
    await this.addMedia([{id:0,kind:'image',url}]);
  }
  async ai(mode: 'write'|'improve'|'shorten'|'hashtags'|'translate'|'adapt', extra: {brief?:string;to?:string} = {}) {
    if(this.closed || this.state.busy || !this.state.boot?.ai) return;
    const {document:d,tab,boot}=this.state; const text=tab==='all'?d.content:socialTextFor(d,tab);
    if(mode!=='write'&&!text.trim()) { this.patch({issues:[{key:'socialComposer.errors.aiText'}]}); return; }
    const accounts=boot!.accounts.filter(a=>tab==='all'?d.selected.includes(a.id):a.id===tab);
    const providers=[...new Set(accounts.map(a=>a.provider))];
    const limit=Math.min(280,...accounts.map(a=>a.caps?.max_text||280));
    this.patch({busy:'ai',error:'',issues:[]});
    try {
      const r=await this.api<{result:string|Record<string,string>}>('flx-social/v1/ai',{method:'POST',body:{mode,text,providers,limit,...extra}});
      if(mode==='adapt' && typeof r.result==='object') {
        const result=r.result; this.patch({document:{...d,targets:{...d.targets,...Object.fromEntries(accounts.filter(a=>typeof result[a.provider]==='string').map(a=>[a.id,{...socialOverride(d,a.id),content:result[a.provider]!}]))}},dirty:true});
      } else if(typeof r.result==='string') {
        const content=mode==='hashtags'?`${text.trimEnd()}\n\n${r.result}`:r.result;
        this.patch({document:tab==='all'?{...d,content}:{...d,targets:{...d.targets,[tab]:{...socialOverride(d,tab),content}}},dirty:true});
      }
    } catch(error) { this.patch({error:error instanceof Error?error.message:String(error)}); }
    finally { this.patch({busy:null}); }
  }
  /** Save a recoverable draft first. A failed publication then retries an existing post, never creates another public post. */
  validate(action: SocialAction) {
    const issues=this.state.boot ? socialDocumentIssues(this.state.document,this.state.boot,action) : [{key:'socialComposer.errors.loading'}];
    if(this.state.changedOnServer) issues.push({key:'socialComposer.errors.conflict'});
    this.patch({issues,error:''}); return issues;
  }
  async save(action: SocialAction): Promise<SocialPost | null> {
    if(this.closed || this.state.busy || !this.state.boot || this.state.uncertain) return null;
    const issues=this.validate(action);
    if(issues.length) return null;
    const d=this.state.document; this.patch({busy:'save'});
    try {
      const draft=await this.api<SocialPost>(`flx-social/v1/posts${d.id?'/'+d.id:''}`,{method:'POST',body:socialComposerBody(d,'draft')});
      if(this.closed) return null;
      this.install(draft);
      if(action==='draft') return draft;
      try {
        const post=await this.api<SocialPost>(`flx-social/v1/posts/${draft.id}/action`,{method:'POST',body:{action}});
        this.install(post); return post;
      } catch(error) {
        this.patch({uncertain:true});
        // The action may have reached the server. Read the same post before allowing another write.
        if(!this.closed) try {
          const recovered=await this.api<SocialPost>(`flx-social/v1/posts/${draft.id}`);
          this.install(recovered);
          // A transport failure is not a failed publication if the authoritative record advanced.
          if(action==='submit' ? recovered.status==='pending' : ['scheduled','publishing','published','partial','failed'].includes(recovered.status))return recovered;
        } catch { /* explicit refresh required */ }
        throw error;
      }
    } catch(error) { this.patch({error:error instanceof Error?error.message:String(error)}); return null; }
    finally { this.patch({busy:null}); }
  }
  dispose() { this.closed=true; this.onPersist=undefined; this.importCache.clear(); }
}

const sessions=new Map<string,{accountId:string;session:SocialSession}>();
const key=(accountId:string,id:number)=>JSON.stringify([accountId,id]);
export function socialSessionFor(accountId:string,api:ApiClient,id=0,at=0):SocialSession {
  const k=key(accountId,id); const hit=sessions.get(k); if(hit) return hit.session;
  const session=new SocialSession(api,id,at); sessions.set(k,{accountId,session});
  session.onPersist=post=>{sessions.set(key(accountId,post.id),{accountId,session});if(id===0&&sessions.get(k)?.session===session)sessions.delete(k);};
  return session;
}
export function clearSocialSessions(accountId:string) { const removed=new Set<SocialSession>(); for(const [k,value]of sessions)if(value.accountId===accountId){sessions.delete(k);removed.add(value.session);} removed.forEach(s=>s.dispose()); }
