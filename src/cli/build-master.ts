// npm run master  ->  docs/Hybrid_QA_Master_TestCases.xlsx
// One consolidated, read-only view of every test case in the store workbooks (workbooks/*.xlsx):
//   Overview      one row per site + store: staging URL, case counts, priorities, runs, scripted vs AI
//   All Test Cases every case with its site, store, platforms and whether it is scripted on each platform
//   By Section    case counts per section and store
// The store workbooks stay the source of truth (execution writes there); rerun this after editing them.
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { buildPlan, readConfig } from '../plan';
import { isScriptedFor } from '../plan-file';
import { ROOT, WORKBOOKS_DIR, relToRoot } from '../paths';
import { openWorkbook, styleHeader, today } from '../workbook';
import type { TestCase } from '../types';

const OUT = path.join(ROOT, 'docs', 'Hybrid_QA_Master_TestCases.xlsx');
const SOFT = 'FFE8EEF8';

interface Store {
  site: string;
  store: string;
  file: string;
  url: string;
  cases: TestCase[];
}

const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

async function main() {
  const files = fs.readdirSync(WORKBOOKS_DIR).filter((f) => /\.xlsx$/i.test(f) && !f.startsWith('~$') && !f.includes('.results-')).sort();
  if (!files.length) throw new Error('No workbooks in workbooks/. Run "npm run build:sites" first.');

  const stores: Store[] = [];
  for (const f of files) {
    const file = path.join(WORKBOOKS_DIR, f);
    const cfg = readConfig(await openWorkbook(file));
    const plan = await buildPlan(file, { platform: 'Everything' });
    stores.push({
      site: (cfg.get('site') || f.replace(/_Sanity\.xlsx$/i, '')).replace(/\s*\(Arabic\)$/, ''),
      store: cfg.get('store') || (/_AR_/i.test(f) ? 'Arabic' : 'English'),
      file: f,
      url: cfg.get('baseurl') || plan.cases[0]?.baseUrl || '',
      cases: plan.cases,
    });
  }
  // Site order, English before Arabic.
  stores.sort((a, b) => a.site.localeCompare(b.site) || (a.store === 'English' ? -1 : 1));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Hybrid QA Automation';
  wb.created = new Date();

  // ---------------- Overview ----------------
  const ov = wb.addWorksheet('Overview', { properties: { tabColor: { argb: 'FF305496' } } });
  const ovHead = ['Site', 'Store', 'Staging URL', 'Workbook', 'Cases', 'Positive', 'Negative', 'P1', 'P2', 'P3', 'Platforms', 'Runs (case x platform)', 'Scripted runs', 'AI / manual runs', 'Scripted %'];
  ov.addRow(ovHead);
  styleHeader(ov, [24, 9, 46, 32, 8, 9, 9, 6, 6, 6, 34, 12, 10, 11, 10]);
  for (const s of stores) {
    const runs = s.cases.flatMap((c) => c.platforms.map((p) => isScriptedFor(c, p)));
    const scripted = runs.filter(Boolean).length;
    const cnt = (k: keyof TestCase, v: string) => s.cases.filter((c) => String(c[k]).toLowerCase() === v.toLowerCase()).length;
    const platforms = [...new Set(s.cases.flatMap((c) => c.platforms))].join(', ');
    const row = ov.addRow([s.site, s.store, s.url, s.file, s.cases.length, cnt('type', 'Positive'), cnt('type', 'Negative'), cnt('priority', 'P1'), cnt('priority', 'P2'), cnt('priority', 'P3'), platforms, runs.length, scripted, runs.length - scripted, runs.length ? scripted / runs.length : 0]);
    row.getCell(15).numFmt = '0%';
    row.alignment = { vertical: 'top', wrapText: true };
  }
  const last = ov.rowCount;
  const total = ov.addRow(['Total', '', '', `${stores.length} workbooks`, ...['E', 'F', 'G', 'H', 'I', 'J'].map((c) => ({ formula: `SUM(${c}2:${c}${last})` })), '', ...['L', 'M', 'N'].map((c) => ({ formula: `SUM(${c}2:${c}${last})` })), { formula: `IF(L${last + 1}=0,0,M${last + 1}/L${last + 1})` }]);
  total.font = { bold: true };
  total.eachCell((c) => (c.fill = fill(SOFT)));
  total.getCell(15).numFmt = '0%';
  ov.addRow([]);
  ov.addRow([`Generated ${today()} from workbooks/ by "npm run master". All URLs are staging; production is never tested. The store workbooks are the source of truth for execution and results.`]).font = { italic: true, color: { argb: 'FF5B6475' } };
  ov.autoFilter = { from: { row: 1, column: 1 }, to: { row: last, column: ovHead.length } };

  // ---------------- All Test Cases ----------------
  const all = wb.addWorksheet('All Test Cases');
  const head = ['Site', 'Store', 'Test Case ID', 'Section', 'Test Scenario', 'Test Type', 'Priority', 'Platforms', 'Scripted on', 'AI / manual on', 'Execution Mode', 'Pre-Condition', 'Test Steps', 'Test Data', 'Expected Result', 'Workbook'];
  all.addRow(head);
  styleHeader(all, [22, 9, 15, 13, 42, 10, 8, 26, 22, 22, 10, 28, 46, 24, 46, 30]);
  for (const s of stores) {
    for (const c of s.cases) {
      const scriptedOn = c.platforms.filter((p) => isScriptedFor(c, p));
      const row = all.addRow([
        s.site, s.store, c.id, c.section, c.scenario, c.type, c.priority, c.platforms.join(', '),
        scriptedOn.join(', '), c.platforms.filter((p) => !scriptedOn.includes(p)).join(', '),
        c.mode, c.preCondition, c.steps, c.testData, c.expected, s.file,
      ]);
      row.alignment = { vertical: 'top', wrapText: true };
      if (/neg/i.test(c.type)) row.getCell(6).font = { color: { argb: 'FFB42318' } };
      if (c.priority === 'P1') row.getCell(7).font = { bold: true };
    }
  }
  all.autoFilter = { from: { row: 1, column: 1 }, to: { row: all.rowCount, column: head.length } };
  all.views = [{ state: 'frozen', xSplit: 3, ySplit: 1 }];

  // ---------------- By Section ----------------
  const sec = wb.addWorksheet('By Section');
  const cols = stores.map((s) => `${s.site} (${s.store === 'Arabic' ? 'AR' : 'EN'})`);
  sec.addRow(['Section', ...cols, 'Total']);
  styleHeader(sec, [18, ...cols.map(() => 13), 9]);
  sec.getRow(1).height = 45;
  const sections = [...new Set(stores.flatMap((s) => s.cases.map((c) => c.section || '(none)')))].sort();
  for (const name of sections) {
    const counts = stores.map((s) => s.cases.filter((c) => (c.section || '(none)') === name).length);
    sec.addRow([name, ...counts, counts.reduce((a, b) => a + b, 0)]);
  }
  const sr = sec.addRow(['Total', ...stores.map((s) => s.cases.length), stores.reduce((a, s) => a + s.cases.length, 0)]);
  sr.font = { bold: true };
  sr.eachCell((c) => (c.fill = fill(SOFT)));

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  wb.calcProperties.fullCalcOnLoad = true;
  await wb.xlsx.writeFile(OUT);
  const cases = stores.reduce((a, s) => a + s.cases.length, 0);
  console.log(`[master] ${relToRoot(OUT)}: ${stores.length} store workbooks, ${cases} test cases, ${sections.length} sections`);
}

main().catch((e) => {
  console.error(`[master] ${e.message ?? e}`);
  process.exit(1);
});
