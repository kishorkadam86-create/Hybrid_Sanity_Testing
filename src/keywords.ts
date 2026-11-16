// Keyword engine: turns one row of the Keywords sheet into Playwright actions/assertions.
import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { isVerifyKeyword } from './plan-file';
import { isProductionUrl, PRODUCTION_MESSAGE } from './guard';
import type { Platform, RepoEntry, Step } from './types';

/**
 * How a failed step is classified:
 *  assert  -> Fail        (a Verify* step disagreed with the page: real defect)
 *  blocked -> Blocked     (environment / test-design problem: site down, missing data, unknown keyword)
 *  locate  -> AI Pending  in Hybrid mode (action could not find/use its element: maybe a stale locator,
 *             so Claude re-runs it through MCP), Blocked in Script mode
 *  handoff -> AI Pending  (step explicitly delegated to AI with the "AI" keyword)
 */
export type FailureKind = 'assert' | 'blocked' | 'locate' | 'handoff';

export class StepError extends Error {
  constructor(public kind: FailureKind, message: string) {
    super(message);
  }
}

export interface StepContext {
  page: Page;
  testInfo: TestInfo;
  repo: Record<string, RepoEntry>;
  baseUrl: string;
  data: Record<string, string>;
  consoleErrors: string[];
  /** Messages of JS dialogs (alert/confirm/prompt) seen on the page; they are dismissed automatically. */
  dialogs: string[];
  stepTimeout: number;
  platform: Platform;
  /** HTTP status of the last Navigate (for VerifyStatus). */
  lastStatus?: number;
}

const kw = (k: string) => k.toLowerCase().replace(/[^a-z]/g, '');
export const firstLine = (e: unknown) =>
  String((e as Error)?.message ?? e).replace(/\u001b\[[0-9;]*m/g, '').split('\n').find((l) => l.trim())?.trim() ?? 'Unknown error';

/** "Email: a@b.com / Password: x" -> { email, password, data: <whole cell> } */
export function parseTestData(raw: string): Record<string, string> {
  const data: Record<string, string> = { data: raw.trim() };
  for (const part of raw.split(/\r?\n|\s\/\s|;/)) {
    const m = part.match(/^\s*([A-Za-z][\w .-]*?)\s*[:=]\s*(.+?)\s*$/);
    if (m) data[m[1].toLowerCase()] = m[2];
  }
  return data;
}

const SECRET_NAME = /pass|pwd|secret|token|otp|card|cvv/i;

/** Replace ${name} (Test Data) and ${env.NAME} (environment variable) placeholders. */
export function substitute(text: string, ctx: StepContext): { value: string; secret: boolean } {
  let secret = false;
  const value = text.replace(/\$\{([^}]+)\}/g, (_m, raw: string) => {
    const name = raw.trim();
    if (name.toLowerCase().startsWith('env.')) {
      secret = true;
      const v = process.env[name.slice(4)];
      if (v === undefined) throw new StepError('blocked', `Environment variable ${name.slice(4)} is not set`);
      return v;
    }
    const v = ctx.data[name.toLowerCase()];
    if (v === undefined) throw new StepError('blocked', `Test Data has no value for \${${name}}`);
    if (SECRET_NAME.test(name)) secret = true;
    return v;
  });
  return { value, secret };
}

function toMatcher(s: string): string | RegExp {
  const m = s.match(/^\/(.+)\/([a-z]*)$/);
  return m ? new RegExp(m[1], m[2]) : s;
}

const containsCi = (s: string) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

function buildLocator(page: Page, strategy: string, sel: string): Locator {
  switch (strategy) {
    case 'role': {
      const [role, name] = sel.split('|').map((x) => x.trim());
      return page.getByRole(role as Parameters<Page['getByRole']>[0], name ? { name: toMatcher(name) } : undefined);
    }
    case 'text': return page.getByText(toMatcher(sel));
    case 'label': return page.getByLabel(toMatcher(sel));
    case 'placeholder': return page.getByPlaceholder(toMatcher(sel));
    case 'testid': return page.getByTestId(sel);
    case 'alt': return page.getByAltText(toMatcher(sel));
    case 'title': return page.getByTitle(toMatcher(sel));
    case 'xpath': return page.locator(`xpath=${sel}`);
    default: return page.locator(sel);
  }
}

/**
 * Target = an Element Name from the Object Repository, or a raw Playwright selector.
 * A locator may list fallbacks separated by "||" (combined with Playwright's .or()).
 */
export function resolveLocator(ctx: StepContext, target: string, all = false): Locator {
  if (!target.trim()) throw new StepError('blocked', 'This keyword needs a Target (element name or selector)');
  const entry = ctx.repo[target.trim().toLowerCase()];
  const strategy = (entry?.strategy || 'css').trim().toLowerCase();
  const useMobile = ctx.platform !== 'Web' && !!entry?.mobileLocator;
  const parts = (useMobile ? entry!.mobileLocator : entry?.locator ?? target).split('||').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) throw new StepError('blocked', `Object Repository entry "${target}" has no locator`);
  let loc = buildLocator(ctx.page, strategy, parts[0]);
  for (const p of parts.slice(1)) loc = loc.or(buildLocator(ctx.page, strategy, p));
  return all ? loc : loc.first();
}

export function describeStep(step: Step, ctx: StepContext): string {
  let v = step.value;
  try {
    const s = substitute(step.value, ctx);
    v = s.secret ? '******' : s.value;
  } catch {
    /* keep the raw placeholder */
  }
  const t = step.target ? ` "${step.target}"` : '';
  return `${step.keyword}${t}${v ? ` = ${v}` : ''}${step.description ? ` (${step.description})` : ''}`;
}

export async function runStep(step: Step, ctx: StepContext): Promise<void> {
  const { page, stepTimeout: timeout } = ctx;
  const val = () => substitute(step.value, ctx).value;
  const el = () => resolveLocator(ctx, step.target);

  try {
    switch (kw(step.keyword)) {
      // ---- navigation / waits ----
      case 'navigate': case 'open': case 'goto': {
        const raw = val() || step.target || '';
        let url: string;
        try {
          url = new URL(raw, ctx.baseUrl || undefined).toString();
        } catch {
          throw new StepError('blocked', `No usable URL: "${raw}" with Base URL "${ctx.baseUrl}"`);
        }
        if (isProductionUrl(url)) throw new StepError('blocked', `${PRODUCTION_MESSAGE} (${url})`);
        try {
          const resp = await page.goto(url, { timeout: Math.max(timeout, 30000) });
          ctx.lastStatus = resp?.status();
        } catch (e) {
          throw new StepError('blocked', `Could not open ${url}: ${firstLine(e)}`);
        }
        if (isProductionUrl(page.url())) throw new StepError('blocked', `Staging redirected to production: ${page.url()}. ${PRODUCTION_MESSAGE}`);
        return;
      }
      case 'waitforload': await page.waitForLoadState((val() || 'load') as 'load'); return;
      case 'wait': await page.waitForTimeout(Number(val()) || 1000); return;
      case 'waitfor': case 'waitforvisible': await expect(el()).toBeVisible({ timeout }); return;

      // ---- actions ----
      case 'click': await el().click({ timeout }); return;
      case 'clickifvisible': {
        // For cookie banners / promo popups: click only when shown within 3 s, never fail.
        const target = el();
        if (await target.waitFor({ state: 'visible', timeout: Number(val()) || 3000 }).then(() => true, () => false)) {
          await target.click({ timeout: 3000 }).catch(() => undefined);
          await page.waitForTimeout(300);
        }
        return;
      }
      case 'tap':
        if (ctx.platform === 'Web') await el().click({ timeout });
        else await el().tap({ timeout });
        return;
      case 'setviewport': {
        const v = val().toLowerCase();
        const cur = page.viewportSize() ?? { width: 390, height: 844 };
        const long = Math.max(cur.width, cur.height);
        const short = Math.min(cur.width, cur.height);
        const m = v.match(/^(\d+)\s*x\s*(\d+)$/);
        const size = v === 'landscape' ? { width: long, height: short } : v === 'portrait' ? { width: short, height: long } : m ? { width: +m[1], height: +m[2] } : undefined;
        if (!size) throw new StepError('blocked', `SetViewport value must be landscape, portrait or WIDTHxHEIGHT (got "${step.value}")`);
        await page.setViewportSize(size);
        await page.waitForTimeout(300);
        return;
      }
      case 'doubleclick': await el().dblclick({ timeout }); return;
      case 'hover': await el().hover({ timeout }); return;
      case 'type': case 'fill': case 'enter': await el().fill(val(), { timeout }); return;
      case 'press':
        if (step.target) await el().press(val() || 'Enter', { timeout });
        else await page.keyboard.press(val() || 'Enter');
        return;
      case 'select': await el().selectOption(val(), { timeout }); return;
      case 'check': await el().check({ timeout }); return;
      case 'uncheck': await el().uncheck({ timeout }); return;
      case 'screenshot':
        await ctx.testInfo.attach(step.description || 'screenshot', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
        return;
      case 'ai': case 'manual': case 'handoff':
        throw new StepError('handoff', step.description || step.value || 'Step delegated to AI/MCP execution');

      // ---- verifications ----
      case 'verifyvisible': await expect(el()).toBeVisible({ timeout }); return;
      case 'verifynotvisible': case 'verifyhidden': await expect(el()).toBeHidden({ timeout }); return;
      case 'verifytext': {
        const target = step.target ? el() : page.locator('body');
        await expect(target).toContainText(toMatcher(val()), { timeout });
        return;
      }
      case 'verifyexacttext': await expect(el()).toHaveText(toMatcher(val()), { timeout }); return;
      case 'verifyvalue': await expect(el()).toHaveValue(toMatcher(val()), { timeout }); return;
      case 'verifytitle': await expect(page).toHaveTitle(containsCi(val()), { timeout }); return;
      case 'verifyurl': await expect(page).toHaveURL(containsCi(val()), { timeout }); return;
      case 'verifycount': {
        const m = val().replace(/\s/g, '').match(/^(>=|<=|>|<|=)?(\d+)$/);
        if (!m) throw new StepError('blocked', `VerifyCount value must look like ">=1", "0" or "<5" (got "${step.value}")`);
        const op = m[1] ?? '=';
        const n = Number(m[2]);
        const all = resolveLocator(ctx, step.target, true);
        const p = expect.poll(() => all.count(), { timeout, message: `count of "${step.target}" ${op} ${n}` });
        if (op === '>=') await p.toBeGreaterThanOrEqual(n);
        else if (op === '>') await p.toBeGreaterThan(n);
        else if (op === '<=') await p.toBeLessThanOrEqual(n);
        else if (op === '<') await p.toBeLessThan(n);
        else await p.toBe(n);
        return;
      }
      case 'verifyattribute': {
        const m = val().match(/^([\w:-]+)\s*=\s*(.*)$/);
        if (!m) throw new StepError('blocked', `VerifyAttribute value must be name=value (got "${step.value}")`);
        await expect(el()).toHaveAttribute(m[1], toMatcher(m[2]), { timeout });
        return;
      }
      case 'verifynohorizontalscroll': {
        // What the user experiences: try to scroll sideways and see whether the page moves.
        // (scrollWidth alone gives false alarms for carousels clipped by overflow-x: hidden.)
        const moved = await page.evaluate(() => {
          const y = window.scrollY;
          window.scrollTo(10000, y);
          const x = window.scrollX;
          window.scrollTo(0, y);
          return x;
        });
        expect(moved, 'Page scrolls horizontally (content wider than the screen)').toBeLessThanOrEqual(1);
        return;
      }
      case 'verifystatus': {
        const want = Number(val());
        if (!want) throw new StepError('blocked', 'VerifyStatus needs an HTTP status code, e.g. 404');
        if (ctx.lastStatus === undefined) throw new StepError('blocked', 'VerifyStatus must follow a Navigate step');
        expect(ctx.lastStatus, 'HTTP status of the page').toBe(want);
        return;
      }
      case 'verifynodialog': {
        await page.waitForTimeout(1000); // give injected scripts a moment to fire
        // Value (optional): only dialogs whose message matches count, e.g. "/^1$/" for the alert(1) payload.
        // Other dialogs (such as a site's own alerts) are listed in the message but do not fail the step.
        const only = step.value ? toMatcher(step.value) : undefined;
        const counted = ctx.dialogs.filter((d) => {
          const msg = d.replace(/^\w+: /, '');
          return !only || (typeof only === 'string' ? msg === only : only.test(msg));
        });
        const ignored = ctx.dialogs.filter((d) => !counted.includes(d));
        expect(counted, `JavaScript dialogs opened by the page${ignored.length ? ` (site dialogs ignored: ${ignored.join(' | ')})` : ''}`).toEqual([]);
        return;
      }
      case 'verifynoconsoleerrors': {
        const ignore = step.value ? toMatcher(step.value) : undefined;
        const errors = ctx.consoleErrors.filter((e) => !(ignore && (typeof ignore === 'string' ? e.includes(ignore) : ignore.test(e))));
        expect(errors.length, `Browser console errors (${errors.length}): ${errors.slice(0, 3).map((e) => e.slice(0, 140)).join(' | ')}`).toBe(0);
        return;
      }
      default:
        throw new StepError('blocked', `Unknown keyword "${step.keyword}" (see the Keyword Reference sheet)`);
    }
  } catch (e) {
    if (e instanceof StepError) throw e;
    throw new StepError(isVerifyKeyword(step.keyword) ? 'assert' : 'locate', firstLine(e));
  }
}
