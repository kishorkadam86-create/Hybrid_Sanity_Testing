export type Status = 'Pass' | 'Fail' | 'Blocked' | 'AI Pending' | 'Not run';
export const STATUSES: Status[] = ['Pass', 'Fail', 'Blocked', 'AI Pending', 'Not run'];

export interface Totals {
  cases: number;
  runs: number;
  scripted: number;
  Pass: number;
  Fail: number;
  Blocked: number;
  'AI Pending': number;
  'Not run': number;
}

export interface RunResult {
  status: Status;
  actual?: string;
  date?: string;
  defectId?: string;
  via?: string;
}

export interface TestCase {
  id: string;
  section: string;
  scenario: string;
  type: string;
  priority: string;
  mode: string;
  platforms: string[];
  scriptedOn: string[];
  preCondition: string;
  steps: string;
  testData: string;
  expected: string;
  results: Record<string, RunResult>;
}

export interface Defect {
  id: string;
  tcId: string;
  platform: string;
  title: string;
  severity: string;
  status: string;
  steps: string;
  expected: string;
  actual: string;
  date: string;
}

export interface Website {
  /** Run key: pbae, pbsa, nanan, superdry, binsina, hnb */
  key: string;
  name: string;
  stores: string[];
}

export interface StoreSummary {
  key: string;
  /** Website run key this store belongs to. */
  runKey: string;
  site: string;
  store: string;
  url: string;
  totals: Totals;
}

export interface Store extends StoreSummary {
  workbook: string;
  lastRun: string | null;
  cases: TestCase[];
  defects: Defect[];
}

export interface ProjectMeta {
  id: string;
  name: string;
  tagline: string;
  description: string;
  websites: Website[];
  lastRun: string | null;
  totals: Totals;
  openDefects: number;
}

export interface ProjectSummary extends ProjectMeta {
  stores: StoreSummary[];
}

export interface Project extends ProjectMeta {
  generatedAt: string;
  stores: Store[];
}

export interface Index {
  generatedAt: string;
  environment: string;
  projects: ProjectSummary[];
}
