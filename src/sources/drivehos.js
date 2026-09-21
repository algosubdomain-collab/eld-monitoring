// Haqiqiy manba: DriveHOS platformasi.
// Leader ELD ham, Factor ELD ham shu API'da ishlaydi — farqi faqat
// "tenant_id" sarlavhasida (src/providers.js).
//
// Ma'lumot ikki bosqichda yig'iladi:
//   1) /v1/companies        — tenant ichidagi kompaniyalar ro'yxati;
//   2) /v1/hos/list         — har bir kompaniya uchun alohida, "company_id"
//                             sarlavhasi bilan (API tenant bo'yicha bermaydi).
//
// Token brauzerdan keladi va hech qayerda saqlanmaydi.
import { normalizeDriver } from '../normalize.js';

import { getProvider, DEFAULT_PROVIDER } from '../providers.js';

const BASE = process.env.ELD_BASE_URL ?? 'https://api.drivehos.app/api';

// Kompaniyalar ro'yxati kam o'zgaradi — uni uzoqroq saqlaymiz.
const COMPANY_TTL_MS = Number(process.env.ELD_COMPANY_TTL_MIN ?? 10) * 60_000;
// Bir vaqtda nechta so'rov. API kvota bilan cheklangan (429 "Too many
// requests"), shuning uchun kam oqim + qayta urinish ishlatiladi.
const CONCURRENCY = Number(process.env.ELD_CONCURRENCY ?? 3);
const MAX_RETRIES = Number(process.env.ELD_MAX_RETRIES ?? 8);
// Kutish shu qiymatdan oshmaydi — aks holda bitta omadsiz kompaniya
// butun yangilanishni yarim daqiqaga cho'zib yuborardi.
const MAX_BACKOFF_MS = 5000;
// Javobsiz qolgan so'rov butun yangilanishni (va fon tsiklini) ushlab turmasin.
const REQUEST_TIMEOUT_MS = Number(process.env.ELD_REQUEST_TIMEOUT_SEC ?? 30) * 1000;

export const meta = { name: 'DriveHOS', live: true, requiresToken: true };

/** Akkauntga bu kompaniya ko'rinmaydi — bu xato emas, shunchaki huquq. */
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

/** Duty status kodlari -> ichki nomlar. */
const STATUS_MAP = {
  DS_D: 'driving',
  DS_ON: 'on_duty',
  DS_SB: 'sleeper',
  DS_OFF: 'off_duty',
  DS_PC: 'off_duty', // personal conveyance
  DS_YM: 'on_duty',  // yard move
};

/**
 * Access token ~24 soatda tugaydi. Refresh token bo'lsa, uni jimgina
 * yangilaymiz — foydalanuvchi har kuni qaytadan token kiritmasligi uchun.
 * Bir vaqtda o'nlab so'rov ketayotgani uchun yangilash bitta marta bajariladi
 * va qolganlar shu va'daga qo'shiladi.
 */
async function refreshAccessToken(ctx) {
  if (!ctx.refreshToken) return false;
  if (ctx.refreshFailed) return false;

  ctx.refreshing ??= (async () => {
    // Tarmoq uzilishi (fetch throw qiladi) token o'lgani emas — xato yuqoriga
    // oddiy Error bo'lib chiqadi va ulanish saqlanib qoladi.
    const res = await fetch(`${BASE}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', tenant_id: ctx.tenantId },
      body: JSON.stringify({ refresh_token: ctx.refreshToken }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await res.json().catch(() => null);
    const data = body?.data ?? {};
    const access = data.access_token ?? data.accessToken ?? data.token;
    if (!res.ok || !access) {
      const reason = `${data.error_code ?? ''} ${body?.description ?? ''}`.trim() || res.statusText;
      console.warn(`[refresh] ${ctx.providerId}: ${res.status} ${reason}`);

      // Kvota yoki server xatosi — keyingi aylanishda yana urinib ko'ramiz.
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`Token refresh failed temporarily (${res.status}) — will retry`);
      }
      // Refresh token ham o'lgan — qayta-qayta urinmaymiz.
      ctx.refreshFailed = true;
      ctx.refreshReason = reason;
      return false;
    }

    ctx.token = access;
    ctx.refreshToken = data.refresh_token ?? data.refreshToken ?? ctx.refreshToken;
    await ctx.onTokens?.({ token: ctx.token, refreshToken: ctx.refreshToken });
    return true;
  })().finally(() => { ctx.refreshing = null; });

  return ctx.refreshing;
}

function headers(token, tenantId, companyId) {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    tenant_id: tenantId,
    ...(companyId ? { company_id: companyId } : {}),
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * API chaqiruvi. 429 kelganda kutib qayta urinadi — bu cheklov qat'iy
 * tezlik emas, umumiy kvota, shuning uchun sekinlashtirish yetarli emas.
 */
async function api(path, ctx, companyId, attempt = 0) {
  // Qaysi token bilan yuborilganini eslab qolamiz: javob kelguncha boshqa
  // so'rov tokenni yangilagan bo'lsa, qayta yangilash shart emas.
  const usedToken = ctx.token;
  let res;
  try {
    res = await fetch(BASE + path, {
      headers: headers(usedToken, ctx.tenantId, companyId),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    // Timeout yoki tarmoq uzilishi — qayta urinamiz.
    if (attempt < MAX_RETRIES) {
      await sleep(Math.min(400 * 2 ** attempt, MAX_BACKOFF_MS) + Math.random() * 400);
      return api(path, ctx, companyId, attempt + 1);
    }
    throw new Error(`${path} — ${err.name === 'TimeoutError' ? 'javob kelmadi (timeout)' : err.message}`);
  }

  // 401/403 har doim ham "token o'lgan" degani emas — gateway yuk ostida
  // ham shunday qaytarishi mumkin. Foydalanuvchini bekordan-bekorga
  // tashqariga chiqarib yubormaslik uchun sababini tekshiramiz.
  if (res.status === 401 || res.status === 403) {
    const body = await res.json().catch(() => null);
    const reason = `${body?.data?.error_code ?? ''} ${body?.description ?? ''}`;

    if (/token|session|expired|unauthor/i.test(reason)) {
      // Boshqa so'rov allaqachon yangilab bo'lgan bo'lsa — shunchaki qaytaramiz.
      if (ctx.token !== usedToken) return api(path, ctx, companyId, attempt);

      // Aks holda yangilaymiz. refreshAccessToken bitta yangilashni
      // kafolatlaydi — qolgan so'rovlar shu va'daga qo'shiladi.
      if (await refreshAccessToken(ctx)) return api(path, ctx, companyId, attempt);

      throw new TokenError(ctx.refreshReason
        ? `Session ended (${ctx.refreshReason}) — reconnect with a fresh token`
        : 'The token was rejected — paste a fresh one');
    }
    // "You don't have access to this company" — qayta urinishning ma'nosi yo'q.
    if (/access/i.test(reason)) {
      throw new AccessError(reason.trim());
    }
    if (attempt < MAX_RETRIES) {
      await sleep(Math.min(400 * 2 ** attempt, MAX_BACKOFF_MS) + Math.random() * 400);
      return api(path, ctx, companyId, attempt + 1);
    }
    throw new Error(`${res.status} ${path} — ${reason.trim() || res.statusText}`);
  }

  if (res.status === 429) {
    if (attempt >= MAX_RETRIES) throw new Error(`429 Too many requests — ${path}`);
    // 0.4s, 0.8s, 1.6s, 3.2s, keyin 5s da to'xtaydi.
    // Tasodifiy qo'shimcha — hammasi bir vaqtda qayta urinmasligi uchun.
    await sleep(Math.min(400 * 2 ** attempt, MAX_BACKOFF_MS) + Math.random() * 400);
    return api(path, ctx, companyId, attempt + 1);
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`${res.status} ${path} — ${body?.description ?? res.statusText}`);
  }
  return body?.data ?? {};
}

/** Sahifalab to'liq ro'yxatni yig'adi. */
async function fetchAllPages(pathFor, ctx, companyId, pick) {
  const first = await api(pathFor(1), ctx, companyId);
  const out = [...(pick(first) ?? [])];
  const pages = first?.paging?.totalPages ?? 1;

  for (let page = 2; page <= pages; page += 1) {
    const next = await api(pathFor(page), ctx, companyId);
    out.push(...(pick(next) ?? []));
  }
  return out;
}

/**
 * Haydovchi kartochkalari (profil) — HOS ro'yxatida bu ma'lumot yo'q.
 * Bu yerdan faqat "profil oxirgi marta qachon o'zgargan" olinadi.
 */
async function getProfiles(ctx) {
  const rows = await fetchAllPages(
    (p) => `/v1/drivers?page=${p}&limit=100&status=all`,
    ctx, null,
    (d) => d.drivers
  );
  return new Map(rows.map((r) => [r.driver_id, r]));
}

// Kesh provayder VA platforma akkaunti bo'yicha ajratiladi: bir serverda
// bir nechta foydalanuvchi bo'lsa, har birining akkaunti boshqa kompaniyalarni
// ko'radi. Faqat provayder bo'yicha bo'lsa, biri ikkinchisining ro'yxatini
// olib, "no access" bilan haydovchilarsiz qolardi.
const companyCaches = new Map();

/** Token egasi (JWT user_id) — token yangilansa ham o'zgarmaydi. */
function accountId(token) {
  try {
    const payload = JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString());
    if (payload?.user_id ?? payload?.sub) return String(payload.user_id ?? payload.sub);
  } catch { /* JWT emas */ }
  return String(token);
}

const companyCacheKey = (ctx) => `${ctx.providerId}:${accountId(ctx.token)}`;

async function getCompanies(ctx) {
  const cached = companyCaches.get(companyCacheKey(ctx));
  if (cached && Date.now() - cached.at < COMPANY_TTL_MS) return cached.list;

  const rows = await fetchAllPages(
    (p) => `/v1/companies?page=${p}&limit=100`,
    ctx, null,
    (d) => d.companies
  );
  const list = rows.map((c) => ({
    id: c.company_id, name: c.company_name, drivers: c.active_driver ?? 0,
  }));
  companyCaches.set(companyCacheKey(ctx), { at: Date.now(), list });
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

/** ELD buzilishlari matn yoki obyekt bo'lib kelishi mumkin. */
function toText(item) {
  if (!item) return null;
  if (typeof item === 'string') return item;
  return item.description ?? item.message ?? item.name ?? item.type ?? JSON.stringify(item);
}

const msToMin = (ms) => (typeof ms === 'number' ? Math.round(ms / 60_000) : null);

function makeContext({ token, refreshToken, provider, onTokens }) {
  const key = token || process.env.ELD_ACCESS_TOKEN;
  if (!key) throw new TokenError('No access token provided');

  const chosen = getProvider(provider ?? process.env.ELD_PROVIDER ?? DEFAULT_PROVIDER);
  return {
    chosen,
    ctx: {
      token: key,
      refreshToken: refreshToken || process.env.ELD_REFRESH_TOKEN || null,
      tenantId: chosen.tenantId,
      providerId: chosen.id,
      onTokens,
    },
  };
}

/**
 * Har bir haydovchining joriy statusi va u QACHON boshlangani
 * (/v1/hos/latest). hos/list bu vaqtni bermaydi.
 * Natija: Map<driverId, { code, since }>. Olinmagan haydovchi Map'da bo'lmaydi.
 */
export async function fetchLatestStatuses({ drivers, concurrency = 2, ...auth }) {
  const { ctx } = makeContext(auth);
  const out = new Map();
  let failed = 0;

  await pool(drivers, concurrency, async (d) => {
    try {
      const data = await api(`/v1/hos/latest?driver_id=${encodeURIComponent(d.driverId)}`, ctx, d.companyId);
      if (data?.driver_event_code) {
        out.set(d.driverId, { code: data.driver_event_code, since: data.driver_event_start_time || null });
      }
    } catch (err) {
      if (err instanceof TokenError) throw err;
      failed += 1;
    }
  });
  return { statuses: out, failed };
}

export async function fetchDrivers({
  token, refreshToken, provider, onTokens, probeOnly = false,
} = {}) {
  const { chosen, ctx } = makeContext({ token, refreshToken, provider, onTokens });

  // Tokenni saqlashdan oldin tekshirish: bitta yengil so'rov yetarli,
  // butun parkni yig'ib o'tirishning hojati yo'q.
  if (probeOnly) {
    companyCaches.delete(companyCacheKey(ctx));
    const list = await getCompanies(ctx);
    return { provider: { id: chosen.id, name: chosen.name }, drivers: [], companies: list.length };
  }

  const [companies, profiles] = await Promise.all([
    getCompanies(ctx),
    getProfiles(ctx).catch((err) => {
      if (err instanceof TokenError) throw err;
      console.warn(`[leadereld] profillar olinmadi: ${err.message}`);
      return new Map();
    }),
  ]);
  const active = companies.filter((c) => c.drivers > 0);

  const failed = [];
  const restricted = [];
  const perCompany = await pool(active, CONCURRENCY, async (company) => {
    try {
      const rows = await fetchAllPages(
        (p) => `/v1/hos/list?page=${p}&limit=100`,
        ctx, company.id,
        (d) => d.drivers
      );
      return rows.map((r) => ({ row: r, company }));
    } catch (err) {
      if (err instanceof TokenError) throw err;

      if (err instanceof AccessError) {
        // Akkauntda bu kompaniyaga huquq yo'q — normal holat, xato emas.
        restricted.push(company.name);
        return [];
      }

      // Bitta kompaniya javob bermasa butun ro'yxat yo'qolmasin —
      // lekin jimgina tashlab ketmaymiz, buni interfeysga chiqaramiz.
      failed.push(company.name);
      console.warn(`[drivehos] ${company.name}: ${err.message}`);
      return [];
    }
  });

  const drivers = perCompany.flat().map(({ row, company }) => {
    const profile = profiles.get(row.driver_id);
    return normalizeDriver({
      driverId: row.driver_id,
      driverName: row.driver_name?.trim() || '—',
      company: company.name,
      companyId: company.id,
      truck: row.vehicle_number || '—',
      status: STATUS_MAP[row.current_status] ?? 'unknown',
      statusCode: row.current_status ?? null,
      // API qolgan vaqtni millisekundda beradi.
      driveRemainingMin: msToMin(row.drive),
      shiftRemainingMin: msToMin(row.shift),
      cycleRemainingMin: msToMin(row.cycle),
      breakRemainingMin: msToMin(row.break),
      violations: [...(row.violations ?? []), ...(row.errors ?? [])].map(toText).filter(Boolean),
      location: row.calculated_location || (row.lat ? `${row.lat.toFixed(3)}, ${row.lon.toFixed(3)}` : '—'),
      lastUpdate: row.last_sync || null,
      online: row.online !== false,
      eldConnected: row.eld_status === true,
      // Profil kartochkasi oxirgi marta qachon tahrirlangan.
      profileUpdatedAt: profile?.updated_at
        ? profile.updated_at.replace(' ', 'T') + 'Z'
        : null,
    });
  });

  return {
    provider: { id: chosen.id, name: chosen.name },
    drivers,
    // Nechta kompaniya olinmadi — dashboard buni yashirmasligi kerak.
    incomplete: failed.length
      ? { failedCompanies: failed.length, totalCompanies: active.length, names: failed.slice(0, 5) }
      : null,
    // Akkaunt ko'ra olmaydigan kompaniyalar — ogohlantirish emas, ma'lumot.
    restricted: restricted.length
      ? { count: restricted.length, totalCompanies: active.length, names: restricted.slice(0, 5) }
      : null,
  };
}
