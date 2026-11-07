import { expect, it } from 'vitest';
import { shellGroupLabel } from './group-label';
import { appResources } from './i18n';

it('translates built-in legacy/empty group labels but preserves custom site text', () => {
  expect(shellGroupLabel('communication', 'Communication')).toBe('$t:shell.groups.communication');
  expect(shellGroupLabel('donate')).toBe('$t:shell.groups.donations');
  expect(shellGroupLabel('system', 'Personel işlemleri')).toBe('Personel işlemleri');
  expect(shellGroupLabel('custom', 'Something')).toBe('Something');
  expect(shellGroupLabel('system', '$t:nav.groups.system')).toBe('$t:nav.groups.system');
});

it('provides both languages for every built-in group key', () => {
  for (const id of ['general', 'communication', 'comms', 'donate', 'donations', 'content', 'growth', 'screens', 'system', 'other', 'apps']) {
    const key = shellGroupLabel(id).slice(3).split('.');
    for (const locale of ['tr', 'en'] as const) {
      const value = key.reduce<unknown>((obj, part) => (obj as Record<string, unknown>)[part], appResources[locale].translation);
      expect(typeof value).toBe('string');
    }
  }
});
