import { STATUS, LIMITS, hhmm, ago, initials, avatarPaint, urgency } from '../lib/format.js';
import DriverName from './DriverName.jsx';

export const Driver = ({ d }) => (
  <div className="who">
    <span className="av" style={{ background: avatarPaint(d.driverName) }}>{initials(d.driverName)}</span>
    <span>
      <DriverName name={d.driverName} />
      <div className="id mono">{d.driverId || '—'}</div>
    </span>
  </div>
);

export const StatusPill = ({ status }) => {
  const meta = STATUS[status] ?? { label: status, color: 'var(--slate)' };
  return <span className="pill" style={{ '--c': meta.color }}><i />{meta.label}</span>;
};

export const Hours = ({ min, max }) => {
  if (min == null) return <span className="nil">—</span>;
  const color = urgency(min);
  return (
    <div className="hrs">
      <span className="t mono" style={{ color: min < 60 ? color : 'var(--ink)' }}>{hhmm(min)}</span>
      <div className="bar">
        <i style={{ width: `${Math.max(2, Math.min(100, (min / max) * 100))}%`,
                    background: color, boxShadow: `0 0 10px ${color}` }} />
      </div>
    </div>
  );
};

export const Violations = ({ list }) =>
  list.length ? (
    <div className="tags">
      {list.map((v, i) => <span className="tag" key={i}>{v}</span>)}
    </div>
  ) : <span className="nil">—</span>;

/** Ustunlar ro'yxati — jadvalni shu yerdan o'zgartirasiz. */
export const COLUMNS = [
  { key: 'driverName', title: 'Driver', on: true, cell: (d) => <Driver d={d} /> },
  { key: 'company', title: 'Company', on: true, cell: (d) => d.company },
  { key: 'truck', title: 'Truck', on: true, cell: (d) => <span className="mono">{d.truck}</span> },
  { key: 'status', title: 'Status', on: true, cell: (d) => <StatusPill status={d.status} /> },
  { key: 'driveRemainingMin', title: 'Drive left', on: true, cell: (d) => <Hours min={d.driveRemainingMin} max={LIMITS.drive} /> },
  { key: 'shiftRemainingMin', title: 'Shift left', on: true, cell: (d) => <Hours min={d.shiftRemainingMin} max={LIMITS.shift} /> },
  { key: 'cycleRemainingMin', title: 'Cycle left', on: true, cell: (d) => <Hours min={d.cycleRemainingMin} max={LIMITS.cycle} /> },
  { key: 'violations', title: 'Violations', on: true, cell: (d) => <Violations list={d.violations} /> },
  { key: 'location', title: 'Location', on: true, cell: (d) => d.location },
  { key: 'speedMph', title: 'Speed', on: false,
    cell: (d) => d.speedMph == null ? <span className="nil">—</span>
      : <span><span className="mono">{d.speedMph}</span> <span className="nil">mph</span></span> },
  { key: 'lastUpdate', title: 'Last signal', on: true, cell: (d) => <span className="nil">{ago(d.lastUpdate)}</span> },
];
