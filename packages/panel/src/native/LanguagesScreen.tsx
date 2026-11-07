import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Globe, Plus, Save, Trash2 } from 'lucide-react';
import { ApiError } from '@fluxwp/core';
import { useAccount, useApi, useRenderer } from '@fluxwp/runtime';
import { languageDraft, languagePatch, type LanguageConfiguration, type LanguageSettings } from '@fluxwp/runtime/src/modules/languages';
import { ResizablePane } from '@fluxwp/ui';
import './native-admin.css';
import { Select } from '@fluxwp/ui';

export function LanguagesScreen() {
  const { t } = useTranslation(); const account = useAccount(); const api = useApi(); const renderer = useRenderer(); const qc = useQueryClient();
  const queryKey = [account.id, 'native-languages'];
  const query = useQuery({ queryKey, queryFn: ({ signal }) => api<LanguageConfiguration>('flx-lang/v1/configuration', { signal }) });
  const [draft, setDraft] = useState<LanguageSettings | null>(null); const [version, setVersion] = useState('');
  const [countryText, setCountryText] = useState('');
  const [selected, setSelected] = useState(''); const [add, setAdd] = useState(''); const [dirty, setDirty] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    if (query.data && !dirty) { setDraft(languageDraft(query.data)); setVersion(query.data.version); setCountryText(query.data.settings.home_countries.join(', ')); }
  }, [query.data, dirty]);
  useEffect(() => { if (draft && !draft.languages[selected]) setSelected(draft.default); }, [draft, selected]);
  const edit = (next: (old: LanguageSettings) => LanguageSettings) => { setDraft(old => old && next(old)); setDirty(true); };
  const save = async () => {
    if (!draft || busy || !await renderer.ui.confirm({ title: t('languages.saveTitle'), body: draft.default !== query.data?.settings.default ? t('languages.defaultWarning') : t('languages.saveBody') })) return;
    setBusy(true); setError('');
    try { const result = await api<LanguageConfiguration>('flx-lang/v1/configuration', { method: 'POST', body: languagePatch({ ...draft, home_countries: countryText.split(/[,;\s]+/).map(v => v.toUpperCase()).filter(Boolean) }, version) }); qc.setQueryData(queryKey, result); setDraft(languageDraft(result)); setVersion(result.version); setDirty(false); renderer.ui.toast(t('form.saved'), 'ok'); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const remove = async (code: string) => {
    if (!draft || code === draft.default || !await renderer.ui.confirm({ title: t('languages.remove'), body: t('languages.removeBody', { language: draft.languages[code]?.name }) })) return;
    edit(old => { const languages = { ...old.languages }; const texts = { ...old.texts }; delete languages[code]; delete texts[code]; return { ...old, languages, texts, suggest_to: languages[old.suggest_to] ? old.suggest_to : Object.keys(languages).find(id => id !== old.default) ?? old.default }; });
  };
  if (query.isPending) return <div className="page" role="status">{t('states.loading')}</div>;
  if (query.isError || !query.data || !draft) return <div className="page"><h1>{t('languages.title')}</h1><p className="error">{query.error instanceof ApiError && query.error.status === 404 ? t('languages.updateRequired') : query.error instanceof Error ? query.error.message : t('states.errorTitle')}</p><button className="btn-ghost" onClick={() => void query.refetch()}>{t('common.retry')}</button></div>;
  const data = query.data;
  const field = (code: string, key: 'name' | 'flag' | 'locale', value: string) => edit(old => ({ ...old, languages: { ...old.languages, [code]: { ...old.languages[code]!, [key]: value } } }));
  const setDefault = (code: string) => edit(old => ({ ...old, default: code, languages: { ...old.languages, [code]: { ...old.languages[code]!, active: 1 } } }));
  return <div className="native-admin split">
    <ResizablePane className="native-admin-nav" storageKey={`flux.pane.${account.id}.languages`} initialWidth={240} minWidth={200} maxWidth={380} minContentWidth={440} label={t('languages.resize')}>
      <header><Globe size={22} /><h1>{t('languages.title')}</h1></header>
      <nav aria-label={t('languages.title')}>{Object.entries(draft.languages).map(([code, language]) => <button type="button" key={code} className={selected === code ? 'on' : ''} aria-current={selected === code ? 'page' : undefined} onClick={() => setSelected(code)}><strong>{language.flag} {language.name}</strong><span>{code === draft.default ? t('languages.default') : '/' + code + '/'} · {t(language.active ? 'languages.active' : 'languages.inactive')}</span></button>)}</nav>
      <form className="native-admin-add" onSubmit={e => { e.preventDefault(); if (data.catalog[add] && !draft.languages[add]) { edit(old => ({ ...old, languages: { ...old.languages, [add]: { ...data.catalog[add]!, active: 0 } } })); setSelected(add); setAdd(''); } }}>
        <label className="field">{t('languages.add')}<Select value={add} onChange={e => setAdd(e.target.value)} disabled={busy}><option value="">{t('form.choose')}</option>{Object.entries(data.catalog).filter(([code]) => !draft.languages[code]).map(([code, row]) => <option key={code} value={code}>{row.flag} {row.name} ({code})</option>)}</Select></label>
        <button className="btn-ghost small" disabled={!add || busy}><Plus size={15} />{t('languages.add')}</button>
      </form>
    </ResizablePane>
    <main className="native-admin-body"><header className="page-head"><div><h1>{t('languages.title')}</h1><p className="muted">{t('languages.intro')}</p></div><button className="btn-primary" disabled={!dirty || busy} onClick={() => void save()}><Save size={16} />{busy ? t('form.saving') : t('form.submit')}</button></header>
      {error && <p className="error" role="alert">{error}</p>}{dirty && version !== data.version && <p className="notice warn">{t('roles.conflict')}</p>}
      <div className="native-table-scroll"><table className="native-matrix"><thead><tr>{['active','code','name','flag','locale','default','actions'].map(id => <th key={id}>{t(`languages.${id}`)}</th>)}</tr></thead><tbody>{Object.entries(draft.languages).map(([code, row]) => <tr key={code}>
        <td><input type="checkbox" aria-label={t('languages.activeFor', { name: row.name })} checked={!!row.active || code === draft.default} disabled={busy || code === draft.default} onChange={e => { const active = e.target.checked ? 1 : 0; edit(old => ({ ...old, languages: { ...old.languages, [code]: { ...old.languages[code]!, active } } })); }} /></td>
        <td><code>{code === draft.default ? '/' : '/' + code + '/'}</code></td>
        {(['name','flag','locale'] as const).map(key => <td key={key}><input aria-label={`${row.name}: ${t(`languages.${key}`)}`} value={row[key]} disabled={busy} onChange={e => field(code, key, e.target.value)} /></td>)}
        <td><input type="radio" name="default-language" aria-label={t('languages.defaultFor', { name: row.name })} checked={code === draft.default} disabled={busy} onChange={() => setDefault(code)} /></td>
        <td>{code !== draft.default && <button className="icon-btn" disabled={busy} aria-label={t('languages.remove')} onClick={() => void remove(code)}><Trash2 size={16} /></button>}</td>
      </tr>)}</tbody></table></div><p className="muted small">{t('languages.inactiveHelp')}</p>
      <section className="panel"><h2>{t('languages.contentTypes')}</h2><div className="native-checks">{data.post_types.map(type => <label className="check" key={type.id}><input type="checkbox" checked={draft.post_types.includes(type.id)} disabled={busy} onChange={e => { const on = e.target.checked; edit(old => ({ ...old, post_types: on ? [...old.post_types, type.id] : old.post_types.filter(id => id !== type.id) })); }} />{type.label}</label>)}</div>
        <label className="setting"><span>{t('languages.fallback')}</span><input type="checkbox" checked={!!draft.fallback} disabled={busy} onChange={e => { const on = e.target.checked; edit(old => ({ ...old, fallback: on ? 1 : 0 })); }} /></label>
        <label className="setting"><span>{t('languages.switcher')}</span><Select disabled={busy} value={draft.switcher} onChange={e => { const value = e.target.value as LanguageSettings['switcher']; edit(old => ({ ...old, switcher: value })); }}><option value="code">TR · EN</option><option value="name">Türkçe · English</option><option value="flag">🇹🇷 · 🇬🇧</option></Select></label>
        <label className="setting"><span>{t('languages.placement')}</span><Select disabled={busy} value={draft.switcher_place} onChange={e => { const value = e.target.value as LanguageSettings['switcher_place']; edit(old => ({ ...old, switcher_place: value })); }}>{(['footer','header','both'] as const).map(v => <option key={v} value={v}>{t(`languages.${v}`)}</option>)}</Select></label>
      </section>
      <section className="panel"><h2>{t('languages.suggestion')}</h2><label className="setting"><span>{t('languages.behavior')}</span><Select value={draft.suggest} disabled={busy} onChange={e => { const value = e.target.value as LanguageSettings['suggest']; edit(old => ({ ...old, suggest: value })); }}>{(['off','banner','redirect'] as const).map(v => <option value={v} key={v}>{t(`languages.${v}`)}</option>)}</Select></label>
        <label className="setting"><span>{t('languages.suggestTo')}</span><Select value={draft.suggest_to} disabled={busy} onChange={e => { const value = e.target.value; edit(old => ({ ...old, suggest_to: value })); }}>{Object.entries(draft.languages).map(([code,row]) => <option key={code} value={code}>{row.name}</option>)}</Select></label>
        <label className="field">{t('languages.countries')}<input disabled={busy} value={countryText} placeholder="TR, CY" onChange={e => { setCountryText(e.target.value); setDirty(true); }} /></label><p className="muted small">{t('languages.suggestionHelp')}</p>
      </section>
      <section className="panel"><h2>{t('languages.siteTexts')} · {draft.languages[selected]?.name}</h2>{selected === draft.default ? <p className="muted">{t('languages.defaultTexts')}</p> : <><p className="muted small">{t('languages.textHelp')}</p><div className="native-fields">{data.text_fields.map(f => {
        const value = draft.texts[selected]?.[f.id] ?? '';
        const change = (text: string) => edit(old => ({ ...old, texts: { ...old.texts, [selected]: { ...old.texts[selected], [f.id]: text } } }));
        return <label className="field" key={`${selected}:${f.id}`}>{f.label}{f.multiline ? <textarea lang={selected} disabled={busy} rows={3} value={value} placeholder={f.base} onChange={e => change(e.target.value)} /> : <input lang={selected} disabled={busy} value={value} placeholder={f.base} onChange={e => change(e.target.value)} />}</label>;
      })}</div></>}</section>
      <p className="notice">{t('languages.aiHelp')}</p>
    </main>
  </div>;
}
