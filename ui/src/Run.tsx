// "Run sanity tests" dialog + recent runs panel.
// The dashboard is static; runs execute in GitHub Actions (staging only), started through /api/run.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fmtDateTime } from './data';
import type { ProjectMeta, StoreSummary, Website } from './types';

export interface RunInfo {
  id: number;
  title: string;
  project: string;
  site: string;
  platform: string;
  priority: string;
  status: string;
  conclusion: string | null;
  url: string;
  createdAt: string;
  startedAt: string;
  updatedAt: string;
}

interface RunsState {
  runs: RunInfo[];
  configured: boolean | null;
  error?: string;
  actionsUrl?: string;
  refresh: () => void;
}

const RunsContext = createContext<RunsState>({ runs: [], configured: null, refresh: () => {} });
export const useRuns = () => useContext(RunsContext);

const active = (r: RunInfo) => r.status !== 'completed';

/** Polls /api/runs: every 15 s while a run is active, every 2 min otherwise. */
export function RunsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<RunsState, 'refresh'>>({ runs: [], configured: null });
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let live = true;
    fetch('/api/runs', { cache: 'no-store' })
      .then(async (r) => {
        const isJson = (r.headers.get('content-type') || '').includes('application/json');
        if (r.status === 404 || !isJson) throw new Error('Run service is only available on the deployed dashboard (not in local preview).');
        if (!r.ok) throw new Error(`Run status unavailable (HTTP ${r.status}).`);
        return r.json();
      })
      .then((d) => live && setState({ runs: d.runs ?? [], configured: Boolean(d.configured), actionsUrl: d.actionsUrl }))
      .catch((e: Error) => live && setState((s) => ({ ...s, configured: s.configured ?? false, error: e.message })));
    return () => {
      live = false;
    };
  }, [tick]);
  const anyActive = state.runs.some(active);
  useEffect(() => {
    const t = setTimeout(refresh, anyActive ? 15000 : 120000);
    return () => clearTimeout(t);
  }, [state, anyActive, refresh]);
  return <RunsContext.Provider value={{ ...state, refresh }}>{children}</RunsContext.Provider>;
}

export function RunStatus({ run }: { run: RunInfo }) {
  if (run.status !== 'completed') {
    return <span className="run-status st-aipending"><span className="spinner spinner-sm" /> {run.status === 'queued' || run.status === 'waiting' || run.status === 'pending' ? 'Queued' : 'Running'}</span>;
  }
  const ok = run.conclusion === 'success';
  return <span className={`run-status ${ok ? 'st-pass' : run.conclusion === 'cancelled' ? 'st-notrun' : 'st-fail'}`}>{ok ? 'Finished' : run.conclusion === 'cancelled' ? 'Cancelled' : 'Finished with errors'}</span>;
}

const siteLabel = (websites: Website[], key: string) => (key === 'all' ? 'All websites' : websites.find((w) => w.key === key)?.name ?? key);

export function RunsPanel({ project, limit = 5 }: { project: ProjectMeta; limit?: number }) {
  const { runs, error, actionsUrl, configured } = useRuns();
  const mine = runs.filter((r) => r.project === project.id).slice(0, limit);
  return (
    <section className="card runs-card">
      <header className="card-head">
        <h2>Recent sanity runs</h2>
        {actionsUrl && <a className="small" href={actionsUrl} target="_blank" rel="noreferrer noopener">All runs on GitHub ↗</a>}
      </header>
      {error && configured === false && !mine.length ? (
        <p className="muted small">{error}</p>
      ) : mine.length === 0 ? (
        <p className="muted small">No runs started from the dashboard yet.</p>
      ) : (
        <ul className="run-list">
          {mine.map((r) => (
            <li key={r.id}>
              <RunStatus run={r} />
              <span className="run-what">
                <b>{siteLabel(project.websites, r.site)}</b>
                <span className="muted small"> · {r.platform === 'all' ? 'all platforms' : r.platform} · {r.priority === 'all' ? 'all priorities' : r.priority}</span>
              </span>
              <span className="muted small nowrap">{fmtDateTime(r.createdAt)}</span>
              <a className="small nowrap" href={r.url} target="_blank" rel="noreferrer noopener">Details ↗</a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Rough count of scripted runs for the chosen scope (from the current data snapshot). */
function estimate(stores: StoreSummary[], site: string) {
  const picked = stores.filter((s) => site === 'all' || s.runKey === site);
  return { stores: picked.length, scripted: picked.reduce((a, s) => a + s.totals.scripted, 0) };
}

const PASS_KEY = 'run-passcode';

export function RunDialog({ project, stores, initialSite = 'all', onClose }: { project: ProjectMeta; stores: StoreSummary[]; initialSite?: string; onClose: () => void }) {
  const { refresh, runs } = useRuns();
  const [site, setSite] = useState(initialSite);
  const [platform, setPlatform] = useState('all');
  const [priority, setPriority] = useState('all');
  const [passcode, setPasscode] = useState(() => {
    try {
      return sessionStorage.getItem(PASS_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [state, setState] = useState<{ busy?: boolean; error?: string; done?: string; url?: string }>({});
  const est = useMemo(() => estimate(stores, site), [stores, site]);
  const busyRun = runs.find((r) => r.status !== 'completed');

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setState({ busy: true });
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ project: project.id, site, platform, priority, passcode }),
      });
      const isJson = (res.headers.get('content-type') || '').includes('application/json');
      const data = isJson ? await res.json().catch(() => ({})) : {};
      if (!isJson || res.status === 404) throw new Error('The run service is only available on the deployed dashboard.');
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      try {
        sessionStorage.setItem(PASS_KEY, passcode);
      } catch {
        /* storage unavailable */
      }
      setState({ done: data.message, url: data.actionsUrl });
      setTimeout(refresh, 4000);
    } catch (err) {
      setState({ error: (err as Error).message });
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="run-title" onClick={(e) => e.stopPropagation()} onSubmit={start}>
        <header className="modal-head">
          <div>
            <p className="eyebrow">{project.name}</p>
            <h2 id="run-title">Run sanity tests</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>

        {state.done ? (
          <div className="modal-body">
            <div className="notice notice-ok">
              <b>{state.done}.</b> It runs on the staging sites in GitHub Actions. When it finishes, the results are written to the
              workbooks and this dashboard is refreshed automatically.
            </div>
            <p className="small muted">A full project run can take up to an hour; a single website about 10 to 20 minutes.</p>
            <div className="modal-actions">
              {state.url && <a className="btn" href={state.url} target="_blank" rel="noreferrer noopener">Watch progress on GitHub ↗</a>}
              <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <div className="modal-body">
            <fieldset className="choice">
              <legend>What to run</legend>
              <label className={`option${site === 'all' ? ' on' : ''}`}>
                <input type="radio" name="site" value="all" checked={site === 'all'} onChange={() => setSite('all')} />
                <span>
                  <b>All {project.websites.length} {project.name} websites</b>
                  <small>{project.websites.map((w) => w.name).join(', ')}</small>
                </span>
              </label>
              {project.websites.map((w) => (
                <label key={w.key} className={`option${site === w.key ? ' on' : ''}`}>
                  <input type="radio" name="site" value={w.key} checked={site === w.key} onChange={() => setSite(w.key)} />
                  <span>
                    <b>{w.name}</b>
                    <small>{w.stores.join(' + ')} store{w.stores.length > 1 ? 's' : ''}</small>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="row-2">
              <label className="select">
                <span>Platforms</span>
                <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                  <option value="all">All (Web, Android, iOS)</option>
                  <option value="Web">Web only</option>
                  <option value="Mobile">Mobile web (Android + iOS)</option>
                  <option value="Android">Android only</option>
                  <option value="iOS">iOS only</option>
                </select>
              </label>
              <label className="select">
                <span>Priority</span>
                <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="all">All priorities</option>
                  <option value="P1">P1 only (fastest)</option>
                  <option value="P2">P2 only</option>
                  <option value="P3">P3 only</option>
                </select>
              </label>
            </div>

            <p className="small muted">
              {est.stores} store{est.stores === 1 ? '' : 's'} · about {est.scripted.toLocaleString()} scripted runs at full scope (fewer with filters).
              Only scripted cases run automatically; the rest stay in the AI / manual queue. Staging only.
            </p>

            <label className="select">
              <span>Run passcode</span>
              <input className="text-input" type="password" autoComplete="off" required value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="Passcode from your QA lead" />
            </label>

            {busyRun && <div className="notice">A run is already in progress ({busyRun.title.replace(/^Sanity · /, '')}). A new run waits until it finishes.</div>}
            {state.error && <div className="notice notice-err" role="alert">{state.error}</div>}

            <div className="modal-actions">
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={state.busy || !passcode}>
                {state.busy ? 'Starting…' : `Run ${siteLabel(project.websites, site).replace('All websites', `all ${project.name} websites`)}`}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

/** Button that opens the dialog. */
export function RunButton({ project, stores, site = 'all', label, small }: { project: ProjectMeta; stores: StoreSummary[]; site?: string; label?: string; small?: boolean }) {
  const [open, setOpen] = useState(false);
  const { runs } = useRuns();
  const running = runs.some((r) => r.status !== 'completed' && r.project === project.id && (site === 'all' || r.site === site || r.site === 'all'));
  return (
    <>
      <button
        type="button"
        className={`btn ${small ? 'btn-sm' : 'btn-primary'}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {running ? <span className="spinner spinner-sm" /> : <span aria-hidden="true">▶</span>} {label ?? 'Run sanity tests'}
      </button>
      {open && <RunDialog project={project} stores={stores} initialSite={site} onClose={() => setOpen(false)} />}
    </>
  );
}
