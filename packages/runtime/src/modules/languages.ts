export interface LanguageChoice { name: string; locale: string; flag: string }
export interface SiteLanguage extends LanguageChoice { active: number }
export interface LanguageSettings {
  default: string; languages: Record<string, SiteLanguage>; post_types: string[]; fallback: number;
  suggest: 'off' | 'banner' | 'redirect'; suggest_to: string; home_countries: string[];
  switcher: 'code' | 'name' | 'flag'; switcher_place: 'footer' | 'header' | 'both'; texts: Record<string, Record<string, string>>;
}
export interface LanguageConfiguration {
  settings: LanguageSettings; catalog: Record<string, LanguageChoice>; post_types: { id: string; label: string }[];
  text_fields: { id: string; label: string; multiline: boolean; base: string }[]; version: string;
}
export function languageDraft(data: LanguageConfiguration): LanguageSettings {
  const s = data.settings;
  return { ...s, languages: Object.fromEntries(Object.entries(s.languages).map(([id, row]) => [id, { ...row }])), post_types: [...s.post_types], home_countries: [...s.home_countries], texts: Object.fromEntries(Object.entries(s.texts).map(([id, values]) => [id, { ...values }])) };
}
export function languagePatch(settings: LanguageSettings, version: string) {
  const { languages, home_countries, ...rest } = settings;
  return { ...rest, langs: languages, home_countries: home_countries.join(', '), version };
}
