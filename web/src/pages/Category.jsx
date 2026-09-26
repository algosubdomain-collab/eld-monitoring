import { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { COLUMNS } from '../components/cells.jsx';
import FleetTable from '../components/FleetTable.jsx';
import { Back } from '../components/Icons.jsx';
import { findCategory } from '../lib/categories.js';
import { sortRows } from '../lib/table.js';
import { STATUS } from '../lib/format.js';
import CompanyFilter from '../components/CompanyFilter.jsx';
import { useCompany, byCompany } from '../lib/company.jsx';

/**
 * Kategoriya sahifasi: tepada qisqa ma'lumot, pastda butun sahifani
 * egallaydigan haydovchilar ro'yxati. Boshqa boshqaruv elementlari yo'q.
 */
export default function Category({ data }) {
  const { slug } = useParams();
  const cat = findCategory(slug);
  const [sort, setSort] = useState({ key: 'company', dir: 1 });

  const { value: company } = useCompany();
  const all = useMemo(
    () => (cat ? byCompany(data.drivers.filter(cat.match), company) : []),
    [data, cat, company]
  );
  const rows = useMemo(() => sortRows(all, sort), [all, sort]);

  // Noma'lum manzil — bosh sahifaga qaytaramiz.
  if (!cat) return <Navigate to="/" replace />;

  const breakdown = Object.entries(
    all.reduce((acc, d) => ({ ...acc, [d.status]: (acc[d.status] ?? 0) + 1 }), {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="page cat">
      <div className="masthead">
        <Link className="logo back" to="/" title="Back to dashboard"><Back /></Link>
        <h1>{cat.title}</h1>
      </div>

      <div className="card cathead" style={{ '--c': cat.color }}>
        <div>
          <div className="eyebrow">{cat.title}</div>
          <div className="title">
            <span className={`dotmatrix count ${cat.tone ?? ''}`}>
              {String(all.length).padStart(2, '0')}
            </span>
            <span className="unit">DRIVERS</span>
          </div>
          <div className="sub">{cat.note ? cat.note(all) : cat.blurb}</div>
        </div>

        <div className="chips">
          {breakdown.map(([key, n]) => (
            <span className="pill" key={key} style={{ '--c': STATUS[key]?.color ?? 'var(--slate)' }}>
              <i />{STATUS[key]?.label ?? key}<b>{n}</b>
            </span>
          ))}
        </div>
      </div>

      <div className="controls">
        <CompanyFilter drivers={data.drivers.filter(cat.match)} />
      </div>

      <FleetTable
        rows={rows} total={all.length} columns={COLUMNS}
        sort={sort} onSort={(key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }))}
        sourceName={data.source.name}
      />
    </div>
  );
}
