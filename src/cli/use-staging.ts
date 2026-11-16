// npm run env:staging  ->  moves site workbooks from production URLs to the staging environments.
// Rewrites production hosts to staging hosts in the input sheets only (Config, Test Cases inputs, Keywords,
// Object Repository). Results, Execution Results and the Defect Log are history and are left untouched.
// Idempotent; every changed workbook is backed up first.
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { SITES } from '../sites';
import { BACKUP_DIR, WORKBOOKS_DIR, relToRoot } from '../paths';
import { SHEET, casesSheet, col, findSheet, headerMap, openWorkbook, stamp } from '../workbook';

// production host -> staging host
const MAP = SITES.map((s) => [s.prodHost, new URL(s.url).host] as const);
const INPUT_COLUMNS = ['Base URL', 'Test Scenario', 'Pre-Condition', 'Test Steps', 'Test Data', 'Expected Result'];

function rewrite(cell: ExcelJS.Cell): boolean {
  if (typeof cell.value !== 'string') return false;
  let v = cell.value;
  for (const [prod, staging] of MAP) v = v.split(prod).join(staging);
  if (v === cell.value) return false;
  cell.value = v;
  return true;
}

function rewriteSheet(ws: ExcelJS.Worksheet | undefined, columns?: number[]): number {
  if (!ws) return 0;
  let n = 0;
  ws.eachRow((row, r) => {
    if (r === 1) return;
    row.eachCell((cell, c) => {
      if ((!columns || columns.includes(c)) && rewrite(cell)) n++;
    });
  });
  return n;
}

function setConfig(wb: ExcelJS.Workbook, key: string, value: string): boolean {
  const ws = findSheet(wb, SHEET.config);
  let changed = false;
  ws?.eachRow((row) => {
    if (String(row.getCell(1).text).trim().toLowerCase() === key.toLowerCase() && row.getCell(2).text !== value) {
      row.getCell(2).value = value;
      changed = true;
    }
  });
  return changed;
}

async function main() {
  const files = fs.readdirSync(WORKBOOKS_DIR).filter((f) => /\.xlsx$/i.test(f) && !f.startsWith('~$') && !f.includes('.results-'));
  for (const f of files) {
    const file = path.join(WORKBOOKS_DIR, f);
    const wb = await openWorkbook(file);
    const cases = casesSheet(wb);
    const h = headerMap(cases);
    const cols = INPUT_COLUMNS.map((c) => col(h, c)).filter((c): c is number => c !== undefined);
    const counts = {
      config: rewriteSheet(findSheet(wb, SHEET.config)),
      cases: rewriteSheet(cases, cols),
      keywords: rewriteSheet(findSheet(wb, SHEET.keywords)),
      repo: rewriteSheet(findSheet(wb, SHEET.repo)),
    };
    const safety = setConfig(wb, 'Production Safety', 'Staging only; payments only with the provider in test mode');
    const total = counts.config + counts.cases + counts.keywords + counts.repo;
    if (!total && !safety) {
      console.log(`[staging] ${f.padEnd(34)} already on staging`);
      continue;
    }
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    fs.copyFileSync(file, path.join(BACKUP_DIR, `${path.basename(f, '.xlsx')}-pre-staging-${stamp()}.xlsx`));
    await wb.xlsx.writeFile(file);
    console.log(`[staging] ${f.padEnd(34)} ${total} cells moved to staging (Config ${counts.config}, Test Cases ${counts.cases}, Keywords ${counts.keywords}, Object Repository ${counts.repo})`);
  }
  console.log(`[staging] Done. Backups in ${relToRoot(BACKUP_DIR)}/`);
}

main().catch((e) => {
  console.error(`[staging] ${e.message ?? e}`);
  process.exit(1);
});
