// Site sanity catalogues for the 6 storefronts (all Magento-based). Runs target the STAGING environments only.
// Fashion: Petit Bateau UAE, Petit Bateau KSA, Nanan UAE, Superdry UAE  -> Web + Android/iOS mobile web
// Pharmacy/Health: BinSina UAE -> Web + mobile web + Android/iOS native apps; Holland & Barrett UAE -> Web + mobile web
//
// Stores: every site has an English and an Arabic store (one workbook each), except Superdry (English only).
// SAFETY: runs are STAGING ONLY. The production hosts are listed in PROD_HOSTS; "npm run plan" refuses any URL on them
// and the keyword engine blocks navigation to them. Cases that place orders / take payments still need the payment
// provider in test mode on staging.
import type { CatalogCase } from './catalog';
import type { RepoSeed, SeedStep } from './upgrade';

export interface Site {
  key: string;
  file: string;
  name: string;
  vertical: 'Fashion' | 'Pharmacy' | 'Health';
  /** English store (staging). */
  url: string;
  /** Arabic store (staging); omitted when the site has no Arabic store. */
  arUrl?: string;
  /** Production host, never to be tested. */
  prodHost: string;
  /** Search terms for the Arabic store (defaults to the English terms). */
  arSearch?: { term: string; term2: string };
  country: 'UAE' | 'KSA';
  currency: string;
  currencyRegex: string;
  vat: string;
  phone: string;
  titleWord: string;
  prefix: string;
  search: { term: string; term2: string };
  platforms: string;
  /** How customers sign in: mobile number + OTP, or email + password. */
  auth: 'otp' | 'password';
  /** OTP form shows a field-level message when submitted empty (verified on the live site). */
  otpEmptyError?: boolean;
  /** Currency is printed as text next to prices (false when shown as an icon, e.g. the new dirham sign). */
  currencyText?: boolean;
  /** 'Continue as guest' offered on the sign-in page. */
  guest?: boolean;
  f: {
    sizeGuide?: boolean; wishlist?: boolean; newsletter?: boolean; storeLocator?: boolean; cod?: boolean; tabby?: boolean;
    tamara?: boolean; prescription?: boolean; express?: boolean; freeDelivery?: boolean; apps?: boolean;
  };
}

const AED = '/AED|د\\.إ/';
const SAR = '/SAR|ر\\.س|﷼/';

export type Store = 'en' | 'ar';

export const SITES: Site[] = [
  {
    key: 'pbae', file: 'PetitBateau_UAE_Sanity.xlsx', name: 'Petit Bateau UAE', vertical: 'Fashion',
    url: 'https://mcstaging.petit-bateauuat.com/en/', arUrl: 'https://mcstaging.petit-bateauuat.com/ar/', prodHost: 'www.petit-bateau.ae',
    arSearch: { term: 'بيجامة', term2: 'فستان' },
    country: 'UAE', currency: 'AED', currencyRegex: AED, vat: '5%', phone: '+971', titleWord: 'Petit Bateau', prefix: 'PBAE',
    search: { term: 'bodysuit', term2: 'pyjamas' }, platforms: 'Web, Android, iOS', auth: 'otp',
    f: { sizeGuide: true, wishlist: true, newsletter: true, freeDelivery: true },
  },
  {
    key: 'pbsa', file: 'PetitBateau_KSA_Sanity.xlsx', name: 'Petit Bateau KSA', vertical: 'Fashion',
    url: 'https://mcstaging-ksa.petit-bateauuat.com/en/', arUrl: 'https://mcstaging-ksa.petit-bateauuat.com/ar/', prodHost: 'www.petit-bateau.sa',
    arSearch: { term: 'بيجامة', term2: 'فستان' },
    country: 'KSA', currency: 'SAR', currencyRegex: SAR, vat: '15%', phone: '+966', titleWord: 'Petit Bateau', prefix: 'PBSA',
    search: { term: 'bodysuit', term2: 'pyjamas' }, platforms: 'Web, Android, iOS', auth: 'otp',
    f: { sizeGuide: true, wishlist: true, newsletter: true, freeDelivery: true, cod: true },
  },
  {
    key: 'nanan', file: 'Nanan_UAE_Sanity.xlsx', name: 'Nanan UAE', vertical: 'Fashion',
    url: 'https://mcstaging.nananuat.com/en/', arUrl: 'https://mcstaging.nananuat.com/ar/', prodHost: 'www.nanan.ae',
    arSearch: { term: 'فستان', term2: 'مريلة' },
    country: 'UAE', currency: 'AED', currencyRegex: AED, vat: '5%', phone: '+971', titleWord: 'Nanan', prefix: 'NAN',
    search: { term: 'dress', term2: 'bib' }, platforms: 'Web, Android, iOS', auth: 'otp',
    f: { wishlist: true, newsletter: true, freeDelivery: true, cod: true },
  },
  {
    key: 'superdry', file: 'Superdry_UAE_Sanity.xlsx', name: 'Superdry UAE', vertical: 'Fashion',
    url: 'https://mcstaging.superdry.ae/', prodHost: 'www.superdry.ae',
    country: 'UAE', currency: 'AED', currencyRegex: AED, vat: '5%', phone: '+971', titleWord: 'Superdry', prefix: 'SD',
    search: { term: 'hoodie', term2: 'jacket' }, platforms: 'Web, Android, iOS', auth: 'password',
    f: { sizeGuide: true, storeLocator: true, freeDelivery: true },
  },
  {
    key: 'binsina', file: 'BinSina_UAE_Sanity.xlsx', name: 'BinSina Pharmacy UAE', vertical: 'Pharmacy',
    url: 'https://mcstaging-ind.binsina.ae/en/', arUrl: 'https://mcstaging-ind.binsina.ae/ar/', prodHost: 'www.binsina.ae',
    arSearch: { term: 'بنادول', term2: 'فيتامين' },
    country: 'UAE', currency: 'AED', currencyRegex: AED, vat: '5%', phone: '+971', titleWord: 'BinSina', prefix: 'BS',
    search: { term: 'panadol', term2: 'vitamin c' }, platforms: 'Web, Android, iOS, Android App, iOS App',
    auth: 'otp', otpEmptyError: true, currencyText: false, guest: true,
    f: { tabby: true, tamara: true, prescription: true, storeLocator: true, express: true, apps: true },
  },
  {
    key: 'hnb', file: 'HollandBarrett_UAE_Sanity.xlsx', name: 'Holland & Barrett UAE', vertical: 'Health',
    // Arabic store: out of scope (client decision, 16 Nov). Staging /ar/ also redirects to BinSina's Arabic staging,
    // so arUrl is deliberately not set; set it and run "npm run build:sites -- hnb" if the Arabic store comes into scope.
    url: 'https://mcstaging-ind.hollandandbarrett.ae/en/', prodHost: 'www.hollandandbarrett.ae',
    arSearch: { term: 'فيتامين د', term2: 'بروتين' },
    country: 'UAE', currency: 'AED', currencyRegex: AED, vat: '5%', phone: '+971', titleWord: 'Holland', prefix: 'HB',
    search: { term: 'vitamin d', term2: 'protein' }, platforms: 'Web, Android, iOS', auth: 'otp', otpEmptyError: true, guest: true,
    f: { newsletter: true, freeDelivery: true, cod: true },
  },
];

// ---------------------------------------------------------------- locators (Magento storefront defaults)
export const SITE_REPO: RepoSeed[] = [
  ['Page Root', 'css', 'html', '', 'Document element (lang / dir checks)'],
  ['Header', 'css', 'header || .page-header', '', 'Magento'],
  ['Footer', 'css', 'footer || .page-footer', '', 'Magento'],
  ['Product Card', 'css', '#maincontent .product-item || main .product-item || .ais-Hits-item || .ais-InfiniteHits-item || #maincontent li.product', '', 'Magento / Algolia results'],
  ['Server Error Text', 'text', '/internal server error|stack trace|exception #|sql syntax|fatal error|error 500|there has been an error processing your request/i', '', 'Must never be shown'],
  ['Cookie Reject', 'css', '#onetrust-reject-all-handler || button:has-text("Reject All") || button:has-text("Reject") || button:has-text("Decline") || button:has-text("Necessary only") || button:has-text("رفض")', '', 'Privacy-preserving choice; used with ClickIfVisible'],
  ['Popup Close', 'css', '.modal-popup._show .action-close || .mfp-close || [role="dialog"] button[aria-label*="close" i]', '', 'Promo / newsletter popup; used with ClickIfVisible'],
  ['Login Email', 'css', '#login-form #email || form.form-login input[name="login[username]"] || input#email[name="login[username]"]', '', 'Magento login page'],
  ['Login Password', 'css', '#login-form #pass || form.form-login input[name="login[password]"] || input#pass', '', 'Magento login page'],
  ['Login Button', 'css', '#login-form #send2 || form.form-login button[type="submit"] || button#send2', '', 'Magento login page'],
  ['Login Email Error', 'css', '#email-error || #login-form .field.email div.mage-error || #login-form div.mage-error[id*="email"]', '', 'Magento client-side validation'],
  ['Login Password Error', 'css', '#pass-error || #password-login-error || #login-form .field.password div.mage-error || #login-form div.mage-error[id*="pass"]', '', 'Magento client-side validation'],
  ['Mobile Number Input', 'css', '#maincontent #mobile_number || #maincontent #mobilenumber || #maincontent input[name="mobile_number"]', '', 'OTP sign-in (verified 13 Nov)'],
  ['OTP Button', 'css', '#maincontent button:has-text("Request OTP") || #maincontent button:has-text("Log in")', '', 'OTP sign-in'],
  ['Mobile Number Error', 'css', '#mobilenumber-error || #mobile_number-error || #maincontent .field div.mage-error', '', 'OTP sign-in validation'],
  ['Social Login', 'text', '/(sign in|connect|login) with (apple|google)|apple login|google login/i', '', 'Social sign-in buttons'],
  ['Register First Name', 'css', 'form.form-create-account #firstname || #firstname', '', 'Magento registration'],
  ['Register Last Name', 'css', 'form.form-create-account #lastname || #lastname', '', 'Magento registration'],
  ['Register Email', 'css', 'form.form-create-account #email_address || #email_address', '', 'Magento registration'],
  ['Register Password', 'css', 'form.form-create-account #password || #password', '', 'Magento registration'],
  ['Register Confirm Password', 'css', 'form.form-create-account #password-confirmation || #password-confirmation', '', 'Magento registration'],
  ['Register Button', 'css', 'form.form-create-account button[type="submit"] || form#form-validate button.action.submit', '', 'Magento registration'],
  ['Field Error', 'css', 'div.mage-error || .field-error', '', 'Any client-side validation message'],
  ['Password Error', 'css', '#password-error', '', 'Magento registration'],
  ['Confirm Password Error', 'css', '#password-confirmation-error', '', 'Magento registration'],
  ['Forgot Email', 'css', 'form.form.password.forget #email_address || form.password.forget input[name="email"]', '', 'Magento forgot password'],
  ['Forgot Button', 'css', 'form.form.password.forget button[type="submit"] || form.password.forget button.action.submit', '', 'Magento forgot password'],
  ['Forgot Email Error', 'css', '#email_address-error', '', 'Magento forgot password'],
  ['Newsletter Input', 'css', '#newsletter || form.subscribe input[name="email"] || input[id*="newsletter" i][type="email"]', '', 'Footer newsletter'],
  ['Newsletter Button', 'css', 'form.subscribe button[type="submit"] || .block.newsletter button[type="submit"] || button.action.subscribe', '', 'Footer newsletter'],
  ['Newsletter Error', 'css', '#newsletter-error || form.subscribe .mage-error', '', 'Footer newsletter'],
];

// English patterns plus common Magento Arabic wording (Arabic alternatives unverified until the first Arabic run).
const RX = {
  noResults: '/returned no results|no results|no products? (were |was )?found|didn.t (find|match)|nothing found|0 results|could not find|no matching|لا توجد نتائج|لم يتم العثور|لا توجد منتجات|لم نجد/i',
  notFound: '/404|not found|couldn.t find|could not find|whoops|lost ?\\?|page you (requested|are looking for)|doesn.t exist|does not exist|no longer available|cannot be found|oops|غير موجود|لم يتم العثور|عذرًا|عذرا|عفوًا/i',
  emptyCart: '/no items in your (shopping )?(cart|bag|basket)|(cart|bag|basket) is empty|empty (cart|bag|basket)|nothing in your (cart|bag|basket)|سلة التسوق فارغة|السلة فارغة|عربة التسوق فارغة|لا توجد منتجات في سلة|ليس لديك أي منتجات/i',
  loginFailed: '/incorrect|invalid login|invalid username|not correct|wrong|disabled temporarily|try again|does not exist|not registered|invalid (email|credentials)|غير صحيح|غير صالح|خطأ|حاول مرة أخرى|غير مسجل/i',
  forgotAck: '/if there is an account|you will receive an email|we.ve sent|has been sent|check your (e-?mail|inbox)|إذا كان هناك حساب|ستتلقى|تم إرسال|تحقق من بريدك/i',
  arabic: '/[\\u0600-\\u06FF]{3,}/',
  social: '/(sign in|connect|login|continue) with (apple|google)|apple login|google login/i',
};

const STAGING = 'TEST/STAGING ENVIRONMENT ONLY (payment provider in test mode). Never place orders on production.';

type ScriptRow = [keyword: string, target?: string, value?: string, description?: string, platform?: string];

/** Build the test cases and keyword steps for one site. */
/** Production hosts of all sites: runs must never touch these. */
export const PROD_HOSTS = SITES.map((s) => s.prodHost.toLowerCase());

/** Workbook file for a site's store: the English store keeps the base name, Arabic adds "_AR". */
export const storeFile = (s: Site, store: Store) => (store === 'ar' ? s.file.replace(/_Sanity\.xlsx$/i, '_AR_Sanity.xlsx') : s.file);
export const storesOf = (s: Site): Store[] => (s.arUrl ? ['en', 'ar'] : ['en']);
export const storeUrl = (s: Site, store: Store) => (store === 'ar' ? s.arUrl! : s.url);

export function buildSite(s: Site, store: Store = 'en'): { cases: CatalogCase[]; steps: SeedStep[] } {
  const ar = store === 'ar';
  const httpUrl = storeUrl(s, store).replace(/^https:/, 'http:');
  const cases: CatalogCase[] = [];
  const steps: SeedStep[] = [];
  let n = 0;
  const fashion = s.vertical === 'Fashion';
  const variant = fashion ? 'size' : 'variant (pack size / flavour)';
  const t = ar ? s.arSearch ?? s.search : s.search;
  const searchUrl = (q: string) => `catalogsearch/result/?q=${q}`;
  const prep: ScriptRow[] = [['ClickIfVisible', 'Cookie Reject', '1500', 'Reject non-essential cookies if a banner shows'], ['ClickIfVisible', 'Popup Close', '1500', 'Close a promo popup if one shows']];

  const add = (
    section: string, scenario: string, type: CatalogCase['type'], priority: CatalogCase['priority'], platform: string,
    pre: string, stepText: string[], data: string, expected: string, opts: { mode?: CatalogCase['mode']; script?: ScriptRow[] } = {},
  ) => {
    n++;
    const id = `${s.prefix}${ar ? 'AR' : ''}_TC_${String(n).padStart(3, '0')}`;
    cases.push({
      id, section, scenario, type, priority, platform, pre, data, expected, mode: opts.mode,
      steps: stepText.map((x, i) => `${i + 1}. ${x}`).join('\n'),
    });
    opts.script?.forEach(([k, tg = '', v = '', d = '', p = ''], i) => steps.push([id, i + 1, k, tg, v, d, p]));
  };

  // ======================= Home & navigation =======================
  add('Home', 'Homepage loads with header, banner and footer', 'Positive', 'P1', 'All', 'Browser open',
    ['Open the site URL', 'Wait for the page to load'], '', 'Homepage loads within a few seconds; header, main banner and footer are visible; no error page',
    { script: [['Navigate'], ['WaitForLoad', '', 'load'], ...prep, ['VerifyVisible', 'Header'], ['VerifyVisible', 'Footer'], ['VerifyNotVisible', 'Server Error Text']] });
  add('Home', 'Page title shows the brand name', 'Positive', 'P3', 'All', 'Browser open', ['Open the site URL', 'Check the browser tab title'], '',
    `Title contains "${s.titleWord}"`, { script: [['Navigate'], ['VerifyTitle', '', s.titleWord]] });
  add('Home', 'HTTP redirects to secure HTTPS', 'Positive', 'P2', 'All', 'Browser open', [`Open ${httpUrl}`], httpUrl,
    'The site redirects to https:// and shows a valid certificate', { script: [['Navigate', '', httpUrl], ['VerifyURL', '', 'https://']] });
  add('Home', 'Main menu categories open their listing pages', 'Positive', 'P1', 'All', 'User on homepage',
    ['Open each main menu category (on mobile: open the menu first)'], '', 'Each category opens a listing page with products; no empty or error pages');
  add('Home', 'Non-existent page returns HTTP 404', 'Negative', 'P2', 'All', 'Browser open', ['Open the site URL + "qa-page-does-not-exist-404"'], 'qa-page-does-not-exist-404',
    'The server answers 404 Not Found (not 200 or 500); no server error or stack trace',
    { script: [['Navigate', '', '${data}'], ['VerifyStatus', '', '404'], ['VerifyNotVisible', 'Server Error Text']] });
  add('Home', '404 page tells the user the page was not found', 'Negative', 'P3', 'All', 'Browser open', ['Open the site URL + "qa-page-does-not-exist-404"'], 'qa-page-does-not-exist-404',
    "A clear 'page not found' message with a way back to shopping",
    { script: [['Navigate', '', '${data}'], ['VerifyText', '', RX.notFound]] });
  add('Home', 'Footer links (About, Contact, Shipping, Returns, Privacy, Terms) open', 'Positive', 'P3', 'All', 'User on homepage',
    ['Click each footer link'], '', 'Each link opens the correct page; none are broken');
  add('Home', 'Homepage has no browser console errors', 'Positive', 'P3', 'Web', 'Browser open', ['Open the site URL', 'Check the browser console'], '',
    'No JavaScript errors in the console', { script: [['Navigate'], ['WaitForLoad', '', 'load'], ['VerifyNoConsoleErrors']] });
  add('Mobile', 'Hamburger menu opens, shows categories and closes', 'Positive', 'P1', 'Mobile', 'User on homepage (phone)',
    ['Tap the menu icon', 'Open a category', 'Go back and close the menu'], '', 'Menu opens with all categories, navigation works, menu closes fully');
  add('Mobile', 'No horizontal scrolling on the homepage', 'Positive', 'P2', 'Mobile', 'Browser open (phone)', ['Open the site URL', 'Try to scroll sideways'], '',
    'Content fits the screen width', { script: [['Navigate'], ['WaitForLoad', '', 'load'], ['VerifyNoHorizontalScroll']] });
  add('Mobile', 'Layout adapts to landscape', 'Positive', 'P3', 'Mobile', 'User on homepage (phone)', ['Rotate the phone to landscape'], '',
    'Header and content re-flow; nothing overlaps or is cut off', { script: [['Navigate'], ['SetViewport', '', 'landscape'], ['VerifyVisible', 'Header'], ['VerifyNoHorizontalScroll']] });
  add('Mobile', 'Sticky header and search are usable while scrolling', 'Positive', 'P3', 'Mobile', 'User on a listing page (phone)',
    ['Scroll down the page', 'Tap search / cart from the header'], '', 'Header stays reachable; search and cart open from it');

  // ======================= Localisation =======================
  add('Localisation', `Prices are shown in ${s.currency}`, 'Positive', 'P1', 'All', 'Browser open', [`Search for "${t.term}"`, 'Look at the product prices'], t.term,
    `All prices show the ${s.currency} currency${s.currencyText === false ? ' (shown as the dirham symbol icon: check visually)' : ''}`,
    s.currencyText === false ? {} : { script: [['Navigate', '', searchUrl('${data}')], ['VerifyCount', 'Product Card', '>=1'], ['VerifyText', '', s.currencyRegex, `${s.currency} shown`]] });
  if (ar) {
    add('Localisation', 'Arabic store loads in Arabic, right-to-left', 'Positive', 'P1', 'All', 'Browser open', ['Open the Arabic store URL'], '',
      'Page language is Arabic, layout is right-to-left, text is in Arabic', { script: [['Navigate'], ['VerifyAttribute', 'Page Root', 'lang=/^ar/i'], ['VerifyText', '', RX.arabic, 'Arabic text shown']] });
    add('Localisation', 'Switching to English opens the same page in English', 'Positive', 'P3', 'All', 'User on an Arabic product page',
      ['Switch the language to English', 'Switch back to Arabic'], '', 'The same product opens in each language; cart contents are kept');
  } else if (s.arUrl) {
    add('Localisation', 'Arabic site loads in Arabic, right-to-left', 'Positive', 'P2', 'All', 'Browser open', ['Switch the language to Arabic (or open the Arabic URL)'], s.arUrl,
      'Page language is Arabic, layout is right-to-left, text is in Arabic', { script: [['Navigate', '', s.arUrl], ['VerifyAttribute', 'Page Root', 'lang=/^ar/i'], ['VerifyText', '', RX.arabic, 'Arabic text shown']] });
    add('Localisation', 'Language switch keeps the user on the same page', 'Positive', 'P3', 'All', 'User on a product page in English',
      ['Switch to Arabic', 'Switch back to English'], '', 'The same product opens in each language; cart contents are kept');
    add('Localisation', 'Arabic search returns products', 'Positive', 'P3', 'All', 'User on the Arabic site', ['Search using an Arabic term'], fashion ? 'فستان' : 'فيتامين',
      'Relevant products are shown in Arabic');
  }
  add('Localisation', `Phone number field accepts ${s.country} format and rejects invalid numbers`, 'Negative', 'P2', 'All', 'On the address / registration form',
    [`Enter an invalid phone number`, 'Submit'], `Phone: 12ab / ${s.phone} 000`, `A validation message for the phone number; ${s.phone} numbers in the correct format are accepted`);

  // ======================= Search =======================
  add('Search', 'Search returns relevant products', 'Positive', 'P1', 'All', 'User on homepage', ['Type the term in the search box', 'Press Enter'], t.term,
    `A results page with products related to "${t.term}"`, { script: [['Navigate', '', searchUrl('${data}')], ['VerifyCount', 'Product Card', '>=1'], ['VerifyNotVisible', 'Server Error Text']] });
  add('Search', 'Search with a second term returns products', 'Positive', 'P2', 'All', 'User on homepage', ['Search for the term'], t.term2,
    'Products are shown', { script: [['Navigate', '', searchUrl('${data}')], ['VerifyCount', 'Product Card', '>=1']] });
  add('Search', 'Search suggestions appear while typing', 'Positive', 'P2', 'All', 'User on homepage', ['Type the first 3 letters of the term into the search box'], t.term,
    'A suggestion list with products / categories appears and each suggestion opens the right page');
  add('Search', 'Search with no matches shows a helpful message', 'Negative', 'P2', 'All', 'User on homepage', ['Search for a nonsense term'], 'zzqxwv987',
    "A 'no results' message (with suggestions); no error page", { script: [['Navigate', '', searchUrl('${data}')], ['VerifyText', '', RX.noResults], ['VerifyNotVisible', 'Server Error Text']] });
  add('Search', 'Search is safe against script injection', 'Negative', 'P1', 'All', 'User on homepage', ['Search for the script payload'], '<script>alert(1)</script>',
    'No popup or script runs; the term is shown as plain text', { script: [['Navigate', '', searchUrl('${data}')], ['VerifyNoDialog', '', '/^1$/', 'Only the payload alert(1) counts'], ['VerifyNotVisible', 'Server Error Text']] });
  add('Search', 'Empty search is handled', 'Negative', 'P3', 'All', 'User on homepage', ['Submit the search box without typing'], '',
    'No error page; the user stays on the page or sees a prompt', { script: [['Navigate', '', searchUrl('')], ['VerifyNotVisible', 'Server Error Text'], ['VerifyVisible', 'Header']] });
  add('Search', 'Very long search term is handled', 'Negative', 'P3', 'All', 'User on homepage', ['Search for a 200-character term'], 'a'.repeat(200),
    'No crash; a no-results page or trimmed search', { script: [['Navigate', '', searchUrl('${data}')], ['VerifyNotVisible', 'Server Error Text'], ['VerifyVisible', 'Header']] });
  add('Search', 'Search with special characters is handled', 'Negative', 'P3', 'All', 'User on homepage', ['Search for special characters'], '%25$#@!*()',
    'No error page; a no-results message or results', { script: [['Navigate', '', searchUrl('${data}')], ['VerifyNotVisible', 'Server Error Text'], ['VerifyVisible', 'Header']] });

  // ======================= Product listing =======================
  add('PLP', `Category page shows products with name, image and ${s.currency} price`, 'Positive', 'P1', 'All', 'User on homepage', ['Open a category from the menu'], '',
    'A grid of products, each with image, name and price; product count shown');
  add('PLP', 'Sort by price low to high', 'Positive', 'P2', 'All', 'User on a category page', ["Choose 'Price: Low to High'"], '', 'Products are ordered by ascending price');
  add('PLP', fashion ? 'Filter by size / age' : 'Filter by brand', 'Positive', 'P2', 'All', 'User on a category page',
    [fashion ? 'Choose a size / age filter' : 'Choose a brand filter', 'Apply (on mobile: from the Filter panel)'], fashion ? 'Size: 6 months / 2 years' : 'Brand: first in list',
    'Only matching products are shown; the active filter is visible and can be cleared');
  add('PLP', 'Filter by price range', 'Positive', 'P2', 'All', 'User on a category page', ['Set a price range'], `Price: 50 - 150 ${s.currency}`, 'Only products in the range are shown');
  add('PLP', 'Filter combination with no matching products', 'Negative', 'P2', 'All', 'User on a category page', ['Apply filters no product matches'], '',
    'An empty-state message with an option to clear filters');
  add('PLP', 'Pagination / load more', 'Positive', 'P3', 'All', 'Category with many products', ['Go to the next page or tap Load more'], '', 'More products load with no duplicates');
  add('PLP', 'Back from a product returns to the same listing position', 'Positive', 'P3', 'All', 'User on a category page', ['Open a product', 'Press Back'], '',
    'The listing shows again at the same position with filters kept');

  // ======================= Product detail =======================
  add('PDP', `Product page shows name, price (${s.currency}), images, description and Add to Cart`, 'Positive', 'P1', 'All', 'User on a category page', ['Open a product'], '',
    'All key product information is shown and Add to Cart is enabled');
  add('PDP', `Add to Cart without choosing a required ${variant}`, 'Negative', 'P1', 'All', `Product with ${variant} options`, ['Open the product', `Click Add to Cart without choosing a ${variant}`], '',
    `A message asks for the ${variant}; nothing is added to the cart`);
  add('PDP', `Out-of-stock ${fashion ? 'size' : 'product'} cannot be added`, 'Negative', 'P2', 'All', `A product with an out-of-stock ${fashion ? 'size' : 'item'}`, ['Open the product', `Select the out-of-stock ${fashion ? 'size' : 'option'}`], '',
    "It is shown as unavailable; Add to Cart is disabled or 'Notify me' is offered");
  add('PDP', 'Invalid product URL returns not found', 'Negative', 'P3', 'All', 'Browser open', ['Open the site URL + "qa-invalid-product-000.html"'], 'qa-invalid-product-000.html',
    'The server answers 404 with a not-found page; no server error', { script: [['Navigate', '', '${data}'], ['VerifyStatus', '', '404'], ['VerifyNotVisible', 'Server Error Text']] });
  add('PDP', 'Product images zoom (Web) / swipe (mobile)', 'Positive', 'P2', 'All', 'User on a product with several images', ['Hover or click the main image (Web)', 'Swipe the gallery (mobile)'], '',
    'Images zoom or change; the position indicator updates');
  if (s.f.sizeGuide) add('PDP', 'Size guide opens and closes', 'Positive', 'P3', 'All', 'User on a clothing product', ["Click 'Size guide'", 'Close it'], '', 'The size chart opens and closes');
  if (fashion) add('PDP', 'Choosing a colour updates the images', 'Positive', 'P3', 'All', 'Product with several colours', ['Select another colour'], '', 'The main image and selected colour change');
  if (s.f.tabby || s.f.tamara)
    add('PDP', `${[s.f.tabby && 'Tabby', s.f.tamara && 'Tamara'].filter(Boolean).join(' / ')} instalment information is shown`, 'Positive', 'P2', 'All', 'User on a product page',
      ['Look below the price', 'Open the instalment info'], '', 'Instalment amounts are correct for the price and the info pop-up opens');

  // ======================= Cart =======================
  add('Cart', 'Add to cart updates the mini-cart', 'Positive', 'P1', 'All', 'User on a product page', [`Choose a ${variant} if needed`, 'Click Add to Cart', 'Open the mini-cart'], '',
    'A success message; the cart count increases; the item, quantity and price are correct');
  add('Cart', 'Update quantity recalculates totals', 'Positive', 'P1', 'All', 'Cart has one item', ['Change the quantity to 2', 'Update'], 'Qty = 2', 'Line total and subtotal double; totals are correct');
  add('Cart', 'Remove item empties the cart', 'Positive', 'P2', 'All', 'Cart has one item', ['Remove the item'], '', 'The item is removed and an empty-cart message is shown');
  add('Cart', 'Empty cart page shows a message', 'Negative', 'P2', 'All', 'New visitor with an empty cart', ['Open the cart page'], '',
    'An empty-cart message with a link back to shopping', { script: [['Navigate', '', 'checkout/cart/'], ...prep, ['VerifyText', '', RX.emptyCart], ['VerifyNotVisible', 'Server Error Text']] });
  add('Cart', 'Checkout is blocked with an empty cart', 'Negative', 'P1', 'All', 'New visitor with an empty cart', ['Open the checkout URL directly'], 'checkout/',
    'The user is sent back to the cart / shop; no checkout form is shown', { script: [['Navigate', '', '${data}'], ['VerifyText', '', RX.emptyCart], ['VerifyNotVisible', 'Server Error Text']] });
  add('Cart', 'Quantity 0 is handled', 'Negative', 'P2', 'All', 'Cart has one item', ['Set quantity to 0', 'Update'], 'Qty = 0', 'The item is removed or minimum 1 is enforced');
  add('Cart', 'Negative quantity is rejected', 'Negative', 'P1', 'All', 'Cart has one item', ['Type -1 as quantity', 'Update'], 'Qty = -1', 'Rejected or reset to 1; totals never go negative');
  add('Cart', 'Non-numeric quantity is rejected', 'Negative', 'P2', 'All', 'Cart has one item', ['Type "abc" as quantity', 'Update'], 'Qty = abc', 'Rejected; quantity and totals unchanged');
  add('Cart', 'Quantity above stock is capped', 'Negative', 'P2', 'All', 'Cart has one item', ['Set quantity to 999', 'Update'], 'Qty = 999', 'A message shows the maximum available');
  add('Cart', 'Invalid coupon code is rejected', 'Negative', 'P1', 'All', 'Cart has one item', ['Enter the coupon', 'Apply'], 'Coupon: QA-INVALID-000', "An 'invalid coupon' message; total unchanged");
  add('Cart', 'Valid coupon applies the discount', 'Positive', 'P2', 'All', 'Cart has one item; a test coupon exists', ['Enter the coupon', 'Apply'], 'Coupon: ${env.SITE_TEST_COUPON}', 'Discount line shown; total reduced correctly');
  add('Cart', 'Cart is kept after refreshing the page', 'Positive', 'P2', 'All', 'Cart has one item', ['Refresh the page', 'Open the cart'], '', 'Same items and quantities');
  if (s.f.freeDelivery) add('Cart', 'Free delivery threshold message is correct', 'Positive', 'P3', 'All', 'Cart below the free-delivery amount', ['Open the cart'], '',
    `The amount left for free delivery (in ${s.currency}) is correct and disappears once reached`);

  // ======================= Account =======================
  if (s.auth === 'otp') {
    // Sign-in is mobile number + one-time password (verified on the live site 13 Nov 2026). No email/password login.
    const otpPrep: ScriptRow[] = [['Navigate', '', 'customer/account/login/'], ...prep];
    add('Account', `Sign-in page asks for a ${s.country} mobile number`, 'Positive', 'P1', 'All', 'Not logged in', ['Open Sign in'], '',
      `A mobile-number field with the ${s.phone} country code and a button to request the OTP`,
      { script: [...otpPrep, ['VerifyVisible', 'Mobile Number Input'], ['VerifyVisible', 'OTP Button'], ['VerifyText', '', s.phone]] });
    add('Account', 'Request OTP with an empty mobile number', 'Negative', 'P1', 'All', 'Sign-in page open', ['Leave the mobile number empty', 'Request the OTP'], '',
      "A 'required field' message; no OTP is sent",
      s.otpEmptyError ? { script: [...otpPrep, ['Click', 'OTP Button'], ['VerifyVisible', 'Mobile Number Error']] } : {});
    add('Account', 'Request OTP with a too-short mobile number', 'Negative', 'P1', 'All', 'Sign-in page open', ['Enter "123"', 'Request the OTP'], 'Mobile: 123',
      "An 'enter a valid mobile number' message; no OTP is sent");
    add('Account', 'Mobile number field rejects letters and symbols', 'Negative', 'P2', 'All', 'Sign-in page open', ['Type letters and symbols in the mobile number'], 'Mobile: abc!@#',
      'Letters/symbols cannot be entered, or a validation message is shown');
    add('Account', 'Valid mobile number receives an OTP', 'Positive', 'P1', 'All', 'A test mobile number registered on the site', ['Enter the test mobile number', 'Request the OTP'],
      'Mobile: ${env.SITE_MOBILE}', 'The OTP screen opens with a resend timer; an SMS arrives');
    add('Account', 'Sign in with the correct OTP', 'Positive', 'P1', 'All', 'OTP received on the test mobile', ['Enter the OTP', 'Confirm'], 'OTP: from SMS',
      "The user is signed in and sees 'My Account' / their name");
    add('Account', 'Wrong OTP is rejected', 'Negative', 'P1', 'All', 'OTP screen open for the test mobile', ['Enter 000000', 'Confirm'], 'OTP: 000000',
      "An 'invalid OTP' message; the user is not signed in");
    add('Account', 'Expired OTP is rejected and Resend works', 'Negative', 'P2', 'All', 'OTP screen open; wait until the timer ends', ['Enter the old OTP after it expires', 'Tap Resend OTP'], '',
      "An 'OTP expired' message; Resend sends a new code only after the timer");
    add('Account', 'Repeated wrong OTP attempts are limited', 'Negative', 'P2', 'All', 'OTP screen open', ['Enter a wrong OTP 5 times'], 'OTP: 000000 x5',
      'Attempts are blocked or slowed down with a clear message');
    add('Account', 'Apple and Google sign-in options are shown', 'Positive', 'P3', 'All', 'Sign-in page open', ['Look under the mobile-number form'], '',
      'Apple and Google sign-in buttons are shown and open their sign-in windows', { script: [...otpPrep, ['VerifyText', '', RX.social]] });
    if (s.guest) add('Account', "'Continue as guest' is offered", 'Positive', 'P2', 'All', 'Sign-in page open', ['Look for the guest option'], '',
      "A 'Continue as guest' option that leads to checkout", { script: [...otpPrep, ['VerifyText', '', '/continue as guest/i']] });
    add('Account', 'Sign up with empty required fields', 'Negative', 'P1', 'All', 'Sign-up form open', ['Submit the sign-up form empty'], '',
      'Every required field shows a message; no account is created');
    add('Account', 'Sign up with an invalid email', 'Negative', 'P2', 'All', 'Sign-up form open', ['Enter "abc@" as email', 'Submit'], 'Email: abc@', "An 'enter a valid email' message");
    add('Account', 'Sign up with an already registered mobile number', 'Negative', 'P2', 'All', 'A registered test mobile exists', ['Sign up with the registered mobile'], 'Mobile: ${env.SITE_MOBILE}',
      "An 'account already exists' message with a way to sign in");
  } else {
    // Email + password sign-in (Magento standard).
    const loginPrep: ScriptRow[] = [['Navigate', '', 'customer/account/login/'], ...prep];
    add('Account', 'Login with valid credentials', 'Positive', 'P1', 'All', 'A registered test account exists', ['Open Sign in', 'Enter email and password', 'Sign in'], 'Email: ${env.SITE_EMAIL} / Password: ${env.SITE_PASSWORD}',
      "The user is logged in and sees 'My Account' / their name");
    add('Account', 'Login with empty fields shows required messages', 'Negative', 'P1', 'All', 'Login page open', ['Leave email and password empty', 'Click Sign in'], '',
      "'Required field' messages for email and password; no login",
      { script: [...loginPrep, ['Click', 'Login Button'], ['VerifyVisible', 'Login Email Error'], ['VerifyVisible', 'Login Password Error']] });
    add('Account', 'Login with invalid email format', 'Negative', 'P2', 'All', 'Login page open', ['Enter "user@" as email and any password', 'Click Sign in'], 'Email: user@ / Password: Any@12345',
      "An 'enter a valid email' message", { script: [...loginPrep, ['Type', 'Login Email', '${email}'], ['Type', 'Login Password', '${password}'], ['Click', 'Login Button'], ['VerifyVisible', 'Login Email Error']] });
    add('Account', 'Login with an unregistered email / wrong password', 'Negative', 'P1', 'All', 'Login page open', ['Enter an unregistered email and a password', 'Click Sign in'],
      'Email: qa-not-registered-0001@example.com / Password: Wrong@12345', 'A generic sign-in error; the user is not logged in; the message does not reveal which field was wrong',
      { script: [...loginPrep, ['Type', 'Login Email', '${email}'], ['Type', 'Login Password', '${password}'], ['Click', 'Login Button'], ['VerifyText', '', RX.loginFailed], ['VerifyURL', '', 'login']] });
    add('Account', 'Login rejects SQL injection', 'Negative', 'P1', 'All', 'Login page open', ['Enter the payload in email and password', 'Click Sign in'], "Email: ' OR '1'='1 / Password: ' OR '1'='1",
      'Login fails gracefully; no database or server error', { script: [...loginPrep, ['Type', 'Login Email', '${email}'], ['Type', 'Login Password', '${password}'], ['Click', 'Login Button'], ['VerifyNotVisible', 'Server Error Text'], ['VerifyURL', '', 'login']] });
    add('Account', 'Password field is masked', 'Positive', 'P2', 'All', 'Login page open', ['Type a password'], '', 'Characters are hidden',
      { script: [...loginPrep, ['VerifyAttribute', 'Login Password', 'type=password']] });
    const regPrep: ScriptRow[] = [['Navigate', '', 'customer/account/create/'], ...prep];
    add('Account', 'Registration with empty fields shows required messages', 'Negative', 'P1', 'All', 'Registration page open', ['Submit the form empty'], '',
      'Every required field shows a message; no account is created', { script: [...regPrep, ['Click', 'Register Button'], ['VerifyCount', 'Field Error', '>=2']] });
    add('Account', 'Registration with mismatched passwords', 'Negative', 'P2', 'All', 'Registration page open', ['Enter different passwords in Password and Confirm', 'Submit'],
      'Password: Test@12345 / Confirm: Other@12345', "A 'passwords do not match' message; no account is created",
      { script: [...regPrep, ['Type', 'Register Password', '${password}'], ['Type', 'Register Confirm Password', '${confirm}'], ['Click', 'Register Button'], ['VerifyVisible', 'Confirm Password Error']] });
    add('Account', 'Registration with a weak password', 'Negative', 'P2', 'All', 'Registration page open', ['Enter a 3-character password', 'Submit'], 'Password: 123',
      'A password-strength / minimum-length message', { script: [...regPrep, ['Type', 'Register Password', '${password}'], ['Click', 'Register Button'], ['VerifyVisible', 'Password Error']] });
    add('Account', 'Registration with an invalid email', 'Negative', 'P2', 'All', 'Registration page open', ['Enter "abc@" as email', 'Submit'], 'Email: abc@',
      "An 'enter a valid email' message", { script: [...regPrep, ['Type', 'Register Email', '${email}'], ['Click', 'Register Button'], ['VerifyCount', 'Field Error', '>=1']] });
    add('Account', 'Registration with an already registered email', 'Negative', 'P2', 'All', 'A registered test account exists', ['Fill the form with the existing email', 'Submit'],
      'Email: ${env.SITE_EMAIL}', "An 'account already exists' message with a link to sign in / reset password");
    add('Account', 'Forgot password with an invalid email format', 'Negative', 'P3', 'All', 'Forgot-password page open', ['Enter "abc" as email', 'Submit'], 'Email: abc',
      "An 'enter a valid email' message",
      { script: [['Navigate', '', 'customer/account/forgotpassword/'], ...prep, ['Type', 'Forgot Email', '${email}'], ['Click', 'Forgot Button'], ['VerifyVisible', 'Forgot Email Error']] });
    add('Account', 'Forgot password for an unregistered email gives a generic message', 'Negative', 'P2', 'All', 'Forgot-password page open', ['Enter an unregistered email', 'Submit'],
      'Email: qa-not-registered-0001@example.com', 'A generic confirmation that does not reveal whether the email exists',
      { script: [['Navigate', '', 'customer/account/forgotpassword/'], ...prep, ['Type', 'Forgot Email', '${email}'], ['Click', 'Forgot Button'], ['VerifyText', '', RX.forgotAck], ['VerifyNotVisible', 'Server Error Text']] });
  }
  add('Account', 'Logout ends the session', 'Positive', 'P1', 'All', 'User logged in', ['Sign out', 'Press Back'], '', 'The user is signed out; account pages need a new sign-in');
  add('Account', 'My Account pages are protected', 'Negative', 'P1', 'All', 'Not logged in', ['Open the account URL directly'], 'customer/account/',
    'The user is sent to the sign-in page',
    { script: [['Navigate', '', '${data}'], ['VerifyURL', '', 'login'], ['VerifyVisible', s.auth === 'otp' ? 'Mobile Number Input' : 'Login Password']] });
  if (s.f.wishlist) add('Account', 'Wishlist asks guests to sign in', 'Negative', 'P3', 'All', 'Not logged in; on a product page', ['Click the wishlist (heart) icon'], '',
    'The user is asked to sign in; after sign-in the product is in the wishlist');

  // ======================= Checkout =======================
  add('Checkout', 'Guest checkout reaches the shipping step', 'Positive', 'P1', 'All', 'Cart has one item; not logged in', ['Proceed to checkout', 'Choose guest checkout (if offered)'], '',
    'The shipping address form is shown with the order summary');
  add('Checkout', 'Shipping form shows required-field messages', 'Negative', 'P1', 'All', 'On the shipping step', ['Leave fields empty', 'Continue'], '', 'Each required field shows a message; cannot continue');
  add('Checkout', 'Invalid email / phone on the shipping form', 'Negative', 'P2', 'All', 'On the shipping step', ['Enter an invalid email and phone', 'Continue'], `Email: abc@ / Phone: 12ab`, 'Format errors for both fields');
  add('Checkout', `Totals include delivery and VAT (${s.vat})`, 'Positive', 'P2', 'All', 'On the review / payment step', ['Check subtotal, delivery, VAT and total'], '',
    `Amounts add up; VAT is ${s.vat}; currency ${s.currency}`);
  add('Checkout', 'Available payment methods are shown', 'Positive', 'P1', 'All', 'On the payment step (do NOT place the order)', ['Look at the payment options'], '',
    `Expected methods are listed${[s.f.cod && 'Cash on Delivery', s.f.tabby && 'Tabby', s.f.tamara && 'Tamara'].filter(Boolean).map((x) => `, including ${x}`).join('')}; selecting each shows its details`);
  if (s.f.cod) add('Checkout', 'Cash on Delivery shows any COD fee correctly', 'Positive', 'P3', 'All', 'On the payment step (do NOT place the order)', ['Choose Cash on Delivery'], '', 'COD fee (if any) is added correctly to the total');
  add('Checkout', 'Declined test card does not place an order', 'Negative', 'P1', 'All', STAGING, ["Pay with the provider's 'declined' test card"], 'Card: ${env.TEST_CARD_DECLINED}',
    'A clear payment-declined message; no order is created; the user can retry', { mode: 'AI' });
  add('Checkout', 'Expired card is rejected', 'Negative', 'P1', 'All', STAGING, ['Enter a test card with a past expiry date', 'Pay'], 'Card: ${env.TEST_CARD_VALID} / Expiry: 01/20', "An 'expired card' message; no order", { mode: 'AI' });
  add('Checkout', 'Successful test order shows confirmation', 'Positive', 'P1', 'All', STAGING, ["Pay with the provider's 'success' test card"], 'Card: ${env.TEST_CARD_VALID}',
    'An order confirmation page with an order number; confirmation email received; cart emptied', { mode: 'AI' });
  add('Checkout', 'Double-clicking Place Order creates only one order', 'Negative', 'P1', 'All', STAGING, ['Double-click Place Order'], 'Card: ${env.TEST_CARD_VALID}',
    'Exactly one order is created; the button is disabled after the first click', { mode: 'AI' });

  // ======================= Engagement =======================
  if (s.f.newsletter) {
    add('Newsletter', 'Newsletter sign-up rejects an invalid email', 'Negative', 'P3', 'All', 'User on homepage', ['Scroll to the footer', 'Enter "abc" in the newsletter field', 'Subscribe'], 'abc',
      "An 'enter a valid email' message; nothing is subscribed",
      { script: [['Navigate'], ...prep, ['Type', 'Newsletter Input', '${data}'], ['Click', 'Newsletter Button'], ['VerifyVisible', 'Newsletter Error']] });
    add('Newsletter', 'Newsletter sign-up with an empty email', 'Negative', 'P3', 'All', 'User on homepage', ['Click Subscribe with the field empty'], '',
      "A 'required field' message", { script: [['Navigate'], ...prep, ['Click', 'Newsletter Button'], ['VerifyVisible', 'Newsletter Error']] });
  }
  if (s.f.storeLocator) add('Stores', 'Store locator lists stores with address and hours', 'Positive', 'P3', 'All', 'User on homepage', ['Open the store locator', 'Search for a city'],
    s.country === 'UAE' ? 'Dubai' : 'Riyadh', 'Matching stores with address, hours and map/directions');

  // ======================= Vertical-specific =======================
  if (s.vertical === 'Pharmacy') {
    add('Prescription', 'Prescription upload page opens', 'Positive', 'P1', 'All', 'User on homepage', ["Open 'Upload prescription'"], '', 'The upload form with accepted file types and size limit is shown');
    add('Prescription', 'Prescription upload rejects an unsupported file type', 'Negative', 'P1', 'All', 'On the prescription upload form', ['Upload a .txt / .exe file'], 'File: test.txt',
      'The file is rejected with a message listing accepted types (e.g. JPG, PNG, PDF)');
    add('Prescription', 'Prescription upload rejects a file over the size limit', 'Negative', 'P2', 'All', 'On the prescription upload form', ['Upload a file larger than the limit'], 'File: 25 MB image',
      'The file is rejected with the size limit shown');
    add('Prescription', 'Prescription form shows required-field messages', 'Negative', 'P2', 'All', 'On the prescription upload form', ['Submit without a file or details'], '',
      'Required-field messages; nothing is submitted');
    add('Prescription', 'Prescription-only medicine cannot be bought without a prescription', 'Negative', 'P1', 'All', 'A prescription-only product exists',
      ['Open the prescription-only product', 'Try to add it to the cart'], '', 'The user is asked for a prescription; it cannot be checked out without one');
    add('PDP', 'Medicine page shows usage, warnings and ingredients', 'Positive', 'P2', 'All', 'User on a medicine product page', ['Read the product information tabs'], t.term,
      'Usage / dosage, warnings and ingredients are shown');
  }
  if (s.f.express) {
    add('Delivery', 'Express delivery: valid address shows the delivery slot', 'Positive', 'P2', 'All', 'User on homepage', ['Open the delivery address selector', 'Search for an address'], 'Dubai Marina',
      'Matching addresses appear; the express delivery time is shown for the chosen address');
    add('Delivery', 'Express delivery: unknown address is handled', 'Negative', 'P3', 'All', 'Delivery address selector open', ['Search for a nonsense address'], 'zzqx 000',
      "A 'no address found' message; no error");
  }
  if (s.vertical === 'Health') {
    add('PDP', 'Supplement page shows ingredients, nutrition and directions', 'Positive', 'P2', 'All', 'User on a supplement product page', ['Read the product information tabs'], t.term,
      'Ingredients, nutritional information and directions of use are shown');
    add('Promotions', 'Multi-buy offer is applied in the cart', 'Positive', 'P2', 'All', 'An active multi-buy offer (e.g. Buy 1 Get 1 Half Price)', ['Add qualifying products', 'Open the cart'], '',
      'The discount is applied exactly as the offer describes');
    add('Promotions', 'Offer is not applied when the condition is not met', 'Negative', 'P2', 'All', 'An active multi-buy offer', ['Add only one qualifying product'], '',
      'No discount is applied');
    add('Content', 'Health Hub articles open', 'Positive', 'P3', 'All', 'User on homepage', ["Open 'The Health Hub'", 'Open an article'], '', 'Articles load with images and related products');
  }

  // ======================= Native apps (BinSina only) =======================
  if (s.f.apps && !ar) {
    const app = (scenario: string, type: CatalogCase['type'], priority: CatalogCase['priority'], pre: string, st: string[], data: string, expected: string, platform = 'Apps') =>
      add('App', scenario, type, priority, platform, pre, st, data, expected);
    app('App installs and opens to the home screen', 'Positive', 'P1', 'Latest app from Google Play / App Store', ['Install the app', 'Open it'], '', 'Splash then home screen within ~5 s; no crash');
    app('Location permission denied: address can still be entered manually', 'Negative', 'P2', 'First launch', ['Deny location permission', 'Set the delivery address manually'], '', 'App keeps working; manual address entry works; no repeated prompts');
    app('Notification permission denied: app works normally', 'Negative', 'P3', 'First launch', ['Deny notifications', 'Browse the app'], '', 'No errors; the app works normally');
    app('Login with valid credentials', 'Positive', 'P1', 'A registered test account exists', ['Open Account', 'Sign in'], 'Email/Mobile: ${env.SITE_EMAIL} / Password or OTP: ${env.SITE_PASSWORD}', 'The user is signed in and sees their account');
    app('Login with wrong password / OTP', 'Negative', 'P1', 'Login screen open', ['Enter a wrong password or OTP', 'Submit'], 'Password/OTP: 000000', 'A clear error; not signed in; attempts are limited');
    app('Search returns products', 'Positive', 'P1', 'Home screen', ['Search for the term'], t.term, 'Relevant products are shown');
    app('Search with no matches', 'Negative', 'P2', 'Home screen', ['Search for a nonsense term'], 'zzqxwv987', "A 'no results' message");
    app('Add to cart updates the cart badge', 'Positive', 'P1', 'User on a product', ['Tap Add to Cart'], '', 'The cart badge count increases and the item is in the cart');
    app('Cart syncs between app and website', 'Positive', 'P2', 'Same account signed in on app and web', ['Add an item in the app', 'Open the cart on the website'], '', 'The same item is in both carts');
    app('Upload a prescription with the camera', 'Positive', 'P1', 'Signed in; camera permission allowed', ['Open Upload prescription', 'Take a photo', 'Submit'], '', 'Upload succeeds and a confirmation is shown');
    app('Camera permission denied during prescription upload', 'Negative', 'P2', 'Signed in', ['Open Upload prescription', 'Deny camera permission'], '', 'A helpful message with an option to pick from the gallery or open Settings');
    app('Unsupported file from the gallery is rejected', 'Negative', 'P2', 'On prescription upload', ['Choose an unsupported file'], '', 'The file is rejected with accepted types shown');
    app('Website product link opens in the app (deep link)', 'Positive', 'P2', 'App installed', ['Open a binsina.ae product link on the phone'], '', 'The product opens inside the app');
    app('No internet connection shows an offline message', 'Negative', 'P1', 'App open', ['Turn on airplane mode', 'Navigate in the app', 'Turn the connection back on and retry'], '', 'A friendly offline message with Retry; the app recovers without a restart');
    app('App resumes where the user left off', 'Positive', 'P3', 'User on a product page', ['Send the app to the background for 2 minutes', 'Return to it'], '', 'Same screen and cart; no reload to home');
    app('Android Back button navigates back correctly', 'Positive', 'P2', 'User deep in the app', ['Press the Android Back button repeatedly'], '', 'Each press goes back one screen; the last press asks to exit or leaves the app', 'Android App');
    app('Arabic language shows right-to-left', 'Positive', 'P2', 'App open', ['Switch the app language to Arabic'], '', 'All screens switch to Arabic, right-to-left');
    app('Payment options are shown at checkout (do not place the order)', 'Positive', 'P1', 'Cart has one item', ['Go to checkout', 'Open payment methods'], '', 'Card, Tabby, Tamara and any other enabled methods are shown');
    app('Logout clears the session', 'Positive', 'P1', 'Signed in', ['Sign out', 'Reopen the app'], '', 'The user stays signed out; account data is not shown');
    app('Store locator shows nearby pharmacies', 'Positive', 'P3', 'Location permission allowed', ['Open Store locator'], '', 'Nearby pharmacies with distance, hours and directions');
    app('Push notification opens the right screen', 'Positive', 'P3', 'Notifications allowed', ['Tap a promotional / order notification'], '', 'The linked offer or order screen opens');
    app('Outdated app version prompts to update', 'Negative', 'P3', 'An older app version installed', ['Open the old version'], '', 'An update prompt with a link to the store (if forced update is configured)');
  }

  return { cases, steps };
}
