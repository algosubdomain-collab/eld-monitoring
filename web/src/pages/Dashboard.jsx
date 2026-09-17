import { useEffect, useMemo, useState } from 'react';
import { COLUMNS } from '../components/cells.jsx';
import Masthead from '../components/Masthead.jsx';
import ProviderSwitcher from '../components/ProviderSwitcher.jsx';
import AccountBar from '../components/AccountBar.jsx';
import Hero from '../components/Hero.jsx';
import Stats from '../components/Stats.jsx';
import Ops from '../components/Ops.jsx';
import Controls from '../components/Controls.jsx';
import FleetTable from '../components/FleetTable.jsx';
import { filterRows, sortRows, toCsv } from '../lib/table.js';

export default function Dashboard({
  data, error, busy, reload, auto, setAuto, updates,
  providerBar, onConnections, onSignOut, user,
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState({ key: 'driverName', dir: 1 });
  const [columns, setColumns] = useState(COLUMNS);
  // Focus rejimi: faqat haydovchilar ro'yxati ko'rinadi.
  const [focus, setFocus] = useState(false);

  const toggleFocus = () => setFocus((on) => {
    if (!on) window.scrollTo({ top: 0, behavior: 'smooth' });
    return !on;
  });

  useEffect(() => {
    if (!focus) return;
    const onKey = (e) => { if (e.key === 'Escape') setFocus(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus]);

  const rows = useMemo(
    () => sortRows(filterRows(data.drivers, { query, status }), sort),
    [data, query, status, sort]
  );

  const counts = useMemo(() => {
    const c = { all: data.drivers.length };
    for (const d of data.drivers) c[d.status] = (c[d.status] ?? 0) + 1;
    return c;
  }, [data]);

  return (
    <div className={`page ${focus ? 'focused' : ''}`}>
      {error && <div className="banner"><strong>Source error:</strong>&nbsp;{error} — showing last known data.</div>}

      {data.incomplete && (
        <div className="banner warn">
          <strong>Partial data:</strong>&nbsp;
          {data.incomplete.failedCompanies} of {data.incomplete.totalCompanies} companies
          could not be loaded, so some drivers are missing — press Refresh to try again.
        </div>
      )}

      {data.restricted && (
        <div className="banner note">
          <strong>{data.restricted.count} of {data.restricted.totalCompanies} companies
          are hidden</strong>&nbsp;— this account does not have access to them
          ({data.restricted.names.join(', ')}
          {data.restricted.count > data.restricted.names.length ? ' and others' : ''}).
          Everything else is shown.
        </div>
      )}

      <div className={`stack ${focus ? 'collapsed' : ''}`} aria-hidden={focus}>
        <div>
          <Masthead live={data.source.live} sourceName={data.source.name} />
          <AccountBar {...{ user, onConnections, onSignOut }} />
          <ProviderSwitcher {...providerBar} />
          <Hero data={data} onRefresh={reload} busy={busy} />
          <Stats summary={data.summary} />
          <Ops drivers={data.drivers} updates={updates} />
        </div>
      </div>

      <Controls
        query={query} onQuery={setQuery}
        status={status} onStatus={setStatus} counts={counts}
        columns={columns} onToggleColumn={(key) =>
          setColumns((cols) => cols.map((c) => (c.key === key ? { ...c, on: !c.on } : c)))}
        auto={auto} onAuto={setAuto}
        onExport={() => toCsv(rows, columns, 'eld-fleet')}
        focus={focus} onFocus={toggleFocus}
      />

      <FleetTable
        rows={rows} total={data.drivers.length} columns={columns}
        sort={sort} onSort={(key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }))}
        sourceName={data.source.name}
      />

      <div className="connbar">
        <span className="who">
          Signed in as <b>{user?.login}</b>
          <span className="dim"> · {data.source.name} · {data.drivers.length} drivers</span>
        </span>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={onConnections}>Connections</button>
        <button className="btn" onClick={onSignOut}>Sign out</button>
      </div>
    </div>
  );
}
