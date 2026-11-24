import { useEffect, useState } from 'react';
import type { Index, Project, Status, Totals } from './types';

const cache = new Map<string, Promise<unknown>>();

function load<T>(url: string): Promise<T> {
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url, { cache: 'no-cache' }).then((r) => {
        if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
        return r.json();
      }),
    );
  }
  return cache.get(url) as Promise<T>;
}

export function useData<T>(url: string): { data?: T; error?: string } {
  const [state, setState] = useState<{ data?: T; error?: string }>({});
  useEffect(() => {
    let live = true;
    setState({});
    load<T>(url)
      .then((data) => live && setState({ data }))
      .catch((e: Error) => live && setState({ error: e.message }));
    return () => {
      live = false;
    };
  }, [url]);
  return state;
}

export const useIndex = () => useData<Index>('/data/index.json');
export const useProject = (id: string) => useData<Project>(`/data/${id}.json`);

/** Pass rate of executed checks: Pass / (Pass + Fail). */
export function passRate(t: Pick<Totals, 'Pass' | 'Fail'>): number | null {
  const n = t.Pass + t.Fail;
  return n ? t.Pass / n : null;
}

export const pct = (v: number | null, digits = 0) => (v === null ? '–' : `${(v * 100).toFixed(digits)}%`);

export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return '–';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export const fmtDateTime = (iso: string | null | undefined) => {
  if (!iso) return '–';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const statusClass = (s: Status | string) => `st-${String(s).toLowerCase().replace(/[^a-z]/g, '')}`;

export function addTotals(list: Totals[]): Totals {
  const out: Totals = { cases: 0, runs: 0, scripted: 0, Pass: 0, Fail: 0, Blocked: 0, 'AI Pending': 0, 'Not run': 0 };
  for (const t of list) for (const k of Object.keys(out) as (keyof Totals)[]) out[k] += t[k] || 0;
  return out;
}

export const storeLabel = (s: { site: string; store: string }) => `${s.site} · ${s.store === 'Arabic' ? 'AR' : 'EN'}`;
export const isOpenDefect = (status: string) => !/retest passed|closed|fixed/i.test(status || '');
export const sevRank = (s: string) => ({ Critical: 0, High: 1, Medium: 2, Low: 3 })[s as 'High'] ?? 9;
export const prioRank = (p: string) => ({ P1: 1, P2: 2, P3: 3 })[p as 'P1'] ?? 9;
export const STATUS_ORDER: Record<Status, number> = { Fail: 0, Blocked: 1, 'AI Pending': 2, 'Not run': 3, Pass: 4 };
