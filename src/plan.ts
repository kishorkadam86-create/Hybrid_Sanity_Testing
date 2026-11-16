// Reads the workbook (Config, Test Cases, Keywords, Object Repository) into an execution plan.
import ExcelJS from 'exceljs';
import { parseMode, parsePlatforms } from './plan-file';
import type { Plan, Platform, RepoEntry, Settings, Step, TestCase } from './types';
import { SHEET, casesSheet, cellText, findSheet, norm, openWorkbook, pick, readTable } from './workbook';

export interface Filters {
  tc?: string[];
  section?: string[];
  priority?: string[];
  type?: string[];
  /** Raw platform selection, e.g. "Android,iOS" or "Mobile". */
  platform?: string;
}

export function readConfig(wb: ExcelJS.Workbook): Map<string, string> {
  const m = new Map<string, string>();
  const ws = findSheet(wb, SHEET.config, 'Environment');
  ws?.eachRow((row) => {
    const k = norm(cellText(row.getCell(1)));
    const v = cellText(row.getCell(2));
    if (k && k !== 'key' && v) m.set(k, v);
  });
  return m;
}

export async function buildPlan(workbook: string, filters: Filters = {}): Promise<Plan> {
  const wb = await openWorkbook(workbook);
  const cfg = readConfig(wb);

  const settings: Settings = {
    browserChannel: cfg.get('browserchannel') || 'chrome',
    headless: !/^(false|no|0)$/i.test(cfg.get('headless') || 'true') && !process.env.HEADED,
    stepTimeout: Number(cfg.get('steptimeoutms') || cfg.get('steptimeout')) || 15000,
    executedBy: process.env.EXECUTED_BY || cfg.get('executedby') || 'QA Automation',
    androidDevice: cfg.get('androiddevice') || 'Pixel 7',
    iosDevice: cfg.get('iosdevice') || 'iPhone 15',
    iosEngine: (cfg.get('iosengine') || 'webkit').toLowerCase(),
    textCheckFailures: /ai/i.test(cfg.get('textcheckfailures') || '') ? 'ai' : 'fail',
  };
  const configBaseUrl = cfg.get('baseurl') || cfg.get('siteurl') || cfg.get('environmenturl') || '';
  const defaultMode = parseMode(cfg.get('defaultexecutionmode')) ?? 'Hybrid';
  // Run selection: PLATFORM env var > Config "Platforms" > all.
  const runPlatforms: Platform[] = parsePlatforms(filters.platform || cfg.get('platforms'));

  const repo: Record<string, RepoEntry> = {};
  const repoSheet = findSheet(wb, SHEET.repo, 'Locators', 'Object Repo');
  for (const r of repoSheet ? readTable(repoSheet) : []) {
    const name = pick(r, 'Element Name', 'Element', 'Name');
    if (name) {
      repo[name.toLowerCase()] = {
        name,
        strategy: pick(r, 'Strategy', 'By') || 'css',
        locator: pick(r, 'Locator', 'Selector'),
        mobileLocator: pick(r, 'Mobile Locator', 'Mobile Selector'),
      };
    }
  }

  const stepsByTc = new Map<string, Step[]>();
  const kwSheet = findSheet(wb, SHEET.keywords, 'Test Steps', 'Keyword Steps');
  for (const r of kwSheet ? readTable(kwSheet) : []) {
    const id = pick(r, 'Test Case ID', 'TC ID');
    const keyword = pick(r, 'Keyword', 'Action');
    if (!id || !keyword) continue;
    const list = stepsByTc.get(norm(id)) ?? [];
    const platformCell = pick(r, 'Platform', 'Platforms');
    list.push({
      stepNo: Number(pick(r, 'Step No', 'Step', 'Step #')) || list.length + 1,
      keyword,
      target: pick(r, 'Target', 'Element', 'Locator'),
      value: pick(r, 'Value', 'Data', 'Input'),
      description: pick(r, 'Description', 'Notes'),
      platforms: platformCell ? parsePlatforms(platformCell) : [],
    });
    stepsByTc.set(norm(id), list);
  }

  const inList = (list: string[] | undefined, v: string) => !list?.length || list.map(norm).includes(norm(v));
  const cases: TestCase[] = [];
  for (const r of readTable(casesSheet(wb))) {
    const id = pick(r, 'Test Case ID', 'TC ID', 'Test ID');
    if (!id) continue;
    const section = pick(r, 'Section', 'Module', 'Feature');
    const priority = pick(r, 'Priority');
    const type = pick(r, 'Test Type', 'Type');
    if (!inList(filters.tc, id) || !inList(filters.section, section) || !inList(filters.priority, priority) || !inList(filters.type, type)) continue;
    const platforms = parsePlatforms(pick(r, 'Platform', 'Platforms')).filter((p) => runPlatforms.includes(p));
    if (!platforms.length) continue;
    cases.push({
      id,
      section,
      scenario: pick(r, 'Test Scenario', 'Title', 'Scenario', 'Summary'),
      type,
      priority,
      preCondition: pick(r, 'Pre-Condition', 'Preconditions', 'Precondition'),
      steps: pick(r, 'Test Steps', 'Steps'),
      testData: pick(r, 'Test Data', 'Data'),
      expected: pick(r, 'Expected Result', 'Expected'),
      baseUrl: pick(r, 'Base URL', 'Site URL', 'Environment URL', 'URL') || configBaseUrl || process.env.BASE_URL || '',
      mode: parseMode(pick(r, 'Execution Mode', 'Mode')) ?? defaultMode,
      platforms,
      keywordSteps: (stepsByTc.get(norm(id)) ?? []).sort((a, b) => a.stepNo - b.stepNo),
    });
  }

  return { generatedAt: new Date().toISOString(), workbook, settings, platforms: runPlatforms, repo, cases };
}
