// Kişi paneli: ad, telefon, etiketler, atanan, notlar (otomatik kayıt), eklenti bölümleri (sertifikalar vb.).
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from 'zustand';
import { Copy, ExternalLink, Pin, X } from 'lucide-react';
import type { FlxcSection } from '@fluxwp/core';
import { Avatar, ResizablePane } from '@fluxwp/ui';
import type { WaEngine } from './engine';
import { useHost } from '../host';
import { Select } from '@fluxwp/ui';

export function InfoPanel({ engine, id, onClose, onInsert, toast }: { engine: WaEngine; id: number; onClose: () => void; onInsert: (s: string) => void; toast: (s: string) => void }) {
  const { t, i18n } = useTranslation();
  const host = useHost();
  const c = useStore(engine.store, (s) => s.chats[id]);
  const boot = useStore(engine.store, (s) => s.boot);
  const [sections, setSections] = useState<FlxcSection[]>([]);
  const [name, setName] = useState(c?.name ?? '');
  const [notes, setNotes] = useState(c?.notes ?? '');
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let live = true;
    void engine.api.chat(id).then((r) => live && (setSections(r.sections), setName(r.chat.name), setNotes(r.chat.notes)), () => undefined);
    return () => {
      live = false;
    };
  }, [engine, id]);

  if (!c) return null;
  const save = (patch: Parameters<WaEngine['update']>[1]) => void engine.update(id, patch).catch((e: Error) => toast(e.message));

  return (
    <ResizablePane className="wa-info" storageKey={`flux.pane.${host.scope}.wa-contact`} initialWidth={320} minWidth={240} maxWidth={520} minContentWidth={320} edge="left" label={t('pane.details')}>
      <header>
        <strong>{t('wa.info.title')}</strong>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}><X size={17} /></button>
      </header>
      <div className="wa-info-body">
        <div className="wa-info-hero">
          <Avatar src={c.avatar} name={c.title} size={84} />
          <input
            className="wa-info-name"
            value={name}
            placeholder={c.pushName || c.phoneFmt}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name !== c.name && save({ name })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />
          {c.pushName && c.pushName !== name && <span className="muted small">~{c.pushName}</span>}
          <button type="button" className="btn-link" onClick={() => void navigator.clipboard?.writeText(c.phoneFmt).then(() => toast(t('wa.info.copied')))}>
            {c.phoneFmt} <Copy size={13} />
          </button>
        </div>

        <section>
          <h3>{t('wa.info.labels')}</h3>
          <div className="wa-chips">
            {boot?.labels.map((l) => {
              const on = c.labels.includes(l.id);
              return (
                <button key={l.id} type="button" className={on ? 'on' : ''} onClick={() => save({ labels: on ? c.labels.filter((x) => x !== l.id) : [...c.labels, l.id] })}>
                  <i style={{ background: l.color }} /> {l.name}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h3>{t('wa.assign')}</h3>
          <Select className="wa-select" value={c.assigned} onChange={(e) => save({ assigned: Number(e.target.value) })}>
            <option value={0}>{t('wa.unassigned')}</option>
            {boot?.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </section>

        <section>
          <h3>{t('wa.info.notes')} {saved && <span className="muted xsmall">· {t('wa.info.saved')}</span>}</h3>
          <textarea
            className="wa-notes"
            rows={4}
            value={notes}
            placeholder={t('wa.info.notesHint')}
            onChange={(e) => {
              const v = e.target.value;
              setNotes(v);
              setSaved(false);
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(() => void engine.update(id, { notes: v }).then(() => setSaved(true), (x: Error) => toast(x.message)), 900);
            }}
          />
        </section>

        {sections.map((s) => (
          <section key={s.id}>
            <h3>{s.title}</h3>
            <ul className="wa-sec">
              {s.items.map((it, i) => (
                <li key={i}>
                  <span className="grow">
                    <span className="ellipsis">{it.label}</span>
                    {it.sub && <span className="muted xsmall">{it.sub}</span>}
                  </span>
                  {it.insert && <button type="button" className="btn-ghost small" onClick={() => onInsert(it.insert!)}>{t('wa.info.insert')}</button>}
                  {it.url && <a className="icon-btn" href={it.url} target="_blank" rel="noreferrer noopener"><ExternalLink size={15} /></a>}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="wa-info-actions">
          <button type="button" className="btn-ghost small" onClick={() => save({ pinned: !c.pinned })}><Pin size={14} /> {t(c.pinned ? 'wa.unpin' : 'wa.pin')}</button>
          <button type="button" className="btn-ghost small" onClick={() => save({ status: c.status === 'closed' ? 'open' : 'closed' })}>{t(c.status === 'closed' ? 'wa.reopen' : 'wa.close')}</button>
        </section>
        <p className="muted xsmall">{t('wa.info.firstSeen', { date: new Date(c.created).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }) })}</p>
      </div>
    </ResizablePane>
  );
}
