// npm run build:sites [-- pbae nanan ... | binsina:ar]
// Creates (or tops up) one sanity workbook per site and store in workbooks/ (English: <Site>_Sanity.xlsx,
// Arabic: <Site>_AR_Sanity.xlsx). All URLs are the STAGING environments. Idempotent: existing rows, results and edits
// are kept; only missing cases / keyword steps / locators / config keys are added. Existing workbooks are backed up first.
// To move workbooks built before the staging switch over to staging, run "npm run env:staging".
import fs from 'node:fs';
import path from 'node:path';
import { buildSite, SITE_REPO, SITES, storeFile, storesOf, storeUrl, type Store } from '../sites';
import { parsePlatforms } from '../plan-file';
import { BACKUP_DIR, WORKBOOKS_DIR, relToRoot } from '../paths';
import { configRows, newWorkbook, upgradeWorkbook } from '../upgrade';
import { openWorkbook, stamp } from '../workbook';

const APP = /android app|ios app/i;

async function main() {
  // Arguments: site keys ("binsina") or site:store ("binsina:ar"). No arguments = every site and store.
  const wanted = process.argv.slice(2).map((a) => a.toLowerCase());
  const jobs = SITES.flatMap((s) => storesOf(s).map((store) => ({ s, store })))
    .filter(({ s, store }) => !wanted.length || wanted.includes(s.key) || wanted.includes(`${s.key}:${store}`));
  if (!jobs.length) throw new Error(`Unknown site. Use: ${SITES.map((s) => s.key).join(', ')} (optionally :en / :ar)`);
  fs.mkdirSync(WORKBOOKS_DIR, { recursive: true });

  for (const { s, store } of jobs) {
    const ar = store === ('ar' as Store);
    const file = path.join(WORKBOOKS_DIR, storeFile(s, store));
    const baseUrl = storeUrl(s, store);
    // Native app cases switch language inside the app, so they live in the English workbook only.
    const platforms = ar ? s.platforms.split(',').map((p) => p.trim()).filter((p) => !APP.test(p)).join(', ') : s.platforms;
    const name = `${s.name}${ar ? ' (Arabic)' : ''}`;
    const exists = fs.existsSync(file);
    if (exists) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      fs.copyFileSync(file, path.join(BACKUP_DIR, `${path.basename(file, '.xlsx')}-pre-build-${stamp()}.xlsx`));
    }
    const wb = exists ? await openWorkbook(file) : newWorkbook(parsePlatforms(platforms));
    const { cases, steps } = buildSite(s, store);
    const changes = upgradeWorkbook(wb, {
      title: name,
      baseUrl,
      config: configRows({
        site: name,
        baseUrl,
        platforms,
        // This PC blocks Playwright's WebKit from starting, so iOS runs on Chrome with iPhone emulation.
        iosEngine: process.env.IOS_ENGINE || 'chromium',
        extra: [
          ['Store', ar ? 'Arabic' : 'English', ar ? 'Arabic store view (right-to-left).' : 'English store view.'],
          ['Text Check Failures', ar ? 'AI confirm' : 'Fail', 'AI confirm: a failed VerifyText / VerifyTitle is sent to the AI layer to confirm before a defect is raised.'],
          ['Environment', 'Staging', `Staging only. "npm run plan" refuses production (${s.prodHost}).`],
          ['Vertical', s.vertical, ''],
          ['Country', s.country, ''],
          ['Currency', s.currency, ''],
          ['VAT', s.vat, ''],
          ['Production Safety', 'Staging only; payments only with the provider in test mode', 'Production hosts are blocked by the framework.'],
        ],
      }),
      cases,
      steps,
      repo: SITE_REPO,
    });
    await wb.xlsx.writeFile(file);
    const neg = cases.filter((c) => c.type === 'Negative').length;
    const scripted = new Set(steps.map((x) => x[0])).size;
    console.log(
      `[sites] ${name.padEnd(32)} ${relToRoot(file)}\n` +
        `        ${cases.length} cases (${cases.length - neg} positive, ${neg} negative), ${scripted} with keyword steps, platforms: ${platforms}` +
        (changes.length ? `\n        ${exists ? 'updated' : 'created'}: ${changes.join('; ')}` : '\n        already up to date'),
    );
  }
}

main().catch((e) => {
  console.error(`[sites] ${e.message ?? e}`);
  process.exit(1);
});
