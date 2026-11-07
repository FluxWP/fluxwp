// Yeni sohbet penceresi, emoji seçici, ses kaydı.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, Square, Trash2 } from 'lucide-react';
import { Modal } from '@fluxwp/ui';
import type { WaEngine } from './engine';
import { duration } from './format';
import { Select } from '@fluxwp/ui';

/* ---------- yeni sohbet ---------- */

export function NewChat({ engine, onClose, onOpen }: { engine: WaEngine; onClose: () => void; onOpen: (id: number) => void }) {
  const { t } = useTranslation();
  const conns = engine.s.conns;
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [conn, setConn] = useState(conns[0]?.id ?? '');
  const [chk, setChk] = useState<Awaited<ReturnType<WaEngine['api']['checkNumber']>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    setChk(null);
    if (phone.replace(/\D/g, '').length < 10) return;
    const h = setTimeout(() => void engine.api.checkNumber(phone, conn).then(setChk, () => setChk(null)), 450);
    return () => clearTimeout(h);
  }, [phone, conn, engine]);

  const submit = async () => {
    if (chk?.chat) return onOpen(chk.chat);
    setBusy(true);
    setErr('');
    try {
      const r = await engine.api.newChat({ phone, name: name || undefined, conn, check: true });
      engine.upsert(r.chat);
      onOpen(r.chat.id);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  let state = '';
  if (chk && !chk.valid) state = t('wa.new.invalid');
  else if (chk?.chat) state = t('wa.new.exists', { name: chk.name || chk.phoneFmt });
  else if (chk?.exists === true) state = t('wa.new.hasWa');
  else if (chk?.exists === false) state = t('wa.new.noWa');

  return (
    <Modal title={t('wa.new.title')} onClose={onClose}>
      <form className="stack" onSubmit={(e) => (e.preventDefault(), void submit())}>
        <label className="field">
          {t('wa.new.phone')}
          <input autoFocus value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 5xx xxx xx xx" inputMode="tel" />
        </label>
        {state && <p className={'small ' + (chk?.exists === false || (chk && !chk.valid) ? 'text-danger' : 'accent')}>{state}</p>}
        {!chk?.chat && (
          <label className="field">
            {t('wa.new.name')}
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={chk?.name ?? ''} />
          </label>
        )}
        {conns.length > 1 && (
          <label className="field">
            {t('wa.new.line')}
            <Select className="wa-select" value={conn} onChange={(e) => setConn(e.target.value)}>
              {conns.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </label>
        )}
        {err && <p className="error">{err}</p>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn-primary" disabled={busy || !phone.trim() || chk?.valid === false || chk?.exists === false}>
            {chk?.chat ? t('wa.new.go') : t('wa.new.start')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- emoji ---------- */

const EMOJI = '😀 😁 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😋 😎 🤗 🤔 😐 😴 😢 😭 😡 😮 😱 🥲 🙄 😅 🤩 🥳 😌 😬 🤝 👍 👎 👏 🙌 🙏 💪 👋 ✌️ 👌 ☝️ ❤️ 🧡 💛 💚 💙 💜 🤍 💔 ❣️ 💯 ✅ ❌ ⚠️ ❗ ❓ ⭐ 🔥 🎉 🎁 📌 📎 📄 📷 📞 📍 🕐 📅 💰 💳 🏦 🌱 🌳 🌲 🌿 🍃 🌍 ☀️ 🌧️ 🇹🇷'.split(' ');

export function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const k = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    setTimeout(() => document.addEventListener('mousedown', k));
    return () => document.removeEventListener('mousedown', k);
  }, [onClose]);
  return (
    <div className="wa-emoji" ref={ref}>
      {EMOJI.map((e) => (
        <button key={e} type="button" onClick={() => onPick(e)}>{e}</button>
      ))}
    </div>
  );
}

/* ---------- ses kaydı ---------- */

function pickMime(): string {
  const list = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return typeof MediaRecorder !== 'undefined' ? list.find((m) => MediaRecorder.isTypeSupported(m)) ?? '' : '';
}

export const canRecord = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

/** Kayıt çubuğu; açılınca kayda başlar. Gönder → onDone(blob, ad). 0.7 sn'den kısa kayıt atılır. */
export function Recorder({ onDone, onCancel, onTick, onError }: { onDone: (b: Blob, name: string) => void; onCancel: () => void; onTick: () => void; onError: (m: string) => void }) {
  const { t } = useTranslation();
  const [secs, setSecs] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const cancelled = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let iv: ReturnType<typeof setInterval>;
    void navigator.mediaDevices.getUserMedia({ audio: true }).then(
      (s) => {
        stream = s;
        const mime = pickMime();
        const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
        r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
        r.onstop = () => {
          s.getTracks().forEach((tr) => tr.stop());
          const len = (Date.now() - started.current) / 1000;
          if (cancelled.current || len < 0.7) return onCancel();
          const type = r.mimeType || mime || 'audio/webm';
          const ext = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm';
          onDone(new Blob(chunks.current, { type }), `ses-${Date.now()}.${ext}`);
        };
        rec.current = r;
        started.current = Date.now();
        r.start(250);
        iv = setInterval(() => {
          setSecs((Date.now() - started.current) / 1000);
          onTick();
        }, 500);
      },
      () => (onError(t('wa.voice.denied')), onCancel()),
    );
    return () => {
      clearInterval(iv);
      if (rec.current?.state === 'recording') {
        cancelled.current = true;
        rec.current.stop();
      }
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="wa-recorder">
      <button type="button" className="icon-btn" onClick={() => ((cancelled.current = true), rec.current?.stop() ?? onCancel())} aria-label={t('common.cancel')}><Trash2 size={18} /></button>
      <span className="wa-rec-dot" /> <span className="grow">{t('wa.voice.recording')} {duration(secs)}</span>
      <button type="button" className="btn-primary wa-send" onClick={() => rec.current?.stop()} aria-label={t('common.send')}><Square size={15} /></button>
    </div>
  );
}

export { Mic };
