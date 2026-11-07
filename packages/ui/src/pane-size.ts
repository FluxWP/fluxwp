export function paneWidth(value: unknown, fallback: number, min: number, max: number): number {
  const width = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.round(Math.max(min, Math.min(Math.max(min, max), width)));
}

export function paneKeyWidth(key: string, width: number, min: number, max: number, edge: 'left' | 'right', reset: number, shift = false): number | null {
  if (key === 'Home') return min;
  if (key === 'End') return max;
  if (key === 'Enter') return paneWidth(reset, reset, min, max);
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return null;
  const direction = (key === 'ArrowRight' ? 1 : -1) * (edge === 'right' ? 1 : -1);
  return paneWidth(width + direction * (shift ? 40 : 10), reset, min, max);
}
