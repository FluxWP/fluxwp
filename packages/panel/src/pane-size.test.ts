import { expect, it } from 'vitest';
import { paneKeyWidth, paneWidth } from '@fluxwp/ui/src/pane-size';

it('fits corrupt/stale preferences and a shrunken container', () => {
  expect(paneWidth(NaN, 320, 240, 600)).toBe(320);
  expect(paneWidth('900', 320, 240, 600)).toBe(320);
  expect(paneWidth(560, 320, 240, 350)).toBe(350);
  expect(paneWidth(100, 320, 240, 180)).toBe(240);
});
it('resizes in the physical direction of either panel edge, with keyboard reset and limits', () => {
  expect(paneKeyWidth('ArrowRight', 320, 240, 600, 'right', 320)).toBe(330);
  expect(paneKeyWidth('ArrowRight', 320, 240, 600, 'left', 320)).toBe(310);
  expect(paneKeyWidth('ArrowLeft', 250, 240, 600, 'right', 320, true)).toBe(240);
  expect(paneKeyWidth('Enter', 500, 240, 600, 'right', 320)).toBe(320);
  expect(paneKeyWidth('Tab', 500, 240, 600, 'right', 320)).toBeNull();
});
