import ExcelJS from 'exceljs';

export const SHEET = {
  cases: 'Test Cases',
  defects: 'Defect Log',
  config: 'Config',
  keywords: 'Keywords',
  repo: 'Object Repository',
  reference: 'Keyword Reference',
  results: 'Execution Results',
} as const;

export const DEFECT_HEADERS = [
  'Defect ID', 'Test Case ID', 'Platform', 'Title', 'Steps to Reproduce', 'Expected Result',
  'Actual Result', 'Severity', 'Screenshot', 'Status', 'Date Found',
];

export const EXEC_HEADERS = [
  'Test Case ID', 'Platform', 'Section', 'Test Scenario', 'Status', 'Actual Result', 'Defect ID',
  'Screenshot', 'Execution Date', 'Executed By', 'Executed Via',
];

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
export const cellText = (cell: ExcelJS.Cell) => String(cell.text ?? '').trim();

export async function openWorkbook(file: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  return wb;
}

export function findSheet(wb: ExcelJS.Workbook, ...names: string[]) {
  return wb.worksheets.find((ws) => names.some((n) => norm(ws.name) === norm(n)));
}

export type Headers = Map<string, number>;

export function headerMap(ws: ExcelJS.Worksheet): Headers {
  const m: Headers = new Map();
  ws.getRow(1).eachCell((c, i) => {
    const key = norm(cellText(c));
    if (key && !m.has(key)) m.set(key, i);
  });
  return m;
}

export function col(h: Headers, ...names: string[]): number | undefined {
  for (const n of names) {
    const c = h.get(norm(n));
    if (c !== undefined) return c;
  }
  return undefined;
}

/** Return the column for `name` (or an alias); append it after the last header if missing. */
export function ensureCol(ws: ExcelJS.Worksheet, h: Headers, name: string, ...aliases: string[]): number {
  const existing = col(h, name, ...aliases);
  if (existing !== undefined) return existing;
  const last = Math.max(0, ...h.values());
  const idx = last + 1;
  const header = ws.getRow(1).getCell(idx);
  header.value = name;
  if (last) header.style = { ...ws.getRow(1).getCell(last).style };
  if (!ws.getColumn(idx).width) ws.getColumn(idx).width = 18;
  h.set(norm(name), idx);
  return idx;
}

export function findRow(ws: ExcelJS.Worksheet, colIdx: number, value: string) {
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    if (norm(cellText(row.getCell(colIdx))) === norm(value)) return row;
  }
  return undefined;
}

/** Rows below the header as { normalisedHeader: text }. Empty rows are skipped. */
export function readTable(ws: ExcelJS.Worksheet): Array<Record<string, string>> {
  const h = headerMap(ws);
  const out: Array<Record<string, string>> = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const rec: Record<string, string> = {};
    let any = false;
    for (const [key, idx] of h) {
      const v = cellText(row.getCell(idx));
      rec[key] = v;
      if (v) any = true;
    }
    if (any) out.push(rec);
  }
  return out;
}

export function pick(rec: Record<string, string>, ...names: string[]): string {
  for (const n of names) {
    const v = rec[norm(n)];
    if (v) return v;
  }
  return '';
}

export function casesSheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet {
  const ws =
    findSheet(wb, SHEET.cases, 'TestCases', 'Test Case') ??
    wb.worksheets.find((w) => col(headerMap(w), 'Test Case ID') !== undefined);
  if (!ws) throw new Error('No test-case sheet found (needs a "Test Case ID" header).');
  return ws;
}

export function styleHeader(ws: ExcelJS.Worksheet, widths: number[]) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF305496' } };
  row.alignment = { vertical: 'middle', wrapText: true };
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

const STATUS_FILL: Record<string, string> = {
  pass: 'FFC6EFCE',
  fail: 'FFFFC7CE',
  blocked: 'FFFFEB9C',
  aipending: 'FFDDEBF7',
};

export function paintStatus(cell: ExcelJS.Cell, status: string) {
  const argb = STATUS_FILL[norm(status)];
  if (argb) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

const pad = (n: number) => String(n).padStart(2, '0');
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const stamp = () => {
  const d = new Date();
  return `${today().replace(/-/g, '')}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
};
