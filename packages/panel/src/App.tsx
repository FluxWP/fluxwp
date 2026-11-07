import { useEffect, useMemo, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { accountsStore, brand, normalizeLocale } from '@fluxwp/core';
import { AccountScope, useRememberSiteMark, useSiteTheme, type AppInfo, type PersistStore } from '@fluxwp/runtime';
import { RenderOverlays } from '@fluxwp/render-web';
import { useAccounts, useActiveAccount } from './state/hooks';
import { usePrefs } from './state/prefs';
import { AddSite } from './screens/AddSite';
import { Shell } from './screens/Shell';
import { desktopRenderer } from './renderer';
import { ensureI18n, i18n } from './i18n';
import { applyTheme, brandTheme } from './theme';
import { APP_VERSION } from './version';
import { AiProvider } from './ai/AiWorkspace';
import '@fluxwp/ui/src/styles.css';
import '@fluxwp/render-web/styles.css';
import './styles.css';

function useSystemDark() {
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  const [dark, setDark] = useState(mq?.matches ?? false);
  useEffect(() => {
    if (!mq) return;
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [mq]);
  return dark;
}

function accountStore(id: string): PersistStore {
  const prefix = `flux.acc.${id}.`;
  return {
    getItem: (k) => {
      try { return localStorage.getItem(prefix + k); } catch { return null; }
    },
    setItem: (k, v) => {
      try { localStorage.setItem(prefix + k, v); } catch { /* private mode */ }
    },
    removeItem: (k) => {
      try { localStorage.removeItem(prefix + k); } catch { /* private mode */ }
    },
  };
}

function AccountTheme({ mode }: { mode: 'light' | 'dark' }) {
  const theme = useSiteTheme(mode, brand.colors);
  useEffect(() => applyTheme(theme), [theme]);
  return null;
}

function RememberSite() {
  useRememberSiteMark();
  return null;
}

function Root({ mode }: { mode: 'light' | 'dark' }) {
  const { ready } = useAccounts();
  const active = useActiveAccount();
  const prefs = usePrefs();
  const renderer = useMemo(() => desktopRenderer(), []);
  const app = useMemo<AppInfo>(() => ({
    version: APP_VERSION,
    device: prefs.theme === 'system' ? undefined : { theme: { mode: prefs.theme } },
  }), [prefs.theme]);
  if (!ready) return null;
  if (!active) return <AddSite />;
  return (
    <AccountScope key={active.id} account={active} renderer={renderer} app={app} store={accountStore(active.id)}>
      <AccountTheme mode={mode} />
      <RememberSite />
      <AiProvider><Shell /></AiProvider>
    </AccountScope>
  );
}

export function App() {
  const prefs = usePrefs();
  const active = useActiveAccount();
  const systemDark = useSystemDark();
  const mode = prefs.theme === 'system' ? (systemDark ? 'dark' : 'light') : prefs.theme;
  const locale = normalizeLocale(prefs.locale ?? (typeof navigator !== 'undefined' ? navigator.language : brand.defaultLocale));
  const ready = useMemo(() => ensureI18n(locale), [locale]);

  useEffect(() => {
    void prefs.load();
    void accountsStore.getState().load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void ready.changeLanguage(locale);
    document.documentElement.lang = locale;
  }, [ready, locale]);

  useEffect(() => {
    if (!active) applyTheme(brandTheme(mode));
  }, [mode, active]);

  return (
    <I18nextProvider i18n={i18n}>
      <RenderOverlays t={(key) => i18n.t(key)} />
      <Root mode={mode} />
    </I18nextProvider>
  );
}
