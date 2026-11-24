// GET /api/runs  ->  the latest "Sanity run" workflow runs (status for the dashboard).
import { REPO, WORKFLOW, github, json } from './_github.js';

interface GhRun {
  id: number;
  display_title: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  run_started_at?: string;
  updated_at: string;
  event: string;
}

export async function GET(): Promise<Response> {
  const res = await github(`/actions/workflows/${WORKFLOW}/runs?per_page=15`);
  if (res.status === 404) return json({ runs: [], configured: false, note: 'Workflow not found on the default branch yet.' });
  if (!res.ok) return json({ error: `GitHub HTTP ${res.status}` }, 502);
  const data = (await res.json()) as { workflow_runs: GhRun[] };
  const runs = data.workflow_runs.map((r) => {
    // run-name: "Sanity · <project> · <site> · <platform> · <priority>"
    const [, project = '', site = '', platform = '', priority = ''] = r.display_title.split(' · ');
    return {
      id: r.id,
      title: r.display_title,
      project, site, platform, priority,
      status: r.status,
      conclusion: r.conclusion,
      url: r.html_url,
      createdAt: r.created_at,
      startedAt: r.run_started_at ?? r.created_at,
      updatedAt: r.updated_at,
    };
  });
  return json({ runs, configured: Boolean(process.env.GITHUB_TOKEN && process.env.RUN_PASSCODE), actionsUrl: `https://github.com/${REPO}/actions/workflows/${WORKFLOW}` });
}
