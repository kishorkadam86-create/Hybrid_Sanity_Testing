// Reads a store workbook's cases, execution results and defects (read-only).
// Shared by the Excel execution report (cli/build-report.ts) and the UI data export (cli/export-ui-data.ts).
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { buildPlan, readConfig } from './plan';
import { WORKBOOKS_DIR } from './paths';
import { findSheet, headerMap, openWorkbook } from './workbook';
import type { TestCase } from './types';

export interface Run {
  site: string; store: string; tcId: string; platform: string; section: string; scenario: string; priority: string; type: string;
  status: string; actual: string; defectId: string; screenshot: string; date: string; executedVia: string;
}
export interface Defect { site: string; store: string; [k: string]: string }
export interface StoreData { site: string; store: string; url: string; file: string; cases: TestCase[]; runs: Run[]; defects: Defect[] }

/** Data rows of a sheet as { header text: cell text }. */
export function rows(ws: ExcelJS.Worksheet | undefined): Array<Record<string, string>> {
  if (!ws) return [];
  const h = headerMap(ws);
  const names = new Map<number, string>();
  ws.getRow(1).eachCell((c, i) => names.set(i, String(c.text).trim()));
  const out: Array<Record<string, string>> = [];
  ws.eachRow((r, i) => {
    if (i < 2) return;
    const rec: Record<string, string> = {};
    for (const [, idx] of h) rec[names.get(idx)!] = String(r.getCell(idx).text ?? '').trim();
    if (Object.values(rec).some(Boolean)) out.push(rec);
  });
  return out;
}

export async function loadStore(file: string): Promise<StoreData> {
  const wb = await openWorkbook(file);
  const cfg = readConfig(wb);
  const plan = await buildPlan(file, { platform: 'Everything' });
  const site = (cfg.get('site') || path.basename(file)).replace(/\s*\(Arabic\)$/, '');
  const store = cfg.get('store') || (/_AR_/i.test(file) ? 'Arabic' : 'English');
  const byId = new Map(plan.cases.map((c) => [c.id, c]));
  const runs: Run[] = rows(findSheet(wb, 'Execution Results'))
    .filter((r) => r['Status'])
    .map((r) => {
      const c = byId.get(r['Test Case ID']);
      return {
        site, store, tcId: r['Test Case ID'], platform: r['Platform'], section: r['Section'] || c?.section || '',
        scenario: r['Test Scenario'] || c?.scenario || '', priority: c?.priority || '', type: c?.type || '',
        status: r['Status'], actual: r['Actual Result'], defectId: r['Defect ID'], screenshot: r['Screenshot'],
        date: r['Execution Date'], executedVia: r['Executed Via'],
      };
    });
  const defects = rows(findSheet(wb, 'Defect Log')).filter((d) => d['Defect ID']).map((d) => ({ site, store, ...d }));
  return { site, store, url: cfg.get('baseurl') || '', file: path.basename(file), cases: plan.cases, runs, defects };
}

/** Every store workbook in workbooks/, sorted by site, English before Arabic. */
export async function loadAllStores(): Promise<StoreData[]> {
  const files = fs.readdirSync(WORKBOOKS_DIR).filter((f) => /\.xlsx$/i.test(f) && !f.startsWith('~$') && !f.includes('.results-')).sort();
  const stores = await Promise.all(files.map((f) => loadStore(path.join(WORKBOOKS_DIR, f))));
  return stores.sort((a, b) => a.site.localeCompare(b.site) || (a.store === 'English' ? -1 : 1));
}
