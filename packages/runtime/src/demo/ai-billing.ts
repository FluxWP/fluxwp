import type { AiBilling, AiBillingCredits, AiBillingExport, AiBillingRow } from '../modules/ai-billing';

type Route = [string, RegExp, (match: RegExpMatchArray, query: URLSearchParams, body: Record<string, unknown>) => unknown];
const current = () => new Date().toISOString().slice(0, 7);
const canonical = (month: string | null) => month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : current();
const ledger = (ym: string) => {
  const year = Number(ym.slice(0, 4)); const month = Number(ym.slice(5, 7)); const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: days * 2 }, (_, i) => ({ date: `${ym}-${String(Math.floor(i / 2) + 1).padStart(2, '0')}`, provider: i % 2 ? 'Anthropic' : 'OpenRouter', model: i % 2 ? 'Demo B' : 'Demo A', cost: (i % 5 + 1) * .003, input: 200 + i, output: 30 + i }));
};
const total = (ym: string) => ledger(ym).reduce((sum, row) => sum + row.cost, 0);
let credits: AiBillingCredits | null = null;

function report(ym: string): AiBilling {
  const rows = ledger(ym); const costs = total(ym);
  const grouped = (key: 'provider' | 'model'): AiBillingRow[] => [...new Set(rows.map(row => row[key]))].map(label => {
    const group = rows.filter(row => row[key] === label); const cost = group.reduce((sum, row) => sum + row.cost, 0);
    return { k: label, label, calls: group.length, in_tok: group.reduce((sum, row) => sum + row.input, 0), out_tok: group.reduce((sum, row) => sum + row.output, 0), cost, full_cost: cost * 1.5, est: label === 'Anthropic' ? group.length : 0 };
  });
  const providers = grouped('provider');
  const months = Array.from({ length: 12 }, (_, i) => {
    const at = new Date(`${current()}-01T12:00:00Z`); at.setUTCMonth(at.getUTCMonth() - i); const month = at.toISOString().slice(0, 7);
    return { ym: month, label: month, cost: total(month), saved: total(month) * .5, calls: ledger(month).length };
  });
  const from = Date.parse(`${ym}-01T00:00:00Z`) / 1000; const end = new Date(from * 1000); end.setUTCMonth(end.getUTCMonth() + 1);
  const budget = (label: string, limit: number, spent: number) => ({ label, limit, spent, pct: Math.round(spent / limit * 100), over: spent >= limit, resets: Math.floor(Date.now() / 1000) + 86400 });
  return {
    export_available: true,
    month: { ym, from, to: end.getTime() / 1000, totals: { cost: costs, full_cost: costs * 1.5, saved: costs * .5, calls: rows.length },
      daily: [...new Set(rows.map(row => row.date))].map(date => ({ date, cost: rows.filter(row => row.date === date).reduce((sum, row) => sum + row.cost, 0), calls: 2 })),
      by_provider: providers, by_model: grouped('model'), by_source: [{ k: 'flx-ai', label: 'Flux AI', calls: rows.length, in_tok: providers.reduce((sum, row) => sum + Number(row.in_tok), 0), out_tok: providers.reduce((sum, row) => sum + Number(row.out_tok), 0), cost: costs, full_cost: costs * 1.5 }],
    }, months, budget: { day: budget('day', 1, .24), week: budget('week', 5, 1.8), month: budget('month', 20, total(current())) }, credits,
  };
}
function exportCsv(ym: string): AiBillingExport {
  const header = ['time', 'kind', 'source', 'purpose', 'user_id', 'provider', 'model', 'tool', 'in_tokens', 'out_tokens', 'cache_read', 'cache_write', 'cost_usd', 'cost_without_cache_usd', 'estimated', 'ms', 'ok', 'error'];
  const lines = ledger(ym).map(row => [`${row.date} 12:00:00`, 'model', 'flx-ai', 'demo', 1, row.provider, row.model, '', row.input, row.output, 0, 0, row.cost, row.cost * 1.5, row.provider === 'Anthropic' ? 1 : 0, 400, 1, '']);
  return { filename: `flx-ai-${ym}.csv`, csv: '\uFEFF' + [header, ...lines].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n') + '\n' };
}
export const aiBillingDemoRoutes: Route[] = [
  ['GET', /^flx-ai\/v1\/billing$/, (_match, query) => report(canonical(query.get('ym')))],
  ['GET', /^flx-ai\/v1\/billing\/export$/, (_match, query) => exportCsv(canonical(query.get('ym')))],
  ['POST', /^flx-ai\/v1\/credits$/, () => (credits = { checked: Math.floor(Date.now() / 1000), credits: 18.25, usage: 1.75, limit: 20, remaining: 18.25 })],
];
