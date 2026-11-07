// Flux AI chat (flx-ai/v1). Streaming is NDJSON from POST /chats/<id>/step?stream=1
// (`t`: text | think | chat | result). A JSON body is accepted too (proxies that buffer the stream).
import { buildUrl } from '@fluxwp/core';
import { demoShellFetch } from '../demo/fetch';

export interface AiMessage {
  role: string;
  content?: string;
  _thinking?: string;
  _name?: string;
}

export interface AiPending {
  id: string;
  name: string;
  title: string;
  source?: string;
  args?: Record<string, unknown>;
}

export interface AiChat {
  id: number;
  title: string;
  status: string;
  messages: AiMessage[];
  pending: AiPending[];
  total?: number;
}

export interface AiEvent {
  t: string;
  d?: string;
  state?: string;
  chat?: AiChat;
}

export function parseNdjson(chunk: string, carry = ''): { events: AiEvent[]; rest: string } {
  const lines = (carry + chunk).split('\n');
  const rest = lines.pop() ?? '';
  const events: AiEvent[] = [];
  for (const line of lines) {
    const s = line.trim();
    if (!s) continue;
    try {
      const ev = JSON.parse(s) as AiEvent;
      if (ev && typeof ev.t === 'string') events.push(ev);
    } catch {
      /* padding or a partial line already kept in rest */
    }
  }
  return { events, rest };
}

export function messageText(m: AiMessage): string {
  return (m.content ?? '').trim();
}

/** Reads an NDJSON body, or one JSON object, and reports each event. */
export async function readAiStream(res: Response, onEvent: (ev: AiEvent) => void): Promise<void> {
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('ndjson') || !res.body) {
    const json = (await res.json()) as { state?: string; chat?: AiChat };
    onEvent({ t: 'result', state: json.state, chat: json.chat });
    return;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let carry = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const parsed = parseNdjson(dec.decode(value, { stream: true }), carry);
    carry = parsed.rest;
    parsed.events.forEach(onEvent);
  }
  if (carry.trim()) parseNdjson(carry + '\n', '').events.forEach(onEvent);
}

export interface AiStepRequest {
  siteUrl: string;
  /** Demo accounts have no stored token; the demo transport ignores it. */
  demo?: boolean;
  token?: string | null;
  scheme?: 'bearer' | 'basic';
  chatId: number;
  since?: number;
  signal?: AbortSignal;
}

/** POST /chats/<id>/step?stream=1 with the same transport the account uses. */
export async function streamAiStep(req: AiStepRequest, onEvent: (ev: AiEvent) => void): Promise<void> {
  const headers: Record<string, string> = {
    Accept: 'application/x-ndjson, application/json',
    'Content-Type': 'application/json',
  };
  if (req.demo) headers.Authorization = 'Bearer demo';
  else if (req.token) headers.Authorization = req.scheme === 'basic' ? `Basic ${req.token}` : `Bearer ${req.token}`;
  const fetchImpl = req.demo ? demoShellFetch : fetch;
  const res = await fetchImpl(buildUrl(req.siteUrl, `flx-ai/v1/chats/${req.chatId}/step`, { stream: 1, since: req.since ?? 0 }), {
    method: 'POST',
    headers,
    body: '{}',
    signal: req.signal,
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const err = (await res.json()) as { message?: string };
      if (err.message) message = err.message;
    } catch {
      /* body already consumed or not json */
    }
    throw new Error(message);
  }
  await readAiStream(res, onEvent);
}
