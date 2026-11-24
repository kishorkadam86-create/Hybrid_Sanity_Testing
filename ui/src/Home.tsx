import { Kpi, StatusBar } from './components';
import { fmtDate, passRate, pct, storeLabel } from './data';
import { RunButton, RunsPanel } from './Run';
import { href } from './router';
import type { Index } from './types';

export function Home({ index }: { index: Index }) {
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">Sanity test dashboard</p>
          <h1>Storefront quality at a glance</h1>
          <p className="lede">
            Results from the hybrid sanity suites (Playwright scripts plus an AI layer) on the <b>staging</b> environments, covering desktop web,
            Android and iOS mobile web in English and Arabic stores. Start a new run for a whole project or a single website.
          </p>
        </div>
      </section>

      <div className="project-grid">
        {index.projects.map((p) => {
          const executed = p.totals.Pass + p.totals.Fail + p.totals.Blocked;
          return (
            <article key={p.id} className={`project-card pc-${p.id}`}>
              <div className="pc-head">
                <div>
                  <p className="eyebrow">{p.tagline}</p>
                  <h2><a className="pc-title" href={href([p.id])}>{p.name}</a></h2>
                </div>
                <a className="pc-arrow" href={href([p.id])} aria-label={`Open ${p.name}`}>→</a>
              </div>
              <p className="pc-desc">{p.description}</p>
              <div className="chips">
                {p.websites.map((w) => (
                  <span key={w.key} className="chip">{w.name}</span>
                ))}
              </div>
              <div className="kpi-row">
                <Kpi label="Test cases" value={p.totals.cases.toLocaleString()} hint={`${p.stores.length} stores`} />
                <Kpi label="Pass rate" value={pct(passRate(p.totals))} hint={`${executed.toLocaleString()} executed`} tone="pass" />
                <Kpi label="Failed runs" value={p.totals.Fail} tone={p.totals.Fail ? 'fail' : undefined} />
                <Kpi label="Open defects" value={p.openDefects} tone={p.openDefects ? 'fail' : undefined} />
              </div>
              <StatusBar totals={p.totals} height={12} legend />
              <ul className="store-mini">
                {p.stores.map((s) => (
                  <li key={s.key}>
                    <span>{storeLabel(s)}</span>
                    <StatusBar totals={s.totals} height={6} />
                  </li>
                ))}
              </ul>
              <div className="pc-actions">
                <span className="pc-foot">Last run {fmtDate(p.lastRun)}</span>
                <span className="pc-buttons">
                  <a className="btn" href={href([p.id])}>Open project</a>
                  <RunButton project={p} stores={p.stores} />
                </span>
              </div>
              <RunsPanel project={p} limit={3} />
            </article>
          );
        })}
      </div>
    </>
  );
}
