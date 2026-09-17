// "Update yuborildi" holatini saqlaydi.
//
// Ikki narsa eslab qolinadi:
//   lastRunAt — bo'lim oxirgi marta qachon yuborilgan (keyingi ro'yxat shundan
//               keyin ochiladi: disconnect uchun 1 soat, driving uchun 5 daqiqa);
//   sent      — har bir haydovchiga oxirgi update qachon ketgan (10 soat sovish).
//
// Diskda oddiy JSON fayl — server qayta ishga tushsa ham holat yo'qolmaydi.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'updates.json'
);

export const SECTIONS = {
  disconnect: { releaseMinutes: 60, cooldownHours: 10 },
  'driving-time': { releaseMinutes: 5, cooldownHours: 10 },
};

const empty = () =>
  Object.fromEntries(Object.keys(SECTIONS).map((k) => [k, { lastRunAt: null, sent: {} }]));

let cache = null;

async function read() {
  if (cache) return cache;
  try {
    cache = { ...empty(), ...JSON.parse(await fs.readFile(FILE, 'utf8')) };
  } catch {
    cache = empty(); // fayl hali yo'q — birinchi ishga tushish
  }
  return cache;
}

async function write(state) {
  cache = state;
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(state, null, 2));
}

export async function getUpdates() {
  const state = await read();
  return {
    sections: SECTIONS,
    state,
    now: new Date().toISOString(),
  };
}

/** Bo'limni "yuborildi" deb belgilaydi va sanoqni qaytadan boshlaydi. */
export async function markSent(section, driverIds = []) {
  if (!SECTIONS[section]) throw new Error(`Noma'lum bo'lim: ${section}`);
  if (!Array.isArray(driverIds)) throw new Error('driverIds massiv bo\'lishi kerak');

  const state = await read();
  const now = new Date().toISOString();
  const entry = state[section] ?? { lastRunAt: null, sent: {} };

  for (const id of driverIds) entry.sent[String(id)] = now;
  entry.lastRunAt = now;

  await write({ ...state, [section]: entry });
  return entry;
}
