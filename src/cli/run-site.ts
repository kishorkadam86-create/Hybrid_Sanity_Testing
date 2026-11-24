// npm run run:site -- <site key | project> [more keys...]
//   site keys: binsina, hnb, pbae, pbsa, nanan, superdry      projects: binsina (binsina + hnb), fashion (pbae, pbsa, nanan, superdry)
// Runs the scripted layer for every store (English + Arabic) of each website, one website at a time:
//   pass 1  everything except Account, WORKERS (default 4) in parallel
//   pass 2  Account (OTP sign-in) with ONE worker: the cases share one staging test number
// Optional env: PLATFORM (Web | Mobile | Web,iOS ...), PRIORITY (P1 ...), WORKERS. Credentials come from .env.local / env vars.
// Test failures are results, not errors: the command exits 0 unless a website could not be run at all.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, WORKBOOKS_DIR } from '../paths';
import { PROJECT_SITES, SITES, storeFile, storesOf } from '../sites';

function loadEnvLocal() {
  const file = path.join(ROOT, '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

function resolveSites(args: string[]) {
  const keys = args.flatMap((a) => PROJECT_SITES[a.toLowerCase() as keyof typeof PROJECT_SITES] ?? [a.toLowerCase()]);
  const unknown = keys.filter((k) => !SITES.some((s) => s.key === k));
  if (!keys.length || unknown.length) {
    throw new Error(`Unknown site ${unknown.join(', ') || '(none given)'}. Use: ${SITES.map((s) => s.key).join(', ')} or a project: ${Object.keys(PROJECT_SITES).join(', ')}`);
  }
  return [...new Set(keys)].map((k) => SITES.find((s) => s.key === k)!);
}

function npmTest(workbook: string, extra: Record<string, string>, label: string): string {
  const res = spawnSync('npm', ['test', '--silent'], {
    cwd: ROOT,
    env: { ...process.env, WORKBOOK: workbook, ...extra },
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;
  if (/No test cases matched/.test(out)) return `${label}: no cases`;
  const summary = out.split(/\r?\n/).filter((l) => /^\[hybrid\] Scripted runs/.test(l)).pop();
  if (!summary) {
    process.stdout.write(out.split(/\r?\n/).slice(-30).join('\n') + '\n');
    throw new Error(`${label}: run did not complete (exit ${res.status})`);
  }
  return `${label}: ${summary.replace('[hybrid] ', '')}`;
}

async function main() {
  loadEnvLocal();
  const sites = resolveSites(process.argv.slice(2));
  const workers = process.env.WORKERS || '4';
  let failed = 0;
  for (const s of sites) {
    for (const store of storesOf(s)) {
      const workbook = path.join(WORKBOOKS_DIR, storeFile(s, store));
      const name = `${s.name} ${store === 'ar' ? 'AR' : 'EN'}`;
      console.log(`[run] ${name} (${path.basename(workbook)})`);
      try {
        console.log(`[run]   ${npmTest(workbook, { SKIP_SECTION: 'Account', WORKERS: workers }, 'main    ')}`);
        console.log(`[run]   ${npmTest(workbook, { SECTION: 'Account', WORKERS: '1' }, 'sign-in ')}`);
      } catch (e) {
        failed++;
        console.error(`[run]   ERROR ${(e as Error).message}`);
      }
    }
  }
  if (failed) {
    console.error(`[run] ${failed} store run(s) could not complete`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`[run] ${e.message ?? e}`);
  process.exit(1);
});
