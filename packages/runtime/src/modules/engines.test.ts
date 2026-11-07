import { describe, expect, it } from 'vitest';
import { createClient, flxg, type ApiClient, type FlxcChat } from '@fluxwp/core';
import { demoFetch, DEMO_SITE } from '@fluxwp/core/src/demo/fetch';
import { NATIVE_SCREEN_IDS } from '../index';
import { resolveTarget, type ResolveEnv } from '../resolve';
import { parseNdjson, readAiStream } from './ai';
import { parseChecklist, toggleChecklistItem } from './tasks/checklist';
import { FlxgEngine } from './tasks/engine';
import { mediaForm, type MediaFile } from './media';
import { postBody, postEditPath } from './post';
import { socialPostBody } from './social';
import { studioBusy, studioGenerateBody } from './studio';
import { tvCommandAllowed, TV_KEYS } from './tv';
import { memoryPorts } from './ports';
import { notifyIncoming } from './whatsapp/notify';
import { WaEngine } from './whatsapp/engine';

const html = '<p>Not</p><ul data-checklist="1"><li data-checked="1">Fidanlık</li><li data-checked="0">Kamyon</li></ul>';

describe('native screen ids', () => {
  const env: ResolveEnv = { appVersion: '1.0.0', native: new Set(NATIVE_SCREEN_IDS) };
  it('opens the N-row modules as native screens', () => {
    expect(resolveTarget('module:flxc-inbox', env)).toMatchObject({ kind: 'native', component: 'flxc-inbox' });
    expect(resolveTarget('module:flxg-tasks', env)).toMatchObject({ kind: 'native', component: 'flxg-tasks' });
    expect(resolveTarget('module:flxb-review', env)).toMatchObject({ kind: 'native', component: 'flxb-review' });
    expect(resolveTarget('module:flx-studio', env)).toMatchObject({ kind: 'native', component: 'flx-studio' });
    expect(resolveTarget('module:flx-ai', env)).toMatchObject({ kind: 'native', component: 'flx-ai' });
    expect(resolveTarget('module:flx-tv-remote', env)).toMatchObject({ kind: 'native', component: 'flx-tv-remote' });
    expect(resolveTarget('native:core-post', env)).toMatchObject({ kind: 'native', component: 'core-post' });
    expect(resolveTarget('native:core-media', env)).toMatchObject({ kind: 'native', component: 'core-media' });
    expect(resolveTarget('native:flxsm-composer', env)).toMatchObject({ kind: 'native', component: 'flxsm-composer' });
    expect(resolveTarget('native:flxsm-compose', env)).toMatchObject({ kind: 'native', component: 'flxsm-compose' });
  });
});

describe('platform ports', () => {
  it('does not mark a chat read while the app is in the background', async () => {
    const calls: string[] = [];
    const chat = { id: 1, unread: 2, title: 'Ayşe', phone: '90532', status: 'open', pinned: 0, labels: [], lastTs: 1, lastInTs: 1 } as FlxcChat;
    const api: ApiClient = async (path, opts) => {
      calls.push(`${opts?.method ?? 'GET'} ${path}`);
      if (path.startsWith('flx-chat/v1/bootstrap')) return { rev: 1, unread: 2, connections: [], me: { id: 1, name: 'Demo', manage: true }, agents: [], labels: [], replies: [], ai: { id: 'x', label: 'AI', auto: false } };
      if (path === 'flx-chat/v1/chats') return { chats: [chat] };
      return { ok: true, chat, messages: [], more: false, note: '' };
    };
    const ports = memoryPorts({ visible: false });
    const engine = new WaEngine({ client: api, ports, poll: 30 });
    await engine.start();
    engine.open(1);
    expect(calls.some((c) => c.includes('/read'))).toBe(false);
    ports.setVisible(true);
    expect(calls.some((c) => c.includes('/read'))).toBe(true);
    engine.stop();
  });

  it('remembers the tasks view in the platform store, not localStorage', async () => {
    const ports = memoryPorts();
    const api = createClient({ siteUrl: DEMO_SITE, fetchImpl: demoFetch, getCredentials: async () => ({ token: 'demo' }) });
    const engine = new FlxgEngine(flxg(api), undefined, ports);
    await engine.boot();
    expect(engine.S.ready).toBe(true);
    expect(engine.S.lists.length).toBeGreaterThan(0);
    expect(ports.storage.get('view-home')).toBeTruthy();
    engine.dispose();
  });

  it('notifies only when the app is hidden', () => {
    const shown: string[] = [];
    const hidden = memoryPorts({ visible: false });
    hidden.showNotification = (n) => shown.push(n.title);
    const item = { id: 9, chat: 3, title: 'Ayşe', body: 'Dekont', avatar: '' };
    notifyIncoming([item], 3, undefined, () => undefined, hidden);
    expect(shown).toEqual(['Ayşe']);
    shown.length = 0;
    const visible = memoryPorts({ visible: true });
    visible.showNotification = (n) => shown.push(n.title);
    notifyIncoming([{ ...item, id: 10 }], null, undefined, () => undefined, visible);
    expect(shown).toEqual([]);
  });
});

describe('screen engines', () => {
  it('parses and toggles a checklist inside the description', () => {
    expect(parseChecklist(html).map((i) => i.text)).toEqual(['Fidanlık', 'Kamyon']);
    expect(parseChecklist(html).map((i) => i.done)).toEqual([true, false]);
    const nasty = '<ul data-checklist="1"><li data-checked="0"><script>x</script></li><li data-checked="1">A &amp; B</li><li data-checked="0">&amp;lt;script</li></ul>';
    const items = parseChecklist(nasty);
    expect(items[0]!.text.includes('<')).toBe(false);
    expect(items[1]).toEqual({ text: 'A & B', done: true });
    expect(items[2]!.text).toBe('&lt;script');
    expect(items[2]!.text.includes('<')).toBe(false);
    const next = toggleChecklistItem(html, 1);
    expect(parseChecklist(next).map((i) => i.done)).toEqual([true, true]);
    expect(toggleChecklistItem('<p>yok</p>', 0)).toBe('<p>yok</p>');
  });

  it('reads an NDJSON chat stream', async () => {
    const body = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('{"t":"text","d":"Merhaba"}\n{"t":"text","d":" dünya"}'));
        c.enqueue(new TextEncoder().encode('\n{"t":"result","state":"done"}\n'));
        c.close();
      },
    });
    const events: string[] = [];
    await readAiStream(new Response(body, { headers: { 'content-type': 'application/x-ndjson' } }), (ev) => events.push(ev.t + (ev.d ?? '')));
    expect(events).toEqual(['textMerhaba', 'text dünya', 'result']);
    expect(parseNdjson('{"t":"think","d":"…"}\n', '').events[0]).toMatchObject({ t: 'think' });
  });

  it('builds post, social and studio requests', () => {
    expect(postBody({ title: '  Afiş ', excerpt: 'Kısa', status: 'draft' })).toEqual({ title: 'Afiş', excerpt: 'Kısa', status: 'draft', content: '' });
    expect(postEditPath(12)).toBe('post.php?post=12&action=edit');
    expect(socialPostBody({ content: 'Bugün dikiyoruz', accountIds: [1, 2] }).action).toBe('now');
    expect(socialPostBody({ content: 'Yarın', accountIds: [1], scheduledAt: 1_700_000_000 }).action).toBe('schedule');
    expect(studioGenerateBody({ prompt: ' orman ', kind: 'video', n: 3 }).n).toBe(1);
    expect(studioBusy([{ id: 1, kind: 'image', state: 'running', prompt: '', job: 'flxmd_1' }, { id: 2, kind: 'image', state: 'done', prompt: '' }])).toEqual(['flxmd_1']);
  });

  it('blocks TV commands off the bridge Wi-Fi', () => {
    expect(tvCommandAllowed({ same_wifi: true, online: true })).toBe(true);
    expect(tvCommandAllowed({ same_wifi: false, online: true })).toBe(false);
    expect(tvCommandAllowed({ same_wifi: true, online: false })).toBe(false);
    expect(tvCommandAllowed(null)).toBe(false);
    expect(TV_KEYS.ok).toBe('DPAD_CENTER');
  });

  it('puts a picked file on the media form', () => {
    const file: MediaFile = { uri: 'blob:1', name: 'dekont.png', type: 'image/png', blob: new Blob(['x'], { type: 'image/png' }) };
    const fd = mediaForm(file, 'Dekont');
    expect(fd.get('alt_text')).toBe('Dekont');
    expect(fd.get('file')).toBeInstanceOf(Blob);
  });
});
