import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Back, Search } from '../components/Icons.jsx';
import DriverName from '../components/DriverName.jsx';
import Dropdown from '../components/Dropdown.jsx';
import BoardSettings from '../components/BoardSettings.jsx';
import { useProvider } from '../lib/provider.jsx';
import { companiesOf } from '../lib/company.jsx';
import { useToast } from '../lib/toast.jsx';
import { hhmm, urgency, ago } from '../lib/format.js';

// Tanlangan board shu yerda eslab qolinadi — sahifa yangilansa ham saqlanadi.
const BOARD_KEY = 'eld.updateboard';

// Profil so'nggi 48 soatda o'zgargan bo'lsa — "Profile changed" ko'rsatiladi.
const profileChanged = (iso) => iso && (Date.now() - new Date(iso).getTime()) < 48 * 60 * 60 * 1000;

// Faol haydovchi — so'nggi 24 soatda signal bergani.
const DAY_MS = 24 * 60 * 60 * 1000;
const isActive = (d) => d.lastUpdate && (Date.now() - new Date(d.lastUpdate).getTime()) < DAY_MS;

const CYCLE_MAX = 70 * 60; // 70 soat (daqiqada)

// Cycle uchun rang: 15 soatdan kam — qizil, 25 dan kam — sariq, aks holda yashil.
const cycleColor = (min) =>
  min == null ? 'var(--slate)' : min < 900 ? 'var(--red)' : min < 1500 ? 'var(--amber)' : 'var(--lime)';

/** Belgilangan vaqt — kun va soat ("26 Sep 14:20"). Belgi kunlab turadi. */
const stamp = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Shu qatorda ko'rsatiladigan maslahat — bekor qilinganlari chiqmaydi. */
function suggestionFor(driver, row) {
  const s = cycleSuggestion(driver.cycleRemainingMin);
  return s && row.suggFixed !== s.label ? s : null;
}

/** Cycle bo'yicha maslahat — kam qolganda notification kabi kichik yozuv. */
function cycleSuggestion(min) {
  if (min == null) return null;
  if (min < 900) return { label: 'Open fast', color: 'var(--red)' };   // < 15 soat
  if (min < 1500) return { label: 'Need open', color: 'var(--amber)' }; // < 25 soat
  return null;
}

/**
 * Cycle qoldig'i — glowli aylana progress ichida (soat).
 * Vaqt kam qolganda halqa ustida xabarnoma yorlig'i chiqadi: u shu yerda
 * turadi, chunki ogohlantirish aynan shu raqamga tegishli. Bosilsa yo'qoladi
 * (holat o'zgarsa qayta chiqadi).
 */
function CycleRing({ min, sugg, onDismiss }) {
  const color = cycleColor(min);
  const h = min == null ? '—' : Math.round(min / 60);
  const pct = min == null ? 0 : Math.max(0.02, Math.min(1, min / CYCLE_MAX));
  const r = 16;
  const circ = 2 * Math.PI * r;
  return (
    <span className="cwrap">
      <span className="cring" style={{ '--c': color }}
        title={min == null ? 'Cycle left unknown' : `${h}h of cycle left`}>
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <circle className="crtrack" cx="20" cy="20" r={r} />
          <circle className="crprog" cx="20" cy="20" r={r}
            style={{ strokeDasharray: circ, strokeDashoffset: circ * (1 - pct) }} />
        </svg>
        <b>{h}</b>
      </span>
      {sugg && (
        <button type="button" className="cbadge" style={{ '--c': sugg.color }}
          title={`Cycle is running low — ${sugg.label}. Click to dismiss.`}
          onClick={onDismiss}>
          {sugg.label}
        </button>
      )}
    </span>
  );
}

export default function UpdateDashboard({ data }) {
  const [rows, setRows] = useState({});
  const [config, setConfig] = useState({
    statuses: [], profileForms: [], responsibles: [], me: '', boards: [],
  });
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const [settings, setSettings] = useState(null);  // null | {tab}
  const [board, setBoard] = useState(() => localStorage.getItem(BOARD_KEY) ?? '');
  // Sozlama kelgunicha board'lar ro'yxati bo'sh — saqlangan tanlovni shu
  // paytda "yo'q" deb hisoblamaslik uchun yuklanganini alohida kuzatamiz.
  const [configLoaded, setConfigLoaded] = useState(false);
  const provider = useProvider();
  const { notify } = useToast();
  // Certify hozircha Leader/Factor (drivehos) uchun.
  const certifySupported = provider?.source === 'drivehos';

  const openSettings = useCallback((tab = 'columns') => setSettings({ tab }), []);

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
    fetch('/api/board-config')
      .then((r) => r.ok && r.json())
      .then((c) => { if (c) setConfig(c); })
      .catch(() => {})
      .finally(() => setConfigLoaded(true));
  }, []);

  useEffect(() => { localStorage.setItem(BOARD_KEY, board); }, [board]);

  const patch = useCallback((driverId, part) => {
    setRows((cur) => ({ ...cur, [driverId]: { ...(cur[driverId] ?? {}), ...part } }));
    fetch('/api/board', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId, patch: part }),
    }).catch(() => notify('Could not save — check your connection', false));
  }, [notify]);

  /** Bir nechta qatorga bitta o'zgarish — bitta so'rov bilan. */
  const patchMany = useCallback((driverIds, part) => {
    if (!driverIds.length) return;
    setRows((cur) => {
      const next = { ...cur };
      for (const id of driverIds) next[id] = { ...(next[id] ?? {}), ...part };
      return next;
    });
    fetch('/api/board/bulk', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverIds, patch: part }),
    }).catch(() => notify('Could not save — check your connection', false));
  }, [notify]);

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
    if (res.ok) { setConfig(await res.json()); notify('Settings saved'); }
    else notify('Could not save settings', false);
    setSettings(null);
  }, [notify]);

  // Faol haydovchilar — board tab'lari va jadval shulardan quriladi.
  const active = useMemo(() => data.drivers.filter(isActive), [data]);
  const companies = useMemo(() => companiesOf(active), [active]);

  const boards = useMemo(() => config.boards ?? [], [config.boards]);
  const activeBoard = boards.find((b) => b.id === board) ?? null;

  // Board sozlamadan o'chirilgan bo'lsa — "All" ga qaytamiz.
  useEffect(() => {
    if (configLoaded && board && !boards.some((b) => b.id === board)) setBoard('');
  }, [configLoaded, board, boards]);

  // Har bir board tab'idagi haydovchilar soni (qidiruvdan qat'i nazar).
  const boardCounts = useMemo(() => {
    const out = {};
    for (const b of boards) {
      const set = new Set(b.companies);
      out[b.id] = active.filter((d) => set.has(d.companyId)).length;
    }
    return out;
  }, [boards, active]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (d) => !q || [d.driverName, d.truck, d.company].some((v) => String(v).toLowerCase().includes(q));
    const inBoard = activeBoard ? new Set(activeBoard.companies) : null;

    const byCo = new Map();
    for (const d of active) {
      if (inBoard && !inBoard.has(d.companyId)) continue;
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
  }, [active, query, activeBoard]);

  const visible = useMemo(() => groups.flatMap((g) => g.list), [groups]);
  const total = visible.length;
  const checkedCount = visible.filter((d) => rows[d.driverId]?.checkedAt).length;

  // Shift bilan diapazon tanlash faqat ko'zga ko'rinib turgan qatorlar bo'ylab
  // ishlaydi — yig'ilgan guruhdagi haydovchilar bexosdan belgilanib qolmasin.
  const selectable = useMemo(
    () => groups.filter((g) => !collapsed[g.company]).flatMap((g) => g.list.map((d) => d.driverId)),
    [groups, collapsed]
  );
  // Oxirgi oddiy bosilgan qator — diapazon shundan boshlanadi.
  const anchor = useRef(null);
  // Board yoki qidiruv o'zgarsa boshlanish nuqtasi ham bekor bo'ladi.
  useEffect(() => { anchor.current = null; }, [board, query]);

  const me = config.me ?? '';

  /**
   * Bitta mas'ulni ko'pchilikka biriktiradi.
   * scope='shown' — ochiq board va qidiruvdagilar (ekranda ko'rinib turganlar);
   * scope='all'   — filtrdan qat'i nazar barcha faol haydovchilar.
   */
  const assignAll = useCallback((name, scope = 'shown') => {
    const list = scope === 'all' ? active : visible;
    if (!name || !list.length) return;
    patchMany(list.map((d) => d.driverId), { responsible: name });
    notify(`${name} is now responsible for ${plural(list.length, 'driver')}`);
  }, [visible, active, patchMany, notify]);

  const checkAll = useCallback(() => {
    const ids = visible.filter((d) => !rows[d.driverId]?.checkedAt).map((d) => d.driverId);
    patchMany(ids, { checkedAt: new Date().toISOString(), checkedBy: me });
    notify(`Checked ${plural(ids.length, 'driver')}`);
  }, [visible, rows, patchMany, me, notify]);

  const clearAll = useCallback(() => {
    const ids = visible.filter((d) => rows[d.driverId]?.checkedAt).map((d) => d.driverId);
    patchMany(ids, { checkedAt: '', checkedBy: '' });
    notify(`Cleared ${plural(ids.length, 'check')}`);
  }, [visible, rows, patchMany, notify]);

  const toggleCheck = useCallback((driverId, shift = false) => {
    // Shift bilan: boshlanish nuqtasidan shu qatorgacha bo'lgan hammasi
    // boshlanish nuqtasi qanday bo'lsa, shunday holatga keltiriladi.
    if (shift && anchor.current && anchor.current !== driverId) {
      const a = selectable.indexOf(anchor.current);
      const b = selectable.indexOf(driverId);
      if (a !== -1 && b !== -1) {
        const ids = selectable.slice(Math.min(a, b), Math.max(a, b) + 1);
        const want = Boolean(rows[anchor.current]?.checkedAt);
        const changing = ids.filter((id) => Boolean(rows[id]?.checkedAt) !== want);

        // Shift bosilgan holda bosish matnni belgilab yuborishi mumkin.
        window.getSelection?.()?.removeAllRanges?.();

        if (changing.length) {
          patchMany(changing, want
            ? { checkedAt: new Date().toISOString(), checkedBy: me || '' }
            : { checkedAt: '', checkedBy: '' });
          notify(want
            ? `Checked ${plural(changing.length, 'driver')}`
            : `Cleared ${plural(changing.length, 'check')}`);
        }
        return;   // boshlanish nuqtasi saqlanadi — diapazonni cho'zish mumkin
      }
    }

    const on = Boolean(rows[driverId]?.checkedAt);
    anchor.current = driverId;
    patch(driverId, on
      ? { checkedAt: '', checkedBy: '' }
      : { checkedAt: new Date().toISOString(), checkedBy: me || rows[driverId]?.responsible || '' });
  }, [rows, patch, patchMany, me, selectable, notify]);

  const certifyAll = useCallback(async () => {
    const list = visible;
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
  }, [visible, bulk, runCertify]);

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
        <span className="spacer" />
        {certifySupported && (
          <button
            className={`btn ${bulk?.phase === 'confirm' ? 'confirm' : 'lime'}`}
            disabled={bulk?.phase === 'running' || !total}
            onClick={certifyAll}
          >
            {bulkLabel}
          </button>
        )}
        <button className="btn" onClick={() => openSettings('columns')}>Settings</button>
        <Link className="btn" to="/">Monitoring</Link>
      </div>

      {Boolean(boards.length) && (
        <nav className="btabs" role="tablist" aria-label="Boards">
          <BoardTab on={!activeBoard} count={active.length} onClick={() => setBoard('')}>All</BoardTab>
          {boards.map((b) => (
            <BoardTab key={b.id} on={activeBoard?.id === b.id} count={boardCounts[b.id] ?? 0}
              onClick={() => setBoard(b.id)}>{b.name}</BoardTab>
          ))}
        </nav>
      )}

      <div className="controls">
        <div className="field">
          <Search />
          <input type="search" value={query} placeholder="Search driver, truck or company…"
            aria-label="Search drivers" onChange={(e) => setQuery(e.target.value)} />
          {Boolean(query) && (
            <button className="fieldx" onClick={() => setQuery('')} aria-label="Clear search">✕</button>
          )}
        </div>
        <span className="cmeta">
          {plural(total, 'driver')} · {plural(groups.length, 'company').replace('companys', 'companies')}
        </span>

        <span className="spacer" />

        <span className={`cmeta ${total && checkedCount === total ? 'done' : ''}`}>
          {checkedCount}/{total} checked
        </span>
        <AssignAll me={me} people={config.responsibles} total={total} allTotal={active.length}
          onAssign={assignAll} onSetup={() => openSettings('people')} />
      </div>

      <div className="board card">
        <div className="brow bhead">
          <span className="bc bidx sticky s0">#</span>
          <span className="bc bcheck sticky s1">
            <SelectAll total={total} done={checkedCount} onCheckAll={checkAll} onClearAll={clearAll} />
          </span>
          <span className="bc bname sticky s2">Driver</span>
          <span className="bc bunit">Unit</span>
          <span className="bc bresp">Responsible</span>
          <span className="bc bdot" title="A DOT scale is ahead on the driver's route">DOT</span>
          <span className="bc bstatus">Status</span>
          <span className="bc bprofile">Profile Form</span>
          <span className="bc bdrive">Drive left</span>
          <span className="bc bcert">Certify</span>
        </div>

        {groups.map((g) => {
          const open = !collapsed[g.company];
          const done = g.list.filter((d) => rows[d.driverId]?.checkedAt).length;
          const all = done === g.list.length;
          return (
            <div className="bgroup" key={g.company}>
              <button className="bgrouphead" aria-expanded={open}
                onClick={() => setCollapsed((c) => ({ ...c, [g.company]: open }))}>
                {/* Jadval kengda siljiganda sarlavha chapda ko'rinib tursin. */}
                <span className="ghinner">
                  <span className={`caret ${open ? 'open' : ''}`} aria-hidden="true">▸</span>
                  <span className="coname">{g.company}</span>
                  <span className={`cocount ${all ? 'done' : ''}`}>
                    {done ? `${done}/${g.list.length}` : g.list.length}
                  </span>
                </span>
              </button>

              {open && g.list.map((d, i) => {
                const r = rows[d.driverId] ?? {};
                return (
                  <div className={`brow ${r.checkedAt ? 'checked' : ''}`} key={d.driverId}>
                    <span className="bc bidx sticky s0">{i + 1}</span>
                    <span className="bc bcheck sticky s1">
                      <RowCheck name={d.driverName} at={r.checkedAt} by={r.checkedBy}
                        onToggle={(shift) => toggleCheck(d.driverId, shift)} />
                    </span>
                    <span className="bc bname sticky s2">
                      <CycleRing min={d.cycleRemainingMin} sugg={suggestionFor(d, r)}
                        onDismiss={() => patch(d.driverId, {
                          suggFixed: cycleSuggestion(d.cycleRemainingMin)?.label ?? '',
                        })} />
                      <span className="ninfo">
                        <DriverName name={d.driverName} driver={d} />
                        {profileChanged(d.profileUpdatedAt) && (
                          <span className="pchg" title={`Profile changed ${ago(d.profileUpdatedAt)}`}>
                            Profile changed
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="bc bunit">
                      {d.truckActive === false && (
                        <span className="unitdot off" title="Truck deactivated" />
                      )}
                      <span className="mono">{d.truck}</span>
                    </span>
                    <span className="bc bresp">
                      <Dropdown value={r.responsible ?? ''} options={config.responsibles}
                        placeholder="—" hint="Set responsible"
                        emptyHint="Add people in Settings →"
                        onEmptyAction={() => openSettings('people')}
                        onChange={(v) => patch(d.driverId, { responsible: v })} />
                    </span>
                    <span className="bc bdot">
                      <DotCell driver={d} />
                    </span>
                    <span className="bc bstatus">
                      <Dropdown value={r.status ?? ''} options={config.statuses}
                        placeholder="—" hint="Set status"
                        emptyHint="Add options in Settings →"
                        onEmptyAction={() => openSettings('columns')}
                        onChange={(v) => patch(d.driverId, { status: v })} />
                    </span>
                    <span className="bc bprofile">
                      <Dropdown value={r.profileForm ?? ''} options={config.profileForms}
                        placeholder="—" hint="Set profile form state"
                        emptyHint="Add options in Settings →"
                        onEmptyAction={() => openSettings('columns')}
                        onChange={(v) => patch(d.driverId, { profileForm: v })} />
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

        {!total && <EmptyBoard board={activeBoard} query={query} onSettings={() => openSettings('boards')}
          onClearSearch={() => setQuery('')} />}
      </div>

      {settings && (
        <BoardSettings config={config} companies={companies} initialTab={settings.tab}
          onSave={saveConfig} onClose={() => setSettings(null)} />
      )}
    </div>
  );
}

/** Board tab'i — soni bilan. */
function BoardTab({ on, count, onClick, children }) {
  return (
    <button role="tab" aria-selected={on} className={`btab ${on ? 'on' : ''}`} onClick={onClick}>
      {children}<span className="btcount">{count}</span>
    </button>
  );
}

/** Jadval bo'sh qolganda — nega bo'shligi va nima qilish kerakligi. */
function EmptyBoard({ board, query, onSettings, onClearSearch }) {
  if (query) {
    return (
      <div className="tierempty">
        No driver matches “{query}”.
        <div className="emptyact"><button className="btn sm" onClick={onClearSearch}>Clear search</button></div>
      </div>
    );
  }
  if (board && !board.companies.length) {
    return (
      <div className="tierempty">
        “{board.name}” has no companies yet.
        <div className="emptyact"><button className="btn sm" onClick={onSettings}>Pick companies</button></div>
      </div>
    );
  }
  return <div className="tierempty">No active drivers right now.</div>;
}

/**
 * Sarlavhadagi umumiy belgi: hech biri / bir qismi / hammasi.
 * Ikkala yo'nalish ham ikki bosishli — bitta tasodifiy bosish bilan yuzlab
 * haydovchi belgilanib yoki belgisi o'chib ketmasligi kerak.
 */
function SelectAll({ total, done, onCheckAll, onClearAll }) {
  const [armed, setArmed] = useState(false);
  const state = !total ? 'none' : done === 0 ? 'none' : done === total ? 'all' : 'some';
  const willCheck = state !== 'all';

  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  // Holat o'zgarsa (boshqa board, qidiruv, boshqa kimdir belgiladi) —
  // tasdiq kutish bekor bo'ladi.
  useEffect(() => { setArmed(false); }, [state, total]);

  const label = !total ? 'Nothing to check'
    : armed ? `Click again to ${willCheck ? `check all ${total}` : `clear all ${done}`}`
    : willCheck ? `Check all ${total} drivers — asks first`
    : `All ${total} checked — click to clear`;

  return (
    <button type="button" role="checkbox" disabled={!total}
      aria-checked={state === 'all' ? 'true' : state === 'some' ? 'mixed' : 'false'}
      className={`chkbox head ${state} ${armed ? 'armed' : ''}`}
      title={label} aria-label={label}
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        return willCheck ? onCheckAll() : onClearAll();
      }}
    >
      {armed ? <Question />
        : state === 'some' ? <span className="chkdash" aria-hidden="true" />
        : <Tick />}
    </button>
  );
}

const Question = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 9a3 3 0 1 1 4 2.8c-.6.3-1 .9-1 1.6v.6" /><path d="M12 17.5v.01" />
  </svg>
);

/**
 * Ommaviy biriktirish. Asosiy qism bitta bosishda o'z ismingizni ekranda
 * ko'rinib turganlarga qo'yadi; yonidagi strelka boshqa mas'ulni tanlash uchun.
 *
 * Filtr faol bo'lsa (board yoki qidiruv tufayli hammasi ko'rinmayotgan bo'lsa)
 * menyuda qamrov tanlagichi chiqadi: faqat ko'rinayotganlar yoki barcha
 * haydovchilar. Filtr yo'q paytda ikkalasi bir xil — tanlagich ham chiqmaydi.
 */
function AssignAll({ me, people, total, allTotal, onAssign, onSetup }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState('shown');
  const wrap = useRef(null);
  const canScope = allTotal > total;
  const count = scope === 'all' ? allTotal : total;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!people.length) {
    return (
      <button className="btn sm" onClick={onSetup}
        title="Add the people who can be responsible, then assign in one click">
        Assign…
      </button>
    );
  }

  const pick = (name) => { setOpen(false); onAssign(name, scope); };
  // Menyu har safar "ko'rinayotganlar" dan boshlanadi — oldingi tanlov
  // esda qolib, kutilmaganda 100 ta haydovchiga yozib yubormasin.
  const toggleMenu = () => setOpen((v) => { if (!v) setScope('shown'); return !v; });

  return (
    <span className="assign" ref={wrap}>
      {me ? (
        <button className="btn sm assignmain" disabled={!total}
          title={`Set Responsible to ${me} for all ${total} drivers shown`}
          onClick={() => onAssign(me)}>
          Assign {me} to all
        </button>
      ) : (
        <button className="btn sm assignmain" disabled={!total}
          title="Pick who to make responsible for every driver shown"
          onClick={toggleMenu}>
          Assign to all
        </button>
      )}
      <button className="btn sm assigncaret" disabled={!total}
        aria-haspopup="menu" aria-expanded={open} aria-label="Assign someone else to all"
        title="Assign someone else" onClick={toggleMenu}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
          strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {open && (
        <div className="ddmenu assignmenu" role="menu">
          {canScope && (
            <div className="segs scopesw" role="group" aria-label="Apply to">
              <button type="button" className={`seg ${scope === 'shown' ? 'on' : ''}`}
                onClick={() => setScope('shown')}>Shown<span className="n">{total}</span></button>
              <button type="button" className={`seg ${scope === 'all' ? 'on' : ''}`}
                onClick={() => setScope('all')}>All drivers<span className="n">{allTotal}</span></button>
            </div>
          )}
          {people.map((r) => (
            <button key={r.label} type="button" role="menuitem" className="ddopt"
              style={{ '--c': `var(--${r.color})` }} onClick={() => pick(r.label)}
              title={`Make ${r.label} responsible for ${count} drivers`}>
              <i /><span className="ddlabel">{r.label}</span>
            </button>
          ))}
          <button type="button" role="menuitem" className="ddopt ddempty" onClick={onSetup}>
            Manage people…
          </button>
        </div>
      )}
    </span>
  );
}

const Tick = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 6" /></svg>
);

/**
 * Qatordagi tekshirildi belgisi — haqiqiy checkbox (probel bilan ham ishlaydi).
 * Belgi qo'lda olinmaguncha turadi, shuning uchun kim va qachon qo'yganini
 * ko'rsatadi.
 */
function RowCheck({ name, at, by, onToggle }) {
  const on = Boolean(at);
  const label = on
    ? `${name} checked${by ? ` by ${by}` : ''} · ${stamp(at)}. Click to undo.`
    : `Mark ${name} as checked`;
  return (
    <label className="chk" title={`${label}\nShift-click to select a range`}>
      {/* Amalni onClick bajaradi — faqat u Shift holatini biladi. Probel
          bosilganda ham brauzer click yuboradi, shuning uchun klaviatura
          ham ishlaydi. */}
      <input type="checkbox" checked={on} readOnly aria-label={label}
        onClick={(e) => onToggle(e.shiftKey)} />
      <span className="chkbox" aria-hidden="true"><Tick /></span>
    </label>
  );
}

/**
 * DOT ustuni. Nuqta bosilsa haydovchining hozirgi joylashuvi Google Maps'da
 * ochiladi. Yo'lida tarozi bo'lsa qizil yonib turadi — o'tib ketgach o'chadi
 * (buni server hisoblaydi, src/dot.js).
 */
function DotCell({ driver }) {
  const { lat, lon, dot, location } = driver;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return <span className="nil" title="The platform does not report a position">—</span>;
  }

  const title = dot
    ? `${dot.km} km to ${dot.name} — ahead on the route.\n${location}\nClick to open in Google Maps.`
    : `${location}\nClick to open in Google Maps.`;

  return (
    <a className={`dotcell ${dot ? 'on' : ''}`} title={title} aria-label={title}
      href={`https://www.google.com/maps?q=${lat},${lon}`}
      target="_blank" rel="noopener noreferrer">
      <span className="dotpin" aria-hidden="true" />
    </a>
  );
}

/** Qolgan haydash vaqti — soat ko'rinishida (clock ikonka + H:MM). */
function TimeLeft({ min }) {
  if (min == null) return <span className="nil">—</span>;
  const t = hhmm(min).replace('h ', ':').replace('m', ''); // "8h 08m" -> "8:08"
  return <span className="timeleft" style={{ '--c': urgency(min) }}><b>{t}</b></span>;
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
    <button className={`btn sm certbtn ${state} ${lit ? 'lit' : ''}`}
      disabled={state === 'doing'} onClick={onClick}>
      {state === 'doing' && <span className="certspin" />}{label}
    </button>
  );
}
