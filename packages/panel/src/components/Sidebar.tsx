import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, ChevronDown, ChevronRight, Search } from 'lucide-react';
import type { Account } from '@fluxwp/core';
import { MenuIcon } from '@fluxwp/ui';
import { AccountCard } from './AccountCard';
import { BrandLogo } from './BrandLogo';
import { TitleBar } from './TitleBar';
import { UpdateBanner } from './UpdateBanner';
import { SidebarRail } from './SidebarRail';
import { useSidebar, SIDEBAR_MIN, SIDEBAR_MAX } from '../state/sidebar';
import type { Route } from '../state/route';
import type { SideGroup, SideLink } from '../shell/links';

const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent) ? '⌘' : 'Ctrl ';
const RAIL_WIDTH = 72;
const COLLAPSE_WIDTH = 150;
const EXPAND_WIDTH = 190;

export function Sidebar({ account, pins, groups, activeId, childId, onSearch, onOpen, actions = [] }: {
  account: Account;
  pins: SideLink[];
  groups: SideGroup[];
  activeId: string | null;
  childId: string | null;
  onSearch: () => void;
  onOpen: (route: Route) => void;
  actions?: SideLink[];
}) {
  const { t } = useTranslation();
  const { width, collapsed, open, closedGroups, setWidth, toggle, toggleOpen, toggleGroup } = useSidebar();
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    const a = [...pins, ...groups.flatMap((g) => g.items)].find((n) => n.id === activeId);
    if (a && a.children.length > 1) toggleOpen(a.id, true);
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const drag = useRef<{ x: number; width: number; preferredWidth: number } | null>(null);
  const onResizeDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || drag.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const state = useSidebar.getState();
    drag.current = { x: e.clientX, width: state.collapsed ? RAIL_WIDTH : state.width, preferredWidth: state.width };
    setResizing(true);
    document.documentElement.classList.add('flux-resizing');
  };
  const onResizeMove = (e: React.PointerEvent) => {
    const current = drag.current;
    if (!current) return;
    const next = current.width + e.clientX - current.x;
    const state = useSidebar.getState();
    if (state.collapsed) {
      if (next >= EXPAND_WIDTH) { setWidth(next); toggle(); }
      return;
    }
    if (next < COLLAPSE_WIDTH) {
      // Keep the preferred expanded width, and keep capturing the drag so
      // reversing direction can expand the rail without another gesture.
      setWidth(current.preferredWidth);
      toggle();
      return;
    }
    setWidth(next);
  };
  const onResizeUp = () => {
    drag.current = null;
    setResizing(false);
    document.documentElement.classList.remove('flux-resizing');
  };
  useEffect(() => () => document.documentElement.classList.remove('flux-resizing'), []);
  const bell = actions.find((a) => a.route.kind === 'shell' && a.route.name === 'notifications');

  return (
    <aside id="flux-sidebar" className={'sidebar' + (resizing ? ' resizing' : '') + (collapsed ? ' collapsed' : '')} style={{ width: collapsed ? RAIL_WIDTH : width }} aria-label={t('nav.menu')}>
      <div className="sidebar-in" style={{ width: collapsed ? RAIL_WIDTH : width }}>
        <div className="sidebar-top" data-tauri-drag-region>
          {!collapsed && <TitleBar />}
          <div className="brand-logo" data-tauri-drag-region>{collapsed ? <img src="./brand/icon.svg" alt="" width={36} height={36}/> : <BrandLogo />}</div>
          <div className="fx-row">
            <button className="search-btn" onClick={onSearch} aria-label={t('nav.search')} title={t('nav.search')}>
              <Search size={15} />
              <span className="grow">{t('nav.search')}</span>
              <kbd>{MOD_KEY}K</kbd>
            </button>
            <button className="icon-btn" aria-label={t('desktop.notifications')} onClick={() => onOpen(bell?.route ?? { kind: 'shell', name: 'notifications' })}>
              <Bell size={16} />
            </button>
          </div>
        </div>
        <>{collapsed ? <SidebarRail key={account.id} pins={pins} groups={groups} activeId={activeId} childId={childId} onOpen={onOpen}/> : <nav className="nav" aria-label={t('nav.menu')}>
          {pins.length > 0 && <Pins pins={pins} activeId={activeId} childId={childId} onOpen={onOpen} />}
          {groups.map((g) => {
            const shut = g.collapsed ? !closedGroups.includes(g.id) : closedGroups.includes(g.id);
            return (
              <section key={g.id} className={'nav-group' + (shut ? ' shut' : '')}>
                <button className="nav-group-head" onClick={() => toggleGroup(g.id)} aria-expanded={!shut}>
                  <span className="grow">{g.label || t(`nav.groups.${g.id}`, { defaultValue: g.id })}</span>
                  <ChevronDown size={15} />
                </button>
                <div className="nav-group-body">
                  <div className="nav-group-inner">
                    {g.items.map((n) => {
                      const active = n.id === activeId;
                      const hasSub = n.children.length > 0;
                      const isOpen = hasSub && open.includes(n.id);
                      return (
                        <div key={n.id} className="nav-row">
                          <button
                            className={'nav-item' + (active ? ' active' : '')}
                            tabIndex={shut ? -1 : 0}
                            onClick={() => {
                              onOpen(n.route);
                              if (hasSub) toggleOpen(n.id, true);
                            }}
                            aria-current={active ? 'page' : undefined}
                          >
                            <MenuIcon slug={n.slug} icon={n.icon} iconUrl={n.iconUrl} size={28} />
                            <span className="grow ellipsis-1">{n.title}</span>
                            {n.badge ? <span className="badge">{n.badge}</span> : null}
                          </button>
                          {hasSub && (
                            <button className={'icon-btn nav-caret' + (isOpen ? ' open' : '')} tabIndex={shut ? -1 : 0} onClick={() => toggleOpen(n.id)} aria-expanded={isOpen} aria-label={t('nav.submenu')}>
                              <ChevronRight size={16} />
                            </button>
                          )}
                          {hasSub && (
                            <div className={'nav-children' + (isOpen ? ' open' : '')} aria-hidden={!isOpen}>
                              <div className="nav-children-inner">
                                {n.children.map((c) => (
                                  <button key={c.id} tabIndex={isOpen ? 0 : -1} className={'nav-child' + (active && childId === c.id ? ' active' : '')} onClick={() => onOpen(c.route)}>
                                    {c.title}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
        </nav>}</>
        <div className="sidebar-foot">
          <UpdateBanner />
          <AccountCard active={account} />
        </div>
        <div
          className="sidebar-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label={t('nav.resize')}
          tabIndex={0}
          aria-valuemin={RAIL_WIDTH}
          aria-valuemax={SIDEBAR_MAX}
          aria-valuenow={collapsed ? RAIL_WIDTH : width}
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
          onPointerCancel={onResizeUp}
          onLostPointerCapture={onResizeUp}
          onDoubleClick={() => { setWidth(260); if (collapsed) toggle(); }}
          onKeyDown={(e) => {
            if (collapsed) {
              if (['ArrowRight', 'Home', 'End', 'Enter'].includes(e.key)) {
                e.preventDefault();
                if (e.key === 'Home') setWidth(SIDEBAR_MIN);
                if (e.key === 'End') setWidth(SIDEBAR_MAX);
                toggle();
              }
              return;
            }
            if (e.key === 'ArrowLeft' && width === SIDEBAR_MIN) { e.preventDefault(); toggle(); return; }
            const next = e.key === 'Home' ? SIDEBAR_MIN : e.key === 'End' ? SIDEBAR_MAX : e.key === 'Enter' ? 260 : e.key === 'ArrowLeft' ? width - (e.shiftKey ? 40 : 10) : e.key === 'ArrowRight' ? width + (e.shiftKey ? 40 : 10) : null;
            if (next !== null) { e.preventDefault(); setWidth(next); }
          }}
        />
      </div>
    </aside>
  );
}

function Pins({ pins, activeId, childId, onOpen }: { pins: SideLink[]; activeId: string | null; childId: string | null; onOpen: (route: Route) => void }) {
  const { t } = useTranslation();
  const wideId = pins.find((n) => n.id === activeId && n.children.length > 1)?.id ?? null;
  const ordered = wideId ? [...pins.filter((n) => n.id !== wideId), pins.find((n) => n.id === wideId)!] : pins;
  const box = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const rects = useRef<{ w: number; at: Map<string, { x: number; y: number }> } | null>(null);
  const prevWide = useRef<string | null>(wideId);

  useLayoutEffect(() => {
    const root = box.current;
    if (!root) return;
    const base = root.getBoundingClientRect();
    const at = new Map<string, { x: number; y: number }>();
    els.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      at.set(id, { x: r.left - base.left, y: r.top - base.top });
    });
    const prev = rects.current;
    const changed = prevWide.current !== wideId;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (changed && prev && Math.abs(prev.w - base.width) < 1 && !reduce) {
      els.current.forEach((el, id) => {
        const a = prev.at.get(id);
        const b = at.get(id);
        if (!a || !b) return;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
      });
    }
    rects.current = { w: base.width, at };
    prevWide.current = wideId;
  }, [wideId, pins]);

  const ref = (id: string) => (el: HTMLElement | null) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  };

  return (
    <div className="nav-pins" ref={box}>
      {ordered.map((n) => {
        const active = n.id === activeId;
        if (n.id !== wideId) {
          return (
            <button key={n.id} ref={ref(n.id)} className={'nav-pin' + (active ? ' active' : '')} onClick={() => onOpen(n.route)} aria-current={active ? 'page' : undefined}>
              <MenuIcon slug={n.slug} icon={n.icon} iconUrl={n.iconUrl} size={34} />
              {n.badge ? <span className="badge">{n.badge}</span> : null}
              <span className="ellipsis-1">{n.title}</span>
            </button>
          );
        }
        return (
          <div key={n.id} ref={ref(n.id)} className="nav-pin wide active">
            <button className="nav-pin-head" onClick={() => onOpen(n.route)} aria-current="page">
              <MenuIcon slug={n.slug} icon={n.icon} iconUrl={n.iconUrl} size={34} />
              <span className="ellipsis-1">{n.title}</span>
              {n.badge ? <span className="badge">{n.badge}</span> : null}
            </button>
            <div className="nav-pin-sub" role="group" aria-label={t('nav.submenu')}>
              {n.children.map((c) => (
                <button key={c.id} className={'nav-child' + (c.id === childId ? ' active' : '')} onClick={() => onOpen(c.route)} aria-current={c.id === childId ? 'page' : undefined}>
                  <span className="grow ellipsis-1">{c.title}</span>
                  {c.id === childId ? <ChevronRight size={15} /> : null}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
