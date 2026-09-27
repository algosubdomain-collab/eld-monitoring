// DOT funksiyasi ishlayaptimi — bitta buyruq bilan tekshirish.
//
//   npm run dot:check                 — sozlama, kesh va manba holati
//   npm run dot:check -- 39.96 -83.0  — shu nuqta atrofini jonli tekshiradi
//
// Har bir qadam alohida ko'rsatiladi, shunda qaysi bo'g'in ishlamayotgani
// darrov ko'rinadi.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAreaNow, scalesStats, distanceKm, disablePersist } from '../src/scales.js';

// Bu buyruq faqat o'qiydi — ayni paytda server ishlayotgan bo'lsa, uning
// keshini bosib yozmasligi kerak.
disablePersist();

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const RADIUS = Number(process.env.DOT_ALERT_KM ?? 5);

const ok = (t) => console.log(`  \x1b[32mok\x1b[0m    ${t}`);
const bad = (t) => console.log(`  \x1b[31mXATO\x1b[0m  ${t}`);
const warn = (t) => console.log(`  \x1b[33m?\x1b[0m     ${t}`);
const head = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

// ---------------------------------------------------------------- 1. sozlama
head('1. Sozlama');
console.log(`  radius            ${RADIUS} km  (.env: DOT_ALERT_KM)`);
console.log(`  katak/yangilanish ${process.env.SCALES_CELLS_PER_PASS ?? 4}`);
if (process.env.GOOGLE_MAPS_API_KEY) ok('Google kaliti qo\'yilgan — OSM ustiga qo\'shiladi');
else warn('Google kaliti yo\'q — faqat OpenStreetMap (bu normal)');
if (process.env.OVERPASS_URL) console.log(`  overpass          ${process.env.OVERPASS_URL}`);

// ---------------------------------------------------------- 2. koordinatalar
head('2. Haydovchilarda koordinata bormi');
let drivers = [];
try {
  const raw = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'cache-sample.json'), 'utf8'));
  drivers = raw.drivers ?? [];
} catch { /* kesh fayli yo'q — pastda tushuntiramiz */ }

if (!drivers.length) {
  warn('Bu yerdan tekshirib bo\'lmadi — server ishlayotganda dashboardga qarang:');
  console.log('        DOT ustunida kulrang nuqta = koordinata bor');
  console.log('        "—" = platforma koordinata bermayapti');
}

// ------------------------------------------------------------------ 3. kesh
head('3. Tarozilar keshi (data/scales.json)');
const stats = await scalesStats();
console.log(`  yuklangan kataklar  ${stats.cells}`);
console.log(`  topilgan tarozilar  ${stats.stations}`);
if (!stats.cells) warn('Hali hech narsa yuklanmagan — server bir necha marta yangilanishi kerak');
else if (!stats.stations) warn('Kataklar yuklangan, lekin tarozi topilmagan (o\'sha hududlarda yo\'q bo\'lishi mumkin)');
else ok(`Baza to'lib boryapti`);

// -------------------------------------------------------------- 4. jonli test
const [latArg, lonArg] = process.argv.slice(2);
head('4. Manba jonli ishlayaptimi');

// Argument berilmasa — tarozilari aniq bor joy (I-70, Ogayo).
const lat = Number(latArg ?? 39.96);
const lon = Number(lonArg ?? -83.00);
if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
  bad('Koordinata noto\'g\'ri. Masalan: npm run dot:check -- 39.96 -83.0');
  process.exit(1);
}
console.log(`  tekshirilmoqda: ${lat}, ${lon}${latArg ? '' : '  (namuna nuqta — I-70, Ogayo)'}`);

try {
  const t0 = Date.now();
  const { cell, stations } = await fetchAreaNow(lat, lon);
  const ms = Date.now() - t0;
  ok(`Manba javob berdi (${ms} ms, katak ${cell})`);

  if (!stations.length) {
    warn('Bu katakda tarozi topilmadi.');
    console.log('        Boshqa nuqta bilan sinab ko\'ring (o\'z yo\'nalishlaringizdan).');
  } else {
    ok(`${stations.length} ta tarozi topildi:`);
    const sorted = stations
      .map((s) => ({ ...s, km: distanceKm(lat, lon, s.lat, s.lon) }))
      .sort((a, b) => a.km - b.km);
    for (const s of sorted.slice(0, 8)) {
      const flag = s.km <= RADIUS ? '  \x1b[31m← radius ichida\x1b[0m' : '';
      console.log(`         ${s.km.toFixed(1).padStart(6)} km  ${s.name}${flag}`);
    }
  }
} catch (err) {
  bad(`Manba javob bermadi: ${err.message}`);
  console.log('        Ommaviy Overpass serverlari tez-tez band bo\'ladi (504).');
  console.log('        Bu vaqtinchalik — keyinroq qayta urinib ko\'ring.');
}

// ------------------------------------------------------------------- xulosa
head('Dashboardda nimani ko\'rasiz');
console.log('  DOT ustuni, Status dan oldin:');
console.log('    —            platforma koordinata bermayapti');
console.log('    kulrang nuqta  koordinata bor, yo\'lida tarozi yo\'q');
console.log('    QIZIL nuqta    yo\'lida ' + RADIUS + ' km ichida tarozi bor (o\'tgach o\'chadi)');
console.log('  Nuqtani bosish  → Google Maps\'da hozirgi joylashuv\n');
