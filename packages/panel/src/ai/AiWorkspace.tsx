import { createContext, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { Bot, Maximize2, PanelRight, Plus, Send, Square, X } from 'lucide-react';
import { AiSession, messageText, useAccount, useApi, useManifest, type AiDecision } from '@fluxwp/runtime';
import { ResizablePane } from '@fluxwp/ui';
import { useRoute } from '../state/route';
import './ai.css';
import { useSidebar } from '../state/sidebar';
import { Select } from '@fluxwp/ui';

type Mode = 'bubble' | 'dock';
interface Workspace { engine: AiSession; open: boolean; mode: Mode; setOpen: (open: boolean) => void; setMode: (mode: Mode) => void; text: string; setText: Dispatch<SetStateAction<string>> }
const Context = createContext<Workspace | null>(null);
const useWorkspace = () => {
  const workspace = useContext(Context);
  if (!workspace) throw new Error('AI workspace missing');
  return workspace;
};

export function AiProvider({ children }: { children: ReactNode }) {
  const account = useAccount();
  const api = useApi();
  const enabled = !!useManifest().data?.modules.ai;
  const engine = useMemo(() => new AiSession(api, () => {
    const route = useRoute.getState().route;
    return { url: account.siteUrl, title: account.siteName, app: 'FluxWP', route };
  }), [api, account.id]);
  const key = `flux.ai.${account.id}`;
  const readMode = (): Mode => { try { return localStorage.getItem(key) === 'dock' ? 'dock' : 'bubble'; } catch { return 'bubble'; } };
  const [mode, changeMode] = useState<Mode>(readMode);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const setMode = (value: Mode) => { changeMode(value); try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } };
  useEffect(() => {
    if (enabled) void engine.initialize();
    return () => engine.dispose();
  }, [engine, enabled]);
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (enabled && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); setOpen((v) => !v); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [enabled]);
  return <Context.Provider value={{ engine, open, mode, setOpen, setMode, text, setText }}>{children}</Context.Provider>;
}

/** One mounted session survives navigation and switching between the floating and docked views. */
export function AiDock() {
  const { engine, open, mode, setOpen, setMode } = useWorkspace();
  const { t } = useTranslation();
  const denied = useStore(engine.store, (s) => s.denied);
  const enabled = !!useManifest().data?.modules.ai;
  const account = useAccount();
  const route = useRoute((s) => s.route);
  const sidebarWidth = useSidebar((s) => s.width);
  const sidebarCollapsed = useSidebar((s) => s.collapsed);
  if (!enabled || denied || route.kind === 'native' && route.component === 'flxai-chat') return null;
  if (!open) return <button type="button" className="ai-launcher" aria-label={t('ai.title')} title={t('ai.shortcut')} onClick={() => setOpen(true)}><Bot size={24} /></button>;
  return (
    <ResizablePane storageKey={`flux.ai.width.${account.id}`} initialWidth={420} minWidth={320} maxWidth={780} minContentWidth={(sidebarCollapsed ? 0 : sidebarWidth) + 360} edge="left" label={t('ai.resize')} className={`ai-workspace ai-${mode}`}>
      <header className="ai-toolbar"><strong className="grow">{t('ai.title')}</strong>
        <button className="icon-btn" onClick={() => setMode(mode === 'dock' ? 'bubble' : 'dock')} aria-label={t(mode === 'dock' ? 'ai.float' : 'ai.dock')}><PanelRight size={17} /></button>
        <button className="icon-btn" onClick={() => useRoute.getState().go({ kind: 'native', component: 'flxai-chat', params: {} })} aria-label={t('ai.expand')}><Maximize2 size={17} /></button>
        <button className="icon-btn" onClick={() => setOpen(false)} aria-label={t('common.close')}><X size={17} /></button>
      </header>
      <AiConversation compact />
    </ResizablePane>
  );
}

export function AiScreen() {
  const { t } = useTranslation();
  return <section className="ai-screen"><header className="ai-toolbar"><Bot size={22} /><h1>{t('ai.title')}</h1></header><AiConversation /></section>;
}

function AiConversation({ compact = false }: { compact?: boolean }) {
  const { engine, text, setText } = useWorkspace();
  const { t } = useTranslation();
  const { chat, chats, boot, busy, loading, error } = useStore(engine.store);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState(chats);
  const [searchError, setSearchError] = useState('');
  const [decisions, setDecisions] = useState<Record<string, AiDecision>>({});
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [chat?.messages.length, busy]);
  useEffect(() => {
    let live = true;
    setSearchError('');
    if (!search.trim()) { setResults(chats); return; }
    const timer = setTimeout(() => { void engine.search(search.trim()).then((rows) => { if (live) setResults(rows); }, (e: Error) => { if (live) setSearchError(e.message); }); }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [search, chats, engine]);
  useEffect(() => setDecisions({}), [chat?.id, JSON.stringify(chat?.pending)]);
  const send = async () => {
    if (busy || loading || !text.trim() || !boot?.ready || chat?.pending.length) return;
    const value = text;
    setText('');
    if (!await engine.send(value)) setText((current) => current || value);
  };
  return <div className={`ai-conversation${compact ? ' compact' : ''}`}>
    <div className="ai-history">
      <button type="button" className="btn-ghost small" disabled={busy || loading} onClick={() => engine.newChat()}><Plus size={16} />{t('ai.new')}</button>
      <label className="ai-search"><span className="sr-only">{t('ai.search')}</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('ai.search')} /></label>
      <Select aria-label={t('ai.history')} value={chat?.id ?? ''} disabled={busy || loading} onChange={(e) => { if (e.target.value) void engine.open(Number(e.target.value)); }}>
        <option value="">{t('ai.history')}</option>
        {results.map((c) => <option key={c.id} value={c.id}>{c.title || t('ai.new')}</option>)}
      </Select>
    </div>
    {(error || searchError) && <div className="ai-error" role="alert">{error || searchError}<button className="btn-link" disabled={busy} onClick={() => void engine.initialize()}>{t('common.retry')}</button></div>}
    {loading && <p role="status">{t('states.loading')}</p>}
    {boot && !boot.ready && <p className="notice">{t('ai.notReady')}</p>}
    <div className="ai-messages" aria-label={t('ai.messages')} aria-busy={busy}>
      {!chat?.messages.length && <div className="ai-welcome"><Bot size={32} /><h2>{t('ai.welcome')}</h2><p>{t('ai.disclosure')}</p></div>}
      {chat?.messages.filter((m) => messageText(m)).map((m, i) => <article key={`${chat.id}:${i}`} className={`ai-message ${m.role === 'user' ? 'mine' : ''}`}>
        <strong>{t(m.role === 'user' ? 'ai.you' : m.role === 'tool' ? 'ai.tool' : 'ai.assistant')}</strong>
        {m._thinking && <details><summary>{t('ai.thinking')}</summary><p>{m._thinking}</p></details>}
        <p>{messageText(m)}</p>
      </article>)}
      {busy && <p className="muted" role="status">{t('ai.working')}</p>}
      <div ref={bottom} />
    </div>
    {!!chat?.pending.length && <section className="ai-approval" aria-label={t('ai.approval')}>
      <h2>{t('ai.approval')}</h2><p>{t('ai.disclosure')}</p>
      {chat.pending.map((call) => <div key={call.id} className="ai-call"><strong>{call.title || call.name}</strong><small>{call.source} · {call.name}</small>
        <details><summary>{t('ai.arguments')}</summary><pre>{JSON.stringify(call.args ?? {}, null, 2)}</pre></details>
        <div className="seg">{(['reject', 'approve'] as const).map((decision) => <button type="button" key={decision} disabled={busy} aria-pressed={decisions[call.id] === decision} className={decisions[call.id] === decision ? 'on' : ''} onClick={() => setDecisions((v) => ({ ...v, [call.id]: decision }))}>{t(`ai.${decision}`)}</button>)}</div>
      </div>)}
      <button className="btn-primary small" disabled={busy || chat.pending.some((p) => !decisions[p.id])} onClick={() => void engine.decide(decisions)}>{t('ai.continue')}</button>
    </section>}
    {chat?.status === 'running' && !busy && <button className="btn-ghost small" onClick={() => void engine.resume()}>{t('ai.resume')}</button>}
    <form className="ai-composer" onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <textarea aria-label={t('ai.message')} placeholder={t('ai.message')} value={text} disabled={!boot?.ready} onChange={(e) => setText(e.target.value)} rows={2}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
      {busy && chat?.id ? <button type="button" className="icon-btn" aria-label={t('ai.stop')} onClick={() => void engine.stop()}><Square size={18} /></button> : <button type="submit" className="icon-btn" disabled={busy || loading || !boot?.ready || !text.trim() || !!chat?.pending.length} aria-label={t('ai.send')}><Send size={18} /></button>}
    </form>
    <small className="ai-model">{boot?.modelLabel || boot?.model}</small>
  </div>;
}
