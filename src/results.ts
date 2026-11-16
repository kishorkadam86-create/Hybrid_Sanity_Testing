// Writes outcomes back into the workbook:
//  - "Execution Results": one row per (Test Case, Platform), the detailed record of each run
//  - "Test Cases": <Platform> Status columns plus the rolled-up Status / Actual Result / Defect columns
//  - "Defect Log": one defect per distinct failure; the same failure on several platforms shares one defect
import ExcelJS from 'exceljs';
import { parsePlatforms } from './plan-file';
import { PLATFORMS, type Outcome, type Platform } from './types';
import {
  DEFECT_HEADERS, EXEC_HEADERS, SHEET, casesSheet, cellText, col, ensureCol, findRow, findSheet, headerMap, norm,
  openWorkbook, paintStatus, stamp, styleHeader, today,
} from './workbook';

const HIGH_RISK = /cart|checkout|payment|account|login|order/i;
const CLOSED = /retest passed|closed|fixed|rejected/i;
const RANK: Record<string, number> = { fail: 4, blocked: 3, aipending: 2, pass: 1 };

export function defaultSeverity(section: string, priority: string): string {
  if (/p1/i.test(priority)) return 'High';
  if (/p3/i.test(priority)) return 'Low';
  return HIGH_RISK.test(section) ? 'High' : 'Medium';
}

function sheetWithHeaders(wb: ExcelJS.Workbook, name: string, headers: string[], widths: number[], ...aliases: string[]) {
  let ws = findSheet(wb, name, ...aliases);
  if (!ws) {
    ws = wb.addWorksheet(name);
    ws.addRow(headers);
    styleHeader(ws, widths);
  }
  const h = headerMap(ws);
  for (const n of headers) ensureCol(ws, h, n);
  return { ws, h };
}

function nextDefectId(ws: ExcelJS.Worksheet, idCol: number): string {
  let max = 0;
  for (let r = 2; r <= ws.rowCount; r++) {
    const m = cellText(ws.getRow(r).getCell(idCol)).match(/(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `DEF_${String(max + 1).padStart(3, '0')}`;
}

function rowsFor(ws: ExcelJS.Worksheet, colIdx: number, value: string): ExcelJS.Row[] {
  const out: ExcelJS.Row[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (norm(cellText(row.getCell(colIdx))) === norm(value)) out.push(row);
  }
  return out;
}

const platformList = (ps: Platform[]) => PLATFORMS.filter((p) => ps.includes(p)).join(', ');

export type Via = 'Script' | 'AI (MCP)' | 'AI (queued)' | 'Manual (device)' | 'Manual (queued)';

/** Apply one (case, platform) outcome to an open workbook. */
export function applyOutcome(wb: ExcelJS.Workbook, o: Outcome, via: Via, executedBy: string) {
  // ---- Test Cases row ----
  const ws = casesSheet(wb);
  const h = headerMap(ws);
  const idCol = col(h, 'Test Case ID', 'TC ID', 'Test ID');
  if (!idCol) throw new Error('Test-case sheet has no "Test Case ID" column');
  const row = findRow(ws, idCol, o.tcId);
  if (!row) throw new Error(`${o.tcId} not found in the "${ws.name}" sheet`);
  const get = (...names: string[]) => {
    const c = col(h, ...names);
    return c ? cellText(row.getCell(c)) : '';
  };
  const section = get('Section', 'Module');
  const scenario = get('Test Scenario', 'Title');
  const applies = parsePlatforms(get('Platform', 'Platforms'));

  // ---- Execution Results row (tc, platform) ----
  const ex = sheetWithHeaders(wb, SHEET.results, EXEC_HEADERS, [13, 10, 14, 40, 12, 60, 18, 36, 13, 18, 13]);
  const exCol = (n: string) => ensureCol(ex.ws, ex.h, n);
  const exRow =
    rowsFor(ex.ws, exCol('Test Case ID'), o.tcId).find((r) => norm(cellText(r.getCell(exCol('Platform')))) === norm(o.platform)) ??
    ex.ws.getRow(ex.ws.rowCount + 1);
  const prevDefectId = cellText(exRow.getCell(exCol('Defect ID')));

  // ---- Defect Log ----
  const df = sheetWithHeaders(wb, SHEET.defects, DEFECT_HEADERS, [11, 13, 18, 40, 50, 40, 50, 10, 34, 12, 12], 'Defects', 'Bug Log');
  const dfCol = (n: string) => ensureCol(df.ws, df.h, n);
  const defectRow = (id: string) => (id ? findRow(df.ws, dfCol('Defect ID'), id) : undefined);
  let defectId = prevDefectId;

  if (o.status === 'Fail') {
    const title = o.defectTitle || `${section ? section + ': ' : ''}${scenario} failed`;
    // Same platform already has a defect -> reuse it; else the same failure already logged for another platform -> share it.
    let dRow = defectRow(prevDefectId);
    if (!dRow) {
      dRow = rowsFor(df.ws, dfCol('Test Case ID'), o.tcId).find(
        (r) => norm(cellText(r.getCell(dfCol('Title')))) === norm(title) && !CLOSED.test(cellText(r.getCell(dfCol('Status')))),
      );
    }
    const isNew = !dRow;
    if (!dRow) dRow = df.ws.getRow(df.ws.rowCount + 1);
    defectId = isNew ? nextDefectId(df.ws, dfCol('Defect ID')) : cellText(dRow.getCell(dfCol('Defect ID')));
    const prevStatus = isNew ? '' : cellText(dRow.getCell(dfCol('Status')));
    const affected = parsePlatforms(cellText(dRow.getCell(dfCol('Platform'))) || o.platform);
    if (!affected.includes(o.platform)) affected.push(o.platform);
    const screenshots = new Set(cellText(dRow.getCell(dfCol('Screenshot'))).split('\n').filter(Boolean));
    if (o.screenshot) screenshots.add(o.screenshot);

    const values: Record<string, string> = {
      'Defect ID': defectId,
      'Test Case ID': o.tcId,
      Platform: platformList(affected),
      Title: title,
      'Steps to Reproduce': isNew ? o.reproSteps ?? '' : cellText(dRow.getCell(dfCol('Steps to Reproduce'))) || (o.reproSteps ?? ''),
      'Expected Result': get('Expected Result', 'Expected'),
      'Actual Result': isNew ? o.actual : cellText(dRow.getCell(dfCol('Actual Result'))) || o.actual,
      Severity: o.severity || (isNew ? defaultSeverity(section, get('Priority')) : cellText(dRow.getCell(dfCol('Severity')))) || defaultSeverity(section, get('Priority')),
      Screenshot: [...screenshots].join('\n'),
      Status: !prevStatus ? 'New' : CLOSED.test(prevStatus) ? 'Reopened' : prevStatus,
      'Date Found': isNew ? today() : cellText(dRow.getCell(dfCol('Date Found'))) || today(),
    };
    for (const [k, v] of Object.entries(values)) dRow.getCell(dfCol(k)).value = v;
    dRow.alignment = { vertical: 'top', wrapText: true };
  } else if (o.status === 'Pass') {
    // Retest passed on this platform: take it off the defect; close the defect when no platform is left.
    const dRow = defectRow(prevDefectId);
    if (dRow && !CLOSED.test(cellText(dRow.getCell(dfCol('Status'))))) {
      const left = parsePlatforms(cellText(dRow.getCell(dfCol('Platform'))) || o.platform).filter((p) => p !== o.platform);
      dRow.getCell(dfCol('Platform')).value = platformList(left);
      if (!left.length) dRow.getCell(dfCol('Status')).value = 'Retest Passed';
    }
  }

  const exValues: Record<string, string> = {
    'Test Case ID': o.tcId,
    Platform: o.platform,
    Section: section,
    'Test Scenario': scenario,
    Status: o.status,
    'Actual Result': o.actual,
    'Defect ID': defectId,
    Screenshot: o.screenshot ?? '',
    'Execution Date': today(),
    'Executed By': executedBy,
    'Executed Via': via,
  };
  for (const [k, v] of Object.entries(exValues)) exRow.getCell(exCol(k)).value = v;
  paintStatus(exRow.getCell(exCol('Status')), o.status);
  exRow.alignment = { vertical: 'top', wrapText: true };

  // ---- Roll up into the Test Cases row ----
  const pCell = row.getCell(ensureCol(ws, h, `${o.platform} Status`));
  pCell.value = o.status;
  paintStatus(pCell, o.status);

  const results = rowsFor(ex.ws, exCol('Test Case ID'), o.tcId)
    .map((r) => ({
      platform: cellText(r.getCell(exCol('Platform'))) as Platform,
      status: cellText(r.getCell(exCol('Status'))),
      actual: cellText(r.getCell(exCol('Actual Result'))),
      defect: cellText(r.getCell(exCol('Defect ID'))),
      shot: cellText(r.getCell(exCol('Screenshot'))),
    }))
    .filter((r) => !applies.length || applies.includes(r.platform))
    .sort((a, b) => PLATFORMS.indexOf(a.platform) - PLATFORMS.indexOf(b.platform));

  const overall = results.reduce((w, r) => ((RANK[norm(r.status)] ?? 0) > (RANK[norm(w)] ?? 0) ? r.status : w), '');
  const statusCell = row.getCell(ensureCol(ws, h, 'Status'));
  statusCell.value = overall || o.status;
  paintStatus(statusCell, overall || o.status);
  row.getCell(ensureCol(ws, h, 'Actual Result')).value = results.map((r) => `${r.platform}: ${r.status} - ${r.actual}`).join('\n');
  row.getCell(ensureCol(ws, h, 'Screenshot')).value = results.map((r) => r.shot).filter(Boolean).join('\n');
  row.getCell(ensureCol(ws, h, 'Execution Date')).value = today();
  row.getCell(ensureCol(ws, h, 'Executed By')).value = executedBy;
  row.getCell(ensureCol(ws, h, 'Executed Via')).value = via;

  const ids = [...new Set(results.map((r) => r.defect).filter(Boolean))];
  const defects = ids.map((id) => ({ id, row: defectRow(id) })).filter((d) => d.row) as Array<{ id: string; row: ExcelJS.Row }>;
  const dText = (r: ExcelJS.Row, n: string) => cellText(r.getCell(dfCol(n)));
  row.getCell(ensureCol(ws, h, 'Defect ID')).value = ids.join(', ');
  row.getCell(ensureCol(ws, h, 'Defect_Description', 'Defect Description')).value = defects
    .map((d) => `${d.id} (${dText(d.row, 'Platform') || 'retested'}): ${dText(d.row, 'Title')}`)
    .join('\n');
  row.getCell(ensureCol(ws, h, 'Defect steps', 'Defect Steps')).value = defects.length ? dText(defects[defects.length - 1].row, 'Steps to Reproduce') : '';
  row.getCell(ensureCol(ws, h, 'Defect Status')).value = defects.map((d) => `${d.id}: ${dText(d.row, 'Status')}`).join('\n');
  row.alignment = { vertical: 'top', wrapText: true };
}

/** Serialises writes to one workbook; if Excel has the file locked, switches to a side file. */
export class ResultWriter {
  constructor(public target: string, private executedBy: string) {}

  async record(o: Outcome, via: Via) {
    await this.update((wb) => applyOutcome(wb, o, via, this.executedBy));
  }

  async recordMany(list: Outcome[], via: Via) {
    if (list.length) await this.update((wb) => list.forEach((o) => applyOutcome(wb, o, via, this.executedBy)));
  }

  async update(fn: (wb: ExcelJS.Workbook) => void) {
    const wb = await openWorkbook(this.target);
    fn(wb);
    try {
      await wb.xlsx.writeFile(this.target);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code ?? '';
      if (!['EBUSY', 'EPERM', 'EACCES'].includes(code)) throw e;
      const side = this.target.replace(/\.xlsx$/i, `.results-${stamp()}.xlsx`);
      await wb.xlsx.writeFile(side);
      console.warn(`[excel] ${this.target} is locked (open in Excel?). Results now go to ${side}`);
      this.target = side;
    }
  }
}
