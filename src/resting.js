// Dam olayotgan haydovchilar ro'yxati.
//
// Uzoq dam olayotgan haydovchining ELD'si tabiiy ravishda uziladi — bu
// haqida guruhga "disconnected" yozish shovqin. Shuning uchun har 12 soatda
// barcha haydovchilar tekshiriladi: so'nggi 24 soat davomida bitta statusda
// (Sleeper yoki Off duty) turganlar ro'yxatga tushadi va ular uchun uzilish
// xabari yuborilmaydi.
//
// Ro'yxat 12 soatda bir yangilanadi, lekin haydovchi statusini o'zgartirsa
// (masalan haydashga chiqsa) u har 2 daqiqalik tekshiruvda darhol ro'yxatdan
// chiqadi — aks holda 12 soat davomida uning uzilishi e'tiborsiz qolardi.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'resting.json'
);

const CHECK_EVERY_MS = Number(process.env.RESTING_CHECK_HOURS ?? 12) * 3_600_000;
const MIN_REST_MS = Number(process.env.RESTING_MIN_HOURS ?? 24) * 3_600_000;
// Faqat shu statuslar dam olish hisoblanadi. DS_PC (personal conveyance)
// "off_duty" ga normalizatsiya qilinadi, lekin u harakat — dam emas.
const REST_CODES = new Set(['DS_SB', 'DS_OFF']);

let state = null;
const running = new Set();

async function load() {
  if (state) return state;
  try {
    state = JSON.parse(await fs.readFile(FILE, 'utf8'));
  } catch {
    state = {};
  }
  return state;
}

async function persist() {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(state, null, 2));
}

/**
 * Haydovchi ro'yxatda va ro'yxatga tushgan paytdagi statusida turibdimi.
 * Statusi o'zgargan bo'lsa — dam tugagan, u endi dam oluvchi emas.
 */
export async function isResting(key, driver) {
  const entry = (await load())[key]?.drivers?.[driver.driverId];
  return Boolean(entry && driver.statusCode && driver.statusCode === entry.code);
}

/** Statusini o'zgartirgan haydovchilarni ro'yxatdan darhol chiqaradi. */
export async function pruneResting(key, drivers) {
  const list = (await load())[key]?.drivers;
  if (!list) return;

  let changed = false;
  for (const d of drivers) {
    const entry = list[d.driverId];
    if (entry && d.statusCode && d.statusCode !== entry.code) {
      delete list[d.driverId];
      changed = true;
      console.log(`[resting] ${d.driverName}: status ${entry.code} → ${d.statusCode}, ro'yxatdan chiqdi`);
    }
  }
  if (changed) await persist();
}

/**
 * Oxirgi tekshiruvdan 12 soat o'tgan bo'lsa, ro'yxatni qaytadan tuzadi.
 * Fonda ishlaydi — asosiy 2 daqiqalik tekshiruvni to'xtatmaydi.
 */
export async function refreshRestingIfDue({ key, drivers, fetchLatest }) {
  const entry = (await load())[key];
  if (entry && Date.now() - new Date(entry.checkedAt).getTime() < CHECK_EVERY_MS) return;
  if (running.has(key) || !fetchLatest) return;

  running.add(key);
  try {
    await rebuild({ key, drivers, fetchLatest });
  } catch (err) {
    console.warn(`[resting] ${key}: ${err.message}`);
  } finally {
    running.delete(key);
  }
}

async function rebuild({ key, drivers, fetchLatest }) {
  const started = Date.now();
  // Hozir Sleeper/Off duty bo'lmagan haydovchi dam oluvchi bo'la olmaydi —
  // ular uchun so'rov yuborib o'tirmaymiz (API kvotasi cheklangan).
  const candidates = drivers.filter((d) => REST_CODES.has(d.statusCode));
  const { statuses, failed } = await fetchLatest(candidates);

  const previous = state[key]?.drivers ?? {};
  const next = {};

  for (const d of candidates) {
    const latest = statuses.get(d.driverId);
    if (!latest) {
      // So'rov o'tmadi — oldingi xulosani saqlaymiz, agar status o'zgarmagan bo'lsa.
      if (previous[d.driverId]?.code === d.statusCode) next[d.driverId] = previous[d.driverId];
      continue;
    }
    const since = latest.since ? new Date(latest.since).getTime() : NaN;
    if (REST_CODES.has(latest.code) && Number.isFinite(since) && started - since >= MIN_REST_MS) {
      next[d.driverId] = {
        code: latest.code,
        since: latest.since,
        name: d.driverName,
        company: d.company,
        truck: d.truck,
      };
    }
  }

  state[key] = { checkedAt: new Date(started).toISOString(), drivers: next };
  await persist();
  console.log(
    `[resting] ${key}: ${Object.keys(next).length} dam oluvchi ` +
    `(${candidates.length} Sleeper/Off tekshirildi, ${failed} olinmadi, ` +
    `${Math.round((Date.now() - started) / 1000)}s)`
  );
}
