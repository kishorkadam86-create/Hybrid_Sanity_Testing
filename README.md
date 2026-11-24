# Hybrid_Sanity_Testing
Hybrid_Sanity_Testing for AI Project

## E-commerce Sanity Run: Hybrid Framework (Web + Mobile Web)

One Excel workbook drives two execution layers on three platforms:

| Platform | How it runs |
|---|---|
| **Web** | Desktop Google Chrome, 1366x768 |
| **Android** | Mobile web: Chrome engine, Pixel 7 emulation (viewport, touch, Android user agent) |
| **iOS** | Mobile web: WebKit (Safari engine) with iPhone 15 emulation, or Chrome with iPhone emulation where WebKit can't run (Config `iOS Engine`) |

```
                         MyShop_TestCases.xlsx
 Config | Test Cases | Execution Results | Defect Log | Keywords | Object Repository
        │                                         ▲
        ▼                                         │ results after every test, per platform
  npm run plan ──► Script engine (npm test) ──────┤
                   Playwright TS, keyword +       │
                   data-driven, Web/Android/iOS   │
                        │ not scripted / stale    │
                        ▼ locator / "AI" step     │
                 .hybrid/ai-queue.json            │
                 (one item per case x platform)   │
                        ▼                         │
                 Claude + Playwright MCP ─────────┘  npm run ai -- record --platform ...
                        │ passed & stable
                        ▼
                 npm run ai -- promote  ──► new rows in Keywords (scripted next run)
```

## Site workbooks (staging environments)
**All runs target STAGING. Production is never tested.** One workbook per site **and store** in `workbooks/`, built by `npm run build:sites` from `src/sites.ts`. Rerunning the build only adds what's missing; nothing you've edited is overwritten.

| Site | Staging (English / Arabic) | English workbook | Arabic workbook | Platforms |
|---|---|---|---|---|
| Petit Bateau UAE | `mcstaging.petit-bateauuat.com/en/` · `/ar/` | `PetitBateau_UAE_Sanity.xlsx` (79) | `PetitBateau_UAE_AR_Sanity.xlsx` (78) | Web, Android, iOS |
| Petit Bateau KSA | `mcstaging-ksa.petit-bateauuat.com/en/` · `/ar/` | `PetitBateau_KSA_Sanity.xlsx` (80) | `PetitBateau_KSA_AR_Sanity.xlsx` (79) | Web, Android, iOS |
| Nanan UAE | `mcstaging.nananuat.com/en/` · `/ar/` | `Nanan_UAE_Sanity.xlsx` (79) | `Nanan_UAE_AR_Sanity.xlsx` (78) | Web, Android, iOS |
| BinSina Pharmacy UAE | `mcstaging-ind.binsina.ae/en/` · `/ar/` | `BinSina_UAE_Sanity.xlsx` (106) | `BinSina_UAE_AR_Sanity.xlsx` (83) | Web, Android, iOS (+ native apps in the English workbook) |
| Holland & Barrett UAE | `mcstaging-ind.hollandandbarrett.ae/en/` (English only in scope) | `HollandBarrett_UAE_Sanity.xlsx` (79) | none (Arabic out of scope) | Web, Android, iOS |
| Superdry UAE | `mcstaging.superdry.ae/` (English only) | `Superdry_UAE_Sanity.xlsx` (74) | none (no Arabic store) | Web, Android, iOS |

**Total: 10 workbooks, 815 cases, 2,362 runs (case x platform), 725 scripted. P1 only: 932 runs (234 scripted).**

**Holland & Barrett Arabic: out of scope** (client decision, 16 Nov). On staging, its `/ar/` also redirects to BinSina's Arabic site. If it comes back into scope, set `arUrl` for `hnb` in `src/sites.ts` and run `npm run build:sites -- hnb`.

**Staging-only guard:** `src/guard.ts` blocks the production hosts (`www.petit-bateau.ae`, `www.petit-bateau.sa`, `www.nanan.ae`, `www.binsina.ae`, `www.hollandandbarrett.ae`, `www.superdry.ae`):
- `npm run plan` refuses any workbook with a production URL in its Base URL, test data, steps or keywords.
- The engine stops (Blocked) if a step would open, or redirect to, a production page.
- Workbooks built before the switch are moved over with `npm run env:staging`, which backs up first and rewrites input sheets only, never results.

**Arabic stores:**
- Arabic workbooks use Arabic search terms and Arabic-aware message patterns.
- Their Config has **Text Check Failures = AI confirm**: a failed `VerifyText` / `VerifyTitle` goes to the AI queue to be checked against the page, instead of raising a defect from an English-worded pattern.

Select a store: `$env:WORKBOOK='binsina'` is the English store, and `$env:WORKBOOK='binsina:ar'` (or `$env:STORE='ar'`) is the Arabic store.

**Sign-in differs per site (checked on the live sites, 13 Nov; recheck on staging):** Petit Bateau UAE/KSA, Nanan, BinSina and Holland & Barrett sign in with a **mobile number + OTP** (plus Apple/Google); only **Superdry** uses email + password. Account cases follow each site's method. OTP cases need a test mobile number (`SITE_MOBILE`).

What the suites cover:
- **Every site:** home and navigation, 404 page, HTTPS redirect, mobile layout, currency and VAT, Arabic/RTL (where offered), search (results, no results, script injection, empty, long and special characters), category listing (sort, filters, empty state), product detail, cart (quantity 0, -1, abc and 999; coupons; empty cart; checkout blocked when empty), account (login and registration validation, wrong password, SQL injection, protected pages), checkout validation, payment methods, and newsletter or store locator where available.
- **Fashion sites:** size required, out-of-stock size, size guide, colour swatches.
- **BinSina:** prescription upload (wrong file type, oversize, prescription-only medicine), Tabby/Tamara, express-delivery address, plus **22 native-app cases** (permissions denied, offline mode, deep links, camera upload, Android Back button, cart sync between app and web).
- **Holland & Barrett:** supplement information, multi-buy offers applied or not applied, Health Hub.

Run a site by name: `$env:WORKBOOK='binsina'; npm test` (any part of the file name works). Each site keeps its own plan, AI queue, screenshots (`screenshots/<site>/`), report (`playwright-report/<site>/`) and results, so sites can run side by side.

> **Environment safety:** runs are staging-only, and production hosts are blocked by the framework. Cases that place an order or take a payment are marked **TEST/STAGING ONLY** with Execution Mode **AI**. Run them only with the staging payment provider in test mode. The scripted negative checks only use made-up data (`qa-not-registered-0001@example.com`).

**Native apps (BinSina):** `Android App` and `iOS App` are device platforms. Playwright only drives browsers, so app cases are queued for **manual or device-automation** execution. Record each result with `npm run ai -- record --tc BS_TC_0xx --platform "Android App" --status Pass --actual "..."`. They appear in `Android App Status` / `iOS App Status` and in the Defect Log like any other platform.

## Test suite (MyShop template workbook)
**56 sanity cases: 27 positive, 29 negative.** Each case has a **Test Type**, **Priority** (P1 to P3) and **Platform**:

- `All` means Web, Android and iOS.
- `Mobile` means Android and iOS.
- A list such as `Web, iOS` also works.

There are 162 case-and-platform runs in total. Areas covered: Home and navigation, Search (including script-injection, empty, long and case checks), category listing (sort, filter, empty state), product detail (variants, out-of-stock, invalid URL), Cart (quantity 0, -1, abc and 9999; coupons; empty cart), Account (wrong password, unregistered email, empty fields, SQL injection, masking, logout) and Checkout (required fields, declined or expired test cards, double submit, session expiry).

Mobile-only cases cover the hamburger menu, horizontal scrolling, landscape rotation, gallery swipe, the reachable Add to Cart button and the email keyboard.

## 1. One-time setup

```bash
npm install
```
```bash
npm run setup:workbook
```
`setup:workbook` is idempotent and makes a backup first. It adds missing Config keys, the Test Type / Priority / Platform columns, `<Platform> Status` columns, catalogue cases whose IDs are missing, keyword seeds, locators and the Keyword Reference sheet. It never overwrites what you have edited.

Browsers:
- Web and Android use the installed Google Chrome.
- For the Safari engine on iOS, run `npx playwright install webkit` and keep `iOS Engine = webkit`. If your machine blocks WebKit from starting (app-control or antivirus policy), set `iOS Engine = chromium`.
- Emulation is not a real device. For real iPhones and Android phones, use a device cloud (LambdaTest or BrowserStack) or the AI layer on a real device.

Secrets (never put them in the workbook): `MYSHOP_EMAIL`, `MYSHOP_PASSWORD`, `MYSHOP_TEST_COUPON`, `TEST_CARD_VALID`, `TEST_CARD_DECLINED` (the payment provider's published **test-mode** cards only).

## 2. Run

| Command (PowerShell) | Does |
|---|---|
| `npm run plan` | Shows cases, platforms and the scripted vs AI split (`$env:VERBOSE=1` lists every case) |
| `npm test` | Script engine on every selected platform; writes results after each test and builds the AI queue |
| `$env:PLATFORM='Mobile'; npm test` | Only Android and iOS (`Web`, `Android`, `iOS`, `Web,iOS` ...) |
| `$env:PRIORITY='P1'; npm test` | Only P1 cases. Also `$env:TYPE='Negative'`, `$env:SECTION='Cart'`, `$env:TC='TC_001,TC_039'` |
| `npm run test:headed` | Same as `npm test`, with a visible browser |
| `npm run report` | Playwright HTML report (one project per platform; traces and screenshots) |
| `npm run ai -- queue [--platform Android]` | Case-and-platform runs waiting for Claude/MCP, with the device to emulate |
| `npm run ai -- record --tc ... --platform ... --status ... --actual ...` | Write an AI result |
| `npm run ai -- promote --tc ... --file ...` | Turn an AI run into keyword steps (optional per-step `platform`) |
| `npm run build:sites` | Create or top up the store workbooks in `workbooks/` from `src/sites.ts` |
| `npm run env:staging` | Move older workbooks from production URLs to staging (backs up first) |
| `npm run report:excel` | Consolidated execution report across all store workbooks: `docs/reports/Hybrid_QA_Execution_Report_<date>.xlsx` (Summary, By Platform, Failures, Blocked, AI Pending, Defects, All Results) |
| `$env:SECTION='Account'; $env:WORKERS='1'; npm test` | OTP sign-in cases. They share one staging test number (`SITE_MOBILE` / `SITE_OTP` from a git-ignored `.env.local`), so run them with **one worker**; parallel runs cancel each other's OTP |
| `npm run master` | Rebuild the consolidated test-case sheets in `docs/`: `Hybrid_QA_Master_TestCases.xlsx` (all sites), `Hybrid_QA_TestCases_BinSina_HnB.xlsx` (BinSina + Holland & Barrett) and `Hybrid_QA_TestCases_PB_Nanan_Superdry.xlsx` (Petit Bateau UAE/KSA, Nanan, Superdry). Each has Overview, All Test Cases and By Section tabs |

**Dashboard UI (`ui/`, deployed on Vercel):** a read-only web dashboard with two projects:
- **BinSina:** BinSina English and Arabic, plus Holland & Barrett.
- **Fashion:** Petit Bateau UAE and KSA, Nanan, and Superdry.

Each project has an overview (per store, platform and section), a filterable test-case list with per-platform results, defects, and the AI / manual queue. The data is a snapshot of the workbooks:
- After a test run: `npm run ui:data`, then commit `ui/public/data/` and redeploy.
- Local preview: `npm run ui:dev`.
- Build: `npm run ui:build`.
- The export refuses production URLs and never includes credentials. Steps keep their `${env.*}` placeholders.

Vercel project settings: Root Directory `ui`, Framework Vite (see `ui/vercel.json`).

**Getting started (VS Code):** clone the repo, run `npm install`, then `npm run plan` with `$env:WORKBOOK='binsina'` (or any site; add `:ar` for the Arabic store). Credentials are never stored in the repo: set them as environment variables (for example `SITE_MOBILE`, `SITE_PASSWORD`).

## 3. Where results go

| Sheet | Content |
|---|---|
| **Test Cases** | `Web Status`, `Android Status`, `iOS Status`, plus the rolled-up **Status** (worst of the platforms: Fail, then Blocked, then AI Pending, then Pass), a per-platform Actual Result, and defect links |
| **Execution Results** | One row per case and platform: status, actual result, defect, screenshot, date, executed by and via |
| **Defect Log** | One defect per distinct failure. The **Platform** column lists every platform affected (the same failure on Android and iOS is one defect). A retest pass removes that platform, and the defect becomes *Retest Passed* when none are left. |

Screenshots are named `screenshots/<TC>_<Platform>_<fail|blocked>_<date>.png`. A backup is made before every run.

## 4. Writing steps for several platforms
- **Keywords → Platform** (optional): blank means the step runs everywhere; `Mobile`, `Web`, `Android` or `iOS` limits it. Example: `Hover "Menu"` for Web and `Tap "Menu Icon"` for Mobile in the same case.
- **Object Repository → Mobile Locator** (optional): used on Android and iOS instead of `Locator`.
- Mobile keywords: `Tap`, `SetViewport` (landscape, portrait or WxH), `VerifyNoHorizontalScroll`. Negative or security keywords: `VerifyNoDialog` (no script ran), `VerifyAttribute` (for example `type=password`).

## 5. Execution Mode (per row)

| Mode | Behaviour |
|---|---|
| **Hybrid** (default) | Script where keywords exist; a stale locator or `AI` step hands that platform's run to Claude |
| **Script** | Script only; problems mean Blocked |
| **AI** | Always Claude through MCP |

## 6. Files

| Path | Role |
|---|---|
| `src/catalog.ts` | The sanity test-case catalogue (positive, negative, mobile) and keyword seeds |
| `src/keywords.ts` | Keyword engine and locator strategies (platform-aware) |
| `playwright.config.ts` | One Playwright project per platform (Web / Android / iOS) |
| `tests/hybrid.spec.ts` | One test per scripted case; each platform project runs its own copy |
| `src/excel-reporter.ts`, `src/results.ts` | Excel write-back, Execution Results, Defect Log, AI queue |
| `src/cli/ai.ts` | Claude's bridge: queue / record / promote |
| `src/cli/setup-workbook.ts` | Idempotent workbook upgrade |
| `Playwright Autorun.md`, `Prompt.md` | AI-layer rules and kickoff prompt |

> The seeded locators are generic e-commerce guesses. Check them against the real storefront, or let the AI layer promote better ones.
