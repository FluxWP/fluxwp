// Demo transport: fixtures for the flx-app contract (bootstrap, config, manifest) + sample REST data,
// falling back to @fluxwp/core's demo routes (me, dashboard, tasks, chat). No server needed.
import { demoFetch } from '@fluxwp/core/src/demo/fetch';
import { DEMO_ORIGIN } from '@fluxwp/core/src/demo/origin';
import { getDemoLocale, localizeDemo, localizedDemoResponse } from '@fluxwp/core/src/demo/locale';
import bootstrap from '@fluxwp/manifest/fixtures/bootstrap.json';
import config from '@fluxwp/manifest/fixtures/config.json';
import manifest from '@fluxwp/manifest/fixtures/manifest.json';
import { moduleDemoRoutes } from '../modules/demo';
import { comments, contacts, crm, pages, posts } from './data';
import { nativeAdminDemoRoutes } from './native-admin';
import { aiBillingDemoRoutes } from './ai-billing';
import { aiToolsDemoRoutes } from './ai-tools';
import { aiSystemsDemoRoutes } from './ai-systems';
import { aiMcpDemoRoutes } from './ai-mcp';

export const DEMO_SITE = DEMO_ORIGIN;

type Q = URLSearchParams;
type Handler = (m: RegExpMatchArray, q: Q, body: Record<string, unknown>) => unknown;

const json = (data: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', ...headers } });

const pageOf = <T>(all: T[], q: Q, wrap: boolean) => {
  const per = Number(q.get('per_page') ?? 20);
  const page = Number(q.get('page') ?? 1);
  const items = all.slice((page - 1) * per, page * per);
  const pages = Math.max(1, Math.ceil(all.length / per));
  if (wrap) return { items, total: all.length, page, pages };
  return json(items, { 'X-WP-Total': String(all.length), 'X-WP-TotalPages': String(pages) });
};

const has = (s: string, q: Q, k: string) => s.toLocaleLowerCase('tr').includes((q.get(k) ?? '').toLocaleLowerCase('tr'));
const statusIn = (status: string, q: Q) => {
  const want = q.get('status');
  return !want || want === 'all' || want.split(',').includes(status);
};

const ETAGS: Record<string, string> = { 'flxapp/v1/config': 'demo-config-native-admin-032-menu', 'flxapp/v1/manifest': 'demo-manifest-ai-mcp' };

let prefs: Record<string, unknown> = {
  order: [], hidden: [], pinned: [], forceWeb: [], tabs: [], cardOrder: [], cardHidden: [],
  push: { 'core.comment': true },
  events: [{ id: 'core.comment', title: 'Yorum', source: 'core', default: true, on: true }],
  updated: 1,
};
let devices: { id: number; device_id?: string; token?: string; current: boolean }[] = [];

const routes: [string, RegExp, Handler][] = [
  ...aiMcpDemoRoutes,
  ...aiSystemsDemoRoutes,
  ...aiToolsDemoRoutes,
  ...aiBillingDemoRoutes,
  ...nativeAdminDemoRoutes(),
  ...moduleDemoRoutes,
  ['GET', /^flxapp\/v1\/app\/bootstrap$/, () => bootstrap],
  ['GET', /^flxapp\/v1\/config$/, () => config],
  ['GET', /^flxapp\/v1\/manifest$/, () => manifest],
  ['GET', /^flxapp\/v1\/prefs$/, () => prefs],
  ['POST', /^flxapp\/v1\/prefs$/, (_m, _q, b) => (prefs = { ...prefs, ...b, updated: Number(prefs.updated ?? 0) + 1 })],
  ['GET', /^flxapp\/v1\/devices$/, () => devices],
  ['POST', /^flxapp\/v1\/devices$/, (_m, _q, b) => {
    const row = { id: 7, current: true, token: typeof b.token === 'string' ? b.token : '', device_id: typeof b.device_id === 'string' ? b.device_id : '' };
    devices = [row];
    return row;
  }],
  ['DELETE', /^flxapp\/v1\/devices\/(\d+)$/, () => { devices = []; return { deleted: true }; }],
  ['POST', /^flxapp\/v1\/session$/, (_m, _q, b) => ({ url: `${DEMO_ORIGIN}/wp-admin/${String(b.path ?? 'index.php')}`, expires_in: 60 })],
  ['POST', /^flxapp\/v1\/session\/end$/, () => ({ ok: true })],
  ['GET', /^flxapp\/v1\/sync$/, (_m, q) => ({
    counts: {},
    server_time: 1_700_000_100,
    events: Number(q.get('since') ?? 0) > 0 ? [] : [{ event: 'comment', title: 'New comment', body: 'A comment is waiting for approval.', target: 'screen:core/comments', at: 1_700_000_050 }],
  })],
  ['GET', /^wp\/v2\/users$/, () => [{ id: 1, name: 'Demo Yönetici' }]],
  ['GET', /^wp\/v2\/users\/(\d+)$/, (m) => ({ id: Number(m[1]), name: 'Demo Yönetici' })],
  ['GET', /^wp\/v2\/categories$/, (_m, q) => [{ id: 1, name: 'Genel' }].filter((c) => !q.get('search') || c.name.toLocaleLowerCase('tr').includes(q.get('search')!.toLocaleLowerCase('tr')))],
  ['POST', /^wp\/v2\/media$/, () => ({ id: 50, source_url: `${DEMO_ORIGIN}/wp-content/uploads/demo.jpg` })],
  // Flux CRM (fixture manifest "crm")
  ['GET', /^flx-crm\/v1\/meta$/, () => crm.meta],
  ['GET', /^flx-crm\/v1\/stats$/, () => crm.stats],
  ['GET', /^flx-crm\/v1\/segments$/, () => crm.segments],
  ['GET', /^flx-crm\/v1\/segments\/(\d+)\/contacts$/, (m, q) => pageOf(contacts.filter((_, i) => i % 3 === Number(m[1]) % 3), q, true)],
  ['GET', /^flx-crm\/v1\/contacts$/, (_m, q) => {
    let list = contacts.filter((c) => has(`${c.name} ${c.email} ${c.phone}`, q, 's'));
    if (q.get('role')) list = list.filter((c) => c.roles.some((r) => r.key === q.get('role')));
    if (q.get('risk')) list = list.filter((c) => c.churn >= 70);
    return pageOf(list, q, true);
  }],
  ['GET', /^flx-crm\/v1\/contacts\/(\d+)$/, (m) => contacts.find((c) => c.id === Number(m[1])) ?? null],
  ['POST', /^flx-crm\/v1\/contacts(\/\d+)?(\/events|\/tags)?$/, (_m, _q, b) => ({ ok: true, ...b })],
  // WordPress core (wp mode paging: bare array + X-WP-* headers)
  ['GET', /^wp\/v2\/posts$/, (_m, q) => pageOf(posts.filter((p) => statusIn(p.status, q) && has(p.title.raw, q, 'search')), q, false)],
  ['GET', /^wp\/v2\/posts\/(\d+)$/, (m) => posts.find((p) => p.id === Number(m[1])) ?? null],
  ['POST', /^wp\/v2\/posts(?:\/(\d+))?$/, (m, q, b) => {
    if (q.get('_method') === 'DELETE') {
      const i = posts.findIndex((p) => p.id === Number(m[1]));
      return i >= 0 ? { deleted: false, ...posts.splice(i, 1)[0] } : null;
    }
    const title = typeof b.title === 'string' ? b.title : '';
    const status = typeof b.status === 'string' ? b.status : 'draft';
    const excerpt = typeof b.excerpt === 'string' ? b.excerpt : '';
    const existing = posts.find((p) => p.id === Number(m[1]));
    if (existing) return Object.assign(existing, { status, title: { raw: title, rendered: title }, excerpt: { raw: excerpt, rendered: excerpt } });
    const p = { ...posts[0]!, id: 600 + posts.length, date: new Date().toISOString(), status, title: { raw: title, rendered: title }, excerpt: { raw: excerpt, rendered: excerpt } };
    posts.unshift(p);
    return p;
  }],
  ['GET', /^wp\/v2\/pages$/, (_m, q) => pageOf(pages.filter((p) => has(p.title.raw, q, 'search')), q, false)],
  ['GET', /^wp\/v2\/comments$/, (_m, q) => pageOf(comments.filter((c) => statusIn(c.status, q) && has(c.content.raw + c.author_name, q, 'search')), q, false)],
  ['POST', /^wp\/v2\/comments\/(\d+)$/, (m, q, b) => {
    const i = comments.findIndex((c) => c.id === Number(m[1]));
    if (i < 0) return null;
    if (q.get('_method') === 'DELETE' || b.status === 'spam') return comments.splice(i, 1)[0];
    return Object.assign(comments[i]!, { status: b.status === 'approved' ? 'approved' : comments[i]!.status });
  }],
];

export const demoShellFetch: typeof fetch = async (input, init) => {
  const language = getDemoLocale();
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  const path = url.pathname.replace(/^\/wp-json\//, '');
  const method = (init?.method ?? 'GET').toUpperCase();
  for (const [m, re, h] of routes) {
    const match = method === m ? path.match(re) : null;
    if (!match) continue;
    let body: Record<string, unknown> = {};
    if (typeof init?.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = Object.fromEntries(new URLSearchParams(init.body));
      }
    }
    await new Promise((r) => setTimeout(r, 150));
    const out = h(match, url.searchParams, body);
    if (out instanceof Response) return localizedDemoResponse(out, language);
    if (out === null || out === undefined) return new Response(JSON.stringify({ code: 'rest_not_found', message: path }), { status: 404 });
    const etag = ETAGS[path] ? `"${language === 'en' ? 'en-' : ''}${ETAGS[path]}"` : undefined;
    if (etag && new Headers(init?.headers).get('if-none-match') === etag) return new Response(null, { status: 304, headers: { ETag: etag } });
    return json(localizeDemo(out, language), etag ? { ETag: etag } : {});
  }
  return demoFetch(input, init);
};
