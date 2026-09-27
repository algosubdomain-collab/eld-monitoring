// Har qanday manbadan kelgan ma'lumot shu yagona ko'rinishga keltiriladi.
// Dashboard faqat shu ko'rinish bilan ishlaydi, shuning uchun manbani
// almashtirsak ham dashboard'ni o'zgartirish shart emas.

export const STATUSES = ['driving', 'on_duty', 'sleeper', 'off_duty', 'unknown'];

const STATUS_ALIASES = {
  d: 'driving', drive: 'driving', driving: 'driving',
  on: 'on_duty', onduty: 'on_duty', on_duty: 'on_duty', 'on-duty': 'on_duty',
  sb: 'sleeper', sleeper: 'sleeper', sleeperberth: 'sleeper',
  off: 'off_duty', offduty: 'off_duty', off_duty: 'off_duty', 'off-duty': 'off_duty',
};

export function normalizeStatus(raw) {
  if (!raw) return 'unknown';
  const key = String(raw).trim().toLowerCase().replace(/\s+/g, '');
  return STATUS_ALIASES[key] ?? (STATUSES.includes(key) ? key : 'unknown');
}

/** Soat/daqiqa ko'rinishidagi turli formatlarni daqiqaga aylantiradi. */
export function toMinutes(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Math.round(value);
  const text = String(value).trim();
  const hhmm = text.match(/^(\d+):(\d{1,2})$/);            // "8:30"
  if (hhmm) return Number(hhmm[1]) * 60 + Number(hhmm[2]);
  const hAndM = text.match(/^(\d+)\s*h(?:\s*(\d+)\s*m)?$/i); // "8h 30m"
  if (hAndM) return Number(hAndM[1]) * 60 + Number(hAndM[2] ?? 0);
  const num = Number(text.replace(/[^\d.]/g, ''));
  return Number.isFinite(num) ? Math.round(num) : null;
}

/**
 * Bitta haydovchi yozuvini standart ko'rinishga keltiradi.
 * Manba fayllari har bir yozuv uchun shuni chaqiradi.
 */
export function normalizeDriver(raw = {}) {
  return {
    driverId: String(raw.driverId ?? raw.id ?? ''),
    driverName: raw.driverName ?? raw.name ?? '—',
    truck: raw.truck ?? raw.vehicle ?? raw.unit ?? '—',
    // Kompaniya — API haydovchi bilan birga qaytaradi.
    company: raw.company ?? raw.companyName ?? raw.carrier ?? '—',
    companyId: raw.companyId ?? null,
    // Mashina UUID'i (log havolasi uchun) — truck raqamidan boshqa.
    vehicleId: raw.vehicleId ?? null,
    // Truck faol (active) yoki o'chirilgan (deactivated). Noma'lum → null.
    truckActive: raw.truckActive ?? null,
    status: normalizeStatus(raw.status),
    // Manbaning xom status kodi (masalan DS_SB). "off_duty" ichida DS_PC ham
    // bor — dam olishni aniqlashda ular farqlanishi kerak.
    statusCode: raw.statusCode ?? null,
    // HOS qoldiq vaqtlari (daqiqada)
    driveRemainingMin: toMinutes(raw.driveRemainingMin ?? raw.driveRemaining),
    shiftRemainingMin: toMinutes(raw.shiftRemainingMin ?? raw.shiftRemaining),
    cycleRemainingMin: toMinutes(raw.cycleRemainingMin ?? raw.cycleRemaining),
    breakRemainingMin: toMinutes(raw.breakRemainingMin ?? raw.breakRemaining),
    violations: Array.isArray(raw.violations) ? raw.violations
      : raw.violations ? [String(raw.violations)] : [],
    location: raw.location ?? raw.address ?? '—',
    // Koordinatalar — yaqin-atrofdagi joylarni (masalan DOT tarozilari)
    // aniqlash uchun. Manba bermasa null.
    lat: toCoord(raw.lat ?? raw.latitude),
    lon: toCoord(raw.lon ?? raw.lng ?? raw.longitude),
    // Haydovchi profil formasi oxirgi marta qachon o'zgargan.
    profileUpdatedAt: raw.profileUpdatedAt ? new Date(raw.profileUpdatedAt).toISOString() : null,
    speedMph: raw.speedMph ?? raw.speed ?? null,
    // Haydovchi ilovasi serverga sinxronlanyaptimi (platformadagi "Online status").
    online: raw.online !== false,
    // ELD qurilmasi ulanganmi (platformadagi "ELD status"). Uzilish shu bo'yicha
    // aniqlanadi — ilova online bo'lsa ham ELD uzilgan bo'lishi mumkin.
    eldConnected: raw.eldConnected !== undefined ? raw.eldConnected !== false : raw.online !== false,
    lastUpdate: raw.lastUpdate ? new Date(raw.lastUpdate).toISOString() : null,
  };
}

/** Koordinata — faqat haqiqiy son va mantiqiy oraliqda bo'lsa qabul qilinadi. */
function toCoord(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return null;
  return Math.abs(n) <= 180 ? n : null;
}

/** Cycle qoldig'i shundan kam bo'lsa haydovchi "need cycle" hisoblanadi. */
export const LOW_CYCLE_MIN = 30 * 60;

/** Dashboard tepasidagi umumiy raqamlar. */
export function summarize(drivers) {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  let violationCount = 0;
  let lowHours = 0; // 1 soatdan kam haydash vaqti qolganlar
  let lowCycle = 0; // 70 soatlik cycle'dan 30 soatdan kami qolganlar
  let offline = 0;  // ELD ulanmagan

  for (const d of drivers) {
    byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
    violationCount += d.violations.length;
    if (d.driveRemainingMin != null && d.driveRemainingMin < 60) lowHours += 1;
    if (d.cycleRemainingMin != null && d.cycleRemainingMin < LOW_CYCLE_MIN) lowCycle += 1;
    if (!d.eldConnected) offline += 1;
  }

  return { total: drivers.length, byStatus, violationCount, lowHours, lowCycle, offline };
}
