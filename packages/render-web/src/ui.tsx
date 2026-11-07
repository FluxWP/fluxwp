// Confirm, prompt and toast. The runtime calls these; both the desktop panel and wp-embed render <RenderOverlays />.
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import type { FormField } from '@fluxwp/manifest';
import type { ConfirmRequest, RendererUI } from '@fluxwp/runtime';
import { Select } from '@fluxwp/ui';

interface ConfirmState extends ConfirmRequest {
  resolve: (ok: boolean) => void;
}

interface PromptState {
  title: string;
  fields: FormField[];
  resolve: (v: Record<string, unknown> | null) => void;
}

interface ToastState {
  id: number;
  message: string;
  tone: 'ok' | 'error';
}

interface OverlayStore {
  confirm: ConfirmState | null;
  prompt: PromptState | null;
  toasts: ToastState[];
  ask: (req: ConfirmRequest) => Promise<boolean>;
  askPrompt: (req: { title: string; fields: FormField[] }) => Promise<Record<string, unknown> | null>;
  push: (message: string, tone: 'ok' | 'error') => void;
  dismiss: (id: number) => void;
}

let toastSeq = 0;

export const overlayStore = create<OverlayStore>((set, get) => ({
  confirm: null,
  prompt: null,
  toasts: [],
  ask: (req) =>
    new Promise((resolve) => {
      get().confirm?.resolve(false);
      set({ confirm: { ...req, resolve } });
    }),
  askPrompt: (req) =>
    new Promise((resolve) => {
      get().prompt?.resolve(null);
      set({ prompt: { ...req, resolve } });
    }),
  push: (message, tone) => {
    const id = ++toastSeq;
    set({ toasts: [...get().toasts, { id, message, tone }].slice(-4) });
    setTimeout(() => get().dismiss(id), 4200);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

/** Renderer UI port. `t` translates the Cancel / fallback labels. */
export function webUI(t: (key: string) => string): RendererUI {
  return {
    confirm: (req) => overlayStore.getState().ask(req),
    prompt: (req) => overlayStore.getState().askPrompt(req),
    toast: (message, tone = 'ok') => overlayStore.getState().push(message, tone),
    copy: async (text) => {
      await navigator.clipboard?.writeText(text);
    },
    share: async ({ text, url }) => {
      const data = { text, url };
      if (navigator.share) await navigator.share(data).catch(() => undefined);
      else await navigator.clipboard?.writeText([text, url].filter(Boolean).join('\n'));
    },
    // desktop has no haptic engine; the field exists so the runtime can call it
    haptic: () => undefined,
  };
}

function FieldInputs({ fields, onChange }: { fields: FormField[]; onChange: (v: Record<string, unknown>) => void }) {
  const [values, setValues] = useState<Record<string, unknown>>(() => Object.fromEntries(fields.map((f) => [f.name, f.default ?? (f.type === 'switch' ? false : '')])));
  useEffect(() => onChange(values), [values, onChange]);
  return (
    <div className="fx-stack">
      {fields.map((f) => (
        <label key={f.name} className="fx-field">
          <span>{f.label}</span>
          {f.type === 'textarea' ? (
            <textarea value={String(values[f.name] ?? '')} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
          ) : f.type === 'switch' ? (
            <input type="checkbox" checked={!!values[f.name]} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.checked }))} />
          ) : f.type === 'select' && Array.isArray(f.options) ? (
            <Select value={String(values[f.name] ?? '')} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}>
              <option value="" />
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          ) : (
            <input value={String(values[f.name] ?? '')} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
          )}
        </label>
      ))}
    </div>
  );
}

export function RenderOverlays({ t }: { t: (key: string) => string }) {
  const confirm = overlayStore((s) => s.confirm);
  const prompt = overlayStore((s) => s.prompt);
  const toasts = overlayStore((s) => s.toasts);
  const [promptValues, setPromptValues] = useState<Record<string, unknown>>({});
  useEffect(() => setPromptValues({}), [prompt?.title]);

  const closeConfirm = (ok: boolean) => {
    confirm?.resolve(ok);
    overlayStore.setState({ confirm: null });
  };
  const closePrompt = (v: Record<string, unknown> | null) => {
    prompt?.resolve(v);
    overlayStore.setState({ prompt: null });
  };

  return (
    <>
      {confirm && (
        <div className="fx-overlay" role="presentation" onMouseDown={() => closeConfirm(false)}>
          <div className="fx-dialog" role="alertdialog" aria-labelledby="fx-confirm-title" onMouseDown={(e) => e.stopPropagation()}>
            <h2 id="fx-confirm-title">{confirm.title}</h2>
            {confirm.body && <p>{confirm.body}</p>}
            <div className="fx-row">
              <button type="button" className="fx-btn" onClick={() => closeConfirm(false)}>{t('desktop.cancel')}</button>
              <button type="button" className={confirm.tone === 'danger' ? 'fx-btn danger' : 'fx-btn primary'} onClick={() => closeConfirm(true)}>{confirm.ok || t('action.confirm')}</button>
            </div>
          </div>
        </div>
      )}
      {prompt && (
        <div className="fx-overlay" role="presentation" onMouseDown={() => closePrompt(null)}>
          <form
            className="fx-dialog"
            role="dialog"
            aria-label={prompt.title}
            onMouseDown={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              closePrompt(promptValues);
            }}
          >
            <h2>{prompt.title}</h2>
            <FieldInputs fields={prompt.fields} onChange={setPromptValues} />
            <div className="fx-row">
              <button type="button" className="fx-btn" onClick={() => closePrompt(null)}>{t('desktop.cancel')}</button>
              <button type="submit" className="fx-btn primary">{t('action.confirm')}</button>
            </div>
          </form>
        </div>
      )}
      <div className="fx-toasts" aria-live="polite">
        {toasts.map((item) => (
          <button key={item.id} type="button" className={'fx-toast ' + item.tone} onClick={() => overlayStore.getState().dismiss(item.id)}>{item.message}</button>
        ))}
      </div>
    </>
  );
}
