// DOT ogohlantirishi: haydovchining yo'lida, belgilangan radius ichida
// tarozi (weigh station) bormi.
//
// Platforma haydovchining yo'nalishini (heading) bermaydi, shuning uchun uni
// oldingi va hozirgi nuqta orasidan hisoblaymiz. Tarozi "oldinda" deb faqat
// harakat yo'nalishiga yaqin burchakda turgani hisoblanadi — orqada qolgani
// yonib turmaydi. Shu sababli holat haydovchi bo'yicha saqlanadi.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nearbyScales, distanceKm, bearing, angleBetween, resetCellBudget } from './scales.js';

const FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'dot.json'
);

// Shu radius ichidagi tarozi ogohlantiradi.
const RADIUS_KM = Number(process.env.DOT_ALERT_KM ?? 5);
// Yo'nalishni ishonchli hisoblash uchun kamida shuncha yurgan bo'lishi kerak.
const MIN_MOVE_KM = 0.3;
// "Oldinda" deb hisoblanadigan burchak. Yonib turgani esa kengroq burchakda
// o'chmaydi (gisterezis) — chiziq chetida o'chib-yonib turmasin.
const AHEAD_DEG = 75;
const KEEP_DEG = 100;
// Haydovchi uzoq vaqt ko'rinmasa yozuvi tashlanadi.
const STALE_MS = 7 * 24 * 60 * 60_000;

let cache = null;

async function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, 'utf8'));
  } catch {
    cache = {};
  }
  return cache;
}

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      await fs.mkdir(path.dirname(FILE), { recursive: true });
      await fs.writeFile(FILE, JSON.stringify(cache));
    } catch (err) {
      console.warn(`[dot] saqlab bo'lmadi: ${err.message}`);
    }
  }, 2000);
  saveTimer.unref?.();
}

/**
 * Haydovchilar ro'yxatini ko'rib chiqadi va har biriga `dot` maydonini
 * qo'yadi: { name, km } — yo'lida tarozi bo'lsa; aks holda null.
 * Haydovchilar obyekti joyida o'zgartiriladi.
 */
export async function applyDotAlerts(scopeKey, drivers) {
  const all = await load();
  const state = all[scopeKey] ?? (all[scopeKey] = {});
  const now = Date.now();
  resetCellBudget();
  let changed = false;

  for (const d of drivers) {
    d.dot = null;
    if (!Number.isFinite(d.lat) || !Number.isFinite(d.lon)) continue;

    const prev = state[d.driverId];
    // Harakat yo'nalishi — sezilarli siljish bo'lgandagina yangilanadi.
    let course = prev?.course ?? null;
    if (prev && Number.isFinite(prev.lat)) {
      const moved = distanceKm(prev.lat, prev.lon, d.lat, d.lon);
      if (moved >= MIN_MOVE_KM) course = bearing(prev.lat, prev.lon, d.lat, d.lon);
    }

    const stations = await nearbyScales(d.lat, d.lon);
    let active = null;

    if (stations.length) {
      // Avval yonib turgan tarozini tekshiramiz — u hali oldindami?
      const held = prev?.alert && stations.find((s) => s.id === prev.alert.id);
      if (held) {
        const km = distanceKm(d.lat, d.lon, held.lat, held.lon);
        const angle = course == null
          ? 0
          : angleBetween(course, bearing(d.lat, d.lon, held.lat, held.lon));
        if (km <= RADIUS_KM && angle <= KEEP_DEG) {
          active = { id: held.id, name: held.name, km: Math.round(km * 10) / 10 };
        }
      }

      // Yangi tarozi — faqat harakat yo'nalishi ma'lum bo'lganda yoqamiz.
      // Aks holda tarozi yonida turgan haydovchida bekorga yonib turardi.
      if (!active && course != null) {
        let best = null;
        for (const s of stations) {
          const km = distanceKm(d.lat, d.lon, s.lat, s.lon);
          if (km > RADIUS_KM) continue;
          if (angleBetween(course, bearing(d.lat, d.lon, s.lat, s.lon)) > AHEAD_DEG) continue;
          if (!best || km < best.km) best = { id: s.id, name: s.name, km };
        }
        if (best) active = { ...best, km: Math.round(best.km * 10) / 10 };
      }
    }

    d.dot = active;
    state[d.driverId] = { lat: d.lat, lon: d.lon, course, alert: active, at: now };
    changed = true;
  }

  // Ko'rinmay ketgan haydovchilarni tozalaymiz.
  for (const [id, rec] of Object.entries(state)) {
    if (now - (rec.at ?? 0) > STALE_MS) { delete state[id]; changed = true; }
  }

  if (changed) scheduleSave();
  return drivers;
}

export const dotRadiusKm = RADIUS_KM;
