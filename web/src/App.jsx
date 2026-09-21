import { useCallback, useEffect, useMemo, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { useFleet } from './useFleet.js';
import { useUpdates } from './useUpdates.js';
import Dashboard from './pages/Dashboard.jsx';
import Category from './pages/Category.jsx';
import Tiered from './pages/Tiered.jsx';
import UpdateRun from './pages/UpdateRun.jsx';
import Login from './pages/Login.jsx';
import Connect from './pages/Connect.jsx';
import Owner from './pages/Owner.jsx';
import { ProviderContext } from './lib/provider.jsx';

const PROVIDER_KEY = 'eld.provider';

/**
 * Kirish darvozasi. Owner butunlay alohida panelga tushadi — dashboard
 * hook'lari (haydovchilar, updates) uning uchun umuman ishga tushmaydi.
 */
export default function App() {
  const [auth, setAuth] = useState(null);      // null = hali noma'lum

  const loadAuth = useCallback(async () => {
    const body = await fetch('/api/auth/status').then((r) => r.json());
    setAuth(body);
    return body;
  }, []);

  useEffect(() => { loadAuth(); }, [loadAuth]);

  const onSignedOut = useCallback(() => {
    setAuth((a) => ({ ...a, user: null, needsSetup: false }));
  }, []);

  const signOut = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    onSignedOut();
  }, [onSignedOut]);

  if (!auth) return <Splash text="Starting…" />;

  if (!auth.user) {
    return <Login needsSetup={auth.needsSetup} onDone={loadAuth} />;
  }

  if (auth.user.role === 'owner') {
    return <Owner user={auth.user} onSignOut={signOut} onUnauthorized={onSignedOut} />;
  }

  return <Workspace user={auth.user} signOut={signOut} onSignedOut={onSignedOut} />;
}

function Workspace({ user, signOut: doSignOut, onSignedOut }) {
  const navigate = useNavigate();

  const [conns, setConns] = useState(null);
  const [showSetup, setShowSetup] = useState(false);

  const [auto, setAuto] = useState(true);
  const [provider, setProvider] = useState(() => localStorage.getItem(PROVIDER_KEY) ?? '');

  const loadConns = useCallback(async () => {
    const res = await fetch('/api/connections');
    if (res.status === 401) { setConns(null); return null; }
    const body = await res.json();
    setConns(body);
    return body;
  }, []);

  useEffect(() => { loadConns(); }, [loadConns]);

  useEffect(() => { if (provider) localStorage.setItem(PROVIDER_KEY, provider); }, [provider]);

  const connected = useMemo(
    () => conns?.providers?.filter((p) => p.connected) ?? [],
    [conns]
  );

  // Tanlangan platforma uzilgan bo'lsa — birinchi ulangani.
  const active = connected.some((p) => p.id === provider) ? provider : connected[0]?.id ?? '';
  useEffect(() => { if (active && active !== provider) setProvider(active); }, [active, provider]);

  const { data, error, busy, reload } = useFleet({
    auto,
    provider: active,
    enabled: Boolean(active),
    onUnauthorized: onSignedOut,
    onNotConnected: () => setShowSetup(true),
  });

  const updates = useUpdates();
  const signOut = async () => {
    await doSignOut();
    navigate('/');
  };

  // ---------- ekranlar ----------
  if (!conns) return <Splash text="Loading your connections…" />;

  // Hech narsa ulanmagan yoki foydalanuvchi o'zi sozlashni ochgan.
  if (!connected.length || showSetup) {
    return (
      <Connect
        status={conns}
        standalone={connected.length > 0}
        onChange={(next) => setConns(next)}
        onReady={() => { setShowSetup(false); reload(); }}
        onSignOut={signOut}
      />
    );
  }

  if (!data) {
    return (
      <div className="page">
        {error ? (
          <div className="card loading">
            <div className="t">Could not load the fleet</div>
            <div className="s err">{error}</div>
            <div className="acts">
              <button className="btn" onClick={() => reload()}>Try again</button>
              <button className="btn lime" onClick={() => setShowSetup(true)}>Connections</button>
              <button className="btn" onClick={signOut}>Sign out</button>
            </div>
          </div>
        ) : (
          <div className="card loading">
            <span className="dots"><i /><i /><i /></span>
            <div className="t">Loading the fleet…</div>
            <div className="s">
              Drivers are pulled company by company, so the first load takes
              around half a minute.
            </div>
            <div className="acts">
              <button className="btn" onClick={() => setShowSetup(true)}>Connections</button>
              <button className="btn" onClick={signOut}>Sign out</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const shell = {
    providerBar: { providers: connected, value: active, onChange: setProvider },
    onConnections: () => setShowSetup(true),
    onSignOut: signOut,
    user,
  };

  const home = (
    <Dashboard
      {...{ data, error, busy, reload, auto, setAuto }}
      updates={updates.state}
      {...shell}
    />
  );

  return (
    // Jadvaldagi ism havolasi qaysi platformaga olib borishini shu belgilaydi.
    <ProviderContext.Provider value={connected.find((p) => p.id === active) ?? null}>
      <Routes>
        <Route path="/" element={home} />
        <Route path="/c/:slug" element={<Category data={data} />} />
        <Route path="/ops/profile" element={<Tiered data={data} kind="profile" />} />
        <Route path="/ops/need-cycle" element={<Tiered data={data} kind="need-cycle" />} />
        <Route path="/ops/:slug" element={<UpdateRun data={data} updates={updates} />} />
        <Route path="*" element={home} />
      </Routes>
    </ProviderContext.Provider>
  );
}

const Splash = ({ text }) => (
  <div className="page">
    <div className="card loading">
      <span className="dots"><i /><i /><i /></span>
      <div className="t">{text}</div>
    </div>
  </div>
);
