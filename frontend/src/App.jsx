import { useState, useEffect } from 'react';
import Dashboard    from './pages/Dashboard';
import JobQueue     from './pages/JobQueue';
import Profile      from './pages/Profile';
import Applications from './pages/Applications';
import { api } from './api';
import './index.css';

const NAV_ITEMS = [
  { id: 'dashboard',    label: 'Dashboard',     icon: '⚡' },
  { id: 'jobs',         label: 'Job Queue',      icon: '🎯' },
  { id: 'applications', label: 'Applications',   icon: '📋' },
  { id: 'profile',      label: 'Profile',        icon: '👤' },
];

export default function App() {
  const [page, setPage]           = useState('dashboard');
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    api.getJobStats()
      .then(s => setQueueCount(s.queued || 0))
      .catch(() => {});
  }, [page]);

  const pageMap = {
    dashboard:    <Dashboard />,
    jobs:         <JobQueue />,
    applications: <Applications />,
    profile:      <Profile />,
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">🤖</div>
          <span className="logo-text">JobAgent AI</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'jobs' && queueCount > 0 && (
                <span className="nav-badge">{queueCount}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>JobAgent AI v1.0</div>
            <div>Powered by Google Gemini</div>
            <div>LinkedIn · Indeed · Glassdoor</div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {pageMap[page] || <Dashboard />}
      </main>
    </div>
  );
}
