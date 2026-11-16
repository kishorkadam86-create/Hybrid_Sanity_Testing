// Bridge between Claude (Playwright MCP) and the workbook. No Python needed.
//
//   npm run ai -- queue [--platform Android]
//   npm run ai -- record  --tc TC_002 --platform Android --status Fail --actual "..." [--title "..."]
//                         [--steps "1. ..\n2. .."] [--severity High] [--screenshot screenshots/TC_002_Android_fail_20261112.png]
//                         [--by "Claude (MCP)"] [--via Manual]   (native-app platforms are always Manual)
//   npm run ai -- promote --tc TC_002 --file .hybrid/TC_002.steps.json
//
// promote file format ("platform" on a step is optional: Web, Android, iOS, Mobile; blank = all):
//   { "steps":    [ { "keyword": "Tap", "target": "Menu Icon", "platform": "Mobile" } ],
//     "locators": [ { "name": "Menu Icon", "strategy": "role", "locator": "button|Menu", "mobileLocator": "" } ] }
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { parsePlatforms, readQueue, writeQueue } from '../plan-file';
import { ROOT, resolveWorkbook } from '../paths';
import { ResultWriter } from '../results';
import { isAppPlatform, type Platform, type Status } from '../types';
import { SHEET, casesSheet, cellText, col, ensureCol, findRow, findSheet, headerMap, norm, styleHeader } from '../workbook';

function args(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
  }
  return out;
}

function need(a: Record<string, string>, k: string): string {
  if (!a[k]) throw new Error(`--${k} is required`);
  return a[k];
}

function workbookFor(): string {
  return readQueue()?.workbook ?? resolveWorkbook();
}

function onePlatform(raw: string | undefined): Platform {
  const p = parsePlatforms(raw);
  if (!raw || p.length !== 1) throw new Error('--platform must be one of Web, Android, iOS, "Android App", "iOS App"');
  return p[0];
}

const DEVICE_HINT: Record<Platform, string> = {
  Web: 'desktop Chrome, 1366x768',
  Android: 'Android phone, e.g. Pixel 7 (412x839, touch, Chrome UA)',
  iOS: 'iPhone, e.g. iPhone 15 (393x659, touch, Safari UA)',
  'Android App': 'Native Android app on a real phone or emulator (manual or device automation)',
  'iOS App': 'Native iOS app on a real iPhone or simulator (manual or device automation)',
};

async function queue(a: Record<string, string>) {
  const q = readQueue();
  const only = a.platform ? onePlatform(a.platform) : undefined;
  const items = (q?.items ?? []).filter((i) => !only || i.platform === only);
  if (!items.length) return console.log('AI queue is empty.');
  console.log(`AI queue (${items.length}) for ${path.relative(ROOT, q!.workbook)}  generated ${q!.generatedAt}\n`);
  for (const it of items) {
    console.log(`${it.tcId} [${it.platform}]  ${it.priority || ''} ${it.type || ''}  [${it.section}] ${it.scenario}`);
    console.log(`  Device     : ${DEVICE_HINT[it.platform]}`);
    console.log(`  Why AI     : ${it.reason}`);
    console.log(`  URL        : ${it.baseUrl || '(none: ask the user)'}`);
    if (it.preCondition) console.log(`  Pre-cond   : ${it.preCondition}`);
    console.log(`  Steps      : ${it.steps.replace(/\n/g, ' | ')}`);
    if (it.testData) console.log(`  Test Data  : ${it.testData.replace(/\n/g, ' | ')}`);
    console.log(`  Expected   : ${it.expected}\n`);
  }
}

async function record(a: Record<string, string>) {
  const tcId = need(a, 'tc');
  const platform = onePlatform(need(a, 'platform'));
  const status = need(a, 'status') as Status;
  if (!['Pass', 'Fail', 'Blocked'].includes(status)) throw new Error('--status must be Pass, Fail or Blocked');
  const manual = /manual|device/i.test(a.via ?? '') || isAppPlatform(platform);
  const writer = new ResultWriter(workbookFor(), a.by || (manual ? 'Manual tester' : 'Claude (Playwright MCP)'));
  await writer.record(
    {
      tcId,
      platform,
      status,
      actual: need(a, 'actual'),
      defectTitle: a.title,
      reproSteps: a.steps?.replace(/\\n/g, '\n'),
      severity: a.severity,
      screenshot: a.screenshot,
    },
    manual ? 'Manual (device)' : 'AI (MCP)',
  );
  const q = readQueue();
  if (q) writeQueue({ ...q, workbook: writer.target, items: q.items.filter((i) => !(norm(i.tcId) === norm(tcId) && i.platform === platform)) });
  console.log(`${tcId} [${platform}] -> ${status} written to ${path.relative(ROOT, writer.target)}`);
}

interface PromoteFile {
  steps: Array<{ keyword: string; target?: string; value?: string; description?: string; platform?: string }>;
  locators?: Array<{ name: string; strategy?: string; locator: string; mobileLocator?: string }>;
}

async function promote(a: Record<string, string>) {
  const tcId = need(a, 'tc');
  const spec = JSON.parse(fs.readFileSync(path.resolve(ROOT, need(a, 'file')), 'utf8')) as PromoteFile;
  if (!spec.steps?.length) throw new Error('Promote file has no steps');
  if (!spec.steps.some((s) => /^verify/i.test(s.keyword))) throw new Error('Add at least one Verify* step so a scripted pass means something');

  const writer = new ResultWriter(workbookFor(), 'Claude (Playwright MCP)');
  await writer.update((wb: ExcelJS.Workbook) => {
    // Keywords: replace this case's rows.
    let kw = findSheet(wb, SHEET.keywords);
    if (!kw) {
      kw = wb.addWorksheet(SHEET.keywords);
      kw.addRow(['Test Case ID', 'Step No', 'Keyword', 'Target', 'Value', 'Description', 'Platform']);
      styleHeader(kw, [13, 8, 22, 26, 30, 45, 14]);
    }
    const kh = headerMap(kw);
    const idCol = col(kh, 'Test Case ID')!;
    const platformCol = ensureCol(kw, kh, 'Platform');
    const keep: unknown[][] = [];
    for (let r = 2; r <= kw.rowCount; r++) {
      const row = kw.getRow(r);
      const id = cellText(row.getCell(idCol));
      if (id && norm(id) !== norm(tcId)) keep.push((row.values as unknown[]).slice(1));
    }
    if (kw.rowCount > 1) kw.spliceRows(2, kw.rowCount - 1);
    for (const v of keep) kw.addRow(v);
    spec.steps.forEach((s, i) => {
      const r = kw!.addRow([tcId, i + 1, s.keyword, s.target ?? '', s.value ?? '', s.description ?? '']);
      r.getCell(platformCol).value = s.platform ?? '';
    });

    // Object Repository: upsert by element name.
    if (spec.locators?.length) {
      const repo = findSheet(wb, SHEET.repo);
      if (!repo) throw new Error(`Workbook has no "${SHEET.repo}" sheet: run "npm run setup:workbook" first`);
      const rh = headerMap(repo);
      const nameCol = col(rh, 'Element Name')!;
      for (const l of spec.locators) {
        const row = findRow(repo, nameCol, l.name) ?? repo.getRow(repo.rowCount + 1);
        row.getCell(nameCol).value = l.name;
        row.getCell(ensureCol(repo, rh, 'Strategy')).value = l.strategy ?? 'css';
        row.getCell(ensureCol(repo, rh, 'Locator')).value = l.locator;
        if (l.mobileLocator !== undefined) row.getCell(ensureCol(repo, rh, 'Mobile Locator')).value = l.mobileLocator;
        row.getCell(ensureCol(repo, rh, 'Notes')).value = `Added by AI promotion of ${tcId}`;
      }
    }

    // An AI-only case becomes Hybrid so the script engine picks it up next run.
    const ws = casesSheet(wb);
    const h = headerMap(ws);
    const row = findRow(ws, col(h, 'Test Case ID')!, tcId);
    if (!row) throw new Error(`${tcId} not found in the test-case sheet`);
    const modeCell = row.getCell(ensureCol(ws, h, 'Execution Mode'));
    if (norm(cellText(modeCell)) !== 'script') modeCell.value = 'Hybrid';
  });
  console.log(`${tcId}: ${spec.steps.length} keyword steps promoted; it will run in the script engine next time.`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const a = args(rest);
  if (cmd === 'queue') return queue(a);
  if (cmd === 'record') return record(a);
  if (cmd === 'promote') return promote(a);
  console.log('Usage: npm run ai -- <queue | record | promote> [options]   (see header of src/cli/ai.ts)');
}

main().catch((e) => {
  console.error(`[ai] ${e.message ?? e}`);
  process.exit(1);
});
