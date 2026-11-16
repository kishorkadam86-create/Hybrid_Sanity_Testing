// Staging-only guard: runs must never touch a production storefront.
// Production hosts come from src/sites.ts (PROD_HOSTS). ALLOW_PRODUCTION=1 is the only override.
import { PROD_HOSTS } from './sites';

const allowProduction = () => process.env.ALLOW_PRODUCTION === '1';

/** Host of a URL (lower case), or '' when it is not an absolute http(s) URL. */
function hostOf(url: string): string {
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol) ? u.hostname.toLowerCase() : '';
  } catch {
    return '';
  }
}

export function isProductionUrl(url: string): boolean {
  if (allowProduction()) return false;
  const host = hostOf(url);
  return !!host && PROD_HOSTS.some((p) => host === p || host === p.replace(/^www\./, '') || host.endsWith(`.${p.replace(/^www\./, '')}`) && !/staging|uat/.test(host));
}

/** Every absolute URL inside a piece of text. */
export function urlsIn(text: string): string[] {
  return text.match(/https?:\/\/[^\s"'<>|)]+/gi) ?? [];
}

export const PRODUCTION_MESSAGE =
  'Production URL blocked: runs are staging-only. Use the staging URL (or set ALLOW_PRODUCTION=1 only with written approval).';
