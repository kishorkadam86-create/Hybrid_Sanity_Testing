import { useEffect } from 'react';
import { Empty, Loading, ThemeToggle } from './components';
import { fmtDateTime, useIndex, useProject } from './data';
import { Home } from './Home';
import { ProjectPage } from './Project';
import { href, useRoute, type Route } from './router';
import { RunsProvider } from './Run';

export function App() {
  const route = useRoute();
  const index = useIndex();
  const projectId = route.path[0];

  useEffect(() => {
    const name = index.data?.projects.find((p) => p.id === projectId)?.name;
    document.title = name ? `${name} · Hybrid QA Dashboard` : 'Hybrid QA Dashboard';
  }, [projectId, index.data]);

  return (
    <RunsProvider>
    <div className="app">
      <header className="topbar">
        <a className="brand" href={href([])}>
          <span className="logo" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="28" height="28"><rect width="32" height="32" rx="8" fill="currentColor" /><path d="M9 16.5l4.5 4.5L23 11.5" stroke="var(--logo-tick)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span>
            <b>Hybrid QA</b>
            <small>Sanity dashboard</small>
          </span>
        </a>
        <nav className="topnav" aria-label="Projects">
          {index.data?.projects.map((p) => (
            <a key={p.id} href={href([p.id])} className={projectId === p.id ? 'on' : ''}>{p.name}</a>
          ))}
        </nav>
        <div className="topbar-end">
          <span className="env-badge">{index.data?.environment ?? 'Staging'}</span>
          <ThemeToggle />
        </div>
      </header>

      <main className="main">
        {index.error && <Empty>Could not load the dashboard data ({index.error}).</Empty>}
        {!index.data && !index.error && <Loading />}
        {index.data && !projectId && <Home index={index.data} />}
        {index.data && projectId && (index.data.projects.some((p) => p.id === projectId)
          ? <ProjectRoute id={projectId} route={route} />
          : <Empty>Unknown project. <a href={href([])}>Back to projects</a></Empty>)}
      </main>

      <footer className="footer">
        <span>Data snapshot {fmtDateTime(index.data?.generatedAt)}</span>
        <span>Staging environments only · production is never tested</span>
      </footer>
    </div>
    </RunsProvider>
  );
}

function ProjectRoute({ id, route }: { id: string; route: Route }) {
  const project = useProject(id);
  if (project.error) return <Empty>Could not load {id} ({project.error}).</Empty>;
  if (!project.data) return <Loading />;
  return <ProjectPage project={project.data} route={route} />;
}
