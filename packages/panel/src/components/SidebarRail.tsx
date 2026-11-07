import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { MenuIcon } from '@fluxwp/ui';
import type { SideGroup, SideLink } from '../shell/links';
import type { Route } from '../state/route';

/** The compact sidebar keeps every destination reachable and reuses one anchored flyout. */
export function SidebarRail({ pins, groups, activeId, childId, onOpen }: {
  pins: SideLink[]; groups: SideGroup[]; activeId: string | null; childId: string | null; onOpen: (route: Route) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [current, setCurrent] = useState<string | null>(null);
  const [geometry, setGeometry] = useState({ left: 80, top: 8, width: 260, height: 600 });
  const anchors = useRef(new Map<string, HTMLButtonElement>());
  const nav = useRef<HTMLElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const focusInside = useRef(false);
  const restoring = useRef(false);
  const item = [...pins, ...groups.flatMap(group => group.items)].find(row => row.id === current);
  const stopClose = () => clearTimeout(timer.current);
  const close = (restore = false) => {
    stopClose(); setCurrent(null);
    if (restore && current) { restoring.current = true; anchors.current.get(current)?.focus(); restoring.current = false; }
  };
  const later = (related: EventTarget | null) => {
    if (related instanceof Node && (nav.current?.contains(related) || popup.current?.contains(related))) return;
    stopClose(); timer.current = setTimeout(() => setCurrent(null), 250);
  };
  const show = (key: string) => { stopClose(); setCurrent(key); };
  useLayoutEffect(() => () => clearTimeout(timer.current), []);
  useLayoutEffect(() => {
    if (!item) return;
    const place = () => {
      const anchor = anchors.current.get(item.id);
      if (!anchor || !popup.current || !nav.current) return;
      const rect = anchor.getBoundingClientRect(); const bounds = nav.current.getBoundingClientRect();
      if (rect.bottom < bounds.top || rect.top > bounds.bottom) { setCurrent(null); return; }
      const view = window.visualViewport; const x = view?.offsetLeft ?? 0; const y = view?.offsetTop ?? 0;
      const width = view?.width ?? innerWidth; const height = view?.height ?? innerHeight;
      const popupWidth = Math.min(260, Math.max(160, width - rect.right - 16));
      const popupHeight = Math.min(popup.current.scrollHeight, height - 16);
      setGeometry({ left: Math.max(x + 8, Math.min(rect.right + 8, x + width - popupWidth - 8)), top: Math.max(y + 8, Math.min(rect.top, y + height - popupHeight - 8)), width: popupWidth, height: height - 16 });
    };
    place();
    if (focusInside.current) { focusInside.current = false; popup.current?.querySelector<HTMLButtonElement>('button')?.focus(); }
    const observer = new ResizeObserver(place); if (popup.current) observer.observe(popup.current);
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place); window.visualViewport?.addEventListener('scroll', place);
    const outside = (event: PointerEvent) => { if (!nav.current?.contains(event.target as Node) && !popup.current?.contains(event.target as Node)) close(); };
    document.addEventListener('pointerdown', outside, true);
    return () => { observer.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); window.visualViewport?.removeEventListener('resize', place); window.visualViewport?.removeEventListener('scroll', place); document.removeEventListener('pointerdown', outside, true); };
  }, [item]);
  const open = (route: Route) => { close(); onOpen(route); };
  const row = (link: SideLink) => <button key={link.id} ref={node => { if (node) anchors.current.set(link.id, node); else anchors.current.delete(link.id); }} type="button"
    className={'sidebar-rail-item' + (link.id === activeId ? ' active' : '')} aria-label={link.title} aria-current={link.id === activeId ? 'page' : undefined}
    aria-haspopup="menu" aria-expanded={current === link.id} aria-controls={current === link.id ? id : undefined}
    onClick={() => open(link.route)} onPointerEnter={() => show(link.id)} onPointerLeave={event => later(event.relatedTarget)}
    onFocus={() => { if (!restoring.current) show(link.id); }} onBlur={event => later(event.relatedTarget)} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); close(true); }
      if (event.key === 'ArrowRight') { event.preventDefault(); if (current === link.id && popup.current) popup.current.querySelector<HTMLButtonElement>('button')?.focus(); else { focusInside.current = true; show(link.id); } }
    }}>
    <MenuIcon slug={link.slug} icon={link.icon} iconUrl={link.iconUrl} size={30}/>{link.badge ? <span className="badge">{link.badge}</span> : null}
  </button>;
  return <>
    <nav ref={nav} className="nav sidebar-rail" aria-label={t('nav.menu')}>
      {!!pins.length && <section aria-label={t('nav.menu')}>{pins.map(row)}</section>}
      {groups.map(group => <section key={group.id} aria-label={group.label || t(`nav.groups.${group.id}`, { defaultValue: group.id })}><h2 className="sidebar-rail-heading">{group.label || t(`nav.groups.${group.id}`, { defaultValue: group.id })}</h2>{group.items.map(row)}</section>)}
    </nav>
    {item && createPortal(<div ref={popup} id={id} role="menu" aria-label={item.title} className="sidebar-rail-popup" style={{ left: geometry.left, top: geometry.top, width: geometry.width, maxHeight: geometry.height }}
      onPointerEnter={stopClose} onPointerLeave={event => later(event.relatedTarget)} onFocus={stopClose} onBlur={event => later(event.relatedTarget)} onKeyDown={event => {
        if (event.key === 'Escape' || event.key === 'ArrowLeft') { event.preventDefault(); event.stopPropagation(); close(true); return; }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); const buttons = Array.from(popup.current?.querySelectorAll<HTMLButtonElement>('button') ?? []); const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowUp' ? buttons.length - 1 : 1)) % buttons.length; buttons[next]?.focus();
        }
      }}>
      <header>{item.title}</header><div>{(item.children.length ? item.children : [item]).map(child => <button key={child.id} type="button" role="menuitem" aria-current={item.id === activeId && (item.children.length ? child.id === childId : true) ? 'page' : undefined} onClick={() => open(child.route)}>{child.title}</button>)}</div>
    </div>, document.body)}
  </>;
}
