// Shared helpers for the run API (files starting with "_" are not routes).
// Vercel environment variables:
//   GITHUB_TOKEN   fine-grained token for the repo with "Actions: Read and write" (required to start runs)
//   RUN_PASSCODE   passcode people type in the dashboard to start a run (required)
//   GITHUB_REPO    owner/name (default below)
export const REPO = process.env.GITHUB_REPO || 'kishorkadam86-create/Hybrid_Sanity_Testing';
export const WORKFLOW = 'sanity-run.yml';

export const PROJECTS: Record<string, string[]> = {
  binsina: ['binsina', 'hnb'],
  fashion: ['pbae', 'pbsa', 'nanan', 'superdry'],
};
export const PLATFORMS = ['all', 'Web', 'Mobile', 'Android', 'iOS'];
export const PRIORITIES = ['all', 'P1', 'P2', 'P3'];

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export async function github(path: string, init: RequestInit = {}): Promise<Response> {
  const token = process.env.GITHUB_TOKEN;
  return fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'hybrid-qa-dashboard',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

/** Constant-time string comparison. */
export function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
