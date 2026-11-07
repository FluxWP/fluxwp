import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { paneKeyWidth, paneWidth } from './pane-size';

/** Persist the requested width, but fit the current container without losing that preference. */
export function ResizablePane({ storageKey, initialWidth = 320, minWidth = 240, maxWidth = 640, minContentWidth = 320, edge = 'right', label, className = '', children, style }: {
  storageKey: string; initialWidth?: number; minWidth?: number; maxWidth?: number; minContentWidth?: number;
  edge?: 'left' | 'right'; label: string; className?: string; children: ReactNode; style?: CSSProperties;
}) {
  const read = () => {
    try { return paneWidth(JSON.parse(localStorage.getItem(storageKey) ?? 'null'), initialWidth, minWidth, maxWidth); }
    catch { return initialWidth; }
  };
  const [wanted, setWanted] = useState(read);
  const [available, setAvailable] = useState(maxWidth);
  const [dragging, setDragging] = useState(false);
  const pane = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; width: number } | null>(null);
  const max = Math.max(minWidth, Math.min(maxWidth, available));
  const width = paneWidth(wanted, initialWidth, minWidth, max);
  useEffect(() => setWanted(read()), [storageKey]); // account/module switch
  useLayoutEffect(() => {
    const parent = pane.current?.parentElement;
    if (!parent) return;
    const update = () => setAvailable(parent.clientWidth - minContentWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [minContentWidth]);
  useEffect(() => {
    if (!dragging) return;
    const before = { cursor: document.body.style.cursor, userSelect: document.body.style.userSelect };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => { document.body.style.cursor = before.cursor; document.body.style.userSelect = before.userSelect; };
  }, [dragging]);
  const save = (next: number) => {
    const value = paneWidth(next, initialWidth, minWidth, max);
    setWanted(value);
    try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* storage unavailable */ }
  };
  const end = () => { drag.current = null; setDragging(false); };
  return (
    <div ref={pane} className={`flux-pane ${className}${dragging ? ' is-resizing' : ''}`} style={{ ...style, width, flexBasis: width }}>
      {children}
      <div className={`flux-pane-handle edge-${edge}`} role="separator" tabIndex={0} aria-label={label} aria-orientation="vertical" aria-valuemin={minWidth} aria-valuemax={max} aria-valuenow={width}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault(); e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, width }; setDragging(true);
        }}
        onPointerMove={(e) => { if (drag.current) save(drag.current.width + (e.clientX - drag.current.x) * (edge === 'right' ? 1 : -1)); }}
        onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}
        onDoubleClick={() => save(initialWidth)}
        onKeyDown={(e) => {
          const next = paneKeyWidth(e.key, width, minWidth, max, edge, initialWidth, e.shiftKey);
          if (next !== null) { e.preventDefault(); save(next); }
        }} />
    </div>
  );
}
