import { useEffect, useState, type ReactNode } from 'react';
import { statusClass } from './data';
import { STATUSES, type Status, type Totals } from './types';

export function Pill({ status, small }: { status: Status | string; small?: boolean }) {
  return <span className={`pill ${statusClass(status)}${small ? ' pill-sm' : ''}`}>{status}</span>;
}

export function Tag({ children, tone }: { children: ReactNode; tone?: 'neg' | 'p1' | 'muted' }) {
  return <span className={`tag${tone ? ` tag-${tone}` : ''}`}>{children}</span>;
}

/** Stacked bar of run statuses with an accessible text summary. */
export function StatusBar({ totals, height = 10, legend = false }: { totals: Totals; height?: number; legend?: boolean }) {
  const total = STATUSES.reduce((a, s) => a + (totals[s] || 0), 0) || 1;
  const label = STATUSES.map((s) => `${s} ${totals[s] || 0}`).join(', ');
  return (
    <div>
      <div className="sbar" style={{ height }} role="img" aria-label={label} title={label}>
        {STATUSES.map((s) =>
          totals[s] ? <span key={s} className={`seg ${statusClass(s)}`} style={{ width: `${(totals[s] / total) * 100}%` }} /> : null,
        )}
      </div>
      {legend && (
        <div className="legend">
          {STATUSES.map((s) => (
            <span key={s} className="legend-item">
              <i className={`dot ${statusClass(s)}`} />
              {s} <b>{(totals[s] || 0).toLocaleString()}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: string }) {
  return (
    <div className={`kpi${tone ? ` kpi-${tone}` : ''}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card${className ? ` ${className}` : ''}`}>
      {(title || actions) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Loading() {
  return (
    <div className="loading" aria-busy="true">
      <div className="spinner" /> Loading…
    </div>
  );
}

type Theme = 'light' | 'dark';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(() => {
    try {
      return (localStorage.getItem('theme') as Theme) || null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    try {
      if (theme) localStorage.setItem('theme', theme);
      else localStorage.removeItem('theme');
    } catch {
      /* storage unavailable */
    }
  }, [theme]);
  const dark = theme ? theme === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return (
    <button className="icon-btn" onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`} title="Toggle theme">
      {dark ? (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="currentColor" /><g stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></g></svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor" /></svg>
      )}
    </button>
  );
}

/** A bar per row (label + stacked statuses + counts). */
export function BreakdownTable({ rows, first }: { rows: Array<{ label: ReactNode; totals: Totals; extra?: ReactNode }>; first: string }) {
  return (
    <div className="table-wrap">
      <table className="tbl breakdown">
        <thead>
          <tr>
            <th>{first}</th>
            <th className="w-bar">Status</th>
            <th className="num">Pass</th>
            <th className="num">Fail</th>
            <th className="num">Blocked</th>
            <th className="num">AI pending</th>
            <th className="num">Not run</th>
            <th className="num">Runs</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.label}{r.extra}</td>
              <td className="w-bar"><StatusBar totals={r.totals} /></td>
              <td className="num c-pass">{r.totals.Pass}</td>
              <td className="num c-fail">{r.totals.Fail}</td>
              <td className="num c-blocked">{r.totals.Blocked}</td>
              <td className="num c-ai">{r.totals['AI Pending']}</td>
              <td className="num muted">{r.totals['Not run']}</td>
              <td className="num">{r.totals.runs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
