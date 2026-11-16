Prompt:

Act as a QA Lead. Run the sanity test cases in this folder's workbook using the hybrid framework described in "Playwright Autorun.md", on desktop Web and on mobile web for Android and iOS.

Test environment: <PASTE THE TARGET SITE URL HERE>
(Leave blank if the workbook already has it: "Base URL" column on the Test Cases sheet, or "Base URL" on the Config sheet. There is no default site.)

Scope: <all | PLATFORM=Mobile | PRIORITY=P1 | TYPE=Negative | SECTION=Cart | TC_001,TC_039>

1. Run `npm run plan`, tell me the target URL, the platforms, and how many runs are scripted vs AI, and confirm scope.
2. Run the script layer: `npm test`. Results, defects and screenshots are written into the workbook after each test, per platform.
3. Run the AI layer: for every item in `npm run ai -- queue`, set up the browser for that item's platform (desktop, Android phone or iPhone emulation), execute the literal steps through Playwright MCP, verify with the page snapshot, capture a screenshot on Fail/Blocked, and record each result immediately with `npm run ai -- record --platform ...`.
   - For "Search" cases: if the search box is behind a search icon, click the icon first; otherwise type into the visible box.
   - For negative cases: Pass only when the graceful rejection (message or blocked action) is actually seen.
4. Promote AI runs that passed with stable locators to keyword steps (`npm run ai -- promote ...`), using per-step platform where mobile differs from desktop.
5. Give me a short summary: total runs, Pass / Fail / Blocked per platform, positive vs negative failures, scripted vs AI, cases promoted, and any Critical/High defects. Point me to the updated workbook, screenshots/ and the HTML report.
