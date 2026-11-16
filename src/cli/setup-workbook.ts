// npm run setup:workbook  ->  idempotent upgrade of the MyShop workbook (or WORKBOOK=...) to the hybrid layout.
// Adds only what is missing; never overwrites edited data. A backup is written to backups/ first.
// Site workbooks (Petit Bateau, Nanan, Superdry, Binsina, Holland & Barrett) are built by "npm run build:sites".
import fs from 'node:fs';
import path from 'node:path';
import { NEW_CASES, NEW_REPO, NEW_SEED_STEPS, ORIGINAL_META } from '../catalog';
import { BACKUP_DIR, relToRoot, resolveWorkbook } from '../paths';
import { configRows, upgradeWorkbook, type RepoSeed, type SeedStep } from '../upgrade';
import { casesSheet, cellText, col, headerMap, openWorkbook, stamp } from '../workbook';

// Generic e-commerce locators: a starting point only. "||" separates fallbacks.
const SEED_REPO: RepoSeed[] = [
  ['Header', 'css', 'header || [role="banner"]', '', 'Generic: verify on target site'],
  ['Footer', 'css', 'footer || [role="contentinfo"]', '', 'Generic: verify on target site'],
  ['Hero Banner', 'css', '[class*="hero" i] || [class*="banner" i] || [class*="slider" i]', '', 'Generic: verify on target site'],
  ['Search Icon', 'css', '[aria-label*="search" i] || [aria-label*="zoek" i] || button[class*="search" i] || a[class*="search" i]', '', 'Generic: verify on target site'],
  ['Search Input', 'css', 'input[type="search"] || input[name="q"] || input[name*="search" i] || input[placeholder*="search" i] || input[placeholder*="zoek" i]', '', 'Generic: verify on target site'],
  ['Product Card', 'css', '[class*="product-card" i] || [class*="product-item" i] || [data-product-id] || li.product', '', 'Generic: verify on target site'],
  ['No Results Message', 'text', '/no results|no products|nothing found|geen resultaten|0 results/i', '', 'Generic: verify on target site'],
  ...NEW_REPO,
];

const SEED_STEPS: SeedStep[] = [
  ['TC_001', 1, 'Navigate', '', '', 'Open Base URL', ''],
  ['TC_001', 2, 'WaitForLoad', '', 'load', '', ''],
  ['TC_001', 3, 'VerifyVisible', 'Header', '', '', ''],
  ['TC_001', 4, 'VerifyVisible', 'Hero Banner', '', '', ''],
  ['TC_001', 5, 'VerifyVisible', 'Footer', '', '', ''],
  ['TC_001', 6, 'VerifyNoConsoleErrors', '', '', '', ''],
  ['TC_002', 1, 'Navigate', '', '', '', ''],
  ['TC_002', 2, 'Click', 'Search Icon', '', 'Reveal the search box', ''],
  ['TC_002', 3, 'Type', 'Search Input', '${data}', 'Search term from Test Data', ''],
  ['TC_002', 4, 'Press', 'Search Input', 'Enter', '', ''],
  ['TC_002', 5, 'VerifyCount', 'Product Card', '>=1', 'Results shown', ''],
  ['TC_002', 6, 'VerifyText', '', '${data}', 'Results relate to the term', ''],
  ['TC_003', 1, 'Navigate', '', '', '', ''],
  ['TC_003', 2, 'Click', 'Search Icon', '', '', ''],
  ['TC_003', 3, 'Type', 'Search Input', '${data}', '', ''],
  ['TC_003', 4, 'Press', 'Search Input', 'Enter', '', ''],
  ['TC_003', 5, 'VerifyVisible', 'No Results Message', '', '', ''],
  ['TC_003', 6, 'VerifyCount', 'Product Card', '0', '', ''],
  ...NEW_SEED_STEPS,
];

async function main() {
  const file = resolveWorkbook();
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const backup = path.join(BACKUP_DIR, `${path.basename(file, '.xlsx')}-pre-setup-${stamp()}.xlsx`);
  fs.copyFileSync(file, backup);

  const wb = await openWorkbook(file);
  const ws = casesSheet(wb);
  const urlCol = col(headerMap(ws), 'Base URL', 'Site URL', 'Environment URL');
  const baseUrl = urlCol ? cellText(ws.getRow(2).getCell(urlCol)) : '';
  const changes = upgradeWorkbook(wb, {
    title: 'MyShop',
    baseUrl,
    config: configRows({ baseUrl, platforms: 'Web, Android, iOS' }),
    cases: NEW_CASES,
    existingMeta: ORIGINAL_META,
    steps: SEED_STEPS,
    repo: SEED_REPO,
  });
  await wb.xlsx.writeFile(file);
  console.log(`[setup] Backup: ${relToRoot(backup)}`);
  console.log(changes.length ? `[setup] Updated ${relToRoot(file)}:\n  - ${changes.join('\n  - ')}` : '[setup] Workbook already up to date.');
}

main().catch((e) => {
  console.error(`[setup] ${e.message ?? e}`);
  process.exit(1);
});
