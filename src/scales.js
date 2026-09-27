// DOT tarozilari (weigh station / truck scale) joylashuvlari.
//
// Har bir haydovchi uchun har yangilanishda tashqi API'ga so'rov yuborish
// mumkin emas — 100 haydovchi × 2 daqiqa kuniga o'n minglab so'rov degani.
// Shuning uchun boshqacha ishlaymiz: dunyo 0.5° li kataklarga bo'linadi,
// haydovchi yangi katakka kirganda o'sha katak BIR MARTA yuklanadi va diskka
// keshlanadi. Keyin masofa hisobi butunlay lokal — so'rovsiz.
//
// Asosiy manba — OpenStreetMap (bepul, kalitsiz). GOOGLE_MAPS_API_KEY
// berilgan bo'lsa, ustiga Google Places natijalari ham qo'shiladi.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'scales.json'
);

// Katak o'lchami (daraja). 0.5° ≈ 55 km kenglik bo'yicha.
const CELL = 0.5;
// Tarozilar ko'chmaydi — keshni uzoq ushlaymiz.
const TTL_MS = Number(process.env.SCALES_TTL_DAYS ?? 30) * 24 * 60 * 60_000;
// Ommaviy Overpass serverlari tez-tez band bo'ladi (504/timeout), shuning
// uchun bir nechtasi ketma-ket sinaladi. OVERPASS_URL berilsa faqat o'sha.
const OVERPASS_MIRRORS = process.env.OVERPASS_URL
  ? [process.env.OVERPASS_URL]
  : [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ];
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY ?? '';
const REQUEST_TIMEOUT_MS = 25_000;

/** Overpass jamoat serveri — ketma-ket va bo'shashtirib so'raymiz. */
const FETCH_GAP_MS = 1200;
// Bitta yangilanishda nechta yangi katak yuklanishi mumkin. Bu bo'lmasa 100 ta
// haydovchi birdaniga yuzlab so'rov yuborib, bepul xizmatni bosib qo'yardi.
// Baza shu tezlikda asta to'lib boradi.
const MAX_NEW_CELLS_PER_PASS = Number(process.env.SCALES_CELLS_PER_PASS ?? 4);
let lastFetchAt = 0;
let budget = MAX_NEW_CELLS_PER_PASS;
const inFlight = new Map();

/** Har yangilanish boshida chaqiriladi — yangi katak "byudjeti" tiklanadi. */
export function resetCellBudget() {
  budget = MAX_NEW_CELLS_PER_PASS;
}

let cache = null;
// Tekshirish buyrug'i faqat o'qiydi — server ishlayotgan bo'lsa uning
// keshini bosib yozmasligi kerak.
let persist = true;
export function disablePersist() { persist = false; }

async function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, 'utf8'));
  } catch {
    cache = { cells: {} };
  }
  if (!cache.cells) cache.cells = {};
  return cache;
}

let saveTimer = null;
/** Yozishni biroz kechiktiramiz — ketma-ket kataklar bitta yozuvga qo'shiladi. */
function scheduleSave() {
  if (!persist || saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    try {
      await fs.mkdir(path.dirname(FILE), { recursive: true });
      await fs.writeFile(FILE, JSON.stringify(cache));
    } catch (err) {
      console.warn(`[scales] saqlab bo'lmadi: ${err.message}`);
    }
  }, 2000);
  saveTimer.unref?.();
}

const cellKey = (lat, lon) =>
  `${Math.floor(lat / CELL)},${Math.floor(lon / CELL)}`;

const cellBox = (key) => {
  const [y, x] = key.split(',').map(Number);
  return { south: y * CELL, west: x * CELL, north: (y + 1) * CELL, east: (x + 1) * CELL };
};

/** Ikki nuqta orasidagi masofa (km) — haversine. */
export function distanceKm(aLat, aLon, bLat, bLon) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A nuqtadan B nuqtaga yo'nalish (gradus, 0 = shimol). */
export function bearing(aLat, aLon, bLat, bLon) {
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** Ikki yo'nalish orasidagi eng kichik burchak (0..180). */
export function angleBetween(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

// ------------------------------------------------------------ manbalar

async function fromOverpass({ south, west, north, east }) {
  const box = `${south},${west},${north},${east}`;
  // Tarozilar OSM'da bir nechta teg bilan belgilanadi — hammasini so'raymiz.
  const query = `[out:json][timeout:20];(
    node["highway"="weigh_station"](${box});
    way["highway"="weigh_station"](${box});
    node["amenity"="weighbridge"](${box});
    way["amenity"="weighbridge"](${box});
    node["man_made"="weighbridge"](${box});
  );out center tags;`;

  let body = null;
  let lastError = null;

  for (const url of OVERPASS_MIRRORS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain', 'User-Agent': 'eld-monitoring (self-hosted)' },
        body: query,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) { lastError = new Error(`Overpass ${res.status}`); continue; }

      const payload = await res.json();
      // Overpass so'rov o'z ichidagi timeout'ga urilganda HTTP 200 qaytaradi,
      // lekin natija bo'sh bo'ladi va "remark" da sabab yoziladi. Uni
      // muvaffaqiyat deb qabul qilsak, tarozisi bor katakni "bo'sh" deb
      // keshlab qo'yamiz — shuning uchun xato sifatida qaraymiz.
      if (payload?.remark && /timed out|error/i.test(payload.remark)) {
        lastError = new Error(`Overpass: ${payload.remark.slice(0, 80)}`);
        continue;
      }
      body = payload;
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!body) throw lastError ?? new Error('Overpass unreachable');
  return (body?.elements ?? []).map((el) => ({
    id: `osm:${el.type}/${el.id}`,
    name: el.tags?.name || 'Weigh station',
    lat: el.lat ?? el.center?.lat,
    lon: el.lon ?? el.center?.lon,
  })).filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon));
}

async function fromGoogle({ south, west, north, east }) {
  if (!GOOGLE_KEY) return [];
  const lat = (south + north) / 2;
  const lon = (west + east) / 2;
  // Katak burchagigacha yetadigan radius (metr), Google chegarasi 50 km.
  const radius = Math.min(50000, Math.round(distanceKm(lat, lon, north, east) * 1000));

  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
  url.searchParams.set('location', `${lat},${lon}`);
  url.searchParams.set('radius', String(radius));
  // Places'da "weigh station" turi yo'q — kalit so'z bilan qidiramiz.
  url.searchParams.set('keyword', 'weigh station truck scale');
  url.searchParams.set('key', GOOGLE_KEY);

  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Google Places ${res.status}`);
  const body = await res.json();

  if (body.status && !['OK', 'ZERO_RESULTS'].includes(body.status)) {
    throw new Error(`Google Places: ${body.error_message || body.status}`);
  }
  return (body?.results ?? []).map((r) => ({
    id: `g:${r.place_id}`,
    name: r.name || 'Weigh station',
    lat: r.geometry?.location?.lat,
    lon: r.geometry?.location?.lng,
  })).filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon));
}

/** Bir joyda turgan takroriy yozuvlarni (OSM + Google) birlashtiradi. */
function dedupe(list) {
  const out = [];
  for (const s of list) {
    if (!out.some((o) => distanceKm(o.lat, o.lon, s.lat, s.lon) < 0.2)) out.push(s);
  }
  return out;
}

/** Bitta katakni yuklaydi va keshga yozadi. */
async function loadCell(key) {
  const running = inFlight.get(key);
  if (running) return running;

  const task = (async () => {
    const gap = FETCH_GAP_MS - (Date.now() - lastFetchAt);
    if (gap > 0) await new Promise((r) => setTimeout(r, gap));
    lastFetchAt = Date.now();

    const box = cellBox(key);
    const [osm, google] = await Promise.allSettled([fromOverpass(box), fromGoogle(box)]);

    if (osm.status === 'rejected' && google.status !== 'fulfilled') {
      throw osm.reason;
    }
    const stations = dedupe([
      ...(osm.status === 'fulfilled' ? osm.value : []),
      ...(google.status === 'fulfilled' ? google.value : []),
    ]);

    const all = await load();
    all.cells[key] = { at: Date.now(), stations };
    scheduleSave();
    return stations;
  })().finally(() => inFlight.delete(key));

  inFlight.set(key, task);
  return task;
}

/**
 * Nuqta atrofidagi tarozilar. Katak keshda bo'lmasa — fonda yuklanadi va
 * shu safar bo'sh qaytadi (dashboard kutib turmaydi).
 */
export async function nearbyScales(lat, lon) {
  const all = await load();
  const out = [];
  const missing = [];

  // Chegaraga yaqin haydovchi uchun qo'shni kataklar ham kerak.
  for (const dy of [-1, 0, 1]) {
    for (const dx of [-1, 0, 1]) {
      const key = cellKey(lat + dy * CELL, lon + dx * CELL);
      const cell = all.cells[key];
      if (cell && Date.now() - cell.at < TTL_MS) out.push(...cell.stations);
      else missing.push(key);
    }
  }

  for (const key of missing) {
    if (budget <= 0) break;
    budget -= 1;
    loadCell(key).catch((err) => {
      // Xato ham keshlanadi (qisqaroq muddatga) — har aylanishda urinmaslik uchun.
      all.cells[key] = { at: Date.now() - TTL_MS + 60 * 60_000, stations: [], error: err.message };
      scheduleSave();
      console.warn(`[scales] ${key}: ${err.message}`);
    });
  }

  return out;
}

/**
 * Bitta hududni shu yerning o'zida yuklaydi va natijani qaytaradi (keshni ham
 * to'ldiradi). Tekshirish buyrug'i uchun — nearbyScales() fonda yuklagani
 * uchun darhol javob bermaydi.
 */
export async function fetchAreaNow(lat, lon) {
  const key = cellKey(lat, lon);
  const stations = await loadCell(key);
  return { cell: key, box: cellBox(key), stations };
}

/** Nechta katak va nechta tarozi keshda — sozlash sahifasi uchun. */
export async function scalesStats() {
  const all = await load();
  const cells = Object.values(all.cells);
  return {
    cells: cells.length,
    stations: cells.reduce((n, c) => n + (c.stations?.length ?? 0), 0),
    google: Boolean(GOOGLE_KEY),
  };
}
