import { useEffect, useMemo, useState } from 'react';
import { BreakdownTable, Card, Empty, Kpi, Pill, StatusBar, Tag } from './components';
import { STATUS_ORDER, addTotals, fmtDate, isOpenDefect, passRate, pct, prioRank, sevRank, storeLabel } from './data';
import { go, href, type Route } from './router';
import { RunButton, RunsPanel } from './Run';
import { STATUSES, type Project, type Status, type Store, type TestCase, type Totals } from './types';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'cases', label: 'Test cases' },
  { id: 'defects', label: 'Defects' },
  { id: 'queue', label: 'Pending (AI / manual)' },
] as const;

type Row = { store: Store; tc: TestCase };

function totalsOf(cases: TestCase[], platform?: string): Totals {
  const t: Totals = { cases: cases.length, runs: 0, scripted: 0, Pass: 0, Fail: 0, Blocked: 0, 'AI Pending': 0, 'Not run': 0 };
  for (const c of cases) {
    for (const p of c.platforms) {
      if (platform && p !== platform) continue;
      t.runs++;
      if (c.scriptedOn.includes(p)) t.scripted++;
      t[(c.results[p]?.status as Status) ?? 'Not run']++;
    }
  }
  return t;
}

/** Worst status across platforms (Fail > Blocked > AI Pending > Not run > Pass). */
const rolled = (tc: TestCase): Status =>
  (Object.values(tc.results).map((r) => r.status) as Status[]).sort((a, b) => STATUS_ORDER[a] - STATUS_ORDER[b])[0] ?? 'Not run';

export function ProjectPage({ project, route }: { project: Project; route: Route }) {
  const tab = (route.params.get('tab') as (typeof TABS)[number]['id']) || 'overview';
  const storeKey = route.params.get('store') || 'all';
  const stores = storeKey === 'all' ? project.stores : project.stores.filter((s) => s.key === storeKey);
  const setParam = (k: string, v: string | undefined) => {
    const p = Object.fromEntries(route.params.entries());
    go([project.id], { ...p, [k]: v }, true);
  };

  const totals = addTotals(stores.map((s) => s.totals));
  const defects = stores.flatMap((s) => s.defects.map((d) => ({ ...d, store: s })));
  const openDefects = defects.filter((d) => isOpenDefect(d.status));

  return (
    <>
      <nav className="crumbs" aria-label="Breadcrumb">
        <a href={href([])}>Projects</a>
        <span aria-hidden="true">/</span>
        <span>{project.name}</span>
      </nav>
      <header className="page-head">
        <div>
          <p className="eyebrow">{project.tagline}</p>
          <h1>{project.name}</h1>
          <p className="lede">{project.description}</p>
        </div>
        <div className="page-meta">
          <span className="env-badge">Staging</span>
          <span className="muted">Last run {fmtDate(project.lastRun)}</span>
          <RunButton project={project} stores={project.stores} />
        </div>
      </header>

      <div className="store-tabs" role="tablist" aria-label="Store">
        <button role="tab" aria-selected={storeKey === 'all'} className={storeKey === 'all' ? 'on' : ''} onClick={() => setParam('store', undefined)}>
          All stores <span className="count">{project.stores.length}</span>
        </button>
        {project.stores.map((s) => (
          <button key={s.key} role="tab" aria-selected={storeKey === s.key} className={storeKey === s.key ? 'on' : ''} onClick={() => setParam('store', s.key)}>
            {storeLabel(s)}
          </button>
        ))}
      </div>

      <div className="tabs" role="tablist" aria-label="View">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setParam('tab', t.id === 'overview' ? undefined : t.id)}>
            {t.label}
            {t.id === 'defects' && openDefects.length > 0 && <span className="count count-fail">{openDefects.length}</span>}
            {t.id === 'queue' && <span className="count">{totals['AI Pending'].toLocaleString()}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview project={project} stores={stores} totals={totals} openDefects={openDefects.length} onStore={(k) => setParam('store', k)} />}
      {tab === 'cases' && <Cases stores={stores} route={route} setParam={setParam} />}
      {tab === 'defects' && <Defects defects={defects} />}
      {tab === 'queue' && <Queue stores={stores} />}
    </>
  );
}

// ------------------------------------------------------------------ Overview
function Overview({ project, stores, totals, openDefects, onStore }: { project: Project; stores: Store[]; totals: Totals; openDefects: number; onStore: (key: string) => void }) {
  const cases = stores.flatMap((s) => s.cases);
  const platforms = [...new Set(cases.flatMap((c) => c.platforms))];
  const sections = [...new Set(cases.map((c) => c.section || '(none)'))].sort();
  const executed = totals.Pass + totals.Fail + totals.Blocked;
  const p1 = cases.filter((c) => c.priority === 'P1');
  const p1Fails = p1.flatMap((c) => Object.values(c.results)).filter((r) => r.status === 'Fail').length;

  return (
    <div className="stack">
      <div className="kpi-grid">
        <Kpi label="Test cases" value={totals.cases.toLocaleString()} hint={`${stores.length} store${stores.length > 1 ? 's' : ''}`} />
        <Kpi label="Planned runs" value={totals.runs.toLocaleString()} hint="case × platform" />
        <Kpi label="Executed" value={executed.toLocaleString()} hint={`of ${totals.runs.toLocaleString()} planned`} />
        <Kpi label="Pass rate" value={pct(passRate(totals), 1)} hint="Pass ÷ (Pass + Fail)" tone="pass" />
        <Kpi label="Failed runs" value={totals.Fail} hint={`${p1Fails} on P1 cases`} tone={totals.Fail ? 'fail' : undefined} />
        <Kpi label="Open defects" value={openDefects} tone={openDefects ? 'fail' : undefined} />
        <Kpi label="AI / manual pending" value={totals['AI Pending'].toLocaleString()} hint="not scripted yet" tone="ai" />
      </div>

      <Card title="Run status">
        <StatusBar totals={totals} height={14} legend />
      </Card>

      <RunsPanel project={project} />

      <div className="stack">
        <Card title="By store">
          <BreakdownTable
            first="Store"
            rows={stores.map((s) => ({
              label: (
                <button className="link-btn store-link" onClick={() => onStore(s.key)}>
                  {storeLabel(s)}
                </button>
              ),
              extra: (
                <div className="sub">
                  <a href={s.url} target="_blank" rel="noreferrer noopener">{s.url.replace(/^https:\/\//, '')}</a>
                  <div className="row-run">
                    <RunButton project={project} stores={project.stores} site={s.runKey} small
                      label={`Run ${project.websites.find((w) => w.key === s.runKey)?.name ?? 'website'}`} />
                  </div>
                </div>
              ),
              totals: s.totals,
            }))}
          />
        </Card>
        <Card title="By platform">
          <BreakdownTable first="Platform" rows={platforms.map((p) => ({ label: p, totals: totalsOf(cases, p) }))} />
        </Card>
      </div>

      <Card title="By section">
        <BreakdownTable first="Section" rows={sections.map((sec) => ({ label: sec, totals: totalsOf(cases.filter((c) => (c.section || '(none)') === sec)) }))} />
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ Test cases
function Cases({ stores, route, setParam }: { stores: Store[]; route: Route; setParam: (k: string, v: string | undefined) => void }) {
  const q = route.params.get('q') || '';
  const status = route.params.get('status') || 'all';
  const prio = route.params.get('prio') || 'all';
  const type = route.params.get('type') || 'all';
  const section = route.params.get('section') || 'all';
  const platform = route.params.get('platform') || 'all';
  const open = route.params.get('case');
  const [query, setQuery] = useState(q);
  useEffect(() => setQuery(q), [q]);
  useEffect(() => {
    const t = setTimeout(() => query !== q && setParam('q', query || undefined), 250);
    return () => clearTimeout(t);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const all: Row[] = useMemo(() => stores.flatMap((store) => store.cases.map((tc) => ({ store, tc }))), [stores]);
  const sections = useMemo(() => [...new Set(all.map((r) => r.tc.section))].sort(), [all]);
  const platforms = useMemo(() => [...new Set(all.flatMap((r) => r.tc.platforms))], [all]);

  const rows = useMemo(() => {
    const needle = q.toLowerCase();
    return all
      .filter(({ tc }) => {
        if (prio !== 'all' && tc.priority !== prio) return false;
        if (type !== 'all' && tc.type !== type) return false;
        if (section !== 'all' && tc.section !== section) return false;
        if (platform !== 'all' && !tc.platforms.includes(platform)) return false;
        if (status !== 'all') {
          const sts = platform !== 'all' ? [tc.results[platform]?.status] : Object.values(tc.results).map((r) => r.status);
          if (!sts.includes(status as Status)) return false;
        }
        if (needle && !`${tc.id} ${tc.scenario} ${tc.section} ${tc.expected}`.toLowerCase().includes(needle)) return false;
        return true;
      })
      .sort((a, b) => STATUS_ORDER[rolled(a.tc)] - STATUS_ORDER[rolled(b.tc)] || prioRank(a.tc.priority) - prioRank(b.tc.priority) || a.tc.id.localeCompare(b.tc.id));
  }, [all, q, status, prio, type, section, platform]);

  const LIMIT = 300;
  const [limit, setLimit] = useState(LIMIT);
  useEffect(() => setLimit(LIMIT), [q, status, prio, type, section, platform, stores]);
  const selected = open ? all.find((r) => `${r.store.key}:${r.tc.id}` === open) : undefined;
  const anyFilter = q || status !== 'all' || prio !== 'all' || type !== 'all' || section !== 'all' || platform !== 'all';

  return (
    <div className="stack">
      <div className="filters">
        <input className="search" type="search" placeholder="Search ID, scenario, section…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search test cases" />
        <Select label="Status" value={status} onChange={(v) => setParam('status', v)} options={STATUSES} />
        <Select label="Priority" value={prio} onChange={(v) => setParam('prio', v)} options={['P1', 'P2', 'P3']} />
        <Select label="Type" value={type} onChange={(v) => setParam('type', v)} options={['Positive', 'Negative']} />
        <Select label="Section" value={section} onChange={(v) => setParam('section', v)} options={sections} />
        <Select label="Platform" value={platform} onChange={(v) => setParam('platform', v)} options={platforms} />
        {anyFilter && (
          <button className="link-btn" onClick={() => go([route.path[0]], { tab: 'cases', store: route.params.get('store') || undefined }, true)}>
            Clear filters
          </button>
        )}
      </div>
      <p className="muted small">{rows.length.toLocaleString()} of {all.length.toLocaleString()} cases · worst result first</p>

      {rows.length === 0 ? (
        <Empty>No test cases match these filters.</Empty>
      ) : (
        <div className="table-wrap card flush">
          <table className="tbl cases">
            <thead>
              <tr>
                <th>ID</th>
                <th>Scenario</th>
                <th>Store</th>
                <th>Section</th>
                <th>Priority</th>
                <th>Results</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map(({ store, tc }) => (
                <tr key={`${store.key}:${tc.id}`} className="clickable" tabIndex={0}
                  onClick={() => setParam('case', `${store.key}:${tc.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && setParam('case', `${store.key}:${tc.id}`)}>
                  <td className="mono nowrap">{tc.id}</td>
                  <td>
                    {tc.scenario}
                    {tc.type === 'Negative' && <Tag tone="neg">Negative</Tag>}
                  </td>
                  <td className="nowrap">{storeLabel(store)}</td>
                  <td>{tc.section}</td>
                  <td>{tc.priority === 'P1' ? <Tag tone="p1">P1</Tag> : <Tag tone="muted">{tc.priority}</Tag>}</td>
                  <td>
                    <div className="results">
                      {tc.platforms.map((p) => (
                        <span key={p} className="res" title={`${p}: ${tc.results[p]?.status}`}>
                          <span className="res-p">{p.replace(' App', ' app')}</span>
                          <Pill status={tc.results[p]?.status ?? 'Not run'} small />
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > limit && (
            <div className="more">
              <button className="btn" onClick={() => setLimit((l) => l + LIMIT)}>Show {Math.min(LIMIT, rows.length - limit)} more</button>
            </div>
          )}
        </div>
      )}

      {selected && <CaseDrawer row={selected} onClose={() => setParam('case', undefined)} />}
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string | undefined) => void; options: readonly string[] }) {
  return (
    <label className="select">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value === 'all' ? undefined : e.target.value)}>
        <option value="all">All</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function CaseDrawer({ row, onClose }: { row: Row; onClose: () => void }) {
  const { store, tc } = row;
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const lines = (s: string) => s.split(/\r?\n/).filter(Boolean);
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="case-title" onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <p className="eyebrow mono">{tc.id} · {storeLabel(store)}</p>
            <h2 id="case-title">{tc.scenario}</h2>
            <div className="chips">
              <Tag tone={tc.priority === 'P1' ? 'p1' : 'muted'}>{tc.priority}</Tag>
              <Tag tone={tc.type === 'Negative' ? 'neg' : undefined}>{tc.type}</Tag>
              <Tag>{tc.section}</Tag>
              <Tag tone="muted">Mode: {tc.mode}</Tag>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="drawer-body">
          <h3>Results</h3>
          <div className="result-list">
            {tc.platforms.map((p) => {
              const r = tc.results[p];
              return (
                <div key={p} className="result-item">
                  <div className="result-top">
                    <b>{p}</b>
                    <Pill status={r?.status ?? 'Not run'} />
                    <span className="muted small">{tc.scriptedOn.includes(p) ? 'Scripted' : 'AI / manual'}{r?.date ? ` · ${fmtDate(r.date)}` : ''}{r?.defectId ? ` · ${r.defectId}` : ''}</span>
                  </div>
                  {r?.actual && <p className="actual">{r.actual}</p>}
                </div>
              );
            })}
          </div>
          {tc.preCondition && (<><h3>Pre-condition</h3><p>{tc.preCondition}</p></>)}
          <h3>Steps</h3>
          <ol className="steps">{lines(tc.steps).map((l, i) => <li key={i}>{l.replace(/^\d+\.\s*/, '')}</li>)}</ol>
          {tc.testData && (<><h3>Test data</h3><p className="mono pre">{tc.testData}</p></>)}
          <h3>Expected result</h3>
          <p>{tc.expected}</p>
          <p className="muted small">Workbook: {store.workbook}</p>
        </div>
      </aside>
    </div>
  );
}

// ------------------------------------------------------------------ Defects
function Defects({ defects }: { defects: Array<Project['stores'][number]['defects'][number] & { store: Store }> }) {
  const [showClosed, setShowClosed] = useState(false);
  const list = defects.filter((d) => showClosed || isOpenDefect(d.status)).sort((a, b) => sevRank(a.severity) - sevRank(b.severity) || a.store.site.localeCompare(b.store.site));
  const closed = defects.length - defects.filter((d) => isOpenDefect(d.status)).length;
  return (
    <div className="stack">
      <div className="row-between">
        <p className="muted small">{list.length} defect{list.length === 1 ? '' : 's'} shown{closed ? ` · ${closed} retest passed / closed` : ''}</p>
        {closed > 0 && (
          <label className="toggle"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Show retest passed / closed</label>
        )}
      </div>
      {list.length === 0 ? (
        <Empty>No open defects for this selection.</Empty>
      ) : (
        <div className="defect-list">
          {list.map((d) => (
            <article key={`${d.store.key}:${d.id}`} className={`defect sev-${(d.severity || '').toLowerCase()}`}>
              <header>
                <span className={`sev sev-${(d.severity || '').toLowerCase()}`}>{d.severity || '–'}</span>
                <h3>{d.title}</h3>
                <Pill status={isOpenDefect(d.status) ? d.status || 'New' : 'Pass'} small />
              </header>
              <p className="muted small mono">{d.id} · {d.tcId} · {storeLabel(d.store)} · {d.platform} · found {fmtDate(d.date)}</p>
              <details>
                <summary>Details</summary>
                <dl>
                  <dt>Steps to reproduce</dt><dd className="pre">{d.steps}</dd>
                  <dt>Expected</dt><dd>{d.expected}</dd>
                  <dt>Actual</dt><dd>{d.actual}</dd>
                </dl>
              </details>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Pending queue
const REASONS: Array<[RegExp, string]> = [
  [/No keyword steps/i, 'Not scripted yet (no keyword steps)'],
  [/Execution Mode is AI/i, 'AI-only case (orders, payments, judgement)'],
  [/native app|manual \/ device/i, 'Native app (manual / device)'],
  [/Text check/i, 'Arabic wording to confirm'],
  [/CAPTCHA/i, 'CAPTCHA shown (needs a person)'],
  [/could not complete|stale locator/i, 'Script step could not complete'],
];
const reasonOf = (actual = '') => REASONS.find(([re]) => re.test(actual))?.[1] ?? 'Other';

function Queue({ stores }: { stores: Store[] }) {
  const items = stores.flatMap((s) =>
    s.cases.flatMap((tc) => Object.entries(tc.results).filter(([, r]) => r.status === 'AI Pending').map(([p, r]) => ({ s, tc, p, reason: reasonOf(r.actual) }))),
  );
  const groups = [...new Set(items.map((i) => i.reason))].map((reason) => ({ reason, items: items.filter((i) => i.reason === reason) })).sort((a, b) => b.items.length - a.items.length);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  if (!items.length) return <Empty>Nothing is waiting for the AI layer.</Empty>;
  return (
    <div className="stack">
      <p className="muted small">
        Runs the scripts could not cover. They are executed by the AI layer (Claude + Playwright MCP) or a tester, then recorded in the workbooks.
        Pick a group to see its runs.
      </p>
      <div className="queue-grid">
        {groups.map((g) => (
          <button key={g.reason} className={`queue-card${openGroup === g.reason ? ' on' : ''}`} onClick={() => setOpenGroup(openGroup === g.reason ? null : g.reason)}>
            <span className="q-count">{g.items.length.toLocaleString()}</span>
            <span className="q-label">{g.reason}</span>
          </button>
        ))}
      </div>
      {openGroup && (
        <div className="table-wrap card flush">
          <table className="tbl">
            <thead><tr><th>ID</th><th>Scenario</th><th>Store</th><th>Platform</th><th>Priority</th></tr></thead>
            <tbody>
              {groups.find((g) => g.reason === openGroup)!.items
                .sort((a, b) => prioRank(a.tc.priority) - prioRank(b.tc.priority) || a.tc.id.localeCompare(b.tc.id))
                .slice(0, 500)
                .map((i) => (
                  <tr key={`${i.s.key}:${i.tc.id}:${i.p}`}>
                    <td className="mono nowrap">{i.tc.id}</td>
                    <td>{i.tc.scenario}</td>
                    <td className="nowrap">{storeLabel(i.s)}</td>
                    <td>{i.p}</td>
                    <td>{i.tc.priority === 'P1' ? <Tag tone="p1">P1</Tag> : <Tag tone="muted">{i.tc.priority}</Tag>}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
