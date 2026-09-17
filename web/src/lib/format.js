export const STATUS = {
  driving:  { label: 'Driving',  color: 'var(--lime)' },
  on_duty:  { label: 'On duty',  color: 'var(--amber)' },
  sleeper:  { label: 'Sleeper',  color: 'var(--violet)' },
  off_duty: { label: 'Off duty', color: 'var(--slate)' },
  unknown:  { label: 'Unknown',  color: 'var(--red)' },
};

/** HOS limitlari (daqiqada) — progress barlar shu asosda chiziladi. */
export const LIMITS = { drive: 660, shift: 840, cycle: 4200 };

export function hhmm(min) {
  if (min == null) return null;
  return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
}

export function ago(iso) {
  if (!iso) return '—';
  const s = Math.round((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export const initials = (n) =>
  String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();

/** Ismdan barqaror rang — har safar bir xil chiqadi. */
export function avatarPaint(name) {
  let h = 0;
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `linear-gradient(140deg, hsl(${h} 78% 62%), hsl(${(h + 42) % 360} 76% 50%))`;
}

/** Qolgan vaqtga qarab rang: kam qolsa — qizil. */
export const urgency = (min) =>
  min == null ? 'var(--ink-3)' : min < 60 ? 'var(--red)' : min < 180 ? 'var(--amber)' : 'var(--lime)';
