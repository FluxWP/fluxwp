const GROUPS: Record<string, { key: string; legacy: string }> = {
  general: { key: 'general', legacy: 'General' },
  comms: { key: 'communication', legacy: 'Communication' },
  communication: { key: 'communication', legacy: 'Communication' },
  donate: { key: 'donations', legacy: 'Donations' },
  donations: { key: 'donations', legacy: 'Donations' },
  content: { key: 'content', legacy: 'Content' },
  growth: { key: 'growth', legacy: 'Growth' },
  screens: { key: 'screens', legacy: 'Screens' },
  system: { key: 'system', legacy: 'System' },
  other: { key: 'other', legacy: 'Other' },
  apps: { key: 'apps', legacy: 'Apps' },
};

/** Localize built-in group labels while retaining site owners' custom labels verbatim. */
export function shellGroupLabel(id: string, label?: string): string {
  const group = GROUPS[id];
  if (group && (!label || label.toLowerCase() === group.legacy.toLowerCase() || label === id)) return `$t:shell.groups.${group.key}`;
  return label ?? '';
}
