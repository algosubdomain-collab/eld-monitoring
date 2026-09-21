import { useCallback, useEffect, useState } from 'react';
import { Truck, Plus } from '../components/Icons.jsx';

/**
 * Owner paneli — dashboard'dan butunlay alohida. Foydalanuvchilarni faqat
 * owner yaratadi; har bir foydalanuvchi o'z ulanishlarini o'zi sozlaydi.
 */
export default function Owner({ user, onSignOut, onUnauthorized }) {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  // Qaysi qatorda parol maydoni yoki o'chirish tasdig'i ochiq.
  const [resetFor, setResetFor] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const call = useCallback(async (url, method = 'GET', body) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (res.status === 401 && data.needsLogin) { onUnauthorized(); return false; }
      if (data.error) throw new Error(data.error);
      setUsers(data.users);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }, [onUnauthorized]);

  useEffect(() => { call('/api/users'); }, [call]);

  const addUser = async (e) => {
    e.preventDefault();
    const name = login.trim().toLowerCase();
    if (await call('/api/users', 'POST', { login: name, password })) {
      setLogin('');
      setPassword('');
      setNotice(`User "${name}" created — they can sign in now.`);
    }
  };

  const path = (u) => `/api/users/${encodeURIComponent(u.login)}`;

  const savePassword = async (u) => {
    // O'z parolini o'zgartirsa, owner ham hamma joydan chiqariladi —
    // keyingi so'rov 401 qaytaradi va kirish oynasi ochiladi.
    if (await call(path(u), 'PATCH', { password: newPassword })) {
      setResetFor(null);
      setNewPassword('');
      setNotice(u.role === 'owner'
        ? 'Your password was changed — sign in again with the new one.'
        : `Password for "${u.login}" changed — they were signed out everywhere.`);
    }
  };

  const remove = async (u) => {
    if (confirmDelete !== u.login) return setConfirmDelete(u.login);
    setConfirmDelete(null);
    if (await call(path(u), 'DELETE')) setNotice(`User "${u.login}" deleted.`);
  };

  // Owner ham ro'yxatda turadi: uning paroli ham shu yerdan o'zgartiriladi.
  // O'chirib bo'lmaydi, shuning uchun qatorida faqat "Password" tugmasi bor.
  const accounts = [...(users ?? [])].sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : 0));
  const owner = (users ?? []).find((u) => u.role === 'owner');

  return (
    <div className="setup">
      <div className="masthead">
        <span className="logo"><Truck /></span>
        <h1>Owner panel</h1>
        <span style={{ flex: 1 }} />
        <span className="ownerwho">{user.login}</span>
        <button className="btn" onClick={onSignOut}>Sign out</button>
      </div>

      {error && <div className="gateerr">{error}</div>}
      {notice && !error && <div className="ownernote">{notice}</div>}

      <section className="card setupcard">
        <header>
          <div>
            <div className="eyebrow">New account</div>
            <h2>Create a user</h2>
            <p>Give them the login and password. They sign in and connect their own ELD platform and Telegram group.</p>
          </div>
        </header>

        <form className="setupform useradd" onSubmit={addUser}>
          <input
            className="gateinput" type="text" value={login} placeholder="Login"
            autoComplete="off"
            onChange={(e) => { setLogin(e.target.value); setError(null); setNotice(null); }}
          />
          <input
            className="gateinput" type="password" value={password}
            placeholder="Password (min. 8 characters)" autoComplete="new-password"
            onChange={(e) => { setPassword(e.target.value); setError(null); setNotice(null); }}
          />
          <div className="acts">
            <button className="btn lime" type="submit" disabled={busy || !login.trim() || password.length < 8}>
              <Plus />Create user
            </button>
          </div>
        </form>
      </section>

      <section className="card setupcard">
        <header>
          <div>
            <div className="eyebrow">Accounts</div>
            <h2>{users ? `${accounts.length} account${accounts.length === 1 ? '' : 's'}` : 'Loading…'}</h2>
          </div>
        </header>

        <div className="rows">
          {users && !accounts.length && (
            <div className="setuprow"><span className="id">No users yet — create the first one above.</span></div>
          )}

          {accounts.map((u) => (
            <div key={u.login}>
              <div className="setuprow">
                <span className={`dot ${u.platforms.length ? 'on' : ''}`} />
                <span className="meta">
                  <span className="nm">{u.login}{u.role === 'owner' ? ' · owner' : ''}</span>
                  <span className="id">
                    {u.role === 'owner'
                      ? 'Owner account — manages users only'
                      : u.platforms.length ? u.platforms.join(', ') : 'No platform connected'}
                    {u.expired.length ? ` · ${u.expired.join(', ')} expired` : ''}
                    {u.telegram ? ` · Telegram: ${u.telegram}` : ''}
                    {u.createdAt ? ` · added ${new Date(u.createdAt).toLocaleDateString()}` : ''}
                  </span>
                </span>
                <span style={{ flex: 1 }} />
                <span className="useracts">
                  <button
                    className="btn sm" disabled={busy}
                    onClick={() => { setResetFor(resetFor === u.login ? null : u.login); setNewPassword(''); }}
                  >
                    Password
                  </button>
                  {u.role !== 'owner' && (
                    <button
                      className={`btn sm ${confirmDelete === u.login ? 'confirm' : ''}`}
                      disabled={busy}
                      onClick={() => remove(u)}
                      onBlur={() => setConfirmDelete(null)}
                    >
                      {confirmDelete === u.login ? 'Confirm delete' : 'Delete'}
                    </button>
                  )}
                </span>
              </div>

              {resetFor === u.login && (
                <div className="setupform manualid">
                  <input
                    className="gateinput" type="password" value={newPassword} autoFocus
                    placeholder={`New password for ${u.login}`} autoComplete="new-password"
                    onChange={(e) => { setNewPassword(e.target.value); setError(null); }}
                  />
                  <button
                    className="btn lime" disabled={busy || newPassword.length < 8}
                    onClick={() => savePassword(u)}
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {owner && (
        <p className="ownerfoot">
          Locked out? Reset any password from the server:{' '}
          <code>npm run user:reset -- {owner.login} &lt;new-password&gt;</code>
        </p>
      )}
    </div>
  );
}
