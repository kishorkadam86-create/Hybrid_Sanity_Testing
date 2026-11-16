// Sanity test-case catalogue used by "npm run setup:workbook".
// Rows are only ADDED when their Test Case ID is missing, so edits made in Excel are never overwritten.
// Platform: "All" = Web + Android + iOS; "Mobile" = Android + iOS.

export interface CatalogCase {
  id: string;
  section: string;
  scenario: string;
  type: 'Positive' | 'Negative';
  priority: 'P1' | 'P2' | 'P3';
  platform: string;
  pre: string;
  steps: string;
  data: string;
  expected: string;
  /** Execution Mode for the new row (default Hybrid). */
  mode?: 'Hybrid' | 'Script' | 'AI';
}

/** Classification for the 10 original cases (their text already exists in the workbook). */
export const ORIGINAL_META: Record<string, Pick<CatalogCase, 'type' | 'priority' | 'platform'>> = {
  TC_001: { type: 'Positive', priority: 'P1', platform: 'All' },
  TC_002: { type: 'Positive', priority: 'P1', platform: 'All' },
  TC_003: { type: 'Negative', priority: 'P2', platform: 'All' },
  TC_004: { type: 'Positive', priority: 'P2', platform: 'All' },
  TC_005: { type: 'Positive', priority: 'P1', platform: 'All' },
  TC_006: { type: 'Positive', priority: 'P1', platform: 'All' },
  TC_007: { type: 'Positive', priority: 'P2', platform: 'All' },
  TC_008: { type: 'Positive', priority: 'P2', platform: 'All' },
  TC_009: { type: 'Positive', priority: 'P1', platform: 'All' },
  TC_010: { type: 'Positive', priority: 'P1', platform: 'All' },
};

const c = (
  id: string, section: string, scenario: string, type: CatalogCase['type'], priority: CatalogCase['priority'],
  platform: string, pre: string, steps: string[], data: string, expected: string,
): CatalogCase => ({ id, section, scenario, type, priority, platform, pre, steps: steps.map((s, i) => `${i + 1}. ${s}`).join('\n'), data, expected });

export const NEW_CASES: CatalogCase[] = [
  // ---------------- Home / navigation ----------------
  c('TC_011', 'Home', 'Verify header navigation links open the correct pages', 'Positive', 'P2', 'All', 'User on homepage',
    ['Click each main navigation link (on mobile: open the menu first)', 'Check the page that opens'], '',
    'Each link opens the matching page with no error page or broken layout'),
  c('TC_012', 'Home', 'Verify a non-existent URL shows a 404 page', 'Negative', 'P2', 'All', 'Browser open',
    ['Open Base URL + "/qa-page-does-not-exist-404"'], '/qa-page-does-not-exist-404',
    "A friendly 'page not found' message with a way back to the homepage; no server error or stack trace"),
  c('TC_013', 'Mobile', 'Verify the hamburger menu opens and closes on mobile', 'Positive', 'P1', 'Mobile', 'User on homepage (mobile viewport)',
    ['Tap the menu (hamburger) icon', 'Check the categories are listed', 'Tap close / outside the menu'], '',
    'Menu slides open with categories; it closes fully and the page is usable again'),
  c('TC_014', 'Mobile', 'Verify there is no horizontal scrolling on mobile', 'Positive', 'P2', 'Mobile', 'Browser open (mobile viewport)',
    ['Open Base URL', 'Try to scroll the page sideways'], '',
    'Content fits the screen width; no horizontal scrollbar or cut-off content'),
  c('TC_015', 'Mobile', 'Verify layout after rotating to landscape', 'Positive', 'P3', 'Mobile', 'User on homepage (mobile viewport)',
    ['Rotate the device to landscape', 'Check header and content'], 'Viewport: landscape',
    'Layout adapts to landscape; header visible; no overlapping or cut-off elements'),
  c('TC_016', 'Home', 'Verify browser Back from a product returns to the listing', 'Positive', 'P3', 'All', 'User on a listing page',
    ['Open a product', 'Press browser Back'], '',
    'The listing page shows again, at the same position with the same filters'),

  // ---------------- Search ----------------
  c('TC_017', 'Search', 'Verify search input is safe against script injection', 'Negative', 'P1', 'All', 'User on homepage',
    ['Click the search icon', 'Type the test data', 'Press Enter'], '<script>alert(1)</script>',
    'No alert or popup runs; the term is shown as plain text or a no-results message is shown'),
  c('TC_018', 'Search', 'Verify empty search is handled', 'Negative', 'P2', 'All', 'User on homepage',
    ['Click the search icon', 'Leave the search box empty', 'Press Enter'], '',
    'No error page; the search stays open with a prompt, or a helpful message is shown'),
  c('TC_019', 'Search', 'Verify search is case-insensitive', 'Positive', 'P3', 'All', 'User on homepage',
    ['Search for the term in lower case', 'Search for the same term in upper case', 'Compare the results'], 'mug / MUG',
    'Both searches return the same products'),
  c('TC_020', 'Search', 'Verify a very long search term is handled', 'Negative', 'P3', 'All', 'User on homepage',
    ['Click the search icon', 'Type a 256-character term', 'Press Enter'], '256 x "a"',
    'No crash or server error; a no-results message or trimmed search is shown'),
  c('TC_021', 'Search', 'Verify leading and trailing spaces are ignored', 'Negative', 'P3', 'All', 'User on homepage',
    ['Search for "  mug  " (with spaces)'], '"  mug  "',
    "Same results as searching for 'mug'"),

  // ---------------- PLP ----------------
  c('TC_022', 'PLP', 'Verify sort by price low to high', 'Positive', 'P2', 'All', 'User on a category page',
    ['Open the sort options', "Choose 'Price: low to high'"], '',
    'Products are listed in ascending price order'),
  c('TC_023', 'PLP', 'Verify filtering by price range', 'Positive', 'P2', 'All', 'User on a category page',
    ['Open filters (on mobile: tap the Filter button)', 'Set a price range', 'Apply'], 'Price: 10 - 20',
    'Only products within the range are shown; the active filter is visible and can be cleared'),
  c('TC_024', 'PLP', 'Verify a filter combination with no matches', 'Negative', 'P2', 'All', 'User on a category page',
    ['Apply filters that no product matches'], 'e.g. Price 0 - 1 + colour not sold',
    "An empty-state message with an option to clear filters; no blank page or error"),
  c('TC_025', 'PLP', 'Verify pagination / load more', 'Positive', 'P3', 'All', 'Category with more products than one page',
    ["Scroll to the bottom", "Click 'Next' or 'Load more'"], '',
    'More products load; no duplicates; the product count updates'),

  // ---------------- PDP ----------------
  c('TC_026', 'PDP', 'Verify Add to Cart without choosing a required variant', 'Negative', 'P1', 'All', 'Product with size/colour options',
    ['Open the product', "Click 'Add to Cart' without choosing a size/colour"], '',
    'A validation message asks for the option; nothing is added to the cart'),
  c('TC_027', 'PDP', 'Verify an out-of-stock product cannot be bought', 'Negative', 'P1', 'All', 'An out-of-stock product exists',
    ['Open the out-of-stock product'], 'Out-of-stock product URL',
    "'Out of stock' is shown; Add to Cart is disabled or replaced by 'Notify me'"),
  c('TC_028', 'PDP', 'Verify an invalid product URL', 'Negative', 'P3', 'All', 'Browser open',
    ['Open Base URL + "/product/qa-invalid-000"'], '/product/qa-invalid-000',
    'A not-found page; no server error'),
  c('TC_029', 'Mobile', 'Verify product image gallery swipe on mobile', 'Positive', 'P2', 'Mobile', 'User on a product with several images',
    ['Swipe left on the main image', 'Swipe right'], '',
    'Images change with each swipe; the position indicator updates'),
  c('TC_030', 'Mobile', 'Verify Add to Cart button is reachable on mobile', 'Positive', 'P2', 'Mobile', 'User on a product page (mobile viewport)',
    ['Scroll the product page', 'Tap Add to Cart'], '',
    'Add to Cart stays visible (or sticky) and is large enough to tap; the item is added'),

  // ---------------- Cart ----------------
  c('TC_031', 'Cart', 'Verify quantity 0 is handled', 'Negative', 'P2', 'All', 'Cart has one item',
    ['Set the quantity to 0', 'Update the cart'], 'Qty = 0',
    'The item is removed, or a message says the minimum is 1; totals stay correct'),
  c('TC_032', 'Cart', 'Verify a negative quantity is rejected', 'Negative', 'P1', 'All', 'Cart has one item',
    ['Type -1 in the quantity field', 'Update the cart'], 'Qty = -1',
    'The value is rejected or reset to 1; totals never go negative'),
  c('TC_033', 'Cart', 'Verify a non-numeric quantity is rejected', 'Negative', 'P2', 'All', 'Cart has one item',
    ['Type "abc" in the quantity field', 'Update the cart'], 'Qty = abc',
    'The input is rejected; quantity and totals are unchanged'),
  c('TC_034', 'Cart', 'Verify quantity above available stock', 'Negative', 'P2', 'All', 'Cart has one item',
    ['Set the quantity to 9999', 'Update the cart'], 'Qty = 9999',
    'A message shows the maximum available; the quantity is capped'),
  c('TC_035', 'Cart', 'Verify cart persists after page refresh', 'Positive', 'P2', 'All', 'Cart has one item',
    ['Refresh the page', 'Open the cart'], '',
    'The same items and quantities are still in the cart'),
  c('TC_036', 'Cart', 'Verify an invalid coupon code', 'Negative', 'P1', 'All', 'Cart has one item',
    ['Enter the coupon code', 'Click Apply'], 'Coupon: INVALID-QA-000',
    "An 'invalid coupon' message; the total does not change"),
  c('TC_037', 'Cart', 'Verify a valid coupon applies the discount', 'Positive', 'P2', 'All', 'Cart has one item; a test coupon exists',
    ['Enter the coupon code', 'Click Apply'], 'Coupon: ${env.MYSHOP_TEST_COUPON}',
    'The discount line appears and the total is reduced correctly'),
  c('TC_038', 'Cart', 'Verify checkout is not possible with an empty cart', 'Negative', 'P1', 'All', 'Cart is empty',
    ['Open the cart', 'Try to proceed to checkout'], '',
    'An empty-cart message; Checkout is disabled or leads back to shopping'),

  // ---------------- Account ----------------
  c('TC_039', 'Account', 'Verify login with a wrong password', 'Negative', 'P1', 'All', 'A registered test account exists',
    ['Open the login page', 'Enter a valid email and a wrong password', 'Click Login'], 'Email: ${env.MYSHOP_EMAIL} / Password: Wrong@123',
    'An error message is shown; the user is not logged in; the message does not reveal which field was wrong'),
  c('TC_040', 'Account', 'Verify login with an unregistered email', 'Negative', 'P1', 'All', 'Login page open',
    ['Enter an unregistered email and any password', 'Click Login'], 'Email: not-registered-qa@example.com / Password: Any@1234',
    'A generic login-failed message; no account is created'),
  c('TC_041', 'Account', 'Verify login with empty fields', 'Negative', 'P1', 'All', 'Login page open',
    ['Leave email and password empty', 'Click Login'], '',
    "'Required' messages for both fields; no request is sent"),
  c('TC_042', 'Account', 'Verify invalid email format on login', 'Negative', 'P2', 'All', 'Login page open',
    ['Enter "user@", any password', 'Click Login'], 'Email: user@',
    "An 'enter a valid email' message"),
  c('TC_043', 'Account', 'Verify login rejects SQL injection', 'Negative', 'P1', 'All', 'Login page open',
    ['Enter the test data in email and password', 'Click Login'], "Email: ' OR '1'='1 / Password: ' OR '1'='1",
    'Login fails with a normal error message; no database error is shown'),
  c('TC_044', 'Account', 'Verify the password field is masked', 'Positive', 'P2', 'All', 'Login page open',
    ['Type a password'], 'Password: Test@123',
    'Characters are hidden; a show/hide toggle (if present) works'),
  c('TC_045', 'Account', 'Verify logout ends the session', 'Positive', 'P1', 'All', 'User logged in',
    ['Click Logout', 'Press browser Back'], '',
    'The user is logged out; Back does not show account pages without logging in again'),
  c('TC_046', 'Account', 'Verify registration with an existing email', 'Negative', 'P2', 'All', 'A registered test account exists',
    ['Open registration', 'Fill the form using the existing email', 'Submit'], 'Email: ${env.MYSHOP_EMAIL}',
    "An 'account already exists' message with a link to log in or reset the password"),
  c('TC_047', 'Account', 'Verify forgot-password with an unregistered email', 'Negative', 'P2', 'All', 'Login page open',
    ["Click 'Forgot password'", 'Enter an unregistered email', 'Submit'], 'Email: not-registered-qa@example.com',
    'A generic message (does not reveal whether the email exists); no error'),
  c('TC_048', 'Mobile', 'Verify email fields open the email keyboard on mobile', 'Positive', 'P3', 'Mobile', 'Login page open (mobile)',
    ['Tap the email field'], '',
    "The email keyboard appears (field type is 'email'); no auto-capitalisation"),

  // ---------------- Checkout ----------------
  c('TC_049', 'Checkout', 'Verify required shipping fields', 'Negative', 'P1', 'All', 'Cart has one item; on the checkout page',
    ['Leave all shipping fields empty', 'Click Continue'], '',
    'Each required field shows a message; the user cannot continue'),
  c('TC_050', 'Checkout', 'Verify invalid postcode and phone number', 'Negative', 'P2', 'All', 'On the checkout page',
    ['Enter an invalid postcode and phone number', 'Click Continue'], 'Postcode: ABCDE / Phone: 12ab',
    'Format errors are shown for both fields'),
  c('TC_051', 'Checkout', 'Verify guest checkout reaches payment', 'Positive', 'P1', 'All', 'Cart has one item; not logged in',
    ['Choose guest checkout', 'Fill valid shipping details', 'Continue'], 'Valid test address',
    'The payment step is shown with the correct order total'),
  c('TC_052', 'Checkout', 'Verify a declined card does not place an order', 'Negative', 'P1', 'All', 'On the payment step (payment provider in test mode)',
    ["Pay with the provider's 'declined' test card"], 'Card: ${env.TEST_CARD_DECLINED}',
    'A clear payment-declined message; no order is created; the user can retry'),
  c('TC_053', 'Checkout', 'Verify an expired card is rejected', 'Negative', 'P1', 'All', 'On the payment step (payment provider in test mode)',
    ['Enter a test card with a past expiry date', 'Pay'], 'Card: ${env.TEST_CARD_VALID} / Expiry: 01/20',
    "An 'expired card' message; no order is created"),
  c('TC_054', 'Checkout', 'Verify a successful test order', 'Positive', 'P1', 'All', 'On the payment step (payment provider in test mode)',
    ["Pay with the provider's 'success' test card"], 'Card: ${env.TEST_CARD_VALID}',
    'An order confirmation page with an order number; the cart is emptied'),
  c('TC_055', 'Checkout', 'Verify double-clicking Place Order creates one order', 'Negative', 'P1', 'All', 'On the final checkout step (test mode)',
    ['Double-click Place Order quickly'], 'Card: ${env.TEST_CARD_VALID}',
    'Only one order is created; the button is disabled after the first click'),
  c('TC_056', 'Checkout', 'Verify an expired session during checkout', 'Negative', 'P3', 'All', 'On the checkout page',
    ['Clear cookies / wait for session timeout', 'Click Continue'], '',
    'The user is asked to log in or restart checkout; no error page; cart is kept if possible'),
];

/** Keyword seeds for new cases that can be scripted without site-specific locators. */
export const NEW_SEED_STEPS: Array<[string, number, string, string, string, string, string]> = [
  // tc, step, keyword, target, value, description, platform
  ['TC_012', 1, 'Navigate', '', '${data}', 'Open a URL that does not exist', ''],
  ['TC_012', 2, 'VerifyText', '', '/404|not found|niet gevonden|page.*exist/i', 'Friendly not-found message', ''],
  ['TC_012', 3, 'VerifyNotVisible', 'Server Error Text', '', 'No stack trace / server error', ''],
  ['TC_014', 1, 'Navigate', '', '', '', ''],
  ['TC_014', 2, 'WaitForLoad', '', 'load', '', ''],
  ['TC_014', 3, 'VerifyNoHorizontalScroll', '', '', '', ''],
  ['TC_015', 1, 'Navigate', '', '', '', ''],
  ['TC_015', 2, 'SetViewport', '', 'landscape', 'Rotate to landscape', ''],
  ['TC_015', 3, 'VerifyVisible', 'Header', '', '', ''],
  ['TC_015', 4, 'VerifyNoHorizontalScroll', '', '', '', ''],
  ['TC_017', 1, 'Navigate', '', '', '', ''],
  ['TC_017', 2, 'Click', 'Search Icon', '', '', ''],
  ['TC_017', 3, 'Type', 'Search Input', '${data}', 'Script payload', ''],
  ['TC_017', 4, 'Press', 'Search Input', 'Enter', '', ''],
  ['TC_017', 5, 'VerifyNoDialog', '', '/^1$/', 'No alert() executed (payload alert(1))', ''],
  ['TC_028', 1, 'Navigate', '', '${data}', '', ''],
  ['TC_028', 2, 'VerifyText', '', '/404|not found|niet gevonden|no longer available/i', '', ''],
  ['TC_028', 3, 'VerifyNotVisible', 'Server Error Text', '', '', ''],
];

/** Object Repository additions: [name, strategy, locator, mobile locator, notes]. */
export const NEW_REPO: Array<[string, string, string, string, string]> = [
  ['Server Error Text', 'text', '/internal server error|stack trace|exception|sql syntax|fatal error/i', '', 'Generic'],
  ['Menu Icon', 'css', '[aria-label*="menu" i] || button[class*="hamburger" i] || button[class*="menu-toggle" i]', '', 'Mobile menu: verify on target site'],
];
