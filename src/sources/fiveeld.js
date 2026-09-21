// Haqiqiy manba: Five ELD platformasi (api.fiveeld.com).
//
// Leader/Factor ELD (DriveHOS) dan butunlay boshqa API:
//   • token "Authorization" sarlavhasida xom holda ketadi (Bearer emas);
//   • kompaniya har so'rovda "companyuid" sarlavhasi bilan tanlanadi;
//   • ma'lumot ikki bosqichda yig'iladi:
//       1) dashboards/v3/getcompanies — akkauntga tegishli kompaniyalar;
//       2) logs/v3/logslist          — har bir kompaniya uchun haydovchilar,
//          HOS soatlari, ogohlantirishlar va ELD ulanish holati bilan.
//
// Token brauzerdan keladi (localStorage "token") va faqat data/connections.json
// da saqlanadi.
import { normalizeDriver } from '../normalize.js';

const BASE = process.env.FIVE_BASE_URL ?? 'https://api.fiveeld.com/api';

// Kompaniyalar ro'yxati kam o'zgaradi.
const COMPANY_TTL_MS = Number(process.env.FIVE_COMPANY_TTL_MIN ?? 10) * 60_000;
const CONCURRENCY = Number(process.env.FIVE_CONCURRENCY ?? 3);
const MAX_RETRIES = Number(process.env.FIVE_MAX_RETRIES ?? 6);
const MAX_BACKOFF_MS = 5000;
const PAGE_SIZE = 100;
// Javobsiz qolgan so'rov butun yangilanishni ushlab turmasin.
const REQUEST_TIMEOUT_MS = Number(process.env.FIVE_REQUEST_TIMEOUT_SEC ?? 30) * 1000;

export const meta = { name: 'Five ELD', live: true, requiresToken: true };

export class AccessError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AccessError';
    this.noAccess = true;
  }
}

export class TokenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TokenError';
    this.tokenInvalid = true;
  }
}

/**
 * Platforma duty statuslari -> DriveHOS kodlari.
 * Bitta kodga keltiramiz, chunki dam oluvchilarni aniqlash (src/resting.js)
 * shu kodlar bilan ishlaydi va u manbadan qat'i nazar bir xil bo'lishi kerak.
 */
const STATUS_CODES = {
  driving: 'DS_D',
  on: 'DS_ON',
  sleep: 'DS_SB',
  off: 'DS_OFF',
  pc: 'DS_PC',
  ym: 'DS_YM',
};

const STATUS_MAP = {
  DS_D: 'driving',
  DS_ON: 'on_duty',
  DS_SB: 'sleeper',
  DS_OFF: 'off_duty',
  DS_PC: 'off_duty', // personal conveyance
  DS_YM: 'on_duty',  // yard move
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Platforma kunni UTC yarim tunidan 11 soat keyin boshlaydi (frontend ham shunday). */
function logDate(at = new Date()) {
  const day = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  day.setUTCHours(11);
  return day.toISOString();
}

/** API chaqiruvi. 429/5xx da kutib qayta urinadi. */
async function api(path, ctx, companyUid, attempt = 0) {
  let res;
  try {
    res = await fetch(BASE + path, {
      headers: {
        Accept: 'application/json',
        Authorization: ctx.token,
        ...(companyUid ? { companyuid: companyUid } : {}),
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await sleep(Math.min(400 * 2 ** attempt, MAX_BACKOFF_MS) + Math.random() * 400);
      return api(path, ctx, companyUid, attempt + 1);
    }
    throw new Error(`${path} — ${err.name === 'TimeoutError' ? 'javob kelmadi (timeout)' : err.message}`);
  }

  if (res.status === 401) {
    throw new TokenError('The token was rejected — paste a fresh one');
  }

  const body = await res.json().catch(() => null);
  const message = body?.error?.message ?? res.statusText;

  if (res.status === 403 || /access|permission/i.test(message)) {
    throw new AccessError(message);
  }

  if (!res.ok) {
    // Kvota yoki server xatosi — kutib qayta urinamiz.
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      await sleep(Math.min(400 * 2 ** attempt, MAX_BACKOFF_MS) + Math.random() * 400);
      return api(path, ctx, companyUid, attempt + 1);
    }
    throw new Error(`${res.status} ${path} — ${message}`);
  }
  return body;
}

// Kesh provayder akkaunti (token) bo'yicha — har akkaunt o'z kompaniyalarini ko'radi.
const companyCaches = new Map();

async function getCompanies(ctx) {
  const cached = companyCaches.get(ctx.token);
  if (cached && Date.now() - cached.at < COMPANY_TTL_MS) return cached.list;

  const body = await api('/dashboards/v3/getcompanies', ctx, null);
  const list = (body?.companies ?? [])
    .filter((c) => c.is_active !== false && c.uid)
    .map((c) => ({ id: c.uid, name: c.name?.trim() || '—' }));

  companyCaches.set(ctx.token, { at: Date.now(), list });
  return list;
}

/** Vazifalarni cheklangan sonli oqimda bajaradi. */
async function pool(items, limit, worker) {
  const out = [];
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const index = i++;
      out[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return out;
}

/** Bitta kompaniyaning barcha haydovchilari (sahifalab). */
async function companyRows(ctx, companyUid) {
  const date = encodeURIComponent(logDate());
  const first = await api(
    `/logs/v3/logslist?page=1&perPage=${PAGE_SIZE}&date=${date}`, ctx, companyUid
  );
  const rows = [...(first?.data ?? [])];
  const total = Number(first?.total ?? rows.length);

  for (let page = 2; (page - 1) * PAGE_SIZE < total; page += 1) {
    const next = await api(
      `/logs/v3/logslist?page=${page}&perPage=${PAGE_SIZE}&date=${date}`, ctx, companyUid
    );
    rows.push(...(next?.data ?? []));
  }
  return rows;
}

/** Ogohlantirishlar va buzilishlar matn ko'rinishida. */
function toTexts(row) {
  const out = [];
  for (const v of row.violations ?? []) {
    out.push(typeof v === 'string' ? v : v.value ?? v.message ?? v.type ?? v.key ?? JSON.stringify(v));
  }
  for (const w of row.warnings ?? []) {
    out.push(typeof w === 'string' ? w : w.value ?? w.key ?? JSON.stringify(w));
  }
  return out.filter(Boolean);
}

const toMin = (v) => {
  const n = Number(v);
  // "-1" — ma'lumot yo'q degani.
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

function makeContext({ token }) {
  const key = token || process.env.FIVE_ACCESS_TOKEN;
  if (!key) throw new TokenError('No access token provided');
  return { token: key };
}

function toDriver(row, company) {
  const statusCode = STATUS_CODES[row.status?.status] ?? null;
  const name = [row.driver?.first_name, row.driver?.second_name]
    .map((p) => String(p ?? '').trim()).filter(Boolean).join(' ');

  return normalizeDriver({
    driverId: row.driverUid ?? row.driver?.uid ?? '',
    driverName: name || '—',
    company: company.name,
    // Skrinshot uchun ham kerak: platforma sahifasi manzilida kompaniya uid turadi.
    companyId: company.id,
    truck: row.vehicle?.truck_number || '—',
    status: statusCode ? STATUS_MAP[statusCode] : 'unknown',
    statusCode,
    // Platforma qoldiq vaqtlarni daqiqada beradi.
    driveRemainingMin: toMin(row.timers?.driving),
    shiftRemainingMin: toMin(row.timers?.shift),
    cycleRemainingMin: toMin(row.timers?.cycle),
    breakRemainingMin: toMin(row.timers?.break),
    violations: toTexts(row),
    location: row.tracking?.address || row.status?.address || '—',
    speedMph: row.tracking?.speed ?? null,
    lastUpdate: row.tracking?.date || row.timers?.date || null,
    online: row.isOnline !== false,
    eldConnected: row.tracking?.eld_connection === true,
    // Platforma profil o'zgarish vaqtini bermaydi.
    profileUpdatedAt: null,
  });
}

/**
 * Har bir haydovchining joriy statusi va u qachon boshlangani —
 * dam oluvchilarni aniqlash uchun (src/resting.js).
 * Bu manba statusning boshlanish vaqtini asosiy ro'yxat bilan birga beradi,
 * shuning uchun qo'shimcha so'rov haydovchi boshiga emas, kompaniya boshiga.
 */
export async function fetchLatestStatuses({ drivers, ...auth }) {
  const ctx = makeContext(auth);
  const out = new Map();
  let failed = 0;

  // Faqat kerakli haydovchilar turgan kompaniyalar so'raladi.
  const wanted = new Set(drivers.map((d) => d.driverId));
  const companyUids = [...new Set(drivers.map((d) => d.companyId).filter(Boolean))];

  await pool(companyUids, CONCURRENCY, async (companyUid) => {
    try {
      for (const row of await companyRows(ctx, companyUid)) {
        const id = row.driverUid ?? row.driver?.uid;
        const code = STATUS_CODES[row.status?.status];
        if (!id || !code || !wanted.has(id)) continue;
        out.set(id, { code, since: row.status?.start_date || null });
      }
    } catch (err) {
      if (err instanceof TokenError) throw err;
      failed += 1;
    }
  });

  return { statuses: out, failed };
}

export async function fetchDrivers({ token, probeOnly = false } = {}) {
  const ctx = makeContext({ token });

  // Tokenni saqlashdan oldin tekshirish: bitta yengil so'rov yetarli.
  if (probeOnly) {
    companyCaches.delete(ctx.token);
    const list = await getCompanies(ctx);
    return { provider: { id: 'fiveeld', name: meta.name }, drivers: [], companies: list.length };
  }

  const companies = await getCompanies(ctx);
  const failed = [];
  const restricted = [];

  const perCompany = await pool(companies, CONCURRENCY, async (company) => {
    try {
      return (await companyRows(ctx, company.id)).map((row) => toDriver(row, company));
    } catch (err) {
      if (err instanceof TokenError) throw err;

      if (err instanceof AccessError) {
        // Akkauntda bu kompaniyaga huquq yo'q — normal holat, xato emas.
        restricted.push(company.name);
        return [];
      }

      // Bitta kompaniya javob bermasa butun ro'yxat yo'qolmasin.
      failed.push(company.name);
      console.warn(`[fiveeld] ${company.name}: ${err.message}`);
      return [];
    }
  });

  return {
    provider: { id: 'fiveeld', name: meta.name },
    drivers: perCompany.flat().filter((d) => d.driverId),
    incomplete: failed.length
      ? { failedCompanies: failed.length, totalCompanies: companies.length, names: failed.slice(0, 5) }
      : null,
    restricted: restricted.length
      ? { count: restricted.length, totalCompanies: companies.length, names: restricted.slice(0, 5) }
      : null,
  };
}
