import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(__dirname, '..');
export const WORKBOOKS_DIR = path.join(ROOT, 'workbooks');
export const BACKUP_DIR = path.join(ROOT, 'backups');

const isWorkbook = (f: string) => /\.xlsx$/i.test(f) && !f.startsWith('~$') && !f.includes('.results-');

/**
 * The workbook to run:
 *  - WORKBOOK=<path>            a path (relative to the project root or absolute)
 *  - WORKBOOK=<name>            a site workbook in workbooks/ whose file name contains <name> (e.g. "binsina")
 *  - otherwise                  the single .xlsx in the project root
 */
export function resolveWorkbook(): string {
  const want = process.env.WORKBOOK?.trim();
  if (want) {
    const direct = path.resolve(ROOT, want);
    if (fs.existsSync(direct)) return direct;
    // "binsina:ar" (or STORE=ar) picks the Arabic store workbook; the English one is the default.
    const [name, storePart] = want.split(':');
    const store = (storePart || process.env.STORE || 'en').trim().toLowerCase();
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isAr = (f: string) => /_AR_/i.test(f);
    let hits = fs.existsSync(WORKBOOKS_DIR)
      ? fs.readdirSync(WORKBOOKS_DIR).filter((f) => isWorkbook(f) && f.toLowerCase().replace(/[^a-z0-9]/g, '').includes(key))
      : [];
    if (hits.length > 1) hits = hits.filter((f) => (store === 'ar' ? isAr(f) : !isAr(f)));
    if (hits.length === 1) return path.join(WORKBOOKS_DIR, hits[0]);
    throw new Error(
      hits.length
        ? `WORKBOOK="${want}" matches several workbooks: ${hits.join(', ')}`
        : `WORKBOOK="${want}" not found (no such file, and no workbook in workbooks/ matches).`,
    );
  }
  const files = fs.readdirSync(ROOT).filter(isWorkbook);
  if (files.length === 1) return path.join(ROOT, files[0]);
  throw new Error(
    files.length
      ? `Several workbooks found (${files.join(', ')}). Set WORKBOOK=<file or site name>.`
      : 'No .xlsx test-case workbook found in the project folder. Set WORKBOOK=<file or site name>.',
  );
}

/** Short, file-system safe key for a workbook (used for per-site folders). */
export const siteKey = (workbook: string) => path.basename(workbook).replace(/\.xlsx$/i, '').replace(/\.results-.*$/i, '').replace(/[^A-Za-z0-9_-]/g, '_');

/** Per-workbook working folder, so several sites can run side by side. */
export const hybridDir = (workbook = resolveWorkbook()) => path.join(ROOT, '.hybrid', siteKey(workbook));
export const planFile = (workbook?: string) => path.join(hybridDir(workbook), 'plan.json');
export const queueFile = (workbook?: string) => path.join(hybridDir(workbook), 'ai-queue.json');
export const screenshotDir = (workbook: string) => path.join(ROOT, 'screenshots', siteKey(workbook));

export function relToRoot(p: string): string {
  return path.relative(ROOT, p).split(path.sep).join('/');
}
