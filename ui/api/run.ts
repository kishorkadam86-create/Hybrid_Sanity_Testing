// POST /api/run  { project, site, platform, priority, passcode }
// Starts the "Sanity run" GitHub Actions workflow for a whole project or one website (staging only).
import { PLATFORMS, PRIORITIES, PROJECTS, REPO, WORKFLOW, github, json, sameSecret } from './_github.js';

export async function POST(request: Request): Promise<Response> {
  if (!process.env.GITHUB_TOKEN || !process.env.RUN_PASSCODE) {
    return json({ error: 'Runs are not set up yet: GITHUB_TOKEN and RUN_PASSCODE must be added in the Vercel project settings.' }, 503);
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  const project = String(body.project ?? '');
  const site = String(body.site ?? 'all');
  const platform = String(body.platform ?? 'all');
  const priority = String(body.priority ?? 'all');
  const passcode = String(body.passcode ?? '');

  if (!sameSecret(passcode, process.env.RUN_PASSCODE)) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return json({ error: 'Wrong passcode' }, 401);
  }
  if (!PROJECTS[project]) return json({ error: `Unknown project "${project}"` }, 400);
  if (site !== 'all' && !PROJECTS[project].includes(site)) return json({ error: `Website "${site}" is not part of ${project}` }, 400);
  if (!PLATFORMS.includes(platform)) return json({ error: `Unknown platform "${platform}"` }, 400);
  if (!PRIORITIES.includes(priority)) return json({ error: `Unknown priority "${priority}"` }, 400);

  const res = await github(`/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ref: 'main', inputs: { project, site, platform, priority, requested_by: 'dashboard' } }),
  });
  if (res.status !== 204 && res.status !== 200) {
    const text = await res.text();
    return json({ error: `GitHub refused to start the run (HTTP ${res.status})`, detail: text.slice(0, 300) }, 502);
  }
  return json({
    ok: true,
    message: `Sanity run started: ${project} / ${site === 'all' ? 'all websites' : site}`,
    actionsUrl: `https://github.com/${REPO}/actions/workflows/${WORKFLOW}`,
  }, 202);
}
