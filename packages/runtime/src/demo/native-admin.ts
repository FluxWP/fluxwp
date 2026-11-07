// Fictional, memory-only settings for exercising the native admin screens.
// Production validation lives in the WordPress plugins, never in this fixture.
import type { LanguageConfiguration } from '../modules/languages';
import type { RoleMatrix, RoleMember } from '../modules/roles';

type Handler = (m: RegExpMatchArray, q: URLSearchParams, body: Record<string, unknown>) => unknown;
const error = (message: string, status = 400) => new Response(JSON.stringify({ code: 'demo_invalid', message }), { status, headers: { 'Content-Type': 'application/json' } });
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export function nativeAdminDemoRoutes(): [string, RegExp, Handler][] {
  let revision = 1;
  let roles: RoleMatrix = {
    version: 'roles-1', can_promote: true, can_list: true,
    roles: [
      { id: 'flxr_editor', label: 'İçerik ekibi', description: 'Yazı ve sayfa düzenleme ekibi.', custom: false, count: 1, caps: { read: true, edit_posts: true, publish_posts: false, flxr_referral: false } },
      { id: 'flxr_volunteer', label: 'Gönüllüler', description: 'Referans bağlantısıyla katkıda bulunanlar.', custom: true, count: 1, caps: { read: true, edit_posts: false, publish_posts: false, flxr_referral: true } },
    ],
    groups: [
      { id: 'core', label: 'WordPress', plugin: 'WordPress', active: true, caps: [
        { id: 'read', label: 'Giriş yapma', locked: true, supported: true, warning: false },
        { id: 'edit_posts', label: 'Yazıları düzenleme', locked: false, supported: true, warning: false },
        { id: 'publish_posts', label: 'Yazıları yayımlama', locked: false, supported: true, warning: true },
      ] },
      { id: 'referral', label: 'Referans', plugin: 'Flux Roles', active: true, caps: [{ id: 'flxr_referral', label: 'Referans bağlantısı', locked: false, supported: true, warning: false }] },
    ],
    settings: { home: { flxr_editor: 'auto', flxr_volunteer: 'auto' }, ref_days: 30 },
    home_choices: [{ id: 'auto', label: 'Otomatik' }, { id: 'index.php', label: 'Başlangıç' }],
  };
  const initialRoles = copy(roles);
  const members: Record<string, RoleMember[]> = {
    flxr_editor: [{ id: 41, name: 'Deniz Örnek', login: 'deniz.demo', email: 'deniz@example.org', phone: '', protected: false, referral: false }],
    flxr_volunteer: [{ id: 42, name: 'Ece Örnek', login: 'ece.demo', email: 'ece@example.org', phone: '', protected: false, referral: true }],
  };
  const directory = [...Object.values(members).flat(), ...Array.from({length: 60}, (_, i) => ({id: 100+i, name: `Demo Kişi ${String(i+1).padStart(2,'0')}`, login: `demo.person.${i+1}`, email: `person${i+1}@example.org`, phone: '', protected: false, referral: false}))];
  const nextRoles = () => { roles.version = `roles-${++revision}`; return copy(roles); };
  let languages: LanguageConfiguration = {
    version: 'languages-1',
    settings: {
      default: 'tr', languages: { tr: { name: 'Türkçe', locale: 'tr_TR', flag: '🇹🇷', active: 1 }, en: { name: 'English', locale: 'en_US', flag: '🇬🇧', active: 1 } },
      post_types: ['post', 'page'], fallback: 1, suggest: 'banner', suggest_to: 'en', home_countries: ['TR', 'CY'], switcher: 'code', switcher_place: 'footer',
      texts: { en: { blogname: 'Example Foundation' } },
    },
    catalog: { tr: { name: 'Türkçe', locale: 'tr_TR', flag: '🇹🇷' }, en: { name: 'English', locale: 'en_US', flag: '🇬🇧' }, de: { name: 'Deutsch', locale: 'de_DE', flag: '🇩🇪' }, ar: { name: 'العربية', locale: 'ar', flag: '🇸🇦' } },
    post_types: [{ id: 'post', label: 'Yazı' }, { id: 'page', label: 'Sayfa' }],
    text_fields: [{ id: 'blogname', label: 'Site başlığı', multiline: false, base: 'Örnek Vakfı' }, { id: 'blogdescription', label: 'Site açıklaması', multiline: true, base: 'Birlikte daha yeşil bir gelecek.' }],
  };
  return [
    ['GET', /^wp\/v2\/users$/, (_m, q) => {
      const search = (q.get('search') ?? '').toLocaleLowerCase('tr');
      const all = directory.filter(u => `${u.name} ${u.login} ${u.email}`.toLocaleLowerCase('tr').includes(search));
      const page = Math.max(1, Number(q.get('page') || 1)); const per = Math.min(100, Math.max(1, Number(q.get('per_page') || 25)));
      return new Response(JSON.stringify(all.slice((page-1)*per,page*per).map(u => ({id:u.id,name:u.name,username:u.login,email:u.email,roles:[]}))), {headers:{'Content-Type':'application/json','X-WP-Total':String(all.length),'X-WP-TotalPages':String(Math.max(1,Math.ceil(all.length/per)))}});
    }],
    ['GET', /^flx-roles\/v1\/matrix$/, () => copy(roles)],
    ['POST', /^flx-roles\/v1\/matrix$/, (_m, _q, body) => {
      if (body.version !== roles.version) return error('Ayarlar değişti. Yenileyip tekrar deneyin.', 409);
      roles.roles.forEach(role => { role.caps = { ...role.caps, ...(body.caps as Record<string, Record<string, boolean>>)?.[role.id] }; });
      roles.settings = { home: copy(body.home as Record<string, string>), ref_days: Number(body.ref_days) };
      return nextRoles();
    }],
    ['POST', /^flx-roles\/v1\/roles$/, (_m, _q, body) => {
      const name = String(body.name ?? '').trim(); if (!name) return error('Rol adı gerekli.');
      roles.roles.push({ id: `flxr_demo_${++revision}`, label: name, description: '', custom: true, count: 0, caps: { read: true, edit_posts: false, publish_posts: false, flxr_referral: false } });
      return nextRoles();
    }],
    ['POST', /^flx-roles\/v1\/roles\/([a-z0-9_-]+)\/(reset|delete)$/, (m) => {
      const role = roles.roles.find(r => r.id === m[1]); if (!role) return error('Rol bulunamadı.', 404);
      if (m[2] === 'delete') { if (!role.custom) return error('Bu rol silinemez.'); roles.roles = roles.roles.filter(r => r !== role); delete members[role.id]; }
      else role.caps = copy(initialRoles.roles.find(r => r.id === role.id)?.caps ?? { read: true, edit_posts: false, publish_posts: false, flxr_referral: false });
      return nextRoles();
    }],
    ['GET', /^flx-roles\/v1\/people$/, (_m, q) => {
      const search = (q.get('search') ?? '').toLocaleLowerCase('tr'); const all = (members[q.get('role') ?? ''] ?? []).filter(u => `${u.name} ${u.login} ${u.email}`.toLocaleLowerCase('tr').includes(search));
      return { items: copy(all), total: all.length, pages: 1, page: 1 };
    }],
    ['POST', /^flx-roles\/v1\/people$/, (_m, _q, body) => {
      const role = roles.roles.find(r => r.id === body.role); if (!role) return error('Rol bulunamadı.', 404);
      const list = members[role.id] ??= [];
      if (body.operation === 'remove') members[role.id] = list.filter(u => u.id !== body.user);
      else {
        const user = directory.find(u => u.login === body.who || u.email === body.who);
        if (!user) return error('Demo hesabında deniz.demo veya ece.demo kullanın.', 404);
        Object.keys(members).forEach(id => { members[id] = members[id]!.filter(u => u.id !== user.id); });
        members[role.id]!.push({ ...user });
      }
      roles.roles.forEach(r => { r.count = members[r.id]?.length ?? 0; }); return { ok: true };
    }],
    ['POST', /^flx-roles\/v1\/people\/(\d+)\/phone$/, (m, _q, body) => {
      const user = Object.values(members).flat().find(u => u.id === Number(m[1])); if (!user) return error('Kullanıcı bulunamadı.', 404);
      user.phone = String(body.phone ?? ''); return { phone: user.phone };
    }],
    ['POST', /^flx-roles\/v1\/people\/(\d+)\/referral$/, m => ({ url: `https://example.org/?ref=demo-${m[1]}` })],
    ['GET', /^flx-lang\/v1\/configuration$/, () => copy(languages)],
    ['POST', /^flx-lang\/v1\/configuration$/, (_m, _q, body) => {
      if (body.version !== languages.version) return error('Ayarlar değişti. Yenileyip tekrar deneyin.', 409);
      const { langs, home_countries, version: _version, ...rest } = body;
      languages = { ...languages, version: `languages-${++revision}`, settings: copy({ ...rest, languages: langs, home_countries: String(home_countries).split(/[,;\s]+/).filter(Boolean) }) as LanguageConfiguration['settings'] };
      return copy(languages);
    }],
  ];
}
