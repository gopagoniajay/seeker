import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

const STATUS_META = {
  applied:    { label: 'Applied',     color: 'badge-blue',  icon: '📤' },
  interview:  { label: 'Interview',   color: 'badge-green', icon: '🎯' },
  offer:      { label: 'Offer',       color: 'badge-cyan',  icon: '🎉' },
  rejected:   { label: 'Rejected',    color: 'badge-red',   icon: '❌' },
  withdrawn:  { label: 'Withdrawn',   color: 'badge-gray',  icon: '↩️' },
  no_response:{ label: 'No Response', color: 'badge-amber', icon: '⏳' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, color: 'badge-gray', icon: '❓' };
  return <span className={`badge ${m.color}`}>{m.icon} {m.label}</span>;
}

export default function Applications() {
  const [apps, setApps]       = useState([]);
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('');
  const [editing, setEditing] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNotes, setEditNotes]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, s] = await Promise.all([
        api.getApplications(filter ? { status: filter } : {}),
        api.getAppStats(),
      ]);
      setApps(a); setStats(s);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  function openEdit(app) {
    setEditing(app);
    setEditStatus(app.status);
    setEditNotes(app.notes || '');
  }

  async function saveEdit() {
    await api.updateAppStatus(editing.id, { status: editStatus, notes: editNotes });
    setEditing(null);
    load();
  }

  async function del(id) {
    if (!confirm('Delete this application record?')) return;
    await api.deleteApp(id);
    setApps(prev => prev.filter(a => a.id !== id));
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📋 Applications Tracker</h1>
          <p className="page-subtitle">Track every submitted application and its outcome</p>
        </div>
        <button className="btn btn-ghost" onClick={load}>🔄 Refresh</button>
      </div>

      <div className="page-body">
        {/* Stats Row */}
        {stats && (
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px,1fr))', marginBottom: 24 }}>
            {[
              { label: 'Total Applied', value: stats.total,     icon: '📤', color: 'var(--accent)' },
              { label: 'Interviews',    value: stats.interview, icon: '🎯', color: 'var(--success)' },
              { label: 'Offers',        value: stats.offer,     icon: '🎉', color: 'var(--info)' },
              { label: 'Rejected',      value: stats.rejected,  icon: '❌', color: 'var(--danger)' },
              { label: 'Success Rate',  value: `${stats.success_rate}%`, icon: '📈', color: 'var(--warning)' },
            ].map(s => (
              <div key={s.label} className="stat-card" style={{ '--accent-color': s.color }}>
                <div className="stat-icon">{s.icon}</div>
                <div className="stat-value" style={{ fontSize: 26 }}>{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <button className={`btn ${filter === '' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setFilter('')}>All</button>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <button key={k} className={`btn ${filter === k ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setFilter(k)}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} /></div>
        ) : apps.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <div className="empty-title">No applications yet</div>
            <div className="empty-desc">Go to the Job Queue and hit "Apply Now" to start submitting applications.</div>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Position</th>
                  <th>Company</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Applied</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {apps.map(app => (
                  <tr key={app.id}>
                    <td style={{ fontWeight: 600, maxWidth: 200 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.job_title}</div>
                    </td>
                    <td style={{ color: 'var(--accent-light)' }}>{app.company}</td>
                    <td>
                      <span className={`badge ${app.source === 'linkedin' ? 'badge-blue' : app.source === 'indeed' ? 'badge-amber' : 'badge-cyan'}`}>
                        {app.source}
                      </span>
                    </td>
                    <td><StatusBadge status={app.status} /></td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                      {new Date(app.applied_at).toLocaleDateString()}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 12, maxWidth: 180 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {app.notes || '—'}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(app)}>✏️</button>
                        <a className="btn btn-ghost btn-sm" href={app.apply_url} target="_blank" rel="noreferrer">🔗</a>
                        <button className="btn btn-danger btn-sm" onClick={() => del(app.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditing(null)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div className="modal-title">Update Application</div>
              <button className="modal-close" onClick={() => setEditing(null)}>×</button>
            </div>
            <div style={{ marginBottom: 10, color: 'var(--text-secondary)', fontSize: 13 }}>
              {editing.job_title} @ {editing.company}
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Add any notes, interview dates, etc." style={{ minHeight: 80 }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" onClick={saveEdit}>💾 Save</button>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
