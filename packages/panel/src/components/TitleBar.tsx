// Pencere üst satırı: menüyü daralt/genişlet + geri/ileri. Masaüstünde macOS trafik ışıklarının sağında durur
// ve pencereyi sürükleme alanıdır.
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, PanelLeft } from 'lucide-react';
import { useRoute } from '../state/route';
import { useSidebar } from '../state/sidebar';

export function TitleBar({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const { past, future, back, forward } = useRoute();
  const { collapsed, toggle } = useSidebar();
  return (
    <div className={'titlebar ' + className} data-tauri-drag-region>
      <button className="icon-btn tb-btn" onClick={toggle} aria-controls="flux-sidebar" aria-expanded={!collapsed} aria-label={t(collapsed ? 'nav.expand' : 'nav.collapse')} title={t(collapsed ? 'nav.expand' : 'nav.collapse')}>
        <PanelLeft size={17} />
      </button>
      <button className="icon-btn tb-btn" onClick={back} disabled={!past.length} aria-label={t('nav.back')} title={t('nav.back')}>
        <ChevronLeft size={19} />
      </button>
      <button className="icon-btn tb-btn" onClick={forward} disabled={!future.length} aria-label={t('nav.forward')} title={t('nav.forward')}>
        <ChevronRight size={19} />
      </button>
    </div>
  );
}
