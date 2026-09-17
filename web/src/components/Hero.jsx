import { Refresh, Truck, Bolt } from './Icons.jsx';
import { ago } from '../lib/format.js';

/**
 * Yuqoridagi asosiy karta: jami haydovchilar, yo'ldagilar ulushi va
 * pastdan chiqib turgan lime tasma.
 */
export default function Hero({ data, onRefresh, busy }) {
  const s = data.summary;
  const moving = s.byStatus.driving;
  const pct = s.total ? Math.round((moving / s.total) * 100) : 0;
  const alerts = s.violationCount;

  return (
    <>
      <div className="card">
        <div className="hero">
          <div>
            <div className="eyebrow">Fleet status</div>
            <div className="title">
              <span className="dotmatrix count">{String(s.total).padStart(2, '0')}</span>
              <span className="unit">DRIVERS</span>
            </div>
            <div className="sub">
              {moving} on the road · {s.byStatus.on_duty} on duty · {s.byStatus.sleeper + s.byStatus.off_duty} resting
            </div>
          </div>

          <div className="panel">
            <div className="row">
              <div>
                <div className="big">{pct}% ACTIVE</div>
                <div className="lbl">Updated {ago(data.fetchedAt)}</div>
              </div>
              <button className="iconbtn" onClick={onRefresh} disabled={busy} title="Refresh">
                <Refresh />
              </button>
            </div>
            <div className={`flag ${alerts ? '' : 'ok'}`}>
              {alerts ? `${alerts} violation${alerts > 1 ? 's' : ''} open` : 'All clear'}
            </div>
          </div>
        </div>

        <div className="rail">
          <div className="fill" style={{ width: `${Math.max(8, pct)}%` }}>
            <Truck />
          </div>
          <span className="cap">{moving}/{s.total}</span>
        </div>
      </div>

      <div className="shelf">
        <Bolt />
        {data.source.live ? `Live feed · ${data.source.name}` : `Demo mode · ${data.source.name}`}
      </div>
    </>
  );
}
