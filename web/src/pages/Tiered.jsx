import { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Back } from '../components/Icons.jsx';
import DriverName from '../components/DriverName.jsx';
import {
  PROFILE_TIERS, CYCLE_TIERS, tierOf, cycleTierOf, daysSince,
} from '../lib/ops.js';
import { STATUS, hhmm, initials, avatarPaint } from '../lib/format.js';

/**
 * Bo'limlarga ajratilgan sahifa. Ikki joyda ishlatiladi:
 *   /ops/profile     — profil formasi qachondan beri o'zgarmagan;
 *   /ops/need-cycle  — cycle'dan qancha qolgan.
 * Farqi faqat shu jadvalda: bo'limlar, ajratish qoidasi va o'ng tomondagi belgi.
 */
const KINDS = {
  profile: {
    title: 'Check profile form',
    tiers: PROFILE_TIERS,
    tierOf,
    badge: (d) => `${Math.floor(daysSince(d.profileUpdatedAt))}d`,
    empty: 'Nobody in this group',
  },
  'need-cycle': {
    title: 'Need cycle',
    tiers: CYCLE_TIERS,
    tierOf: cycleTierOf,
    badge: (d) => hhmm(d.cycleRemainingMin),
    empty: 'Nobody in this group',
  },
};

export default function Tiered({ data, kind }) {
  const params = useParams();
  const key = kind ?? params.slug;
  const view = KINDS[key];

  const groups = useMemo(() => {
    if (!view) return {};
    const byTier = Object.fromEntries(view.tiers.map((t) => [t.key, []]));
    for (const d of data.drivers) {
      const tier = view.tierOf(d);
      if (tier) byTier[tier.key].push(d);
    }
    // Har bir bo'limda eng shoshilinchi tepada tursin.
    for (const [tierKey, list] of Object.entries(byTier)) {
      byTier[tierKey] = list.sort((a, b) =>
        key === 'profile'
          ? daysSince(b.profileUpdatedAt) - daysSince(a.profileUpdatedAt)
          : a.cycleRemainingMin - b.cycleRemainingMin
      );
    }
    return byTier;
  }, [data, view, key]);

  if (!view) return <Navigate to="/" replace />;

  const total = view.tiers.reduce((n, t) => n + groups[t.key].length, 0);

  return (
    <div className="page">
      <div className="masthead">
        <Link className="logo back" to="/" title="Back to dashboard"><Back /></Link>
        <h1>{view.title}</h1>
        <span style={{ flex: 1 }} />
        <span className="beat off"><i />{total} need attention</span>
      </div>

      <div className="tiers">
        {view.tiers.map((tier) => {
          const list = groups[tier.key];
          return (
            <section className="card tier" key={tier.key} style={{ '--c': tier.color }}>
              <header>
                <div>
                  <div className="eyebrow">{tier.title}</div>
                  <div className="sub">{tier.blurb}</div>
                </div>
                <span className={`dotmatrix num ${tier.tone}`}>
                  {String(list.length).padStart(2, '0')}
                </span>
              </header>

              {list.length ? (
                <div className="tierlist">
                  {list.map((d) => (
                    <div className="tierrow" key={d.driverId}>
                      <span className="av" style={{ background: avatarPaint(d.driverName) }}>
                        {initials(d.driverName)}
                      </span>
                      <span className="meta">
                        <DriverName name={d.driverName} />
                        <span className="id">{d.company} · {d.truck}</span>
                      </span>
                      <span style={{ flex: 1 }} />
                      <span className="pill" style={{ '--c': STATUS[d.status]?.color ?? 'var(--slate)' }}>
                        <i />{STATUS[d.status]?.label ?? d.status}
                      </span>
                      <span className="age mono">{view.badge(d)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="tierempty">{view.empty}</div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
