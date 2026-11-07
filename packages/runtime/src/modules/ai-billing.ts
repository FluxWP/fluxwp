import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useScope } from '../scope';

type Numeric = number | string;
export interface AiBillingRow { k: string; label: string; calls: Numeric; tools?: Numeric; in_tok: Numeric; out_tok: Numeric; full_cost: Numeric; cost: Numeric; est?: Numeric }
export interface AiBillingCredits { checked: number; credits: number | null; usage: number | null; limit: number | null; remaining: number | null }
export interface AiBillingExport { filename: string; csv: string }
export interface AiBilling {
  export_available?: boolean;
  month: {
    ym: string; from: number; to: number;
    totals: { cost: number; full_cost: number; saved: number; calls: number };
    daily: Array<{ date: string; cost: number; calls: number }>;
    by_provider: AiBillingRow[]; by_source: AiBillingRow[]; by_model: AiBillingRow[];
  };
  months: Array<{ ym: string; label: string; cost: number; saved: number; calls: number }>;
  budget: Record<'day' | 'week' | 'month', { label: string; limit: number; spent: number; pct: number; over: boolean; resets: number }>;
  credits: AiBillingCredits | null;
}

export function billingNumber(value: Numeric | null | undefined): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

/** Account and month are part of every cache key; provider secrets never leave WordPress. */
export function useAiBilling() {
  const { account, api } = useScope(); const cache = useQueryClient();
  const [selection, setSelection] = useState({ accountId: account.id, month: '' });
  const month = selection.accountId === account.id ? selection.month : '';
  const setMonth = (value: string) => setSelection({ accountId: account.id, month: value });
  const queryKey = [account.id, 'ai-billing', month] as const;
  const query = useQuery({ queryKey, staleTime: 30_000, queryFn: ({ signal }) => api<AiBilling>('flx-ai/v1/billing', { query: month ? { ym: month } : {}, signal }) });
  const credits = useMutation({
    mutationFn: async (key: typeof queryKey) => ({ key, value: await api<AiBillingCredits>('flx-ai/v1/credits', { method: 'POST', body: {} }) }),
    onSuccess: ({ key, value }) => cache.setQueriesData<AiBilling>({ queryKey: [key[0], key[1]] }, data => data ? { ...data, credits: value } : data),
  });
  const exportReport = () => api<AiBillingExport>('flx-ai/v1/billing/export', { query: { ym: query.data?.month.ym ?? month } });
  return { query, month, setMonth, credits, refreshCredits: () => credits.mutate(queryKey), exportReport };
}
