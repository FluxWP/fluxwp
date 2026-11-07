import {describe,it,expect,vi} from 'vitest';
import type {ApiClient} from '@fluxwp/core';
import {emptySocialDocument,socialComposerBody,socialDocument,socialDocumentIssues,socialInputTime,socialLocalInput,socialVisibleOptions,type SocialBoot,type SocialPost} from './social-composer';
import {SocialSession,clearSocialSessions,socialSessionFor} from './social-session';
const boot:SocialBoot={user:{id:7,name:'Demo',publish:true,manage:true,upload:true},accounts:[{id:1,name:'First',provider:'x',caps:{max_text:280,image:true,max_images:4}},{id:2,name:'Second',provider:'instagram',caps:{needs_media:true,image:true,max_images:10,options:['ig_type','share_to_feed','thumb_url']}}],providers:{},ai:true,studio:true,settings:{approval:0,signature:''},tz:'Europe/Istanbul',tz_offset:10800};
const post=(patch:Partial<SocialPost>={}):SocialPost=>({id:51,title:'',content:'Common',media:[],tags:[],status:'draft',scheduled_at:0,repeat_days:0,updated:1,targets:[{id:61,account_id:1,account:'First',provider:'x',status:'draft',content:null,media:null,options:{}}],...patch});
const deferred=<T>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};};
const makeApi=(fn:(path:string,options?:any)=>unknown)=>vi.fn(fn) as unknown as ApiClient;
describe('social composer contract',()=>{
 it('preserves explicit empty overrides and excludes already public or processing targets',()=>{
  const p=post();p.targets[0]!.content='';p.targets[0]!.media=[];p.targets.push({...p.targets[0]!,id:62,account_id:2,status:'published'});
  const d=socialDocument(p);const body=socialComposerBody(d,'draft');
  expect(body.targets).toEqual([{account_id:1,content:'',media:[],options:{}}]);
  expect(d.locked.map(t=>t.account_id)).toEqual([2]);
  d.targets[1]!.media!.push({id:100,url:'https://example.test/a.jpg',kind:'image'});expect(p.targets[0]!.media).toEqual([]);
 });
 it('validates actual per-account overrides, permissions and non-finite schedule/repeat values',()=>{
  const d=emptySocialDocument();d.selected=[1,2];d.content='Hello';d.targets[2]={content:'',media:[],options:{ig_type:'reel'}};
  expect(socialDocumentIssues(d,boot,'now').map(i=>i.key)).toEqual(expect.arrayContaining(['socialComposer.errors.empty','socialComposer.errors.media','socialComposer.errors.reel']));
  d.repeat_days=NaN;d.scheduled_at=NaN;
  expect(socialDocumentIssues(d,boot,'draft').map(i=>i.key)).toContain('socialComposer.errors.repeat');
  expect(socialDocumentIssues(d,{...boot,user:{...boot.user,publish:false}},'approve').map(i=>i.key)).toContain('socialComposer.errors.publish');
 });
 it('round-trips site time and rejects impossible DST times instead of silently moving the post',()=>{
  const z={tz:'America/New_York',tz_offset:-18000};
  expect(socialInputTime('2026-03-08T02:30',z)).toBe(0);
  const fold=socialInputTime('2026-11-01T01:30',z);
  expect(new Date(fold*1000).toISOString()).toBe('2026-11-01T05:30:00.000Z');
  expect(socialLocalInput(fold,z)).toBe('2026-11-01T01:30');
  expect(socialInputTime('2026-02-30T12:00',z)).toBe(0);
  expect(socialLocalInput(socialInputTime('2026-11-07T18:15',boot),boot)).toBe('2026-11-07T18:15');
 });
 it('shows only advertised provider options and their active conditions',()=>{
  const a=boot.accounts[1]!;
  expect(socialVisibleOptions(a,{ig_type:'feed'},k=>k).map(([id])=>id)).toEqual(['ig_type']);
  expect(socialVisibleOptions(a,{ig_type:'reel'},k=>k).map(([id])=>id)).toEqual(['ig_type','share_to_feed','thumb_url']);
 });
});
describe('social session publication and isolation',()=>{
 it('saves a draft before publication and recovers the same record when the action response is lost',async()=>{
  const api=makeApi((path,o)=>path.endsWith('/boot')?boot:o?.method==='POST'?(path.endsWith('/action')?Promise.reject(new Error('connection lost')):post()):post({status:'scheduled'}));
  const s=new SocialSession(api);await s.load();s.setText('Hello');s.toggleAccount(1);
  expect((await s.save('now'))?.status).toBe('scheduled');
  expect((api as any).mock.calls.filter(([,o]:any[])=>o?.method==='POST').map(([path,o]:any[])=>[path,o.body.action])).toEqual([['flx-social/v1/posts','draft'],['flx-social/v1/posts/51/action','now']]);
  expect(s.state.uncertain).toBe(false);expect(s.state.error).toBe('');
 });
 it('blocks a retry after an ambiguous action until an authoritative refresh succeeds',async()=>{
  let readFails=true;const api=makeApi((path,o)=>path.endsWith('/boot')?boot:o?.method==='POST'?(path.endsWith('/action')?Promise.reject(new Error('lost')):post()):readFails?Promise.reject(new Error('offline')):post({status:'scheduled'}));
  const s=new SocialSession(api);await s.load();s.setText('Hello');s.toggleAccount(1);
  expect(await s.save('now')).toBeNull();expect(s.state.document.id).toBe(51);expect(s.state.uncertain).toBe(true);
  const calls=(api as any).mock.calls.length;await s.save('now');expect((api as any).mock.calls.length).toBe(calls);
  readFails=false;await s.load();expect(s.state.uncertain).toBe(false);expect(s.state.document.status).toBe('scheduled');
 });
 it('retains unsaved edits when refresh finishes after another edit',async()=>{
  const remote=deferred<SocialPost>();let reads=0;
  const api=makeApi(path=>path.endsWith('/boot')?boot:++reads===1?post():remote.promise);
  const s=new SocialSession(api,51);await s.load();s.setText('Unsaved');const loading=s.load(true);s.setText('Newer unsaved');remote.resolve(post({content:'Server content',updated:2}));await loading;
  expect(s.state.document.content).toBe('Newer unsaved');expect(s.state.changedOnServer).toBe(true);
 });
 it('keeps uploaded media in its original account version and deduplicates a Studio import',async()=>{
  const imported=deferred<any>();const api=makeApi(path=>path.endsWith('/boot')?boot:imported.promise);
  const s=new SocialSession(api);await s.load();s.toggleAccount(1);s.setTab(1);
  const adding=s.addMedia([{id:0,url:'https://example.test/studio.jpg',kind:'image'}]);
  s.setTab('all');imported.resolve({id:90,url:'https://example.test/media.jpg',kind:'image'});await adding;
  expect(s.state.document.media).toEqual([]);expect(s.state.document.targets[1]!.media?.map(m=>m.id)).toEqual([90]);
  await s.addMedia([{id:0,url:'https://example.test/studio.jpg',kind:'image'}]);
  expect((api as any).mock.calls.filter(([p]:any[])=>p==='flx-social/v1/media')).toHaveLength(1);
  expect(s.state.document.targets[1]!.media).toHaveLength(1);
 });
 it('does not continue publication or reinsert a session after its account is removed',async()=>{
  const draft=deferred<SocialPost>();const api=makeApi(path=>path.endsWith('/boot')?boot:draft.promise);
  const s=socialSessionFor('removed-account',api);await s.load();s.setText('Hello');s.toggleAccount(1);const saving=s.save('now');
  clearSocialSessions('removed-account');draft.resolve(post());expect(await saving).toBeNull();
  expect((api as any).mock.calls.some(([p]:any[])=>p.endsWith('/action'))).toBe(false);
  const fresh=socialSessionFor('removed-account',api,51);expect(fresh).not.toBe(s);clearSocialSessions('removed-account');
 });
 it('adapts selected accounts while preserving common text and existing provider options',async()=>{
  const api=makeApi(path=>path.endsWith('/boot')?boot:{result:{x:'Short X version',instagram:'Image caption'}});const s=new SocialSession(api);await s.load();s.setText('Common draft');s.toggleAccount(1);s.toggleAccount(2);s.setOptions(1,{reply_settings:'following'});
  await s.ai('adapt');
  expect(s.state.document.content).toBe('Common draft');expect(s.state.document.targets[1]).toMatchObject({content:'Short X version',options:{reply_settings:'following'}});expect(s.state.document.targets[2]?.content).toBe('Image caption');
  expect((api as any).mock.calls[1][1].body).toMatchObject({mode:'adapt',text:'Common draft',providers:['x','instagram']});
 });
 it('does not import remote media or call AI without the corresponding server capability',async()=>{
  const api=makeApi(()=>({...boot,user:{...boot.user,upload:false},ai:false}));const s=new SocialSession(api);await s.load();
  await s.addMedia([{id:0,url:'https://example.test/a.jpg',kind:'image'}]);await s.ai('write',{brief:'Hello'});
  expect((api as any).mock.calls).toHaveLength(1);expect(s.state.issues[0]?.key).toBe('socialComposer.errors.upload');
 });
});
