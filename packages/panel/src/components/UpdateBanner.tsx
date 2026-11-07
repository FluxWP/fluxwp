// Sol alttaki güncelleme kartı: hazır sürüm "Yeniden başlat", imzasız sürüm "İndir".
import { useTranslation } from 'react-i18next';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import { useUpdate } from '../state/update';

export function UpdateBanner() {
  const { t } = useTranslation();
  const { status, update, progress, install } = useUpdate();
  if (!update || !(status === 'ready' || status === 'available' || status === 'installing')) return null;
  return (
    <button className="update-banner" aria-label={`${t('update.newVersion', { version: update.version })}. ${t(status === 'ready' ? 'update.restart' : status === 'installing' ? 'update.installing' : 'update.download')}`} onClick={() => void install()} disabled={status === 'installing'} title={update.notes ? update.notes.replace(/<[^>]+>/g, ' ') : undefined}>
      <span className="update-ic">{status === 'installing' ? <Loader2 size={16} className="spin" /> : status === 'ready' ? <RefreshCw size={16} /> : <Download size={16} />}</span>
      <span className="account-text">
        <strong>{t('update.newVersion', { version: update.version })}</strong>
        <span>{t(status === 'ready' ? 'update.restart' : status === 'installing' ? 'update.installing' : 'update.download')}</span>
      </span>
      {progress > 0 && progress < 1 && <span className="update-bar" style={{ width: `${progress * 100}%` }} />}
    </button>
  );
}
