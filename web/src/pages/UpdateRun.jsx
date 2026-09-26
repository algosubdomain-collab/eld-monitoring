import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { COLUMNS } from '../components/cells.jsx';
import FleetTable from '../components/FleetTable.jsx';
import ScanPanel from '../components/ScanPanel.jsx';
import CompanyFilter from '../components/CompanyFilter.jsx';
import { Back, Send } from '../components/Icons.jsx';
import { RUNS, countdown } from '../lib/ops.js';
import { sortRows } from '../lib/table.js';
import { useCompany, byCompany } from '../lib/company.jsx';

/**
 * Davriy update bo'limi (Disconnect / Driving time).
 *
 *   1. Ro'yxat yopiq — skaner paneli sanoqni ko'rsatadi (disconnect uchun
 *      60 daqiqa, driving time uchun 5 daqiqa).
 *   2. Vaqt tugagach ro'yxat ochiladi.
 *   3. "Update sent to all of them" bosilgach haydovchilar 10 soatga
 *      sovish holatiga o'tadi va sanoq qaytadan boshlanadi.
 */
export default function UpdateRun({ data, updates }) {
  const { slug } = useParams();
  const run = RUNS[slug];
  const [sort, setSort] = useState({ key: 'company', dir: 1 });
  // Yuborish bitta bosish bilan ketmasin: bu amal haydovchilarni 10 soatga
  // bloklaydi, shuning uchun tugma avval tasdiq holatiga o'tadi.
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  const { state, sending, send, error } = updates;
  const entry = state?.[slug] ?? { lastRunAt: null, sent: {} };

  const now = Date.now();
  const cooldownMs = (run?.cooldownHours ?? 10) * 3_600_000;
  const nextReleaseAt = entry.lastRunAt
    ? new Date(entry.lastRunAt).getTime() + (run?.releaseMinutes ?? 60) * 60_000
    : 0;
  const released = now >= nextReleaseAt;

  // Oxirgi 10 soat ichida update ketgan haydovchilar ro'yxatdan tushib turadi.
  // Ular alohida ko'rsatilmaydi — shunchaki navbatga qaytmaydi.
  const ready = useMemo(() => {
    if (!run) return [];
    return data.drivers.filter((d) => {
      if (!run.match(d)) return false;
      const sentAt = entry.sent?.[d.driverId];
      return !sentAt || now - new Date(sentAt).getTime() >= cooldownMs;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, run, entry, Math.floor(now / 1000)]);

  // Tanlangan kompaniya bo'yicha: ko'rinadigan ham, yuboriladigan ham shu doira.
  const { value: company } = useCompany();
  const shown = useMemo(() => byCompany(ready, company), [ready, company]);

  if (!run) return <Navigate to="/" replace />;

  const columns = COLUMNS
    .filter((c) => run.columns.includes(c.key))
    .map((c) => ({ ...c, on: true }));

  return (
    <div className="page cat">
      <div className="masthead">
        <Link className="logo back" to="/" title="Back to dashboard"><Back /></Link>
        <h1>{run.title}</h1>
        <span style={{ flex: 1 }} />
        <span className="beat off">
          <i />{released ? 'batch open' : `opens in ${countdown(nextReleaseAt - now)}`}
        </span>
      </div>

      {error && <div className="banner">{error}</div>}

      {released ? (
        <>
          <div className="card cathead readybox reveal" style={{ '--c': run.color }}>
            <div>
              <div className="eyebrow">{run.title}</div>
              <div className="title">
                <span className={`dotmatrix count ${run.tone ?? ''}`}>
                  {String(shown.length).padStart(2, '0')}
                </span>
                <span className="unit">DRIVERS</span>
              </div>
              <div className="sub">{run.blurb}</div>
            </div>

            <div className="panel runbox">
              <div className="big">Batch ready</div>
              <div className="lbl">
                {shown.length
                  ? `${shown.length} driver${shown.length > 1 ? 's' : ''} waiting for an update`
                  : 'Nobody needs an update right now'}
              </div>
              <button
                className={`btn wide ${armed ? 'confirm' : 'lime'}`}
                disabled={!shown.length || sending}
                onClick={() => {
                  if (!armed) return setArmed(true);
                  setArmed(false);
                  send(slug, shown.map((d) => d.driverId));
                }}
              >
                <Send />
                {sending
                  ? 'Sending…'
                  : armed
                    ? `Confirm — send to ${shown.length}`
                    : 'Update sent to all of them'}
              </button>
            </div>
          </div>

          <div className="controls">
            <CompanyFilter drivers={ready} />
          </div>

          <FleetTable
            rows={sortRows(shown, sort)} total={shown.length} columns={columns}
            sort={sort} onSort={(key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }))}
            sourceName={data.source.name}
          />
        </>
      ) : (
        <ScanPanel run={run} msLeft={nextReleaseAt - now} queued={ready.length} />
      )}

    </div>
  );
}
