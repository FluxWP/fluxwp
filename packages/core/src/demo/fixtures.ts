// Demo hesabı: sunucusuz geliştirme ve ekran görüntüsü için örnek sunucu cevapları.
// Bunlar sunucu verisidir (UI metni değil); gerçek sitede sunucu kullanıcı dilinde döner.
import type { Dashboard, Me } from '../api/types';

const A = 'https://demo.fluxapp.local/wp-admin/';

export const demoMe: Me = {
  user: {
    id: 1,
    login: 'demo',
    name: 'Demo Kullanıcı',
    email: 'demo@example.org',
    avatar: '',
    roles: [{ id: 'administrator', name: 'Yönetici' }],
    locale: 'tr_TR',
    is_admin: true,
    profile_url: A + 'profile.php',
  },
  site: {
    name: 'Demo Site',
    url: 'https://demo.fluxapp.local/',
    admin_url: A,
    rest_url: 'https://demo.fluxapp.local/wp-json/',
    icon: '',
    locale: 'tr_TR',
    timezone: 'Europe/Istanbul',
  },
  auth: { kind: 'demo' },
  menu: [
    { id: 'dashboard', slug: 'index.php', title: 'Başlangıç', url: A + 'index.php', icon: 'dashicons-dashboard', items: [] },
    { id: 'flx-setup', slug: 'flx-setup', title: 'Setup', url: A + 'admin.php?page=flx-setup', icon: '', badge: 1, items: [] },
    { id: 'flx-chat', slug: 'flx-chat', title: 'Çağrı Merkezi', url: A + 'admin.php?page=flx-chat', icon: '', badge: 12,
      items: [
        { slug: 'flx-chat', title: 'Sohbetler', url: A + 'admin.php?page=flx-chat' },
        { slug: 'flx-chat-settings', title: 'Ayarlar', url: A + 'admin.php?page=flx-chat-settings' },
      ],
    },
    { id: 'flx-tasks', slug: 'flx-tasks', title: 'Görevler', url: A + 'admin.php?page=flx-tasks', icon: '', badge: 5,
      items: [
        { slug: 'flx-tasks', title: 'Görevler', url: A + 'admin.php?page=flx-tasks' },
        { slug: 'flx-tasks-usage', title: 'Kullanım panosu', url: A + 'admin.php?page=flx-tasks-usage' },
        { slug: 'flx-tasks-settings', title: 'Ayarlar', url: A + 'admin.php?page=flx-tasks-settings' },
      ],
    },
    { id: 'flxi-posta', slug: 'flxi-posta', title: 'Posta kutusu', url: A + 'admin.php?page=flxi-posta', icon: 'dashicons-email-alt', badge: 2, items: [] },
    {
      id: 'flxb-dashboard', slug: 'flxb-dashboard', title: 'Bağışlar', url: A + 'admin.php?page=flxb-dashboard', icon: '', badge: 3,
      items: [
        { slug: 'flxb-dashboard', title: 'Panel', url: A + 'admin.php?page=flxb-dashboard' },
        { slug: 'flxb-donations', title: 'Tüm bağışlar', url: A + 'admin.php?page=flxb-donations' },
        { slug: 'flxb-donors', title: 'Bağışçılar', url: A + 'admin.php?page=flxb-donors' },
      ],
    },
    { id: 'flxs', slug: 'flxs', title: 'Sertifikalar', url: A + 'admin.php?page=flxs', icon: '', items: [] },
    { id: 'emsfb', slug: 'Emsfb', title: 'Formlar', url: A + 'admin.php?page=Emsfb', icon: '', items: [] },
    { id: 'edit-php-post_type-page', slug: 'edit.php?post_type=page', title: 'Sayfalar', url: A + 'edit.php?post_type=page', icon: 'dashicons-admin-page', items: [] },
    {
      id: 'edit.php', slug: 'edit.php', title: 'Yazılar', url: A + 'edit.php', icon: 'dashicons-admin-post',
      items: [
        { slug: 'edit.php', title: 'Tüm yazılar', url: A + 'edit.php' },
        { slug: 'post-new.php', title: 'Yeni ekle', url: A + 'post-new.php' },
      ],
    },
    { id: 'edit-php-post_type-etkinlik', slug: 'edit.php?post_type=etkinlik', title: 'Etkinlikler', url: A + 'edit.php?post_type=etkinlik', icon: 'dashicons-calendar-alt', items: [] },
    { id: 'upload.php', slug: 'upload.php', title: 'Ortam', url: A + 'upload.php', icon: 'dashicons-admin-media', items: [] },
    { id: 'flx-analytics', slug: 'flx-analytics', title: 'Site Analitik', url: A + 'admin.php?page=flx-analytics', icon: '', items: [] },
    { id: 'flx-social', slug: 'flx-social', title: 'Sosyal Medya', url: A + 'admin.php?page=flx-social', icon: '', items: [] },
    { id: 'flx-tv-remote', slug: 'flx-tv-remote', title: 'TV Kumandası', url: A + 'admin.php?page=flx-tv-remote', icon: '', items: [] },
    { id: 'flx-ai', slug: 'flx-ai', title: 'Flux AI', url: A + 'admin.php?page=flx-ai', icon: '', items: [] },
    { id: 'plugins.php', slug: 'plugins.php', title: 'Eklentiler', url: A + 'plugins.php', icon: 'dashicons-admin-plugins', items: [] },
    { id: 'users.php', slug: 'users.php', title: 'Kullanıcılar', url: A + 'users.php', icon: 'dashicons-admin-users', items: [] },
    { id: 'options-general.php', slug: 'options-general.php', title: 'Ayarlar', url: A + 'options-general.php', icon: 'dashicons-admin-settings', items: [] },
  ],
  modules: {
    'flxr-roles': { title: 'Roller ve erişim', icon: 'users', order: 70 },
    'flxl-languages': { title: 'Diller', icon: 'globe', order: 71 },
    'flxc-inbox': { title: 'WhatsApp', menu: 'flx-chat', icon: 'chat', order: 20 },
    'flxg-tasks': { title: 'Görevler', menu: 'flx-tasks', icon: 'task', order: 30 },
    'flxb-review': { title: 'Onay bekleyenler', icon: 'check', order: 10 },
  },
  counts: { 'flxb-dashboard': 3, 'flx-chat': 12, 'flx-tasks': 5, 'flxi-posta': 2 },
  bottom: ['index.php', 'flx-chat', 'flx-tasks', 'flxb-dashboard'],
  web_session: true,
  versions: { 'flx-app': '0.3.2' },
};

export const demoDashboard: Dashboard = {
  cards: [
    { id: 'wp-posts', title: 'Yayımlanan yazılar', value: '24', sub: 'Bu ay 4 yeni yazı', icon: 'post', tone: 'ok', order: 10 },
    { id: 'wp-drafts', title: 'Taslaklar', value: '3', icon: 'edit', tone: 'warn', order: 12 },
    { id: 'flxc-unread', title: 'Okunmamış mesajlar', value: '12', icon: 'chat', order: 20 },
    { id: 'flxg-open', title: 'Açık görev', value: '5', sub: '1 gecikmiş', icon: 'task', tone: 'danger', order: 30 },
    { id: 'flxa-live', title: 'Canlı ziyaretçi', value: '18', icon: 'chart', order: 40 },
    { id: 'wp-comments', title: 'Onay bekleyen yorum', value: '0', icon: 'comment', order: 50 },
  ],
  lists: [
    { id: 'wp-recent', title: 'Son içerikler', icon: 'post', order: 10, items: [
      { title: 'Yeni ürün koleksiyonu', sub: 'Yazı · Yayımlandı', meta: '10 dk önce' },
      { title: 'Ekibimizle tanışın', sub: 'Sayfa · Güncellendi', meta: '42 dk önce' },
      { title: 'Kasım içerik planı', sub: 'Yazı · Taslak', meta: '2 sa önce' },
    ] },
    { id: 'flxg-mine', title: 'Görevlerim', icon: 'task', order: 20, items: [
      { title: 'Haftalık blog yazısını hazırla', sub: 'İçerik', meta: 'Bugün' },
      { title: 'Ürün görsellerini güncelle', sub: 'Medya', meta: 'Yarın' },
    ] },
  ],
};
