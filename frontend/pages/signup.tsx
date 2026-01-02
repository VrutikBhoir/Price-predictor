import { useState } from 'react';
import Head from 'next/head';
import { signup } from '../lib/api';
import { useRouter } from 'next/router';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!name.trim()) throw new Error('Name is required');
      if (!email.trim()) throw new Error('Email is required');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email');
      if (password.length < 6) throw new Error('Password must be at least 6 characters');
      const res = await signup(name.trim(), email.trim(), password);
      if (!res.ok || !res.user) throw new Error('Signup failed');
      // Store user for session-like behavior
      localStorage.setItem('user', JSON.stringify(res.user));
      router.push('/');
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', padding: 16 }}>
      <Head>
        <title>Sign Up</title>
      </Head>
      <h1>Create an account</h1>
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <div>Name</div>
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ padding: 8, width: '100%' }} />
        </div>
        <div>
          <div>Email</div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: 8, width: '100%' }} />
        </div>
        <div>
          <div>Password</div>
          <div className="input-with-icon" style={{ width: '100%' }}>
            <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: 8, width: '100%' }} />
            <button type="button" className="input-icon-btn" onClick={() => setShowPw((v) => !v)} aria-label="Toggle password visibility">
              {showPw ? '🙈' : '👁️'}
            </button>
          </div>
        </div>
        <button className="button" disabled={loading} onClick={onSubmit}>
          {loading ? 'Signing up…' : 'Sign Up'}
        </button>
        {!!error && <p style={{ color: 'crimson' }}>{error}</p>}
        <div>
          Already have an account? <a href="/login">Log in</a>
        </div>
      </div>
    </div>
  );
}