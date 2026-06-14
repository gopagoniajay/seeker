import { useState, useEffect, useRef } from 'react';
import { api } from '../api';

function AgentStatusPill({ status }) {
  const running = status?.is_running;
  return (
    <div className={`agent-status-pill ${running ? 'running' : 'idle'}`}>
      <div className="pulse" />
      {running ? `Running — ${status.phase}` : 'Idle'}
    </div>
  );
}

function StatCard({ icon, value, label, color }) {
  return (
    <div className="stat-card" style={{ '--accent-color': color }}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function LogFeed({ logs }) {
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  return (
    <div className="log-feed">
      {logs.length === 0
        ? <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No activity yet. Start the agent to see logs here.</div>
        : logs.map((l, i) => (
          <div key={i} className={`log-entry log-${l.level}`}>
            <span className="log-time">{new Date(l.created_at).toLocaleTimeString()}</span>
            <span className="log-msg">{l.message}</span>
          </div>
        ))
      }
      <div ref={bottomRef} />
    </div>
  );
}

export default function Dashboard() {
  const [agentStatus, setAgentStatus] = useState(null);
  const [jobStats,    setJobStats]    = useState(null);
  const [appStats,    setAppStats]    = useState(null);
  const [logs,        setLogs]        = useState([]);
  const [starting,    setStarting]    = useState(false);

  async function loadAll() {
    try {
      const [st, js, as, lg] = await Promise.all([
        api.getAgentStatus(),
        api.getJobStats().catch(() => null),
        api.getAppStats().catch(() => null),
        api.getLogs(40).catch(() => []),
      ]);
      setAgentStatus(st);
      setJobStats(js);
      setAppStats(as);
      setLogs(lg);
    } catch (e) { console.error(e); }
  }

  useEffect(() => {
    loadAll();
    const id = setInterval(loadAll, 5000); // poll every 5s for live updates
    return () => clearInterval(id);
  }, []);

  async function startAgent() {
    setStarting(true);
    try {
      await api.startAgent();
      await loadAll();
    } catch (e) { alert(e.message); }
    setStarting(false);
  }

  async function stopAgent() {
    await api.stopAgent();
    await loadAll();
  }

  const isRunning = agentStatus?.is_running;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🤖 Agent Dashboard</h1>
          <p className="page-subtitle">Monitor your AI job application agent in real time</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AgentStatusPill status={agentStatus} />
          {isRunning
            ? <button className="btn btn-danger" onClick={stopAgent}>⏹ Stop Agent</button>
            : <button className="btn btn-primary" onClick={startAgent} disabled={starting}>
                {starting ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Starting…</> : '▶ Run Agent Now'}
              </button>
          }
        </div>
      </div>

      <div className="page-body">
        {/* Hero banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.08))',
          border: '1px solid var(--border-accent)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 28px',
          marginBottom: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}>
          <div style={{ fontSize: 52 }}>🚀</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>AI Job Application Agent</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
              Powered by Google Gemini · Searches LinkedIn, Indeed & Glassdoor · 
              Scores jobs against your resume · Writes tailored cover letters · 
              Applies with human-like browser automation.
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            {agentStatus?.last_run && (
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                Last run: {new Date(agentStatus.last_run).toLocaleString()}
              </div>
            )}
            <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
              📅 Today: <strong style={{ color: 'var(--text-primary)' }}>{agentStatus?.jobs_found_today ?? 0}</strong> found, 
              &nbsp;<strong style={{ color: 'var(--success)' }}>{agentStatus?.jobs_applied_today ?? 0}</strong> applied
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="stats-grid">
          <StatCard icon="🔍" value={jobStats?.total}      label="Total Jobs Found"  color="var(--accent)" />
          <StatCard icon="⏳" value={jobStats?.queued}     label="Awaiting Review"   color="var(--warning)" />
          <StatCard icon="✅" value={jobStats?.applied}    label="Applications Sent" color="var(--success)" />
          <StatCard icon="🎯" value={appStats?.interview}  label="Interviews"        color="var(--info)" />
          <StatCard icon="🎉" value={appStats?.offer}      label="Offers Received"   color="#a855f7" />
          <StatCard icon="📈" value={appStats ? `${appStats.success_rate}%` : '—'} label="Success Rate" color="var(--warning)" />
        </div>

        {/* Job Pipeline Progress */}
        {jobStats && (
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="section-label" style={{ marginBottom: 16 }}>Job Pipeline</div>
            <div style={{ display: 'flex', gap: 24 }}>
              {[
                { label: 'Discovered',    value: jobStats.discovered,  color: 'var(--text-secondary)' },
                { label: 'Queued',        value: jobStats.queued,      color: 'var(--warning)' },
                { label: 'Applied',       value: jobStats.applied,     color: 'var(--success)' },
                { label: 'Skipped',       value: jobStats.skipped,     color: 'var(--text-muted)' },
                { label: 'Failed',        value: jobStats.failed,      color: 'var(--danger)' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value ?? 0}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>{s.label}</div>
                  <div className="progress-bar" style={{ marginTop: 8 }}>
                    <div className="progress-fill" style={{
                      width: `${jobStats.total ? Math.round(s.value / jobStats.total * 100) : 0}%`,
                      background: s.color,
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How It Works */}
        <div className="two-col" style={{ marginBottom: 24 }}>
          <div>
            <div className="section-label" style={{ marginBottom: 14 }}>Live Activity Log</div>
            <LogFeed logs={logs} />
          </div>
          <div>
            <div className="section-label" style={{ marginBottom: 14 }}>How The Agent Works</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { step: '1', icon: '🔍', title: 'Search', desc: 'Scrapes LinkedIn, Indeed & Glassdoor for jobs matching your titles and location' },
                { step: '2', icon: '🤖', title: 'AI Scoring', desc: 'Gemini reads each job description vs your resume and assigns a fit score 0-100' },
                { step: '3', icon: '📄', title: 'Tailoring', desc: 'Auto-generates a unique, personalized cover letter for each qualifying job' },
                { step: '4', icon: '👀', title: 'Your Review', desc: 'You see all scored jobs in the Job Queue and decide which ones to apply to' },
                { step: '5', icon: '🚀', title: 'Auto-Apply', desc: 'Playwright fills forms, answers screening questions, and submits the application' },
              ].map(s => (
                <div key={s.step} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: 'var(--accent-glow)', border: '1px solid var(--border-accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0,
                  }}>{s.icon}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{s.step}. {s.title}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 12.5, lineHeight: 1.5 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
