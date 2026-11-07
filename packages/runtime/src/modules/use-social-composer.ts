import { useEffect, useMemo, useRef } from 'react';
import { useStore } from 'zustand';
import { useScope } from '../scope';
import { qk } from '../query';
import { socialSessionFor } from './social-session';
import { socialLocalInput, type SocialAction } from './social-composer';

/** One account-scoped controller for native iOS, Android and desktop views. */
export function useSocialComposer(params: Record<string,string>) {
  const { account, api, client, renderer }=useScope();
  const invalidId=!!params.id&&!/^[1-9]\d*$/.test(params.id);
  const id=!invalidId?Number(params.id||0):0;
  const at=Number(params.at||0); const session=useMemo(()=>socialSessionFor(account.id,api,id,Number.isFinite(at)?at:0),[account.id,api,id,at]);
  const state=useStore(session.store); const active=useRef<typeof session|null>(null); const t=renderer.t;
  useEffect(()=>{active.current=session; if(!invalidId)void session.load(); return()=>{active.current=null;};},[session,invalidId]);
  const refresh=async()=>{if(!state.dirty||await renderer.ui.confirm({title:t('socialComposer.reload'),body:t('socialComposer.discard')}))await session.load(true);};
  const save=async(action:SocialAction)=>{
    if(invalidId||state.busy||session.validate(action).length)return;
    const boot=session.state.boot!; const d=session.state.document;
    if(action!=='draft'&&!await renderer.ui.confirm({title:t(`socialComposer.actions.${action}`),body:t('socialComposer.confirmBody',{
      accounts:boot.accounts.filter(a=>d.selected.includes(a.id)).map(a=>`${a.network||a.provider} · ${a.name}`).join(', '),
      site:account.siteName,when:d.scheduled_at?`${socialLocalInput(d.scheduled_at,boot).replace('T',' ')} (${boot.tz})`:t('socialComposer.now'),
    })}))return;
    const post=await session.save(action); if(!post)return;
    for(const source of ['posts','post','calendar'])void client.invalidateQueries({queryKey:qk.sourceRoot('social',source)});
    if(active.current!==session)return;
    const failed=['failed','partial'].includes(post.status);
    renderer.ui.toast(t(failed?'socialComposer.saved.failed':post.status==='published'?'socialComposer.saved.published':post.status==='pending'?'socialComposer.saved.submit':`socialComposer.saved.${action}`),failed?'error':'ok');
    if(action==='draft')renderer.nav.replace({kind:'native',component:'flxsm-composer',params:{id:String(post.id)}});
    else renderer.nav.replace({kind:'manifest',module:'social',screen:'post',params:{id:String(post.id)}});
  };
  return {session,state,invalidId,refresh,save,t,account,api,renderer};
}
