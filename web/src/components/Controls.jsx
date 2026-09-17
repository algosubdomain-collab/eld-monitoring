import { useEffect, useRef, useState } from 'react';
import { Search, Columns, Download, Expand, Collapse } from './Icons.jsx';
import { STATUS } from '../lib/format.js';

export default function Controls({
  query, onQuery, status, onStatus, counts,
  columns, onToggleColumn, auto, onAuto, onExport, focus, onFocus,
}) {
  const [open, setOpen] = useState(false);
  const menu = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!menu.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const tabs = [['all', 'All'], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])];

  return (
    <div className="controls">
      <div className="field">
        <Search />
        <input
          type="search" value={query} placeholder="Search driver, truck or location…"
          onChange={(e) => onQuery(e.target.value)}
        />
      </div>

      <div className="segs">
        {tabs.map(([key, label]) => (
          <button key={key} className={`seg ${status === key ? 'on' : ''}`} onClick={() => onStatus(key)}>
            {label}<span className="n">{counts[key] ?? 0}</span>
          </button>
        ))}
      </div>

      <span style={{ flex: 1 }} />

      <label className="switch">
        <input type="checkbox" checked={auto} onChange={(e) => onAuto(e.target.checked)} />
        Auto-refresh
      </label>

      <button
        className={`btn ${focus ? 'lime' : ''}`}
        onClick={onFocus}
        title={focus ? 'Exit focus mode (Esc)' : 'Focus the driver list'}
      >
        {focus ? <Collapse /> : <Expand />}{focus ? 'Exit focus' : 'Focus'}
      </button>

      <div className="menu" ref={menu}>
        <button className="btn" onClick={() => setOpen((v) => !v)}><Columns />Columns</button>
        {open && (
          <div className="pop">
            {columns.map((c) => (
              <label key={c.key}>
                <input type="checkbox" checked={c.on} onChange={() => onToggleColumn(c.key)} />
                {c.title}
              </label>
            ))}
          </div>
        )}
      </div>

      <button className="btn lime" onClick={onExport}><Download />Export CSV</button>
    </div>
  );
}
