import { createStore } from 'zustand/vanilla';
import { ApiError, type ApiClient } from '@fluxwp/core';
import type { AiChat } from './ai';

export interface AiBoot { ready: boolean; model: string; modelLabel: string; canManage: boolean; mode?: 'bubble' | 'dock' }
export interface AiSummary { id: number; title: string; status: string }
export interface AiSessionState {
  boot: AiBoot | null; chats: AiSummary[]; chat: AiChat | null; loading: boolean; busy: boolean; error: string; denied: boolean;
}
export interface AiResult { state: string; chat: AiChat }
export type AiDecision = 'approve' | 'reject';

/** The site's authenticated client owns credentials, refresh and transport. No provider key enters the app. */
export class AiSession {
  readonly store = createStore<AiSessionState>(() => ({ boot: null, chats: [], chat: null, loading: false, busy: false, error: '', denied: false }));
  private controller: AbortController | null = null;
  private revision = 0;
  constructor(private api: ApiClient, private page: () => Record<string, unknown> = () => ({})) {}
  private error(e: unknown) { this.store.setState({ error: e instanceof Error ? e.message : String(e) }); }
  async initialize() {
    if (this.store.getState().busy) return;
    const rev = ++this.revision;
    this.controller?.abort(); const controller = this.controller = new AbortController();
    this.store.setState({ loading: true, error: '', denied: false, boot: null });
    try {
      const [boot, list] = await Promise.all([
        this.api<AiBoot>('flx-ai/v1/boot', { signal: controller.signal }).then((boot) => { if (rev === this.revision) this.store.setState({ boot }); return boot; }),
        this.api<{ chats: AiSummary[] }>('flx-ai/v1/chats', { signal: controller.signal }),
      ]);
      if (rev === this.revision) this.store.setState({ boot, chats: list.chats });
    } catch (e) {
      if (rev === this.revision && !controller.signal.aborted) {
        this.store.setState({ denied: e instanceof ApiError && [401, 403, 404].includes(e.status) });
        this.error(e);
      }
    }
    finally { if (rev === this.revision) this.store.setState({ loading: false }); }
  }
  async search(q: string) {
    const result = await this.api<{ chats: AiSummary[] }>('flx-ai/v1/chats', { query: { q } });
    return result.chats;
  }
  async open(id: number) {
    if (this.store.getState().busy) return;
    const rev = ++this.revision;
    this.store.setState({ loading: true, error: '' });
    try {
      const chat = await this.api<AiChat>(`flx-ai/v1/chats/${id}`);
      if (rev === this.revision) this.store.setState({ chat });
    } catch (e) { if (rev === this.revision) this.error(e); }
    finally { if (rev === this.revision) this.store.setState({ loading: false }); }
  }
  newChat() { if (!this.store.getState().busy) { ++this.revision; this.store.setState({ chat: null, error: '', loading: false }); } }
  async send(text: string) {
    const body = text.trim();
    if (!body || !this.store.getState().boot?.ready || this.store.getState().chat?.pending.length) return false;
    return this.run(async (signal) => this.api<AiResult>(`flx-ai/v1/chats/${this.store.getState().chat?.id ?? 0}/send`, { method: 'POST', body: { text: body, page: this.page() }, signal }));
  }
  async decide(decisions: Record<string, AiDecision>) {
    const chat = this.store.getState().chat;
    if (!chat?.pending.length || chat.pending.some((p) => !['approve', 'reject'].includes(decisions[p.id] ?? ''))) return false;
    const exact = Object.fromEntries(chat.pending.map((p) => [p.id, decisions[p.id]]));
    return this.run((signal) => this.api<AiResult>(`flx-ai/v1/chats/${chat.id}/decide`, { method: 'POST', body: { decisions: exact }, signal }));
  }
  async resume() {
    const chat = this.store.getState().chat;
    if (!chat || chat.status !== 'running') return false;
    return this.run(async () => ({ state: 'continue', chat }));
  }
  private async run(start: (signal: AbortSignal) => Promise<AiResult>) {
    if (this.store.getState().busy) return false;
    const rev = ++this.revision;
    const controller = this.controller = new AbortController();
    this.store.setState({ busy: true, error: '' });
    let accepted = false;
    try {
      let result = await start(controller.signal);
      accepted = true;
      // Each step uses the existing JSON endpoint through the account transport (incl. refresh/header fallback).
      // The server enforces tool permissions and stops before any unapproved write.
      for (let step = 0; ; step++) {
        if (rev !== this.revision || controller.signal.aborted) return false;
        this.store.setState({ chat: result.chat });
        if (result.state === 'approval' || result.chat.status === 'approval' || result.chat.pending.length) break;
        if (result.state !== 'continue' && result.chat.status !== 'running') break;
        if (step >= 100) throw new Error('AI step limit reached');
        result = await this.api<AiResult>(`flx-ai/v1/chats/${result.chat.id}/step`, { method: 'POST', body: {}, signal: controller.signal });
      }
      const list = await this.api<{ chats: AiSummary[] }>('flx-ai/v1/chats', { signal: controller.signal });
      if (rev === this.revision) this.store.setState({ chats: list.chats });
      return true;
    } catch (e) { if (rev === this.revision && !controller.signal.aborted) this.error(e); return accepted; }
    finally { if (rev === this.revision) this.store.setState({ busy: false }); }
  }
  async stop() {
    const id = this.store.getState().chat?.id;
    if (!id) return;
    const rev = ++this.revision;
    this.controller?.abort(); this.store.setState({ busy: true });
    try {
      const r = await this.api<AiResult>(`flx-ai/v1/chats/${id}/stop`, { method: 'POST', body: {} });
      if (rev === this.revision) this.store.setState({ chat: r.chat });
    } catch (e) { if (rev === this.revision) this.error(e); }
    finally { if (rev === this.revision) this.store.setState({ busy: false }); }
  }
  dispose() { ++this.revision; this.controller?.abort(); this.store.setState({ busy: false, loading: false }); }
}
