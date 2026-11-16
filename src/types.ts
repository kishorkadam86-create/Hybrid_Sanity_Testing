export type Mode = 'Script' | 'AI' | 'Hybrid';
export type Status = 'Pass' | 'Fail' | 'Blocked' | 'AI Pending';
/**
 * Web / Android / iOS        = browsers (desktop web, Android mobile web, iOS mobile web): run by Playwright.
 * Android App / iOS App      = native apps on a device: run manually or by a device-automation tool, recorded
 *                              with "npm run ai -- record --via Manual". Playwright never runs them.
 */
export type Platform = 'Web' | 'Android' | 'iOS' | 'Android App' | 'iOS App';
export const WEB_PLATFORMS: Platform[] = ['Web', 'Android', 'iOS'];
export const APP_PLATFORMS: Platform[] = ['Android App', 'iOS App'];
export const PLATFORMS: Platform[] = [...WEB_PLATFORMS, ...APP_PLATFORMS];
export const isAppPlatform = (p: Platform) => APP_PLATFORMS.includes(p);

/** One row of the "Keywords" sheet. */
export interface Step {
  stepNo: number;
  keyword: string;
  target: string;
  value: string;
  description: string;
  /** Platforms this step runs on (empty = all). */
  platforms: Platform[];
}

/** One row of the "Object Repository" sheet. */
export interface RepoEntry {
  name: string;
  strategy: string;
  locator: string;
  /** Optional locator used on Android/iOS instead of `locator`. */
  mobileLocator: string;
}

export interface TestCase {
  id: string;
  section: string;
  scenario: string;
  type: string;
  priority: string;
  preCondition: string;
  steps: string;
  testData: string;
  expected: string;
  baseUrl: string;
  mode: Mode;
  /** Platforms this case applies to, already narrowed to the platforms selected for the run. */
  platforms: Platform[];
  keywordSteps: Step[];
}

export interface Settings {
  browserChannel: string;
  headless: boolean;
  stepTimeout: number;
  executedBy: string;
  androidDevice: string;
  iosDevice: string;
  iosEngine: string;
  /** 'ai' = a failed VerifyText/VerifyTitle goes to the AI queue for confirmation instead of Fail (used on Arabic stores). */
  textCheckFailures: 'fail' | 'ai';
}

export interface Plan {
  generatedAt: string;
  workbook: string;
  settings: Settings;
  /** Platforms selected for this run. */
  platforms: Platform[];
  repo: Record<string, RepoEntry>;
  cases: TestCase[];
}

export interface Outcome {
  tcId: string;
  platform: Platform;
  status: Status;
  actual: string;
  screenshot?: string;
  severity?: string;
  defectTitle?: string;
  reproSteps?: string;
  reason?: string;
}

export interface QueueItem {
  tcId: string;
  platform: Platform;
  reason: string;
  mode: Mode;
  baseUrl: string;
  section: string;
  scenario: string;
  type: string;
  priority: string;
  preCondition: string;
  steps: string;
  testData: string;
  expected: string;
}

export interface Queue {
  generatedAt: string;
  workbook: string;
  items: QueueItem[];
}
