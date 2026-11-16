// Playwright reporter: writes each (case, platform) result into the workbook as soon as the test ends,
// then builds the AI queue (.hybrid/ai-queue.json) for Claude to run through Playwright MCP.
import fs from 'node:fs';
import path from 'node:path';
import type { FullResult, Reporter, TestCase as PwTest, TestResult } from '@playwright/test/reporter';
import { isScriptedFor, readPlan, whyNotScripted, writeQueue } from './plan-file';
import { BACKUP_DIR, relToRoot } from './paths';
import { ResultWriter } from './results';
import { isAppPlatform, type Outcome, type Plan, type Platform, type QueueItem } from './types';
import { stamp } from './workbook';

type Annotation = { type: string; description?: string };
const key = (tc: string, p: Platform) => `${tc}|${p}`;

export default class ExcelReporter implements Reporter {
  private plan!: Plan;
  private writer!: ResultWriter;
  private outcomes = new Map<string, Outcome>();
  private chain: Promise<void> = Promise.resolve();
  /** `playwright test --list` must not touch the workbook. */
  private readonly listOnly = process.argv.includes('--list');

  onBegin() {
    if (this.listOnly) return;
    this.plan = readPlan();
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const backup = path.join(BACKUP_DIR, `${path.basename(this.plan.workbook, '.xlsx')}-${stamp()}.xlsx`);
    fs.copyFileSync(this.plan.workbook, backup);
    console.log(`[excel] Backup saved: ${relToRoot(backup)}`);
    this.writer = new ResultWriter(this.plan.workbook, this.plan.settings.executedBy);
  }

  onTestEnd(test: PwTest, result: TestResult) {
    if (this.listOnly) return;
    if (result.status !== 'passed' && result.retry < test.retries) return; // a retry will follow
    const all: Annotation[] = [...((result as { annotations?: Annotation[] }).annotations ?? []), ...test.annotations];
    const tcId = all.find((a) => a.type === 'tcId')?.description;
    const platform = test.parent.project()?.metadata?.platform as Platform | undefined;
    if (!tcId || !platform) return;
    const ann = all.find((a) => a.type === 'hybrid-outcome')?.description;
    const outcome: Outcome | undefined = ann ? JSON.parse(ann) : this.fallback(tcId, platform, result);
    if (!outcome) return;
    this.outcomes.set(key(tcId, platform), outcome);
    this.chain = this.chain
      .then(() => this.writer.record(outcome, 'Script'))
      .then(() => console.log(`[excel] ${tcId} [${platform}] -> ${outcome.status}`))
      .catch((e) => console.error(`[excel] Could not write ${tcId} [${platform}]: ${e}`));
  }

  /** Used when the test died before it could annotate (timeout, crash). */
  private fallback(tcId: string, platform: Platform, result: TestResult): Outcome | undefined {
    const shot = result.attachments.find((a) => a.contentType === 'image/png' && a.path)?.path;
    const screenshot = shot ? relToRoot(shot) : undefined;
    const msg = (result.error?.message ?? '').replace(/\u001b\[[0-9;]*m/g, '').split('\n')[0];
    const infra = /has been closed|browserType.launch|browser.newContext|ECONNRESET|net::ERR_/i.test(msg);
    if (result.status === 'timedOut' || result.status === 'interrupted' || infra)
      return { tcId, platform, status: 'Blocked', actual: `${infra ? 'Test infrastructure error (browser/network), not a site result' : `Test ${result.status} after ${result.duration} ms`}. ${msg}`.trim(), screenshot };
    if (result.status === 'failed') return { tcId, platform, status: 'Fail', actual: msg || 'Test failed', screenshot };
    return undefined;
  }

  async onEnd(_result: FullResult) {
    if (this.listOnly) return;
    await this.chain;
    const items: QueueItem[] = [];
    const blocked: Outcome[] = [];

    for (const tc of this.plan.cases) {
      for (const p of tc.platforms) {
        const ran = this.outcomes.get(key(tc.id, p));
        let reason: string | undefined;
        if (!isScriptedFor(tc, p)) {
          if (tc.mode === 'Script') {
            blocked.push({ tcId: tc.id, platform: p, status: 'Blocked', actual: `Execution Mode is Script but it cannot be scripted: ${whyNotScripted(tc, p)}.` });
            continue;
          }
          reason = whyNotScripted(tc, p);
        } else if (ran?.status === 'AI Pending') {
          reason = ran.reason ?? 'Script handed this case to AI';
        }
        if (reason) {
          items.push({
            tcId: tc.id, platform: p, reason, mode: tc.mode, baseUrl: tc.baseUrl, section: tc.section, scenario: tc.scenario,
            type: tc.type, priority: tc.priority, preCondition: tc.preCondition, steps: tc.steps, testData: tc.testData, expected: tc.expected,
          });
        }
      }
    }

    await this.writer.recordMany(blocked, 'Script').catch((e) => console.error(`[excel] ${e}`));
    const pending = items.filter((i) => !this.outcomes.has(key(i.tcId, i.platform)));
    const web = pending.filter((i) => !isAppPlatform(i.platform));
    const apps = pending.filter((i) => isAppPlatform(i.platform));
    await this.writer
      .recordMany(web.map((i) => ({ tcId: i.tcId, platform: i.platform, status: 'AI Pending' as const, actual: `Queued for AI execution via Playwright MCP: ${i.reason}.` })), 'AI (queued)')
      .catch((e) => console.error(`[excel] ${e}`));
    await this.writer
      .recordMany(apps.map((i) => ({ tcId: i.tcId, platform: i.platform, status: 'AI Pending' as const, actual: 'Queued for manual / device execution of the native app.' })), 'Manual (queued)')
      .catch((e) => console.error(`[excel] ${e}`));
    writeQueue({ generatedAt: new Date().toISOString(), workbook: this.writer.target, items });

    const runs = [...this.outcomes.values()];
    const count = (s: string) => runs.filter((o) => o.status === s).length;
    const byPlatform = this.plan.platforms
      .map((p) => `${p}: ${runs.filter((o) => o.platform === p).length} scripted / ${items.filter((i) => i.platform === p).length} ${isAppPlatform(p) ? 'manual' : 'AI'}`)
      .join('  |  ');
    console.log(
      `\n[hybrid] Scripted runs: ${runs.length}  Pass: ${count('Pass')}  Fail: ${count('Fail')}  Blocked: ${count('Blocked') + blocked.length}` +
        `\n[hybrid] ${byPlatform}` +
        `\n[hybrid] AI queue: ${items.length} run(s) -> .hybrid/ai-queue.json  (npm run ai -- queue)` +
        `\n[hybrid] Workbook: ${relToRoot(this.writer.target)}\n`,
    );
  }

  printsToStdio() {
    return false;
  }
}
