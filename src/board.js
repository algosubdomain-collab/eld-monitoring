// Update board — har bir haydovchi uchun support xodimi to'ldiradigan maydonlar
// (status, manuals, paper logbook, tablet, due date, BOT, tag, note).
//
// Jonli ma'lumot (ism, truck, ELD holati) fleet'dan keladi; bu yerda faqat
// qo'lda kiritiladigan qiymatlar saqlanadi. Har bir foydalanuvchiga tegishli
// (login), haydovchi companyId+driverId bilan emas, faqat driverId bilan.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'board.json'
);

// Tahrirlanadigan ustunlar va turlari.
const BOOL_FIELDS = [];
const TEXT_FIELDS = { status: 60, update: 60, certified: 30, responsible: 60, suggFixed: 40 };

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

async function persist() {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(cache, null, 2));
}

/** { [driverId]: {status, manuals, ...} } — shu foydalanuvchi uchun. */
export async function getBoard(login) {
  const all = await load();
  return all[login] ?? {};
}

/** Bitta haydovchi qatoriga qiymat yozadi (faqat ruxsat etilgan ustunlar). */
export async function patchRow(login, driverId, patch = {}) {
  if (!driverId) throw new Error('driverId required');
  const all = await load();
  const forUser = { ...(all[login] ?? {}) };
  const row = { ...(forUser[driverId] ?? {}) };

  for (const [k, v] of Object.entries(patch)) {
    if (BOOL_FIELDS.includes(k)) {
      row[k] = Boolean(v);
    } else if (k in TEXT_FIELDS) {
      const text = String(v ?? '').trim().slice(0, TEXT_FIELDS[k]);
      if (text) row[k] = text; else delete row[k];
    }
  }

  // Qator butunlay bo'sh bo'lsa — saqlamaymiz (fayl kichik qolsin).
  const empty = Object.keys(row).every((k) => !row[k]);
  if (empty) delete forUser[driverId];
  else forUser[driverId] = row;

  all[login] = forUser;
  cache = all;
  await persist();
  return forUser[driverId] ?? {};
}

/** Akkaunt o'chirilganda board ham o'chsin. */
export async function deleteBoard(login) {
  const all = await load();
  if (!all[login]) return;
  delete all[login];
  await persist();
}
