import { Kpi, StatusBar } from './components';
import { fmtDate, passRate, pct, storeLabel } from './data';
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
            Android and iOS mobile web in English and Arabic stores.
          </p>
        </div>
      </section>

      <div className="project-grid">
        {index.projects.map((p) => {
          const executed = p.totals.Pass + p.totals.Fail + p.totals.Blocked;
          const sites = [...new Set(p.stores.map((s) => s.site))];
          return (
            <a key={p.id} className={`project-card pc-${p.id}`} href={href([p.id])}>
              <div className="pc-head">
                <div>
                  <p className="eyebrow">{p.tagline}</p>
                  <h2>{p.name}</h2>
                </div>
                <span className="pc-arrow" aria-hidden="true">→</span>
              </div>
              <p className="pc-desc">{p.description}</p>
              <div className="chips">
                {sites.map((s) => (
                  <span key={s} className="chip">{s}</span>
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
              <p className="pc-foot">Last run {fmtDate(p.lastRun)}</p>
            </a>
          );
        })}
      </div>
    </>
  );
}
