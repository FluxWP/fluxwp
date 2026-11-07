// AccountScope: everything below it works on one account (API client, query cache, config, manifests).
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { Account, ApiClient } from '@fluxwp/core';
import type { ConfigLayer } from '@fluxwp/manifest';
import { apiFor } from './api';
import { CACHE_BUSTER, CACHE_MAX_AGE, createPersister, createQueryClient, type PersistStore } from './query';
import type { Renderer } from './renderer';
import { clearSocialSessions } from './modules/social-session';

export interface AppInfo {
  /** This app's version (manifest `min_app`). */
  version: string;
  /** Brand layer for config merging (white-label); `locked` paths win over site and user. */
  brand?: ConfigLayer & { locked?: string[] };
  /** Device layer (theme mode etc.). */
  device?: ConfigLayer;
}

interface Scope {
  account: Account;
  api: ApiClient;
  client: QueryClient;
  renderer: Renderer;
  app: AppInfo;
}

const Ctx = createContext<Scope | null>(null);
const clients = new Map<string, QueryClient>();

/** Same client for the account across remounts (switching back keeps the warm cache). */
export function queryClientFor(accountId: string): QueryClient {
  let c = clients.get(accountId);
  if (!c) clients.set(accountId, (c = createQueryClient()));
  return c;
}

export function dropAccountCache(accountId: string): void {
  clearSocialSessions(accountId);
  clients.get(accountId)?.clear();
  clients.delete(accountId);
}

export function AccountScope(props: { account: Account; renderer: Renderer; app: AppInfo; store?: PersistStore; api?: ApiClient; children: ReactNode }) {
  const { account, renderer, app, store, api, children } = props;
  const client = queryClientFor(account.id);
  const value = useMemo<Scope>(() => ({ account, api: api ?? apiFor(account), client, renderer, app }), [account, api, client, renderer, app]);
  const persister = useMemo(() => (store ? createPersister(store) : null), [store]);
  const body = <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  if (!persister) return <QueryClientProvider client={client}>{body}</QueryClientProvider>;
  return (
    <PersistQueryClientProvider client={client} persistOptions={{ persister, maxAge: CACHE_MAX_AGE, buster: CACHE_BUSTER }}>
      {body}
    </PersistQueryClientProvider>
  );
}

export function useScope(): Scope {
  const s = useContext(Ctx);
  if (!s) throw new Error('useScope outside <AccountScope>');
  return s;
}

export const useAccount = () => useScope().account;
export const useApi = () => useScope().api;
export const useRenderer = () => useScope().renderer;
