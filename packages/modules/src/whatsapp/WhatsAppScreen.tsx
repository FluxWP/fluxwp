// Flux Chat WhatsApp ekranı (tam REST). Uygulamada ve WP admin'de aynı kod.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from 'zustand';
import {
  ArrowDown, Bot, Check, CheckCheck, Info, Lock, LockOpen, MessageCircle, MessageSquarePlus, Mic, Pin, Search, StickyNote, UserCheck, WifiOff,
} from 'lucide-react';
import type { FlxcChat, FlxcFilter, FlxcMessage } from '@fluxwp/core';
import { Avatar, Empty, Loading, ResizablePane } from '@fluxwp/ui';
import { useHost } from '../host';
import { WaEngine, type WaState } from './engine';
import { Bubble, type BubbleActions } from './Bubble';
import { Composer } from './Composer';
import { dayLabel, listTime, sameDay } from './format';
import { InfoPanel } from './InfoPanel';
import { NewChat } from './extras';
import { notifyIncoming } from './notify';
import { Select } from '@fluxwp/ui';

const FILTERS: FlxcFilter[] = ['all', 'unread', 'mine', 'unassigned', 'closed'];

export function WhatsAppScreen() {
  const host = useHost();
  const engine = useMemo(
    () => {
      const e: WaEngine = new WaEngine({
        client: host.client,
        onNonce: host.setNonce,
        onUnreadChange: () => host.refreshCounts?.(),
        onIncoming: (items) => notifyIncoming(items, e.s.active, host.notify, (id) => e.open(id)),
      });
      return e;
    },
    [host.client], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => {
    void engine.start();
    return () => engine.stop();
  }, [engine]);
  return <WhatsApp engine={engine} />;
}

function useWa<T>(engine: WaEngine, sel: (s: WaState) => T): T {
  return useStore(engine.store, sel);
}

function WhatsApp({ engine }: { engine: WaEngine }) {
  const { t } = useTranslation();
  const active = useWa(engine, (s) => s.active);
  const bootError = useWa(engine, (s) => s.bootError);
  const offline = useWa(engine, (s) => s.offline);
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(h);
  }, [toast]);

  if (bootError) return <Empty icon={<WifiOff size={30} />} title={t('wa.bootError')} />;
  return (
    <div className={'wa split' + (active ? ' has-chat' : '')}>
      <ChatList engine={engine} offline={offline} />
      <section className="split-detail flush">
        {active ? <Conversation key={active} engine={engine} id={active} toast={setToast} /> : <Empty icon={<MessageCircle size={32} />} title={t('inbox.pick')} />}
      </section>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ---------- liste ---------- */

function ChatList({ engine, offline }: { engine: WaEngine; offline: WaState['offline'] }) {
  const { t } = useTranslation();
  const order = useWa(engine, (s) => s.order);
  const chats = useWa(engine, (s) => s.chats);
  const filter = useWa(engine, (s) => s.filter);
  const label = useWa(engine, (s) => s.label);
  const loading = useWa(engine, (s) => s.listLoading);
  const more = useWa(engine, (s) => s.listMore);
  const boot = useWa(engine, (s) => s.boot);
  const conns = useWa(engine, (s) => s.conns);
  const host = useHost();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const h = setTimeout(() => q.trim() !== engine.s.q && engine.setView({ q: q.trim() }), 280);
    return () => clearTimeout(h);
  }, [q, engine]);

  const down = conns.filter((c) => c.state && c.state !== 'open');

  return (
    <ResizablePane className="split-list wa-list" storageKey={`flux.pane.${host.scope}.wa-list`} initialWidth={340} minWidth={260} maxWidth={560} minContentWidth={360} label={t('pane.list')}>
      <header className="split-head column">
        <div className="row wa-list-title">
          <h1 className="grow">{t('inbox.title')}</h1>
          <button type="button" className="icon-btn" onClick={() => setAdding(true)} title={t('wa.new.title')}><MessageSquarePlus size={19} /></button>
        </div>
        {adding && <NewChat engine={engine} onClose={() => setAdding(false)} onOpen={(id) => (setAdding(false), engine.open(id))} />}
        <label className="search-inline full">
          <Search size={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('wa.search')} />
        </label>
        <div className="tabs scroll">
          {FILTERS.map((f) => (
            <button key={f} className={filter === f ? 'on' : ''} onClick={() => engine.setView({ filter: f })}>{t(`wa.filters.${f}`)}</button>
          ))}
        </div>
        {!!boot?.labels.length && (
          <div className="wa-chips">
            {boot.labels.map((l) => (
              <button key={l.id} className={label === l.id ? 'on' : ''} onClick={() => engine.setView({ label: label === l.id ? '' : l.id })}>
                <i style={{ background: l.color }} /> {l.name}
              </button>
            ))}
          </div>
        )}
      </header>
      {offline && <div className="wa-banner warn"><WifiOff size={14} /> {t(offline === 'auth' ? 'wa.sessionExpired' : 'wa.offline')}</div>}
      {down.map((c) => (
        <div key={c.id} className="wa-banner danger"><WifiOff size={14} /> {t('wa.connDown', { name: c.label })}</div>
      ))}
      <div
        className="rows"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (more && !loading && el.scrollTop + el.clientHeight > el.scrollHeight - 200) void engine.loadChats(true);
        }}
      >
        {order.map((id) => chats[id] && <ChatRow key={id} engine={engine} c={chats[id]} />)}
        {loading && <Loading />}
        {!loading && order.length === 0 && <Empty icon={<MessageCircle size={28} />} title={t('inbox.empty')} />}
      </div>
    </ResizablePane>
  );
}

/** Önizlemede WhatsApp biçim işaretleri görünmesin. */
const plain = (s: string) => s.replace(/(^|[^\p{L}\p{N}])([*_~])([^*_~\n]+)\2(?![\p{L}\p{N}])/gu, '$1$3').replace(/```/g, '');

function Preview({ c }: { c: FlxcChat }) {
  const { t } = useTranslation();
  if (c.typing) return <span className="wa-typing">{t(c.typing === 2 ? 'wa.recording' : 'wa.typing')}</span>;
  if (c.botBusy) return <span className="wa-typing"><Bot size={12} /> {t('wa.botTyping')}</span>;
  const l = c.last;
  if (!l) return <span className="muted">{c.phoneFmt}</span>;
  return (
    <>
      {l.dir === 'out' && (l.status === 'read' || l.status === 'played' ? <CheckCheck size={13} className="read" /> : l.status === 'delivered' ? <CheckCheck size={13} /> : <Check size={13} />)}
      {l.dir === 'note' && <StickyNote size={12} />}
      {l.type === 'audio' && <Mic size={12} />}
      {l.dir === 'out' && l.user && <span className="muted">{l.user}: </span>}
      {l.body ? plain(l.body) : t(`wa.types.${l.type}`)}
    </>
  );
}

function ChatRow({ engine, c }: { engine: WaEngine; c: FlxcChat }) {
  const { t, i18n } = useTranslation();
  const sel = useWa(engine, (s) => s.active === c.id);
  const fresh = useWa(engine, (s) => (s.fresh[c.id] ?? 0) > Date.now() - 4000);
  const labels = useWa(engine, (s) => s.boot?.labels ?? []);
  const me = useWa(engine, (s) => s.boot?.me.id ?? 0);
  return (
    <button className={'row-item wa-row-item' + (sel ? ' sel' : '') + (fresh ? ' fresh' : '')} onClick={() => engine.open(c.id)}>
      <Avatar src={c.avatar} name={c.title} size={42} />
      <span className="grow">
        <span className="row-line">
          <strong className={'ellipsis' + (c.unread ? '' : ' normal')}>{c.title}</strong>
          <span className={'small ' + (c.unread ? 'accent' : 'muted')}>{listTime(c.lastTs, t, i18n.language)}</span>
        </span>
        <span className="row-line">
          <span className={'ellipsis small wa-preview' + (c.unread ? '' : ' muted')}><Preview c={c} /></span>
          <span className="wa-row-badges">
            {c.labels.map((id) => {
              const l = labels.find((x) => x.id === id);
              return l ? <i key={id} className="wa-dot" style={{ background: l.color }} title={l.name} /> : null;
            })}
            {c.bot === 'on' && <Bot size={13} className="muted" />}
            {c.assigned === me && me > 0 && <UserCheck size={13} className="muted" />}
            {c.pinned > 0 && <Pin size={13} className="muted" />}
            {c.unread > 0 && <span className="badge">{c.unread}</span>}
          </span>
        </span>
      </span>
    </button>
  );
}

/* ---------- sohbet ---------- */

function Conversation({ engine, id, toast }: { engine: WaEngine; id: number; toast: (s: string) => void }) {
  const { t, i18n } = useTranslation();
  const host = useHost();
  const c = useWa(engine, (s) => s.chats[id]);
  const box = useWa(engine, (s) => s.msgs[id]);
  const boot = useWa(engine, (s) => s.boot);
  const [quote, setQuote] = useState<FlxcMessage | null>(null);
  const [info, setInfo] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1280 && localStorage.getItem('flux.wa.info') === '1');
  const [inject, setInject] = useState<{ text: string; n: number } | null>(null);
  useEffect(() => {
    try {
      localStorage.setItem('flux.wa.info', info ? '1' : '0');
    } catch {
      /* yok */
    }
  }, [info]);
  const [flash, setFlash] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const inner = useRef<HTMLDivElement>(null);
  const prevHeight = useRef(0);
  const prevLast = useRef(0);
  const list = box?.list ?? [];
  const lastId = list.length ? list[list.length - 1]!.id : 0;

  // İlk yüklemede ve altta iken yeni mesajda en alta; yukarı yüklemede konum korunur.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prevHeight.current && el.scrollTop < 40 && lastId === prevLast.current) {
      el.scrollTop = el.scrollHeight - prevHeight.current;
    } else if (atBottom || prevLast.current === 0 || (list.length && list[list.length - 1]!.local)) {
      el.scrollTop = el.scrollHeight;
    } else if (lastId !== prevLast.current) {
      setNewCount((n) => n + 1);
    }
    prevHeight.current = el.scrollHeight;
    prevLast.current = lastId;
  }, [list.length, lastId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Görsel/önizleme sonradan yüklenip yükseklik artınca altta kal.
  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (stick.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(inner.current!);
    return () => ro.disconnect();
  }, []);

  const onScroll = () => {
    const el = scroller.current!;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stick.current = bottom;
    setAtBottom(bottom);
    if (bottom) {
      setNewCount(0);
      engine.markRead();
    }
    if (el.scrollTop < 120 && box?.more && !box.loading) {
      prevHeight.current = el.scrollHeight;
      void engine.loadOlder(id);
    }
  };

  const jump = useCallback(
    (mid: number) => {
      const el = document.getElementById(`wa-m-${mid}`);
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setFlash(mid);
        setTimeout(() => setFlash(0), 1600);
      } else toast(t('wa.quoteNotLoaded'));
    },
    [toast, t],
  );

  const actions: BubbleActions = useMemo(
    () => ({
      quote: (m) => setQuote(m),
      jump,
      react: (m, e) => void engine.react(m, e).catch((x: Error) => toast(x.message)),
      retry: (m) => void engine.retry(m).catch((x: Error) => toast(x.message)),
      deleteNote: (m) => void engine.deleteNote(m).catch((x: Error) => toast(x.message)),
      openChatWith: (phone) =>
        void engine.api.newChat({ phone, conn: c?.conn }).then((r) => (engine.upsert(r.chat), engine.open(r.chat.id)), (x: Error) => toast(x.message)),
      linkPreview: (url) => engine.api.linkPreview(url).then((r) => (r.ok === false ? null : r), () => null),
    }),
    [engine, jump, toast, c?.conn],
  );

  if (!c) return <Loading />;
  const assignedName = boot?.agents.find((a) => a.id === c.assigned)?.name;
  const sub = c.typing ? t(c.typing === 2 ? 'wa.recording' : 'wa.typing') : [c.phoneFmt, assignedName && t('inbox.assigned', { name: assignedName }), c.status === 'closed' && t('wa.closed')].filter(Boolean).join(' · ');
  const conn = engine.s.conns.length > 1 ? engine.s.conns.find((x) => x.id === c.conn) : undefined;
  const blocked = c.optout === 1;

  return (
    <div className="convo wa-convo">
      <header className="convo-head">
        <button type="button" className="icon-btn wa-back" onClick={() => engine.open(null)} aria-label={t('common.back')}>‹</button>
        <button type="button" className="wa-head-who" onClick={() => setInfo((x) => !x)}>
        <Avatar src={c.avatar} name={c.title} size={38} />
        <div className="grow wa-head-text">
          <strong>{c.title}</strong>
          <div className={'small ' + (c.typing ? 'accent' : 'muted')}>
            {sub}
            {conn && <span className="wa-conn" style={{ color: conn.color }}> · {conn.label}</span>}
          </div>
        </div>
        </button>
        {c.bot && (
          <button
            type="button"
            className={'toggle' + (c.bot === 'on' ? ' on' : c.bot === 'paused' ? ' warn' : '')}
            onClick={() => void engine.setBot(c.id, c.bot !== 'on').catch((x: Error) => toast(x.message))}
            title={t('inbox.botHint')}
          >
            <Bot size={14} /> <span className="lbl">{t(`wa.bot.${c.bot}`)}</span>
          </button>
        )}
        <Select
          className="wa-assign"
          value={c.assigned}
          onChange={(e) => void engine.update(c.id, { assigned: Number(e.target.value) }).catch((x: Error) => toast(x.message))}
          title={t('wa.assign')}
        >
          <option value={0}>{t('wa.unassigned')}</option>
          {boot?.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <button
          type="button"
          className="icon-btn"
          onClick={() => void engine.update(c.id, { pinned: !c.pinned }).catch((x: Error) => toast(x.message))}
          title={t(c.pinned ? 'wa.unpin' : 'wa.pin')}
        >
          <Pin size={17} className={c.pinned ? 'accent' : ''} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => void engine.update(c.id, { status: c.status === 'closed' ? 'open' : 'closed' }).catch((x: Error) => toast(x.message))}
          title={t(c.status === 'closed' ? 'wa.reopen' : 'wa.close')}
        >
          {c.status === 'closed' ? <LockOpen size={17} /> : <Lock size={17} />}
        </button>
        <button type="button" className={'icon-btn' + (info ? ' active' : '')} onClick={() => setInfo((x) => !x)} title={t('wa.info.title')}>
          <Info size={17} />
        </button>
      </header>
      <div className="wa-body">
      <div className="wa-main">
      <div className="messages wa-messages" ref={scroller} onScroll={onScroll}>
        <div className="wa-inner" ref={inner}>
        {box?.loading && <Loading />}
        {box?.note && <p className="wa-system"><span>{box.note}</span></p>}
        {list.map((m, i) => {
          const prev = list[i - 1];
          const newDay = !prev || !sameDay(prev.ts, m.ts);
          const first = newDay || !prev || prev.dir !== m.dir || prev.userId !== m.userId || prev.source !== m.source || m.ts - prev.ts > 5 * 60_000 || prev.sender !== m.sender;
          return (
            <div key={m.id} className="wa-item">
              {newDay && <div className="wa-day"><span>{dayLabel(m.ts, t, i18n.language)}</span></div>}
              <Bubble m={m} a={actions} first={first} group={c.group} highlight={flash === m.id} />
            </div>
          );
        })}
        </div>
      </div>
      {!atBottom && (
        <button type="button" className="wa-down" onClick={() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })}>
          <ArrowDown size={18} />
          {newCount > 0 && <span className="badge">{newCount}</span>}
        </button>
      )}
      {blocked ? (
        <p className="notice pad">{t('inbox.blocked')}</p>
      ) : (
        <Composer
          engine={engine}
          chatId={c.id}
          scope={host.scope}
          quote={quote}
          clearQuote={() => setQuote(null)}
          replies={boot?.replies ?? []}
          ai={!!boot?.ai}
          onSent={() => ((stick.current = true), setAtBottom(true))}
          onError={toast}
          inject={inject}
        />
      )}
      </div>
      {info && <InfoPanel engine={engine} id={c.id} onClose={() => setInfo(false)} onInsert={(s) => setInject((x) => ({ text: s, n: (x?.n ?? 0) + 1 }))} toast={toast} />}
      </div>
    </div>
  );
}
