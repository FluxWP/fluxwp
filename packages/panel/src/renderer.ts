// Desktop Renderer: navigation goes through the panel route store; confirm/toast live in render-web.
import type { ScreenType } from '@fluxwp/manifest';
import type { Renderer } from '@fluxwp/runtime';
import { platform } from '@fluxwp/core';
import { webUI } from '@fluxwp/render-web';
import { ensureI18n } from './i18n';
import { useRoute } from './state/route';

const SCREENS: ReadonlySet<ScreenType> = new Set(['list', 'detail', 'form', 'dashboard', 'settings', 'content', 'tabs', 'native', 'web']);

export const NATIVE_SCREENS = ['dashboard', 'flxc-inbox', 'flxg-tasks', 'flxb-review', 'flxai-chat', 'flxai-billing', 'flxai-tools', 'flxai-systems', 'flxai-mcp', 'flxr-roles', 'flxl-languages', 'flxsm-composer', 'flxsm-compose'] as const;

export function desktopRenderer(): Renderer {
  const i18n = ensureI18n();
  const t = (key: string, vars?: Record<string, unknown>) => i18n.t(key, vars ?? {});
  return {
    screens: SCREENS,
    native: new Set(NATIVE_SCREENS),
    t,
    nav: {
      push: (route) => {
        if (route.kind === 'url') return void platform().openExternal(route.url);
        useRoute.getState().go(route);
      },
      replace: (route) => {
        if (route.kind === 'url') return void platform().openExternal(route.url);
        useRoute.getState().replace(route);
      },
      back: () => useRoute.getState().back(),
      openUrl: (url) => void platform().openExternal(url),
    },
    ui: webUI((key) => t(key)),
  };
}
