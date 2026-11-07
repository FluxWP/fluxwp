// Flux Tasks görünümleri: araç çubuğu, liste, pano, takvim, hızlı görev oluşturma (WP views.js karşılığı).
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { FlxgTask } from '@fluxwp/core';
import { addDays, between, dayKey, parseDay, rank, today, type Group, type FlxgEngine } from './engine';
import { tt, flxgLocale } from './i18n';
import {
  ago, Avatar, Avatars, cv, debounce, DueChip, fmtDue, FileImg, fullTime, Ic, pickDate, pickList, pickPeople, pickPriority, pickStatus, pickTags, PrioFlag,
  StatusPill, TagChips, useYtg, type Ctx, type MenuItem,
} from './ui';
import { DndArea, useDragItem, useDropZone, type DropInfo } from './dnd';
import { Select } from '@fluxwp/ui';

type Col = { key: string; name: string; w: string; field?: { key: string; id: number; ids: number[]; name: string; type: string; options: Record<string, unknown> } };
type T = FlxgTask & { _ctx?: boolean; _outside?: boolean };

/* ---------------- Sütunlar ---------------- */
export function builtinCols(e: FlxgEngine): Col[] {
  const mt = e.meetingScope();
  const b: Col[] = [
    { key: 'status', name: tt('Durum'), w: '130px' },
    { key: 'assignees', name: mt ? tt('Katılımcılar') : tt('Atananlar'), w: '120px' },
    { key: 'due', name: mt ? tt('Tarih') : tt('Bitiş'), w: '120px' },
    { key: 'start', name: tt('Başlangıç'), w: '120px' },
    { key: 'priority', name: tt('Öncelik'), w: '110px' },
    { key: 'tags', name: tt('Etiketler'), w: '170px' },
    { key: 'created', name: tt('Oluşturma'), w: '120px' },
    { key: 'updated', name: tt('Güncelleme'), w: '120px' },
    { key: 'comments', name: tt('Yorum'), w: '80px' },
  ];
  if (e.S.scope && e.S.scope.type !== 'list') b.splice(1, 0, { key: 'list', name: tt('Liste'), w: '150px' });
  return b;
}
export function columnDefs(e: FlxgEngine): Col[] {
  const all = builtinCols(e);
  for (const f of e.scopeFields())
    all.push({ key: f.key, name: f.name, w: f.type === 'textarea' ? '220px' : f.type === 'checkbox' || f.type === 'rating' ? '110px' : '150px', field: f as Col['field'] });
  return all;
}
export function visibleCols(e: FlxgEngine) {
  const defs = columnDefs(e);
  return (e.viewCfg().fields ?? []).map((k) => defs.find((d) => d.key === k)).filter(Boolean) as Col[];
}
export const fieldTypeIcon = (type: string) =>
  ({ text: 'T', textarea: '¶', number: '#', money: '₺', date: '📅', checkbox: '☑', dropdown: '▾', labels: '⧉', rating: '★', people: '@', file: '📎', url: '🔗', email: '✉', phone: '☎' })[type] ?? '•';

/** Özel alan değerinin görünümü. */
export function FieldView({ field, v, compact }: { field: { type: string; options?: Record<string, unknown> }; v: unknown; compact?: boolean }) {
  if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) return null;
  const o = (field.options ?? {}) as { choices?: { id: string; label: string; color: string }[]; max?: number; currency?: string; decimals?: number };
  const loc = flxgLocale();
  switch (field.type) {
    case 'checkbox':
      return v ? <span className="flxg-fv is-check"><Ic n="check" s={14} /></span> : null;
    case 'rating':
      return (
        <span className="flxg-stars">
          {Array.from({ length: o.max ?? 5 }, (_, i) => (
            <Ic key={i} n={i + 1 <= Number(v) ? 'star-fill' : 'star'} s={13} cls={i + 1 <= Number(v) ? 'is-on' : ''} />
          ))}
        </span>
      );
    case 'dropdown': {
      const c = (o.choices ?? []).find((x) => x.id === v);
      return c ? <span className="flxg-choice" style={cv(c.color)}>{c.label}</span> : null;
    }
    case 'labels':
      return (
        <span className="flxg-tags">
          {(Array.isArray(v) ? v : []).map((id) => {
            const c = (o.choices ?? []).find((x) => x.id === id);
            return c ? <span key={c.id} className="flxg-tag" style={cv(c.color)}>{c.label}</span> : null;
          })}
        </span>
      );
    case 'people':
      return <Avatars ids={(Array.isArray(v) ? v : []).map(Number)} size={20} max={3} />;
    case 'money':
      try {
        return <span className="flxg-fv">{new Intl.NumberFormat(loc, { style: 'currency', currency: o.currency || 'TRY', maximumFractionDigits: 2 }).format(Number(v))}</span>;
      } catch {
        return <span className="flxg-fv">{String(v)}</span>;
      }
    case 'number':
      return <span className="flxg-fv">{new Intl.NumberFormat(loc, { maximumFractionDigits: o.decimals || 2 }).format(Number(v))}</span>;
    case 'date':
      return <span className="flxg-fv">{fmtDue(String(v))}</span>;
    case 'url':
      return (
        <a className="flxg-fv is-link" href={String(v)} target="_blank" rel="noopener noreferrer" onClick={(ev) => ev.stopPropagation()}>
          {String(v).replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)}
        </a>
      );
    case 'email':
      return <a className="flxg-fv is-link" href={'mailto:' + v} onClick={(ev) => ev.stopPropagation()}>{String(v)}</a>;
    case 'phone':
      return <a className="flxg-fv is-link" href={'tel:' + String(v).replace(/\s/g, '')} onClick={(ev) => ev.stopPropagation()}>{String(v)}</a>;
    case 'file':
      return <span className="flxg-fv"><Ic n="clip" s={13} /> {Array.isArray(v) ? v.length : 0}</span>;
    case 'textarea':
      return <span className="flxg-fv is-text">{compact ? String(v).slice(0, 80) : String(v)}</span>;
    default:
      return <span className="flxg-fv">{String(v)}</span>;
  }
}

/** Özel alanı açılır kutuda düzenleme (liste hücresi ve detay). */
export function editFieldPop(c: Ctx, anchor: HTMLElement, task: FlxgTask, f: { id: number; name: string; type: string; options: Record<string, unknown> }, after?: () => void, patchFn?: (id: number, p: Record<string, unknown>) => Promise<unknown>) {
  const { e, ui } = c;
  const cur = task.fields?.[f.id] as unknown;
  const save = (v: unknown) => {
    const p = (patchFn ?? ((id, pp) => e.patchTask(id, pp)))(task.id, { fields: { [f.id]: v } });
    if (after) p.then(after, () => {});
  };
  const o = (f.options ?? {}) as { choices?: { id: string; label: string; color: string }[]; max?: number };
  if (f.type === 'dropdown') {
    ui.menu(anchor, [{ head: f.name }, ...(o.choices ?? []).map((ch) => ({ label: ch.label, swatch: ch.color, checked: cur === ch.id, onClick: () => save(ch.id) })), { sep: true }, { label: tt('Temizle'), icon: 'x', onClick: () => save(null) }]);
    return;
  }
  if (f.type === 'checkbox') return save(!cur);
  if (f.type === 'date') return pickDate(c, anchor, String(cur || ''), (v) => save(v || null), { label: f.name });
  if (f.type === 'people') return pickPeople(c, anchor, Array.isArray(cur) ? cur.map(Number) : [], debounce((ids) => save(ids), 500));
  if (f.type === 'labels') {
    const deb = debounce((v: string[]) => save(v), 500);
    ui.openPop(anchor, <LabelsPick name={f.name} choices={o.choices ?? []} cur={Array.isArray(cur) ? (cur as string[]) : []} onChange={deb} />);
    return;
  }
  if (f.type === 'rating') {
    ui.openPop(
      anchor,
      <div className="flxg-pick">
        <div className="flxg-menu-head">{f.name}</div>
        <div className="flxg-stars is-big">
          {Array.from({ length: o.max ?? 5 }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" aria-label={String(n)} onClick={() => (save(n === cur ? null : n), ui.closePop())}>
              <Ic n={n <= Number(cur || 0) ? 'star-fill' : 'star'} s={22} cls={n <= Number(cur || 0) ? 'is-on' : ''} />
            </button>
          ))}
        </div>
      </div>,
    );
    return;
  }
  if (f.type === 'file') return e.openTask(task.id);
  ui.openPop(anchor, <TextFieldPop f={f} cur={cur} onSave={(v) => (save(v), ui.closePop())} />, { cls: '' });
}
function LabelsPick({ name, choices, cur, onChange }: { name: string; choices: { id: string; label: string; color: string }[]; cur: string[]; onChange: (v: string[]) => void }) {
  const [sel, setSel] = useState(cur);
  return (
    <div className="flxg-pick">
      <div className="flxg-menu-head">{name}</div>
      <div className="flxg-pick-list">
        {choices.map((ch) => {
          const on = sel.includes(ch.id);
          return (
            <button key={ch.id} type="button" className={'flxg-pick-item' + (on ? ' is-on' : '')} onClick={() => { const n = on ? sel.filter((x) => x !== ch.id) : [...sel, ch.id]; setSel(n); onChange(n); }}>
              <span className="flxg-tag" style={cv(ch.color)}>{ch.label}</span>
              {on && <Ic n="check" s={14} cls="flxg-menu-check" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
function TextFieldPop({ f, cur, onSave }: { f: { name: string; type: string }; cur: unknown; onSave: (v: unknown) => void }) {
  const area = f.type === 'textarea';
  const [v, setV] = useState(cur === null || cur === undefined ? '' : String(cur));
  const go = () => onSave(v.trim() === '' ? null : v.trim());
  const type = f.type === 'number' || f.type === 'money' ? 'number' : f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : f.type === 'phone' ? 'tel' : 'text';
  return (
    <div className="flxg-pick is-form">
      <div className="flxg-menu-head">{f.name}</div>
      {area ? (
        <textarea className="flxg-input" rows={5} value={v} onChange={(ev) => setV(ev.target.value)} onKeyDown={(ev) => ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey) && (ev.preventDefault(), go())} />
      ) : (
        <input className="flxg-input" type={type} step="any" value={v} onChange={(ev) => setV(ev.target.value)} onKeyDown={(ev) => ev.key === 'Enter' && (ev.preventDefault(), go())} />
      )}
      <div className="flxg-row-btns">
        <button type="button" className="flxg-btn is-primary is-sm" onClick={go}>{tt('Kaydet')}</button>
      </div>
    </div>
  );
}

/** Liste hücresi (tıklanınca yerinde düzenler). */
export function Cell({ task, col, patch, after }: { task: FlxgTask; col: Col; patch?: (id: number, p: Record<string, unknown>) => Promise<unknown>; after?: () => void }) {
  const c = useYtg();
  const { e } = c;
  const doPatch = patch ?? ((id: number, p: Record<string, unknown>) => e.patchTask(id, p));
  const editable = e.canList(task.list, 'edit') && !!task.id;
  let body: ReactNode = null;
  let onEdit: ((a: HTMLElement) => void) | null = null;
  switch (col.key) {
    case 'status':
      body = <StatusPill task={task} small />;
      onEdit = (a) => pickStatus(c, a, task.list, task.status, (k) => void doPatch(task.id, { status: k }));
      break;
    case 'list': {
      const l = e.list(task.list);
      body = <span className="flxg-listname"><span className="flxg-dot" style={{ background: l?.color ?? '#999' }} />{l?.name ?? ''}</span>;
      break;
    }
    case 'assignees':
      body = task.assignees.length ? <Avatars ids={task.assignees} size={24} max={3} /> : <span className="flxg-ph-ic"><Ic n="user" s={15} /></span>;
      onEdit = (a) => pickPeople(c, a, task.assignees, debounce((ids) => void doPatch(task.id, { assignees: ids }), 400));
      break;
    case 'due':
    case 'start':
      body = task[col.key] ? <DueChip task={task} k={col.key} /> : <span className="flxg-ph-ic"><Ic n="calendar" s={15} /></span>;
      onEdit = (a) => pickDate(c, a, task[col.key as 'due'], (v) => void doPatch(task.id, { [col.key]: v }));
      break;
    case 'priority':
      body = task.priority ? <PrioFlag n={task.priority} label /> : <span className="flxg-ph-ic"><Ic n="flag" s={15} /></span>;
      onEdit = (a) => pickPriority(c, a, task.priority, (n) => void doPatch(task.id, { priority: n }));
      break;
    case 'tags':
      body = task.tags.length ? <TagChips ids={task.tags} max={3} /> : <span className="flxg-ph-ic"><Ic n="tag" s={15} /></span>;
      onEdit = (a) => pickTags(c, a, e.list(task.list)?.space_id ?? 0, task.tags, debounce((ids) => void doPatch(task.id, { tags: ids }), 400));
      break;
    case 'created':
    case 'updated':
      body = <span className="flxg-muted" title={fullTime(task[col.key])}>{ago(task[col.key])}</span>;
      break;
    case 'comments':
      body = task.comments ? <span className="flxg-meta"><Ic n="msg" s={13} />{task.comments}</span> : null;
      break;
    default:
      if (col.field) {
        const fv = e.fieldValue(task, col.field);
        body = (fv && <FieldView field={fv.field} v={fv.v} compact />) || <span className="flxg-ph-ic">—</span>;
        const own = e.fieldsFor(task.list).find((f) => col.field!.ids.includes(f.id));
        if (own) onEdit = (a) => editFieldPop(c, a, task, own as never, after, doPatch);
      }
  }
  const canEdit = editable && !!onEdit;
  return (
    <div
      className={'flxg-cell' + (canEdit ? ' is-edit' : '')}
      data-col={col.key}
      onClick={canEdit ? (ev) => (ev.stopPropagation(), onEdit!(ev.currentTarget)) : undefined}
      onPointerDown={canEdit ? (ev) => ev.stopPropagation() : undefined}
    >
      {body}
    </div>
  );
}

/* ---------------- Araç çubuğu ---------------- */
export function Toolbar({ onQuick }: { onQuick: () => void }) {
  const c = useYtg();
  const { e, ui } = c;
  const S = e.S;
  const cfg = e.viewCfg();
  const v = S.view;
  const f = (cfg.filters ?? {}) as Record<string, unknown>;
  const [q, setQ] = useState(S.q);
  const deb = useRef(debounce((x: string) => ((S.q = x), e.bump()), 150)).current;
  useEffect(() => setQ(S.q), [S.scope, S.q]);
  let fcount = 0;
  for (const k of ['status', 'assignees', 'priority', 'tags']) if (Array.isArray(f[k]) && (f[k] as unknown[]).length) fcount++;
  if (f.due) fcount++;
  if (f.fields) fcount += Object.keys(f.fields as object).length;
  if (cfg.showDone === false) fcount++;
  const gl = e.groupOptions().find((o) => o.id === cfg.group)?.label ?? tt('Durum');
  const canAdd = e.scopeLists().some((l) => rank(l.role) >= 3);
  const sortMenu = (a: HTMLElement) => {
    const opts: [string, string][] = [['position', tt('Elle sıralama')], ['due', tt('Bitiş tarihi')], ['start', tt('Başlangıç tarihi')], ['priority', tt('Öncelik')], ['created', tt('Oluşturma')], ['updated', tt('Güncelleme')], ['title', tt('Ad')]];
    const s = cfg.sort ?? { by: 'position', dir: 'asc' as const };
    ui.menu(a, [
      { head: tt('Sırala') },
      ...opts.map((o) => ({ label: o[1], checked: s.by === o[0], onClick: () => ((cfg.sort = { by: o[0], dir: s.dir || 'asc' }), e.touchDraft()) })),
      { sep: true },
      { label: tt('Artan'), checked: s.dir !== 'desc', onClick: () => ((cfg.sort = { by: s.by, dir: 'asc' }), e.touchDraft()) },
      { label: tt('Azalan'), checked: s.dir === 'desc', onClick: () => ((cfg.sort = { by: s.by, dir: 'desc' }), e.touchDraft()) },
    ]);
  };
  const subMenu = (a: HTMLElement) => {
    const m = cfg.subtasks ?? 'open';
    const set = (x: 'open' | 'closed' | 'off') => {
      cfg.subtasks = x;
      store('sub-open', null);
      S.addUnder = 0;
      saveViewPart(e, ['subtasks']);
      e.bump();
    };
    ui.menu(a, [
      { head: tt('Alt görevler') },
      { label: tt('Görevin altında, açık'), checked: m === 'open', onClick: () => set('open') },
      { label: tt('Görevin altında, kapalı'), checked: m === 'closed', onClick: () => set('closed') },
      { label: tt('Gösterme'), checked: m === 'off', onClick: () => set('off') },
      { sep: true },
      { label: tt('Filtreyi alt görevlere de uygula'), checked: !!cfg.subFilter, onClick: () => ((cfg.subFilter = !cfg.subFilter), e.touchDraft()) },
    ]);
  };
  const saveMenu = (a: HTMLElement) => {
    const view = S.view!;
    const role = S.scope?.role ?? 'view';
    ui.menu(a, [
      {
        label: tt('Bu görünüme kaydet'), icon: 'check', disabled: view.user_id === 0 && rank(role) < 3,
        onClick: () => e.api.updateView(view.id, { config: S.draft }).then((r) => { Object.assign(view, r.view); e.setView(view); e.bump(); ui.toast(tt('Görünüm kaydedildi')); }, ui.fail),
      },
      {
        label: tt('Yeni görünüm olarak kaydet'), icon: 'plus',
        onClick: () => void ui.prompt(tt('Görünüm adı'), view.name + ' – ' + tt('filtreli')).then((name) => {
          if (!name) return;
          e.api.createView({ scope: S.scope!.type, scope_id: S.scope!.type === 'home' ? S.me!.id : S.scope!.id, name, type: view.type, config: S.draft, shared: rank(role) >= 3 }).then((r) => {
            S.views = r.views;
            void e.go({ ...S.route, view: r.view.id });
          }, ui.fail);
        }),
      },
      { sep: true },
      { label: tt('Değişiklikleri geri al'), icon: 'x', onClick: () => (e.setView(view), e.bump()) },
    ]);
  };
  return (
    <div className="flxg-toolbar">
      <div className="flxg-tb-left">
        <label className="flxg-search-wrap">
          <Ic n="search" s={15} />
          <input className="flxg-input flxg-search" type="search" placeholder={tt('Görev ara…')} value={q} onChange={(ev) => (setQ(ev.target.value), deb(ev.target.value))} />
        </label>
      </div>
      <div className="flxg-tb-right">
        <button type="button" className={'flxg-tb-btn' + (fcount ? ' is-active' : '')} onClick={(ev) => ui.openPop(ev.currentTarget, <FilterPop />, { cls: 'is-wide', alignRight: true, inline: true })}>
          <Ic n="filter" s={15} />
          <span className="flxg-tb-label">{tt('Filtre')}</span>
          {fcount > 0 && <span className="flxg-badge">{fcount}</span>}
        </button>
        {v && v.type !== 'calendar' && (
          <>
            <button type="button" className="flxg-tb-btn" onClick={(ev) => ui.menu(ev.currentTarget, [{ head: tt('Grupla') }, ...e.groupOptions().map((o) => ({ label: o.label, checked: (cfg.group || 'status') === o.id, onClick: () => ((cfg.group = o.id), e.touchDraft()) }))])}>
              <Ic n="group" s={15} />
              <span className="flxg-tb-label">{tt('Grup: {n}', { n: gl })}</span>
            </button>
            <button type="button" className={'flxg-tb-btn' + (cfg.sort && cfg.sort.by !== 'position' ? ' is-active' : '')} onClick={(ev) => sortMenu(ev.currentTarget)}>
              <Ic n="sort" s={15} />
              <span className="flxg-tb-label">{tt('Sırala')}</span>
            </button>
          </>
        )}
        {v?.type === 'list' && (
          <button type="button" className={'flxg-tb-btn' + ((cfg.subtasks ?? 'open') !== 'open' ? ' is-active' : '')} onClick={(ev) => subMenu(ev.currentTarget)}>
            <Ic n="subtask" s={15} />
            <span className="flxg-tb-label">{tt('Alt görevler')}</span>
          </button>
        )}
        <button type="button" className="flxg-tb-btn" onClick={(ev) => ui.openPop(ev.currentTarget, <FieldsPop />, { alignRight: true, inline: true })}>
          <Ic n="columns" s={15} />
          <span className="flxg-tb-label">{tt('Alanlar')}</span>
        </button>
        {S.dirty && v && (
          <button type="button" className="flxg-tb-btn is-save" onClick={(ev) => saveMenu(ev.currentTarget)}>
            <Ic n="check" s={15} />
            <span className="flxg-tb-label">{tt('Görünümü kaydet')}</span>
          </button>
        )}
        {canAdd && (
          <button type="button" className="flxg-btn is-primary flxg-add-task" onClick={onQuick}>
            <Ic n="plus" s={16} />
            <span>{e.meetingScope() ? tt('Toplantı') : tt('Görev')}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function store(k: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem('flxg-' + k);
    else localStorage.setItem('flxg-' + k, v);
  } catch {
    /* yok */
  }
}

/** Görünüm ayarının bir kısmını hemen kaydeder; yetki yoksa taslakta kalır. */
export function canEditView(e: FlxgEngine) {
  const v = e.S.view;
  if (!v || !e.S.scope) return false;
  if (v.user_id) return v.user_id === e.S.me!.id;
  return rank(e.S.scope.role) >= 3;
}
export function saveViewPart(e: FlxgEngine, keys: string[]) {
  const v = e.S.view;
  if (!v) return;
  const c = e.viewCfg() as Record<string, unknown>;
  if (!canEditView(e)) return e.touchDraft();
  const conf = JSON.parse(JSON.stringify(v.config ?? {})) as Record<string, unknown>;
  for (const k of keys) {
    if (c[k] === undefined) delete conf[k];
    else conf[k] = JSON.parse(JSON.stringify(c[k]));
  }
  v.config = conf;
  e.api.updateView(v.id, { config: conf }).then((r) => {
    if (r?.view && e.S.view === v) v.config = r.view.config;
  }, e.onError);
}

function FilterPop() {
  const { e } = useYtg();
  const S = e.S;
  const cfg = e.viewCfg();
  cfg.filters ??= {};
  const f = cfg.filters as Record<string, unknown>;
  const list = (k: string) => (Array.isArray(f[k]) ? (f[k] as string[]) : []);
  const toggle = (k: string, val: string) => {
    const a = list(k).slice();
    const i = a.indexOf(val);
    if (i > -1) a.splice(i, 1);
    else a.push(val);
    if (a.length) f[k] = a;
    else delete f[k];
    e.touchDraft();
  };
  const chip = (k: string, val: string, label: string, color?: string, extra?: ReactNode) => (
    <button key={k + val} type="button" className={'flxg-fchip' + (list(k).includes(val) ? ' is-on' : '')} style={color ? cv(color) : undefined} onClick={() => toggle(k, val)}>
      {extra ?? (color ? <span className="flxg-dot" style={{ background: color }} /> : null)}
      {label}
    </button>
  );
  const sec = (title: string, nodes: ReactNode) => (
    <div className="flxg-fsec">
      <div className="flxg-fsec-title">{title}</div>
      <div className="flxg-fchips">{nodes}</div>
    </div>
  );
  const tags = e.scopeTags();
  const dues: [string, string][] = [['overdue', tt('Gecikmiş')], ['today', tt('Bugün')], ['week', tt('7 gün içinde')], ['has', tt('Tarihli')], ['none', tt('Tarihsiz')]];
  return (
    <div className="flxg-filter">
      {sec(tt('Durum'), e.scopeStatuses().map((s) => chip('status', s.key, s.label, s.color)))}
      {sec(tt('Atanan'), [chip('assignees', 'me', tt('Bana atananlar')), chip('assignees', 'none', tt('Atanmamış')), ...S.userList.filter((u) => u.id !== S.me!.id).map((u) => chip('assignees', String(u.id), u.name, undefined, <Avatar u={u} size={18} />))])}
      {sec(tt('Öncelik'), [...S.config.priorities.map((p) => chip('priority', String(p.id), p.label, p.color)), chip('priority', '0', tt('Yok'))])}
      {tags.length > 0 && sec(tt('Etiket'), [...tags.map((tg) => chip('tags', String(tg.id), tg.name, tg.color)), chip('tags', 'none', tt('Etiketsiz'))])}
      {sec(
        tt('Bitiş tarihi'),
        dues.map((d) => (
          <button key={d[0]} type="button" className={'flxg-fchip' + (f.due === d[0] ? ' is-on' : '')} onClick={() => ((f.due === d[0] ? delete f.due : (f.due = d[0])), e.touchDraft())}>
            {d[1]}
          </button>
        )),
      )}
      <label className="flxg-switch-row">
        <input type="checkbox" checked={cfg.showDone !== false} onChange={(ev) => ((cfg.showDone = ev.target.checked), e.touchDraft())} />
        <span>{tt('Tamamlanan görevleri göster')}</span>
      </label>
      {S.view?.type === 'list' && (
        <label className="flxg-switch-row">
          <input type="checkbox" checked={!!cfg.subFilter} onChange={(ev) => ((cfg.subFilter = ev.target.checked), e.touchDraft())} />
          <span>
            <b>{tt('Filtreyi alt görevlere de uygula')}</b>
            <small>{tt('Kapalıyken filtreye uyan görevlerin tüm alt görevleri görünür. Açıkken yalnız filtreye uyan alt görevler görünür; üst görevi uymasa da soluk olarak gösterilir.')}</small>
          </span>
        </label>
      )}
      <div className="flxg-row-btns">
        <button type="button" className="flxg-btn is-ghost is-sm" onClick={() => ((cfg.filters = {}), (cfg.showDone = true), e.touchDraft())}>
          {tt('Filtreleri temizle')}
        </button>
      </div>
    </div>
  );
}

function FieldsPop() {
  const { e } = useYtg();
  const cfg = e.viewCfg();
  const vis = cfg.fields ?? [];
  const type = e.S.view?.type;
  return (
    <div className="flxg-fieldspop">
      {type !== 'list' && (
        <label className="flxg-switch-row is-strong">
          <input type="checkbox" checked={!!cfg.cover} onChange={(ev) => ((cfg.cover = ev.target.checked), e.touchDraft())} />
          <Ic n="image" s={15} />
          <span>{tt('Kapak görselini göster')}</span>
        </label>
      )}
      {type === 'list' && (
        <label className="flxg-switch-row is-strong">
          <input type="checkbox" checked={!!cfg.wrap} onChange={(ev) => ((cfg.wrap = ev.target.checked), saveViewPart(e, ['wrap']), e.bump())} />
          <Ic n="list" s={15} />
          <span>
            <b>{tt('Metni sar')}</b>
            <small>{tt('Uzun metinler en fazla 3 satır görünür, fazlası … ile kısalır.')}</small>
          </span>
        </label>
      )}
      {type === 'calendar' && (
        <>
          <div className="flxg-menu-head">{tt('Takvimde kullanılacak tarih')}</div>
          {(['due', 'start'] as const).map((k) => (
            <label key={k} className="flxg-switch-row">
              <input type="radio" name="flxg-df" checked={(cfg.dateField || 'due') === k} onChange={() => ((cfg.dateField = k), e.touchDraft())} />
              <span>{k === 'due' ? tt('Bitiş tarihi') : tt('Başlangıç tarihi')}</span>
            </label>
          ))}
        </>
      )}
      <div className="flxg-menu-head">{type === 'list' ? tt('Sütunlar') : tt('Kartta gösterilecek alanlar')}</div>
      {columnDefs(e).map((d) => {
        const on = vis.includes(d.key);
        return (
          <label key={d.key} className="flxg-switch-row">
            <input type="checkbox" checked={on} onChange={() => ((cfg.fields = on ? vis.filter((k) => k !== d.key) : [...vis, d.key]), e.touchDraft())} />
            {d.field && <span className="flxg-ftype">{fieldTypeIcon(d.field.type)}</span>}
            <span>{d.name}</span>
          </label>
        );
      })}
    </div>
  );
}

/* ---------------- Sürükle-bırak sonucu ---------------- */
function dropToGroup(e: FlxgEngine, info: DropInfo, groups: Group[], fromKey: string | null, extra?: Record<string, unknown> | null, ui?: Ctx['ui']) {
  const task = e.S.tasks[info.id];
  if (!task) return;
  const g = groups.find((x) => x.key === info.zone);
  const patch: Record<string, unknown> = { ...(extra ?? {}) };
  if (g && info.zone !== fromKey) {
    if (!g.patch) return ui?.toast(tt('Bu gruba taşınamaz.'), { error: true });
    const p = g.patch(task, fromKey);
    if (!p) return ui?.toast(tt('Bu listede uygun durum yok.'), { error: true });
    Object.assign(patch, p);
  }
  const s = e.viewCfg().sort;
  if (!s || s.by === 'position') {
    const a = info.after ? e.S.tasks[info.after] : null;
    const b = info.before ? e.S.tasks[info.before] : null;
    const pos = between(a ? a.pos : null, b ? b.pos : null);
    if (pos !== task.pos) patch.position = pos;
  }
  if (Object.keys(patch).length) void e.patchTask(info.id, patch).catch(() => {});
}

/* ---------------- Liste görünümü ---------------- */
const subOverrides = () => {
  try {
    return (JSON.parse(localStorage.getItem('flxg-sub-open') ?? '{}') as Record<number, number>) ?? {};
  } catch {
    return {};
  }
};
const isSubOpen = (id: number, mode: string) => {
  const o = subOverrides();
  return o[id] !== undefined ? !!o[id] : mode !== 'closed';
};
const setSubOpen = (id: number, open: boolean) => {
  const o = subOverrides();
  o[id] = open ? 1 : 0;
  store('sub-open', JSON.stringify(o));
};

function colsTemplate(e: FlxgEngine, cols: Col[]) {
  const w = e.viewCfg().widths ?? {};
  return '34px ' + (w.title || 360) + 'px ' + cols.map((x) => (w[x.key] ? +w[x.key]! : parseInt(x.w, 10) || 140) + 'px').join(' ') + ' minmax(0, 1fr)';
}

function HeadRow({ cols, onResize }: { cols: Col[]; onResize: () => void }) {
  const { e } = useYtg();
  const cfg = e.viewCfg();
  const grip = (key: string) => (
    <span
      className="flxg-col-resize"
      aria-hidden="true"
      title={tt('Genişliği değiştirmek için sürükleyin, sıfırlamak için çift tıklayın')}
      onClick={(ev) => ev.stopPropagation()}
      onDoubleClick={(ev) => {
        ev.stopPropagation();
        cfg.widths = { ...(cfg.widths ?? {}) };
        delete cfg.widths[key];
        saveViewPart(e, ['widths']);
        onResize();
      }}
      onPointerDown={(ev) => {
        if (ev.button !== 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        const cell = (ev.currentTarget as HTMLElement).parentElement!;
        const sx = ev.clientX;
        const sw = cell.getBoundingClientRect().width;
        cfg.widths = { ...(cfg.widths ?? {}) };
        document.body.classList.add('flxg-col-resizing');
        const mv = (m: PointerEvent) => {
          cfg.widths![key] = Math.round(Math.max(key === 'title' ? 160 : 60, Math.min(900, sw + m.clientX - sx)));
          onResize();
        };
        const up = () => {
          document.removeEventListener('pointermove', mv);
          document.removeEventListener('pointerup', up);
          document.body.classList.remove('flxg-col-resizing');
          saveViewPart(e, ['widths']);
        };
        document.addEventListener('pointermove', mv);
        document.addEventListener('pointerup', up);
      }}
    />
  );
  return (
    <div className="flxg-row is-head">
      <span />
      <span className="flxg-hcell">
        <span className="flxg-hcell-label">{e.meetingScope() ? tt('Toplantı') : tt('Görev adı')}</span>
        {grip('title')}
      </span>
      {cols.map((col) => (
        <span key={col.key} className="flxg-hcell">
          <span className="flxg-hcell-label">{col.name}</span>
          {grip(col.key)}
        </span>
      ))}
    </div>
  );
}

export function ListView() {
  const c = useYtg();
  const { e, ui } = c;
  const S = e.S;
  const cfg = e.viewCfg();
  const mode = cfg.subtasks ?? 'open';
  const subFilter = !!cfg.subFilter;
  const tasks = e.filtered({ context: mode !== 'off' && subFilter });
  const groups = e.groups(tasks, cfg.group || 'status');
  const cols = visibleCols(e);
  const [, force] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const kidsIdx = mode === 'off' ? {} : e.childIndex();
  const canAddAny = e.scopeLists().some((l) => rank(l.role) >= 3);
  const [dragKids, setDragKids] = useState<Set<number>>(new Set());
  if (!tasks.length && S.scope?.type === 'home') return <EmptyState />;
  const hasMatch = (task: FlxgTask): boolean => (kidsIdx[task.id] ?? []).some((k) => e.taskMatches(k) || hasMatch(k));
  const visibleKids = (task: FlxgTask) => (kidsIdx[task.id] ?? []).filter((k) => !subFilter || e.taskMatches(k) || S.keep[k.id] || hasMatch(k));
  const rowsOf = (task: T, depth: number, guard: number, out: ReactNode[]) => {
    const kids = mode === 'off' ? [] : visibleKids(task);
    const open = kids.length > 0 && isSubOpen(task.id, mode);
    out.push(
      <ListRow
        key={task.id}
        task={task}
        cols={cols}
        depth={depth}
        parent={depth ? task.parent : 0}
        kids={mode === 'off' ? -1 : kids.length}
        open={open}
        ctx={subFilter && depth > 0 && !e.taskMatches(task)}
        hidden={dragKids.has(task.id)}
        canSub={mode !== 'off' && e.canList(task.list, 'edit') && e.taskDepth(task) < e.depthLimit(task.list)}
        toggle={() => (setSubOpen(task.id, !open), e.bump())}
        addSub={() => (setSubOpen(task.id, true), (S.addUnder = task.id), e.bump())}
      />,
    );
    if (open && guard < 12) kids.forEach((k) => rowsOf(k, depth + 1, guard + 1, out));
    if (S.addUnder === task.id) out.push(<SubAddRow key={'sa' + task.id} parent={task} depth={depth + 1} />);
  };
  const collapsed = cfg.collapsed ?? [];
  let total = 0;
  const onDrop = (info: DropInfo) => {
    const task = S.tasks[info.id];
    if (!task) return;
    const rowEl = (id: number | null) => (id ? info.items.find((x) => Number(x.dataset.dndItem) === id) ?? null : null);
    const prevEl = rowEl(info.after);
    const nextEl = rowEl(info.before);
    const dPrev = prevEl ? +prevEl.dataset.depth! : -1;
    const dNext = nextEl ? +nextEl.dataset.depth! : -1;
    let parent = nextEl && dNext > dPrev ? +nextEl.dataset.parent! : prevEl ? +prevEl.dataset.parent! : nextEl ? +nextEl.dataset.parent! : 0;
    const fromKey = document.querySelector(`[data-dnd-item="${info.id}"]`)?.closest<HTMLElement>('[data-dnd-zone]')?.dataset.dndZone ?? null;
    for (let p = parent, i = 0; p && i < 15; i++) {
      if (p === info.id) return;
      p = S.tasks[p]?.parent ?? 0;
    }
    if (!parent) return dropToGroup(e, info, groups, fromKey, task.parent ? { parent: 0 } : null, ui);
    const patch: Record<string, unknown> = {};
    if (parent !== task.parent) {
      patch.parent = parent;
      const pt = S.tasks[parent];
      if (pt && pt.list !== task.list) patch.list = pt.list;
    }
    const s = cfg.sort;
    if (!s || s.by === 'position') {
      let a: FlxgTask | null = null;
      for (let x: FlxgTask | undefined = prevEl ? S.tasks[+prevEl.dataset.dndItem!] : undefined, j = 0; x && j < 15; j++) {
        if ((x.parent || 0) === parent && x.id !== parent) {
          a = x;
          break;
        }
        if (x.id === parent) break;
        x = S.tasks[x.parent];
      }
      const b = nextEl && +nextEl.dataset.parent! === parent ? S.tasks[+nextEl.dataset.dndItem!] : null;
      const pos = between(a ? a.pos : null, b ? b.pos : null);
      if (pos !== task.pos) patch.position = pos;
    }
    if (patch.parent !== undefined) setSubOpen(parent, true);
    if (Object.keys(patch).length) void e.patchTask(info.id, patch).catch(() => {});
    parent = 0;
  };
  const style = { '--cols': colsTemplate(e, cols) } as CSSProperties;
  return (
    <DndArea
      onDrop={onDrop}
      canStart={(id) => e.canList(S.tasks[id]?.list ?? 0, 'edit')}
      overlay={(id) => <div className="flxg-row flxg-drag-ghost-row">{S.tasks[id]?.title}</div>}
      onStart={(id) => {
        const hide = new Set<number>();
        const walk = (pid: number) => (kidsIdx[pid] ?? []).forEach((k) => (hide.add(k.id), walk(k.id)));
        walk(id);
        setDragKids(hide);
      }}
      onEnd={() => setDragKids(new Set())}
    >
      <div className="flxg-scroll-x">
        <div ref={wrapRef} className={'flxg-listview' + (cfg.wrap ? ' is-wrap' : '')} style={style}>
          {groups.map((g) => {
            if (!g.tasks.length && g.key === 'all' && !tasks.length) return null;
            if (!g.tasks.length && (cfg.group === 'tag' || cfg.group === 'assignee') && g.key !== 'as:none') return null;
            total += g.tasks.length;
            const isCol = collapsed.includes(g.key);
            const rows: ReactNode[] = [];
            if (!isCol) g.tasks.forEach((task) => rowsOf(task, 0, 0, rows));
            return (
              <GroupSection key={g.key} g={g} isCol={isCol} onToggle={() => ((cfg.collapsed = isCol ? collapsed.filter((k) => k !== g.key) : [...collapsed, g.key]), e.bump())}>
                {!isCol && <HeadRow cols={cols} onResize={() => force((x) => x + 1)} />}
                {!isCol && (
                  <ListRows zone={g.key} disabled={!g.patch}>
                    {rows}
                    {g.patch && canAddAny && <InlineAdd g={g} />}
                  </ListRows>
                )}
              </GroupSection>
            );
          })}
          {!total && <EmptyState />}
        </div>
      </div>
    </DndArea>
  );
}
function GroupSection({ g, isCol, onToggle, children }: { g: Group; isCol: boolean; onToggle: () => void; children: ReactNode }) {
  const { e } = useYtg();
  return (
    <section className={'flxg-group' + (isCol ? ' is-collapsed' : '')}>
      <div className="flxg-group-head">
        <button type="button" className="flxg-caret" aria-label={tt('Daralt')} onClick={onToggle}>
          <Ic n={isCol ? 'chevR' : 'chevD'} s={16} />
        </button>
        <span className="flxg-gpill" style={cv(g.color)}>
          {g.user ? <Avatar u={e.S.users[g.user]} size={18} /> : null}
          {g.label}
        </span>
        <span className="flxg-gcount">{g.tasks.filter((x) => !(x as T)._ctx).length}</span>
      </div>
      {children}
    </section>
  );
}
function ListRows({ zone, disabled, children }: { zone: string; disabled: boolean; children: ReactNode }) {
  const d = useDropZone(zone, disabled);
  return (
    <div ref={d.ref} {...d.props} className={'flxg-rows' + (d.over ? ' is-drop-over' : '')}>
      {children}
    </div>
  );
}

function ListRow(o: { task: T; cols: Col[]; depth: number; parent: number; kids: number; open: boolean; ctx: boolean; canSub: boolean; hidden: boolean; toggle: () => void; addSub: () => void }) {
  const c = useYtg();
  const { e } = c;
  const S = e.S;
  const { task, depth } = o;
  const st = e.status(task);
  const sel = !!S.selected[task.id];
  const dr = useDragItem(task.id);
  const subCount = o.kids > 0 ? o.kids : task.subtasks;
  const cls =
    'flxg-row' + (sel ? ' is-selected' : '') + (S.openTask === task.id ? ' is-open' : '') + (task._outside ? ' is-outside' : '') + (depth ? ' is-sub' : '') +
    (task._ctx || o.ctx ? ' is-ctx' : '') + (S.saving[task.id] ? ' is-pending' : '') + (dr.dragging ? ' is-dragging' : '') + (o.hidden ? ' is-drag-hidden' : '');
  return (
    <div
      ref={dr.ref}
      {...dr.props}
      className={cls}
      data-id={task.id}
      data-depth={depth}
      data-parent={o.parent}
      style={{ '--depth': depth } as CSSProperties}
      title={task._ctx || o.ctx ? tt('Filtreye uyan alt görevi olduğu için gösteriliyor') : undefined}
      onClick={() => e.openTask(task.id)}
      onKeyDown={(ev) => ev.key === 'Enter' && e.openTask(task.id)}
    >
      <label className="flxg-check flxg-nodrag" onClick={(ev) => ev.stopPropagation()} onPointerDown={(ev) => ev.stopPropagation()}>
        <input
          type="checkbox"
          checked={sel}
          onChange={(ev) => {
            if (ev.target.checked) S.selected[task.id] = 1;
            else delete S.selected[task.id];
            e.bump();
          }}
        />
      </label>
      <div className="flxg-cell flxg-title-cell">
        <span className="flxg-subindent" />
        {o.kids > 0 ? (
          <button type="button" className={'flxg-subcaret' + (o.open ? ' is-open' : '')} aria-expanded={o.open} title={o.open ? tt('Alt görevleri gizle') : tt('Alt görevleri göster')} onPointerDown={(ev) => ev.stopPropagation()} onClick={(ev) => (ev.stopPropagation(), o.toggle())}>
            <Ic n="chevR" s={14} />
          </button>
        ) : o.kids === 0 || depth > 0 ? (
          <span className="flxg-subcaret is-empty" />
        ) : null}
        <button
          type="button"
          className={'flxg-sdot' + (st.type === 'done' ? ' is-done' : '')}
          style={cv(st.color)}
          title={st.label}
          onPointerDown={(ev) => ev.stopPropagation()}
          onClick={(ev) => {
            ev.stopPropagation();
            if (e.canList(task.list, 'edit')) pickStatus(c, ev.currentTarget, task.list, task.status, (k) => void e.patchTask(task.id, { status: k }).catch(() => {}));
          }}
        >
          {st.type === 'done' ? <Ic n="check" s={11} /> : null}
        </button>
        <span className={'flxg-title' + (st.type === 'done' ? ' is-done' : '')}>{task.title}</span>
        <span className="flxg-badges">
          {subCount ? (
            <span className={'flxg-meta' + (o.kids > 0 ? ' is-btn' : '')} title={tt('Alt görev')} onClick={o.kids > 0 ? (ev) => (ev.stopPropagation(), o.toggle()) : undefined}>
              <Ic n="subtask" s={13} />
              {subCount}
            </span>
          ) : null}
          {task.comments && !o.cols.some((x) => x.key === 'comments') ? <span className="flxg-meta"><Ic n="msg" s={13} />{task.comments}</span> : null}
          {task.files ? <span className="flxg-meta"><Ic n="clip" s={13} />{task.files}</span> : null}
          {task.hasDesc ? <span className="flxg-meta" title={tt('Açıklama var')}><Ic n="list" s={13} /></span> : null}
        </span>
        {task._outside && <span className="flxg-outside" title={tt('Bu görev artık bu görünümün filtresine uymuyor. Sayfa değişince gizlenir.')}>{tt('Filtre dışı')}</span>}
        {o.canSub && (
          <button type="button" className="flxg-row-addsub flxg-nodrag" title={tt('Alt görev ekle')} onPointerDown={(ev) => ev.stopPropagation()} onClick={(ev) => (ev.stopPropagation(), o.addSub())}>
            <Ic n="plus" s={14} />
          </button>
        )}
      </div>
      {o.cols.map((col) => (
        <Cell key={col.key} task={task} col={col} />
      ))}
    </div>
  );
}

function SubAddRow({ parent, depth }: { parent: FlxgTask; depth: number }) {
  const { e, ui } = useYtg();
  const [v, setV] = useState('');
  const close = () => {
    if (e.S.addUnder === parent.id) {
      e.S.addUnder = 0;
      e.bump();
    }
  };
  return (
    <div className="flxg-row flxg-subadd-row" style={{ '--depth': depth } as CSSProperties}>
      <span />
      <div className="flxg-cell flxg-title-cell flxg-subadd-cell">
        <span className="flxg-subindent" />
        <Ic n="subtask" s={14} />
        <input
          className="flxg-input is-sm"
          type="text"
          autoFocus
          placeholder={tt('Alt görev adı yazıp Enter’a basın')}
          value={v}
          onChange={(ev) => setV(ev.target.value)}
          onBlur={() => setTimeout(() => !v.trim() && close(), 150)}
          onKeyDown={(ev) => {
            if (ev.key === 'Escape') return close();
            if (ev.key !== 'Enter') return;
            ev.preventDefault();
            const title = v.trim();
            if (!title) return close();
            setV('');
            e.createTask({ list: parent.list, parent: parent.id, title }).then(() => {
              const p = e.S.tasks[parent.id];
              if (p) p.subtasks = (p.subtasks || 0) + 1;
              e.bump();
            }, ui.fail);
          }}
        />
      </div>
    </div>
  );
}

/** Satır içi görev ekleme. */
function InlineAdd({ g, autoOpen }: { g: Group; autoOpen?: boolean }) {
  const { e, ui } = useYtg();
  const S = e.S;
  const [open, setOpen] = useState(!!autoOpen);
  const [v, setV] = useState('');
  const lists = e.scopeLists().filter((l) => rank(l.role) >= 3);
  const [list, setList] = useState(g.list || (S.scope?.type === 'list' ? S.scope.id : lists[0]?.id ?? 0));
  const inp = useRef<HTMLInputElement>(null);
  if (!open)
    return (
      <div className="flxg-inline-add">
        <button type="button" className="flxg-add-btn" onClick={() => setOpen(true)}>
          <Ic n="plus" s={15} />
          {e.meetingScope() ? tt('Toplantı ekle') : tt('Görev ekle')}
        </button>
      </div>
    );
  const save = () => {
    const title = v.trim();
    if (!title) return setOpen(false);
    const data: Record<string, unknown> = { list, title };
    const fake = { id: 0, list, assignees: [], fields: {}, tags: [], status: '', priority: 0, due: '' } as unknown as FlxgTask;
    const p = g.patch?.(fake, null);
    if (p) Object.assign(data, p);
    if (S.scope?.type === 'home' && !data.assignees) data.assignees = [S.me!.id];
    setV('');
    e.createTask(data).then(() => inp.current?.focus(), ui.fail);
  };
  return (
    <div className="flxg-inline-add">
      <div className="flxg-inline-form">
        <input
          ref={inp}
          className="flxg-input"
          type="text"
          autoFocus
          placeholder={tt('Görev adı yazıp Enter’a basın')}
          value={v}
          onChange={(ev) => setV(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') (ev.preventDefault(), save());
            if (ev.key === 'Escape') setOpen(false);
          }}
          onBlur={(ev) => setTimeout(() => !v.trim() && !(ev.relatedTarget as HTMLElement | null)?.closest('.flxg-inline-form') && setOpen(false), 150)}
        />
        {S.scope?.type !== 'list' && !g.list && lists.length > 1 && (
          <Select className="flxg-input is-sm" value={list} onChange={(ev) => setList(+ev.target.value)}>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        )}
        <button type="button" className="flxg-btn is-primary is-sm" onMouseDown={(ev) => (ev.preventDefault(), save())}>
          {tt('Ekle')}
        </button>
      </div>
    </div>
  );
}

export function EmptyState() {
  const { e } = useYtg();
  const S = e.S;
  const cfg = e.viewCfg();
  const filtered = !!S.q || Object.keys(cfg.filters ?? {}).length > 0 || cfg.showDone === false;
  return (
    <div className="flxg-empty">
      <div className="flxg-empty-ic">
        <Ic n={filtered ? 'filter' : 'checklist'} s={34} />
      </div>
      <p>{filtered ? tt('Filtreye uyan görev yok.') : S.scope?.type === 'home' ? tt('Size atanmış açık görev yok. 🎉') : tt('Bu listede henüz görev yok.')}</p>
      {filtered && (
        <button type="button" className="flxg-btn" onClick={() => ((S.q = ''), (cfg.filters = {}), (cfg.showDone = true), e.touchDraft())}>
          {tt('Filtreleri temizle')}
        </button>
      )}
    </div>
  );
}

/** Toplu işlem çubuğu. */
export function BulkBar() {
  const c = useYtg();
  const { e, ui } = c;
  const S = e.S;
  const ids = Object.keys(S.selected).map(Number).filter((id) => S.tasks[id]);
  if (!ids.length) return null;
  const run = (patch: Record<string, unknown> | null, del?: boolean) =>
    e.api.bulk({ ids, patch: patch ?? undefined, delete: del }).then(() => ((S.selected = {}), e.reloadTasks()), ui.fail);
  const first = S.tasks[ids[0]!]!;
  return (
    <div className="flxg-bulk">
      <span className="flxg-bulk-n">{tt('{n} seçili', { n: ids.length })}</span>
      <button type="button" className="flxg-tb-btn" onClick={(ev) => pickStatus(c, ev.currentTarget, first.list, '', (k) => void run({ status: k }))}>
        <Ic n="check" s={15} />
        <span className="flxg-tb-label">{tt('Durum')}</span>
      </button>
      <button type="button" className="flxg-tb-btn" onClick={(ev) => pickPeople(c, ev.currentTarget, [], (ids2) => void run({ add_assignees: ids2 }), { single: true })}>
        <Ic n="user" s={15} />
        <span className="flxg-tb-label">{tt('Ata')}</span>
      </button>
      <button type="button" className="flxg-tb-btn" onClick={(ev) => pickDate(c, ev.currentTarget, '', (v) => void run({ due: v }))}>
        <Ic n="calendar" s={15} />
        <span className="flxg-tb-label">{tt('Bitiş')}</span>
      </button>
      <button type="button" className="flxg-tb-btn" onClick={(ev) => pickPriority(c, ev.currentTarget, 0, (n) => void run({ priority: n }))}>
        <Ic n="flag" s={15} />
        <span className="flxg-tb-label">{tt('Öncelik')}</span>
      </button>
      <button type="button" className="flxg-tb-btn is-danger" onClick={() => void ui.confirm(tt('Görevleri sil'), tt('{n} görev kalıcı olarak silinecek.', { n: ids.length }), tt('Sil'), true).then((ok) => void (ok && run(null, true)))}>
        <Ic n="trash" s={15} />
        <span className="flxg-tb-label">{tt('Sil')}</span>
      </button>
      <button type="button" className="flxg-icon-btn is-sm" aria-label={tt('Kapat')} onClick={() => ((S.selected = {}), e.bump())}>
        <Ic n="x" s={16} />
      </button>
    </div>
  );
}

/* ---------------- Pano ---------------- */
export function Card({ task }: { task: T }) {
  const { e } = useYtg();
  const S = e.S;
  const cfg = e.viewCfg();
  const vis = cfg.fields ?? [];
  const st = e.status(task);
  const dr = useDragItem(task.id);
  const l = vis.includes('list') ? e.list(task.list) : null;
  const fieldCols = visibleCols(e).filter((col) => col.field);
  return (
    <article
      ref={dr.ref}
      {...dr.props}
      className={'flxg-card' + (st.type === 'done' ? ' is-done' : '') + (S.openTask === task.id ? ' is-open' : '') + (task._outside ? ' is-outside' : '') + (S.saving[task.id] ? ' is-pending' : '') + (dr.dragging ? ' is-dragging' : '')}
      data-id={task.id}
      style={cv(st.color)}
      onClick={() => e.openTask(task.id)}
      onKeyDown={(ev) => ev.key === 'Enter' && e.openTask(task.id)}
    >
      {cfg.cover && task.cover ? (
        <div className="flxg-card-cover">
          <FileImg id={task.cover} size="thumb" />
        </div>
      ) : null}
      <div className="flxg-card-body">
        {vis.includes('tags') && task.tags.length > 0 && <TagChips ids={task.tags} max={4} />}
        {l && <div className="flxg-card-list"><span className="flxg-dot" style={{ background: l.color }} />{l.name}</div>}
        <div className="flxg-card-title">
          {vis.includes('status') && (cfg.group || 'status') !== 'status' ? <StatusPill task={task} small /> : null}
          {task.title}
        </div>
        {fieldCols.some((col) => e.fieldValue(task, col.field!)) && (
          <div className="flxg-card-fields">
            {fieldCols.map((col) => {
              const fv = e.fieldValue(task, col.field!);
              return fv ? (
                <div key={col.key} className="flxg-card-field">
                  <span className="flxg-card-flabel">{col.name}</span>
                  <FieldView field={fv.field} v={fv.v} compact />
                </div>
              ) : null;
            })}
          </div>
        )}
        <div className="flxg-card-foot">
          {vis.includes('due') && <DueChip task={task} />}
          {vis.includes('start') && <DueChip task={task} k="start" />}
          {vis.includes('priority') && <PrioFlag n={task.priority} />}
          {task.subtasks ? <span className="flxg-meta"><Ic n="subtask" s={13} />{task.subtasks}</span> : null}
          {task.comments ? <span className="flxg-meta"><Ic n="msg" s={13} />{task.comments}</span> : null}
          {task.files ? <span className="flxg-meta"><Ic n="clip" s={13} />{task.files}</span> : null}
          <span className="flxg-grow" />
          {vis.includes('assignees') && task.assignees.length > 0 && <Avatars ids={task.assignees} size={22} max={3} />}
        </div>
      </div>
    </article>
  );
}
function BoardCol({ g, canAdd }: { g: Group; canAdd: boolean }) {
  const { e } = useYtg();
  const d = useDropZone(g.key, !g.patch);
  const [top, setTop] = useState(false);
  return (
    <section className={'flxg-col' + (d.over ? ' is-drop-over' : '')} style={cv(g.color)}>
      <div className="flxg-col-head">
        <span className="flxg-gpill" style={cv(g.color)}>
          {g.user ? <Avatar u={e.S.users[g.user]} size={18} /> : null}
          {g.label}
        </span>
        <span className="flxg-gcount">{g.tasks.length}</span>
        <span className="flxg-grow" />
        {canAdd && g.patch && (
          <button type="button" className="flxg-icon-btn is-sm" aria-label={tt('Görev ekle')} onClick={() => setTop(true)}>
            <Ic n="plus" s={15} />
          </button>
        )}
      </div>
      <div ref={d.ref} {...d.props} className="flxg-cards">
        {top && <InlineAdd g={g} autoOpen key="top" />}
        {g.tasks.map((task) => (
          <Card key={task.id} task={task} />
        ))}
        {canAdd && g.patch && !top && <InlineAdd g={g} />}
      </div>
    </section>
  );
}
export function BoardView() {
  const { e, ui } = useYtg();
  const S = e.S;
  const cfg = e.viewCfg();
  const tasks = e.filtered();
  const groups = e.groups(tasks, cfg.group || 'status').filter((g) => g.tasks.length || cfg.group !== 'tag' || g.key === 'tg:none');
  const canAdd = e.scopeLists().some((l) => rank(l.role) >= 3);
  return (
    <DndArea
      onDrop={(info) => {
        const fromKey = groups.find((g) => g.tasks.some((x) => x.id === info.id))?.key ?? null;
        dropToGroup(e, info, groups, fromKey, null, ui);
      }}
      canStart={(id) => e.canList(S.tasks[id]?.list ?? 0, 'edit')}
      overlay={(id) => (S.tasks[id] ? <Card task={S.tasks[id]} /> : null)}
    >
      <div className="flxg-board">
        {groups.map((g) => (
          <BoardCol key={g.key} g={g} canAdd={canAdd} />
        ))}
      </div>
      {!tasks.length && (S.q || Object.keys(cfg.filters ?? {}).length > 0) ? <EmptyState /> : null}
    </DndArea>
  );
}

/* ---------------- Takvim ---------------- */
function CalChip({ x, k }: { x: FlxgTask; k: 'due' | 'start' }) {
  const { e } = useYtg();
  const cfg = e.viewCfg();
  const st = e.status(x);
  const dr = useDragItem(x.id);
  const showCover = cfg.cover && x.cover;
  const time = x[k] && x[k].length > 10 ? x[k].slice(11, 16) : '';
  return (
    <button
      ref={dr.ref}
      {...dr.props}
      type="button"
      className={'flxg-cal-chip' + (st.type === 'done' ? ' is-done' : '') + (showCover ? ' has-cover' : '') + (dr.dragging ? ' is-dragging' : '')}
      data-id={x.id}
      style={cv(st.color)}
      title={x.title}
      onClick={(ev) => (ev.stopPropagation(), e.openTask(x.id))}
    >
      {showCover ? <FileImg id={x.cover} size="thumb" /> : null}
      <span className="flxg-cal-chip-t">
        {time ? <b>{time} </b> : null}
        {x.title}
      </span>
      {(cfg.fields ?? []).includes('assignees') && x.assignees.length > 0 && !showCover ? <Avatars ids={x.assignees} size={16} max={2} /> : null}
    </button>
  );
}
function CalCell({ d, items, cls, label, max, onAdd, k }: { d: string; items: FlxgTask[]; cls: string; label: ReactNode; max: number; onAdd: () => void; k: 'due' | 'start' }) {
  const { ui } = useYtg();
  const z = useDropZone(d);
  const dd = parseDay(d)!;
  return (
    <div ref={z.ref} {...z.props} className={'flxg-cal-cell' + cls + (z.over ? ' is-drop-over' : '')} onClick={(ev) => ((ev.target as HTMLElement) === ev.currentTarget || (ev.target as HTMLElement).classList.contains('flxg-cal-day')) && onAdd()}>
      <span className="flxg-cal-day">{label}</span>
      <div className="flxg-cal-items">
        {items.slice(0, max).map((x) => (
          <CalChip key={x.id} x={x} k={k} />
        ))}
        {items.length > max && (
          <button
            type="button"
            className="flxg-cal-more"
            onClick={(ev) => {
              ev.stopPropagation();
              ui.openPop(
                ev.currentTarget,
                <div className="flxg-pick">
                  <div className="flxg-menu-head">{dd.toLocaleDateString(flxgLocale(), { dateStyle: 'full' })}</div>
                  <div className="flxg-cal-poplist">
                    {items.map((x) => (
                      <CalChip key={x.id} x={x} k={k} />
                    ))}
                  </div>
                </div>,
              );
            }}
          >
            {tt('+{n} daha', { n: items.length - max })}
          </button>
        )}
      </div>
    </div>
  );
}
export function CalendarView({ onQuick }: { onQuick: (extra: Record<string, string>) => void }) {
  const { e, ui } = useYtg();
  const S = e.S;
  const cfg = e.viewCfg();
  const key: 'due' | 'start' = cfg.dateField === 'start' ? 'start' : 'due';
  const mode = S.cal.mode ?? (typeof window !== 'undefined' && window.innerWidth < 720 ? 'agenda' : 'month');
  const tasks = e.filtered({ includeSub: true });
  const byDay: Record<string, FlxgTask[]> = {};
  const undated: FlxgTask[] = [];
  for (const x of tasks) {
    const d = x[key] ? x[key].slice(0, 10) : '';
    if (!d) undated.push(x);
    else (byDay[d] ??= []).push(x);
  }
  for (const d of Object.keys(byDay)) byDay[d]!.sort((a, b) => (a[key] || '').localeCompare(b[key] || '') || (a.priority || 9) - (b.priority || 9));
  const ws = S.config.weekStart ?? 1;
  const td = today();
  const loc = flxgLocale();
  const startOfWeek = (k: string) => {
    const d = parseDay(k)!;
    d.setDate(d.getDate() - ((d.getDay() - ws + 7) % 7));
    return dayKey(d);
  };
  const weekTitle = () => {
    const s = S.cal.week ?? startOfWeek(td);
    return parseDay(s)!.toLocaleDateString(loc, { day: 'numeric', month: 'short' }) + ' – ' + parseDay(addDays(s, 6))!.toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const shift = (n: number) => {
    if (mode === 'week') {
      S.cal.week = addDays(S.cal.week ?? startOfWeek(td), 7 * n);
      const d = parseDay(S.cal.week)!;
      S.cal.y = d.getFullYear();
      S.cal.m = d.getMonth();
    } else {
      const m = S.cal.m + n;
      S.cal.y += Math.floor(m / 12);
      S.cal.m = ((m % 12) + 12) % 12;
    }
    e.bump();
  };
  const quickAdd = (day: string) => {
    if (!e.scopeLists().some((l) => rank(l.role) >= 3)) return;
    onQuick({ [key]: day });
  };
  const head = (
    <div className="flxg-cal-head">
      <div className="flxg-cal-nav">
        <button type="button" className="flxg-icon-btn" aria-label={tt('Önceki')} onClick={() => shift(-1)}>
          <Ic n="chevL" s={18} />
        </button>
        <button type="button" className="flxg-btn is-sm" onClick={() => { const n = new Date(); S.cal.y = n.getFullYear(); S.cal.m = n.getMonth(); S.cal.week = null; e.bump(); }}>
          {tt('Bugün')}
        </button>
        <button type="button" className="flxg-icon-btn" aria-label={tt('Sonraki')} onClick={() => shift(1)}>
          <Ic n="chevR" s={18} />
        </button>
        <h3 className="flxg-cal-title">{mode === 'week' ? weekTitle() : new Date(S.cal.y, S.cal.m, 1).toLocaleDateString(loc, { month: 'long', year: 'numeric' })}</h3>
      </div>
      <div className="flxg-seg">
        {(
          [
            ['month', tt('Ay')],
            ['week', tt('Hafta')],
            ['agenda', tt('Ajanda')],
          ] as const
        ).map((o) => (
          <button key={o[0]} type="button" className={mode === o[0] ? 'is-on' : ''} onClick={() => { S.cal.mode = o[0]; if (o[0] === 'week' && !S.cal.week) S.cal.week = startOfWeek(td); e.bump(); }}>
            {o[1]}
          </button>
        ))}
      </div>
      {undated.length > 0 && (
        <button
          type="button"
          className="flxg-btn is-sm is-ghost"
          onClick={(ev) =>
            ui.menu(ev.currentTarget, [{ head: tt('Tarihsiz görevler') }, ...undated.slice(0, 100).map((x): MenuItem => ({ label: x.title, swatch: e.status(x).color, onClick: () => e.openTask(x.id) }))], { alignRight: true })
          }
        >
          {tt('Tarihsiz: {n}', { n: undated.length })}
        </button>
      )}
    </div>
  );
  if (mode === 'agenda') {
    const start = S.cal.y + '-' + String(S.cal.m + 1).padStart(2, '0') + '-01';
    const end = dayKey(new Date(S.cal.y, S.cal.m + 1, 0));
    const days = Object.keys(byDay).filter((d) => d >= start && d <= end).sort();
    return (
      <>
        {head}
        <div className="flxg-agenda">
          {!days.length && <div className="flxg-empty-sm">{tt('Bu ay tarihli görev yok.')}</div>}
          {days.map((d) => {
            const dd = parseDay(d)!;
            return (
              <div key={d} className={'flxg-agenda-day' + (d === td ? ' is-today' : '') + (d < td ? ' is-past' : '')}>
                <div className="flxg-agenda-date">
                  <b>{dd.getDate()}</b>
                  <span>{dd.toLocaleDateString(loc, { weekday: 'short' })}</span>
                </div>
                <div className="flxg-agenda-items">
                  {byDay[d]!.map((x) => (
                    <button key={x.id} type="button" className="flxg-cal-chip" style={cv(e.status(x).color)} onClick={() => e.openTask(x.id)}>
                      <span className="flxg-cal-chip-t">{x.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  }
  let first: string;
  let count: number;
  if (mode === 'week') {
    first = S.cal.week ?? startOfWeek(td);
    count = 7;
  } else {
    first = startOfWeek(S.cal.y + '-' + String(S.cal.m + 1).padStart(2, '0') + '-01');
    const lastKey = dayKey(new Date(S.cal.y, S.cal.m + 1, 0));
    count = 0;
    while (addDays(first, count) <= lastKey || count % 7) count++;
  }
  const wd = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + ((ws + i) % 7)).toLocaleDateString(loc, { weekday: 'short' }));
  return (
    <>
      {head}
      <DndArea
        onDrop={(info) => {
          const task = S.tasks[info.id];
          if (!task) return;
          const old = task[key] || '';
          if (old.slice(0, 10) === info.zone) return;
          void e.patchTask(task.id, { [key]: info.zone + (old.length > 10 ? old.slice(10) : '') }).catch(() => {});
        }}
        canStart={(id) => e.canList(S.tasks[id]?.list ?? 0, 'edit')}
        overlay={(id) => <span className="flxg-cal-chip" style={cv(S.tasks[id] ? e.status(S.tasks[id]).color : '#999')}><span className="flxg-cal-chip-t">{S.tasks[id]?.title}</span></span>}
      >
        <div className={'flxg-cal' + (mode === 'week' ? ' is-week' : '')}>
          <div className="flxg-cal-wd">
            {wd.map((n) => (
              <span key={n}>{n}</span>
            ))}
          </div>
          <div className="flxg-cal-grid" style={{ '--rows': Math.ceil(count / 7) } as CSSProperties}>
            {Array.from({ length: count }, (_, i) => {
              const d = addDays(first, i);
              const dd = parseDay(d)!;
              const other = mode === 'month' && dd.getMonth() !== S.cal.m;
              const cls = (d === td ? ' is-today' : '') + (other ? ' is-other' : '') + (dd.getDay() === 0 || dd.getDay() === 6 ? ' is-weekend' : '');
              const label = dd.getDate() === 1 && mode === 'month' ? dd.toLocaleDateString(loc, { day: 'numeric', month: 'short' }) : dd.getDate();
              return <CalCell key={d} d={d} items={byDay[d] ?? []} cls={cls} label={label} max={mode === 'week' ? 50 : cfg.cover ? 2 : 4} onAdd={() => quickAdd(d)} k={key} />;
            })}
          </div>
        </div>
      </DndArea>
    </>
  );
}

/* ---------------- Hızlı görev oluşturma ---------------- */
export function quickCreate(c: Ctx, extra: Record<string, string> = {}) {
  const { e, ui } = c;
  const S = e.S;
  let lists = e.scopeLists().filter((l) => rank(l.role) >= 3);
  if (!lists.length) lists = S.lists.filter((l) => rank(l.role) >= 3);
  if (!lists.length) return ui.toast(tt('Görev ekleyebileceğiniz liste yok.'), { error: true });
  const data = {
    list: S.scope?.type === 'list' ? S.scope.id : lists[0]!.id,
    assignees: S.scope?.type === 'home' ? [S.me!.id] : ([] as number[]),
    priority: 0,
    due: extra.due ?? '',
    start: extra.start ?? '',
    title: '',
    description: '',
  };
  const go = async (open: boolean) => {
    if (!data.title.trim()) return false;
    const body: Record<string, unknown> = { ...data, title: data.title.trim() };
    if (data.description.trim()) body.description = '<p>' + data.description.trim().replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]!).replace(/\n/g, '<br>') + '</p>';
    else delete body.description;
    const task = await e.createTask(body);
    if (open) e.openTask(task.id);
    else ui.toast(tt('Görev oluşturuldu'), { action: { label: tt('Aç'), fn: () => e.openTask(task.id) } });
    return true;
  };
  let close = () => {};
  close = ui.modal({
    title: e.isMeetingList(data.list) ? tt('Yeni toplantı') : tt('Yeni görev'),
    body: <QuickForm c={c} data={data} lists={lists} onEnter={() => void go(false).then((ok) => ok && close())} />,
    actions: [
      { label: tt('Oluştur ve aç'), onClick: () => go(true) },
      { label: tt('Oluştur'), primary: true, onClick: () => go(false) },
    ],
  });
}
function QuickForm({ c, data, lists, onEnter }: { c: Ctx; data: { list: number; assignees: number[]; priority: number; due: string; title: string; description: string }; lists: { id: number }[]; onEnter: () => void }) {
  const { e } = c;
  const [, force] = useState(0);
  const re = () => force((x) => x + 1);
  const l = e.list(data.list)!;
  const mt = l.kind === 'meeting';
  return (
    <div className="flxg-qc">
      <input className="flxg-input is-lg" type="text" autoFocus placeholder={mt ? tt('Toplantı adı') : tt('Görev adı')} onChange={(ev) => (data.title = ev.target.value)} onKeyDown={(ev) => ev.key === 'Enter' && (ev.preventDefault(), onEnter())} />
      <textarea className="flxg-input" rows={3} placeholder={tt('Açıklama (isteğe bağlı)')} onChange={(ev) => (data.description = ev.target.value)} />
      <div className="flxg-qc-row">
        {lists.length > 1 && (
          <button type="button" className="flxg-chip-btn" onClick={(ev) => pickList(c, ev.currentTarget, (id) => ((data.list = id), re()), { current: data.list })}>
            <span className="flxg-dot" style={{ background: l.color }} />
            {l.name}
          </button>
        )}
        <button type="button" className="flxg-chip-btn" onClick={(ev) => pickPeople(c, ev.currentTarget, data.assignees, (ids) => ((data.assignees = ids), re()))}>
          {data.assignees.length ? <Avatars ids={data.assignees} size={18} /> : <Ic n="user" s={14} />}
          {data.assignees.length ? null : mt ? tt('Katılımcılar') : tt('Ata')}
        </button>
        <button type="button" className="flxg-chip-btn" onClick={(ev) => pickDate(c, ev.currentTarget, data.due, (v) => ((data.due = v), re()))}>
          <Ic n="calendar" s={14} />
          {data.due ? fmtDue(data.due) : mt ? tt('Tarih') : tt('Bitiş')}
        </button>
        {!mt && (
          <button type="button" className="flxg-chip-btn" onClick={(ev) => pickPriority(c, ev.currentTarget, data.priority, (n) => ((data.priority = n), re()))}>
            {data.priority ? <PrioFlag n={data.priority} /> : <Ic n="flag" s={14} />}
            {data.priority ? e.priority(data.priority)?.label : tt('Öncelik')}
          </button>
        )}
      </div>
    </div>
  );
}
