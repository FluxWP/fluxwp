import { describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiClient } from '@fluxwp/core';
import { AiSession, type AiResult } from './ai-session';
import type { AiChat } from './ai';

const chat = (patch: Partial<AiChat> = {}): AiChat => ({ id: 7, title: 'Test', status: 'idle', messages: [], pending: [], ...patch });
const boot = { ready: true, model: 'test', modelLabel: 'Test model', canManage: true };
function transport(handler: (path: string, options: Record<string, unknown>) => unknown = () => undefined) {
  const fn = vi.fn(async (path: string, options = {}) => {
    const custom = handler(path, options);
    if (custom !== undefined) return custom;
    if (path.endsWith('/boot')) return boot;
    if (path.endsWith('/chats')) return { chats: [] };
    return chat();
  });
  return { api: fn as unknown as ApiClient, fn };
}

describe('AI authenticated session', () => {
  it('does not run a model or write tool merely by opening history', async () => {
    const { api, fn } = transport(); const s = new AiSession(api);
    await s.initialize(); await s.open(7);
    expect(fn.mock.calls.every(([, o]) => !o?.method)).toBe(true);
    expect(s.store.getState().boot?.ready).toBe(true);
  });
  it('stops at approval, requires a decision for every call, and sends explicit reject', async () => {
    const pending = chat({ status: 'approval', pending: [{ id: 'call-1', title: 'Update post', name: 'update_post', args: { id: 4, status: 'draft' } }] });
    const { api, fn } = transport((path, options) => {
      if (path.endsWith('/send')) return { state: 'continue', chat: chat({ status: 'running' }) };
      if (path.endsWith('/step')) return { state: 'approval', chat: pending };
      if (path.endsWith('/decide')) { expect(options.body).toEqual({ decisions: { 'call-1': 'reject' } }); return { state: 'done', chat: chat() }; }
    });
    const s = new AiSession(api, () => ({ title: 'Posts' })); await s.initialize();
    expect(await s.send('Make this a draft')).toBe(true);
    expect(fn.mock.calls.filter(([p]) => p.endsWith('/step'))).toHaveLength(1);
    expect(fn.mock.calls.filter(([p]) => p.endsWith('/decide'))).toHaveLength(0);
    expect(await s.send('another message while approval is pending')).toBe(false);
    expect(fn.mock.calls.filter(([p]) => p.endsWith('/send'))).toHaveLength(1);
    expect(await s.decide({})).toBe(false);
    expect(await s.decide({ 'call-1': 'reject' })).toBe(true);
    expect(fn.mock.calls.filter(([p]) => p.endsWith('/decide'))).toHaveLength(1);
    expect(fn.mock.calls.find(([p]) => p.endsWith('/send'))?.[1]).toMatchObject({ body: { page: { title: 'Posts' } } });
  });
  it('keeps an accepted user message accepted when a later model step fails', async () => {
    const { api } = transport((path) => {
      if (path.endsWith('/send')) return { state: 'continue', chat: chat({ status: 'running', messages: [{ role: 'user', content: 'hello' }] }) };
      if (path.endsWith('/step')) throw new ApiError(503, 'unavailable', 'Try later');
    });
    const s = new AiSession(api); await s.initialize();
    expect(await s.send('hello')).toBe(true); // UI must not restore a draft that would duplicate the accepted message.
    expect(s.store.getState()).toMatchObject({ busy: false, error: 'Try later', chat: { messages: [{ role: 'user', content: 'hello' }] } });
  });
  it('cancels pending work and ignores a late result after Stop', async () => {
    let release!: (result: AiResult) => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const { api } = transport((path) => {
      if (path.endsWith('/send')) return { state: 'continue', chat: chat({ status: 'running' }) };
      if (path.endsWith('/step')) { entered(); return new Promise<AiResult>((resolve) => { release = resolve; }); }
      if (path.endsWith('/stop')) return { state: 'done', chat: chat({ title: 'Stopped' }) };
    });
    const s = new AiSession(api); await s.initialize(); const send = s.send('hello'); await started;
    await s.stop(); release({ state: 'done', chat: chat({ title: 'Late response' }) }); await send;
    expect(s.store.getState()).toMatchObject({ busy: false, chat: { title: 'Stopped' } });
  });
  it('does not restore a stale conversation after selecting a different one', async () => {
    let release!: (c: AiChat) => void;
    const { api } = transport((path) => path.endsWith('/7') ? new Promise<AiChat>((resolve) => { release = resolve; }) : path.endsWith('/8') ? chat({ id: 8 }) : undefined);
    const s = new AiSession(api); const first = s.open(7); await s.open(8); release(chat()); await first;
    expect(s.store.getState().chat?.id).toBe(8);
  });
  it('distinguishes forbidden AI from a retriable connection error', async () => {
    for (const [status, denied] of [[403, true], [503, false]] as const) {
      const { api } = transport(() => { throw new ApiError(status, 'test', 'Failure'); });
      const s = new AiSession(api); await s.initialize();
      expect(s.store.getState()).toMatchObject({ denied, loading: false, error: 'Failure' });
    }
  });
});
