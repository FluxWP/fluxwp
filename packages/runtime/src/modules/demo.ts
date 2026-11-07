// Demo REST for the native screens (media, social, studio, AI, TV). The chat/tasks/review
// fixtures already live in @fluxwp/core's demo transport.
import type { AiChat } from './ai';
import type { WpMedia } from './media';
import { socialDemoRoutes } from '../demo/social';
import type { StudioItem } from './studio';
import type { TvState } from './tv';

type Q = URLSearchParams;
type Handler = (m: RegExpMatchArray, q: Q, body: Record<string, unknown>) => unknown;

const svg = (color: string, label: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><rect width="640" height="640" fill="${color}"/><text x="320" y="330" text-anchor="middle" font-family="sans-serif" font-size="42" fill="#fff">${label}</text></svg>`,
  );

let seq = 800;
const media: WpMedia[] = [
  { id: 11, source_url: svg('#1D7932', 'Fidan'), alt_text: 'Fidan dikimi', mime_type: 'image/svg+xml', title: { rendered: 'Fidan' } },
  { id: 12, source_url: svg('#2563eb', 'Etkinlik'), alt_text: '11 Kasım afişi', mime_type: 'image/svg+xml', title: { rendered: 'Etkinlik' } },
  { id: 13, source_url: svg('#db2777', 'Sosyal'), alt_text: 'Instagram karesi', mime_type: 'image/svg+xml', title: { rendered: 'Sosyal' } },
  { id: 14, source_url: svg('#d97706', 'Dekont'), alt_text: 'Bağış dekontu', mime_type: 'image/svg+xml', title: { rendered: 'Dekont' } },
  { id: 15, source_url: svg('#0f766e', 'Orman'), alt_text: 'Hatıra ormanı', mime_type: 'image/svg+xml', title: { rendered: 'Orman' } },
  { id: 16, source_url: svg('#7c3aed', 'Gönüllü'), alt_text: 'Gönüllü ekibi', mime_type: 'image/svg+xml', title: { rendered: 'Gönüllü' } },
];

const gallery: StudioItem[] = [
  { id: 1, kind: 'image', state: 'done', prompt: 'Sabah ışığında fidan diken gönüllüler, doğal renkler', url: svg('#1D7932', 'Fidan'), thumb: svg('#1D7932', 'Fidan'), job: 'flxmd_a' },
  { id: 2, kind: 'image', state: 'done', prompt: 'Hatıra ormanı tabelası, ahşap, yeşil fon', url: svg('#0f766e', 'Tabela'), thumb: svg('#0f766e', 'Tabela'), job: 'flxmd_b' },
  { id: 3, kind: 'video', state: 'running', prompt: 'Dikim gününden 5 saniyelik kesit', job: 'flxmd_c' },
];

const aiChat: AiChat = {
  id: 7,
  title: 'Fidan dikim duyurusu',
  status: 'idle',
  total: 2,
  pending: [],
  messages: [
    { role: 'user', content: '11 Kasım fidan dikimi için kısa bir duyuru yaz.' },
    { role: 'assistant', content: '11 Kasım’da Sarıyer’de 1.500 fidan dikiyoruz. Gönüllü olmak için bize yazın; eldiven ve su bizden.' },
  ],
};

let tv: TvState = {
  online: true,
  same_wifi: true,
  name: 'Salon TV',
  volume: 12,
  muted: false,
  app: 'Ana ekran',
  apps: [
    { id: 'com.netflix.ninja', name: 'Netflix' },
    { id: 'com.google.android.youtube.tv', name: 'YouTube' },
    { id: 'org.ornek.canli', name: 'Canlı yayın' },
  ],
};

const page = <T>(all: T[], q: Q) => {
  const per = Number(q.get('per_page') ?? 30);
  const p = Number(q.get('page') ?? 1);
  const items = all.slice((p - 1) * per, p * per);
  return new Response(JSON.stringify(items), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'X-WP-Total': String(all.length), 'X-WP-TotalPages': String(Math.max(1, Math.ceil(all.length / per))) },
  });
};

export const moduleDemoRoutes: [string, RegExp, Handler][] = [
  ...socialDemoRoutes(),
  ['GET', /^wp\/v2\/media$/, (_m, q) => page(media, q)],
  ['POST', /^wp\/v2\/media$/, (_m, _q, b) => {
    const item: WpMedia = {
      id: ++seq,
      source_url: svg('#1D7932', 'Yeni'),
      alt_text: typeof b.alt_text === 'string' ? b.alt_text : '',
      mime_type: 'image/jpeg',
      title: { rendered: typeof b.title === 'string' ? b.title : 'Yeni' },
    };
    media.unshift(item);
    return item;
  }],
  ['POST', /^wp\/v2\/media\/(\d+)$/, (m, _q, b) => {
    const item = media.find((x) => x.id === Number(m[1]));
    if (item && typeof b.alt_text === 'string') item.alt_text = b.alt_text;
    return item ?? null;
  }],
  ['GET', /^flx-studio\/v1\/boot$/, () => ({
    user: { id: 1, name: 'Demo Kullanıcı', manage: true },
    ai: { media: true, text: true },
    models: {
      models: {
        'flux-image': { id: 'flux-image', label: 'Flux Görsel', kind: 'image' },
        'flux-video': { id: 'flux-video', label: 'Flux Video', kind: 'video' },
      },
      default_image: 'flux-image',
      default_video: 'flux-video',
    },
    settings: { image_model: 'flux-image', video_model: 'flux-video', max_n: 4 },
  })],
  ['GET', /^flx-studio\/v1\/items$/, () => ({ items: gallery })],
  ['POST', /^flx-studio\/v1\/generate$/, (_m, _q, b) => {
    const item: StudioItem = {
      id: ++seq,
      kind: b.kind === 'video' ? 'video' : 'image',
      state: 'running',
      prompt: String(b.prompt ?? ''),
      job: 'flxmd_' + seq,
    };
    gallery.unshift(item);
    return { items: [item] };
  }],
  ['GET', /^flx-studio\/v1\/poll$/, (_m, q) => {
    const jobs = (q.get('jobs') ?? '').split(',').filter(Boolean);
    for (const item of gallery) if (item.job && jobs.includes(item.job) && item.state === 'running') {
      item.state = 'done';
      item.url = svg('#1D7932', 'Yeni');
      item.thumb = item.url;
    }
    return { items: gallery.filter((i) => i.job && jobs.includes(i.job)) };
  }],
  ['GET', /^flx-ai\/v1\/boot$/, () => ({ ready: true, model: 'demo', modelLabel: 'Demo model', tools: {}, canManage: false, counts: { chats: 1 } })],
  ['GET', /^flx-ai\/v1\/chats$/, () => ({ chats: [{ id: aiChat.id, title: aiChat.title, status: aiChat.status, archived: 0, updated: Date.now() / 1000, snippet: '' }] })],
  ['GET', /^flx-ai\/v1\/chats\/(\d+)$/, (m) => (Number(m[1]) === aiChat.id ? aiChat : null)],
  ['POST', /^flx-ai\/v1\/chats\/(\d+)\/send$/, (m, _q, b) => {
    const text = String(b.text ?? '');
    if (Number(m[1]) !== aiChat.id && Number(m[1]) !== 0) return null;
    aiChat.messages.push({ role: 'user', content: text });
    aiChat.status = 'running';
    return { state: 'continue', chat: aiChat };
  }],
  ['POST', /^flx-ai\/v1\/chats\/(\d+)\/step$/, (m, q) => {
    if (Number(m[1]) !== aiChat.id) return null;
    const reply = 'Duyuru taslağı hazır. İsterseniz tarih ve adresi de ekleyeyim.';
    const done = () => {
      aiChat.messages.push({ role: 'assistant', content: reply });
      aiChat.status = 'idle';
    };
    if (q.get('stream')) {
      const lines = ['Fidan ', 'dikimi ', 'duyurusu hazır.'];
      const body = [...lines.map((d) => JSON.stringify({ t: 'text', d })), JSON.stringify({ t: 'result', state: 'done', chat: { ...aiChat, status: 'idle', messages: [...aiChat.messages, { role: 'assistant', content: reply }] } })].join('\n') + '\n';
      done();
      return new Response(body, { status: 200, headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' } });
    }
    done();
    return { state: 'done', chat: aiChat };
  }],
  ['POST', /^flx-ai\/v1\/chats\/(\d+)\/decide$/, () => ({ state: 'continue', chat: aiChat })],
  ['GET', /^flxtv\/v1\/state$/, () => tv],
  ['POST', /^flxtv\/v1\/cmd$/, (_m, _q, b) => {
    if (!tv.same_wifi) return { ok: false, code: 'off_network', message: 'Aynı Wi-Fi’da değilsiniz.', state: tv };
    if (!tv.online) return { ok: false, code: 'offline', message: 'TV çevrimdışı.', state: tv };
    if (b.cmd === 'power') tv = { ...tv, online: !tv.online };
    if (b.cmd === 'volume') tv = { ...tv, volume: Math.max(0, Math.min(100, tv.volume + Number(b.delta ?? 0))), muted: false };
    if (b.cmd === 'mute') tv = { ...tv, muted: !tv.muted };
    if (b.cmd === 'app') {
      const app = tv.apps.find((a) => a.id === b.app);
      if (app) tv = { ...tv, app: app.name };
    }
    if (b.cmd === 'key' && b.key === 'HOME') tv = { ...tv, app: 'Ana ekran' };
    return { ok: true, state: tv };
  }],
];
