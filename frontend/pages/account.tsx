import { useEffect, useState } from 'react';
import Head from 'next/head';

export default function AccountPage() {
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(false);
  const [nameInput, setNameInput] = useState<string>('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [pw1, setPw1] = useState<string>('');
  const [pw2, setPw2] = useState<string>('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        setUser(u);
        setNameInput(u?.name || '');
      }
      const notif = localStorage.getItem('notificationsEnabled');
      if (notif != null) setNotificationsEnabled(notif === 'true');
      const t = localStorage.getItem('theme');
      if (t === 'light' || t === 'dark') setTheme(t);
    } catch {}
  }, []);

  const toggleNotifications = () => {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    try { localStorage.setItem('notificationsEnabled', String(next)); } catch {}
  };

  const firstInitial = (user?.name || '').trim().charAt(0).toUpperCase() || (user?.email || '').trim().charAt(0).toUpperCase() || '';

  return (
    <div className="container" style={{ padding: 16 }}>
      <Head><title>Account</title></Head>
      <div className="card" style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div className="avatar" aria-hidden="true" title={user?.name || user?.email || ''}>
            {firstInitial || '👤'}
          </div>
          <h2 style={{ margin: 0 }}>Account</h2>
        </div>
        {user ? (
          <div style={{ display: 'grid', gap: 20 }}>
            {/* Basic info */}
            <div>
              <div style={{ color: 'var(--muted)' }}>First name</div>
              <div style={{ fontWeight: 600 }}>{(user.name || '').split(' ')[0] || '—'}</div>
            </div>

            <div>
              <div style={{ color: 'var(--muted)' }}>Email</div>
              <div style={{ fontWeight: 600 }}>{user.email || '—'}</div>
            </div>

            {/* Update name */}
            <div>
              <div style={{ color: 'var(--muted)' }}>Display name</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Enter your name" />
                <button className="button" onClick={() => {
                  const next = { ...user, name: nameInput || undefined };
                  setUser(next);
                  try { localStorage.setItem('user', JSON.stringify(next)); } catch {}
                  alert('Name updated');
                }}>Save</button>
              </div>
            </div>

            {/* Change password (local only demo) */}
            <div>
              <div style={{ color: 'var(--muted)' }}>Change password</div>
              <div style={{ display: 'grid', gap: 8 }}>
                <input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="New password" />
                <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Confirm new password" />
                <button className="button" onClick={() => {
                  if (!pw1 || pw1.length < 6) { alert('Password must be at least 6 characters'); return; }
                  if (pw1 !== pw2) { alert('Passwords do not match'); return; }
                  // Demo: we only store a marker in localStorage; no backend change.
                  try { localStorage.setItem('pw_set', 'true'); } catch {}
                  setPw1(''); setPw2('');
                  alert('Password updated (demo)');
                }}>Update Password</button>
              </div>
            </div>

            {/* Theme */}
            <div>
              <div style={{ color: 'var(--muted)' }}>Theme</div>
              <select value={theme} onChange={(e) => {
                const t = e.target.value === 'light' ? 'light' : 'dark';
                setTheme(t);
                try { localStorage.setItem('theme', t); } catch {}
                try { document.documentElement.setAttribute('data-theme', t); } catch {}
              }}>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>

            {/* Notifications */}
            <div>
              <div style={{ color: 'var(--muted)' }}>Notifications</div>
              <button className="button" onClick={toggleNotifications}>
                {notificationsEnabled ? '🔔 Enabled' : '🔕 Disabled'}
              </button>
            </div>

            {/* Danger zone + Logout */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="button" onClick={() => {
                try { localStorage.removeItem('user'); } catch {}
                alert('Logged out');
                window.location.href = '/';
              }}>🚪 Logout</button>
              <button className="button" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => {
                if (!confirm('Delete local account data? This will log you out.')) return;
                try {
                  localStorage.removeItem('user');
                  localStorage.removeItem('notificationsEnabled');
                  localStorage.removeItem('theme');
                  localStorage.removeItem('pw_set');
                } catch {}
                alert('Local account data cleared');
                window.location.href = '/';
              }}>🗑️ Delete Account (local)</button>
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--muted)' }}>
            You are not signed in. Please log in to manage your account.
          </div>
        )}
      </div>
    </div>
  );
}