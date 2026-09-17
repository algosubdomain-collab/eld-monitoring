import { useState } from 'react';
import { Truck } from '../components/Icons.jsx';

/**
 * Kirish oynasi. Birinchi ishga tushirishda (hali hech kim yo'q) shu yerda
 * birinchi akkaunt yaratiladi.
 */
export default function Login({ needsSetup, onDone }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (needsSetup && password !== repeat) return setError('Passwords do not match');

    setBusy(true);
    try {
      const res = await fetch(needsSetup ? '/api/auth/setup' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: login.trim(), password }),
      });
      const body = await res.json();
      if (body.error) throw new Error(body.error);
      onDone(body.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gate">
      <form className="card gatecard" onSubmit={submit}>
        <span className="mark"><Truck /></span>

        <h1>{needsSetup ? 'Create your account' : 'Sign in'}</h1>
        <p className="lead">
          {needsSetup
            ? 'This is the first run — pick a login and password for the dashboard.'
            : 'ELD Monitoring'}
        </p>

        {error && <div className="gateerr">{error}</div>}

        <input
          className="gateinput" type="text" value={login} placeholder="Login"
          autoComplete="username" autoFocus
          onChange={(e) => { setLogin(e.target.value); setError(null); }}
        />
        <input
          className="gateinput" type="password" value={password} placeholder="Password"
          autoComplete={needsSetup ? 'new-password' : 'current-password'}
          style={{ marginTop: 10 }}
          onChange={(e) => { setPassword(e.target.value); setError(null); }}
        />
        {needsSetup && (
          <input
            className="gateinput" type="password" value={repeat} placeholder="Repeat password"
            autoComplete="new-password" style={{ marginTop: 10 }}
            onChange={(e) => { setRepeat(e.target.value); setError(null); }}
          />
        )}

        <button
          className="btn lime wide" type="submit"
          disabled={busy || !login.trim() || !password}
        >
          {busy ? 'Please wait…' : needsSetup ? 'Create account' : 'Sign in'}
        </button>

        {needsSetup && (
          <p className="gatefoot">Password must be at least 8 characters.</p>
        )}
      </form>
    </div>
  );
}
