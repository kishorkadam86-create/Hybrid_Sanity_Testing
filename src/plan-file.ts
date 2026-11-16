// Synchronous plan/queue I/O. Kept free of exceljs so the spec and config load fast.
import fs from 'node:fs';
import path from 'node:path';
import { planFile, queueFile } from './paths';
import { APP_PLATFORMS, PLATFORMS, WEB_PLATFORMS, isAppPlatform, type Mode, type Plan, type Platform, type Queue, type Step, type TestCase } from './types';

export const isVerifyKeyword = (k: string) => k.toLowerCase().replace(/[^a-z]/g, '').startsWith('verify');

/**
 * Platform list parser.
 *  blank / "All"            -> Web, Android, iOS (the browser platforms)
 *  "Mobile" / "Mobile Web"  -> Android, iOS (mobile web)
 *  "Apps" / "Mobile Apps"   -> Android App, iOS App (native)
 *  "Android App", "iOS App", "Web", "Android", "iOS", "Everything" -> as named
 * Lists may be separated by , / ; | + & or "and".
 */
export function parsePlatforms(raw: string | undefined): Platform[] {
  const text = (raw ?? '').toLowerCase();
  if (!text.trim()) return [...WEB_PLATFORMS];
  const out = new Set<Platform>();
  for (const part of text.split(/[,/;|+&]|\band\b/)) {
    const k = part.replace(/[^a-z]/g, '');
    if (!k) continue;
    const app = /app/.test(k);
    if (k === 'everything') PLATFORMS.forEach((p) => out.add(p));
    else if (k === 'all' || k === 'allweb') WEB_PLATFORMS.forEach((p) => out.add(p));
    else if (['web', 'desktop', 'desktopweb', 'browser'].includes(k)) out.add('Web');
    else if (['mobile', 'mobileweb', 'mweb'].includes(k)) { out.add('Android'); out.add('iOS'); }
    else if (app && /android/.test(k)) out.add('Android App');
    else if (app && /ios|iphone/.test(k)) out.add('iOS App');
    else if (app) APP_PLATFORMS.forEach((p) => out.add(p));
    else if (k.startsWith('android')) out.add('Android');
    else if (k.startsWith('ios') || k.startsWith('iphone') || k.startsWith('safari')) out.add('iOS');
  }
  return PLATFORMS.filter((p) => out.has(p));
}

export const stepsFor = (tc: TestCase, platform: Platform): Step[] =>
  tc.keywordSteps.filter((s) => !s.platforms.length || s.platforms.includes(platform));

/** Scripted on a platform = a browser platform, not AI-only, with keyword steps that include a Verify*. */
export function isScriptedFor(tc: TestCase, platform: Platform): boolean {
  return !isAppPlatform(platform) && tc.mode !== 'AI' && stepsFor(tc, platform).some((s) => isVerifyKeyword(s.keyword));
}

export function whyNotScripted(tc: TestCase, platform: Platform): string {
  if (isAppPlatform(platform)) return 'Native app: run on a device (manually or with a device-automation tool) and record with --via Manual';
  if (tc.mode === 'AI') return 'Execution Mode is AI';
  const steps = stepsFor(tc, platform);
  if (!steps.length) return `No keyword steps for ${platform} yet`;
  return `Keyword steps for ${platform} contain no Verify* step, so a pass could not be proven`;
}

export function parseMode(raw: string | undefined): Mode | undefined {
  const k = (raw ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (!k) return undefined;
  if (['script', 'scripted', 'automation', 'automated', 'playwright'].includes(k)) return 'Script';
  if (['ai', 'mcp', 'aimcp', 'claude', 'manual'].includes(k)) return 'AI';
  if (k === 'hybrid') return 'Hybrid';
  return undefined;
}

export function writePlan(plan: Plan) {
  const file = planFile(plan.workbook);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(plan, null, 2));
}

export function readPlan(): Plan {
  const file = planFile();
  if (!fs.existsSync(file)) {
    throw new Error('No execution plan found. Run "npm test" (or "npm run plan") so the workbook is read first.');
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Plan;
}

export function writeQueue(queue: Queue) {
  const file = queueFile(queue.workbook);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(queue, null, 2));
}

export function readQueue(): Queue | undefined {
  const file = queueFile();
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Queue) : undefined;
}
