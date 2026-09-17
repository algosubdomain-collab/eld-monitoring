// Haydovchi aloqadan uzilganda Telegram guruhiga xabar yuboradi.
//
// Ishlash tartibi: har yangilanishda oldingi holat bilan solishtiriladi.
// Uzilish ELD holati bo'yicha aniqlanadi (hos/list dagi eld_status —
// platformadagi "ELD status: connected/disconnected" filtri bilan bir xil),
// ilovaning online/offline holati bo'yicha emas.
// ELD'i ulangan haydovchi uzilsa, uzilish vaqti eslab qolinadi va u 5 daqiqadan
// ko'p uzilgan tursagina xabar ketadi — 1-2 daqiqalik qisqa uzilishlar
// e'tiborsiz qoladi. Doim uzilgan turgan haydovchi yozilmaydi,
// dam oluvchilar ro'yxatidagilar ham (src/resting.js).
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sendMessage, sendPhoto } from './telegram.js';
import { captureDriver } from './screenshot.js';
import { isResting } from './resting.js';

const FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'notify.json'
);

// Bitta haydovchi haqida shu muddat ichida qayta xabar yuborilmaydi —
// aloqasi uzilib-ulanib turganda guruh to'lib ketmasligi uchun.
const COOLDOWN_MS = Number(process.env.TELEGRAM_COOLDOWN_HOURS ?? 6) * 3_600_000;
// Shuncha vaqt ELD uzluksiz uzilgan tursagina xabar yuboriladi.
const CONFIRM_MS = Number(process.env.DISCONNECT_CONFIRM_MINUTES ?? 5) * 60_000;
// Saqlangan holat shundan eski bo'lsa (server uzoq o'chiq turgan), unga
// tayanib bo'lmaydi — o'sha orada uzilganlar "yangi" bo'lib ko'rinardi.
const STALE_STATE_MS = 30 * 60_000;
// Ro'yxatda ko'rinmay qolgan haydovchi holati shuncha vaqt saqlanadi
// (kompaniya so'rovi o'tmay qolgan bo'lishi mumkin).
const FORGET_MS = 7 * 86_400_000;
// Bir yangilanishda ko'pi bilan nechta haydovchi haqida rasmli xabar.
const MAX_PER_UPDATE = Number(process.env.TELEGRAM_MAX_ALERTS ?? 10);
// Skrinshot urinishlari orasidagi kutish. Birinchisi — yangilanishning
// API so'rovlari tinchishini kutish (aks holda platforma sahifasi 429 oladi).
const SHOT_DELAYS_MS = [15_000, 45_000, 90_000, 180_000];

let state = null;

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

const esc = (v) =>
  String(v ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** "JOSE  RICARDO LOPEZ" -> "Jose Ricardo Lopez" — murojaatda chiroyliroq. */
const properName = (name) =>
  String(name ?? '').trim().split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ') || 'driver';

function duration(iso) {
  const min = Math.max(1, Math.round((Date.now() - new Date(iso)) / 60_000));
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'}`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} hour${h === 1 ? '' : 's'}${m ? ` ${m} minute${m === 1 ? '' : 's'}` : ''}`;
}

/** Xabar haydovchiga murojaat qiladi. Vaqt yuborish paytida hisoblanadi. */
function caption(d, { test = false } = {}) {
  const driving = d.status === 'driving' ? ' while driving' : '';
  return [
    ...(test ? ['🧪 <i>Test message</i>', ''] : []),
    `👋 Hello brother <b>${esc(properName(d.driverName))}</b>,`,
    '',
    `Your ELD has been disconnected for <b>${esc(duration(d.disconnectedAt))}</b>${driving}. ` +
      'Please check your device and make sure it is connected.',
    '',
    `🚛 Truck ${esc(d.truck)} · ${esc(d.company)}`,
  ].join('\n');
}

// ---------------------------------------------------------------- navbat
// Skrinshotlar birma-bir olinadi: bir vaqtda bir nechta brauzer sahifasi
// API kvotasini tugatib, hammasini bo'sh qoldirardi.
const queue = [];
let running = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function deliver(job) {
  if (job.summary) {
    const names = job.rest.map((d) => `• ${esc(d.driverName)} — ${esc(d.company)}, truck ${esc(d.truck)}`);
    await sendMessage(job.telegram,
      `<b>…and ${job.rest.length} more drivers disconnected</b>\n\n${names.join('\n')}`.slice(0, 4000));
    return;
  }
  for (let i = 0; i < SHOT_DELAYS_MS.length; i += 1) {
    await sleep(SHOT_DELAYS_MS[i]);
    try {
      const token = await job.getToken();
      const png = token && await captureDriver({ token, providerId: job.providerId, driver: job.driver });
      if (png) {
        await sendPhoto(job.telegram, png, caption(job.driver, job));
        console.log(`[telegram] rasm bilan yuborildi: ${job.driver.driverName}`);
        return;
      }
      console.warn(`[telegram] skrinshot bo'sh (${i + 1}/${SHOT_DELAYS_MS.length}): ${job.driver.driverName}`);
    } catch (err) {
      console.warn(`[telegram] urinish ${i + 1}: ${job.driver.driverName}: ${err.message}`);
    }
  }

  // Hamma urinish muvaffaqiyatsiz — xabarni yo'qotmaymiz, rasmsiz yuboramiz.
  await sendMessage(job.telegram, `${caption(job.driver, job)}\n\n<i>Screenshot could not be taken.</i>`);
  console.warn(`[telegram] skrinshotsiz yuborildi: ${job.driver.driverName}`);
}

/** Bitta haydovchi haqida xabarni darhol yetkazadi (qo'lda qayta yuborish uchun). */
export const deliverAlert = (job) => deliver(job);

async function drain() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const job = queue.shift();
      await deliver(job).catch((err) => console.warn(`[telegram] ${err.message}`));
    }
  } finally {
    running = false;
  }
}

/**
 * Yangi ma'lumot kelganda chaqiriladi.
 * Birinchi ishga tushishda (yoki holat eskirgan bo'lsa) xabar yuborilmaydi —
 * aks holda allaqachon offline turgan yuzlab haydovchi haqida birdan xabar ketardi.
 */
export async function onFleetUpdate({ login, providerId, drivers, telegram, getToken }) {
  if (!Array.isArray(drivers) || !drivers.length) return;

  const key = `${login}:${providerId}`;
  const all = await load();
  const saved = all[key];
  const now = Date.now();

  // Holat boshqa formatda (eski `online` asosidagi) yoki eskirgan — qaytadan boshlaymiz.
  const baseline = saved?.basis !== 'eld' || !saved?.drivers ||
    now - new Date(saved.savedAt ?? 0).getTime() > STALE_STATE_MS;
  const known = baseline ? {} : saved.drivers;
  const next = {};
  const due = [];

  for (const d of drivers) {
    if (!d.driverId) continue;
    const prev = known[d.driverId];
    const rec = {
      connected: d.eldConnected !== false,
      disconnectedAt: null,
      alerted: false,
      notifiedAt: prev?.notifiedAt ?? null,
      seenAt: now,
    };

    if (rec.connected) {
      if (prev?.disconnectedAt && !prev.alerted) {
        const min = Math.round((now - prev.disconnectedAt) / 60_000);
        console.log(`[telegram] qisqa ELD uzilishi (~${min} daq), xabar yo'q: ${d.driverName}`);
      }
    } else if (prev?.disconnectedAt) {
      // Uzilish davom etyapti.
      rec.disconnectedAt = prev.disconnectedAt;
      rec.alerted = prev.alerted;
    } else if (prev?.connected) {
      // Hozirgina uzildi. API ELD uzilgan vaqtni bermaydi (last_sync — ilova
      // sinxroni), shuning uchun birinchi ko'rgan paytimiz olinadi.
      rec.disconnectedAt = now;
    }

    if (!rec.connected && rec.disconnectedAt && !rec.alerted && now - rec.disconnectedAt >= CONFIRM_MS) {
      rec.alerted = true;
      const cooled = !rec.notifiedAt || now - new Date(rec.notifiedAt).getTime() > COOLDOWN_MS;
      if (!cooled) {
        // 6 soat ichida xabar berilgan — takrorlamaymiz.
      } else if (await isResting(key, d)) {
        console.log(`[telegram] dam oluvchi, xabar yo'q: ${d.driverName}`);
      } else {
        rec.notifiedAt = new Date(now).toISOString();
        due.push({ ...d, disconnectedAt: new Date(rec.disconnectedAt).toISOString() });
      }
    }

    next[d.driverId] = rec;
  }

  // Bu safar ro'yxatda yo'q haydovchilar (kompaniya so'rovi o'tmagan bo'lishi
  // mumkin) — holatini saqlab qolamiz, aks holda keyingi uzilishi sezilmasdi.
  for (const [id, rec] of Object.entries(known)) {
    if (!next[id] && now - (rec.seenAt ?? 0) < FORGET_MS) next[id] = rec;
  }

  all[key] = { basis: 'eld', savedAt: new Date(now).toISOString(), drivers: next };
  await persist();

  if (!due.length || !telegram?.botToken || !telegram?.chatId) return;

  // Har bir haydovchi — alohida xabar, o'z skrinshoti bilan.
  for (const d of due.slice(0, MAX_PER_UPDATE)) {
    queue.push({ login, providerId, driver: d, telegram, getToken });
  }
  if (due.length > MAX_PER_UPDATE) {
    queue.push({
      login, providerId, telegram, getToken, summary: true,
      driver: null, rest: due.slice(MAX_PER_UPDATE),
    });
  }
  drain();
}
