import { Link } from 'react-router-dom';
import { CATEGORIES } from '../lib/categories.js';

/** KPI widgetlari — bosilganda o'z kategoriyasi sahifasini ochadi. */
export default function Stats({ summary }) {
  return (
    <div className="stats">
      {CATEGORIES.map((c) => (
        <Link className="stat" key={c.slug} to={`/c/${c.slug}`} aria-label={`${c.title} — open list`}>
          <span className="tick" style={{ background: c.color, boxShadow: `0 0 10px ${c.color}` }} />
          <div className="k">{c.title}</div>
          <div className={`dotmatrix v ${c.tone ?? ''}`}>
            {String(c.count(summary)).padStart(2, '0')}
          </div>
          {c.sub && <div className="s">{c.sub(summary)}</div>}
          <span className="go" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
          </span>
        </Link>
      ))}
    </div>
  );
}
