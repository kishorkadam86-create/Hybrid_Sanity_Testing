import { useEffect, useState } from 'react';

export interface Route {
  path: string[];
  params: URLSearchParams;
}

function parse(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [p, q = ''] = raw.split('?');
  return { path: p.split('/').filter(Boolean), params: new URLSearchParams(q) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

/** Build a hash href; empty / "all" params are dropped. */
export function href(path: string[], params?: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v && v !== 'all') q.set(k, v);
  const qs = q.toString();
  return `#/${path.join('/')}${qs ? `?${qs}` : ''}`;
}

export function go(path: string[], params?: Record<string, string | undefined>, replace = false) {
  const h = href(path, params);
  if (replace) history.replaceState(null, '', h), window.dispatchEvent(new HashChangeEvent('hashchange'));
  else window.location.hash = h;
}
