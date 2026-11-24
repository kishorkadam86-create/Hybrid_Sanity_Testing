// npm run ui:data  ->  ui/public/data/{index,binsina,fashion}.json
// Snapshot of the store workbooks for the dashboard UI (read-only; no credentials: steps keep ${env.*} placeholders).
// Two projects:
//   binsina  BinSina (English + Arabic) and Holland & Barrett (English)
//   fashion  Petit Bateau UAE / KSA, Nanan (English + Arabic) and Superdry (English)
// Rerun after every test run, then rebuild / redeploy the UI.
import fs from 'node:fs';
import path from 'node:path';
import { isScriptedFor } from '../plan-file';
import { ROOT, relToRoot } from '../paths';
import { loadAllStores, type StoreData } from '../report-data';
import { isProductionUrl } from '../guard';
import { PROJECT_SITES, SITES, storeFile, storesOf } from '../sites';

/** Website key (pbae, nanan, ...) used by the run button / runner, from the workbook file name. */
const runKeyOf = (file: string) => SITES.find((s) => storesOf(s).some((st) => storeFile(s, st) === file))?.key ?? '';

const OUT = path.join(ROOT, 'ui', 'public', 'data');

const PROJECTS = [
  {
    id: 'binsina',
    name: 'BinSina',
    tagline: 'Pharmacy & health',
    description: 'BinSina Pharmacy UAE (English + Arabic) and Holland & Barrett UAE (English)',
    sites: PROJECT_SITES.binsina,
  },
  {
    id: 'fashion',
    name: 'Fashion',
    tagline: 'Fashion & kidswear',
    description: 'Petit Bateau UAE, Petit Bateau KSA, Nanan UAE (English + Arabic) and Superdry UAE (English)',
    sites: PROJECT_SITES.fashion,
  },
];

const STATUSES = ['Pass', 'Fail', 'Blocked', 'AI Pending'];

function storeJson(s: StoreData) {
  // Latest result per case + platform.
  const latest = new Map<string, StoreData['runs'][number]>();
  for (const r of s.runs) {
    const k = `${r.tcId}|${r.platform}`;
    const prev = latest.get(k);
    if (!prev || (r.date || '') >= (prev.date || '')) latest.set(k, r);
  }
  const cases = s.cases.map((c) => ({
    id: c.id,
    section: c.section,
    scenario: c.scenario,
    type: c.type,
    priority: c.priority,
    mode: c.mode,
    platforms: c.platforms,
    scriptedOn: c.platforms.filter((p) => isScriptedFor(c, p)),
    preCondition: c.preCondition,
    steps: c.steps,
    testData: c.testData,
    expected: c.expected,
    results: Object.fromEntries(
      c.platforms.map((p) => {
        const r = latest.get(`${c.id}|${p}`);
        return [p, r ? { status: r.status, actual: r.actual, date: r.date, defectId: r.defectId, via: r.executedVia } : { status: 'Not run' }];
      }),
    ),
  }));
  const runs = cases.flatMap((c) => Object.values(c.results));
  const count = (st: string) => runs.filter((r) => r.status === st).length;
  const dates = s.runs.map((r) => r.date).filter(Boolean).sort();
  return {
    key: s.file.replace(/\.xlsx$/i, ''),
    runKey: runKeyOf(s.file),
    site: s.site,
    store: s.store,
    url: s.url,
    workbook: s.file,
    lastRun: dates[dates.length - 1] || null,
    totals: {
      cases: cases.length,
      runs: runs.length,
      ...Object.fromEntries(STATUSES.map((st) => [st, count(st)])),
      'Not run': count('Not run'),
      scripted: cases.reduce((a, c) => a + c.scriptedOn.length, 0),
    },
    cases,
    defects: s.defects.map((d) => ({
      id: d['Defect ID'], tcId: d['Test Case ID'], platform: d['Platform'], title: d['Title'], severity: d['Severity'],
      status: d['Status'], steps: d['Steps to Reproduce'], expected: d['Expected Result'], actual: d['Actual Result'], date: d['Date Found'],
    })),
  };
}

async function main() {
  const stores = await loadAllStores();
  // The UI is public: refuse to publish anything that points at a production storefront.
  for (const s of stores) {
    if (isProductionUrl(s.url)) throw new Error(`${s.file}: Base URL is a production host (${s.url}). Run "npm run env:staging" first.`);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const generatedAt = new Date().toISOString();
  const index = [];
  for (const p of PROJECTS) {
    const picked = stores.filter((s) => p.sites.includes(runKeyOf(s.file))).map(storeJson);
    if (!picked.length) throw new Error(`No workbooks for project "${p.name}"`);
    const sum = (k: string) => picked.reduce((a, s) => a + ((s.totals as Record<string, number>)[k] || 0), 0);
    const totals = Object.fromEntries(['cases', 'runs', 'scripted', ...STATUSES, 'Not run'].map((k) => [k, sum(k)]));
    const openDefects = picked.reduce((a, s) => a + s.defects.filter((d) => !/retest passed|closed|fixed/i.test(d.status || '')).length, 0);
    const lastRun = picked.map((s) => s.lastRun).filter(Boolean).sort().pop() || null;
    const { sites: siteKeys, ...meta } = p;
    // Websites that can be run on their own (each covers all of its stores).
    const websites = siteKeys.map((k) => SITES.find((s) => s.key === k)!).map((s) => ({
      key: s.key,
      name: s.name,
      stores: storesOf(s).map((st) => (st === 'ar' ? 'Arabic' : 'English')),
    }));
    fs.writeFileSync(path.join(OUT, `${p.id}.json`), JSON.stringify({ ...meta, websites, generatedAt, lastRun, totals, openDefects, stores: picked }));
    index.push({ ...meta, websites, lastRun, totals, openDefects, stores: picked.map((s) => ({ key: s.key, runKey: s.runKey, site: s.site, store: s.store, url: s.url, totals: s.totals })) });
    console.log(`[ui:data] ${p.name.padEnd(8)} ${picked.length} stores, ${totals.cases} cases, ${totals.runs} runs (Pass ${totals.Pass}, Fail ${totals.Fail}), open defects ${openDefects}`);
  }
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ generatedAt, environment: 'Staging', projects: index }, null, 2));
  console.log(`[ui:data] wrote ${relToRoot(OUT)}/`);
}

main().catch((e) => {
  console.error(`[ui:data] ${e.message ?? e}`);
  process.exit(1);
});
