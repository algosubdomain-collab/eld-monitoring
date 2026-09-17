/** Kun hisobida yosh — profil formasi qachondan beri tegilmagan. */
export function daysSince(iso) {
  if (!iso) return null;
  return (Date.now() - new Date(iso)) / 86_400_000;
}

/**
 * "Check profile form" sahifasining uch bo'limi.
 * Chegara: 3 kun — eslatma, 4 kundan oshsa — chuqur tekshirish,
 * 5 kundan oshsa — haydovchiga qo'ng'iroq.
 */
export const PROFILE_TIERS = [
  {
    key: 'send-update',
    title: 'Send update',
    blurb: 'Form untouched for 3 days — send a reminder',
    color: 'var(--lime)',
    tone: 'lime',
    min: 3,
    max: 4,
  },
  {
    key: 'check-deeply',
    title: 'Check deeply',
    blurb: 'More than 4 days — review the driver record',
    color: 'var(--amber)',
    tone: 'amber',
    min: 4,
    max: 5,
  },
  {
    key: 'call-driver',
    title: 'Call to driver',
    blurb: 'More than 5 days — call the driver directly',
    color: 'var(--red)',
    tone: 'red',
    min: 5,
    max: Infinity,
  },
];

export const tierOf = (driver) => {
  const age = daysSince(driver.profileUpdatedAt);
  if (age == null) return null;
  return PROFILE_TIERS.find((t) => age >= t.min && age < t.max) ?? null;
};

/**
 * "Need cycle" sahifasining ikki bo'limi — 70 soatlik cycle'dan
 * qancha qolganiga qarab.
 */
export const CYCLE_TIERS = [
  {
    key: 'open-fastly',
    title: 'Open fastly',
    blurb: 'Under 25 hours left — schedule the reset now',
    color: 'var(--red)',
    tone: 'red',
    min: 0,
    max: 25,
  },
  {
    key: 'open',
    title: 'Open',
    blurb: 'Between 25 and 30 hours left — plan the reset',
    color: 'var(--amber)',
    tone: 'amber',
    min: 25,
    max: 30,
  },
];

export const cycleTierOf = (driver) => {
  if (driver.cycleRemainingMin == null) return null;
  const hours = driver.cycleRemainingMin / 60;
  return CYCLE_TIERS.find((t) => hours >= t.min && hours < t.max) ?? null;
};

/**
 * Davriy update bo'limlari.
 *   releaseMinutes — yuborilgandan keyin keyingi ro'yxat necha daqiqada ochiladi;
 *   cooldownHours  — bitta haydovchiga qayta update yuborilgunga qadar kutish.
 * Serverdagi SECTIONS bilan mos bo'lishi kerak (src/updates.js).
 */
export const RUNS = {
  disconnect: {
    slug: 'disconnect',
    title: 'Disconnect update',
    blurb: 'Drivers whose ELD has lost connection',
    color: 'var(--red)',
    tone: 'red',
    releaseMinutes: 60,
    cooldownHours: 10,
    match: (d) => d.eldConnected === false,
    columns: ['driverName', 'truck', 'status', 'location', 'lastUpdate'],
  },
  'driving-time': {
    slug: 'driving-time',
    title: 'Driving time update',
    blurb: 'Driving right now with under 30 minutes left',
    color: 'var(--amber)',
    tone: 'amber',
    releaseMinutes: 5,
    cooldownHours: 10,
    match: (d) =>
      d.status === 'driving' && d.driveRemainingMin != null && d.driveRemainingMin < 30,
    columns: ['driverName', 'truck', 'status', 'driveRemainingMin', 'shiftRemainingMin',
              'location', 'lastUpdate'],
  },
};

/** Sanoq uchun: qolgan millisekundni "59:04" ko'rinishiga aylantiradi. */
export function countdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 60) {
    return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}
