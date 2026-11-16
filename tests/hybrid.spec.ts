// One Playwright test per scripted (case x platform). Each platform is a Playwright project
// (Web / Android / iOS, see playwright.config.ts) that picks its tests by the @web / @android / @ios tag.
// Non-scripted combinations go to the AI queue (see excel-reporter).
import fs from 'node:fs';
import path from 'node:path';
import { test, type Page, type TestInfo } from '@playwright/test';
import { describeStep, firstLine, parseTestData, runStep, type StepContext, StepError } from '../src/keywords';
import { isProductionUrl, PRODUCTION_MESSAGE } from '../src/guard';
import { isScriptedFor, isVerifyKeyword, readPlan, stepsFor } from '../src/plan-file';
import { relToRoot, screenshotDir } from '../src/paths';
import type { Outcome, Platform, TestCase } from '../src/types';
import { today } from '../src/workbook';

const plan = readPlan();
const SHOT_DIR = screenshotDir(plan.workbook);
const clean = (s: string) => (s || 'General').replace(/[^A-Za-z0-9_-]/g, '');

async function capture(page: Page, file: string, testInfo: TestInfo): Promise<string | undefined> {
  try {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    const full = path.join(SHOT_DIR, file);
    await page.screenshot({ path: full, fullPage: true });
    await testInfo.attach(file, { path: full, contentType: 'image/png' });
    return relToRoot(full);
  } catch {
    return undefined;
  }
}

/** A CAPTCHA on screen means a human must continue: never treat it as a site defect, never try to solve it. */
async function captchaVisible(page: Page): Promise<boolean> {
  const c = page.locator('iframe[src*="recaptcha"]:visible, iframe[src*="hcaptcha"]:visible, iframe[title*="captcha" i]:visible, img[src*="captcha" i]:visible, button:has-text("Reload captcha"):visible');
  return (await c.count().catch(() => 0)) > 0;
}

function outcomeFor(tc: TestCase, platform: Platform, err: unknown, executed: string[], screenshot?: string, captcha = false): Outcome {
  const kind = err instanceof StepError ? err.kind : 'locate';
  const failedStep = executed[executed.length - 1] ?? '(before first step)';
  const message = firstLine(err);
  const device = platform === 'Web' ? 'desktop browser' : `${platform} mobile browser`;
  const reproSteps = [`On ${device}, open ${tc.baseUrl}`, ...executed].map((s, i) => `${i + 1}. ${s}`).join('\n');
  const base = { tcId: tc.id, platform, screenshot, reproSteps };

  if (captcha) {
    const actual = `A CAPTCHA was shown at step "${failedStep}"; the check needs a human to continue (not a site defect).`;
    return tc.mode === 'Script' ? { ...base, status: 'Blocked', actual } : { ...base, status: 'AI Pending', actual, reason: 'CAPTCHA shown: a person must complete it (automation must not solve CAPTCHAs)' };
  }
  // Arabic stores: wording checks (title, messages) may use English patterns, so a failed text check is confirmed
  // by the AI layer before any defect is raised (Config "Text Check Failures" = AI confirm).
  if (kind === 'assert' && tc.mode === 'Hybrid' && plan.settings.textCheckFailures === 'ai' && /^Verify(Text|ExactText|Title)\b/i.test(failedStep)) {
    return {
      ...base,
      status: 'AI Pending',
      actual: `Text check "${failedStep}" did not match (${message}); handed to AI/MCP to confirm against the page.`,
      reason: `Text check failed; the store's wording may differ from the pattern. Confirm in the browser: "${failedStep}"`,
    };
  }
  if (kind === 'assert') {
    return {
      ...base,
      status: 'Fail',
      actual: `Failed at step "${failedStep}": ${message}`,
      defectTitle: `${tc.section ? tc.section + ': ' : ''}${tc.scenario} - ${failedStep.replace(/^Verify\w*\s*/i, '')} check failed`,
    };
  }
  if (kind === 'handoff' || (kind === 'locate' && tc.mode === 'Hybrid')) {
    return {
      ...base,
      status: 'AI Pending',
      actual: `Script could not complete step "${failedStep}" (${message}); handed to AI/MCP for execution.`,
      reason: kind === 'handoff' ? `AI step: ${message}` : `Script step failed, possibly a stale locator: "${failedStep}" (${message})`,
    };
  }
  return { ...base, status: 'Blocked', actual: `Blocked at step "${failedStep}": ${message}` };
}

for (const tc of plan.cases) {
  const scriptedOn = tc.platforms.filter((p) => isScriptedFor(tc, p));
  if (!scriptedOn.length) continue;
  const tags = [`@${clean(tc.section)}`, ...(tc.priority ? [`@${clean(tc.priority)}`] : []), ...(tc.type ? [`@${clean(tc.type)}`] : []),
    ...scriptedOn.map((p) => `@${p.toLowerCase()}`)];

  test(`${tc.id} | ${tc.scenario}`, { tag: tags, annotation: { type: 'tcId', description: tc.id } }, async ({ page }, testInfo) => {
    const platform = testInfo.project.metadata.platform as Platform;
    const ctx: StepContext = {
      page,
      testInfo,
      repo: plan.repo,
      baseUrl: tc.baseUrl,
      data: parseTestData(tc.testData),
      consoleErrors: [],
      dialogs: [],
      stepTimeout: plan.settings.stepTimeout,
      platform,
    };
    page.on('console', (m) => m.type() === 'error' && ctx.consoleErrors.push(m.text()));
    page.on('pageerror', (e) => ctx.consoleErrors.push(e.message));
    page.on('dialog', (d) => {
      ctx.dialogs.push(`${d.type()}: ${d.message()}`);
      d.dismiss().catch(() => undefined);
    });

    const steps = stepsFor(tc, platform);
    const executed: string[] = [];
    const verified: string[] = [];
    let outcome: Outcome;
    let rethrow: unknown;
    try {
      for (const step of steps) {
        const label = describeStep(step, ctx);
        executed.push(label);
        await test.step(label, () => runStep(step, ctx));
        if (isProductionUrl(page.url())) throw new StepError('blocked', `Landed on production after "${label}": ${page.url()}. ${PRODUCTION_MESSAGE}`);
        if (isVerifyKeyword(step.keyword)) verified.push(label.replace(/^Verify/i, '').trim());
      }
      outcome = { tcId: tc.id, platform, status: 'Pass', actual: `All ${executed.length} scripted steps passed. Verified: ${verified.join('; ')}` };
    } catch (err) {
      const kind = err instanceof StepError ? err.kind : 'locate';
      const file = `${tc.id}_${platform}_${kind === 'assert' ? 'fail' : 'blocked'}_${today().replace(/-/g, '')}.png`;
      const shot = await capture(page, file, testInfo);
      outcome = outcomeFor(tc, platform, err, executed, shot, await captchaVisible(page));
      if (outcome.status === 'Fail') rethrow = err;
    }

    testInfo.annotations.push({ type: 'hybrid-outcome', description: JSON.stringify(outcome) });
    if (rethrow) throw rethrow;
    test.skip(outcome.status !== 'Pass', `${outcome.status}: ${outcome.actual}`);
  });
}
