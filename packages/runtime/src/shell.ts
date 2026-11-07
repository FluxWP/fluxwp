// Resolved shell model for any UI (Expo app, FluxApp desktop): tabs, drawer, top bar entries with
// label, icon, badge and the route each one opens.
import { adminPath, type Me } from '@fluxwp/core';
import { resolveTarget, type ResolveEnv, type Route } from './resolve';
import { normalizeShell, parseTarget, type AppConfig } from '@fluxwp/manifest';
import { shellGroupLabel } from './group-label';

export interface NavEntry {
  id: string;
  target: string;
  route: Route;
  /** Server text, or "$t:<key>" for built-in labels. */
  label: string;
  icon: string;
  /** WP menu slug (package icon lookup). */
  slug?: string;
  iconUrl?: string;
  badge?: number | string;
}

export interface ShellGroup {
  id: string;
  label: string;
  collapsed: boolean;
  items: NavEntry[];
}

export interface ResolvedShell {
  nav: AppConfig['shell']['nav'];
  home: NavEntry;
  tabs: NavEntry[];
  drawer: { enabled: boolean; header: AppConfig['shell']['drawer']['header']; pins: NavEntry[]; groups: ShellGroup[]; footer: NavEntry[] };
  /** Desktop sidebar. `shell.sidebar` when the server sent one, otherwise the drawer (same Flux Admin groups). */
  sidebar: { pins: NavEntry[]; groups: ShellGroup[]; footer: NavEntry[] };
  /** Command-palette pins (`shell.commands`). */
  commands: NavEntry[];
  topbar: AppConfig['shell']['topbar'] & { actionEntries: NavEntry[] };
}

export interface ShellEnv extends ResolveEnv {
  me?: Me | null;
  counts?: Record<string, number>;
}

const SHELL_ICONS: Record<string, string> = { more: 'menu', accounts: 'users', settings: 'settings', search: 'search', notifications: 'bell' };

function findMenu(me: Me | null | undefined, pred: (slug: string, url: string) => boolean) {
  for (const m of me?.menu ?? []) {
    if (pred(m.slug, m.url)) return { title: m.title, icon: m.icon, slug: m.slug, iconUrl: m.icon_url, badge: m.badge };
    for (const c of m.items ?? []) if (pred(c.slug, c.url)) return { title: c.title, icon: m.icon, slug: c.slug, iconUrl: m.icon_url, badge: c.badge };
  }
  return null;
}

/** Label/icon for a target when the config did not give one. */
export function describeTarget(target: string, env: ShellEnv): Omit<NavEntry, 'id' | 'target' | 'route'> {
  const t = parseTarget(target);
  const counts = { ...env.me?.counts, ...env.counts };
  if (!t) return { label: target, icon: '' };
  switch (t.kind) {
    case 'shell':
      return { label: `$t:shell.nav.${t.name}`, icon: SHELL_ICONS[t.name] ?? '' };
    case 'screen':
    case 'module': {
      const m = env.manifests?.[t.module];
      const s = t.kind === 'screen' ? m?.screens[t.screen] : undefined;
      const title = s?.title && !s.title.includes('{{') ? s.title : (m?.title ?? env.me?.modules[t.module]?.title ?? t.module);
      // A screen that a manifest route maps to a wp-admin page borrows that menu item's icon and badge.
      const page = t.kind === 'screen' ? Object.entries(m?.routes ?? {}).find(([, r]) => r.screen === t.screen && !r.params)?.[0] : undefined;
      const menu = page ? findMenu(env.me, (_s, url) => adminPath(url) === page) : m?.menu ? findMenu(env.me, (slug) => slug === m.menu) : null;
      if (page) return { label: title, icon: menu?.icon ?? '', slug: menu?.slug ?? page, iconUrl: menu?.iconUrl, badge: (menu?.slug && counts[menu.slug]) || menu?.badge || undefined };
      return { label: title, icon: m?.icon ?? env.me?.modules[t.module]?.icon ?? menu?.icon ?? '', slug: m?.menu ?? menu?.slug, iconUrl: m?.icon_url ?? menu?.iconUrl, badge: (m?.menu && counts[m.menu]) || undefined };
    }
    case 'menu': {
      const menu = findMenu(env.me, (slug) => slug === t.slug);
      return { label: menu?.title ?? t.slug, icon: menu?.icon ?? '', slug: t.slug, iconUrl: menu?.iconUrl, badge: counts[t.slug] || menu?.badge || undefined };
    }
    case 'web': {
      const menu = findMenu(env.me, (_s, url) => adminPath(url) === t.path);
      return { label: menu?.title ?? t.path, icon: menu?.icon ?? 'admin-site', slug: menu?.slug, iconUrl: menu?.iconUrl };
    }
    case 'url':
      return { label: t.url.replace(/^\w+:(\/\/)?/, ''), icon: 'admin-links' };
    case 'native':
      return { label: t.component, icon: '' };
  }
}

function entry(id: string, target: string, env: ShellEnv, over: { label?: string; icon?: string; badge?: string } = {}): NavEntry {
  const d = describeTarget(target, env);
  const counts = { ...env.me?.counts, ...env.counts };
  return {
    ...d,
    id,
    target,
    route: resolveTarget(target, env),
    label: over.label || d.label,
    icon: over.icon || d.icon,
    badge: over.badge ? counts[over.badge] || undefined : d.badge,
  };
}

const visible = (e: NavEntry) => e.route.kind !== 'none';

function groupsOf(groups: { id: string; label?: string; collapsed?: boolean; items: string[] }[] | undefined, env: ShellEnv, prefix: string): ShellGroup[] {
  return (groups ?? [])
    .map((g) => ({ id: g.id, label: shellGroupLabel(g.id, g.label), collapsed: !!g.collapsed, items: g.items.map((t, i) => entry(`${prefix}${g.id}:${i}`, t, env)).filter(visible) }))
    .filter((g) => g.items.length);
}

export function resolveShell(config: AppConfig, env: ShellEnv): ResolvedShell {
  const shell = normalizeShell(config.shell);
  const tabs = shell.tabs.map((t) => entry(t.id, t.target, env, t)).filter(visible);
  const home = entry('home', shell.home, env);
  const drawerGroups = groupsOf(shell.drawer.groups, env, '');
  const ownSidebar = !!(shell.sidebar && ((shell.sidebar.groups && shell.sidebar.groups.length) || (shell.sidebar.pins && shell.sidebar.pins.length) || (shell.sidebar.footer && shell.sidebar.footer.length)));
  const side = ownSidebar ? shell.sidebar! : { pins: shell.drawer.pins, groups: shell.drawer.groups, footer: shell.drawer.footer };
  return {
    nav: shell.nav,
    home: visible(home) ? home : (tabs[0] ?? entry('more', 'more', env)),
    tabs,
    drawer: {
      enabled: shell.drawer.enabled,
      header: shell.drawer.header,
      pins: (shell.drawer.pins ?? []).map((t, i) => entry(`pin${i}`, t, env)).filter(visible),
      groups: drawerGroups,
      footer: shell.drawer.footer.map((t, i) => entry(`foot${i}`, t, env)).filter(visible),
    },
    sidebar: {
      pins: (side.pins ?? []).map((t, i) => entry(`spin${i}`, t, env)).filter(visible),
      groups: ownSidebar ? groupsOf(side.groups, env, 's') : drawerGroups,
      footer: (side.footer ?? []).map((t, i) => entry(`sfoot${i}`, t, env)).filter(visible),
    },
    commands: (shell.commands ?? []).map((t, i) => entry(`cmd${i}`, t, env)).filter(visible),
    topbar: { ...shell.topbar, actionEntries: shell.topbar.actions.map((a, i) => entry(`act${i}`, a.target, env, a)).filter(visible) },
  };
}
