// Namuna manba — haqiqiy sayt ulanmaguncha dashboard shu bilan ishlaydi.
// URL/token berilgach o'rniga leadereld manbasi qo'yiladi, dashboard o'zgarmaydi.
//
// Ma'lumot urug'langan (seeded) generator bilan yaratiladi: har yangilanishda
// bir xil park chiqadi, aks holda raqamlar sakrab, dashboard buzuqdek ko'rinardi.
import { normalizeDriver } from '../normalize.js';

const FLEET_SIZE = Number(process.env.ELD_SAMPLE_SIZE ?? 100);

export const meta = { name: 'Sample data', live: false, requiresToken: false };

/** mulberry32 — kichik, barqaror psevdo-tasodifiy generator. */
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = [
  'Akmal', 'Sardor', 'Jasur', 'Bekzod', 'Nodir', 'Aziz', 'Shoxrux', 'Ulugbek', 'Rustam', 'Doniyor',
  'Otabek', 'Sanjar', 'Farrux', 'Dilshod', 'Islom', 'Timur', 'Kamol', 'Javohir', 'Bobur', 'Umid',
  'Marcus', 'Dwayne', 'Cody', 'Tyler', 'Brandon', 'Jesse', 'Curtis', 'Wayne', 'Roger', 'Dustin',
  'Miguel', 'Carlos', 'Rafael', 'Hector', 'Ernesto', 'Ivan', 'Sergei', 'Andrei', 'Pavel', 'Mikhail',
];
const LAST = [
  'Yusupov', 'Qodirov', 'Rahimov', 'Alimov', 'Ismoilov', 'Tursunov', 'Karimov', 'Nazarov', 'Sultonov',
  'Ergashev', 'Xolmatov', 'Yuldashev', 'Saidov', 'Mirzayev', 'Toshpulatov', 'Abdullayev', 'Sharipov',
  'Brooks', 'Hayes', 'Callahan', 'Whitfield', 'Sanders', 'Dalton', 'Reyes', 'Morales', 'Vargas',
  'Petrov', 'Kozlov', 'Novak', 'Sokolov', 'Baranov',
];

// Haqiqiy API kompaniyani haydovchi bilan birga qaytaradi — namunada ham shunday.
const COMPANIES = [
  'Silk Road Logistics', 'Falcon Freight', 'Northline Carriers', 'Aral Transport',
  'Redstone Trucking', 'Bluebird Express', 'Samarkand Haulage', 'Ironwood Fleet',
];

const PLACES = [
  'I-80, Elko, NV', 'I-15, Barstow, CA', 'I-10, Tucson, AZ', 'I-40, Amarillo, TX',
  'I-70, Grand Junction, CO', 'I-94, Fargo, ND', 'I-5, Redding, CA', 'I-90, Billings, MT',
  'I-35, Wichita, KS', 'I-75, Chattanooga, TN', 'I-65, Bowling Green, KY', 'I-44, Joplin, MO',
  'I-84, Twin Falls, ID', 'I-25, Pueblo, CO', 'I-95, Fayetteville, NC', 'I-20, Odessa, TX',
  'TA Truck Stop, Ogden, UT', 'Loves #412, Sidney, NE', 'Pilot #219, Effingham, IL',
  'Phoenix, AZ — Yard', 'Reno, NV — Shipper', 'Denver, CO — Receiver', 'Dallas, TX — Shipper',
  'Atlanta, GA — Receiver', 'Chicago, IL — Yard', 'Salt Lake City, UT — Terminal',
  'Portland, OR — Receiver', 'Memphis, TN — Shipper', 'Columbus, OH — Yard', 'Laredo, TX — Border',
];

// Haqiqiy parkka yaqin taqsimot.
const MIX = [
  ...Array(38).fill('driving'),
  ...Array(19).fill('on_duty'),
  ...Array(15).fill('sleeper'),
  ...Array(24).fill('off_duty'),
  ...Array(4).fill('unknown'),
];

const VIOLATIONS = [
  '30-min break overdue',
  '11-hour driving limit near',
  '14-hour shift limit exceeded',
  'Missing DVIR',
  'Unassigned driving time',
  'Form & manner error',
  '70-hour cycle limit near',
];

const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const between = (r, lo, hi) => Math.round(lo + r() * (hi - lo));

/** Statusga mos HOS qoldiqlari — dam olgan haydovchida soat to'la bo'ladi. */
function hosFor(r, status) {
  if (status === 'unknown') return { drive: null, shift: null, cycle: null };

  if (status === 'off_duty' || status === 'sleeper') {
    // Uzoq dam olgan bo'lsa soatlar tiklangan; qisqa to'xtash bo'lsa — qisman.
    const reset = r() > 0.35;
    return {
      drive: reset ? 660 : between(r, 240, 640),
      shift: reset ? 840 : between(r, 300, 820),
      cycle: between(r, 600, 4200),
    };
  }

  // Yo'ldagi yoki ish vaqtidagi haydovchi — smena qisman sarflangan.
  // Yo'ldagilarning ~10 foizi haydash limitiga yaqinlashgan bo'lsin —
  // aks holda "Driving time update" bo'limi hech qachon bo'sh chiqadi.
  const nearLimit = status === 'driving' && r() > 0.86;
  const drive = nearLimit ? between(r, 4, 29) : between(r, 35, 640);
  return {
    drive,
    shift: Math.min(840, drive + between(r, 40, 220)),
    cycle: between(r, 180, 4200),
  };
}

function makeDriver(i) {
  const r = rng(i * 2654435761 + 12345);
  const status = MIX[i % MIX.length];
  const hos = hosFor(r, status);

  const violations = [];
  if (status === 'unknown') {
    violations.push('ELD connection lost');
  } else {
    if (hos.drive != null && hos.drive < 45) violations.push('11-hour driving limit near');
    if (hos.shift != null && hos.shift < 40) violations.push('14-hour shift limit exceeded');
    if (r() > 0.88) violations.push(pick(r, VIOLATIONS));
  }

  const moving = status === 'driving';
  const company = pick(r, COMPANIES);

  return normalizeDriver({
    driverId: `D-${String(101 + i).padStart(3, '0')}`,
    driverName: `${pick(r, FIRST)} ${pick(r, LAST)}`,
    truck: String(between(r, 1000, 9999)),
    company: company,
    // Haqiqiy manbalar kabi barqaror companyId — kompaniya filtri va
    // board'lar shu id bo'yicha ishlaydi.
    companyId: `C-${COMPANIES.indexOf(company) + 1}`,
    status,
    driveRemainingMin: hos.drive,
    shiftRemainingMin: hos.shift,
    cycleRemainingMin: hos.cycle,
    violations: [...new Set(violations)],
    location: status === 'unknown' ? 'No signal' : pick(r, PLACES),
    // Namuna koordinatalar — AQSh o'rtasidagi kenglik/uzunlik oralig'i.
    lat: 32 + r() * 12,
    lon: -118 + r() * 40,
    speedMph: status === 'unknown' ? null : moving ? between(r, 48, 70) : 0,
    online: status !== 'unknown' && r() > 0.12,
    // Signal vaqti hozirgi vaqtga nisbatan — dashboard "jonli" ko'rinsin.
    lastUpdate: Date.now() - between(r, 5, status === 'unknown' ? 5400 : 900) * 1000,
    // Profil formasi qachon oxirgi marta yangilangan — 0..9 kun oralig'ida.
    // Ko'pchilik yangi, ozchilik esa uzoq vaqt tegilmagan.
    profileUpdatedAt: Date.now() - Math.round(between(r, 0, 9 * 24 * 60) * (r() > 0.55 ? 1 : 0.35)) * 60_000,
  });
}

export async function fetchDrivers() {
  return Array.from({ length: FLEET_SIZE }, (_, i) => makeDriver(i));
}
