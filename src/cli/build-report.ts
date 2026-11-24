// npm run report:excel  ->  docs/reports/Hybrid_QA_Execution_Report_<yyyymmdd>.xlsx
// Consolidated execution report across every store workbook in workbooks/ (results are read, never changed):
//   Summary       KPIs + one row per site/store (planned runs, Pass / Fail / Blocked / AI Pending / Not run)
//   By Platform   the same counts per platform (Web / Android / iOS / apps)
//   Failures      every failed run with its defect and screenshot
//   Blocked       every blocked run with the reason
//   AI Pending    runs waiting for the AI layer (Claude + Playwright MCP) or manual execution
//   Defects       all Defect Log entries
//   All Results   every executed run
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { ROOT, relToRoot } from '../paths';
import { loadAllStores, type Run } from '../report-data';
import { paintStatus, styleHeader, today } from '../workbook';

const STATUSES = ['Pass', 'Fail', 'Blocked', 'AI Pending'] as const;
const SOFT = 'FFE8EEF8';
const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

function table(ws: ExcelJS.Worksheet, head: string[], widths: number[], data: unknown[][], statusCol?: number) {
  ws.addRow(head);
  styleHeader(ws, widths);
  for (const d of data) {
    const r = ws.addRow(d);
    r.alignment = { vertical: 'top', wrapText: true };
    if (statusCol) paintStatus(r.getCell(statusCol), String(d[statusCol - 1]));
  }
  if (data.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: ws.rowCount, column: head.length } };
}

async function main() {
  const stores = await loadAllStores();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Hybrid QA Automation';
  wb.created = new Date();
  const allRuns = stores.flatMap((s) => s.runs);
  const dates = [...new Set(allRuns.map((r) => r.date).filter(Boolean))].sort();

  // ---------------- Summary ----------------
  const sum = wb.addWorksheet('Summary', { properties: { tabColor: { argb: 'FF305496' } } });
  sum.getColumn(1).width = 26;
  const title = sum.getCell('A1');
  title.value = 'Hybrid QA Automation: Sanity Execution Report';
  title.font = { bold: true, size: 16, color: { argb: 'FF305496' } };
  const meta: Array<[string, string]> = [
    ['Environment', 'STAGING (production never tested)'],
    ['Execution date(s)', dates.join(', ') || 'no results yet'],
    ['Report generated', today()],
    ['Scope of this run', 'Scripted layer (Playwright keyword engine) on Web, Android and iOS mobile web. Runs without keyword steps, and failed text checks on Arabic stores, are queued as AI Pending for the AI layer (Claude + Playwright MCP) or manual execution.'],
    ['Credentials', 'OTP sign-in used the staging test mobile number and fixed OTP provided by the client (kept in local environment variables, not in the workbooks). Superdry uses email + password, which was not provided, so its sign-in cases stay with the AI / manual layer.'],
    ['Note', 'OTP sign-in cases share one test number, so they must run with one worker (WORKERS=1); parallel runs collide. Six sign-in failures from the parallel run passed on sequential retest and are marked "Retest Passed" in the Defects tab.'],
  ];
  meta.forEach(([k, v], i) => {
    const r = sum.getRow(i + 3);
    r.getCell(1).value = k;
    r.getCell(1).font = { bold: true };
    r.getCell(2).value = v;
    sum.mergeCells(i + 3, 2, i + 3, 12);
    r.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    if (v.length > 120) r.height = 30;
  });

  const head = ['Site', 'Store', 'Staging URL', 'Planned runs', 'Pass', 'Fail', 'Blocked', 'AI Pending', 'Not run', 'Executed by script', 'Pass rate (Pass / (Pass+Fail))', 'P1 failures', 'Open defects'];
  const start = 10;
  const hr = sum.getRow(start);
  head.forEach((h, i) => (hr.getCell(i + 1).value = h));
  hr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hr.fill = fill('FF305496');
  hr.alignment = { wrapText: true, vertical: 'middle' };
  hr.height = 32;
  [26, 9, 44, 10, 8, 8, 9, 10, 9, 10, 14, 9, 9].forEach((w, i) => (sum.getColumn(i + 1).width = w));
  stores.forEach((s, i) => {
    const r = sum.getRow(start + 1 + i);
    const planned = s.cases.reduce((a, c) => a + c.platforms.length, 0);
    const cnt = (st: string) => s.runs.filter((x) => x.status === st).length;
    const scripted = s.runs.filter((x) => /script/i.test(x.executedVia) && x.status !== 'AI Pending').length;
    const p1f = s.runs.filter((x) => x.status === 'Fail' && x.priority === 'P1').length;
    const rr = start + 1 + i;
    [s.site, s.store, s.url, planned, cnt('Pass'), cnt('Fail'), cnt('Blocked'), cnt('AI Pending'), planned - s.runs.length, scripted].forEach((v, j) => (r.getCell(j + 1).value = v as ExcelJS.CellValue));
    r.getCell(11).value = { formula: `IF(E${rr}+F${rr}=0,"-",E${rr}/(E${rr}+F${rr}))` };
    r.getCell(11).numFmt = '0%';
    r.getCell(12).value = p1f;
    r.getCell(13).value = s.defects.filter((d) => !/retest passed|closed|fixed/i.test(d['Status'] || '')).length;
    r.alignment = { vertical: 'top', wrapText: true };
  });
  const tr = start + 1 + stores.length;
  const t = sum.getRow(tr);
  t.getCell(1).value = 'Total';
  for (const c of ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'L', 'M']) t.getCell(c).value = { formula: `SUM(${c}${start + 1}:${c}${tr - 1})` };
  t.getCell('K').value = { formula: `IF(E${tr}+F${tr}=0,"-",E${tr}/(E${tr}+F${tr}))` };
  t.getCell('K').numFmt = '0%';
  t.font = { bold: true };
  t.eachCell((c) => (c.fill = fill(SOFT)));
  for (const [col, argb] of [['E', 'FFC6EFCE'], ['F', 'FFFFC7CE'], ['G', 'FFFFEB9C'], ['H', 'FFDDEBF7']] as const) {
    for (let r = start + 1; r < tr; r++) sum.getCell(`${col}${r}`).fill = fill(argb);
  }
  sum.views = [{ state: 'frozen', ySplit: start }];

  // ---------------- By Platform ----------------
  const plats = [...new Set(stores.flatMap((s) => s.cases.flatMap((c) => c.platforms)))];
  const bp = wb.addWorksheet('By Platform');
  const bpHead = ['Site', 'Store', 'Platform', 'Planned', ...STATUSES, 'Not run', 'Pass rate'];
  const bpData: unknown[][] = [];
  for (const s of stores) {
    for (const p of plats) {
      const planned = s.cases.filter((c) => c.platforms.includes(p as never)).length;
      if (!planned) continue;
      const runs = s.runs.filter((r) => r.platform === p);
      const n = (st: string) => runs.filter((r) => r.status === st).length;
      const pf = n('Pass') + n('Fail');
      bpData.push([s.site, s.store, p, planned, n('Pass'), n('Fail'), n('Blocked'), n('AI Pending'), planned - runs.length, pf ? Math.round((n('Pass') / pf) * 100) / 100 : '-']);
    }
  }
  table(bp, bpHead, [26, 9, 12, 9, 8, 8, 9, 10, 9, 10], bpData);
  bp.getColumn(10).numFmt = '0%';

  // ---------------- Failures / Blocked / AI Pending / All ----------------
  const runHead = ['Site', 'Store', 'Test Case ID', 'Platform', 'Section', 'Test Scenario', 'Priority', 'Type', 'Status', 'Actual Result', 'Defect ID', 'Screenshot', 'Executed', 'Via'];
  const runWidths = [24, 9, 15, 10, 13, 40, 8, 9, 11, 70, 10, 34, 11, 12];
  const prio = (p: string) => ({ P1: 1, P2: 2, P3: 3 })[p as 'P1'] ?? 9;
  const runRow = (r: Run) => [r.site, r.store, r.tcId, r.platform, r.section, r.scenario, r.priority, r.type, r.status, r.actual, r.defectId, r.screenshot, r.date, r.executedVia];
  const sorted = (st?: string) => allRuns.filter((r) => !st || r.status === st).sort((a, b) => prio(a.priority) - prio(b.priority) || a.site.localeCompare(b.site) || a.tcId.localeCompare(b.tcId));
  table(wb.addWorksheet('Failures'), runHead, runWidths, sorted('Fail').map(runRow), 9);
  table(wb.addWorksheet('Blocked'), runHead, runWidths, sorted('Blocked').map(runRow), 9);
  table(wb.addWorksheet('AI Pending'), runHead, runWidths, sorted('AI Pending').map(runRow), 9);

  // ---------------- Defects ----------------
  const dHead = ['Site', 'Store', 'Defect ID', 'Test Case ID', 'Platform', 'Title', 'Severity', 'Status', 'Steps to Reproduce', 'Expected Result', 'Actual Result', 'Screenshot', 'Date Found'];
  const allDefects = stores.flatMap((s) => s.defects);
  const sev = (s: string) => ({ Critical: 0, High: 1, Medium: 2, Low: 3 })[s as 'High'] ?? 9;
  allDefects.sort((a, b) => sev(a['Severity']) - sev(b['Severity']) || a.site.localeCompare(b.site));
  table(wb.addWorksheet('Defects'), dHead, [24, 9, 10, 15, 16, 44, 9, 10, 50, 40, 50, 34, 11],
    allDefects.map((d) => [d.site, d.store, d['Defect ID'], d['Test Case ID'], d['Platform'], d['Title'], d['Severity'], d['Status'], d['Steps to Reproduce'], d['Expected Result'], d['Actual Result'], d['Screenshot'], d['Date Found']]));

  table(wb.addWorksheet('All Results'), runHead, runWidths, sorted().map(runRow), 9);

  const outDir = path.join(ROOT, 'docs', 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `Hybrid_QA_Execution_Report_${today().replace(/-/g, '')}.xlsx`);
  wb.calcProperties.fullCalcOnLoad = true;
  await wb.xlsx.writeFile(out);
  const n = (st: string) => allRuns.filter((r) => r.status === st).length;
  console.log(`[report] ${relToRoot(out)}: ${allRuns.length} runs (Pass ${n('Pass')}, Fail ${n('Fail')}, Blocked ${n('Blocked')}, AI Pending ${n('AI Pending')}), ${allDefects.length} defects`);
}

main().catch((e) => {
  console.error(`[report] ${e.message ?? e}`);
  process.exit(1);
});
