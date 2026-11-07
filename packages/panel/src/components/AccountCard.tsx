// Sol alttaki hesap kartı: kendi avatarın, adın, rolün ve site. Tıklayınca hesap menüsü yukarı açılır
// (profil, hesap değiştir, site ekle, ayarlar, çıkış).
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ChevronsUpDown, ExternalLink, LogOut, Plus, Settings, UserRound } from 'lucide-react';
import { accountsStore, brand, platform, type Account } from '@fluxwp/core';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar } from '@fluxwp/ui';
import { useAccounts, useMe } from '../state/hooks';
import { homeRoute, useRoute } from '../state/route';
import { logoutAccount } from '../lib/logout';
import { webUI } from '@fluxwp/render-web';

export function AccountCard({ active }: { active: Account }) {
  const { t } = useTranslation();
  const { accounts } = useAccounts();
  const me = useMe(active).data;
  const go = useRoute((s) => s.go);
  const qc = useQueryClient();
  const ui = webUI((key) => t(key));
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => (document.removeEventListener('mousedown', close), document.removeEventListener('keydown', esc));
  }, [open]);

  const pick = async (a: Account) => {
    setOpen(false);
    if (a.id === active.id) return;
    await accountsStore.getState().setActive(a.id);
    go(homeRoute());
    void qc.invalidateQueries({ queryKey: [a.id] });
  };
  const run = (fn: () => void) => () => (setOpen(false), fn());

  const name = me?.user.name || active.userName;
  const avatar = me?.user.avatar || active.userAvatar;
  const role = me?.user.roles[0]?.name;
  const others = accounts.filter((a) => a.id !== active.id);

  return (
    <div className="account" ref={ref}>
      <button className={'account-card' + (open ? ' open' : '')} onClick={() => setOpen((o) => !o)} aria-label={`${name} · ${active.siteName}`} aria-expanded={open} aria-haspopup="menu">
        <span className="account-av">
          <Avatar src={avatar} name={name} size={34} />
          {active.needsLogin && <span className="account-warn" />}
        </span>
        <span className="account-text">
          <strong>{name}</strong>
          <span className="muted">{role ? `${role} · ${active.siteName}` : active.siteName}</span>
        </span>
        <ChevronsUpDown size={15} className="muted" />
      </button>
      {open && (
        <div className="menu-pop up" role="menu">
          <div className="account-head">
            <Avatar src={avatar} name={name} size={40} />
            <span className="account-text">
              <strong>{name}</strong>
              <span className="muted">{me?.user.email || active.siteUrl.replace(/^https?:\/\//, '')}</span>
            </span>
          </div>
          {me?.user.profile_url && (
            <button className="menu-item" role="menuitem" onClick={run(() => void platform().openExternal(me.user.profile_url))}>
              <UserRound size={16} /> <span className="grow">{t('account.profile')}</span>
            </button>
          )}
          <button className="menu-item" role="menuitem" onClick={run(() => void platform().openExternal(active.siteUrl))}>
            <ExternalLink size={16} /> <span className="grow">{t('account.web')}</span>
          </button>
          <button className="menu-item" role="menuitem" onClick={run(() => go({ kind: 'shell', name: 'settings' }))}>
            <Settings size={16} /> <span className="grow">{t('settings.title')}</span>
          </button>
          {(others.length > 0 || !brand.lockSite) && <div className="menu-sep" />}
          {others.length > 0 && <div className="menu-label">{t('account.switch')}</div>}
          {others.map((a) => (
            <button key={a.id} className="menu-item" role="menuitem" onClick={() => void pick(a)}>
              <Avatar src={a.siteIcon} name={a.siteName} size={22} square />
              <span className="grow">
                <span>{a.siteName}</span>
                <small className="muted">{a.userName}</small>
              </span>
              {a.needsLogin && <AlertCircle size={15} className="text-warn" aria-label={t('accounts.needsLogin')} />}
            </button>
          ))}
          {!brand.lockSite && (
            <button className="menu-item" role="menuitem" onClick={run(() => go({ kind: 'add-account' }))}>
              <Plus size={16} /> <span className="grow">{t('accounts.add')}</span>
            </button>
          )}
          <div className="menu-sep" />
          <button
            className="menu-item danger"
            role="menuitem"
            onClick={run(() => {
              void (async () => {
                if (!await ui.confirm({ title: t('accounts.logout'), body: t('settings.logoutConfirm', { site: active.siteName }), ok: t('accounts.logout'), tone: 'danger' })) return;
                try {
                  await logoutAccount(active);
                  go(homeRoute());
                } catch {
                  ui.toast(t('settings.logoutFailed'), 'error');
                }
              })();
            })}
          >
            <LogOut size={16} /> <span className="grow">{t('accounts.logout')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
