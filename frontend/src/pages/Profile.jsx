import { useState, useEffect } from 'react';
import { api } from '../api';

function TagsInput({ value, onChange, placeholder }) {
  const [input, setInput] = useState('');

  function addTag(e) {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      const tag = input.trim().replace(/,$/, '');
      if (tag && !value.includes(tag)) onChange([...value, tag]);
      setInput('');
    }
  }

  function removeTag(tag) { onChange(value.filter(t => t !== tag)); }

  return (
    <div className="tags-container" onClick={() => document.getElementById('tag-inp-' + placeholder)?.focus()}>
      {value.map(t => (
        <span key={t} className="tag">
          {t} <span className="tag-remove" onClick={() => removeTag(t)}>×</span>
        </span>
      ))}
      <input
        id={'tag-inp-' + placeholder}
        className="tags-input"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={addTag}
        placeholder={value.length === 0 ? placeholder : ''}
      />
    </div>
  );
}

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved]     = useState(false);
  const [dragging, setDragging] = useState(false);
  const [activeSection, setActiveSection] = useState('personal');

  useEffect(() => {
    api.getProfile()
      .then(setProfile)
      .catch(() => setProfile({
        name: '', email: '', phone: '', location: '', skills: [],
        job_titles: [], target_location: 'Remote', min_salary: 0,
        blacklist: [], linkedin_email: '', linkedin_password: '',
        indeed_email: '', indeed_password: '', resume_filename: '', has_resume: false,
      }))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const updated = await api.updateProfile(profile);
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { alert(e.message); }
    setSaving(false);
  }

  async function handleFile(file) {
    if (!file || !file.name.endsWith('.pdf')) return alert('Please upload a PDF file');
    setUploading(true);
    try {
      const updated = await api.uploadResume(file);
      setProfile(p => ({ ...p, resume_filename: updated.resume_filename, has_resume: updated.has_resume }));
    } catch (e) { alert(e.message); }
    setUploading(false);
  }

  function set(field) { return v => setProfile(p => ({ ...p, [field]: v })); }
  function setStr(field) { return e => setProfile(p => ({ ...p, [field]: e.target.value })); }

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} /></div>;

  const sections = [
    { id: 'personal',     label: '👤 Personal Info' },
    { id: 'resume',       label: '📄 Resume' },
    { id: 'preferences',  label: '🎯 Job Preferences' },
    { id: 'credentials',  label: '🔑 Login Credentials' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">👤 Your Profile</h1>
          <p className="page-subtitle">Tell the agent about yourself — this drives job matching and cover letters</p>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving…</> : saved ? '✅ Saved!' : '💾 Save Profile'}
        </button>
      </div>

      <div className="page-body">
        {/* Section tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
          {sections.map(s => (
            <button key={s.id} className={`btn ${activeSection === s.id ? 'btn-primary' : 'btn-ghost'} btn-sm`}
              onClick={() => setActiveSection(s.id)}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Personal Info */}
        {activeSection === 'personal' && (
          <div className="two-col">
            <div>
              {[
                { label: 'Full Name', field: 'name', placeholder: 'Raaj Gopagoni' },
                { label: 'Email Address', field: 'email', placeholder: 'raaj@example.com' },
                { label: 'Phone Number', field: 'phone', placeholder: '+1 555 000 0000' },
                { label: 'Location', field: 'location', placeholder: 'Hyderabad, India' },
              ].map(({ label, field, placeholder }) => (
                <div key={field} className="form-group">
                  <label className="form-label">{label}</label>
                  <input className="form-input" value={profile[field] || ''} onChange={setStr(field)} placeholder={placeholder} />
                </div>
              ))}
            </div>
            <div>
              <div className="form-group">
                <label className="form-label">Skills</label>
                <TagsInput value={profile.skills || []} onChange={set('skills')} placeholder="Type skill + Enter (e.g. Python)" />
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>Press Enter or comma to add each skill</div>
              </div>
              <div className="form-group">
                <label className="form-label">Target Job Titles</label>
                <TagsInput value={profile.job_titles || []} onChange={set('job_titles')} placeholder="e.g. Software Engineer" />
              </div>
              <div className="form-group">
                <label className="form-label">Blacklisted Companies (never apply)</label>
                <TagsInput value={profile.blacklist || []} onChange={set('blacklist')} placeholder="e.g. Amazon, Facebook" />
              </div>
            </div>
          </div>
        )}

        {/* Resume */}
        {activeSection === 'resume' && (
          <div>
            <div
              className={`upload-zone ${dragging ? 'drag-over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => document.getElementById('resume-file-input').click()}
            >
              {uploading
                ? <><div className="upload-icon">⏳</div><p className="upload-text">Extracting text from PDF…</p></>
                : profile.has_resume
                ? <><div className="upload-icon">✅</div>
                    <p className="upload-text"><strong>{profile.resume_filename}</strong> uploaded</p>
                    <p className="upload-text" style={{ marginTop: 6, fontSize: 12 }}>Click or drag to replace</p></>
                : <><div className="upload-icon">📄</div>
                    <p className="upload-text"><strong>Click or drag & drop</strong> your resume PDF</p>
                    <p className="upload-text" style={{ marginTop: 6, fontSize: 12 }}>AI will extract text to use for scoring & cover letters</p></>
              }
              <input id="resume-file-input" type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
            </div>
            {profile.has_resume && (
              <div className="card" style={{ marginTop: 16 }}>
                <div style={{ color: 'var(--success)', fontWeight: 600, marginBottom: 6 }}>✅ Resume Successfully Uploaded</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                  Your resume has been processed. The AI will use this content to score jobs and write tailored cover letters.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Preferences */}
        {activeSection === 'preferences' && (
          <div className="two-col">
            <div>
              <div className="form-group">
                <label className="form-label">Preferred Location / Remote</label>
                <input className="form-input" value={profile.target_location || ''} onChange={setStr('target_location')} placeholder="Remote, New York, Hyderabad" />
              </div>
              <div className="form-group">
                <label className="form-label">Minimum Annual Salary (USD)</label>
                <input className="form-input" type="number" value={profile.min_salary || 0} onChange={e => setProfile(p => ({ ...p, min_salary: +e.target.value }))} placeholder="60000" />
              </div>
            </div>
            <div className="card" style={{ alignSelf: 'start' }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>🤖 Agent Configuration</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.7 }}>
                <div>• <strong>Search Interval:</strong> Every 6 hours (configurable in backend .env)</div>
                <div>• <strong>Min Match Score:</strong> 60/100 to queue a job</div>
                <div>• <strong>Max Results Per Site:</strong> 15 per search term</div>
                <div>• <strong>Mode:</strong> Semi-auto (you approve before applying)</div>
              </div>
            </div>
          </div>
        )}

        {/* Credentials */}
        {activeSection === 'credentials' && (
          <div>
            <div className="card" style={{ marginBottom: 20, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}>
              <div style={{ color: 'var(--warning)', fontWeight: 700, marginBottom: 6 }}>⚠️ Security Notice</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
                Credentials are stored locally in your SQLite database only. They are never transmitted outside your machine.
                Use with caution — automation may violate platform ToS.
              </div>
            </div>
            <div className="two-col">
              <div>
                <div className="section-label">LinkedIn</div>
                <div className="form-group">
                  <label className="form-label">LinkedIn Email</label>
                  <input className="form-input" type="email" value={profile.linkedin_email || ''} onChange={setStr('linkedin_email')} placeholder="you@email.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">LinkedIn Password</label>
                  <input className="form-input" type="password" value={profile.linkedin_password || ''} onChange={setStr('linkedin_password')} placeholder="••••••••" />
                </div>
              </div>
              <div>
                <div className="section-label">Indeed</div>
                <div className="form-group">
                  <label className="form-label">Indeed Email</label>
                  <input className="form-input" type="email" value={profile.indeed_email || ''} onChange={setStr('indeed_email')} placeholder="you@email.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Indeed Password</label>
                  <input className="form-input" type="password" value={profile.indeed_password || ''} onChange={setStr('indeed_password')} placeholder="••••••••" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
