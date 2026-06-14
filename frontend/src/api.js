// Central API client
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Profile
  getProfile:    ()       => req('GET',   '/api/profile'),
  updateProfile: (data)   => req('PUT',   '/api/profile', data),
  uploadResume:  (file)   => {
    const fd = new FormData();
    fd.append('file', file);
    return fetch(`${BASE}/api/profile/resume`, { method: 'POST', body: fd }).then(r => r.json());
  },

  // Jobs
  getJobs:     (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return req('GET', `/api/jobs?${q}`);
  },
  getJob:      (id)  => req('GET',  `/api/jobs/${id}`),
  getJobStats: ()    => req('GET',  '/api/jobs/stats'),
  skipJob:     (id)  => req('POST', `/api/jobs/${id}/skip`),
  regenCover:  (id)  => req('POST', `/api/jobs/${id}/regenerate-cover-letter`),

  // Applications
  getApplications: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return req('GET', `/api/applications?${q}`);
  },
  getAppStats:     ()            => req('GET',   '/api/applications/stats'),
  updateAppStatus: (id, data)    => req('PATCH',  `/api/applications/${id}`, data),
  deleteApp:       (id)          => req('DELETE', `/api/applications/${id}`),

  // Agent
  getAgentStatus: ()    => req('GET',  '/api/agent/status'),
  startAgent:     ()    => req('POST', '/api/agent/start'),
  stopAgent:      ()    => req('POST', '/api/agent/stop'),
  applyToJob:     (id)  => req('POST', `/api/agent/apply/${id}`),
  getLogs:        (n=50)=> req('GET',  `/api/agent/logs?limit=${n}`),
};
