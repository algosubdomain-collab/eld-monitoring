import { Link } from 'react-router-dom';
import { Form, Plug, Gauge, Cycle } from './Icons.jsx';
import { RUNS, PROFILE_TIERS, CYCLE_TIERS, tierOf, cycleTierOf, countdown } from '../lib/ops.js';

/**
 * Dashboard'dagi "operatsiyalar" qatori — filtrlangan ro'yxat emas,
 * balki amal talab qiladigan uchta bo'lim.
 */
export default function Ops({ drivers, updates }) {
  const profileCount = drivers.filter((d) => tierOf(d)).length;
  const worst = PROFILE_TIERS.slice().reverse()
    .find((t) => drivers.some((d) => tierOf(d)?.key === t.key));

  const cycleCount = drivers.filter((d) => cycleTierOf(d)).length;
  const urgent = drivers.filter((d) => cycleTierOf(d)?.key === CYCLE_TIERS[0].key).length;

  const cards = [
    {
      to: '/ops/need-cycle',
      icon: <Cycle />,
      title: 'Need cycle',
      count: cycleCount,
      color: urgent ? 'var(--red)' : 'var(--amber)',
      note: urgent ? `${urgent} under 25h left` : 'nothing urgent',
    },
    {
      to: '/ops/profile',
      icon: <Form />,
      title: 'Check profile form',
      count: profileCount,
      color: worst?.color ?? 'var(--slate)',
      note: worst ? `worst group: ${worst.title.toLowerCase()}` : 'all forms are fresh',
    },
    ...Object.values(RUNS).map((run) => {
      const entry = updates?.[run.slug] ?? { lastRunAt: null, sent: {} };
      const cooldownMs = run.cooldownHours * 3_600_000;
      const now = Date.now();

      const ready = drivers.filter((d) => {
        if (!run.match(d)) return false;
        const sentAt = entry.sent?.[d.driverId];
        return !sentAt || now - new Date(sentAt).getTime() >= cooldownMs;
      }).length;

      const nextAt = entry.lastRunAt
        ? new Date(entry.lastRunAt).getTime() + run.releaseMinutes * 60_000
        : 0;

      return {
        to: `/ops/${run.slug}`,
        icon: run.slug === 'disconnect' ? <Plug /> : <Gauge />,
        title: run.title,
        count: ready,
        color: run.color,
        note: now >= nextAt ? 'batch ready to send' : `opens in ${countdown(nextAt - now)}`,
      };
    }),
  ];

  return (
    <div className="ops">
      {cards.map((c) => (
        <Link className="op" key={c.to} to={c.to} style={{ '--c': c.color }}>
          <span className="ic">{c.icon}</span>
          <span className="txt">
            <span className="t">{c.title}</span>
            <span className="n">{c.note}</span>
          </span>
          <span className="dotmatrix cnt">{String(c.count).padStart(2, '0')}</span>
        </Link>
      ))}
    </div>
  );
}
