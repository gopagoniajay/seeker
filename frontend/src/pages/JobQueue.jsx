import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

// ── Helpers ───────────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  if (score == null) return <div className="score-ring score-low">—</div>;
  const cls = score >= 75 ? 'score-high' : score >= 50 ? 'score-medium' : 'score-low';
  return <div className={`score-ring ${cls}`}>{Math.round(score)}</div>;
}

function sourceColor(src) {
  if (src === 'linkedin') return 'badge-blue';
  if (src === 'indeed')   return 'badge-amber';
  return 'badge-cyan';
}

function sourceDot(src) {
  if (src === 'linkedin') return '🔵';
  if (src === 'indeed')   return '🟡';
  return '🟢';
}

// ── Cover Letter Modal ────────────────────────────────────────────────────────
function CoverLetterModal({ job, onClose }) {
  const [letter, setLetter] = useState(job.cover_letter || '');
  const [loading, setLoading] = useState(false);

  async function regen() {
    setLoading(true);
    try {
      const r = await api.regenCover(job.id);
      setLetter(r.cover_letter);
    } catch (e) { alert(e.message); }
    setLoading(false);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">📄 Cover Letter</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
              {job.title} @ {job.company}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ marginBottom: 16 }}>
          {letter
            ? <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.7, color: 'var(--text-primary)', fontSize: 13.5 }}>{letter}</pre>
            : <div className="empty-state"><div className="empty-icon">✍️</div><div className="empty-desc">No cover letter yet. Click "Regenerate" to generate one.</div></div>
          }
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={regen} disabled={loading}>
            {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Generating…</> : '✨ Regenerate'}
          </button>
          <button className="btn btn-ghost" onClick={() => navigator.clipboard.writeText(letter)} disabled={!letter}>
            📋 Copy
          </button>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Job Detail Modal ──────────────────────────────────────────────────────────
function JobDetailModal({ job, onClose, onApply, onSkip }) {
  const [applying, setApplying] = useState(false);
  const [showCover, setShowCover] = useState(false);

  async function handleApply() {
    setApplying(true);
    try { await onApply(job.id); } catch (e) { alert(e.message); }
    setApplying(false);
  }

  return (
    <>
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 720 }}>
          <div className="modal-header">
            <div>
              <div className="modal-title">{job.title}</div>
              <div style={{ color: 'var(--accent-light)', fontWeight: 600, fontSize: 14, marginTop: 3 }}>{job.company}</div>
            </div>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>

          {/* Meta */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <span className={`badge ${sourceColor(job.source)}`}>{sourceDot(job.source)} {job.source}</span>
            {job.location && <span className="badge badge-gray">📍 {job.location}</span>}
            {job.is_easy_apply && <span className="badge badge-green">⚡ Easy Apply</span>}
            {job.salary_min && <span className="badge badge-cyan">💰 ${Math.round(job.salary_min / 1000)}k–${Math.round(job.salary_max / 1000)}k</span>}
            <ScoreRing score={job.fit_score} />
          </div>

          {job.fit_summary && (
            <div style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid var(--border-accent)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 16, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              🤖 <strong style={{ color: 'var(--accent-light)' }}>AI Assessment:</strong> {job.fit_summary}
            </div>
          )}

          <div style={{ maxHeight: 240, overflowY: 'auto', fontSize: 13.5, lineHeight: 1.8, color: 'var(--text-secondary)', marginBottom: 20, paddingRight: 4 }}>
            {job.description || 'No description available.'}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-success" onClick={handleApply} disabled={applying || job.status === 'applied'}>
              {applying ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Applying…</> : '🚀 Apply Now'}
            </button>
            <button className="btn btn-ghost" onClick={() => setShowCover(true)}>📄 View Cover Letter</button>
            <a className="btn btn-ghost" href={job.apply_url} target="_blank" rel="noreferrer">🔗 Open Listing</a>
            <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { onSkip(job.id); onClose(); }}>Skip</button>
          </div>
        </div>
      </div>
      {showCover && <CoverLetterModal job={job} onClose={() => setShowCover(false)} />}
    </>
  );
}

// ── Main JobQueue Page ────────────────────────────────────────────────────────
export default function JobQueue() {
  const [jobs, setJobs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter]     = useState('queued');
  const [srcFilter, setSrc]     = useState('');
  const [minScore, setMinScore] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { status: filter || undefined, source: srcFilter || undefined, min_score: minScore || undefined, limit: 100 };
      Object.keys(params).forEach(k => params[k] === undefined && delete params[k]);
      const data = await api.getJobs(params);
      setJobs(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filter, srcFilter, minScore]);

  useEffect(() => { load(); }, [load]);

  async function handleApply(id) {
    await api.applyToJob(id);
    alert('✅ Application queued! Check the Applications tab for status updates.');
    load();
  }

  async function handleSkip(id) {
    await api.skipJob(id);
    setJobs(prev => prev.filter(j => j.id !== id));
  }

  const selectedJob = jobs.find(j => j.id === selected);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🎯 Job Queue</h1>
          <p className="page-subtitle">Review AI-scored jobs and trigger applications</p>
        </div>
        <button className="btn btn-ghost" onClick={load}>🔄 Refresh</button>
      </div>
      <div className="page-body">
        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {['queued','discovered','applied','skipped','failed'].map(s => (
            <button key={s} className={`btn ${filter === s ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setFilter(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <button className={`btn ${filter === '' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setFilter('')}>All</button>
          <div style={{ flex: 1 }} />
          <select className="form-select" style={{ width: 140 }} value={srcFilter} onChange={e => setSrc(e.target.value)}>
            <option value="">All Sources</option>
            <option value="linkedin">LinkedIn</option>
            <option value="indeed">Indeed</option>
            <option value="glassdoor">Glassdoor</option>
          </select>
          <select className="form-select" style={{ width: 140 }} value={minScore} onChange={e => setMinScore(e.target.value)}>
            <option value="">Any Score</option>
            <option value="90">90+ Excellent</option>
            <option value="75">75+ Good</option>
            <option value="60">60+ Fair</option>
          </select>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} /></div>
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔎</div>
            <div className="empty-title">No jobs found</div>
            <div className="empty-desc">Run the agent from the Dashboard to discover new jobs, then come back here to review them.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {jobs.map(job => (
              <div key={job.id} className={`job-card ${selected === job.id ? 'selected' : ''}`} onClick={() => setSelected(job.id)}>
                <div className="job-card-header">
                  <ScoreRing score={job.fit_score} />
                  <div className="job-card-info">
                    <div className="job-title">{job.title}</div>
                    <div className="job-company">{job.company}</div>
                    <div className="job-meta">
                      <span className={`badge ${sourceColor(job.source)}`}>{sourceDot(job.source)} {job.source}</span>
                      {job.location && <span className="badge badge-gray">📍 {job.location}</span>}
                      {job.is_easy_apply && <span className="badge badge-green">⚡ Easy Apply</span>}
                      {job.salary_min && <span className="badge badge-cyan">💰 ${Math.round(job.salary_min/1000)}k+</span>}
                      <span className="badge badge-gray">{job.date_posted}</span>
                    </div>
                    {job.fit_summary && (
                      <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {job.fit_summary.slice(0, 130)}{job.fit_summary.length > 130 ? '…' : ''}
                      </div>
                    )}
                  </div>
                </div>
                <div className="job-card-actions" onClick={e => e.stopPropagation()}>
                  <button className="btn btn-success btn-sm" onClick={() => handleApply(job.id)} disabled={job.status === 'applied'}>
                    🚀 Apply
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelected(job.id)}>👁 Details</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleSkip(job.id)}>Skip</button>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
                    {job.status === 'applied' && '✅ Applied'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          onClose={() => setSelected(null)}
          onApply={handleApply}
          onSkip={handleSkip}
        />
      )}
    </div>
  );
}
