// Shared, idempotent workbook builder/upgrader used by "setup:workbook" (MyShop) and "build:sites" (site workbooks).
// Only ADDS what is missing: never removes or overwrites data a person has entered.
import ExcelJS from 'exceljs';
import type { CatalogCase } from './catalog';
import { parsePlatforms } from './plan-file';
import { PLATFORMS, type Platform } from './types';
import { SHEET, casesSheet, cellText, col, ensureCol, findRow, findSheet, headerMap, norm, styleHeader } from './workbook';

export type SeedStep = [tc: string, step: number, keyword: string, target: string, value: string, description: string, platform: string];
export type RepoSeed = [name: string, strategy: string, locator: string, mobileLocator: string, notes: string];
export type ConfigRow = [key: string, value: string | number, note: string];

export interface WorkbookSpec {
  title: string;
  baseUrl: string;
  config: ConfigRow[];
  cases: CatalogCase[];
  /** Classification for rows that already exist without Test Type / Priority / Platform. */
  existingMeta?: Record<string, Pick<CatalogCase, 'type' | 'priority' | 'platform'>>;
  steps: SeedStep[];
  repo: RepoSeed[];
}

export const KEYWORDS: Array<[string, string, string, string]> = [
  // keyword, target, value, meaning
  ['Navigate', '-', 'URL or path (blank = Base URL)', 'Open a page. Relative paths resolve against the Base URL.'],
  ['WaitForLoad', '-', 'load | domcontentloaded | networkidle', 'Wait for the page load state (default load).'],
  ['WaitFor', 'Element', '-', 'Wait until the element is visible.'],
  ['Wait', '-', 'Milliseconds', 'Fixed pause. Avoid where possible.'],
  ['Click', 'Element', '-', 'Click the element.'],
  ['ClickIfVisible', 'Element', 'Optional wait in ms (default 3000)', 'Click only if it appears (cookie banner "Reject", promo popup "Close"); never fails.'],
  ['Tap', 'Element', '-', 'Touch tap on Android/iOS (click on Web).'],
  ['DoubleClick', 'Element', '-', 'Double-click the element.'],
  ['Hover', 'Element', '-', 'Hover over the element (opens menus on Web).'],
  ['Type', 'Element', 'Text or ${data} / ${email} / ${env.NAME}', 'Clear and type into an input.'],
  ['Press', 'Element (optional)', 'Key, e.g. Enter', 'Press a key in the element, or on the page if no target.'],
  ['Select', 'Element', 'Option value or label', 'Pick an option in a <select>.'],
  ['Check', 'Element', '-', 'Tick a checkbox / radio.'],
  ['Uncheck', 'Element', '-', 'Untick a checkbox.'],
  ['SetViewport', '-', 'landscape | portrait | 390x844', 'Rotate the device or resize the viewport.'],
  ['Screenshot', '-', '-', 'Attach a full-page screenshot to the report.'],
  ['AI', '-', 'Instruction for Claude', 'Hand this case to Claude/MCP from this step (CAPTCHA, swipe, visual judgement...).'],
  ['VerifyVisible', 'Element', '-', 'Element is visible.'],
  ['VerifyNotVisible', 'Element', '-', 'Element is hidden or absent.'],
  ['VerifyText', 'Element (blank = whole page)', 'Text or /regex/i', 'Element contains the text.'],
  ['VerifyExactText', 'Element', 'Text or /regex/', 'Element text equals the value.'],
  ['VerifyValue', 'Element', 'Text', 'Input value equals the value.'],
  ['VerifyAttribute', 'Element', 'name=value or name=/regex/', 'Element attribute has the value (e.g. type=password, dir=rtl).'],
  ['VerifyTitle', '-', 'Text', 'Page title contains the text (case-insensitive).'],
  ['VerifyURL', '-', 'Text', 'Current URL contains the text (case-insensitive).'],
  ['VerifyCount', 'Element', '>=1, 0, <5, =3', 'Number of matching elements.'],
  ['VerifyStatus', '-', 'HTTP status, e.g. 404', 'HTTP status code returned by the last Navigate.'],
  ['VerifyNoHorizontalScroll', '-', '-', 'The user cannot scroll the page sideways (mobile layout check).'],
  ['VerifyNoDialog', '-', 'Optional message, e.g. /^1$/', 'No JavaScript dialog opened (script-injection check). With a value, only dialogs whose message matches count; others are listed but ignored.'],
  ['VerifyNoConsoleErrors', '-', 'Optional text or /regex/ to ignore', 'No browser console errors since the page opened.'],
];

export const CASE_HEADERS = (platforms: Platform[]) => [
  'Base URL', 'Test Case ID', 'Section', 'Test Scenario', 'Test Type', 'Priority', 'Platform', 'Pre-Condition', 'Test Steps',
  'Test Data', 'Expected Result', 'Execution Mode', 'Status', ...platforms.map((p) => `${p} Status`), 'Actual Result', 'Defect ID',
  'Defect_Description', 'Defect steps', 'Defect Status', 'Screenshot', 'Execution Date', 'Executed By', 'Executed Via',
];

function header(ws: ExcelJS.Worksheet, headers: string[], widths: number[]) {
  ws.addRow(headers);
  styleHeader(ws, widths);
}

/** A new, empty workbook with the Test Cases sheet laid out for the given platforms. */
export function newWorkbook(platforms: Platform[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Hybrid QA Automation';
  const ws = wb.addWorksheet(SHEET.cases);
  const hs = CASE_HEADERS(platforms);
  const widths = hs.map((h) =>
    ({ 'Base URL': 24, 'Test Case ID': 12, Section: 12, 'Test Scenario': 40, 'Test Type': 10, Priority: 8, Platform: 16, 'Pre-Condition': 28,
      'Test Steps': 48, 'Test Data': 24, 'Expected Result': 44, 'Execution Mode': 11, 'Actual Result': 50, Defect_Description: 34, 'Defect steps': 34 } as Record<string, number>)[h] ?? 13);
  header(ws, hs, widths);
  return wb;
}

/** Insert empty columns right after `afterName` (falls back to appending). Data validations move with their columns. */
function insertColsAfter(ws: ExcelJS.Worksheet, afterName: string, names: string[]) {
  const h = headerMap(ws);
  const missing = names.filter((n) => col(h, n) === undefined);
  if (!missing.length) return [];
  const after = col(h, afterName);
  if (after === undefined) {
    missing.forEach((n) => ensureCol(ws, h, n));
    return missing;
  }
  // ExcelJS does not move data validations with spliceColumns: lift them off by header name and put them back.
  const dv = (ws as unknown as { dataValidations: { model: Record<string, ExcelJS.DataValidation> } }).dataValidations;
  const byHeader = new Map<number, string>([...h.entries()].map(([k, v]) => [v, k]));
  const saved = Object.entries(dv.model).map(([addr, v]) => {
    const cell = ws.getCell(addr);
    return { header: byHeader.get(Number(cell.col)), row: Number(cell.row), v };
  });
  dv.model = {};
  ws.spliceColumns(after + 1, 0, ...missing.map(() => []));
  const h2 = headerMap(ws);
  for (const s of saved) {
    const c = s.header ? h2.get(s.header) : undefined;
    if (c) ws.getCell(s.row, c).dataValidation = s.v;
  }
  const style = ws.getRow(1).getCell(after).style;
  missing.forEach((n, i) => {
    const c = ws.getRow(1).getCell(after + 1 + i);
    c.value = n;
    c.style = { ...style };
    ws.getColumn(after + 1 + i).width = n === 'Platform' ? 16 : 11;
  });
  return missing;
}

/** Bring a workbook up to the hybrid, multi-platform layout and add the spec's cases/steps/locators. Returns a change list. */
export function upgradeWorkbook(wb: ExcelJS.Workbook, spec: WorkbookSpec): string[] {
  const ws = casesSheet(wb);
  const changes: string[] = [];

  // ---------- Config ----------
  let cfg = findSheet(wb, SHEET.config);
  if (!cfg) {
    cfg = wb.addWorksheet(SHEET.config);
    header(cfg, ['Key', 'Value', 'Notes'], [24, 40, 90]);
    changes.push('Config sheet');
  }
  for (const [k, v, note] of spec.config) {
    if (!findRow(cfg, 1, k)) {
      cfg.addRow([k, v, note]);
      changes.push(`Config: ${k}`);
    }
  }
  cfg.eachRow((row, i) => i > 1 && (row.alignment = { vertical: 'top', wrapText: true }));

  // ---------- Test Cases: columns ----------
  const added = insertColsAfter(ws, 'Test Scenario', ['Test Type', 'Priority', 'Platform']);
  if (added.length) changes.push(`columns ${added.join(', ')}`);
  let h = headerMap(ws);
  const casePlatforms = new Set<Platform>();
  for (const c of spec.cases) parsePlatforms(c.platform).forEach((p) => casePlatforms.add(p));
  for (const [, meta] of Object.entries(spec.existingMeta ?? {})) parsePlatforms(meta.platform).forEach((p) => casePlatforms.add(p));
  const statusCols = PLATFORMS.filter((p) => casePlatforms.has(p)).map((p) => `${p} Status`);
  for (const n of ['Execution Mode', 'Defect ID', ...statusCols, 'Executed By', 'Executed Via']) {
    if (col(h, n) === undefined) changes.push(`column ${n}`);
    ensureCol(ws, h, n);
  }
  h = headerMap(ws);
  const C = (n: string, ...al: string[]) => col(h, n, ...al)!;
  const idCol = C('Test Case ID');

  // Older runs stored the defect ID in Defect_Description: move it to Defect ID.
  const descCol = col(h, 'Defect_Description', 'Defect Description');
  const defects = findSheet(wb, SHEET.defects);
  const dh = defects ? headerMap(defects) : undefined;
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const id = cellText(row.getCell(idCol)).toUpperCase();
    if (!id) continue;
    const meta = spec.existingMeta?.[id];
    if (meta) {
      if (!cellText(row.getCell(C('Test Type')))) row.getCell(C('Test Type')).value = meta.type;
      if (!cellText(row.getCell(C('Priority')))) row.getCell(C('Priority')).value = meta.priority;
      if (!cellText(row.getCell(C('Platform')))) row.getCell(C('Platform')).value = meta.platform;
    }
    if (!cellText(row.getCell(C('Execution Mode')))) row.getCell(C('Execution Mode')).value = 'Hybrid';
    if (descCol && /^DEF_\d+$/i.test(cellText(row.getCell(descCol))) && !cellText(row.getCell(C('Defect ID')))) {
      const did = cellText(row.getCell(descCol));
      row.getCell(C('Defect ID')).value = did;
      const defRow = defects && dh ? findRow(defects, col(dh, 'Defect ID')!, did) : undefined;
      row.getCell(descCol).value = defRow ? cellText(defRow.getCell(col(dh!, 'Title')!)) : did;
      changes.push(`moved ${did} into Defect ID`);
    }
  }

  // ---------- Test Cases: add missing cases ----------
  let addedCases = 0;
  for (const tc of spec.cases) {
    if (findRow(ws, idCol, tc.id)) continue;
    const row = ws.getRow(ws.rowCount + 1);
    const set = (name: string, v: string) => {
      const c = col(h, name);
      if (c) row.getCell(c).value = v;
    };
    set('Base URL', spec.baseUrl);
    set('Test Case ID', tc.id);
    set('Section', tc.section);
    set('Test Scenario', tc.scenario);
    set('Test Type', tc.type);
    set('Priority', tc.priority);
    set('Platform', tc.platform);
    set('Pre-Condition', tc.pre);
    set('Test Steps', tc.steps);
    set('Test Data', tc.data);
    set('Expected Result', tc.expected);
    set('Execution Mode', tc.mode ?? 'Hybrid');
    row.alignment = { vertical: 'top', wrapText: true };
    addedCases++;
  }
  if (addedCases) changes.push(`${addedCases} new test cases`);

  for (let r = 2; r <= ws.rowCount; r++) {
    ws.getCell(r, C('Execution Mode')).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Hybrid,Script,AI"'] };
    ws.getCell(r, C('Test Type')).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Positive,Negative"'] };
    ws.getCell(r, C('Priority')).dataValidation = { type: 'list', allowBlank: true, formulae: ['"P1,P2,P3"'] };
    // Free text allowed (e.g. "Web, iOS"); the list offers the common values.
    ws.getCell(r, C('Platform')).dataValidation = {
      type: 'list', allowBlank: true, showErrorMessage: false, formulae: ['"All,Web,Mobile,Android,iOS,Apps,Android App,iOS App"'],
    };
  }

  // ---------- Keywords ----------
  let kw = findSheet(wb, SHEET.keywords);
  if (!kw) {
    kw = wb.addWorksheet(SHEET.keywords);
    header(kw, ['Test Case ID', 'Step No', 'Keyword', 'Target', 'Value', 'Description', 'Platform'], [13, 8, 24, 26, 40, 40, 14]);
    changes.push('Keywords sheet');
  }
  const kh = headerMap(kw);
  const kPlat = ensureCol(kw, kh, 'Platform');
  const kId = col(kh, 'Test Case ID')!;
  const withSteps = new Set<string>();
  for (let r = 2; r <= kw.rowCount; r++) withSteps.add(norm(cellText(kw.getRow(r).getCell(kId))));
  const seeded = new Set<string>();
  for (const [tc, n, k, t, v, d, p] of spec.steps) {
    if (withSteps.has(norm(tc))) continue;
    const row = kw.addRow([tc, n, k, t, v, d]);
    row.getCell(kPlat).value = p;
    seeded.add(tc);
  }
  if (seeded.size) changes.push(`keyword steps for ${seeded.size} cases`);

  // ---------- Object Repository ----------
  let repo = findSheet(wb, SHEET.repo);
  if (!repo) {
    repo = wb.addWorksheet(SHEET.repo);
    header(repo, ['Element Name', 'Strategy', 'Locator', 'Mobile Locator', 'Notes'], [24, 10, 80, 40, 30]);
    changes.push('Object Repository sheet');
  }
  const rh = headerMap(repo);
  const rName = col(rh, 'Element Name')!;
  const rStrat = ensureCol(repo, rh, 'Strategy');
  const rLoc = ensureCol(repo, rh, 'Locator');
  const rMob = ensureCol(repo, rh, 'Mobile Locator');
  const rNotes = ensureCol(repo, rh, 'Notes');
  let addedLoc = 0;
  for (const [name, strategy, locator, mobile, notes] of spec.repo) {
    if (findRow(repo, rName, name)) continue;
    const row = repo.getRow(repo.rowCount + 1);
    row.getCell(rName).value = name;
    row.getCell(rStrat).value = strategy;
    row.getCell(rLoc).value = locator;
    row.getCell(rMob).value = mobile;
    row.getCell(rNotes).value = notes;
    addedLoc++;
  }
  if (addedLoc) changes.push(`${addedLoc} locators`);

  // ---------- Keyword Reference (reference only: rebuilt every time) ----------
  const oldRef = findSheet(wb, SHEET.reference);
  if (oldRef) wb.removeWorksheet(oldRef.id);
  const ref = wb.addWorksheet(SHEET.reference);
  header(ref, ['Keyword', 'Target', 'Value', 'What it does'], [26, 26, 40, 70]);
  for (const k of KEYWORDS) ref.addRow(k);
  ref.addRow([]);
  ref.addRow(['Strategies', 'css (default), xpath, text, role ("button|Add to cart"), label, placeholder, testid, alt, title', '', 'Use "||" in Locator for fallbacks. "Mobile Locator" (optional) is used on Android/iOS.']);
  ref.addRow(['Placeholders', '${data} = whole Test Data cell; ${email} = "Email: x" from Test Data; ${env.NAME} = environment variable (use for passwords, cards, coupons)', '', '']);
  ref.addRow(['Platforms', 'All = Web + Android + iOS (browsers); Mobile = Android + iOS; Apps = Android App + iOS App (native, manual/device); or a list', '', 'Keywords → Platform limits a step (e.g. Tap the menu icon only on Mobile).']);
  ref.eachRow((row, i) => i > 1 && (row.alignment = { vertical: 'top', wrapText: true }));
  const kwLimit = Math.max(500, kw.rowCount + 100); // fixed once: setting validation creates rows
  for (let r = 2; r <= kwLimit; r++) {
    kw.getCell(r, col(kh, 'Keyword')!).dataValidation = { type: 'list', allowBlank: true, formulae: [`'${SHEET.reference}'!$A$2:$A$${KEYWORDS.length + 1}`] };
    kw.getCell(r, kPlat).dataValidation = { type: 'list', allowBlank: true, showErrorMessage: false, formulae: ['"Web,Mobile,Android,iOS"'] };
  }

  // Sheet order: Config, Test Cases, Execution Results, Defect Log, Keywords, Object Repository, Keyword Reference.
  const order = [SHEET.config, ws.name, SHEET.results, SHEET.defects, SHEET.keywords, SHEET.repo, SHEET.reference];
  wb.worksheets.forEach((w) => {
    const i = order.findIndex((n) => norm(n) === norm(w.name));
    (w as unknown as { orderNo: number }).orderNo = i === -1 ? order.length + w.id : i;
  });
  return changes;
}

/** Standard Config rows. */
export function configRows(o: {
  baseUrl: string; platforms: string; site?: string; iosEngine?: string; extra?: ConfigRow[];
}): ConfigRow[] {
  return [
    ...(o.site ? [['Site', o.site, 'Name used in reports.'] as ConfigRow] : []),
    ['Base URL', o.baseUrl, 'Used when a row has no Base URL. Row value wins. BASE_URL env var is the last resort.'],
    ['Default Execution Mode', 'Hybrid', 'Hybrid = script first, AI/MCP fallback. Script = never AI. AI = Claude only.'],
    ['Platforms', o.platforms, 'Platforms to run. Web, Android, iOS = browsers (Playwright). Android App, iOS App = native apps (manual/device). Override per run with PLATFORM=...'],
    ['Android Device', 'Pixel 7', 'Playwright device preset for Android mobile web (Chrome engine).'],
    ['iOS Device', 'iPhone 15', 'Playwright device preset for iOS mobile web.'],
    ['iOS Engine', o.iosEngine ?? 'webkit', 'webkit = Safari engine (needs "npx playwright install webkit"); chromium = Chrome with iPhone viewport/UA/touch (use where WebKit cannot start).'],
    ['Browser Channel', 'chrome', 'Web/Android engine: chrome (installed Google Chrome), msedge, or chromium (bundled).'],
    ['Headless', 'true', 'false to watch the run (or: npm run test:headed).'],
    ['Step Timeout (ms)', 15000, 'Max wait per keyword step.'],
    ['Executed By', 'QA Automation', 'Written to the Executed By column for scripted runs.'],
    ...(o.extra ?? []),
  ];
}
