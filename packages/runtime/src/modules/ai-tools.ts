import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useScope } from '../scope';

export interface AiToolRow {
  id: string; name: string; title: string; description: string; source: string; label: string;
  readonly: boolean; approval: boolean; cap: string; mcp: boolean; chat: boolean; off: boolean;
  aliases: string[]; dupe: boolean; rivals: string[]; prefixed: boolean;
  usage: { n: number; avg_ms: number; errors: number } | null;
}
export interface AiToolFilter { q: string; source: string; kind: '' | 'read' | 'write'; state: '' | 'on' | 'off' | 'conflict' | 'noprefix' }
export interface AiToolsResult {
  revision: string; items: AiToolRow[]; total: number; selectable_total: number; page: number; pages: number;
  sources: Array<{ id: string; label: string; total: number; on: number; duplicates: number }>;
  summary: { tools: number; on: number; off: number; conflicts: number; unprefixed: number };
}
interface ToolChange { revision: string; changes: Record<string, boolean>; bulk?: { enabled: boolean; names?: string[]; filter?: AiToolFilter; exclude?: string[] }; pick?: { name: string; source: string } }
const emptyFilter: AiToolFilter = { q: '', source: '', kind: '', state: '' };

/** Mount the view with an account key; no state or draft is shared between account views. */
export function useAiTools(initialSource='') {
  const { account, api, renderer } = useScope(); const client = useQueryClient();
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [filter, changeFilter] = useState<AiToolFilter>({...emptyFilter,source:initialSource}); const [search, changeSearch] = useState(''); const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Record<string, boolean>>({}); const [revision, setRevision] = useState('');
  const [selected, setSelected] = useState<string[]>([]); const [matching, setMatching] = useState(false);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [selectionRevision, setSelectionRevision] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [detail, changeDetail] = useState<AiToolRow | null>(null); const [detailRevision, setDetailRevision] = useState('');
  const dirty = Object.keys(draft).length;
  const query = useQuery<AiToolsResult>({ queryKey: [account.id, 'ai-tools', filter, page], staleTime: 30_000, placeholderData: (previous, previousQuery) => previousQuery?.queryKey[0] === account.id ? previous : undefined, queryFn: ({ signal }) => api<AiToolsResult>('flx-ai/v1/admin/tools', { query: { ...filter, page, per_page: 30 }, signal }) });
  const pages = query.data?.pages;
  const selectionCount = matching ? Math.max(0, (query.data?.selectable_total ?? 0) - excluded.length) : selected.length;
  const setDetail = (row: AiToolRow | null) => { changeDetail(row); setDetailRevision(row ? query.data?.revision ?? '' : ''); };
  useEffect(() => { if (pages && !query.isPlaceholderData && page > pages) setPage(pages); }, [pages, page, query.isPlaceholderData]);
  const clearSelection = () => { setSelected([]); setMatching(false); setExcluded([]); setSelectionRevision(''); };
  const setSearch = (value: string) => { changeSearch(value); clearSelection(); };
  const setFilter = (next: Partial<AiToolFilter>) => { changeFilter(current => ({ ...current, ...next })); setPage(1); clearSelection(); };
  useEffect(() => { if (filter.q === search) return; const timeout = setTimeout(() => { changeFilter(current => ({ ...current, q: search })); setPage(1); setSelected([]); setMatching(false); setExcluded([]); }, 220); return () => clearTimeout(timeout); }, [search, filter.q]);
  const toggle = (row: AiToolRow, enabled: boolean) => {
    if (busy || row.dupe || !query.data) return;
    if (!dirty) setRevision(query.data.revision);
    setDraft(current => { const next = { ...current }; if (enabled === !row.off) delete next[row.name]; else next[row.name] = enabled; return next; });
  };
  const select = (name: string, checked: boolean) => {
    if (!selectionCount) setSelectionRevision(query.data?.revision ?? '');
    if (matching) setExcluded(current => checked ? current.filter(value => value !== name) : [...new Set([...current, name])]);
    else setSelected(current => checked ? [...new Set([...current, name])] : current.filter(value => value !== name));
  };
  const selectable = query.data?.items.filter(row => !row.dupe) ?? [];
  const selectPage = (checked: boolean) => { if (!selectionCount) setSelectionRevision(query.data?.revision ?? ''); const names = selectable.map(row => row.name); if (matching) setExcluded(current => checked ? current.filter(name => !names.includes(name)) : [...new Set([...current, ...names])]); else setSelected(current => checked ? [...new Set([...current, ...names])] : current.filter(name => !names.includes(name))); };
  const reload = async () => {
    if (busy || dirty && !await renderer.ui.confirm({ title: renderer.t('aiTools.reload'), body: renderer.t('aiTools.discard') })) return;
    setDraft({}); setRevision(''); setError(''); setDetail(null); clearSelection(); await query.refetch();
  };
  const save = async (kind: 'save' | 'enable' | 'disable' | 'pick', row?: AiToolRow) => {
    if (busy || !query.data || query.isPlaceholderData) return;
    const count = matching ? Math.max(0, query.data.selectable_total - excluded.length) : selected.length;
    if (kind === 'save' && !dirty || (kind === 'enable' || kind === 'disable') && (!count || search !== filter.q) || kind === 'pick' && (!row || dirty)) return;
    if (dirty && revision !== query.data.revision || (kind === 'enable' || kind === 'disable') && selectionRevision !== query.data.revision || kind === 'pick' && row?.id === detail?.id && detailRevision !== query.data.revision) { setError(renderer.t('aiTools.stale')); return; }
    const body: ToolChange = { revision: dirty ? revision : kind === 'enable' || kind === 'disable' ? selectionRevision : query.data.revision, changes: { ...draft } };
    if (kind === 'enable' || kind === 'disable') body.bulk = matching ? { enabled: kind === 'enable', filter, exclude: excluded } : { enabled: kind === 'enable', names: selected };
    if (kind === 'pick' && row) body.pick = { name: row.name, source: row.source };
    // Close a detail sheet before presenting the platform confirmation sheet.
    setDetail(null);
    const title = renderer.t(kind === 'pick' ? 'aiTools.useDefinition' : kind === 'save' ? 'aiTools.save' : `aiTools.${kind}`);
    const site = `${account.siteName} (${account.siteUrl})`;
    const message = kind === 'pick' ? renderer.t('aiTools.pickConfirm', { name: row!.name, source: row!.label, site }) : renderer.t(kind === 'save' ? 'aiTools.saveConfirm' : 'aiTools.bulkConfirm', { count, dirty, site });
    setBusy(true); setError('');
    try {
      if (!await renderer.ui.confirm({ title, body: message }) || !active.current) return;
      await api('flx-ai/v1/admin/tools', { method: 'POST', body });
      setDraft({}); setRevision(''); clearSelection();
      await client.invalidateQueries({ queryKey: [account.id, 'ai-tools'] });
      if (active.current) renderer.ui.toast(renderer.t('form.saved'), 'ok');
    } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  return { query, filter, setFilter, search, setSearch, page, setPage, draft, dirty, revision, toggle, selected, matching, isSelected: (name: string) => matching ? !excluded.includes(name) : selected.includes(name), setMatching: () => { setMatching(true); setSelected([]); setExcluded([]); setSelectionRevision(query.data?.revision ?? ''); }, select, selectPage, clearSelection, reload, save, busy, error, detail: query.data?.revision === detailRevision ? detail : null, setDetail,
    stale: !!query.data && (!!dirty && revision !== query.data.revision || selectionCount > 0 && selectionRevision !== query.data.revision), selectionCount,
  };
}
