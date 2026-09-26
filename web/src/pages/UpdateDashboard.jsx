import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Back, Search } from '../components/Icons.jsx';
import DriverName from '../components/DriverName.jsx';
import Dropdown from '../components/Dropdown.jsx';
import BoardSettings from '../components/BoardSettings.jsx';
import { useProvider } from '../lib/provider.jsx';
import { hhmm, urgency, ago } from '../lib/format.js';

// Profil so'nggi 48 soatda o'zgargan bo'lsa — "Profile changed" ko'rsatiladi.
const profileChanged = (iso) => iso && (Date.now() - new Date(iso).getTime()) < 48 * 60 * 60 * 1000;

// Faol haydovchi — so'nggi 24 soatda signal bergani.
const DAY_MS = 24 * 60 * 60 * 1000;
const isActive = (d) => d.lastUpdate && (Date.now() - new Date(d.lastUpdate).getTime()) < DAY_MS;

const CYCLE_MAX = 70 * 60; // 70 soat (daqiqada)

// Cycle uchun rang: 15 soatdan kam — qizil, 25 dan kam — sariq, aks holda yashil.
const cycleColor = (min) =>
  min == null ? 'var(--slate)' : min < 900 ? 'var(--red)' : min < 1500 ? 'var(--amber)' : 'var(--lime)';

/** Cycle bo'yicha maslahat — kam qolganda notification kabi kichik yozuv. */
function cycleSuggestion(min) {
  if (min == null) return null;
  if (min < 900) return { label: 'Open fast', color: 'var(--red)' };   // < 15 soat
  if (min < 1500) return { label: 'Need open', color: 'var(--amber)' }; // < 25 soat
  return null;
}

/** Cycle qoldig'i — glowli aylana progress ichida (soat). Spline uslubi. */
function CycleRing({ min }) {
  const color = cycleColor(min);
  const h = min == null ? '—' : Math.round(min / 60);
  const pct = min == null ? 0 : Math.max(0.02, Math.min(1, min / CYCLE_MAX));
  const r = 16;
  const circ = 2 * Math.PI * r;
  return (
    <span className="cring" style={{ '--c': color }} title="Cycle left">
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <circle className="crtrack" cx="20" cy="20" r={r} />
        <circle className="crprog" cx="20" cy="20" r={r}
          style={{ strokeDasharray: circ, strokeDashoffset: circ * (1 - pct) }} />
      </svg>
      <b>{h}</b>
    </span>
  );
}

export default function UpdateDashboard({ data }) {
  const [rows, setRows] = useState({});
  const [config, setConfig] = useState({ statuses: [], updates: [] });
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const provider = useProvider();
  // Certify hozircha Leader/Factor (drivehos) uchun.
  const certifySupported = provider?.source === 'drivehos';

  const certify = useCallback(async (driverId, companyId) => {
    const res = await fetch('/api/certify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: provider?.id, driverId, companyId }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.error) throw new Error(body?.error || 'Certify failed');
  }, [provider]);

  // Certify all — barcha faol haydovchilarni birma-bir tasdiqlaydi.
  const [bulk, setBulk] = useState(null); // {phase:'confirm'|'running'|'done', done, total, ok, fail}
  // Har bir haydovchi uchun certify jarayoni: idle|confirm|doing|done|err.
  const [certState, setCertState] = useState({});

  useEffect(() => {
    fetch('/api/board').then((r) => r.ok && r.json()).then((b) => b && setRows(b.rows)).catch(() => {});
    fetch('/api/board-config').then((r) => r.ok && r.json()).then((c) => c && setConfig(c)).catch(() => {});
  }, []);

  const patch = useCallback((driverId, part) => {
    setRows((cur) => ({ ...cur, [driverId]: { ...(cur[driverId] ?? {}), ...part } }));
    fetch('/api/board', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId, patch: part }),
    }).catch(() => {});
  }, []);

  // Bitta haydovchini tasdiqlaydi, jarayonni o'sha qatorda ko'rsatadi va
  // muvaffaqiyatда "certified"ni saqlaydi (yashil nuqta yonadi).
  const runCertify = useCallback(async (d) => {
    setCertState((s) => ({ ...s, [d.driverId]: 'doing' }));
    try {
      await certify(d.driverId, d.companyId);
      patch(d.driverId, { certified: new Date().toISOString() });
      setCertState((s) => ({ ...s, [d.driverId]: 'done' }));
      return true;
    } catch {
      setCertState((s) => ({ ...s, [d.driverId]: 'err' }));
      return false;
    }
  }, [certify, patch]);

  // Qatordagi tugma: avval tasdiq, keyin bajaradi.
  const onRowCertify = useCallback((d) => {
    setCertState((s) => {
      if (s[d.driverId] === 'confirm') { runCertify(d); return s; }
      return { ...s, [d.driverId]: 'confirm' };
    });
  }, [runCertify]);

  // "confirm" holatlarini bir necha soniyada tiklaymiz.
  useEffect(() => {
    if (!Object.values(certState).includes('confirm')) return undefined;
    const t = setTimeout(() => setCertState((s) => {
      const n = { ...s };
      for (const k of Object.keys(n)) if (n[k] === 'confirm') delete n[k];
      return n;
    }), 4000);
    return () => clearTimeout(t);
  }, [certState]);

  const saveConfig = useCallback(async (next) => {
    const res = await fetch('/api/board-config', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next),
    });
    if (res.ok) setConfig(await res.json());
    setSettingsOpen(false);
  }, []);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (d) => !q || [d.driverName, d.truck, d.company].some((v) => String(v).toLowerCase().includes(q));
    const byCo = new Map();
    for (const d of data.drivers) {
      if (!isActive(d)) continue;
      if (!match(d)) continue;
      const key = d.company || '—';
      if (!byCo.has(key)) byCo.set(key, []);
      byCo.get(key).push(d);
    }
    return [...byCo.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([company, list]) => ({
        company,
        list: list.sort((a, b) => String(a.driverName).localeCompare(String(b.driverName))),
      }));
  }, [data, query]);

  const total = groups.reduce((n, g) => n + g.list.length, 0);

  const certifyAll = useCallback(async () => {
    const list = groups.flatMap((g) => g.list);
    if (!list.length) return;
    if (!bulk || bulk.phase !== 'confirm') { setBulk({ phase: 'confirm', total: list.length }); return; }

    let ok = 0; let fail = 0;
    setBulk({ phase: 'running', done: 0, total: list.length, ok, fail });
    for (let i = 0; i < list.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const done = await runCertify(list[i]); // har bir qatorda jarayon ko'rinadi
      if (done) ok += 1; else fail += 1;
      setBulk({ phase: 'running', done: i + 1, total: list.length, ok, fail });
    }
    setBulk({ phase: 'done', done: list.length, total: list.length, ok, fail });
  }, [groups, bulk, runCertify]);

  // "Confirm" holatini bir necha soniyada tiklaymiz.
  useEffect(() => {
    if (bulk?.phase !== 'confirm') return undefined;
    const t = setTimeout(() => setBulk(null), 4000);
    return () => clearTimeout(t);
  }, [bulk]);

  const bulkLabel = !bulk ? 'Certify all'
    : bulk.phase === 'confirm' ? `Certify all ${bulk.total}?`
    : bulk.phase === 'running' ? `Certifying ${bulk.done}/${bulk.total}…`
    : `Done · ${bulk.ok} certified${bulk.fail ? ` · ${bulk.fail} failed` : ''}`;

  return (
    <div className="page narrow">
      <div className="masthead">
        <Link className="logo back" to="/" title="Back to monitoring"><Back /></Link>
        <h1>Update Dashboard</h1>
        <span style={{ flex: 1 }} />
        {certifySupported && (
          <button
            className={`btn ${bulk?.phase === 'confirm' ? 'confirm' : 'lime'}`}
            disabled={bulk?.phase === 'running' || !total}
            onClick={certifyAll}
          >
            {bulkLabel}
          </button>
        )}
        <button className="btn" onClick={() => setSettingsOpen(true)}>Settings</button>
        <Link className="btn" to="/">Monitoring</Link>
      </div>

      <div className="controls">
        <div className="field">
          <Search />
          <input type="search" value={query} placeholder="Search driver, truck or company…"
            onChange={(e) => setQuery(e.target.value)} />
        </div>
        <span className="beat off"><i />{total} active drivers · {groups.length} companies</span>
      </div>

      <div className="board card">
        <div className="brow bhead">
          <span className="bc bidx">#</span>
          <span className="bc bname">Driver</span>
          <span className="bc bunit">Unit</span>
          <span className="bc bresp">Responsible</span>
          <span className="bc bstatus">Status</span>
          <span className="bc bupdate">Update</span>
          <span className="bc bdrive">Drive left</span>
          <span className="bc bcert">Certify</span>
        </div>

        {groups.map((g) => {
          const open = !collapsed[g.company];
          return (
            <div className="bgroup" key={g.company}>
              <button className="bgrouphead" onClick={() => setCollapsed((c) => ({ ...c, [g.company]: open }))}>
                <span className={`caret ${open ? 'open' : ''}`}>▸</span>
                <span className="coname">{g.company}</span>
                <span className="cocount">{g.list.length}</span>
              </button>

              {open && g.list.map((d, i) => {
                const r = rows[d.driverId] ?? {};
                return (
                  <div className="brow" key={d.driverId}>
                    <span className="bc bidx">{i + 1}</span>
                    <span className="bc bname">
                      <CycleRing min={d.cycleRemainingMin} />
                      <span className="ninfo">
                        <DriverName name={d.driverName} driver={d} />
                        <span className="chips">
                          {(() => {
                            const s = cycleSuggestion(d.cycleRemainingMin);
                            if (!s || r.suggFixed === s.label) return null;
                            // Bosilganda "fixed" bo'lib yo'qoladi (holat o'zgarsa qayta chiqadi).
                            return (
                              <button className="sugg" style={{ '--c': s.color }}
                                title="Mark as handled" onClick={() => patch(d.driverId, { suggFixed: s.label })}>
                                <i />{s.label}<span className="suggx">✕</span>
                              </button>
                            );
                          })()}
                          {profileChanged(d.profileUpdatedAt) && (
                            <span className="pchg" title={`Profile changed ${ago(d.profileUpdatedAt)}`}>Profile changed</span>
                          )}
                        </span>
                      </span>
                    </span>
                    <span className="bc bunit">
                      {d.truckActive != null && (
                        <span className={`unitdot ${d.truckActive ? 'on' : 'off'}`}
                          title={d.truckActive ? 'Truck active' : 'Truck deactivated'} />
                      )}
                      <span className="mono">{d.truck}</span>
                    </span>
                    <span className="bc bresp">
                      <RespInput value={r.responsible} onSave={(v) => patch(d.driverId, { responsible: v })} />
                    </span>
                    <span className="bc bstatus">
                      <Dropdown value={r.status ?? ''} options={config.statuses}
                        placeholder="Set status…" onChange={(v) => patch(d.driverId, { status: v })} />
                    </span>
                    <span className="bc bupdate">
                      <Dropdown value={r.update ?? ''} options={config.updates}
                        placeholder="Set update…" onChange={(v) => patch(d.driverId, { update: v })} />
                    </span>
                    <span className="bc bdrive">
                      <TimeLeft min={d.driveRemainingMin} />
                    </span>
                    <span className="bc bcert">
                      <CertifyButton
                        supported={certifySupported}
                        certified={Boolean(r.certified)}
                        state={certState[d.driverId] ?? 'idle'}
                        onClick={() => onRowCertify(d)} />
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}

        {!total && <div className="tierempty">No active drivers match your search.</div>}
      </div>

      {settingsOpen && (
        <BoardSettings config={config} onSave={saveConfig} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}

/** Qolgan haydash vaqti — soat ko'rinishida (clock ikonka + H:MM). */
function TimeLeft({ min }) {
  if (min == null) return <span className="nil">—</span>;
  const t = hhmm(min).replace('h ', ':').replace('m', ''); // "8h 08m" -> "8:08"
  return (
    <span className="timeleft" style={{ '--c': urgency(min) }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" />
      </svg>
      <b>{t}</b>
    </span>
  );
}

/** Responsible — inline matn, blur/Enter'da saqlanadi. */
function RespInput({ value, onSave }) {
  const [text, setText] = useState(value ?? '');
  useEffect(() => { setText(value ?? ''); }, [value]);
  return (
    <input
      className="textcell" value={text} placeholder="—"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { if (text !== (value ?? '')) onSave(text); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
    />
  );
}

/**
 * Certify holati: oldida yashil nuqta (certified bo'lsa yonadi), yonida tugma.
 * Jarayon (doing) o'sha qatorда ko'rinadi. Holat tashqaridan boshqariladi
 * (certify-all ham shu tugmani "doing" qilib ko'rsatadi).
 */
function CertifyButton({ supported, certified, state, onClick }) {
  if (!supported) return <span className="nil" title="Not supported for this platform yet">—</span>;

  const lit = certified || state === 'done';
  const label = {
    idle: certified ? 'Re-certify' : 'Certify',
    confirm: 'Confirm?',
    doing: 'Certifying…',
    done: 'Certified',
    err: 'Retry',
  }[state] ?? 'Certify';

  return (
    <span className="certcell">
      <span className={`certdot ${lit ? 'on' : ''}`} title={lit ? 'Certified' : 'Not certified'} />
      <button className={`btn sm certbtn ${state}`} disabled={state === 'doing'} onClick={onClick}>
        {state === 'doing' && <span className="certspin" />}{label}
      </button>
    </span>
  );
}
