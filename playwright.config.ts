import fs from 'node:fs';
import { defineConfig, devices, type Project } from '@playwright/test';
import { planFile, resolveWorkbook, siteKey } from './src/paths';
import { WEB_PLATFORMS, type Platform, type Settings } from './src/types';

// Browser/device settings come from the workbook's Config sheet (copied into the plan by "npm run plan").
// Each workbook (site) gets its own plan, report and results folder, so sites can run side by side.
let workbook = '';
try {
  workbook = resolveWorkbook();
} catch {
  /* resolved again (with a clear error) by the plan step */
}
const file = workbook ? planFile(workbook) : '';
const plan = file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
const settings: Partial<Settings> = plan.settings ?? {};
const platforms: Platform[] = (plan.platforms ?? WEB_PLATFORMS).filter((p: Platform) => WEB_PLATFORMS.includes(p));
const channel = !settings.browserChannel || settings.browserChannel === 'chromium' ? undefined : settings.browserChannel;
const site = workbook ? siteKey(workbook) : 'default';

function device(name: string | undefined, fallback: string) {
  const d = devices[name ?? ''];
  if (!d && name) console.warn(`[config] Unknown device "${name}", using "${fallback}"`);
  return d ?? devices[fallback];
}

const all: Partial<Record<Platform, Project>> = {
  // Desktop web: installed Google Chrome (or bundled Chromium).
  Web: { name: 'Web', grep: /@web\b/, metadata: { platform: 'Web' }, use: { ...devices['Desktop Chrome'], channel, viewport: { width: 1366, height: 768 } } },
  // Android mobile web: Chrome engine with Android device emulation (viewport, touch, UA, DPR).
  Android: { name: 'Android', grep: /@android\b/, metadata: { platform: 'Android' }, use: { ...device(settings.androidDevice, 'Pixel 7'), channel } },
  // iOS mobile web: WebKit (Safari's engine) with iPhone emulation. Config "iOS Engine = chromium" falls back to
  // Chrome with the iPhone viewport/UA/touch when WebKit cannot run on the machine.
  iOS: {
    name: 'iOS',
    grep: /@ios\b/,
    metadata: { platform: 'iOS' },
    use: settings.iosEngine === 'chromium'
      ? { ...device(settings.iosDevice, 'iPhone 15'), browserName: 'chromium', channel }
      : { ...device(settings.iosDevice, 'iPhone 15') },
  },
};

export default defineConfig({
  testDir: './tests',
  outputDir: `test-results/${site}`,
  timeout: 120_000,
  retries: 0,
  // Sequential by default (mirrors manual order, gentle on the site). WORKERS=4 to parallelise.
  workers: process.env.WORKERS ? Number(process.env.WORKERS) : 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: `playwright-report/${site}` }], ['./src/excel-reporter.ts']],
  use: {
    headless: settings.headless ?? true,
    actionTimeout: settings.stepTimeout ?? 15_000,
    navigationTimeout: 45_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: platforms.map((p) => all[p]!).filter(Boolean),
});
