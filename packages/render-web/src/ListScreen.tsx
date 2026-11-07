// List: rows under 1100px, table + master-detail at ≥1100 when the manifest has columns.
// Virtualized with @tanstack/react-virtual. Selection, right-click and bulk run the runtime actions.
import { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { MoreHorizontal } from 'lucide-react';
import type { ListScreen as ListScreenModel, Manifest } from '@fluxwp/manifest';
import { useListController, useRenderer, type RowView } from '@fluxwp/runtime';
import type { Route } from '@fluxwp/runtime';
import { Icon } from '@fluxwp/ui';
import { ManifestScreen } from './ManifestScreen';
import { TABLE_MIN, useMinWidth } from './width';
import { Select } from '@fluxwp/ui';

export function ListScreen({ manifest, screen, params }: { manifest: Manifest; screen: ListScreenModel; params: Record<string, string> }) {
  const c = useListController(manifest, screen, params);
  const { t } = useRenderer();
  const wide = useMinWidth(TABLE_MIN);
  const table = wide && (screen.columns?.length ?? 0) > 0;
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<Extract<Route, { kind: 'manifest' }> | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; row: RowView } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const rows = c.rows;
  const virt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => (table ? 44 : 68),
    overscan: 8,
  });

  const last = virt.getVirtualItems().at(-1)?.index ?? 0;
  const loadMore = c.loadMore;
  useEffect(() => {
    if (rows.length > 0 && last >= rows.length - 4) void loadMore();
  }, [last, rows.length, loadMore]);

  const open = (row: RowView) => {
    const route = c.routeFor(row);
    if (wide && route?.kind === 'manifest' && !(route.module === manifest.id && route.screen === (screen as { id?: string }).id)) {
      setDetail(route);
      return;
    }
    c.onPress?.(row);
  };

  const toggle = (key: string) => setSelected((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  const selectedRows = rows.filter((r) => selected.includes(r.key));

  return (
    <div className={'fx-screen' + (detail ? ' split' : '')}>
      <div className="fx-list">
        <header className="fx-head">
          <h1>{c.title}</h1>
          <div className="fx-row">
            {c.headerActions.slice(0, 2).map((a) => (
              <button key={a.id} type="button" className={a.tone === 'danger' ? 'fx-btn danger' : 'fx-btn'} disabled={c.running === a.id} onClick={() => void c.runAction(a.id)}>
                {a.icon && <Icon name={a.icon} size={15} />} {a.label}
              </button>
            ))}
            {c.headerActions.length > 2 && (
              <details className="fx-more">
                <summary aria-label={t('desktop.more')}><MoreHorizontal size={16} /></summary>
                {c.headerActions.slice(2).map((a) => (
                  <button key={a.id} type="button" onClick={() => void c.runAction(a.id)}>{a.label}</button>
                ))}
              </details>
            )}
          </div>
        </header>
        {(c.search || c.filters.length > 0) && (
          <div className="fx-tools">
            {c.search && <input className="fx-search" value={c.search.value} placeholder={c.search.placeholder || t('list.search')} onChange={(e) => c.search?.set(e.target.value)} />}
            {c.filters.map((f) =>
              f.type === 'toggle' ? (
                <label key={f.param} className="fx-check"><input type="checkbox" checked={!!f.value} onChange={(e) => c.setFilter(f.param, e.target.checked || null)} /> {f.label}</label>
              ) : (
                <Select key={f.param} aria-label={f.label} value={f.value == null ? '' : String(f.value)} onChange={(e) => c.setFilter(f.param, e.target.value || null)}>
                  <option value="">{f.label}</option>
                  {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              ),
            )}
          </div>
        )}
        {c.stale && <p className="fx-note">{t('desktop.offline')}</p>}
        {c.error && !rows.length && <p className="fx-error">{t('states.errorTitle')}</p>}
        {selected.length > 0 && c.bulkActions.length > 0 && (
          <div className="fx-bulk">
            <span>{t('desktop.selected', { count: selected.length })}</span>
            {c.bulkActions.map((a) => (
              <button key={a.id} type="button" className={a.tone === 'danger' ? 'fx-btn danger' : 'fx-btn'} onClick={() => void Promise.all(selectedRows.map((row) => c.runAction(a.id, row)))}>{a.label}</button>
            ))}
            <button type="button" className="fx-btn" onClick={() => setSelected([])}>{t('desktop.clear')}</button>
          </div>
        )}
        <div className="fx-scroller" ref={scroller}>
          {c.loading && !rows.length && <div className="fx-skel" />}
          {!c.loading && !rows.length && (
            <div className="fx-empty">
              <strong>{c.empty.searching ? t('list.noResults') : c.empty.title || t('list.empty')}</strong>
              {c.empty.body && !c.empty.searching && <p>{c.empty.body}</p>}
            </div>
          )}
          {table ? (
            <div className="fx-table">
              <div className="fx-tr head">
                <span className="fx-td check" />
                {(rows[0] ? c.cells(rows[0]) : (screen.columns ?? []).map((col) => ({ label: col.label, align: col.align ?? 'start', width: col.width, text: '' }))).map((cell) => (
                  <span key={cell.label} className={'fx-td ' + cell.align} style={cell.width ? { flex: cell.width } : undefined}>{cell.label}</span>
                ))}
              </div>
              <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
              {virt.getVirtualItems().map((v) => {
                const row = rows[v.index];
                if (!row) return null;
                const cells = c.cells(row);
                const opened = c.routeFor(row);
                const on = !!(detail && opened?.kind === 'manifest' && detail.params.id === opened.params.id);
                return (
                  <div
                    key={row.key}
                    className={'fx-tr' + (on ? ' on' : '') + (row.unread ? ' unread' : '')}
                    style={{ transform: `translateY(${v.start}px)` }}
                    onClick={() => open(row)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenu({ x: e.clientX, y: e.clientY, row });
                    }}
                  >
                    <span className="fx-td check" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.includes(row.key)} aria-label={row.title} onChange={() => toggle(row.key)} /></span>
                    {cells.map((cell) => (
                      <span key={cell.label} className={'fx-td ' + cell.align} style={cell.width ? { flex: cell.width } : undefined}>{cell.text}</span>
                    ))}
                  </div>
                );
              })}
              </div>
            </div>
          ) : (
            <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
              {virt.getVirtualItems().map((v) => {
                const row = rows[v.index];
                if (!row) return null;
                return (
                  <button
                    key={row.key}
                    type="button"
                    className={'fx-row-item' + (row.unread ? ' unread' : '')}
                    style={{ transform: `translateY(${v.start}px)` }}
                    onClick={() => open(row)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenu({ x: e.clientX, y: e.clientY, row });
                    }}
                  >
                    <Avatar row={row} />
                    <span className="fx-grow">
                      <strong>{row.title}</strong>
                      {row.subtitle && <small>{row.subtitle}</small>}
                    </span>
                    <span className="fx-meta">{row.meta}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {c.fab && (
          <button type="button" className="fx-fab" onClick={() => void c.runAction(c.fab!.id)}>{c.fab.label}</button>
        )}
      </div>
      {detail && (
        <aside className="fx-master">
          <ManifestScreen module={detail.module} screen={detail.screen} params={detail.params} />
        </aside>
      )}
      {menu && (
        <div className="fx-overlay plain" onMouseDown={() => setMenu(null)}>
          <div className="fx-menu" style={{ left: menu.x, top: menu.y }} role="menu" aria-label={t('desktop.rowActions')} onMouseDown={(e) => e.stopPropagation()}>
            {c.rowActions(menu.row).length === 0 && <p className="fx-muted">{t('palette.empty')}</p>}
            {c.rowActions(menu.row).map((a) => (
              <button key={a.id} type="button" role="menuitem" className={a.tone === 'danger' ? 'danger' : ''} onClick={() => { setMenu(null); void c.runAction(a.id, menu.row); }}>{a.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({ row }: { row: RowView }) {
  if (row.avatar?.image) return <img className="fx-av" alt="" src={row.avatar.image} />;
  const letters = (row.avatar?.text || row.title).slice(0, 2).toUpperCase();
  return <span className="fx-av">{letters}</span>;
}
