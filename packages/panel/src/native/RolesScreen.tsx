import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, RotateCcw, Save, Trash2, Users } from 'lucide-react';
import { ApiError } from '@fluxwp/core';
import { useAccount, useApi, useRenderer } from '@fluxwp/runtime';
import { roleMatrixPatch, type RoleMatrix, type RoleMatrixPatch, type RoleMembers } from '@fluxwp/runtime/src/modules/roles';
import { ResizablePane } from '@fluxwp/ui';
import './native-admin.css';
import { Select } from '@fluxwp/ui';

export function RolesScreen() {
  const { t } = useTranslation();
  const account = useAccount(); const api = useApi(); const renderer = useRenderer(); const qc = useQueryClient();
  const queryKey = [account.id, 'native-roles'];
  const query = useQuery({ queryKey, queryFn: ({ signal }) => api<RoleMatrix>('flx-roles/v1/matrix', { signal }) });
  const [draft, setDraft] = useState<RoleMatrixPatch | null>(null);
  const [dirty, setDirty] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [selected, setSelected] = useState(''); const [roleName, setRoleName] = useState('');
  useEffect(() => {
    if (!query.data) return;
    if (!dirty) setDraft(roleMatrixPatch(query.data));
    if (!query.data.roles.some(r => r.id === selected)) setSelected(query.data.roles[0]?.id ?? '');
  }, [query.data, dirty, selected]);
  const install = (data: RoleMatrix) => { qc.setQueryData(queryKey, data); setDraft(roleMatrixPatch(data)); setDirty(false); };
  const confirm = (title: string, body: string) => renderer.ui.confirm({ title, body });
  const mutate = async (path: string, body: unknown, title: string, message: string) => {
    if (busy || !await confirm(title, dirty ? t('roles.unsaved') + '\n' + message : message)) return;
    setBusy(true); setError('');
    try { install(await api<RoleMatrix>(path, { method: 'POST', body })); setRoleName(''); renderer.ui.toast(t('form.saved'), 'ok'); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!draft || busy || !await confirm(t('roles.saveTitle'), t('roles.saveBody'))) return;
    setBusy(true); setError('');
    try { install(await api<RoleMatrix>('flx-roles/v1/matrix', { method: 'POST', body: draft })); renderer.ui.toast(t('form.saved'), 'ok'); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  if (query.isPending) return <div className="page" role="status">{t('states.loading')}</div>;
  if (query.isError || !query.data || !draft) return <div className="page"><h1>{t('roles.title')}</h1><p className="error">{query.error instanceof ApiError && query.error.status === 404 ? t('roles.updateRequired') : query.error instanceof Error ? query.error.message : t('states.errorTitle')}</p><button className="btn-ghost" onClick={() => void query.refetch()}>{t('common.retry')}</button></div>;
  const data = query.data;
  return <div className="native-admin split">
    <ResizablePane className="native-admin-nav" storageKey={`flux.pane.${account.id}.roles`} initialWidth={260} minWidth={210} maxWidth={420} minContentWidth={440} label={t('roles.resize')}>
      <header><Users size={22} /><h1>{t('roles.title')}</h1></header>
      <nav aria-label={t('roles.roles')}>{data.roles.map(role => <button type="button" key={role.id} disabled={busy} aria-current={selected === role.id ? 'page' : undefined} className={selected === role.id ? 'on' : ''} onClick={() => setSelected(role.id)}><strong>{role.label}</strong><span>{t('roles.count', { count: role.count })}</span></button>)}</nav>
      <form className="native-admin-add" onSubmit={e => { e.preventDefault(); if (roleName.trim()) void mutate('flx-roles/v1/roles', { name: roleName }, t('roles.add'), t('roles.newBody')); }}>
        <label className="field">{t('roles.name')}<input maxLength={40} value={roleName} disabled={busy} onChange={e => setRoleName(e.target.value)} /></label>
        <button className="btn-ghost small" disabled={busy || !roleName.trim()}><Plus size={15} />{t('roles.add')}</button>
      </form>
    </ResizablePane>
    <main className="native-admin-body">
      <header className="page-head"><div><h1>{t('roles.access')}</h1><p className="muted">{t('roles.intro')}</p></div><button className="btn-primary" disabled={busy || !dirty} onClick={() => void save()}><Save size={16} />{busy ? t('form.saving') : t('form.submit')}</button></header>
      {error && <p className="error" role="alert">{error}</p>}
      {dirty && draft.version !== data.version && <p className="notice warn">{t('roles.conflict')}</p>}
      {selected && <section className="panel"><h2>{data.roles.find(r => r.id === selected)?.label}</h2><p>{data.roles.find(r => r.id === selected)?.description}</p><div className="row">
        <button className="btn-ghost small" disabled={busy} onClick={() => void mutate(`flx-roles/v1/roles/${encodeURIComponent(selected)}/reset`, {}, t('roles.reset'), t('roles.resetBody'))}><RotateCcw size={15} />{t('roles.reset')}</button>
        {data.roles.find(r => r.id === selected)?.custom && <button className="btn-ghost small danger" disabled={busy} onClick={() => void mutate(`flx-roles/v1/roles/${encodeURIComponent(selected)}/delete`, {}, t('roles.delete'), t('roles.deleteBody'))}><Trash2 size={15} />{t('roles.delete')}</button>}
      </div></section>}
      <div className="native-table-scroll"><table className="native-matrix"><thead><tr><th scope="col">{t('roles.capability')}</th>{data.roles.map(role => <th scope="col" key={role.id}>{role.label}</th>)}</tr></thead>
        {data.groups.map(group => <tbody key={group.id}><tr className="native-matrix-group"><th colSpan={data.roles.length + 1} scope="rowgroup">{group.label}{!group.active && <small> · {t('roles.notInstalled', { plugin: group.plugin })}</small>}</th></tr>
          {group.caps.map(cap => <tr key={cap.id}><th scope="row"><span>{cap.label}</span><code>{cap.id}</code>{cap.warning && <small>{t('roles.broad')}</small>}{!cap.supported && group.active && <small>{t('roles.pending')}</small>}</th>
            {data.roles.map(role => <td key={role.id}><input type="checkbox" aria-label={`${role.label}: ${cap.label}`} checked={draft.caps[role.id]?.[cap.id] ?? false} disabled={busy || cap.locked} onChange={e => { const on = e.target.checked; setDraft(v => v && ({ ...v, caps: { ...v.caps, [role.id]: { ...v.caps[role.id], [cap.id]: on } } })); setDirty(true); }} /></td>)}
          </tr>)}
        </tbody>)}
      </table></div>
      <section className="panel"><h2>{t('roles.settings')}</h2>{data.roles.map(role => <label key={role.id} className="setting"><span>{t('roles.home', { role: role.label })}</span><Select disabled={busy} value={draft.home[role.id] ?? 'auto'} onChange={e => { const home = e.target.value; setDraft(v => v && ({ ...v, home: { ...v.home, [role.id]: home } })); setDirty(true); }}>{data.home_choices.map(c => <option value={c.id} key={c.id}>{c.label}</option>)}</Select></label>)}
        <label className="setting"><span>{t('roles.refDays')}</span><input type="number" min={1} max={365} disabled={busy} value={draft.ref_days} onChange={e => { const days = e.target.valueAsNumber; setDraft(v => v && ({ ...v, ref_days: Number.isFinite(days) ? days : 0 })); setDirty(true); }} /></label><p className="muted small">{t('roles.refHelp')}</p>
      </section>
      {selected && <RolePeople role={selected} canPromote={data.can_promote} canList={!!data.can_list} />}
    </main>
  </div>;
}

function RolePeople({ role, canPromote, canList }: { role: string; canPromote: boolean; canList: boolean }) {
  const { t } = useTranslation(); const account = useAccount(); const api = useApi(); const renderer = useRenderer(); const qc = useQueryClient();
  const [search, setSearch] = useState(''); const [page, setPage] = useState(1); const [who, setWho] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [links, setLinks] = useState<Record<number, string>>({});
  useEffect(() => { setPage(1); setSearch(''); setWho(''); setError(''); }, [role]);
  const people = useQuery({ queryKey: [account.id, 'role-people', role, search, page], queryFn: ({ signal }) => api<RoleMembers>('flx-roles/v1/people', { query: { role, search, page }, signal }) });
  const change = async (body: unknown, message: string) => {
    if (busy || !await renderer.ui.confirm({ title: t('roles.membership'), body: message })) return;
    setBusy(true); setError('');
    try { await api('flx-roles/v1/people', { method: 'POST', body }); setWho(''); await qc.invalidateQueries({ queryKey: [account.id, 'role-people'] }); void qc.invalidateQueries({ queryKey: [account.id, 'native-roles'] }); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const phone = async (id: number, value: string) => {
    setBusy(true); setError('');
    try { await api(`flx-roles/v1/people/${id}/phone`, { method: 'POST', body: { phone: value } }); await people.refetch(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const referral = async (id: number) => {
    setBusy(true); setError('');
    try { const r = await api<{ url: string }>(`flx-roles/v1/people/${id}/referral`, { method: 'POST', body: {} }); setLinks(v => ({ ...v, [id]: r.url })); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  return <section className="panel"><h2>{t('roles.people')}</h2><label className="field">{t('roles.search')}<input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></label>
    {error && <p className="error" role="alert">{error}</p>}{people.isError && <p className="error">{people.error instanceof Error ? people.error.message : t('states.errorTitle')}</p>}
    {people.isPending ? <p role="status">{t('states.loading')}</p> : !people.data?.items.length ? <p className="muted">{t('roles.empty')}</p> : <div className="native-table-scroll"><table className="native-matrix"><thead><tr><th>{t('roles.person')}</th><th>{t('roles.phone')}</th><th>{t('roles.actions')}</th></tr></thead><tbody>{people.data.items.map(user => <tr key={`${role}:${user.id}:${user.phone}`}><th><strong>{user.name}</strong><small>{user.login} · {user.email}</small></th><td><form className="row" onSubmit={e => { e.preventDefault(); const input = e.currentTarget.elements.namedItem('phone') as HTMLInputElement; void phone(user.id, input.value); }}><input name="phone" type="tel" aria-label={t('roles.phoneFor', { name: user.name })} defaultValue={user.phone} disabled={busy} /><button className="btn-ghost small" disabled={busy}>{t('form.submit')}</button></form>{user.referral && <button className="btn-link small" disabled={busy} onClick={() => void referral(user.id)}>{t('roles.referral')}</button>}{links[user.id] && <input aria-label={t('roles.referralLink')} value={links[user.id]} readOnly onFocus={e => e.currentTarget.select()} />}</td><td>{canPromote && !user.protected && <button className="btn-ghost small danger" disabled={busy} onClick={() => void change({ operation: 'remove', role, user: user.id }, t('roles.removeBody', { name: user.name }))}>{t('roles.remove')}</button>}</td></tr>)}</tbody></table></div>}
    {people.data && people.data.pages > 1 && <div className="row"><button className="btn-ghost small" disabled={page <= 1 || people.isFetching} onClick={() => setPage(v => v - 1)}>{t('nav.back')}</button><span>{page} / {people.data.pages}</span><button className="btn-ghost small" disabled={page >= people.data.pages || people.isFetching} onClick={() => setPage(v => v + 1)}>{t('nav.forward')}</button></div>}
    {canPromote && <form className="native-member-add" onSubmit={e => { e.preventDefault(); if (who.trim()) void change({ operation: 'add', role, who: who.trim() }, t('roles.assignBody', { who })); }}><label className="field">{t('roles.loginOrEmail')}{canList ? <Select value={who} disabled={busy} onChange={e=>setWho(e.target.value)} remote={{key:JSON.stringify([account.id,'role-user-search']),load:async({search,cursor,signal})=>{
      const page=Math.max(1,Number(cursor||1)); const response=await api<{id:number;name:string;username?:string;email?:string;roles?:string[]}[]>('wp/v2/users',{raw:true,signal,query:{context:'edit',search,page,per_page:25}});
      return {options:(response.data ?? []).filter(u=>!u.roles?.includes('administrator')).flatMap(u=>{const value=u.username||u.email;return value?[{value,label:u.name,description:u.email||u.username}]:[];}),nextCursor:page<Number(response.headers.get('X-WP-TotalPages')||1)?String(page+1):null};
    }}}><option value="">{t('form.choose')}</option></Select> : <input value={who} disabled={busy} onChange={e => setWho(e.target.value)} />}</label><button className="btn-ghost small" disabled={busy || !who.trim()}>{t('roles.assign')}</button></form>}
  </section>;
}
