---
name: playwright-autorun
description: Hybrid execution of Excel-based sanity test cases. A keyword + data-driven Playwright (TypeScript) engine runs every case that has keyword steps; Claude runs the rest through Playwright MCP on a real Chrome session, writes results back into the same workbook, and promotes stable AI runs into keyword steps. Use when the user provides a test-case workbook and asks to run, execute or automate it, update result columns, or log defects with screenshots. Site-agnostic: the target URL comes from the workbook (Base URL column or Config sheet) or the prompt.
---

# Playwright Autorun: Hybrid engine

Two layers share one workbook:

| Layer | Runs | Strength |
|---|---|---|
| **Script engine** (`npm test`) | Rows with keyword steps in the **Keywords** sheet | Fast, repeatable, CI-friendly, no AI cost |
| **AI layer** (Claude + Playwright MCP) | Rows in `.hybrid/ai-queue.json` | Handles new, unscripted, changed or judgement-heavy cases |

Every case has an **Execution Mode** on the Test Cases sheet:

- **Hybrid** (default): script first. If an action step can't find or use its element (often a stale locator), the case goes to the AI queue instead of being marked Blocked.
- **Script**: script only. Never queued for AI. Missing steps or locator failures mean **Blocked**.
- **AI**: always run by Claude through MCP.

## Prerequisites

1. Node.js 18+ (`node --version`). Run `npm install` once in this folder.
2. Google Chrome installed (Config: `Browser Channel = chrome`). Or set it to `chromium` and run `npx playwright install chromium`.
3. For the AI layer: a Playwright MCP server connected (tools named like `mcp__playwright__browser_*`). If none is connected, use `search_mcp_registry` / `suggest_connectors` to help connect one. **Never simulate browser actions.**
4. The workbook has been upgraded once with `npm run setup:workbook` (adds Config, Keywords, Object Repository and Keyword Reference sheets; idempotent).

## Target URL resolution (no default site)

1. The row's `Base URL` column, then the **Config** sheet's `Base URL`.
2. A `Navigate` keyword (or a URL in the test steps) overrides it for that case only.
3. The `BASE_URL` environment variable / the user's prompt.
4. If none: ask the user once. Never reuse a previous project's site.
5. Never a production storefront. `npm run plan` refuses production hosts (`src/guard.ts`); if a user supplies a production URL, ask for the staging one.

## Workflow (Claude)

### 1. Prepare
- Run `npm run plan`. It prints cases, platforms (Web / Android / iOS), the scripted vs AI split and the target URL. State the URL source to the user.
- Confirm the scope unless the user already gave it. Filter with env vars: `$env:PLATFORM='Mobile'`, `$env:PRIORITY='P1'`, `$env:TYPE='Negative'`, `$env:SECTION='Cart'`, `$env:TC='TC_001,TC_002'`.

### 2. Run the script layer
- `npm test` (PowerShell: `$env:TC='...'; npm test` for a subset). `npm run test:headed` to watch.
- The Excel reporter writes **Status, Actual Result, Screenshot, Defect ID, Execution Date, Executed By, Executed Via** after **each** test, appends or updates the **Defect Log** for Fail, and backs the workbook up to `backups/` first.
- At the end it writes `.hybrid/ai-queue.json` and marks those rows **AI Pending**.

### 3. Run the AI layer (only what is queued)
- `npm run ai -- queue` lists each queued **case and platform**: why it is queued, which device to emulate, URL, steps, data and expected result. Filter with `--platform Android`.
- Work through the queue **one platform at a time**, and set the browser up for that platform first:
  - **Web:** desktop window, 1366x768.
  - **Android:** phone viewport, about 412x839, with touch. Start Playwright MCP with `--device "Pixel 7"`, or use `browser_resize` to 412x839 when no device option is available.
  - **iOS:** iPhone viewport, about 393x659. Start Playwright MCP with `--device "iPhone 15"` (and `--browser webkit` where WebKit can run).
  - State in the Actual Result which device or viewport was used. Emulation is not a real device; never call it one.
- For each run, drive the browser with the MCP tools: navigate, act on the literal Test Steps / Test Data, verify with `browser_snapshot` (accessibility tree). Screenshots are evidence, not the verification method.
- Mobile conventions: menus usually sit behind a hamburger icon; filters behind a "Filter" button; tap rather than hover.
- Search convention: if the search box sits behind a magnifying-glass icon, click the icon first. Let the snapshot decide.
- **Negative cases:** the expected result is a graceful rejection (validation message, error message, nothing created). A Pass needs that message (or blocked action) to be observed. A crash, stack trace, raw database error or script execution is a **Fail**. Never use real cards or real personal data; payment cases use the provider's test mode only.
- On Fail/Blocked: `browser_take_screenshot` to `screenshots/<TC_ID>_<Platform>_<fail|blocked>_<yyyymmdd>.png`. If saving the PNG fails, say so in the Actual Result; never claim evidence that doesn't exist.
- Record **immediately after each run** (no Python needed):
  ```
  npm run ai -- record --tc TC_032 --platform Android --status Fail --actual "Quantity accepted -1; subtotal shows -EUR 12.99" --title "Cart: negative quantity accepted" --steps "1. On Android mobile browser, open ...\n2. ..." --severity High --screenshot screenshots/TC_032_Android_fail_20261112.png
  ```
  Status: `Pass` | `Fail` | `Blocked`. A Fail creates or updates the Defect Log. The same failure on another platform is added to the same defect's **Platform** list; a later Pass removes that platform, and the defect becomes *Retest Passed* when none are left.

### 3b. Staging only, stores and native apps
- **Staging only.** The site workbooks (`workbooks/`) point at the **staging** environments, and production must never be opened. If any MCP navigation, link or redirect lands on a production host (`www.petit-bateau.ae`, `www.petit-bateau.sa`, `www.nanan.ae`, `www.binsina.ae`, `www.hollandandbarrett.ae`, `www.superdry.ae`), stop that run at once, go back, and record it as `Blocked` with the URL. Report it as a staging configuration issue. Never type data on a production page.
- Cases whose Pre-Condition says **TEST/STAGING ONLY** (orders, payments) may run on staging only when the payment provider is confirmed to be in test mode. Otherwise record `Blocked` ("payment test mode not confirmed").
- **Arabic stores** have their own workbooks (`*_AR_Sanity.xlsx`; select one with `$env:WORKBOOK='<site>:ar'`). On an Arabic store, judge messages by their meaning in Arabic, not by English wording. Queue items marked "Text check failed" mean the English-worded pattern did not match: open the page and record **Pass** if the expected message or title is there in Arabic, or **Fail** if it is not.
- Ignore site dialogs that are not the test payload (for example BinSina staging's `"Selected store: EMR"` alert), and mention them in the Actual Result.
- `Android App` / `iOS App` items (BinSina) are native-app checks. Playwright MCP cannot drive native apps: do not simulate them. List them for the tester (`npm run ai -- queue --platform "Android App"`) and record what the tester reports with `--via Manual`.
- Run one site at a time: `$env:WORKBOOK='<site name>'`. Each site has its own queue, screenshots and report.

### 4. Promote (turn AI runs into scripts)
When a case passed through MCP and its locators were stable, write `.hybrid/<TC_ID>.steps.json` from the elements you used (prefer `role`, `label`, `testid` over brittle CSS) and run:
```
npm run ai -- promote --tc TC_005 --file .hybrid/TC_005.steps.json
```
```json
{ "steps": [ { "keyword": "Click", "target": "First Product Card" },
             { "keyword": "VerifyVisible", "target": "Add To Cart Button" } ],
  "locators": [ { "name": "Add To Cart Button", "strategy": "role", "locator": "button|/add to cart/i" } ] }
```
At least one `Verify*` step is required. From then on the script engine runs the case, so the AI queue shrinks with every cycle.

### 5. Wrap up
- Re-run `npm test` for promoted cases if time allows, to prove the new scripts pass.
- Summary in chat: total runs, Pass / Fail / Blocked **per platform** (Web / Android / iOS), positive vs negative failures, scripted vs AI, any Critical/High defects, and cases promoted. Don't paste the whole Defect Log.
- Point to: the workbook, `screenshots/`, `playwright-report/` (`npm run report`), and `backups/`.

## Status rules

| Status | Meaning |
|---|---|
| **Pass** | Every Verify step / the expected result was observed. |
| **Fail** | A Verify step / expected result contradicted the page: a real defect, logged in the Defect Log. |
| **Blocked** | Environment or test-design issue: site down, missing data or credentials, unknown keyword, missing precondition. |
| **AI Pending** | Waiting for the AI layer. Must not remain at the end of a full run. |

## Conventions
- Never invent an actual result. Every status comes from an observed action or snapshot.
- Steps to reproduce are numbered, literal and replayable.
- Credentials: never put real passwords in the workbook. Use `${env.MYSHOP_PASSWORD}` in Keywords and set the variable locally.
- If the workbook is open in Excel, results go to a `*.results-<time>.xlsx` side file. Tell the user.
- If Playwright MCP isn't available and the user declines to connect it, run the script layer only and leave the queue for later. Do not fabricate AI results.
