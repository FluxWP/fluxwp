import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clientFor, platform, type Account } from '@fluxwp/core';
import { ModuleHostProvider, type ModuleHost } from '@fluxwp/modules';
import { ManifestScreen } from '@fluxwp/render-web';
import { useAccount, useMe, useShellModel, useSiteConfig } from '@fluxwp/runtime';
import { Sidebar } from '../components/Sidebar';
import { TitleBar } from '../components/TitleBar';
import { useSidebar } from '../state/sidebar';
import { startUpdateChecks } from '../state/update';
import { CommandPalette } from '../components/CommandPalette';
import { useNav } from '../state/hooks';
import { useRoute } from '../state/route';
import { screens } from '../modules/registry';
import { WebPanel } from './WebPanel';
import { Settings } from './Settings';
import { AddSite } from './AddSite';
import { Dashboard } from './Dashboard';
import { Notifications } from './Notifications';
import { buildMenu } from '../lib/menuGroups';
import { activeOf, fromEntry, fromNav, labelOf, type SideGroup, type SideLink } from '../shell/links';
import { PrefsBridge, SyncNotifier } from '../shell/bridges';
import { homeRoute, type Route } from '../state/route';
import { AiDock } from '../ai/AiWorkspace';

export function Shell() {
  const account = useAccount();
  const { t } = useTranslation();
  const me = useMe();
  const site = useSiteConfig();
  const shell = useShellModel();
  const legacy = useNav(account);
  const { route, go } = useRoute();
  const [palette, setPalette] = useState(false);
  const collapsed = useSidebar((s) => s.collapsed);
  const booted = useRef(false);
  const host = useMemo<ModuleHost>(() => ({ mode: 'app', client: clientFor(account), scope: account.id, siteUrl: account.siteUrl, siteName: account.siteName, openUrl: (u) => void platform().openExternal(u) }), [account]);

  const configShell = site.isSuccess && !!site.data;
  const menu = useMemo(() => {
    if (configShell) {
      return {
        pins: shell.sidebar.pins.map((e) => fromEntry(e, t)),
        groups: shell.sidebar.groups.map((g) => ({ id: g.id, label: labelOf(g.label, t), collapsed: g.collapsed, items: g.items.map((e) => fromEntry(e, t)) })),
      };
    }
    const built = buildMenu(legacy);
    return { pins: built.pins.map(fromNav), groups: built.groups.map((g) => ({ ...g, items: g.items.map(fromNav) })) };
  }, [configShell, shell.sidebar, legacy, t]);

  const commands = useMemo(() => shell.commands.map((e) => fromEntry(e, t)), [shell.commands, t]);
  const active = activeOf(menu.pins, menu.groups, route);

  useEffect(() => startUpdateChecks(), []);
  useEffect(() => {
    if (booted.current || me.isLoading || !configShell && site.isLoading) return;
    booted.current = true;
    if (useRoute.getState().past.length) return;
    useRoute.getState().replace(configShell ? shell.home.route : homeRoute());
  }, [me.isLoading, site.isLoading, configShell, shell.home]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      } else if (mod && e.key === '[') {
        e.preventDefault();
        useRoute.getState().back();
      } else if (mod && e.key === ']') {
        e.preventDefault();
        useRoute.getState().forward();
      } else if (mod && e.key === '\\') {
        e.preventDefault();
        useSidebar.getState().toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const open = (next: Route) => {
    if (next.kind === 'shell' && next.name === 'search') {
      setPalette(true);
      return;
    }
    if (next.kind === 'url') {
      void platform().openExternal(next.url);
      return;
    }
    go(next);
  };

  if (route.kind === 'add-account') return <AddSite initialUrl={route.siteUrl} onCancel={() => go(homeRoute())} />;

  return (
    <div className="shell">
      <PrefsBridge />
      <SyncNotifier />
      <Sidebar
        account={account}
        pins={menu.pins}
        groups={menu.groups}
        activeId={active.id}
        childId={active.child}
        onSearch={() => setPalette(true)}
        onOpen={open}
        actions={shell.topbar.actionEntries.map((e) => fromEntry(e, t))}
      />
      <main className={'main' + (collapsed ? ' with-bar' : '')}>
        {collapsed && <TitleBar className="main-bar" />}
        <div className="main-scroll">
          <ModuleHostProvider value={host}>
            {me.isLoading ? <div className="page"><div className="card skeleton tall" /></div> : me.isError ? <div className="page"><p className="error">{t(account.needsLogin ? 'accounts.needsLogin' : 'errors.server')}</p></div> : <Stage route={route} groups={menu.groups} />}
          </ModuleHostProvider>
        </div>
      </main>
      <AiDock />
      {palette && <CommandPalette links={[...menu.pins, ...menu.groups.flatMap((g) => g.items)]} commands={commands} onClose={() => setPalette(false)} onOpen={open} />}
    </div>
  );
}

function Stage({ route, groups }: { route: Route; groups: SideGroup[] }) {
  if (route.kind === 'shell') {
    if (route.name === 'settings' || route.name === 'accounts') return <Settings />;
    if (route.name === 'notifications') return <Notifications />;
    if (route.name === 'more') return <More groups={groups} />;
    if (route.name === 'search') return null;
  }
  if (route.kind === 'native') {
    const id = route.component === 'dashboard' ? 'core-dashboard' : route.component;
    const Screen = screens[id];
    if (Screen) return <Screen />;
  }
  if (route.kind === 'manifest') return <ManifestScreen module={route.module} screen={route.screen} params={route.params} />;
  if (route.kind === 'web') return <WebPanel path={route.path} title={route.title ?? route.path} />;
  return <Dashboard />;
}

function More({ groups }: { groups: SideGroup[] }) {
  const { t } = useTranslation();
  const go = useRoute((s) => s.go);
  return (
    <div className="page">
      <header className="page-head"><h1>{t('nav.menu')}</h1></header>
      {groups.map((g) => (
        <section key={g.id} className="panel">
          {g.label && <h2>{g.label}</h2>}
          {g.items.map((item) => (
            <button key={item.id} className="btn-ghost" onClick={() => go(item.route)}>{item.title}</button>
          ))}
        </section>
      ))}
    </div>
  );
}

export type { Account, SideLink };
