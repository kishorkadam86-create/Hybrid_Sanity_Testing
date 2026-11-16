// npm run plan  ->  reads the workbook and writes .hybrid/plan.json for the Playwright run.
// Filters (env vars, comma-separated):
//   TC=TC_001,TC_002   SECTION=Search,Cart   PRIORITY=P1   TYPE=Negative   PLATFORM=Web | Android,iOS | Mobile
import { buildPlan } from '../plan';
import { isScriptedFor, writePlan } from '../plan-file';
import { relToRoot, resolveWorkbook } from '../paths';
import { isProductionUrl, PRODUCTION_MESSAGE, urlsIn } from '../guard';

const list = (v?: string) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined);

async function main() {
  const workbook = resolveWorkbook();
  const plan = await buildPlan(workbook, {
    tc: list(process.env.TC),
    section: list(process.env.SECTION),
    priority: list(process.env.PRIORITY),
    type: list(process.env.TYPE),
    platform: process.env.PLATFORM,
  });
  if (!plan.cases.length) throw new Error('No test cases matched (check the workbook and the TC / SECTION / PRIORITY / TYPE / PLATFORM filters).');

  const noUrl = plan.cases.filter((tc) => !tc.baseUrl && tc.platforms.some((p) => isScriptedFor(tc, p))).map((tc) => tc.id);
  if (noUrl.length) {
    throw new Error(
      `No target URL for ${noUrl.join(', ')}. Add a "Base URL" column, a "Base URL" row on the Config sheet, or set BASE_URL. There is no default site.`,
    );
  }
  // Staging-only guard: refuse the whole plan if any input points at a production storefront.
  const prod = new Set<string>();
  for (const tc of plan.cases) {
    const texts = [tc.baseUrl, tc.testData, tc.steps, ...tc.keywordSteps.flatMap((s) => [s.target, s.value])];
    for (const u of texts.flatMap(urlsIn)) if (isProductionUrl(u)) prod.add(`${tc.id}: ${u}`);
  }
  if (prod.size) {
    throw new Error(`${PRODUCTION_MESSAGE}\n  ${[...prod].slice(0, 15).join('\n  ')}${prod.size > 15 ? `\n  ... and ${prod.size - 15} more` : ''}\n  Run "npm run env:staging" to move site workbooks to staging.`);
  }
  writePlan(plan);

  const runs = plan.cases.flatMap((tc) => tc.platforms.map((p) => ({ tc, p, scripted: isScriptedFor(tc, p) })));
  const scripted = runs.filter((r) => r.scripted).length;
  const neg = plan.cases.filter((c) => /neg/i.test(c.type)).length;
  console.log(`[plan] Workbook : ${relToRoot(workbook)}`);
  console.log(`[plan] Platforms: ${plan.platforms.join(', ')}`);
  console.log(`[plan] Cases    : ${plan.cases.length} (${plan.cases.length - neg} positive, ${neg} negative)`);
  console.log(`[plan] Runs     : ${runs.length} case x platform = ${scripted} scripted + ${runs.length - scripted} AI/MCP`);
  for (const p of plan.platforms) {
    const r = runs.filter((x) => x.p === p);
    console.log(`           ${p.padEnd(8)} ${String(r.length).padStart(3)} runs, ${r.filter((x) => x.scripted).length} scripted`);
  }
  if (process.env.VERBOSE) {
    for (const tc of plan.cases) {
      const how = tc.platforms.map((p) => `${p}:${isScriptedFor(tc, p) ? 'script' : 'AI'}`).join(' ');
      console.log(`  ${tc.id.padEnd(8)} ${(tc.priority || '').padEnd(3)} ${(tc.type || '').padEnd(9)} ${how}`);
    }
  }
  const urls = [...new Set(plan.cases.map((c) => c.baseUrl).filter(Boolean))];
  console.log(`[plan] Target URL(s): ${urls.join(', ') || '(none)'}   (VERBOSE=1 lists every case)\n`);
}

main().catch((e) => {
  console.error(`[plan] ${e.message ?? e}`);
  process.exit(1);
});
