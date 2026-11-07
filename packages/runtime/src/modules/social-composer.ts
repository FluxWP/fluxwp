// Shared social composer contract. Views are separate; payloads, account overrides and site time are not.
import type { SocialAccount } from './social';

export interface SocialCaps {
  max_text?: number; needs_media?: boolean; image?: boolean; video?: boolean; gif?: boolean;
  max_images?: number; max_videos?: number; mix?: boolean; options?: string[];
}
export interface ComposerAccount extends SocialAccount {
  status?: string; network?: string; username?: string; caps?: SocialCaps;
  boards?: { id: string; name: string }[]; playlists?: { id: string; name: string }[];
}
export interface SocialBoot {
  user: { id: number; name: string; publish: boolean; manage: boolean; upload: boolean };
  accounts: ComposerAccount[]; providers: Record<string, { label: string; color?: string; caps?: SocialCaps }>;
  ai: boolean; studio: boolean; settings: { approval: number; signature: string; tiktok_mode?: string }; tz: string; tz_offset: number;
}
export interface SocialMedia { id: number; kind: 'image' | 'gif' | 'video'; url: string; thumb?: string; name?: string; mime?: string; alt?: string; duration?: number; bytes?: number; width?: number; height?: number }
export type SocialOptions = Record<string, string | boolean | string[]>;
export interface SocialOverride { content: string | null; media: SocialMedia[] | null; options: SocialOptions }
export interface SocialTarget extends SocialOverride { id: number; account_id: number; account: string; status: string; provider: string }
export interface SocialPost {
  id: number; title: string; content: string; media: SocialMedia[]; tags: string[];
  status: string; scheduled_at: number; repeat_days: number; note?: string; updated?: number; targets: SocialTarget[];
}
export interface SocialDocument extends Omit<SocialPost, 'targets'> { selected: number[]; targets: Record<number, SocialOverride>; locked: SocialTarget[] }
export type SocialAction = 'draft' | 'submit' | 'now' | 'schedule' | 'approve';
export interface SocialIssue { key: string; vars?: Record<string, string | number>; account?: number }
export type SocialText = (key: string, vars?: Record<string, unknown>) => string;
export interface SocialOption {
  type: 'text' | 'url' | 'area' | 'select' | 'check' | 'tags' | 'date'; label: string; max?: number; required?: boolean;
  choices?: { value: string; label: string }[]; default?: string | boolean; when?: Record<string, string[]>;
}

const LOCKED = new Set(['published', 'processing', 'deleted']);
const cloneOverride = (x: SocialOverride): SocialOverride => ({ content: x.content ?? null, media: x.media?.map(m => ({ ...m })) ?? null, options: Object.fromEntries(Object.entries(x.options ?? {}).map(([key,value]) => [key, Array.isArray(value) ? [...value] : value])) });
export const emptySocialDocument = (at = 0): SocialDocument => ({ id: 0, title: '', content: '', media: [], tags: [], status: 'draft', scheduled_at: at, repeat_days: 0, selected: [], targets: {}, locked: [] });
export function socialDocument(post: SocialPost): SocialDocument {
  const editable = post.targets.filter(t => !LOCKED.has(t.status));
  return { ...post, media: post.media.map(m => ({ ...m })), tags: [...post.tags], selected: editable.map(t => t.account_id), targets: Object.fromEntries(editable.map(t => [t.account_id, cloneOverride(t)])), locked: post.targets.filter(t => LOCKED.has(t.status)).map(t => ({ ...t, ...cloneOverride(t) })) };
}
export const socialOverride = (d: SocialDocument, id: number): SocialOverride => d.targets[id] ?? { content: null, media: null, options: {} };
export const socialTextFor = (d: SocialDocument, id: number) => socialOverride(d, id).content ?? d.content;
export const socialMediaFor = (d: SocialDocument, id: number) => socialOverride(d, id).media ?? d.media;
export const socialLength = (text: string, provider: string) => Array.from(provider === 'x' ? text.replace(/https?:\/\/\S+/g, '12345678901234567890123') : text).length;
export function socialComposerBody(d: SocialDocument, action: SocialAction) {
  const locked = new Set(d.locked.map(t => t.account_id));
  return { title: d.title, content: d.content, media: d.media.map(m => m.id), tags: d.tags, source: 'app', scheduled_at: d.scheduled_at || 0, repeat_days: d.repeat_days || 0, action,
    targets: [...new Set(d.selected)].filter(id => !locked.has(id)).map(account_id => { const x = socialOverride(d, account_id); return { account_id, content: x.content, media: x.media?.map(m => m.id) ?? null, options: x.options }; }),
  };
}
export function socialAccountIssues(account: ComposerAccount, text: string, media: SocialMedia[], options: SocialOptions): SocialIssue[] {
  const c = account.caps ?? {}; const issues: SocialIssue[] = [];
  const add = (key: string, vars?: SocialIssue['vars']) => issues.push({ key: `socialComposer.errors.${key}`, account: account.id, vars });
  const images = media.filter(m => m.kind === 'image').length; const gifs = media.filter(m => m.kind === 'gif').length; const videos = media.filter(m => m.kind === 'video').length;
  if (!text.trim() && !media.length) add('empty');
  if (c.max_text && socialLength(text, account.provider) > c.max_text) add('length', { max: c.max_text, count: socialLength(text, account.provider) });
  if (c.needs_media && !media.length) add('media');
  if (images && c.image === false) add('image'); if (videos && c.video === false) add('video');
  if (media.some(m => m.kind === 'gif') && c.gif === false) add('gif');
  if (c.max_images !== undefined && images > c.max_images) add('images', { max: c.max_images });
  if (c.max_videos !== undefined && videos > c.max_videos) add('videos', { max: c.max_videos });
  if ((images || gifs) && videos && !c.mix) add('mixed');
  if (account.provider === 'youtube' && !videos) add('youtube');
  if (account.provider === 'pinterest' && !options.board) add('board');
  if (account.provider === 'instagram' && options.ig_type === 'reel' && !videos) add('reel');
  if (account.status === 'expired' || account.status === 'disabled') add('connection');
  return issues;
}
export function socialDocumentIssues(d: SocialDocument, boot: SocialBoot, action: SocialAction, now = Date.now() / 1000): SocialIssue[] {
  const issues: SocialIssue[] = [];
  if (!Number.isFinite(d.scheduled_at) || d.scheduled_at < 0) issues.push({key:'socialComposer.errors.future'});
  if (!Number.isInteger(d.repeat_days) || d.repeat_days < 0 || d.repeat_days > 365) issues.push({ key: 'socialComposer.errors.repeat' });
  if (action === 'draft') return issues;
  if (!d.selected.length) issues.push({ key: 'socialComposer.errors.accounts' });
  if ((action === 'schedule' || action === 'submit' && d.scheduled_at) && (!Number.isFinite(d.scheduled_at) || d.scheduled_at <= now)) issues.push({ key: 'socialComposer.errors.future' });
  if (action === 'approve' && !boot.user.publish) issues.push({ key: 'socialComposer.errors.publish' });
  for (const id of d.selected) {
    const a = boot.accounts.find(a => a.id === id);
    if (!a) issues.push({ key: 'socialComposer.errors.accountMissing', account: id });
    else issues.push(...socialAccountIssues(a, socialTextFor(d,id), socialMediaFor(d,id), socialOverride(d,id).options));
  }
  return issues;
}

/** Options advertised by the provider are the only fields rendered/sent by the views. */
export function socialOptionDefinitions(account: ComposerAccount, t: SocialText): Record<string, SocialOption> {
  const field = (key: string, type: SocialOption['type'], extra: Partial<SocialOption> = {}): SocialOption => ({ type, label: t(`socialComposer.options.${key}`), ...extra });
  const choices = (values: string[]) => values.map(value => ({ value, label: t(`socialComposer.choices.${value || 'none'}`) }));
  return {
    title: field(account.provider === 'youtube' ? 'videoTitle' : account.provider === 'pinterest' ? 'pinTitle' : 'title','text',{ max:100 }),
    link: field('link','url'), first_comment: field('first_comment','area'), privacy: field('privacy','select',{choices:choices(['public','unlisted','private'])}), tags: field('tags','tags'),
    flx_category: field('flx_category','select',{choices:choices(['','29','22','27','19','25','24'])}),
    playlist: field('playlist','select',{choices:[{value:'',label:t('socialComposer.choices.none')},...(account.playlists ?? []).map(p=>({value:p.id,label:p.name}))]}),
    made_for_kids:field('made_for_kids','check'), notify:field('notify','check',{default:true}), shorts:field('shorts','check'), ai_generated:field('ai_generated','check'),
    ig_type:field('ig_type','select',{choices:choices(['feed','reel','story']),default:'feed'}),
    share_to_feed:field('share_to_feed','check',{default:true,when:{ig_type:['reel']}}), thumb_url:field('thumb_url','url',{when:{ig_type:['reel']}}),
    li_visibility:field('privacy','select',{choices:choices(['PUBLIC','CONNECTIONS'])}), alt:field('alt','text'), reply_settings:field('reply_settings','select',{choices:choices(['','following','mentionedUsers','verified'])}),
    board:field('board','select',{required:true,choices:[{value:'',label:t('socialComposer.choose')},...(account.boards ?? []).map(b=>({value:b.id,label:b.name}))]}),
    tiktok_privacy:field('tiktok_privacy','select',{choices:choices(['PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS','FOLLOWER_OF_CREATOR','SELF_ONLY'])}),
    disable_comment:field('disable_comment','check'), disable_duet:field('disable_duet','check'), disable_stitch:field('disable_stitch','check'),
    brand_content:field('brand_content','check'), brand_organic:field('brand_organic','check'), auto_music:field('auto_music','check'),
    gbp_topic:field('gbp_topic','select',{choices:choices(['STANDARD','EVENT','OFFER']),default:'STANDARD'}), gbp_cta:field('gbp_cta','select',{choices:choices(['','LEARN_MORE','BOOK','ORDER','SHOP','SIGN_UP','CALL'])}),
    gbp_cta_url:field('gbp_cta_url','url'), event_title:field('event_title','text',{when:{gbp_topic:['EVENT','OFFER']}}), event_start:field('event_start','date',{when:{gbp_topic:['EVENT','OFFER']}}),
    event_end:field('event_end','date',{when:{gbp_topic:['EVENT','OFFER']}}), offer_code:field('offer_code','text',{when:{gbp_topic:['OFFER']}}),
    wa_kind:field('wa_kind','select',{choices:choices(['group','status','contact'])}), wa_to:field('wa_to','text'),
  };
}
export function socialVisibleOptions(a: ComposerAccount, values: SocialOptions, t: SocialText): [string, SocialOption][] {
  const defs = socialOptionDefinitions(a,t);
  return (a.caps?.options ?? []).flatMap(id => { const f = defs[id]; return f && (!f.when || Object.entries(f.when).every(([key, valid]) => valid.includes(String(values[key] ?? defs[key]?.default ?? defs[key]?.choices?.[0]?.value ?? '')))) ? [[id,f] as [string,SocialOption]] : []; });
}

type Zone = Pick<SocialBoot,'tz'|'tz_offset'>;
function wallDate(seconds: number, zone: Zone): Date {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone:zone.tz, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' }).formatToParts(new Date(seconds*1000));
    const p = Object.fromEntries(parts.map(v=>[v.type,v.value]));
    return new Date(Date.UTC(+p.year!, +p.month!-1, +p.day!, +p.hour!, +p.minute!, +p.second!));
  } catch { return new Date((seconds + (zone.tz_offset || 0))*1000); }
}
export const socialLocalInput = (seconds: number, zone: Zone): string => seconds > 0 && Number.isFinite(seconds) ? wallDate(seconds,zone).toISOString().slice(0,16) : '';
/** IANA timezone conversion: reject a nonexistent DST wall time, choose the first occurrence on a fold. */
export function socialInputTime(value: string, zone: Zone): number {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) return 0;
  const wall = Date.parse(value+'Z')/1000;
  if (!Number.isFinite(wall) || new Date(wall*1000).toISOString().slice(0,16)!==value) return 0;
  const offsets = [-86400,0,86400].map(delta => (wallDate(wall+delta,zone).getTime()/1000) - (wall+delta));
  const matches = [...new Set(offsets)].map(offset=>wall-offset).filter(ts=>socialLocalInput(ts,zone)===value);
  return matches.length ? Math.min(...matches) : 0;
}
export function socialQuickTime(kind: 'hour'|'tomorrow'|'weekend', zone: Zone, now = Math.floor(Date.now()/1000)): number {
  if (kind==='hour') return now+3600-(now%300);
  const wall=wallDate(now,zone); wall.setUTCDate(wall.getUTCDate()+(kind==='weekend' ? (6-wall.getUTCDay()+7)%7 || 7 : 1)); wall.setUTCHours(kind==='weekend'?11:10,0,0,0);
  return socialInputTime(wall.toISOString().slice(0,16),zone);
}
