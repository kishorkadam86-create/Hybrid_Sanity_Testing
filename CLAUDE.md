# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **hybrid e-commerce sanity-test framework**: an Excel workbook is the single source of truth for test cases, and a Playwright/TypeScript engine executes them across three browser platforms (Web, Android mobile web, iOS mobile web). Steps the engine can't script (stale locators or explicit `AI` steps) are queued for a Claude + Playwright MCP fallback layer, whose verified results can be promoted back into the workbook as keyword steps. Native-app cases (BinSina) are queued for manual/device execution — Playwright never runs them.

Read `README.md` first — it is the detailed user manual. This file covers what isn't obvious from it.

## Repo root vs. working directory

**Run every npm command from the repo root, `C:\Workspace\Hybrid_Sanity_Testing`** — all source and `package.json` live there. `cd` to the repo root before running anything.

`C:\Workspace\Hybrid_Sanity_Testing\docs` is **only for maintaining documents and reports** (project plans, input checklists, consolidated test-case workbooks, and the generated execution reports under `docs/reports/`). Never run npm commands from `docs/`.

## Commands (PowerShell; run from repo root)

| Command | Purpose |
|---|---|
| `npm install` | Install deps (Playwright, exceljs, tsx) |
| `npm run setup:workbook` | Idempotent workbook upgrade — adds missing Config keys/columns/cases; never overwrites edits; backs up first |
| `npm run plan` | Read the selected workbook → write `.hybrid/<site>/plan.json`. Shows scripted-vs-AI split. Enforces the staging guard |
| `npm test` | `plan` + run Playwright on every selected platform; writes results back to the workbook and builds the AI queue |
| `npm run test:headed` | Same, visible browser |
| `npm run typecheck` | `tsc --noEmit` — the only static check (no ESLint/Prettier configured) |
| `npm run report` | Open the Playwright HTML report |
| `npm run build:sites` | Create/top-up the per-store workbooks in `workbooks/` from `src/sites.ts` |
| `npm run env:staging` | Rewrite older workbooks from production URLs to staging (backs up first) |
| `npm run master` / `npm run report:excel` | Rebuild consolidated test-case sheets / execution report in `docs/` |
| `npm run ai -- queue \| record \| promote` | The Claude↔workbook bridge (see below) |

### Selecting what runs (env vars, PowerShell `$env:`)

- **Site:** `$env:WORKBOOK='binsina'` (substring match on the workbook filename). Arabic store: `$env:WORKBOOK='binsina:ar'` or `$env:STORE='ar'`. With no `WORKBOOK`, it uses the single `.xlsx` in the repo root.
- **Filters (comma-separated):** `TC`, `SECTION`, `PRIORITY`, `TYPE`, `PLATFORM` (e.g. `Web`, `Mobile`, `Web,iOS`). These are consumed by `npm run plan`.
- **Run a single case:** `$env:TC='TC_001'; npm test` (the plan filter selects it; don't pass `-g` to Playwright directly, since the plan drives which tests exist).
- **Parallelism:** `$env:WORKERS=4`. Default is **1 worker** (sequential). **OTP sign-in cases must use one worker** — they share a single staging test number, so parallel runs cancel each other's OTP.

## Architecture

### Data flow
```
workbook (.xlsx) ──plan──► .hybrid/<site>/plan.json ──► Playwright (one project per platform)
   ▲                                                         │ pass/fail/blocked → excel-reporter
   │ record / promote                                        │ stale locator / AI step
   └──── Claude + Playwright MCP ◄── .hybrid/<site>/ai-queue.json
```

Everything keys off the **workbook**. `src/paths.ts` derives a `siteKey` from the workbook filename and gives every site its own folder for plan, AI queue, screenshots (`screenshots/<site>/`), report (`playwright-report/<site>/`) and results — so multiple sites run side by side without clobbering each other.

### Key modules (in `src/`)
- `sites.ts` — declarative catalogue of the 6 storefronts (all Magento). Each `Site` carries staging URLs, production host (for the guard), currency/VAT, auth method (`otp` vs `password`), and feature flags (`f.*`) that switch cases on/off. `build-sites` expands these into per-store workbooks.
- `catalog.ts` / `upgrade.ts` — the base sanity test-case catalogue and keyword/locator seeds; `upgrade.ts` is how `setup:workbook` adds missing content idempotently.
- `plan.ts` + `plan-file.ts` — build the plan from a workbook (applying filters), decide per `(case × platform)` whether it's scripted, and read/write plan + queue JSON.
- `keywords.ts` — the keyword engine: maps a Keywords-sheet row to Playwright actions/assertions. Classifies failures into `assert` (→ Fail/defect), `blocked`, `locate` (→ AI Pending in Hybrid, Blocked in Script), `handoff` (explicit `AI` step → AI Pending). Platform-aware locators (`Mobile Locator` used on Android/iOS).
- `tests/hybrid.spec.ts` — the **only** spec. Generates one test per scripted `(case × platform)`; each Playwright project (Web/Android/iOS) selects its tests by `@web`/`@android`/`@ios` tags. Non-scripted combinations never become tests — they go to the AI queue via the reporter.
- `excel-reporter.ts` / `results.ts` — write results back to the **Test Cases**, **Execution Results**, and **Defect Log** sheets, and emit the AI queue.
- `workbook.ts` — sheet names (`SHEET.*`: Test Cases, Defect Log, Config, Keywords, Object Repository, Keyword Reference, Execution Results) and ExcelJS helpers.
- `guard.ts` — the staging-only guard (see below).
- `cli/*.ts` — thin entry points; all run via `tsx` (TS executed directly, `noEmit`).

### Execution modes (per workbook row)
`Hybrid` (default: script where keywords exist, hand off otherwise) · `Script` (script only; gaps = Blocked) · `AI` (always Claude/MCP). Rolled-up **Status** per case = worst platform (Fail > Blocked > AI Pending > Pass).

## Staging-only guard — do not bypass

Runs **must never touch production storefronts.** `src/guard.ts` + `PROD_HOSTS` (from `sites.ts`) enforce this at three points: `npm run plan` refuses any plan containing a production URL; the engine Blocks if a step lands on/redirects to production; `env:staging` migrates old workbooks. The **only** override is `ALLOW_PRODUCTION=1`, and it should be used only with written approval. Never add production hosts to test data, and never weaken the guard.

## AI fallback layer (Claude + Playwright MCP)

When asked to clear the AI queue, the loop is:
1. `npm run ai -- queue [--platform Android]` — list pending `(case × platform)` runs with the device to emulate.
2. Execute each in the browser via Playwright MCP against the **staging** URL.
3. `npm run ai -- record --tc <id> --platform <p> --status <Pass|Fail|...> --actual "..."` — write the result (and optional `--title`, `--severity`, `--screenshot`, `--steps`).
4. `npm run ai -- promote --tc <id> --file <steps.json>` — turn a verified run into reusable keyword steps + locators so it's scripted next time.

Rules for this layer live in `Playwright Autorun.md` and `Prompt.md`. Notable constraints: **never solve CAPTCHAs** (a visible CAPTCHA → human needed, not a defect), native-app platforms are always recorded `--via Manual`, and payment/order cases are STAGING + test-mode only.

## Secrets

Never put credentials in the workbook or commit them. They come from environment variables / a git-ignored `.env.local` (e.g. `SITE_MOBILE`, `SITE_OTP`, `SITE_PASSWORD`; template suite uses `MYSHOP_EMAIL`, `TEST_CARD_*`). Scripted negative checks use only fake data (e.g. `qa-not-registered-0001@example.com`).

## Conventions

- **Never overwrite a user's edited workbook content.** `setup:workbook` and `build:sites` are strictly additive and back up before writing; preserve that contract in any change to `upgrade.ts` / `build-sites.ts`.
- Results sheets are write-back targets — `env:staging` and setup rewrite *input* sheets only, never results.
- Browsers: Web/Android use installed Google Chrome; iOS uses WebKit unless Config `iOS Engine = chromium`. Emulation ≠ real device.
